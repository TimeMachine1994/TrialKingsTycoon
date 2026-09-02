import { actualsToInputs } from '$lib/breakeven';
import { parseMoney, parseRate } from '$lib/money';
import { isCostCadence, isCostCategory } from '$lib/planner-types';
import {
	actualsSummary,
	addCost,
	getScenario,
	removeCost,
	toggleCost,
	updateCost,
	updateScenario
} from '$lib/server/services/planner';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const scenario = getScenario(Number(params.id));
	if (!scenario) throw error(404, 'Scenario not found');
	return { scenario, defaults: actualsToInputs(actualsSummary()) };
};

function num(form: FormData, key: string): number {
	const v = Number(String(form.get(key) ?? '').replace(/[,\s]/g, ''));
	if (!Number.isFinite(v) || v < 0) throw new Error(`Invalid value for ${key}`);
	return v;
}

function costFromForm(form: FormData) {
	const label = String(form.get('label') ?? '').trim();
	const category = form.get('category');
	const cadence = form.get('cadence');
	if (!label) throw new Error('Cost label is required');
	if (!isCostCategory(category)) throw new Error('Pick a category');
	if (!isCostCadence(cadence)) throw new Error('Pick a cadence');
	const amount = parseMoney(String(form.get('amount') ?? '0') || '0');
	if (amount < 0) throw new Error('Amount must be positive');
	return { label, category, cadence, amount };
}

export const actions: Actions = {
	updateScenario: async ({ request, params }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Name is required' });
		try {
			updateScenario(Number(params.id), {
				name,
				notes: String(form.get('notes') ?? '').trim() || null,
				variable_cost_rate: parseRate(String(form.get('variable_cost_pct') ?? '0') || '0'),
				avg_job_value: parseMoney(String(form.get('avg_job_value') ?? '0') || '0'),
				hours_per_job: num(form, 'hours_per_job'),
				hourly_rate: parseMoney(String(form.get('hourly_rate') ?? '0') || '0'),
				jobs_per_month: num(form, 'jobs_per_month'),
				jobs_growth_rate: parseRate(String(form.get('jobs_growth_pct') ?? '0') || '0'),
				target_profit: parseMoney(String(form.get('target_profit') ?? '0') || '0')
			});
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to save' });
		}
		return { success: true };
	},

	addCost: async ({ request, params }) => {
		const form = await request.formData();
		try {
			addCost(Number(params.id), costFromForm(form));
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to add cost' });
		}
		return { success: true };
	},

	updateCost: async ({ request }) => {
		const form = await request.formData();
		try {
			updateCost(Number(form.get('cost_id')), costFromForm(form));
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to update cost' });
		}
		return { success: true };
	},

	toggleCost: async ({ request }) => {
		const form = await request.formData();
		toggleCost(Number(form.get('cost_id')));
		return { success: true };
	},

	removeCost: async ({ request }) => {
		const form = await request.formData();
		removeCost(Number(form.get('cost_id')));
		return { success: true };
	}
};
