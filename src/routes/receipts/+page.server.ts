import { db, getSetting, setSetting, type Product, type UnitConversion, type Vendor } from '$lib/server/db';
import { parseMoney, parseRate, taxFromRate } from '$lib/money';
import { saveAttachment } from '$lib/server/services/attachments';
import { createProductFromForm } from '$lib/server/services/products';
import { postReceipt, type NewReceiptLine } from '$lib/server/services/receipts';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const receipts = db
		.prepare(
			`SELECT r.*, v.name AS vendor_name,
				(SELECT COUNT(*) FROM receipt_lines l WHERE l.receipt_id = r.id) AS line_count
			 FROM receipts r JOIN vendors v ON v.id = r.vendor_id
			 ORDER BY r.purchased_at DESC, r.id DESC LIMIT 100`
		)
		.all() as Array<import('$lib/server/db').Receipt & { vendor_name: string; line_count: number }>;

	const vendors = db.prepare('SELECT * FROM vendors ORDER BY name').all() as Vendor[];
	const products = db.prepare('SELECT * FROM products ORDER BY name').all() as Product[];
	const conversions = db.prepare('SELECT * FROM unit_conversions').all() as UnitConversion[];

	const defaultTaxRate = getSetting('default_tax_rate') ?? '';

	return { receipts, vendors, products, conversions, defaultTaxRate };
};

interface LinePayload {
	product_id: number;
	unit_name: string;
	base_units_per: number;
	qty_purchased: number;
	line_cost: string;
}

export const actions: Actions = {
	post: async ({ request }) => {
		const form = await request.formData();
		try {
			const vendorId = Number(form.get('vendor_id'));
			const purchasedAt = String(form.get('purchased_at') ?? '');
			const refNumber = String(form.get('ref_number') ?? '').trim() || null;
			const notes = String(form.get('notes') ?? '').trim() || null;
			const shipping = parseMoney(String(form.get('shipping') ?? '0') || '0');
			const allocateExtras = form.get('allocate_extras') === 'on';
			const rawLines = JSON.parse(String(form.get('lines') ?? '[]')) as LinePayload[];

			if (!vendorId) return fail(400, { error: 'Pick a vendor' });
			if (!purchasedAt) return fail(400, { error: 'Purchase date is required' });
			if (rawLines.length === 0) return fail(400, { error: 'Add at least one line' });

			const lines: NewReceiptLine[] = rawLines.map((l) => ({
				product_id: Number(l.product_id),
				unit_name: l.unit_name,
				base_units_per: Number(l.base_units_per),
				qty_purchased: Number(l.qty_purchased),
				line_cost: parseMoney(l.line_cost || '0')
			}));

			// Tax: rate mode (auto-calc, authoritative on the server) or manual $ entry
			const taxMode = String(form.get('tax_mode') ?? 'manual');
			const rateStr = String(form.get('tax_rate') ?? '').trim();
			const subtotal = lines.reduce((a, l) => a + l.line_cost, 0);
			let tax: number;
			let taxRate: number | null;
			if (taxMode === 'rate' && rateStr !== '') {
				taxRate = parseRate(rateStr);
				tax = taxFromRate(subtotal, taxRate);
				setSetting('default_tax_rate', rateStr);
			} else {
				taxRate = null;
				tax = parseMoney(String(form.get('tax') ?? '0') || '0');
			}

			const receiptId = postReceipt({
				vendor_id: vendorId,
				ref_number: refNumber,
				purchased_at: purchasedAt,
				tax,
				tax_rate: taxRate,
				shipping,
				allocate_extras: allocateExtras,
				notes,
				lines
			});

			// Save any uploaded receipt files after the transaction committed
			const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
			for (const file of files) {
				await saveAttachment(receiptId, file);
			}

			return { success: true };
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to post receipt' });
		}
	},

	addProduct: async ({ request }) => {
		const form = await request.formData();
		try {
			const newProductId = createProductFromForm(form);
			return { success: true, newProductId };
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to create product' });
		}
	},

	addVendor: async ({ request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Vendor name required' });
		const url = String(form.get('url') ?? '').trim() || null;
		db.prepare('INSERT INTO vendors (name, url) VALUES (?, ?)').run(name, url);
		return { success: true };
	}
};
