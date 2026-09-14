import { describe, expect, it } from 'vitest';
import { MICRO } from '$lib/money';
import type { PostReceiptAction, ProductRef } from './actions';
import { toMaterial, toNewJob, toNewReceipt } from './mappers';

const resolve = (r: ProductRef) => ('id' in r ? r.id : 99);

const base: PostReceiptAction = {
	type: 'post_receipt',
	vendor: { id: 1 },
	purchased_at: '2026-09-04',
	lines: [
		{ product: { id: 2 }, unit_name: 'ream', base_units_per: 500, qty_purchased: 2, line_cost: '18.00' },
		{ product: { new: { name: 'Toner' } }, unit_name: 'each', base_units_per: 1, qty_purchased: 1, line_cost: '$42.50' }
	]
};

describe('toNewReceipt', () => {
	it('parses money, resolves products, and computes tax from a rate', () => {
		const { receipt, taxRateStr } = toNewReceipt({ ...base, tax_rate: '7.25', shipping: '5' }, 1, resolve);
		expect(receipt.lines.map((l) => l.product_id)).toEqual([2, 99]);
		expect(receipt.lines[0].line_cost).toBe(18 * MICRO);
		expect(receipt.lines[1].line_cost).toBe(42.5 * MICRO);
		expect(receipt.tax_rate).toBe(72_500);
		expect(receipt.tax).toBe(Math.round(60.5 * MICRO * 0.0725));
		expect(receipt.shipping).toBe(5 * MICRO);
		expect(receipt.allocate_extras).toBe(true);
		expect(taxRateStr).toBe('7.25');
	});

	it('uses manual tax when no rate is given and defaults extras to zero', () => {
		const { receipt, taxRateStr } = toNewReceipt({ ...base, tax: '1.23', allocate_extras: false }, 1, resolve);
		expect(receipt.tax).toBe(1.23 * MICRO);
		expect(receipt.tax_rate).toBeNull();
		expect(receipt.shipping).toBe(0);
		expect(receipt.allocate_extras).toBe(false);
		expect(taxRateStr).toBeNull();
	});

	it('prefers tax_rate over tax when both are present', () => {
		const { receipt } = toNewReceipt({ ...base, tax: '999', tax_rate: '0' }, 1, resolve);
		expect(receipt.tax).toBe(0);
	});
});

describe('toNewJob / toMaterial', () => {
	it('maps job fields with defaults', () => {
		expect(toNewJob({ type: 'create_job', name: 'Flyers', job_date: '2026-09-04' })).toEqual({
			name: 'Flyers',
			client: null,
			invoice_number: null,
			invoiced_amount: 0,
			job_date: '2026-09-04',
			notes: null
		});
		expect(toNewJob({ type: 'create_job', name: 'F', job_date: '2026-09-04', invoiced_amount: '350' }).invoiced_amount).toBe(350 * MICRO);
	});

	it('multiplies qty by base_units_per and only keeps waste_reason for waste', () => {
		expect(toMaterial({ product: { id: 2 }, qty: 2, base_units_per: 500, kind: 'used', waste_reason: 'x' }, resolve)).toEqual({
			product_id: 2,
			qty_base: 1000,
			kind: 'used',
			waste_reason: null
		});
		expect(toMaterial({ product: { id: 2 }, qty: 10, kind: 'waste', waste_reason: 'jam' }, resolve).waste_reason).toBe('jam');
	});
});
