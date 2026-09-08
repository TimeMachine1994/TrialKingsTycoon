import { describe, expect, it } from 'vitest';
import { describeProposal, isWriteAction, parseActions, validateAction } from './actions';
import { stripThinking } from './llm';

const receiptBlock = `\`\`\`action
{"type":"post_receipt","vendor":{"id":1},"purchased_at":"2026-09-04",
 "lines":[{"product":{"id":2},"unit_name":"ream","base_units_per":500,"qty_purchased":2,"line_cost":"18.00"}],
 "tax_rate":"7.25","shipping":"0"}
\`\`\``;

describe('parseActions', () => {
	it('extracts a single action and strips the fence from display text', () => {
		const r = parseActions(`Here's what I found on the receipt:\n\n${receiptBlock}\n\nLet me know if that looks right.`);
		expect(r.errors).toEqual([]);
		expect(r.actions).toHaveLength(1);
		expect(r.actions[0].type).toBe('post_receipt');
		expect(r.display).toBe("Here's what I found on the receipt:\n\nLet me know if that looks right.");
	});

	it('handles multiple blocks and case-insensitive fence tag', () => {
		const r = parseActions('```ACTION\n{"type":"report","kind":"waste"}\n```\n```action\n{"type":"inventory_status","low_stock_only":true}\n```');
		expect(r.actions.map((a) => a.type)).toEqual(['report', 'inventory_status']);
	});

	it('reports invalid JSON without dropping other blocks', () => {
		const r = parseActions('```action\n{not json}\n```\n```action\n{"type":"get_job","id":3}\n```');
		expect(r.actions).toEqual([{ type: 'get_job', id: 3 }]);
		expect(r.errors).toHaveLength(1);
		expect(r.errors[0]).toMatch(/Invalid JSON/);
	});

	it('reports validation errors with a path', () => {
		const r = parseActions('```action\n{"type":"post_receipt","vendor":{"id":1},"purchased_at":"9/4/26","lines":[]}\n```');
		expect(r.actions).toEqual([]);
		expect(r.errors[0]).toMatch(/purchased_at must be YYYY-MM-DD/);
	});

	it('returns plain text unchanged when there are no blocks', () => {
		const r = parseActions('You have 3 reams left.');
		expect(r).toEqual({ display: 'You have 3 reams left.', actions: [], errors: [] });
	});
});

describe('validateAction', () => {
	it('rejects unknown types', () => {
		expect(() => validateAction({ type: 'drop_tables' })).toThrow(/Unknown action type/);
	});

	it('rejects bad report kinds', () => {
		expect(() => validateAction({ type: 'report', kind: 'profit' })).toThrow(/kind must be one of/);
	});

	it('requires product refs to be id or new', () => {
		expect(() =>
			validateAction({
				type: 'post_receipt',
				vendor: { id: 1 },
				purchased_at: '2026-01-01',
				lines: [{ product: { name: 'Paper' }, unit_name: 'each', qty_purchased: 1, line_cost: '1' }]
			})
		).toThrow(/lines\[0\]\.product must be/);
	});

	it('accepts new vendor/product specs and defaults base_units_per to 1', () => {
		const a = validateAction({
			type: 'post_receipt',
			vendor: { new: { name: 'Uline' } },
			purchased_at: '2026-01-01',
			lines: [
				{
					product: { new: { name: 'Bubble mailers', category: 'shipping', base_unit: 'each', conv_name: 'box', conv_per: 25 } },
					unit_name: 'box',
					qty_purchased: 2,
					line_cost: 34.5
				}
			]
		});
		expect(a.type).toBe('post_receipt');
		if (a.type !== 'post_receipt') return;
		expect(a.vendor).toEqual({ new: { name: 'Uline', url: undefined, notes: undefined } });
		expect(a.lines[0].base_units_per).toBe(1);
		expect(a.lines[0].line_cost).toBe('34.5');
	});

	it('rejects invalid money and tax rates', () => {
		const base = { type: 'post_receipt', vendor: { id: 1 }, purchased_at: '2026-01-01', lines: [{ product: { id: 1 }, unit_name: 'each', qty_purchased: 1, line_cost: '1' }] };
		expect(() => validateAction({ ...base, lines: [{ ...base.lines[0], line_cost: 'twelve' }] })).toThrow(/not a valid dollar amount/);
		expect(() => validateAction({ ...base, tax_rate: 'abc' })).toThrow(/tax_rate is not a valid percent/);
	});

	it('requires conv_name and conv_per together', () => {
		expect(() => validateAction({ type: 'create_product', name: 'X', conv_name: 'box' })).toThrow(/conv_name and conv_per/);
	});

	it('rejects empty update_job', () => {
		expect(() => validateAction({ type: 'update_job', job_id: 1 })).toThrow(/nothing to update/);
	});

	it('defaults material kind to used', () => {
		const a = validateAction({ type: 'add_job_materials', job_id: 4, materials: [{ product: { id: 1 }, qty: 10 }] });
		if (a.type !== 'add_job_materials') throw new Error();
		expect(a.materials[0].kind).toBe('used');
		expect(isWriteAction(a)).toBe(true);
	});

	it('classifies read actions', () => {
		expect(isWriteAction(validateAction({ type: 'get_receipt', id: 1 }))).toBe(false);
	});
});

describe('describeProposal', () => {
	it('summarises receipts', () => {
		const a = validateAction({ type: 'post_receipt', vendor: { new: { name: 'Uline' } }, purchased_at: '2026-01-01', lines: [{ product: { id: 1 }, unit_name: 'each', qty_purchased: 1, line_cost: '1' }] });
		if (!isWriteAction(a)) throw new Error();
		expect(describeProposal(a)).toBe('Post receipt from vendor NEW "Uline" on 2026-01-01 (1 line)');
	});
});

describe('stripThinking', () => {
	it('removes think blocks', () => {
		expect(stripThinking('<think>hmm\nmulti</think>\n\nAnswer.')).toBe('Answer.');
	});
});
