import { describe, expect, it } from 'vitest';
import {
	allocate,
	divRound,
	fmtMoney,
	fmtRate,
	fmtUnitCost,
	parseMoney,
	parseRate,
	taxFromRate,
	MICRO,
	RATE_SCALE
} from './money';
import { reverseAverage, unitCostFromLine, weightedAverage } from './server/services/costing';

describe('parseMoney', () => {
	it('parses plain dollars', () => {
		expect(parseMoney('12.34')).toBe(12_340_000);
	});
	it('parses with $ and commas', () => {
		expect(parseMoney('$1,234.56')).toBe(1_234_560_000);
	});
	it('parses sub-penny unit costs', () => {
		expect(parseMoney('0.0032')).toBe(3_200);
	});
	it('parses numbers', () => {
		expect(parseMoney(0.01)).toBe(10_000);
	});
	it('throws on garbage', () => {
		expect(() => parseMoney('abc')).toThrow();
	});
});

describe('fmtMoney', () => {
	it('formats to cents', () => {
		expect(fmtMoney(1_234_560_000)).toBe('$1,234.56');
	});
	it('rounds sub-penny to cents for totals', () => {
		expect(fmtMoney(3_200)).toBe('$0.00');
		expect(fmtMoney(5_000)).toBe('$0.01');
	});
	it('handles negatives', () => {
		expect(fmtMoney(-500_000)).toBe('-$0.50');
	});
});

describe('fmtUnitCost', () => {
	it('shows 4 decimals when sub-penny precision exists', () => {
		expect(fmtUnitCost(3_200)).toBe('$0.0032');
	});
	it('shows 2 decimals for clean cent values', () => {
		expect(fmtUnitCost(120_000)).toBe('$0.12');
	});
});

describe('divRound', () => {
	it('rounds half up', () => {
		expect(divRound(5, 2)).toBe(3);
		expect(divRound(-5, 2)).toBe(-3);
	});
	it('handles zero denominator', () => {
		expect(divRound(5, 0)).toBe(0);
	});
});

describe('allocate', () => {
	it('sums exactly to total', () => {
		const parts = allocate(1_000_001, [1, 1, 1]);
		expect(parts.reduce((a, b) => a + b, 0)).toBe(1_000_001);
	});
	it('is proportional', () => {
		const parts = allocate(300, [1, 2]);
		expect(parts).toEqual([100, 200]);
	});
	it('handles zero weights', () => {
		const parts = allocate(300, [0, 0]);
		expect(parts.reduce((a, b) => a + b, 0)).toBe(300);
	});
});

describe('weightedAverage', () => {
	it('averages a purchase into existing stock', () => {
		// 100 units @ $1.00, buy 100 more @ $2.00 -> avg $1.50
		expect(weightedAverage(100, 1 * MICRO, 100, 2 * MICRO)).toBe(1_500_000);
	});
	it('sets avg to purchase cost when starting from zero', () => {
		expect(weightedAverage(0, 0, 1500, 3_200)).toBe(3_200);
	});
	it('ignores negative stock when averaging', () => {
		expect(weightedAverage(-50, 1 * MICRO, 100, 2 * MICRO)).toBe(2 * MICRO);
	});
	it('keeps sub-penny precision: 1500 sheets @ $18.00', () => {
		const unit = unitCostFromLine(18 * MICRO, 1500);
		expect(unit).toBe(12_000); // $0.012/sheet
		expect(weightedAverage(0, 0, 1500, unit)).toBe(12_000);
	});
});

describe('tax rates', () => {
	it('parses percent strings to scaled integers', () => {
		expect(parseRate('7.25')).toBe(72_500);
		expect(parseRate('7.25%')).toBe(7.25 * RATE_SCALE);
		expect(parseRate('')).toBe(0);
	});
	it('throws on garbage or negative rates', () => {
		expect(() => parseRate('abc')).toThrow();
		expect(() => parseRate('-5')).toThrow();
	});
	it('formats scaled rates back to display strings', () => {
		expect(fmtRate(72_500)).toBe('7.25');
		expect(fmtRate(60_000)).toBe('6');
	});
	it('computes 7.25% of $100.00 as exactly $7.25', () => {
		expect(taxFromRate(100 * MICRO, parseRate('7.25'))).toBe(7_250_000);
	});
	it('rounds half-up at the micro-dollar level', () => {
		// 7.25% of $0.10 = $0.00725 -> 7,250 µ$
		expect(taxFromRate(parseMoney('0.10'), parseRate('7.25'))).toBe(7_250);
	});
	it('returns 0 for zero subtotal or rate', () => {
		expect(taxFromRate(0, 72_500)).toBe(0);
		expect(taxFromRate(100 * MICRO, 0)).toBe(0);
	});
});

describe('reverseAverage (void receipts)', () => {
	it('restores the prior average exactly when voiding the only other receipt', () => {
		// 100 @ $1.00 existing, then received 100 @ $2.00 -> avg $1.50, 200 on hand.
		const afterReceipt = weightedAverage(100, 1 * MICRO, 100, 2 * MICRO);
		expect(afterReceipt).toBe(1_500_000);
		// Voiding that receipt should take us back to $1.00
		expect(reverseAverage(200, afterReceipt, 100, 2 * MICRO)).toBe(1 * MICRO);
	});
	it('keeps the current average when voiding empties the stock', () => {
		expect(reverseAverage(1500, 12_000, 1500, 12_000)).toBe(12_000);
	});
	it('keeps the current average when stock already went negative', () => {
		expect(reverseAverage(50, 12_000, 100, 12_000)).toBe(12_000);
	});
});

describe('unitCostFromLine', () => {
	it('divides line cost by base qty', () => {
		expect(unitCostFromLine(18 * MICRO, 1500)).toBe(12_000);
	});
	it('handles zero qty', () => {
		expect(unitCostFromLine(18 * MICRO, 0)).toBe(0);
	});
});
