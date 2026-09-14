import { db, type Scenario, type ScenarioCost } from '$lib/server/db';
import { actualsToInputs, type ActualsSummary } from '$lib/breakeven';
import type { CostCadence, CostCategory } from '$lib/planner-types';

export interface ScenarioWithCosts extends Scenario {
	costs: ScenarioCost[];
}

export interface ScenarioAssumptions {
	name: string;
	notes: string | null;
	variable_cost_rate: number;
	avg_job_value: number;
	hours_per_job: number;
	hourly_rate: number;
	jobs_per_month: number;
	jobs_growth_rate: number;
	target_profit: number;
}

export interface NewCost {
	label: string;
	category: CostCategory;
	amount: number;
	cadence: CostCadence;
}

export function listScenarios(): Scenario[] {
	return db.prepare('SELECT * FROM scenarios ORDER BY is_active DESC, name').all() as Scenario[];
}

export function listCosts(scenarioId: number): ScenarioCost[] {
	return db
		.prepare('SELECT * FROM scenario_costs WHERE scenario_id = ? ORDER BY sort_order, id')
		.all(scenarioId) as ScenarioCost[];
}

export function getScenario(id: number): ScenarioWithCosts | undefined {
	const s = db.prepare('SELECT * FROM scenarios WHERE id = ?').get(id) as Scenario | undefined;
	if (!s) return undefined;
	return { ...s, costs: listCosts(id) };
}

export function getActiveScenario(): ScenarioWithCosts | undefined {
	const s = db.prepare('SELECT * FROM scenarios WHERE is_active = 1 LIMIT 1').get() as Scenario | undefined;
	return s ? { ...s, costs: listCosts(s.id) } : undefined;
}

/** All-time totals from recorded jobs, used for defaults and the reality-check column. */
export function actualsSummary(): ActualsSummary {
	const row = db
		.prepare(
			`SELECT COALESCE(SUM(invoiced_amount), 0) AS sales, COUNT(*) AS jobCount,
				COUNT(DISTINCT substr(job_date, 1, 7)) AS months
			 FROM jobs`
		)
		.get() as { sales: number; jobCount: number; months: number };
	const mats = db
		.prepare(
			`SELECT
				COALESCE(SUM(CASE WHEN kind='used' THEN qty_base * unit_cost_at_time END), 0) AS used,
				COALESCE(SUM(CASE WHEN kind='waste' THEN qty_base * unit_cost_at_time END), 0) AS waste
			 FROM job_materials`
		)
		.get() as { used: number; waste: number };
	return { ...row, ...mats };
}

/** New scenario seeded from actuals; becomes active if it is the first one. */
export function createScenario(name: string, notes: string | null = null): number {
	const d = actualsToInputs(actualsSummary());
	const count = (db.prepare('SELECT COUNT(*) AS c FROM scenarios').get() as { c: number }).c;
	return db
		.prepare(
			`INSERT INTO scenarios (name, notes, is_active, variable_cost_rate, avg_job_value, jobs_per_month)
			 VALUES (?, ?, ?, ?, ?, ?)`
		)
		.run(name, notes, count === 0 ? 1 : 0, d.variableCostRate, d.avgJobValue, d.jobsPerMonth)
		.lastInsertRowid as number;
}

export function updateScenario(id: number, a: ScenarioAssumptions): void {
	db.prepare(
		`UPDATE scenarios SET name = ?, notes = ?, variable_cost_rate = ?, avg_job_value = ?, hours_per_job = ?,
			hourly_rate = ?, jobs_per_month = ?, jobs_growth_rate = ?, target_profit = ?, updated_at = datetime('now')
		 WHERE id = ?`
	).run(
		a.name,
		a.notes,
		a.variable_cost_rate,
		a.avg_job_value,
		a.hours_per_job,
		a.hourly_rate,
		a.jobs_per_month,
		a.jobs_growth_rate,
		a.target_profit,
		id
	);
}

export function deleteScenario(id: number): void {
	const s = db.prepare('SELECT is_active FROM scenarios WHERE id = ?').get(id) as { is_active: number } | undefined;
	if (!s) return;
	if (s.is_active) throw new Error('Cannot delete the active scenario — activate another one first');
	db.prepare('DELETE FROM scenarios WHERE id = ?').run(id);
}

export function duplicateScenario(id: number): number {
	const src = getScenario(id);
	if (!src) throw new Error(`Scenario ${id} not found`);
	const run = db.transaction(() => {
		const newId = db
			.prepare(
				`INSERT INTO scenarios (name, notes, is_active, variable_cost_rate, avg_job_value, hours_per_job,
					hourly_rate, jobs_per_month, jobs_growth_rate, target_profit)
				 VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`
			)
			.run(
				`${src.name} (copy)`,
				src.notes,
				src.variable_cost_rate,
				src.avg_job_value,
				src.hours_per_job,
				src.hourly_rate,
				src.jobs_per_month,
				src.jobs_growth_rate,
				src.target_profit
			).lastInsertRowid as number;
		const ins = db.prepare(
			`INSERT INTO scenario_costs (scenario_id, label, category, amount, cadence, enabled, sort_order)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		);
		for (const c of src.costs) ins.run(newId, c.label, c.category, c.amount, c.cadence, c.enabled, c.sort_order);
		return newId;
	});
	return run();
}

export function setActiveScenario(id: number): void {
	const run = db.transaction(() => {
		db.prepare('UPDATE scenarios SET is_active = 0').run();
		db.prepare('UPDATE scenarios SET is_active = 1 WHERE id = ?').run(id);
	});
	run();
}

function touch(scenarioId: number): void {
	db.prepare(`UPDATE scenarios SET updated_at = datetime('now') WHERE id = ?`).run(scenarioId);
}

export function addCost(scenarioId: number, c: NewCost): number {
	const next = (
		db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM scenario_costs WHERE scenario_id = ?').get(scenarioId) as {
			n: number;
		}
	).n;
	const id = db
		.prepare(
			`INSERT INTO scenario_costs (scenario_id, label, category, amount, cadence, sort_order)
			 VALUES (?, ?, ?, ?, ?, ?)`
		)
		.run(scenarioId, c.label, c.category, c.amount, c.cadence, next).lastInsertRowid as number;
	touch(scenarioId);
	return id;
}

export function updateCost(costId: number, c: NewCost): void {
	db.prepare('UPDATE scenario_costs SET label = ?, category = ?, amount = ?, cadence = ? WHERE id = ?').run(
		c.label,
		c.category,
		c.amount,
		c.cadence,
		costId
	);
	const row = db.prepare('SELECT scenario_id FROM scenario_costs WHERE id = ?').get(costId) as { scenario_id: number } | undefined;
	if (row) touch(row.scenario_id);
}

export function toggleCost(costId: number): void {
	const row = db.prepare('SELECT scenario_id FROM scenario_costs WHERE id = ?').get(costId) as { scenario_id: number } | undefined;
	if (!row) return;
	db.prepare('UPDATE scenario_costs SET enabled = CASE enabled WHEN 1 THEN 0 ELSE 1 END WHERE id = ?').run(costId);
	touch(row.scenario_id);
}

export function removeCost(costId: number): void {
	const row = db.prepare('SELECT scenario_id FROM scenario_costs WHERE id = ?').get(costId) as { scenario_id: number } | undefined;
	if (!row) return;
	db.prepare('DELETE FROM scenario_costs WHERE id = ?').run(costId);
	touch(row.scenario_id);
}
