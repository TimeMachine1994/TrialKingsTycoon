import { db, type Product } from '$lib/server/db';
import { dashboardStats } from '$lib/server/services/reports';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const stats = dashboardStats();

	const lowStock = db
		.prepare(
			`SELECT * FROM products
			 WHERE reorder_point IS NOT NULL AND qty_on_hand <= reorder_point
			 ORDER BY (qty_on_hand * 1.0) / NULLIF(reorder_point, 0) ASC LIMIT 8`
		)
		.all() as Product[];

	const recent = db
		.prepare(
			`SELECT m.*, p.name AS product_name, p.base_unit
			 FROM stock_movements m JOIN products p ON p.id = m.product_id
			 ORDER BY m.id DESC LIMIT 12`
		)
		.all() as Array<
		import('$lib/server/db').StockMovement & { product_name: string; base_unit: string }
	>;

	return { stats, lowStock, recent };
};
