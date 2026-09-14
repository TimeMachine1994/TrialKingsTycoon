import { parseMoney, parseRate } from '$lib/money';

// ---- Action types ------------------------------------------------------------

export type ReportKind =
	| 'dashboard'
	| 'sales_vs_cogs'
	| 'waste'
	| 'valuation'
	| 'margin_by_job'
	| 'margin_by_client'
	| 'efficiency';

export const REPORT_KINDS: ReportKind[] = [
	'dashboard',
	'sales_vs_cogs',
	'waste',
	'valuation',
	'margin_by_job',
	'margin_by_client',
	'efficiency'
];

export type ReadAction =
	| { type: 'inventory_status'; low_stock_only?: boolean }
	| { type: 'report'; kind: ReportKind }
	| { type: 'find_receipts'; vendor?: string; from?: string; to?: string; limit?: number }
	| { type: 'get_receipt'; id: number }
	| { type: 'find_jobs'; client?: string; status?: 'open' | 'closed'; from?: string; to?: string; limit?: number }
	| { type: 'get_job'; id: number };

export interface NewVendorSpec {
	name: string;
	url?: string;
	notes?: string;
}

export interface NewProductSpec {
	name: string;
	category?: string;
	base_unit?: string;
	sku?: string;
	reorder_point?: number;
	conv_name?: string;
	conv_per?: number;
	notes?: string;
}

export type VendorRef = { id: number } | { new: NewVendorSpec };
export type ProductRef = { id: number } | { new: NewProductSpec };

export interface ReceiptLineSpec {
	product: ProductRef;
	unit_name: string;
	base_units_per: number;
	qty_purchased: number;
	line_cost: string; // dollars
}

export interface MaterialSpec {
	product: ProductRef;
	qty: number;
	unit_name?: string;
	base_units_per?: number;
	kind: 'used' | 'waste';
	waste_reason?: string;
}

export interface PostReceiptAction {
	type: 'post_receipt';
	vendor: VendorRef;
	purchased_at: string;
	ref_number?: string;
	notes?: string;
	lines: ReceiptLineSpec[];
	tax?: string;
	tax_rate?: string;
	shipping?: string;
	allocate_extras?: boolean;
}

export interface CreateJobAction {
	type: 'create_job';
	name: string;
	client?: string;
	invoice_number?: string;
	invoiced_amount?: string;
	job_date: string;
	notes?: string;
	materials?: MaterialSpec[];
}

export interface AddJobMaterialsAction {
	type: 'add_job_materials';
	job_id: number;
	materials: MaterialSpec[];
}

export interface UpdateJobAction {
	type: 'update_job';
	job_id: number;
	client?: string;
	invoice_number?: string;
	invoiced_amount?: string;
	status?: 'open' | 'closed';
}

export interface CreateProductAction extends NewProductSpec {
	type: 'create_product';
}

export interface CreateVendorAction extends NewVendorSpec {
	type: 'create_vendor';
}

export type WriteAction =
	| PostReceiptAction
	| CreateJobAction
	| AddJobMaterialsAction
	| UpdateJobAction
	| CreateProductAction
	| CreateVendorAction;

export type Action = ReadAction | WriteAction;

const WRITE_TYPES = new Set([
	'post_receipt',
	'create_job',
	'add_job_materials',
	'update_job',
	'create_product',
	'create_vendor'
]);

export function isWriteAction(a: Action): a is WriteAction {
	return WRITE_TYPES.has(a.type);
}

// ---- Validation --------------------------------------------------------------

class ValidationError extends Error {}

type Obj = Record<string, unknown>;

function obj(v: unknown, where: string): Obj {
	if (!v || typeof v !== 'object' || Array.isArray(v)) throw new ValidationError(`${where} must be an object`);
	return v as Obj;
}

function str(o: Obj, key: string, where: string, required: boolean): string | undefined {
	const v = o[key];
	if (v === undefined || v === null || v === '') {
		if (required) throw new ValidationError(`${where}.${key} is required`);
		return undefined;
	}
	if (typeof v !== 'string') throw new ValidationError(`${where}.${key} must be a string`);
	return v.trim();
}

function money(o: Obj, key: string, where: string, required: boolean): string | undefined {
	const v = o[key];
	if (v === undefined || v === null || v === '') {
		if (required) throw new ValidationError(`${where}.${key} is required`);
		return undefined;
	}
	if (typeof v !== 'string' && typeof v !== 'number') {
		throw new ValidationError(`${where}.${key} must be a dollar string like "12.99"`);
	}
	const s = String(v);
	try {
		parseMoney(s);
	} catch {
		throw new ValidationError(`${where}.${key} is not a valid dollar amount: "${s}"`);
	}
	return s;
}

function posInt(o: Obj, key: string, where: string, required: boolean): number | undefined {
	const v = o[key];
	if (v === undefined || v === null) {
		if (required) throw new ValidationError(`${where}.${key} is required`);
		return undefined;
	}
	const n = typeof v === 'string' ? Number(v) : v;
	if (typeof n !== 'number' || !Number.isInteger(n) || n <= 0) {
		throw new ValidationError(`${where}.${key} must be a positive whole number`);
	}
	return n;
}

function bool(o: Obj, key: string, where: string): boolean | undefined {
	const v = o[key];
	if (v === undefined || v === null) return undefined;
	if (typeof v !== 'boolean') throw new ValidationError(`${where}.${key} must be true or false`);
	return v;
}

function date(o: Obj, key: string, where: string, required: boolean): string | undefined {
	const s = str(o, key, where, required);
	if (s !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(s)) {
		throw new ValidationError(`${where}.${key} must be YYYY-MM-DD`);
	}
	return s;
}

function oneOf<T extends string>(o: Obj, key: string, where: string, allowed: readonly T[], required: boolean): T | undefined {
	const s = str(o, key, where, required);
	if (s === undefined) return undefined;
	if (!allowed.includes(s as T)) {
		throw new ValidationError(`${where}.${key} must be one of: ${allowed.join(', ')}`);
	}
	return s as T;
}

function newVendorSpec(v: unknown, where: string): NewVendorSpec {
	const o = obj(v, where);
	return { name: str(o, 'name', where, true)!, url: str(o, 'url', where, false), notes: str(o, 'notes', where, false) };
}

function newProductSpec(v: unknown, where: string): NewProductSpec {
	const o = obj(v, where);
	const spec: NewProductSpec = {
		name: str(o, 'name', where, true)!,
		category: str(o, 'category', where, false),
		base_unit: str(o, 'base_unit', where, false),
		sku: str(o, 'sku', where, false),
		notes: str(o, 'notes', where, false),
		conv_name: str(o, 'conv_name', where, false),
		conv_per: posInt(o, 'conv_per', where, false)
	};
	const reorder = o.reorder_point;
	if (reorder !== undefined && reorder !== null) {
		const n = Number(reorder);
		if (!Number.isInteger(n) || n < 0) throw new ValidationError(`${where}.reorder_point must be a whole number`);
		spec.reorder_point = n;
	}
	if ((spec.conv_name && !spec.conv_per) || (!spec.conv_name && spec.conv_per)) {
		throw new ValidationError(`${where}: conv_name and conv_per must be given together`);
	}
	return spec;
}

function vendorRef(v: unknown, where: string): VendorRef {
	const o = obj(v, where);
	if (o.id !== undefined) return { id: posInt(o, 'id', where, true)! };
	if (o.new !== undefined) return { new: newVendorSpec(o.new, `${where}.new`) };
	throw new ValidationError(`${where} must be {"id": n} or {"new": {...}}`);
}

function productRef(v: unknown, where: string): ProductRef {
	const o = obj(v, where);
	if (o.id !== undefined) return { id: posInt(o, 'id', where, true)! };
	if (o.new !== undefined) return { new: newProductSpec(o.new, `${where}.new`) };
	throw new ValidationError(`${where} must be {"id": n} or {"new": {...}}`);
}

function list(o: Obj, key: string, where: string, required: boolean): unknown[] | undefined {
	const v = o[key];
	if (v === undefined || v === null) {
		if (required) throw new ValidationError(`${where}.${key} is required`);
		return undefined;
	}
	if (!Array.isArray(v)) throw new ValidationError(`${where}.${key} must be an array`);
	if (required && v.length === 0) throw new ValidationError(`${where}.${key} must not be empty`);
	return v;
}

function receiptLine(v: unknown, where: string): ReceiptLineSpec {
	const o = obj(v, where);
	return {
		product: productRef(o.product, `${where}.product`),
		unit_name: str(o, 'unit_name', where, true)!,
		base_units_per: posInt(o, 'base_units_per', where, false) ?? 1,
		qty_purchased: posInt(o, 'qty_purchased', where, true)!,
		line_cost: money(o, 'line_cost', where, true)!
	};
}

function material(v: unknown, where: string): MaterialSpec {
	const o = obj(v, where);
	return {
		product: productRef(o.product, `${where}.product`),
		qty: posInt(o, 'qty', where, true)!,
		unit_name: str(o, 'unit_name', where, false),
		base_units_per: posInt(o, 'base_units_per', where, false),
		kind: oneOf(o, 'kind', where, ['used', 'waste'] as const, false) ?? 'used',
		waste_reason: str(o, 'waste_reason', where, false)
	};
}

export function validateAction(raw: unknown): Action {
	const o = obj(raw, 'action');
	const type = str(o, 'type', 'action', true)!;
	const w = type;

	switch (type) {
		case 'inventory_status':
			return { type, low_stock_only: bool(o, 'low_stock_only', w) };
		case 'report':
			return { type, kind: oneOf(o, 'kind', w, REPORT_KINDS, true)! };
		case 'find_receipts':
			return {
				type,
				vendor: str(o, 'vendor', w, false),
				from: date(o, 'from', w, false),
				to: date(o, 'to', w, false),
				limit: posInt(o, 'limit', w, false)
			};
		case 'get_receipt':
			return { type, id: posInt(o, 'id', w, true)! };
		case 'find_jobs':
			return {
				type,
				client: str(o, 'client', w, false),
				status: oneOf(o, 'status', w, ['open', 'closed'] as const, false),
				from: date(o, 'from', w, false),
				to: date(o, 'to', w, false),
				limit: posInt(o, 'limit', w, false)
			};
		case 'get_job':
			return { type, id: posInt(o, 'id', w, true)! };

		case 'post_receipt': {
			const taxRate = str(o, 'tax_rate', w, false);
			if (taxRate !== undefined) {
				try {
					parseRate(taxRate);
				} catch {
					throw new ValidationError(`${w}.tax_rate is not a valid percent: "${taxRate}"`);
				}
			}
			return {
				type,
				vendor: vendorRef(o.vendor, `${w}.vendor`),
				purchased_at: date(o, 'purchased_at', w, true)!,
				ref_number: str(o, 'ref_number', w, false),
				notes: str(o, 'notes', w, false),
				lines: list(o, 'lines', w, true)!.map((l, i) => receiptLine(l, `${w}.lines[${i}]`)),
				tax: money(o, 'tax', w, false),
				tax_rate: taxRate,
				shipping: money(o, 'shipping', w, false),
				allocate_extras: bool(o, 'allocate_extras', w)
			};
		}
		case 'create_job':
			return {
				type,
				name: str(o, 'name', w, true)!,
				client: str(o, 'client', w, false),
				invoice_number: str(o, 'invoice_number', w, false),
				invoiced_amount: money(o, 'invoiced_amount', w, false),
				job_date: date(o, 'job_date', w, true)!,
				notes: str(o, 'notes', w, false),
				materials: list(o, 'materials', w, false)?.map((m, i) => material(m, `${w}.materials[${i}]`))
			};
		case 'add_job_materials':
			return {
				type,
				job_id: posInt(o, 'job_id', w, true)!,
				materials: list(o, 'materials', w, true)!.map((m, i) => material(m, `${w}.materials[${i}]`))
			};
		case 'update_job': {
			const a: UpdateJobAction = {
				type,
				job_id: posInt(o, 'job_id', w, true)!,
				client: str(o, 'client', w, false),
				invoice_number: str(o, 'invoice_number', w, false),
				invoiced_amount: money(o, 'invoiced_amount', w, false),
				status: oneOf(o, 'status', w, ['open', 'closed'] as const, false)
			};
			if (!a.client && !a.invoice_number && !a.invoiced_amount && !a.status) {
				throw new ValidationError(`${w}: nothing to update`);
			}
			return a;
		}
		case 'create_product':
			return { type, ...newProductSpec(o, w) };
		case 'create_vendor':
			return { type, ...newVendorSpec(o, w) };
		default:
			throw new ValidationError(`Unknown action type "${type}"`);
	}
}

// ---- Parsing model output ----------------------------------------------------

export interface ParsedReply {
	/** Assistant text with action fences removed. */
	display: string;
	actions: Action[];
	/** Human-readable problems with blocks that failed to parse/validate. */
	errors: string[];
}

const FENCE_RE = /```action\s*\n([\s\S]*?)```/gi;

export function parseActions(text: string): ParsedReply {
	const actions: Action[] = [];
	const errors: string[] = [];
	const display = text
		.replace(FENCE_RE, (_m, body: string) => {
			try {
				actions.push(validateAction(JSON.parse(body.trim())));
			} catch (e) {
				errors.push(e instanceof SyntaxError ? `Invalid JSON in action block: ${e.message}` : (e as Error).message);
			}
			return '';
		})
		.replace(/\n{3,}/g, '\n\n')
		.trim();
	return { display, actions, errors };
}

// ---- Descriptions ------------------------------------------------------------

function refName(r: ProductRef | VendorRef): string {
	return 'id' in r ? `#${r.id}` : `NEW "${r.new.name}"`;
}

/** One-line human summary of a write action (for history rows and result notes). */
export function describeProposal(a: WriteAction): string {
	switch (a.type) {
		case 'post_receipt':
			return `Post receipt from vendor ${refName(a.vendor)} on ${a.purchased_at} (${a.lines.length} line${a.lines.length === 1 ? '' : 's'})`;
		case 'create_job':
			return `Create job "${a.name}"${a.client ? ` for ${a.client}` : ''} on ${a.job_date}${a.materials?.length ? ` with ${a.materials.length} material line(s)` : ''}`;
		case 'add_job_materials':
			return `Add ${a.materials.length} material line(s) to job #${a.job_id}`;
		case 'update_job':
			return `Update job #${a.job_id}`;
		case 'create_product':
			return `Create product "${a.name}"`;
		case 'create_vendor':
			return `Create vendor "${a.name}"`;
	}
}
