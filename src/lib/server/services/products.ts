import { db } from '$lib/server/db';

/**
 * Creates a product (plus optional purchase-unit conversion) from a submitted
 * ProductForm. Shared by /products and the inline form on /receipts.
 * Returns the new product id.
 */
export function createProductFromForm(form: FormData): number {
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

	if (!name) throw new Error('Product name is required');
	if (reorderPoint !== null && (!Number.isInteger(reorderPoint) || reorderPoint < 0)) {
		throw new Error('Reorder point must be a whole number');
	}

	const tx = db.transaction((): number => {
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
	return tx();
}
