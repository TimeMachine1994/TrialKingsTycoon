import { db, type Product } from '$lib/server/db';

export interface NewJob {
	name: string;
	client: string | null;
	invoice_number: string | null;
	invoiced_amount: number;
	job_date: string;
	notes: string | null;
}

export function createJob(input: NewJob): number {
	return db
		.prepare(
			`INSERT INTO jobs (name, client, invoice_number, invoiced_amount, job_date, notes)
			 VALUES (?, ?, ?, ?, ?, ?)`
		)
		.run(
			input.name,
			input.client,
			input.invoice_number,
			input.invoiced_amount,
			input.job_date,
			input.notes
		).lastInsertRowid as number;
}

/**
 * Adds a material (used or waste) line to a job:
 * - snapshots the product's current average cost
 * - decrements stock and writes an audit movement
 */
export function addJobMaterial(
	jobId: number,
	productId: number,
	qtyBase: number,
	kind: 'used' | 'waste',
	wasteReason: string | null
): void {
	if (qtyBase <= 0) throw new Error('Quantity must be positive');

	const run = db.transaction(() => {
		const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as
			| Product
			| undefined;
		if (!product) throw new Error(`Product ${productId} not found`);

		db.prepare(
			`INSERT INTO job_materials (job_id, product_id, qty_base, kind, unit_cost_at_time, waste_reason)
			 VALUES (?, ?, ?, ?, ?, ?)`
		).run(jobId, productId, qtyBase, kind, product.avg_cost, wasteReason);

		db.prepare('UPDATE products SET qty_on_hand = qty_on_hand - ? WHERE id = ?').run(
			qtyBase,
			productId
		);

		db.prepare(
			`INSERT INTO stock_movements (product_id, kind, qty_delta, unit_cost, ref_table, ref_id)
			 VALUES (?, ?, ?, ?, 'jobs', ?)`
		).run(productId, kind === 'used' ? 'job_use' : 'job_waste', -qtyBase, product.avg_cost, jobId);
	});
	run();
}

export function removeJobMaterial(materialId: number): void {
	const run = db.transaction(() => {
		const mat = db.prepare('SELECT * FROM job_materials WHERE id = ?').get(materialId) as
			| { id: number; job_id: number; product_id: number; qty_base: number; kind: string; unit_cost_at_time: number }
			| undefined;
		if (!mat) return;
		db.prepare('DELETE FROM job_materials WHERE id = ?').run(materialId);
		db.prepare('UPDATE products SET qty_on_hand = qty_on_hand + ? WHERE id = ?').run(
			mat.qty_base,
			mat.product_id
		);
		db.prepare(
			`INSERT INTO stock_movements (product_id, kind, qty_delta, unit_cost, ref_table, ref_id, note)
			 VALUES (?, 'adjustment', ?, ?, 'jobs', ?, 'material line removed')`
		).run(mat.product_id, mat.qty_base, mat.unit_cost_at_time, mat.job_id);
	});
	run();
}

export function setJobStatus(jobId: number, status: 'open' | 'closed'): void {
	db.prepare('UPDATE jobs SET status = ? WHERE id = ?').run(status, jobId);
}

export interface JobCosts {
	usedCost: number;
	wasteCost: number;
	profit: number;
}

export function jobCosts(jobId: number, invoicedAmount: number): JobCosts {
	const rows = db
		.prepare(
			`SELECT kind, SUM(qty_base * unit_cost_at_time) AS cost
			 FROM job_materials WHERE job_id = ? GROUP BY kind`
		)
		.all(jobId) as { kind: string; cost: number }[];
	const usedCost = rows.find((r) => r.kind === 'used')?.cost ?? 0;
	const wasteCost = rows.find((r) => r.kind === 'waste')?.cost ?? 0;
	return { usedCost, wasteCost, profit: invoicedAmount - usedCost - wasteCost };
}
