import { db } from '$lib/server/db';
import { divRound } from '$lib/money';
import { averageInventory, daysInventory, turnover, wastePct } from '$lib/ratios';
import { laborPerJob, monthlyFixed } from '$lib/breakeven';
import { getActiveScenario } from './planner';

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
	job_count: number;
	sales: number;
	cogs: number;
	waste: number;
}

export function salesVsCogsByMonth(): PeriodReportRow[] {
	const rows = db
		.prepare(
			`SELECT substr(j.job_date, 1, 7) AS period,
				COUNT(*) AS job_count,
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
	used_qty: number;
	reasons: string | null;
}

export function wasteByProduct(): WasteRow[] {
	return db
		.prepare(
			`SELECT m.product_id, p.name AS product_name, p.base_unit,
				SUM(m.qty_base) AS qty, SUM(m.qty_base * m.unit_cost_at_time) AS cost,
				COALESCE((SELECT SUM(u.qty_base) FROM job_materials u
					WHERE u.product_id = m.product_id AND u.kind = 'used'), 0) AS used_qty,
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
	used_all_time: number;
}

export function inventoryValuation(): ValuationRow[] {
	return db
		.prepare(
			`SELECT p.id, p.name, p.base_unit, p.qty_on_hand, p.avg_cost, (p.qty_on_hand * p.avg_cost) AS value,
				COALESCE((SELECT SUM(m.qty_base) FROM job_materials m
					WHERE m.product_id = p.id AND m.kind IN ('used','waste')), 0) AS used_all_time
			 FROM products p ORDER BY value DESC`
		)
		.all() as ValuationRow[];
}

// ---- Margin analysis ----

export interface JobMarginRow {
	id: number;
	name: string;
	client: string | null;
	invoice_number: string | null;
	job_date: string;
	sales: number;
	used: number;
	waste: number;
	gross: number;
}

export function marginByJob(): JobMarginRow[] {
	return db
		.prepare(
			`SELECT j.id, j.name, j.client, j.invoice_number, j.job_date, j.invoiced_amount AS sales,
				COALESCE((SELECT SUM(m.qty_base * m.unit_cost_at_time) FROM job_materials m WHERE m.job_id = j.id AND m.kind = 'used'), 0) AS used,
				COALESCE((SELECT SUM(m.qty_base * m.unit_cost_at_time) FROM job_materials m WHERE m.job_id = j.id AND m.kind = 'waste'), 0) AS waste,
				j.invoiced_amount
					- COALESCE((SELECT SUM(m.qty_base * m.unit_cost_at_time) FROM job_materials m WHERE m.job_id = j.id), 0) AS gross
			 FROM jobs j ORDER BY j.job_date DESC, j.id DESC`
		)
		.all() as JobMarginRow[];
}

export interface ClientMarginRow {
	client: string;
	job_count: number;
	sales: number;
	used: number;
	waste: number;
	gross: number;
}

export function marginByClient(): ClientMarginRow[] {
	return db
		.prepare(
			`SELECT COALESCE(NULLIF(TRIM(j.client), ''), '(no client)') AS client,
				COUNT(*) AS job_count,
				SUM(j.invoiced_amount) AS sales,
				COALESCE(SUM((SELECT SUM(m.qty_base * m.unit_cost_at_time) FROM job_materials m WHERE m.job_id = j.id AND m.kind = 'used')), 0) AS used,
				COALESCE(SUM((SELECT SUM(m.qty_base * m.unit_cost_at_time) FROM job_materials m WHERE m.job_id = j.id AND m.kind = 'waste')), 0) AS waste,
				SUM(j.invoiced_amount)
					- COALESCE(SUM((SELECT SUM(m.qty_base * m.unit_cost_at_time) FROM job_materials m WHERE m.job_id = j.id)), 0) AS gross
			 FROM jobs j GROUP BY client ORDER BY gross DESC`
		)
		.all() as ClientMarginRow[];
}

// ---- Active scenario overhead (Planner → Reports) ----

export interface ActiveOverhead {
	id: number;
	name: string;
	fixedMonthly: number;
	laborPerJob: number;
}

export function activeScenarioOverhead(): ActiveOverhead | null {
	const s = getActiveScenario();
	if (!s) return null;
	return {
		id: s.id,
		name: s.name,
		fixedMonthly: monthlyFixed(s.costs).fixedMonthly,
		laborPerJob: laborPerJob(s.hours_per_job, s.hourly_rate)
	};
}

/** Fixed overhead attributable to a YYYY-MM period; the current month is prorated by elapsed days. */
export function overheadForPeriod(fixedMonthly: number, period: string, today = new Date()): number {
	const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
	if (period !== current) return fixedMonthly;
	const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
	return divRound(fixedMonthly * today.getDate(), daysInMonth);
}

// ---- Efficiency ratios ----

/** Distinct calendar months that have at least one job. */
export function dataMonths(): number {
	const row = db
		.prepare(`SELECT COUNT(DISTINCT substr(job_date, 1, 7)) AS c FROM jobs`)
		.get() as { c: number };
	return row.c;
}

/**
 * Inventory value (µ$) at the end of a given day, rebuilt from the movement
 * ledger. Movements are dated by their business document (receipt purchase
 * date / job date) rather than created_at, because imported history was all
 * written on the same day.
 */
export function inventoryValueAt(dateIso: string): number {
	const row = db
		.prepare(
			`SELECT COALESCE(SUM(m.qty_delta * m.unit_cost), 0) AS v
			 FROM stock_movements m
			 LEFT JOIN receipts r ON m.ref_table = 'receipts' AND r.id = m.ref_id
			 LEFT JOIN jobs j ON m.ref_table = 'jobs' AND j.id = m.ref_id
			 WHERE COALESCE(r.purchased_at, j.job_date, substr(m.created_at, 1, 10)) <= ?`
		)
		.get(dateIso) as { v: number };
	return row.v;
}

export interface EfficiencySummary {
	dataMonths: number;
	periods: number;
	avgInventory: number;
	usedAllTime: number;
	wasteAllTime: number;
	turnoverPerMonth: number | null;
	daysInventory: number | null;
	wastePct: number | null;
}

function lastDayOfMonth(year: number, monthIdx: number): string {
	const d = new Date(Date.UTC(year, monthIdx + 1, 0));
	return d.toISOString().slice(0, 10);
}

export function efficiencySummary(): EfficiencySummary {
	const first = db
		.prepare(
			`SELECT MIN(d) AS d FROM (
				SELECT MIN(purchased_at) AS d FROM receipts
				UNION ALL SELECT MIN(job_date) AS d FROM jobs)`
		)
		.get() as { d: string | null };
	const totals = db
		.prepare(
			`SELECT
				COALESCE(SUM(CASE WHEN kind='used' THEN qty_base * unit_cost_at_time END), 0) AS used,
				COALESCE(SUM(CASE WHEN kind='waste' THEN qty_base * unit_cost_at_time END), 0) AS waste
			 FROM job_materials`
		)
		.get() as { used: number; waste: number };

	const points: number[] = [];
	if (first.d) {
		const [y, m] = first.d.split('-').map(Number);
		const now = new Date();
		let year = y;
		let monthIdx = m - 1;
		while (year < now.getFullYear() || (year === now.getFullYear() && monthIdx <= now.getMonth())) {
			points.push(inventoryValueAt(lastDayOfMonth(year, monthIdx)));
			monthIdx++;
			if (monthIdx > 11) {
				monthIdx = 0;
				year++;
			}
		}
	}

	const avgInventory = averageInventory(points);
	const periods = Math.max(points.length, 1);
	const turnoverPerMonth = turnover(divRound(totals.used, periods), avgInventory);
	return {
		dataMonths: dataMonths(),
		periods: points.length,
		avgInventory,
		usedAllTime: totals.used,
		wasteAllTime: totals.waste,
		turnoverPerMonth,
		daysInventory: daysInventory(turnoverPerMonth, 30),
		wastePct: wastePct(totals.waste, totals.used)
	};
}
