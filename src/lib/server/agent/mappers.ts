import { parseMoney, parseRate, taxFromRate } from '$lib/money';
import type { NewReceipt } from '$lib/server/services/receipts';
import type { NewJob } from '$lib/server/services/jobs';
import type { CreateJobAction, MaterialSpec, PostReceiptAction, ProductRef } from './actions';

/**
 * Pure helpers that turn validated agent actions into the service-layer input
 * types. Product/vendor refs are resolved by the caller (executor) beforehand
 * via `resolve`, which maps a ref to a concrete row id.
 */

export type Resolver<R> = (ref: R) => number;

export interface MappedReceipt {
	receipt: NewReceipt;
	/** Tax-rate string (e.g. "7.25") to persist as the new default, if a rate was used. */
	taxRateStr: string | null;
}

export function toNewReceipt(
	a: PostReceiptAction,
	vendorId: number,
	product: Resolver<ProductRef>
): MappedReceipt {
	const lines = a.lines.map((l) => ({
		product_id: product(l.product),
		unit_name: l.unit_name,
		base_units_per: l.base_units_per,
		qty_purchased: l.qty_purchased,
		line_cost: parseMoney(l.line_cost)
	}));
	const subtotal = lines.reduce((s, l) => s + l.line_cost, 0);

	let tax: number;
	let taxRate: number | null;
	let taxRateStr: string | null = null;
	if (a.tax_rate !== undefined) {
		taxRate = parseRate(a.tax_rate);
		tax = taxFromRate(subtotal, taxRate);
		taxRateStr = a.tax_rate;
	} else {
		taxRate = null;
		tax = a.tax !== undefined ? parseMoney(a.tax) : 0;
	}

	return {
		receipt: {
			vendor_id: vendorId,
			ref_number: a.ref_number ?? null,
			purchased_at: a.purchased_at,
			tax,
			tax_rate: taxRate,
			shipping: a.shipping !== undefined ? parseMoney(a.shipping) : 0,
			allocate_extras: a.allocate_extras ?? true,
			notes: a.notes ?? null,
			lines
		},
		taxRateStr
	};
}

export function toNewJob(a: CreateJobAction): NewJob {
	return {
		name: a.name,
		client: a.client ?? null,
		invoice_number: a.invoice_number ?? null,
		invoiced_amount: a.invoiced_amount !== undefined ? parseMoney(a.invoiced_amount) : 0,
		job_date: a.job_date,
		notes: a.notes ?? null
	};
}

export interface MappedMaterial {
	product_id: number;
	qty_base: number;
	kind: 'used' | 'waste';
	waste_reason: string | null;
}

export function toMaterial(m: MaterialSpec, product: Resolver<ProductRef>): MappedMaterial {
	return {
		product_id: product(m.product),
		qty_base: m.qty * (m.base_units_per ?? 1),
		kind: m.kind,
		waste_reason: m.kind === 'waste' ? (m.waste_reason ?? null) : null
	};
}
