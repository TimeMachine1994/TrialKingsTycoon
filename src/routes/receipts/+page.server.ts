import { db, getSetting, type Product, type UnitConversion, type Vendor } from '$lib/server/db';
import { saveAttachment } from '$lib/server/services/attachments';
import { createProductFromForm } from '$lib/server/services/products';
import { postReceipt, receiptFromForm } from '$lib/server/services/receipts';
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

export const actions: Actions = {
	post: async ({ request }) => {
		const form = await request.formData();
		try {
			const receiptId = postReceipt(receiptFromForm(form));

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
