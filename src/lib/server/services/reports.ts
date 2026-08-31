import { db } from '$lib/server/db';

export interface DashboardStats {
	inventoryValue: number;
	salesMtd: number;
	cogsMtd: number;
	wasteMtd: number;
	productCount: number;
	openJobs: number;
}

function monthStart(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function dashboardStats(): DashboardStats {
	const inv = db
		.prepare('SELECT COALESCE(SUM(qty_on_hand * avg_cost), 0) AS v FROM products WHERE qty_on_hand > 0')
		.get() as { v: number };
	const sales = db
		.prepare('SELECT COALESCE(SUM(invoiced_amount), 0) AS v FROM jobs WHERE job_date >= ?')
		.get(monthStart()) as { v: number };
	const cogs = db
		.prepare(
			`SELECT COALESCE(SUM(m.qty_base * m.unit_cost_at_time), 0) AS v
			 FROM job_materials m JOIN jobs j ON j.id = m.job_id
			 WHERE j.job_date >= ? AND m.kind = 'used'`
		)
		.get(monthStart()) as { v: number };
	const waste = db
		.prepare(
			`SELECT COALESCE(SUM(m.qty_base * m.unit_cost_at_time), 0) AS v
			 FROM job_materials m JOIN jobs j ON j.id = m.job_id
			 WHERE j.job_date >= ? AND m.kind = 'waste'`
		)
		.get(monthStart()) as { v: number };
	const products = db.prepare('SELECT COUNT(*) AS c FROM products').get() as { c: number };
	const open = db.prepare(`SELECT COUNT(*) AS c FROM jobs WHERE status = 'open'`).get() as {
		c: number;
	};

	return {
		inventoryValue: inv.v,
		salesMtd: sales.v,
		cogsMtd: cogs.v,
		wasteMtd: waste.v,
		productCount: products.c,
		openJobs: open.c
	};
}

export interface PeriodReportRow {
	period: string;
	sales: number;
	cogs: number;
	waste: number;
}

export function salesVsCogsByMonth(): PeriodReportRow[] {
	const rows = db
		.prepare(
			`SELECT substr(j.job_date, 1, 7) AS period,
				SUM(j.invoiced_amount) AS sales,
				COALESCE((SELECT SUM(m.qty_base * m.unit_cost_at_time) FROM job_materials m
					JOIN jobs j2 ON j2.id = m.job_id
					WHERE substr(j2.job_date,1,7) = substr(j.job_date,1,7) AND m.kind='used'), 0) AS cogs,
				COALESCE((SELECT SUM(m.qty_base * m.unit_cost_at_time) FROM job_materials m
					JOIN jobs j3 ON j3.id = m.job_id
					WHERE substr(j3.job_date,1,7) = substr(j.job_date,1,7) AND m.kind='waste'), 0) AS waste
			 FROM jobs j
			 GROUP BY period ORDER BY period DESC`
		)
		.all() as PeriodReportRow[];
	return rows;
}

export interface WasteRow {
	product_id: number;
	product_name: string;
	base_unit: string;
	qty: number;
	cost: number;
	reasons: string | null;
}

export function wasteByProduct(): WasteRow[] {
	return db
		.prepare(
			`SELECT m.product_id, p.name AS product_name, p.base_unit,
				SUM(m.qty_base) AS qty, SUM(m.qty_base * m.unit_cost_at_time) AS cost,
				GROUP_CONCAT(DISTINCT m.waste_reason) AS reasons
			 FROM job_materials m JOIN products p ON p.id = m.product_id
			 WHERE m.kind = 'waste'
			 GROUP BY m.product_id ORDER BY cost DESC`
		)
		.all() as WasteRow[];
}

export interface ValuationRow {
	id: number;
	name: string;
	base_unit: string;
	qty_on_hand: number;
	avg_cost: number;
	value: number;
}

export function inventoryValuation(): ValuationRow[] {
	return db
		.prepare(
			`SELECT id, name, base_unit, qty_on_hand, avg_cost, (qty_on_hand * avg_cost) AS value
			 FROM products ORDER BY value DESC`
		)
		.all() as ValuationRow[];
}
