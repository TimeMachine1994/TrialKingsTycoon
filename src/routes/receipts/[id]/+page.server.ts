import { db, type Receipt, type Vendor } from '$lib/server/db';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const receipt = db.prepare('SELECT * FROM receipts WHERE id = ?').get(params.id) as
		| Receipt
		| undefined;
	if (!receipt) throw error(404, 'Receipt not found');

	const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(receipt.vendor_id) as Vendor;

	const lines = db
		.prepare(
			`SELECT l.*, p.name AS product_name, p.base_unit
			 FROM receipt_lines l JOIN products p ON p.id = l.product_id
			 WHERE l.receipt_id = ?`
		)
		.all(receipt.id) as Array<
		import('$lib/server/db').ReceiptLine & { product_name: string; base_unit: string }
	>;

	return { receipt, vendor, lines };
};
