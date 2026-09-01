import { db, type Product, type UnitConversion } from '$lib/server/db';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export interface PurchaseHistoryRow {
	receipt_id: number;
	purchased_at: string;
	vendor_name: string;
	ref_number: string | null;
	voided_at: string | null;
	unit_name: string;
	qty_purchased: number;
	qty_base: number;
	line_cost: number;
	unit_cost_base: number;
}

export const load: PageServerLoad = ({ params }) => {
	const product = db.prepare('SELECT * FROM products WHERE id = ?').get(params.id) as
		| Product
		| undefined;
	if (!product) throw error(404, 'Product not found');

	const conversions = db
		.prepare('SELECT * FROM unit_conversions WHERE product_id = ?')
		.all(product.id) as UnitConversion[];

	const purchases = db
		.prepare(
			`SELECT l.receipt_id, r.purchased_at, v.name AS vendor_name, r.ref_number, r.voided_at,
				l.unit_name, l.qty_purchased, l.qty_base, l.line_cost, l.unit_cost_base
			 FROM receipt_lines l
			 JOIN receipts r ON r.id = l.receipt_id
			 JOIN vendors v ON v.id = r.vendor_id
			 WHERE l.product_id = ?
			 ORDER BY r.purchased_at DESC, l.id DESC`
		)
		.all(product.id) as PurchaseHistoryRow[];

	const movements = db
		.prepare(
			`SELECT * FROM stock_movements WHERE product_id = ? ORDER BY id DESC LIMIT 50`
		)
		.all(product.id) as import('$lib/server/db').StockMovement[];

	return { product, conversions, purchases, movements };
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const reorderRaw = String(form.get('reorder_point') ?? '').trim();
		const reorderPoint = reorderRaw === '' ? null : Number(reorderRaw);
		const notes = String(form.get('notes') ?? '').trim() || null;
		if (!name) return fail(400, { error: 'Name is required' });
		db.prepare('UPDATE products SET name = ?, reorder_point = ?, notes = ? WHERE id = ?').run(
			name,
			reorderPoint,
			notes,
			params.id
		);
		return { success: true };
	},

	adjust: async ({ request, params }) => {
		const form = await request.formData();
		const newQty = Number(form.get('new_qty'));
		const note = String(form.get('note') ?? '').trim() || 'manual count';
		if (!Number.isInteger(newQty)) return fail(400, { error: 'Quantity must be a whole number' });

		const tx = db.transaction(() => {
			const product = db.prepare('SELECT * FROM products WHERE id = ?').get(params.id) as Product;
			const delta = newQty - product.qty_on_hand;
			if (delta === 0) return;
			db.prepare('UPDATE products SET qty_on_hand = ? WHERE id = ?').run(newQty, product.id);
			db.prepare(
				`INSERT INTO stock_movements (product_id, kind, qty_delta, unit_cost, ref_table, ref_id, note)
				 VALUES (?, 'adjustment', ?, ?, NULL, NULL, ?)`
			).run(product.id, delta, product.avg_cost, note);
		});
		tx();
		return { success: true };
	}
};
