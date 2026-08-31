import { db, type Vendor } from '$lib/server/db';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const vendors = db
		.prepare(
			`SELECT v.*,
				(SELECT COUNT(*) FROM receipts r WHERE r.vendor_id = v.id) AS receipt_count,
				COALESCE((SELECT SUM(r.total) FROM receipts r WHERE r.vendor_id = v.id), 0) AS total_spent
			 FROM vendors v ORDER BY total_spent DESC`
		)
		.all() as Array<Vendor & { receipt_count: number; total_spent: number }>;

	const receipts = db
		.prepare(
			`SELECT r.*, v.name AS vendor_name FROM receipts r
			 JOIN vendors v ON v.id = r.vendor_id
			 ORDER BY r.purchased_at DESC LIMIT 50`
		)
		.all() as Array<import('$lib/server/db').Receipt & { vendor_name: string }>;

	return { vendors, receipts };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Vendor name required' });
		db.prepare('INSERT INTO vendors (name, url, notes) VALUES (?, ?, ?)').run(
			name,
			String(form.get('url') ?? '').trim() || null,
			String(form.get('notes') ?? '').trim() || null
		);
		return { success: true };
	}
};
