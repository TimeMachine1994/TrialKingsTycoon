import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import type { CostCadence, CostCategory } from '$lib/planner-types';

const DATA_DIR = path.resolve('data');
const DB_PATH = path.join(DATA_DIR, 'inventory.db');

fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS products (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	sku TEXT,
	category TEXT NOT NULL DEFAULT 'other',
	base_unit TEXT NOT NULL DEFAULT 'each',
	avg_cost INTEGER NOT NULL DEFAULT 0,
	qty_on_hand INTEGER NOT NULL DEFAULT 0,
	reorder_point INTEGER,
	sprite TEXT NOT NULL DEFAULT 'box',
	notes TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS unit_conversions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
	unit_name TEXT NOT NULL,
	base_units_per INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS vendors (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	url TEXT,
	notes TEXT
);

CREATE TABLE IF NOT EXISTS receipts (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	vendor_id INTEGER NOT NULL REFERENCES vendors(id),
	ref_number TEXT,
	purchased_at TEXT NOT NULL,
	subtotal INTEGER NOT NULL DEFAULT 0,
	tax INTEGER NOT NULL DEFAULT 0,
	shipping INTEGER NOT NULL DEFAULT 0,
	total INTEGER NOT NULL DEFAULT 0,
	allocate_extras INTEGER NOT NULL DEFAULT 1,
	notes TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS receipt_lines (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	receipt_id INTEGER NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
	product_id INTEGER NOT NULL REFERENCES products(id),
	unit_name TEXT NOT NULL,
	base_units_per INTEGER NOT NULL DEFAULT 1,
	qty_purchased INTEGER NOT NULL,
	qty_base INTEGER NOT NULL,
	line_cost INTEGER NOT NULL,
	unit_cost_base INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	client TEXT,
	invoice_number TEXT,
	invoiced_amount INTEGER NOT NULL DEFAULT 0,
	status TEXT NOT NULL DEFAULT 'open',
	job_date TEXT NOT NULL,
	notes TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS job_materials (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
	product_id INTEGER NOT NULL REFERENCES products(id),
	qty_base INTEGER NOT NULL,
	kind TEXT NOT NULL CHECK (kind IN ('used','waste')),
	unit_cost_at_time INTEGER NOT NULL,
	waste_reason TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stock_movements (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	product_id INTEGER NOT NULL REFERENCES products(id),
	kind TEXT NOT NULL CHECK (kind IN ('receipt','job_use','job_waste','adjustment')),
	qty_delta INTEGER NOT NULL,
	unit_cost INTEGER NOT NULL,
	ref_table TEXT,
	ref_id INTEGER,
	note TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attachments (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	receipt_id INTEGER NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
	original_name TEXT NOT NULL,
	stored_name TEXT NOT NULL,
	mime TEXT NOT NULL,
	size INTEGER NOT NULL,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scenarios (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	notes TEXT,
	is_active INTEGER NOT NULL DEFAULT 0,
	variable_cost_rate INTEGER NOT NULL DEFAULT 0,
	avg_job_value INTEGER NOT NULL DEFAULT 0,
	hours_per_job REAL NOT NULL DEFAULT 0,
	hourly_rate INTEGER NOT NULL DEFAULT 0,
	jobs_per_month REAL NOT NULL DEFAULT 0,
	jobs_growth_rate INTEGER NOT NULL DEFAULT 0,
	target_profit INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scenario_costs (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	scenario_id INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
	label TEXT NOT NULL,
	category TEXT NOT NULL CHECK (category IN ('rent','utilities','software','insurance','equipment','marketing','labor','other')),
	amount INTEGER NOT NULL,
	cadence TEXT NOT NULL CHECK (cadence IN ('monthly','yearly','one_time')),
	enabled INTEGER NOT NULL DEFAULT 1,
	sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_receipt_lines_product ON receipt_lines(product_id);
CREATE INDEX IF NOT EXISTS idx_scenario_costs_scenario ON scenario_costs(scenario_id);
CREATE INDEX IF NOT EXISTS idx_job_materials_product ON job_materials(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_attachments_receipt ON attachments(receipt_id);
`);

// ---- In-place migrations for existing databases (no-ops when column exists) ----

function addColumnIfMissing(table: string, column: string, ddl: string): void {
	const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
	if (!cols.some((c) => c.name === column)) {
		db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
	}
}

addColumnIfMissing('receipts', 'tax_rate', 'tax_rate INTEGER');
addColumnIfMissing('receipts', 'voided_at', 'voided_at TEXT');

// ---- Settings helpers ----

export function getSetting(key: string): string | null {
	const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
		| { value: string }
		| undefined;
	return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
	db.prepare(
		'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
	).run(key, value);
}

// ---- Row types ----

export interface Product {
	id: number;
	name: string;
	sku: string | null;
	category: string;
	base_unit: string;
	avg_cost: number;
	qty_on_hand: number;
	reorder_point: number | null;
	sprite: string;
	notes: string | null;
	created_at: string;
}

export interface UnitConversion {
	id: number;
	product_id: number;
	unit_name: string;
	base_units_per: number;
}

export interface Vendor {
	id: number;
	name: string;
	url: string | null;
	notes: string | null;
}

export interface Receipt {
	id: number;
	vendor_id: number;
	ref_number: string | null;
	purchased_at: string;
	subtotal: number;
	tax: number;
	shipping: number;
	total: number;
	allocate_extras: number;
	notes: string | null;
	created_at: string;
	tax_rate: number | null;
	voided_at: string | null;
}

export interface Attachment {
	id: number;
	receipt_id: number;
	original_name: string;
	stored_name: string;
	mime: string;
	size: number;
	created_at: string;
}

export interface ReceiptLine {
	id: number;
	receipt_id: number;
	product_id: number;
	unit_name: string;
	base_units_per: number;
	qty_purchased: number;
	qty_base: number;
	line_cost: number;
	unit_cost_base: number;
}

export interface Job {
	id: number;
	name: string;
	client: string | null;
	invoice_number: string | null;
	invoiced_amount: number;
	status: string;
	job_date: string;
	notes: string | null;
	created_at: string;
}

export interface JobMaterial {
	id: number;
	job_id: number;
	product_id: number;
	qty_base: number;
	kind: 'used' | 'waste';
	unit_cost_at_time: number;
	waste_reason: string | null;
	created_at: string;
}

export interface StockMovement {
	id: number;
	product_id: number;
	kind: 'receipt' | 'job_use' | 'job_waste' | 'adjustment';
	qty_delta: number;
	unit_cost: number;
	ref_table: string | null;
	ref_id: number | null;
	note: string | null;
	created_at: string;
}

export interface Scenario {
	id: number;
	name: string;
	notes: string | null;
	is_active: number;
	variable_cost_rate: number;
	avg_job_value: number;
	hours_per_job: number;
	hourly_rate: number;
	jobs_per_month: number;
	jobs_growth_rate: number;
	target_profit: number;
	created_at: string;
	updated_at: string;
}

export interface ScenarioCost {
	id: number;
	scenario_id: number;
	label: string;
	category: CostCategory;
	amount: number;
	cadence: CostCadence;
	enabled: number;
	sort_order: number;
}

// ---- Seed (only when completely empty) ----

const productCount = (db.prepare('SELECT COUNT(*) AS c FROM products').get() as { c: number }).c;
if (productCount === 0) {
	const seed = db.transaction(() => {
		const insVendor = db.prepare('INSERT INTO vendors (name, url) VALUES (?, ?)');
		insVendor.run('Amazon', 'https://www.amazon.com');
		insVendor.run('Staples', 'https://www.staples.com');

		const insProduct = db.prepare(
			`INSERT INTO products (name, sku, category, base_unit, sprite, reorder_point) VALUES (?, ?, ?, ?, ?, ?)`
		);
		const insConv = db.prepare(
			'INSERT INTO unit_conversions (product_id, unit_name, base_units_per) VALUES (?, ?, ?)'
		);

		const paper = insProduct.run(
			'Letter Paper 20lb (3-hole punch)',
			null,
			'paper',
			'sheet',
			'ream',
			2500
		).lastInsertRowid as number;
		insConv.run(paper, 'ream (500)', 500);
		insConv.run(paper, 'case (5,000)', 5000);

		const toner = insProduct.run('Black Toner Cartridge', null, 'toner', 'cartridge', 'toner', 2)
			.lastInsertRowid as number;
		insConv.run(toner, '2-pack', 2);

		const clips = insProduct.run('Binder Clips (medium)', null, 'binding', 'clip', 'binderclip', 50)
			.lastInsertRowid as number;
		insConv.run(clips, 'box (12)', 12);

		insProduct.run('1" 3-Ring Binder', null, 'binding', 'binder', 'binder', 10);
	});
	seed();
}
