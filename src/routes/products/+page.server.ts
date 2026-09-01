import { db, type Product, type UnitConversion } from '$lib/server/db';
import { createProductFromForm } from '$lib/server/services/products';
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
		try {
			createProductFromForm(form);
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to create product' });
		}
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
