/**
 * One-off data import: two Staples receipts from 2026-08-24.
 *
 * Run from the repo root (the DB lives at ./data/inventory.db):
 *   npx vite-node src/scripts/import-staples-2026-08-24.ts
 *
 * Idempotent: products are upserted by SKU, the vendor by name, and each
 * receipt is skipped if a receipt with the same ref_number already exists.
 */
import { db, type Product, type Vendor } from '$lib/server/db';
import { postReceipt, type NewReceipt } from '$lib/server/services/receipts';
import { parseMoney, parseRate } from '$lib/money';

const VENDOR_NAME = 'Staples';
const PURCHASED_AT = '2026-08-24';
const FL_TAX_RATE = parseRate('6.5');

const products = [
	{ name: 'Legal Exhibit Index Tabs 1-25 (White)', sku: '718103125000', category: 'binding', base_unit: 'set', sprite: 'binder' },
	{ name: 'Avery 5230 File Folder Labels', sku: '072782052300', category: 'paper', base_unit: 'sheet', sprite: 'paperstack' },
	{ name: 'Postcard Laser 5.5"', sku: '072782056896', category: 'paper', base_unit: 'sheet', sprite: 'paperstack' },
	{ name: 'Avery Laser Labels (Top 25)', sku: '072782052652', category: 'paper', base_unit: 'sheet', sprite: 'paperstack' }
];

interface Line { sku: string; unit_name: string; qty: number; line_cost: string }
interface ReceiptSpec { ref_number: string; tax: string; notes: string; lines: Line[] }

const receipts: ReceiptSpec[] = [
	{
		ref_number: '1034-3-15605',
		tax: '5.33',
		notes: 'Staples #1034 Orlando, 9:06 AM, US Debit ****5034',
		lines: [
			{ sku: '072782052300', unit_name: 'pack', qty: 1, line_cost: '11.29' },
			{ sku: '072782056896', unit_name: 'pack', qty: 1, line_cost: '31.99' },
			{ sku: '718103125000', unit_name: 'set', qty: 2, line_cost: '20.98' },
			{ sku: '072782052652', unit_name: 'pack', qty: 1, line_cost: '17.79' }
		]
	},
	{
		ref_number: '1034-3-16029',
		tax: '1.36',
		notes: 'Staples #1034 Orlando, 10:10 AM, US Debit ****5211',
		lines: [{ sku: '718103125000', unit_name: 'set', qty: 2, line_cost: '20.98' }]
	}
];

function ensureVendor(name: string): number {
	const existing = db.prepare('SELECT * FROM vendors WHERE name = ?').get(name) as Vendor | undefined;
	if (existing) return existing.id;
	return db.prepare('INSERT INTO vendors (name, url) VALUES (?, ?)').run(name, 'https://www.staples.com')
		.lastInsertRowid as number;
}

function ensureProducts(): Record<string, number> {
	const bySku: Record<string, number> = {};
	const find = db.prepare('SELECT * FROM products WHERE sku = ?');
	const insert = db.prepare(
		'INSERT INTO products (name, sku, category, base_unit, sprite) VALUES (?, ?, ?, ?, ?)'
	);
	for (const p of products) {
		const existing = find.get(p.sku) as Product | undefined;
		if (existing) {
			bySku[p.sku] = existing.id;
			console.log(`product exists  ${p.sku}  #${existing.id} ${existing.name}`);
		} else {
			const id = insert.run(p.name, p.sku, p.category, p.base_unit, p.sprite).lastInsertRowid as number;
			bySku[p.sku] = id;
			console.log(`product created ${p.sku}  #${id} ${p.name}`);
		}
	}
	return bySku;
}

const run = db.transaction(() => {
	const vendorId = ensureVendor(VENDOR_NAME);
	const bySku = ensureProducts();
	const exists = db.prepare('SELECT id FROM receipts WHERE vendor_id = ? AND ref_number = ?');

	for (const r of receipts) {
		const dup = exists.get(vendorId, r.ref_number) as { id: number } | undefined;
		if (dup) {
			console.log(`receipt ${r.ref_number} already imported as #${dup.id}, skipping`);
			continue;
		}
		const input: NewReceipt = {
			vendor_id: vendorId,
			ref_number: r.ref_number,
			purchased_at: PURCHASED_AT,
			tax: parseMoney(r.tax),
			tax_rate: FL_TAX_RATE,
			shipping: 0,
			allocate_extras: true,
			notes: r.notes,
			lines: r.lines.map((l) => ({
				product_id: bySku[l.sku],
				unit_name: l.unit_name,
				base_units_per: 1,
				qty_purchased: l.qty,
				line_cost: parseMoney(l.line_cost)
			}))
		};
		const id = postReceipt(input);
		const row = db.prepare('SELECT subtotal, tax, total FROM receipts WHERE id = ?').get(id) as {
			subtotal: number; tax: number; total: number;
		};
		console.log(
			`receipt ${r.ref_number} posted as #${id}: subtotal $${(row.subtotal / 1e6).toFixed(2)} tax $${(row.tax / 1e6).toFixed(2)} total $${(row.total / 1e6).toFixed(2)}`
		);
	}
});

run();
