import { db, type Receipt, type Vendor } from '$lib/server/db';
import {
	deleteAttachment,
	listAttachments,
	saveAttachment
} from '$lib/server/services/attachments';
import { voidReceipt } from '$lib/server/services/receipts';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

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

	const attachments = listAttachments(receipt.id);

	return { receipt, vendor, lines, attachments };
};

export const actions: Actions = {
	attach: async ({ request, params }) => {
		const form = await request.formData();
		const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
		if (files.length === 0) return fail(400, { error: 'Pick at least one file' });
		try {
			for (const file of files) {
				await saveAttachment(Number(params.id), file);
			}
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Upload failed' });
		}
		return { success: true };
	},

	deleteAttachment: async ({ request }) => {
		const form = await request.formData();
		deleteAttachment(Number(form.get('attachment_id')));
		return { success: true };
	},

	void: async ({ params }) => {
		try {
			voidReceipt(Number(params.id));
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to void receipt' });
		}
		return { success: true };
	}
};
