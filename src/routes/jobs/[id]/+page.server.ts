import { db, type Job, type JobMaterial, type Product, type UnitConversion } from '$lib/server/db';
import { parseMoney } from '$lib/money';
import { addJobMaterial, jobCosts, removeJobMaterial, setJobStatus } from '$lib/server/services/jobs';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(params.id) as Job | undefined;
	if (!job) throw error(404, 'Job not found');

	const materials = db
		.prepare(
			`SELECT m.*, p.name AS product_name, p.base_unit, p.sprite
			 FROM job_materials m JOIN products p ON p.id = m.product_id
			 WHERE m.job_id = ? ORDER BY m.id`
		)
		.all(job.id) as Array<JobMaterial & { product_name: string; base_unit: string; sprite: string }>;

	const products = db.prepare('SELECT * FROM products ORDER BY name').all() as Product[];
	const conversions = db.prepare('SELECT * FROM unit_conversions').all() as UnitConversion[];
	const costs = jobCosts(job.id, job.invoiced_amount);

	return { job, materials, products, conversions, costs };
};

export const actions: Actions = {
	addMaterial: async ({ request, params }) => {
		const form = await request.formData();
		const productId = Number(form.get('product_id'));
		const qty = Number(form.get('qty'));
		const per = Number(form.get('base_units_per') ?? 1);
		const kind = form.get('kind') === 'waste' ? 'waste' : 'used';
		const wasteReason = String(form.get('waste_reason') ?? '').trim() || null;
		if (!productId || !Number.isInteger(qty) || qty <= 0) {
			return fail(400, { error: 'Pick a product and a positive whole quantity' });
		}
		try {
			addJobMaterial(Number(params.id), productId, qty * (per || 1), kind, wasteReason);
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to add material' });
		}
		return { success: true };
	},

	removeMaterial: async ({ request }) => {
		const form = await request.formData();
		removeJobMaterial(Number(form.get('material_id')));
		return { success: true };
	},

	updateJob: async ({ request, params }) => {
		const form = await request.formData();
		try {
			const invoiced = parseMoney(String(form.get('invoiced_amount') ?? '0') || '0');
			db.prepare('UPDATE jobs SET invoiced_amount = ?, client = ?, invoice_number = ? WHERE id = ?').run(
				invoiced,
				String(form.get('client') ?? '').trim() || null,
				String(form.get('invoice_number') ?? '').trim() || null,
				params.id
			);
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to update job' });
		}
		return { success: true };
	},

	toggleStatus: async ({ params }) => {
		const job = db.prepare('SELECT status FROM jobs WHERE id = ?').get(params.id) as
			| { status: string }
			| undefined;
		if (!job) return fail(404, { error: 'Job not found' });
		setJobStatus(Number(params.id), job.status === 'open' ? 'closed' : 'open');
		return { success: true };
	}
};
