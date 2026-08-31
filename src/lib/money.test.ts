import { describe, expect, it } from 'vitest';
import { allocate, divRound, fmtMoney, fmtUnitCost, parseMoney, MICRO } from './money';
import { unitCostFromLine, weightedAverage } from './server/services/costing';

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

describe('unitCostFromLine', () => {
	it('divides line cost by base qty', () => {
		expect(unitCostFromLine(18 * MICRO, 1500)).toBe(12_000);
	});
	it('handles zero qty', () => {
		expect(unitCostFromLine(18 * MICRO, 0)).toBe(0);
	});
});
