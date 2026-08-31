import { db, type Product, type UnitConversion, type Vendor } from '$lib/server/db';
import { parseMoney } from '$lib/money';
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

	return { receipts, vendors, products, conversions };
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
			const tax = parseMoney(String(form.get('tax') ?? '0') || '0');
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

			postReceipt({
				vendor_id: vendorId,
				ref_number: refNumber,
				purchased_at: purchasedAt,
				tax,
				shipping,
				allocate_extras: allocateExtras,
				notes,
				lines
			});
			return { success: true };
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to post receipt' });
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
