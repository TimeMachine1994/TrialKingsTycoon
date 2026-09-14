import { db, setSetting, type Product, type Receipt, type ReceiptLine } from '$lib/server/db';
import { allocate, parseMoney, parseRate, taxFromRate } from '$lib/money';
import { reverseAverage, unitCostFromLine, weightedAverage } from './costing';

export interface NewReceiptLine {
	product_id: number;
	unit_name: string;
	base_units_per: number;
	qty_purchased: number;
	line_cost: number; // µ$ paid for this line before tax/shipping allocation
}

export interface NewReceipt {
	vendor_id: number;
	ref_number: string | null;
	purchased_at: string;
	tax: number;
	tax_rate: number | null; // percent × 10,000; null = manually entered tax
	shipping: number;
	allocate_extras: boolean;
	notes: string | null;
	lines: NewReceiptLine[];
}

interface LinePayload {
	product_id: number;
	unit_name: string;
	base_units_per: number;
	qty_purchased: number;
	line_cost: string;
}

/**
 * Builds a NewReceipt from the submitted ReceiptForm. Shared by the
 * new-receipt form on /receipts and the edit form on /receipts/[id].
 * Tax is either auto-calculated from a rate (authoritative on the server)
 * or taken as a manual $ entry.
 */
export function receiptFromForm(form: FormData): NewReceipt {
	const vendorId = Number(form.get('vendor_id'));
	const purchasedAt = String(form.get('purchased_at') ?? '');
	const rawLines = JSON.parse(String(form.get('lines') ?? '[]')) as LinePayload[];

	if (!vendorId) throw new Error('Pick a vendor');
	if (!purchasedAt) throw new Error('Purchase date is required');
	if (rawLines.length === 0) throw new Error('Add at least one line');

	const lines: NewReceiptLine[] = rawLines.map((l) => ({
		product_id: Number(l.product_id),
		unit_name: l.unit_name,
		base_units_per: Number(l.base_units_per),
		qty_purchased: Number(l.qty_purchased),
		line_cost: parseMoney(l.line_cost || '0')
	}));

	const taxMode = String(form.get('tax_mode') ?? 'manual');
	const rateStr = String(form.get('tax_rate') ?? '').trim();
	const subtotal = lines.reduce((a, l) => a + l.line_cost, 0);
	let tax: number;
	let taxRate: number | null;
	if (taxMode === 'rate' && rateStr !== '') {
		taxRate = parseRate(rateStr);
		tax = taxFromRate(subtotal, taxRate);
		setSetting('default_tax_rate', rateStr);
	} else {
		taxRate = null;
		tax = parseMoney(String(form.get('tax') ?? '0') || '0');
	}

	return {
		vendor_id: vendorId,
		ref_number: String(form.get('ref_number') ?? '').trim() || null,
		purchased_at: purchasedAt,
		tax,
		tax_rate: taxRate,
		shipping: parseMoney(String(form.get('shipping') ?? '0') || '0'),
		allocate_extras: form.get('allocate_extras') === 'on',
		notes: String(form.get('notes') ?? '').trim() || null,
		lines
	};
}

function validate(input: NewReceipt): void {
	if (input.lines.length === 0) throw new Error('Receipt needs at least one line');
	for (const line of input.lines) {
		if (line.qty_purchased <= 0) throw new Error('Line quantity must be positive');
		if (line.base_units_per <= 0) throw new Error('Unit conversion must be positive');
		if (line.line_cost < 0) throw new Error('Line cost cannot be negative');
	}
}

const getProduct = db.prepare('SELECT * FROM products WHERE id = ?');
const updProduct = db.prepare('UPDATE products SET avg_cost = ?, qty_on_hand = ? WHERE id = ?');

/**
 * Inserts receipt_lines for `receiptId`, allocating tax/shipping into line
 * costs, and applies each line to product stock / weighted-average cost.
 * Must be called inside a transaction.
 */
function applyLines(receiptId: number, input: NewReceipt): void {
	const extras = input.tax + input.shipping;
	const extraParts =
		input.allocate_extras && extras > 0
			? allocate(
					extras,
					input.lines.map((l) => l.line_cost)
				)
			: input.lines.map(() => 0);

	const insLine = db.prepare(
		`INSERT INTO receipt_lines (receipt_id, product_id, unit_name, base_units_per, qty_purchased, qty_base, line_cost, unit_cost_base)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	);
	const insMove = db.prepare(
		`INSERT INTO stock_movements (product_id, kind, qty_delta, unit_cost, ref_table, ref_id)
		 VALUES (?, 'receipt', ?, ?, 'receipts', ?)`
	);

	input.lines.forEach((line, i) => {
		const product = getProduct.get(line.product_id) as Product | undefined;
		if (!product) throw new Error(`Product ${line.product_id} not found`);

		const qtyBase = line.qty_purchased * line.base_units_per;
		const allocatedCost = line.line_cost + extraParts[i];
		const unitCost = unitCostFromLine(allocatedCost, qtyBase);

		insLine.run(
			receiptId,
			line.product_id,
			line.unit_name,
			line.base_units_per,
			line.qty_purchased,
			qtyBase,
			allocatedCost,
			unitCost
		);

		const newAvg = weightedAverage(product.qty_on_hand, product.avg_cost, qtyBase, unitCost);
		updProduct.run(newAvg, product.qty_on_hand + qtyBase, product.id);
		insMove.run(product.id, qtyBase, unitCost, receiptId);
	});
}

/**
 * Backs the existing lines of `receiptId` out of product stock / average cost
 * and writes reversal stock_movements. Lines themselves are left in place so
 * the caller can decide to keep (void) or replace (update) them.
 * Must be called inside a transaction.
 */
function reverseLines(receiptId: number, note: string): ReceiptLine[] {
	const lines = db
		.prepare('SELECT * FROM receipt_lines WHERE receipt_id = ?')
		.all(receiptId) as ReceiptLine[];
	const insMove = db.prepare(
		`INSERT INTO stock_movements (product_id, kind, qty_delta, unit_cost, ref_table, ref_id, note)
		 VALUES (?, 'adjustment', ?, ?, 'receipts', ?, ?)`
	);
	for (const line of lines) {
		const product = getProduct.get(line.product_id) as Product;
		const newAvg = reverseAverage(
			product.qty_on_hand,
			product.avg_cost,
			line.qty_base,
			line.unit_cost_base
		);
		updProduct.run(newAvg, product.qty_on_hand - line.qty_base, product.id);
		insMove.run(product.id, -line.qty_base, line.unit_cost_base, receiptId, note);
	}
	return lines;
}

/**
 * Posts a receipt inside a transaction:
 * - inserts receipt + lines (with tax/shipping optionally allocated into line costs)
 * - updates each product's weighted-average cost and qty on hand
 * - writes stock_movements audit rows
 */
export function postReceipt(input: NewReceipt): number {
	validate(input);

	const run = db.transaction((): number => {
		const subtotal = input.lines.reduce((a, l) => a + l.line_cost, 0);
		const total = subtotal + input.tax + input.shipping;

		const receiptId = db
			.prepare(
				`INSERT INTO receipts (vendor_id, ref_number, purchased_at, subtotal, tax, tax_rate, shipping, total, allocate_extras, notes)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.run(
				input.vendor_id,
				input.ref_number,
				input.purchased_at,
				subtotal,
				input.tax,
				input.tax_rate,
				input.shipping,
				total,
				input.allocate_extras ? 1 : 0,
				input.notes
			).lastInsertRowid as number;

		applyLines(receiptId, input);
		return receiptId;
	});

	return run();
}

/**
 * Replaces a posted receipt's header and lines in place (same id) inside a
 * transaction:
 * - reverses the old lines out of stock / average cost
 * - rewrites the receipt header and lines from `input`
 * - re-applies the new lines to stock / average cost
 * Attachments and job-material cost snapshots are untouched.
 */
export function updateReceipt(receiptId: number, input: NewReceipt): void {
	validate(input);

	const run = db.transaction(() => {
		const receipt = db.prepare('SELECT * FROM receipts WHERE id = ?').get(receiptId) as
			| Receipt
			| undefined;
		if (!receipt) throw new Error(`Receipt ${receiptId} not found`);
		if (receipt.voided_at) throw new Error('Cannot edit a voided receipt');

		reverseLines(receiptId, `edit receipt #${receiptId} (old lines)`);
		db.prepare('DELETE FROM receipt_lines WHERE receipt_id = ?').run(receiptId);

		const subtotal = input.lines.reduce((a, l) => a + l.line_cost, 0);
		const total = subtotal + input.tax + input.shipping;
		db.prepare(
			`UPDATE receipts SET vendor_id = ?, ref_number = ?, purchased_at = ?, subtotal = ?, tax = ?, tax_rate = ?,
			 shipping = ?, total = ?, allocate_extras = ?, notes = ? WHERE id = ?`
		).run(
			input.vendor_id,
			input.ref_number,
			input.purchased_at,
			subtotal,
			input.tax,
			input.tax_rate,
			input.shipping,
			total,
			input.allocate_extras ? 1 : 0,
			input.notes,
			receiptId
		);

		applyLines(receiptId, input);
	});
	run();
}

/**
 * Voids a posted receipt inside a transaction:
 * - removes the received quantities from stock
 * - reverses each line out of the product's weighted-average cost
 * - writes reversal stock_movements rows
 * - stamps receipts.voided_at (receipt & lines are kept for the audit trail)
 */
export function voidReceipt(receiptId: number): void {
	const run = db.transaction(() => {
		const receipt = db.prepare('SELECT * FROM receipts WHERE id = ?').get(receiptId) as
			| Receipt
			| undefined;
		if (!receipt) throw new Error(`Receipt ${receiptId} not found`);
		if (receipt.voided_at) throw new Error('Receipt is already voided');

		reverseLines(receiptId, `void receipt #${receiptId}`);
		db.prepare(`UPDATE receipts SET voided_at = datetime('now') WHERE id = ?`).run(receiptId);
	});
	run();
}
