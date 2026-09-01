import { db, type Product, type Receipt, type ReceiptLine } from '$lib/server/db';
import { allocate } from '$lib/money';
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

/**
 * Posts a receipt inside a transaction:
 * - inserts receipt + lines (with tax/shipping optionally allocated into line costs)
 * - updates each product's weighted-average cost and qty on hand
 * - writes stock_movements audit rows
 */
export function postReceipt(input: NewReceipt): number {
	if (input.lines.length === 0) throw new Error('Receipt needs at least one line');
	for (const line of input.lines) {
		if (line.qty_purchased <= 0) throw new Error('Line quantity must be positive');
		if (line.base_units_per <= 0) throw new Error('Unit conversion must be positive');
		if (line.line_cost < 0) throw new Error('Line cost cannot be negative');
	}

	const run = db.transaction((): number => {
		const subtotal = input.lines.reduce((a, l) => a + l.line_cost, 0);
		const extras = input.tax + input.shipping;
		const total = subtotal + extras;

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
		const getProduct = db.prepare('SELECT * FROM products WHERE id = ?');
		const updProduct = db.prepare('UPDATE products SET avg_cost = ?, qty_on_hand = ? WHERE id = ?');
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

		return receiptId;
	});

	return run();
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

		const lines = db
			.prepare('SELECT * FROM receipt_lines WHERE receipt_id = ?')
			.all(receiptId) as ReceiptLine[];

		const getProduct = db.prepare('SELECT * FROM products WHERE id = ?');
		const updProduct = db.prepare('UPDATE products SET avg_cost = ?, qty_on_hand = ? WHERE id = ?');
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
			insMove.run(
				product.id,
				-line.qty_base,
				line.unit_cost_base,
				receiptId,
				`void receipt #${receiptId}`
			);
		}

		db.prepare(`UPDATE receipts SET voided_at = datetime('now') WHERE id = ?`).run(receiptId);
	});
	run();
}
