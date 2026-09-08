import { db, type Job, type JobMaterial, type Product, type Receipt, type ReceiptLine } from '$lib/server/db';
import { fmtMoney, fmtUnitCost } from '$lib/money';
import { jobCosts } from '$lib/server/services/jobs';
import {
	dashboardStats,
	efficiencySummary,
	inventoryValuation,
	marginByClient,
	marginByJob,
	salesVsCogsByMonth,
	wasteByProduct
} from '$lib/server/services/reports';
import type { ReadAction, ReportKind } from './actions';

const MAX_LIMIT = 50;

function limitOf(n: number | undefined): number {
	return Math.min(n ?? 20, MAX_LIMIT);
}

function inventoryStatus(lowOnly: boolean) {
	const products = db.prepare('SELECT * FROM products ORDER BY name').all() as Product[];
	const rows = products
		.filter((p) => !lowOnly || (p.reorder_point !== null && p.qty_on_hand <= p.reorder_point))
		.map((p) => ({
			id: p.id,
			name: p.name,
			category: p.category,
			on_hand: `${p.qty_on_hand} ${p.base_unit}`,
			avg_cost_per_unit: fmtUnitCost(p.avg_cost),
			value: fmtMoney(p.qty_on_hand * p.avg_cost),
			reorder_point: p.reorder_point,
			low_stock: p.reorder_point !== null && p.qty_on_hand <= p.reorder_point
		}));
	return { count: rows.length, products: rows };
}

function report(kind: ReportKind) {
	switch (kind) {
		case 'dashboard': {
			const s = dashboardStats();
			return {
				inventory_value: fmtMoney(s.inventoryValue),
				sales_month_to_date: fmtMoney(s.salesMtd),
				cogs_month_to_date: fmtMoney(s.cogsMtd),
				waste_month_to_date: fmtMoney(s.wasteMtd),
				product_count: s.productCount,
				open_jobs: s.openJobs
			};
		}
		case 'sales_vs_cogs':
			return salesVsCogsByMonth().map((r) => ({
				month: r.period,
				jobs: r.job_count,
				sales: fmtMoney(r.sales),
				cogs: fmtMoney(r.cogs),
				waste: fmtMoney(r.waste),
				gross: fmtMoney(r.sales - r.cogs - r.waste)
			}));
		case 'waste':
			return wasteByProduct().map((r) => ({
				product_id: r.product_id,
				product: r.product_name,
				waste_qty: `${r.qty} ${r.base_unit}`,
				used_qty: `${r.used_qty} ${r.base_unit}`,
				waste_cost: fmtMoney(r.cost),
				reasons: r.reasons
			}));
		case 'valuation':
			return inventoryValuation().map((r) => ({
				product_id: r.id,
				product: r.name,
				on_hand: `${r.qty_on_hand} ${r.base_unit}`,
				avg_cost_per_unit: fmtUnitCost(r.avg_cost),
				value: fmtMoney(r.value),
				used_all_time: r.used_all_time
			}));
		case 'margin_by_job':
			return marginByJob().map((r) => ({
				job_id: r.id,
				job: r.name,
				client: r.client,
				invoice_number: r.invoice_number,
				date: r.job_date,
				sales: fmtMoney(r.sales),
				materials_used: fmtMoney(r.used),
				waste: fmtMoney(r.waste),
				gross_margin: fmtMoney(r.gross)
			}));
		case 'margin_by_client':
			return marginByClient().map((r) => ({
				client: r.client,
				jobs: r.job_count,
				sales: fmtMoney(r.sales),
				materials_used: fmtMoney(r.used),
				waste: fmtMoney(r.waste),
				gross_margin: fmtMoney(r.gross)
			}));
		case 'efficiency': {
			const e = efficiencySummary();
			return {
				months_with_job_data: e.dataMonths,
				note: e.dataMonths < 3 ? 'Fewer than 3 months of data: time-based ratios are noisy.' : undefined,
				avg_inventory_value: fmtMoney(e.avgInventory),
				materials_used_all_time: fmtMoney(e.usedAllTime),
				waste_all_time: fmtMoney(e.wasteAllTime),
				turnover_per_month: e.turnoverPerMonth,
				days_of_inventory: e.daysInventory,
				waste_pct_of_used: e.wastePct
			};
		}
	}
}

type ReceiptRow = Receipt & { vendor_name: string; line_count: number };

function findReceipts(a: Extract<ReadAction, { type: 'find_receipts' }>) {
	const where: string[] = [];
	const params: unknown[] = [];
	if (a.vendor) {
		where.push('v.name LIKE ?');
		params.push(`%${a.vendor}%`);
	}
	if (a.from) {
		where.push('r.purchased_at >= ?');
		params.push(a.from);
	}
	if (a.to) {
		where.push('r.purchased_at <= ?');
		params.push(a.to);
	}
	const rows = db
		.prepare(
			`SELECT r.*, v.name AS vendor_name,
				(SELECT COUNT(*) FROM receipt_lines l WHERE l.receipt_id = r.id) AS line_count
			 FROM receipts r JOIN vendors v ON v.id = r.vendor_id
			 ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
			 ORDER BY r.purchased_at DESC, r.id DESC LIMIT ?`
		)
		.all(...params, limitOf(a.limit)) as ReceiptRow[];
	return rows.map((r) => ({
		id: r.id,
		date: r.purchased_at,
		vendor: r.vendor_name,
		ref_number: r.ref_number,
		lines: r.line_count,
		total: fmtMoney(r.total),
		voided: Boolean(r.voided_at)
	}));
}

function getReceipt(id: number) {
	const r = db
		.prepare('SELECT r.*, v.name AS vendor_name FROM receipts r JOIN vendors v ON v.id = r.vendor_id WHERE r.id = ?')
		.get(id) as (Receipt & { vendor_name: string }) | undefined;
	if (!r) return { error: `Receipt #${id} not found` };
	const lines = db
		.prepare('SELECT l.*, p.name AS product_name FROM receipt_lines l JOIN products p ON p.id = l.product_id WHERE l.receipt_id = ?')
		.all(id) as Array<ReceiptLine & { product_name: string }>;
	return {
		id: r.id,
		date: r.purchased_at,
		vendor: r.vendor_name,
		ref_number: r.ref_number,
		notes: r.notes,
		subtotal: fmtMoney(r.subtotal),
		tax: fmtMoney(r.tax),
		shipping: fmtMoney(r.shipping),
		total: fmtMoney(r.total),
		voided: Boolean(r.voided_at),
		lines: lines.map((l) => ({
			product_id: l.product_id,
			product: l.product_name,
			qty: `${l.qty_purchased} ${l.unit_name}`,
			base_units: l.qty_base,
			line_cost_incl_allocated: fmtMoney(l.line_cost),
			unit_cost: fmtUnitCost(l.unit_cost_base)
		}))
	};
}

function findJobs(a: Extract<ReadAction, { type: 'find_jobs' }>) {
	const where: string[] = [];
	const params: unknown[] = [];
	if (a.client) {
		where.push('client LIKE ?');
		params.push(`%${a.client}%`);
	}
	if (a.status) {
		where.push('status = ?');
		params.push(a.status);
	}
	if (a.from) {
		where.push('job_date >= ?');
		params.push(a.from);
	}
	if (a.to) {
		where.push('job_date <= ?');
		params.push(a.to);
	}
	const rows = db
		.prepare(
			`SELECT * FROM jobs ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
			 ORDER BY job_date DESC, id DESC LIMIT ?`
		)
		.all(...params, limitOf(a.limit)) as Job[];
	return rows.map((j) => {
		const c = jobCosts(j.id, j.invoiced_amount);
		return {
			id: j.id,
			name: j.name,
			client: j.client,
			invoice_number: j.invoice_number,
			date: j.job_date,
			status: j.status,
			invoiced: fmtMoney(j.invoiced_amount),
			materials_cost: fmtMoney(c.usedCost),
			waste_cost: fmtMoney(c.wasteCost),
			profit: fmtMoney(c.profit)
		};
	});
}

function getJob(id: number) {
	const j = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as Job | undefined;
	if (!j) return { error: `Job #${id} not found` };
	const materials = db
		.prepare(
			`SELECT m.*, p.name AS product_name, p.base_unit FROM job_materials m
			 JOIN products p ON p.id = m.product_id WHERE m.job_id = ? ORDER BY m.id`
		)
		.all(id) as Array<JobMaterial & { product_name: string; base_unit: string }>;
	const c = jobCosts(id, j.invoiced_amount);
	return {
		id: j.id,
		name: j.name,
		client: j.client,
		invoice_number: j.invoice_number,
		date: j.job_date,
		status: j.status,
		notes: j.notes,
		invoiced: fmtMoney(j.invoiced_amount),
		materials_cost: fmtMoney(c.usedCost),
		waste_cost: fmtMoney(c.wasteCost),
		profit: fmtMoney(c.profit),
		materials: materials.map((m) => ({
			id: m.id,
			product_id: m.product_id,
			product: m.product_name,
			qty: `${m.qty_base} ${m.base_unit}`,
			kind: m.kind,
			waste_reason: m.waste_reason,
			cost: fmtMoney(m.qty_base * m.unit_cost_at_time)
		}))
	};
}

/** Executes a read-only action and returns a JSON-serialisable, money-formatted result. */
export function runReadAction(a: ReadAction): unknown {
	switch (a.type) {
		case 'inventory_status':
			return inventoryStatus(a.low_stock_only ?? false);
		case 'report':
			return report(a.kind);
		case 'find_receipts':
			return findReceipts(a);
		case 'get_receipt':
			return getReceipt(a.id);
		case 'find_jobs':
			return findJobs(a);
		case 'get_job':
			return getJob(a.id);
	}
}
