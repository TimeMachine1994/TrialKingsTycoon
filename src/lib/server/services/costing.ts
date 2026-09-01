import { divRound } from '$lib/money';

/**
 * Weighted-average cost update when receiving stock.
 * All costs in micro-dollars per base unit; quantities in base units.
 */
export function weightedAverage(
	qtyOnHand: number,
	avgCost: number,
	qtyIn: number,
	unitCostIn: number
): number {
	const existingQty = Math.max(qtyOnHand, 0); // negative stock doesn't poison the average
	const totalQty = existingQty + qtyIn;
	if (totalQty <= 0) return avgCost;
	return divRound(existingQty * avgCost + qtyIn * unitCostIn, totalQty);
}

/** Per-base-unit cost for a receipt line. */
export function unitCostFromLine(lineCost: number, qtyBase: number): number {
	if (qtyBase <= 0) return 0;
	return divRound(lineCost, qtyBase);
}

/**
 * Reverse a receipt line out of a weighted average (for voiding).
 * Returns the average cost the product should have after removing
 * `qtyOut` units that were received at `unitCostOut`.
 */
export function reverseAverage(
	qtyOnHand: number,
	avgCost: number,
	qtyOut: number,
	unitCostOut: number
): number {
	const remaining = qtyOnHand - qtyOut;
	if (remaining <= 0) return avgCost;
	const remainingValue = qtyOnHand * avgCost - qtyOut * unitCostOut;
	if (remainingValue <= 0) return avgCost;
	return divRound(remainingValue, remaining);
}
