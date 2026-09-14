/**
 * One-off data import: the two Fishman document-production jobs (Aug 2026),
 * from Square invoices Fishman082426 and Fishman082526.
 *
 * Run from the repo root (the DB lives at ./data/inventory.db):
 *   npx vite-node src/scripts/import-jobs-fishman-2026-08.ts
 *
 * Idempotent: a job is skipped if one with the same invoice_number exists.
 * Run AFTER the Staples and Amazon receipt imports so stock/avg costs exist.
 *
 * Assumptions (confirmed with Austin):
 * - invoiced_amount = pre-tax subtotal (sales tax is pass-through)
 * - printing was single-sided: 1 sheet per invoiced page
 * - spine labels were printed on Vinyl Sticker Sheets and cut, ~8 strips/sheet
 * - toner: 1 TN830XL cartridge charged to job 1 (~2,000 pages)
 */
import { db, type Product } from '$lib/server/db';
import { addJobMaterial, createJob, type NewJob } from '$lib/server/services/jobs';
import { parseMoney } from '$lib/money';

// product ids as they exist after the receipt imports; verified by name below
const P = {
	paper: { id: 1, name: 'Letter Paper 20lb (3-hole punch)' },
	toner: { id: 2, name: 'Black Toner Cartridge' },
	clips: { id: 3, name: 'Binder Clips (medium)' },
	binder1in: { id: 4, name: '1" 3-Ring Binder' },
	vinyl: { id: 5, name: 'Vinly Sticker Sheet' },
	indexTabs: { id: 8, name: 'Legal Exhibit Index Tabs 1-25 (White)' },
	binderHalf: { id: 12, name: 'SUIN 1/2" 3-Ring Binder (2 pockets)' },
	fileBox: { id: 15, name: 'Amazon Basics Storage/Filing Box (Letter/Legal)' }
} as const;

const SPINE_STRIPS_PER_SHEET = 8;

interface Material { product: keyof typeof P; qty: number; note: string }
interface JobSpec { job: NewJob; materials: Material[] }

const jobs: JobSpec[] = [
	{
		job: {
			name: 'Document Production for Fishman Case',
			client: 'Sandra Ferrer (LHL Law Orlando)',
			invoice_number: 'Fishman082426',
			invoiced_amount: parseMoney('237.42'),
			job_date: '2026-08-24',
			notes: [
				'Square invoice Fishman082426. Gross $474.84 less 50% first-order discount = $237.42; tax $15.43; total due $252.85.',
				'Lines: Std printing 2011 @ .12; Color 36 @ .48; Generic tabs 4 @ .25; Spine labeling 36 @ .25; Binder clips 36 @ .40;',
				'Binders 1" 30 @ 4.99; Binders 1/2" 6 @ 3.99; B&W cover sheets 36 @ .12; Box 4 @ 3.47.'
			].join(' ')
		},
		materials: [
			{ product: 'paper', qty: 2011 + 36 + 36, note: 'std 2011 + color 36 + cover sheets 36' },
			{ product: 'toner', qty: 1, note: '~2,000 pages' },
			{ product: 'indexTabs', qty: 4, note: 'generic tabs 4' },
			{ product: 'vinyl', qty: Math.ceil(36 / SPINE_STRIPS_PER_SHEET), note: '36 spine labels' },
			{ product: 'clips', qty: 36, note: '' },
			{ product: 'binder1in', qty: 30, note: '' },
			{ product: 'binderHalf', qty: 6, note: '' },
			{ product: 'fileBox', qty: 4, note: '' }
		]
	},
	{
		job: {
			name: 'Document Production for Fishman Case (Part 2)',
			client: 'Sandra Ferrer (LHL Law Orlando)',
			invoice_number: 'Fishman082526',
			invoiced_amount: parseMoney('83.12'),
			job_date: '2026-08-25',
			notes: [
				'Square invoice Fishman082526. Subtotal $83.12; tax $5.40; total due $88.52.',
				'Lines: Std printing 272 @ .12; Moderately sectioned 72 @ .19; Highly sectioned 28 @ .22; Color 20 @ .48;',
				'Spine labeling 4 @ .25; Binder clips 4 @ .40; Binders 1" 2 @ 4.99; Binders 1/2" 2 @ 3.99; B&W cover sheets 4 @ .12.'
			].join(' ')
		},
		materials: [
			{ product: 'paper', qty: 272 + 72 + 28 + 20 + 4, note: 'std 272 + mod 72 + high 28 + color 20 + covers 4' },
			{ product: 'vinyl', qty: Math.ceil(4 / SPINE_STRIPS_PER_SHEET), note: '4 spine labels' },
			{ product: 'clips', qty: 4, note: '' },
			{ product: 'binder1in', qty: 2, note: '' },
			{ product: 'binderHalf', qty: 2, note: '' }
		]
	}
];

function verifyProducts(): void {
	const get = db.prepare('SELECT * FROM products WHERE id = ?');
	for (const p of Object.values(P)) {
		const row = get.get(p.id) as Product | undefined;
		if (!row || row.name !== p.name) {
			throw new Error(`Product #${p.id} expected "${p.name}", found "${row?.name ?? 'missing'}"`);
		}
	}
}

const run = db.transaction(() => {
	verifyProducts();
	const exists = db.prepare('SELECT id FROM jobs WHERE invoice_number = ?');

	for (const spec of jobs) {
		const dup = exists.get(spec.job.invoice_number) as { id: number } | undefined;
		if (dup) {
			console.log(`job ${spec.job.invoice_number} already imported as #${dup.id}, skipping`);
			continue;
		}
		const jobId = createJob(spec.job);
		for (const m of spec.materials) {
			addJobMaterial(jobId, P[m.product].id, m.qty, 'used', null);
		}
		const cost = db
			.prepare('SELECT COALESCE(SUM(qty_base * unit_cost_at_time), 0) AS c FROM job_materials WHERE job_id = ?')
			.get(jobId) as { c: number };
		console.log(
			`job ${spec.job.invoice_number} created as #${jobId}: invoiced $${(spec.job.invoiced_amount / 1e6).toFixed(2)}, material cost $${(cost.c / 1e6).toFixed(2)}, ${spec.materials.length} material lines`
		);
	}
});

run();
