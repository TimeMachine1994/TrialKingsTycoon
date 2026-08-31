import { db, type Job } from '$lib/server/db';
import { parseMoney } from '$lib/money';
import { createJob } from '$lib/server/services/jobs';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const jobs = db
		.prepare(
			`SELECT j.*,
				COALESCE((SELECT SUM(m.qty_base * m.unit_cost_at_time) FROM job_materials m WHERE m.job_id = j.id AND m.kind = 'used'), 0) AS used_cost,
				COALESCE((SELECT SUM(m.qty_base * m.unit_cost_at_time) FROM job_materials m WHERE m.job_id = j.id AND m.kind = 'waste'), 0) AS waste_cost
			 FROM jobs j ORDER BY j.job_date DESC, j.id DESC LIMIT 100`
		)
		.all() as Array<Job & { used_cost: number; waste_cost: number }>;
	return { jobs };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Job name is required' });
		let jobId: number;
		try {
			jobId = createJob({
				name,
				client: String(form.get('client') ?? '').trim() || null,
				invoice_number: String(form.get('invoice_number') ?? '').trim() || null,
				invoiced_amount: parseMoney(String(form.get('invoiced_amount') ?? '0') || '0'),
				job_date: String(form.get('job_date') ?? new Date().toISOString().slice(0, 10)),
				notes: String(form.get('notes') ?? '').trim() || null
			});
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to create job' });
		}
		throw redirect(303, `/jobs/${jobId}`);
	}
};
