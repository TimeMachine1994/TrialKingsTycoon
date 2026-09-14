import { describe, expect, it } from 'vitest';
import {
	averageInventory,
	daysInventory,
	fmtPct,
	fmtRatio,
	monthsOfSupply,
	ratioConfidence,
	turnover,
	wastePct
} from './ratios';

describe('averageInventory', () => {
	it('returns 0 for no points', () => expect(averageInventory([])).toBe(0));
	it('rounds half up', () => expect(averageInventory([1, 2])).toBe(2));
	it('averages values', () => expect(averageInventory([100, 200, 300])).toBe(200));
});

describe('turnover / daysInventory', () => {
	it('is null when average inventory is zero', () => expect(turnover(500, 0)).toBeNull());
	it('divides cogs by average inventory', () => expect(turnover(500, 250)).toBe(2));
	it('converts turnover into days', () => expect(daysInventory(2, 30)).toBe(15));
	it('is null for null or zero turnover', () => {
		expect(daysInventory(null, 30)).toBeNull();
		expect(daysInventory(0, 30)).toBeNull();
	});
});

describe('monthsOfSupply', () => {
	it('is null without usage', () => expect(monthsOfSupply(100, 0)).toBeNull());
	it('divides on-hand by monthly usage', () => expect(monthsOfSupply(3000, 1500)).toBe(2));
	it('clamps negative stock to zero', () => expect(monthsOfSupply(-5, 10)).toBe(0));
});

describe('wastePct', () => {
	it('is null when nothing consumed', () => expect(wastePct(0, 0)).toBeNull());
	it('is share of used+waste', () => expect(wastePct(25, 75)).toBe(0.25));
});

describe('ratioConfidence', () => {
	it('thresholds', () => {
		expect(ratioConfidence(0)).toBe('low');
		expect(ratioConfidence(1)).toBe('low');
		expect(ratioConfidence(2)).toBe('medium');
		expect(ratioConfidence(3)).toBe('ok');
	});
});

describe('formatters', () => {
	it('formats nulls as dashes', () => {
		expect(fmtPct(null)).toBe('—');
		expect(fmtRatio(null)).toBe('—');
	});
	it('formats values', () => {
		expect(fmtPct(0.25)).toBe('25.0%');
		expect(fmtRatio(1.5, 1, 'x')).toBe('1.5x');
	});
});
