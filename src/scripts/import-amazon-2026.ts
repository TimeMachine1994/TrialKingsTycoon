/**
 * One-off data import: print-related Amazon orders (May–Aug 2026).
 *
 * Run from the repo root (the DB lives at ./data/inventory.db):
 *   npx vite-node src/scripts/import-amazon-2026.ts
 *
 * Idempotent: products are matched by SKU (or by existing seed product id),
 * the vendor by name, and each receipt is skipped if one with the same
 * ref_number (Amazon order number) already exists.
 *
 * Non-print items on these orders (AV gear, collar stays, the printer itself)
 * are intentionally excluded; tax for partial orders is the line's share of
 * the 7.0% Amazon actually charged on every order (Oviedo, FL).
 */
import { db, type Product, type Vendor } from '$lib/server/db';
import { postReceipt, type NewReceipt } from '$lib/server/services/receipts';
import { parseMoney, parseRate, taxFromRate } from '$lib/money';

const VENDOR_NAME = 'Amazon';
const AMAZON_TAX_RATE = parseRate('7.0');

interface ProductSpec {
	key: string;
	sku: string | null;
	existingId?: number; // reuse a seed product instead of creating one
	name: string;
	category: string;
	base_unit: string;
	sprite: string;
	pack: { unit_name: string; base_units_per: number };
}

const products: ProductSpec[] = [
	{ key: 'paper', existingId: 1, sku: 'OX-9001P-CTN', name: 'Letter Paper 20lb (3-hole punch)', category: 'paper', base_unit: 'sheet', sprite: 'ream', pack: { unit_name: 'case (5,000)', base_units_per: 5000 } },
	{ key: 'toner', existingId: 2, sku: 'TN830XL', name: 'Black Toner Cartridge', category: 'toner', base_unit: 'cartridge', sprite: 'toner', pack: { unit_name: '4-pack', base_units_per: 4 } },
	{ key: 'binder1in', existingId: 4, sku: null, name: '1" 3-Ring Binder', category: 'binding', base_unit: 'binder', sprite: 'binder', pack: { unit_name: '12-pack', base_units_per: 12 } },
	{ key: 'binderHalf', sku: null, name: 'SUIN 1/2" 3-Ring Binder (2 pockets)', category: 'binding', base_unit: 'binder', sprite: 'binder', pack: { unit_name: '6-pack', base_units_per: 6 } },
	{ key: 'tabs1to10', sku: 'TABBIES-58000', name: 'Tabbies 58000 Legal Exhibit Tabs #1-10 (Blue)', category: 'binding', base_unit: 'tab', sprite: 'binder', pack: { unit_name: 'pack (100)', base_units_per: 100 } },
	{ key: 'tabs11to20', sku: 'TABBIES-58001', name: 'Tabbies 58001 Legal Exhibit Tabs #11-20 (Blue)', category: 'binding', base_unit: 'tab', sprite: 'binder', pack: { unit_name: 'pack (100)', base_units_per: 100 } },
	{ key: 'fileBox', sku: 'B07JFXBTR8', name: 'Amazon Basics Storage/Filing Box (Letter/Legal)', category: 'other', base_unit: 'box', sprite: 'box', pack: { unit_name: '20-pack', base_units_per: 20 } }
];

interface Line { key: string; qty: number; line_cost: string }
interface ReceiptSpec {
	ref_number: string;
	purchased_at: string;
	tax: string | 'rate'; // 'rate' = compute from AMAZON_TAX_RATE on the imported subtotal
	notes: string;
	lines: Line[];
}

const receipts: ReceiptSpec[] = [
	{
		ref_number: '111-1668598-6604228',
		purchased_at: '2026-05-21',
		tax: 'rate',
		notes: 'Amazon order (Visa ****3421). Toner line only; printer + AV equipment on this order excluded. Tax = 7% share of $92.41 charged.',
		lines: [{ key: 'toner', qty: 1, line_cost: '64.68' }]
	},
	{
		ref_number: '112-0700223-9373833',
		purchased_at: '2026-08-19',
		tax: '4.86',
		notes: 'Amazon order (Mastercard ****5211). Boise X-9 10-ream case, sold by MDNZ LLC.',
		lines: [{ key: 'paper', qty: 1, line_cost: '69.45' }]
	},
	{
		ref_number: '112-6427003-9452252',
		purchased_at: '2026-08-19',
		tax: 'rate',
		notes: 'ESTIMATED: Amazon receipt showed no prices. Binder prices copied from order 114-7831054-5530624; filing boxes at $44.99 list price. Collar stays excluded.',
		lines: [
			{ key: 'binderHalf', qty: 1, line_cost: '21.99' },
			{ key: 'binder1in', qty: 2, line_cost: '61.98' },
			{ key: 'fileBox', qty: 1, line_cost: '44.99' }
		]
	},
	{
		ref_number: '114-7831054-5530624',
		purchased_at: '2026-08-22',
		tax: '3.71',
		notes: 'Amazon order (Visa ****3421). Sold by Suin Office / EGLINKUS.',
		lines: [
			{ key: 'binderHalf', qty: 1, line_cost: '21.99' },
			{ key: 'binder1in', qty: 1, line_cost: '30.99' }
		]
	},
	{
		ref_number: '112-9710673-5737027',
		purchased_at: '2026-08-31',
		tax: '1.12',
		notes: 'Amazon order (Amex ****1046).',
		lines: [
			{ key: 'tabs1to10', qty: 1, line_cost: '8.99' },
			{ key: 'tabs11to20', qty: 1, line_cost: '6.99' }
		]
	}
];

function ensureVendor(name: string): number {
	const existing = db.prepare('SELECT * FROM vendors WHERE name = ?').get(name) as Vendor | undefined;
	if (existing) return existing.id;
	return db.prepare('INSERT INTO vendors (name, url) VALUES (?, ?)').run(name, 'https://www.amazon.com')
		.lastInsertRowid as number;
}

function ensureConversion(productId: number, unitName: string, per: number): void {
	const row = db
		.prepare('SELECT id FROM unit_conversions WHERE product_id = ? AND unit_name = ?')
		.get(productId, unitName);
	if (!row) {
		db.prepare('INSERT INTO unit_conversions (product_id, unit_name, base_units_per) VALUES (?, ?, ?)').run(
			productId, unitName, per
		);
	}
}

function ensureProducts(): Record<string, ProductSpec & { id: number }> {
	const out: Record<string, ProductSpec & { id: number }> = {};
	const byId = db.prepare('SELECT * FROM products WHERE id = ?');
	const bySku = db.prepare('SELECT * FROM products WHERE sku = ?');
	const byName = db.prepare('SELECT * FROM products WHERE name = ?');
	const insert = db.prepare(
		'INSERT INTO products (name, sku, category, base_unit, sprite) VALUES (?, ?, ?, ?, ?)'
	);
	const setSku = db.prepare('UPDATE products SET sku = ? WHERE id = ? AND sku IS NULL');

	for (const p of products) {
		let existing: Product | undefined;
		if (p.existingId) existing = byId.get(p.existingId) as Product | undefined;
		if (!existing && p.sku) existing = bySku.get(p.sku) as Product | undefined;
		if (!existing) existing = byName.get(p.name) as Product | undefined;

		let id: number;
		if (existing) {
			id = existing.id;
			if (p.sku) setSku.run(p.sku, id);
			console.log(`product exists  #${id} ${existing.name}`);
		} else {
			id = insert.run(p.name, p.sku, p.category, p.base_unit, p.sprite).lastInsertRowid as number;
			console.log(`product created #${id} ${p.name}`);
		}
		ensureConversion(id, p.pack.unit_name, p.pack.base_units_per);
		out[p.key] = { ...p, id };
	}
	return out;
}

const run = db.transaction(() => {
	const vendorId = ensureVendor(VENDOR_NAME);
	const prods = ensureProducts();
	const exists = db.prepare('SELECT id FROM receipts WHERE vendor_id = ? AND ref_number = ?');

	for (const r of receipts) {
		const dup = exists.get(vendorId, r.ref_number) as { id: number } | undefined;
		if (dup) {
			console.log(`receipt ${r.ref_number} already imported as #${dup.id}, skipping`);
			continue;
		}
		const lines = r.lines.map((l) => {
			const p = prods[l.key];
			return {
				product_id: p.id,
				unit_name: p.pack.unit_name,
				base_units_per: p.pack.base_units_per,
				qty_purchased: l.qty,
				line_cost: parseMoney(l.line_cost)
			};
		});
		const subtotal = lines.reduce((a, l) => a + l.line_cost, 0);
		const input: NewReceipt = {
			vendor_id: vendorId,
			ref_number: r.ref_number,
			purchased_at: r.purchased_at,
			tax: r.tax === 'rate' ? taxFromRate(subtotal, AMAZON_TAX_RATE) : parseMoney(r.tax),
			tax_rate: AMAZON_TAX_RATE,
			shipping: 0,
			allocate_extras: true,
			notes: r.notes,
			lines
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
