import { db, type Product, type UnitConversion } from '$lib/server/db';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const products = db.prepare('SELECT * FROM products ORDER BY name').all() as Product[];
	const conversions = db.prepare('SELECT * FROM unit_conversions').all() as UnitConversion[];
	return { products, conversions };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const category = String(form.get('category') ?? 'other');
		const baseUnit = String(form.get('base_unit') ?? 'each').trim() || 'each';
		const sprite = String(form.get('sprite') ?? 'box');
		const sku = String(form.get('sku') ?? '').trim() || null;
		const reorderRaw = String(form.get('reorder_point') ?? '').trim();
		const reorderPoint = reorderRaw === '' ? null : Number(reorderRaw);
		const notes = String(form.get('notes') ?? '').trim() || null;
		const convName = String(form.get('conv_name') ?? '').trim();
		const convPer = Number(form.get('conv_per') ?? 0);

		if (!name) return fail(400, { error: 'Product name is required' });
		if (reorderPoint !== null && (!Number.isInteger(reorderPoint) || reorderPoint < 0)) {
			return fail(400, { error: 'Reorder point must be a whole number' });
		}

		const tx = db.transaction(() => {
			const id = db
				.prepare(
					`INSERT INTO products (name, sku, category, base_unit, sprite, reorder_point, notes)
					 VALUES (?, ?, ?, ?, ?, ?, ?)`
				)
				.run(name, sku, category, baseUnit, sprite, reorderPoint, notes).lastInsertRowid as number;
			if (convName && Number.isInteger(convPer) && convPer > 1) {
				db.prepare(
					'INSERT INTO unit_conversions (product_id, unit_name, base_units_per) VALUES (?, ?, ?)'
				).run(id, convName, convPer);
			}
			return id;
		});
		tx();
		return { success: true };
	},

	addConversion: async ({ request }) => {
		const form = await request.formData();
		const productId = Number(form.get('product_id'));
		const unitName = String(form.get('unit_name') ?? '').trim();
		const per = Number(form.get('base_units_per'));
		if (!productId || !unitName || !Number.isInteger(per) || per < 1) {
			return fail(400, { error: 'Conversion needs a name and a whole number of base units' });
		}
		db.prepare(
			'INSERT INTO unit_conversions (product_id, unit_name, base_units_per) VALUES (?, ?, ?)'
		).run(productId, unitName, per);
		return { success: true };
	}
};
