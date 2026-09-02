<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import Sprite from '$lib/components/Sprite.svelte';
	import Tip from '$lib/components/Tip.svelte';
	import { breakEvenMonth, computeBreakEven, monthlyFixed, project } from '$lib/breakeven';
	import { fmtMoney, fmtRate, MICRO, parseMoney, parseRate } from '$lib/money';
	import { CADENCE_LABEL, COST_CADENCES, COST_CATEGORIES } from '$lib/planner-types';
	import { fmtPct, fmtRatio } from '$lib/ratios';

	let { data, form } = $props();

	const s = $derived(data.scenario);
	const dollars = (micro: number) => (micro / MICRO).toFixed(2);

	// Editable assumptions (strings, so typing never fights the parser).
	// Deliberately seeded once: cost-line toggles reload `data` but must not clobber in-progress edits.
	const initial = untrack(() => data.scenario);
	let name = $state(initial.name);
	let notes = $state(initial.notes ?? '');
	let variablePct = $state(fmtRate(initial.variable_cost_rate));
	let avgJob = $state(dollars(initial.avg_job_value));
	let hoursPerJob = $state(String(initial.hours_per_job));
	let hourlyRate = $state(dollars(initial.hourly_rate));
	let jobsPerMonth = $state(String(initial.jobs_per_month));
	let growthPct = $state(fmtRate(initial.jobs_growth_rate));
	let targetProfit = $state(dollars(initial.target_profit));

	function safe<T>(fn: () => T, fallback: T): T {
		try {
			return fn();
		} catch {
			return fallback;
		}
	}
	const numOr0 = (v: string) => (Number.isFinite(Number(v)) ? Math.max(Number(v), 0) : 0);

	const fixed = $derived(monthlyFixed(s.costs));
	const inputs = $derived({
		fixedMonthly: fixed.fixedMonthly,
		oneTimeTotal: fixed.oneTimeTotal,
		variableCostRate: safe(() => parseRate(variablePct), 0),
		avgJobValue: safe(() => parseMoney(avgJob), 0),
		hoursPerJob: numOr0(hoursPerJob),
		hourlyRate: safe(() => parseMoney(hourlyRate), 0),
		jobsPerMonth: numOr0(jobsPerMonth),
		jobsGrowthRate: safe(() => parseRate(growthPct), 0),
		targetProfit: safe(() => parseMoney(targetProfit), 0)
	});
	const be = $derived(computeBreakEven(inputs));
	const rows = $derived(project(inputs));
	const beMonth = $derived(breakEvenMonth(rows));

	const fromActuals = $derived({
		variable: inputs.variableCostRate === data.defaults.variableCostRate,
		avgJob: inputs.avgJobValue === data.defaults.avgJobValue,
		jobs: inputs.jobsPerMonth === data.defaults.jobsPerMonth
	});

	const byCategory = $derived(
		COST_CATEGORIES.map((c) => ({
			category: c,
			monthly: monthlyFixed(s.costs.filter((x) => x.category === c)).fixedMonthly
		})).filter((g) => g.monthly > 0)
	);

	const tone = (v: number) => (v >= 0 ? 'var(--green)' : 'var(--red)');
</script>

<svelte:head><title>{s.name} · Planner</title></svelte:head>

{#if form?.error}
	<div class="pixel-panel mb-4 p-3" style="background: var(--red); color: white;">{form.error}</div>
{/if}

<div class="pixel-panel mb-6 flex flex-wrap items-center gap-4 p-4">
	<Sprite name="chart" size={48} />
	<div class="min-w-0 flex-1">
		<h2 class="text-[13px]" style="color: var(--accent-dark);">{s.name}</h2>
		<div class="mt-1 flex flex-wrap gap-2">
			{#if s.is_active}<span class="pixel-badge" style="background: var(--green);">ACTIVE</span>{/if}
			<span class="pixel-badge" style="background: var(--paper-dark);">UPDATED {s.updated_at.slice(0, 16)}</span>
		</div>
	</div>
	<a href="/planner" class="pixel-btn small">← ALL SCENARIOS</a>
</div>

<div class="grid grid-cols-1 gap-6 lg:grid-cols-5">
	<div class="grid gap-6 lg:col-span-2">
		<section class="pixel-panel p-4">
			<h3 class="mb-3 text-[11px]" style="color: var(--accent-dark);">ASSUMPTIONS</h3>
			<form method="POST" action="?/updateScenario" class="grid grid-cols-2 gap-3" use:enhance>
				<label class="col-span-2">Name <input name="name" class="pixel-input" bind:value={name} required /></label>
				<label class="col-span-2">Notes <input name="notes" class="pixel-input" bind:value={notes} /></label>
				<label>
					Materials % of revenue
					{#if fromActuals.variable}<span class="pixel-badge" style="background: var(--cyan);">FROM ACTUALS</span>{/if}
					<input name="variable_cost_pct" class="pixel-input" bind:value={variablePct} inputmode="decimal" />
				</label>
				<label>
					Avg job value ($)
					{#if fromActuals.avgJob}<span class="pixel-badge" style="background: var(--cyan);">FROM ACTUALS</span>{/if}
					<input name="avg_job_value" class="pixel-input" bind:value={avgJob} inputmode="decimal" />
				</label>
				<label>Hours per job <input name="hours_per_job" class="pixel-input" bind:value={hoursPerJob} inputmode="decimal" /></label>
				<label>Hourly rate ($) <input name="hourly_rate" class="pixel-input" bind:value={hourlyRate} inputmode="decimal" /></label>
				<label>
					Jobs per month
					{#if fromActuals.jobs}<span class="pixel-badge" style="background: var(--cyan);">FROM ACTUALS</span>{/if}
					<input name="jobs_per_month" class="pixel-input" bind:value={jobsPerMonth} inputmode="decimal" />
				</label>
				<label>Growth % / month <input name="jobs_growth_pct" class="pixel-input" bind:value={growthPct} inputmode="decimal" /></label>
				<label class="col-span-2">Target profit / month ($) <input name="target_profit" class="pixel-input" bind:value={targetProfit} inputmode="decimal" /></label>
				<div class="col-span-2"><button class="pixel-btn green" type="submit">SAVE ASSUMPTIONS</button></div>
			</form>
		</section>

		<section class="pixel-panel p-4">
			<h3 class="mb-3 flex items-center text-[11px]" style="color: var(--accent-dark);">
				OVERHEAD LINES
				<Tip text="Monthly and yearly lines (÷12) make up fixed cost per month. One-time lines are excluded from break-even and shown as payback." />
			</h3>
			{#if s.costs.length === 0}
				<p class="mb-3">No overhead yet — add rent, software, insurance…</p>
			{:else}
				<table class="pixel-table mb-3">
					<thead>
						<tr><th>On</th><th>Line</th><th>Amount</th><th></th></tr>
					</thead>
					<tbody>
						{#each s.costs as c (c.id)}
							<tr style={c.enabled ? '' : 'opacity: 0.5;'}>
								<td>
									<form method="POST" action="?/toggleCost" use:enhance>
										<input type="hidden" name="cost_id" value={c.id} />
										<button class="pixel-btn small {c.enabled ? 'green' : ''}" type="submit" title="Toggle">{c.enabled ? 'ON' : 'OFF'}</button>
									</form>
								</td>
								<td>
									{c.label}
									<div><span class="pixel-badge" style="background: var(--paper-dark);">{c.category.toUpperCase()}</span></div>
								</td>
								<td class="mono-num">{fmtMoney(c.amount)} <span class="text-sm">{CADENCE_LABEL[c.cadence]}</span></td>
								<td>
									<form method="POST" action="?/removeCost" use:enhance>
										<input type="hidden" name="cost_id" value={c.id} />
										<button class="pixel-btn small red" type="submit">X</button>
									</form>
								</td>
							</tr>
						{/each}
						{#each byCategory as g (g.category)}
							<tr>
								<td></td>
								<td class="pixel-font text-[9px]">{g.category.toUpperCase()}</td>
								<td class="mono-num">{fmtMoney(g.monthly)} <span class="text-sm">/ month</span></td>
								<td></td>
							</tr>
						{/each}
						<tr>
							<td></td>
							<td class="pixel-font text-[10px]">FIXED / MONTH</td>
							<td class="mono-num" style="color: var(--accent-dark);">{fmtMoney(fixed.fixedMonthly)}</td>
							<td></td>
						</tr>
						{#if fixed.oneTimeTotal > 0}
							<tr>
								<td></td>
								<td class="pixel-font text-[10px]">ONE-TIME</td>
								<td class="mono-num">{fmtMoney(fixed.oneTimeTotal)}</td>
								<td></td>
							</tr>
						{/if}
					</tbody>
				</table>
			{/if}
			<form method="POST" action="?/addCost" class="grid grid-cols-2 gap-2 border-t-4 border-dashed pt-3" use:enhance>
				<label class="col-span-2">Label <input name="label" class="pixel-input" placeholder="Rent — Oviedo unit" required /></label>
				<label>
					Category
					<select name="category" class="pixel-select">
						{#each COST_CATEGORIES as c (c)}<option value={c}>{c}</option>{/each}
					</select>
				</label>
				<label>
					Cadence
					<select name="cadence" class="pixel-select">
						{#each COST_CADENCES as c (c)}<option value={c}>{CADENCE_LABEL[c]}</option>{/each}
					</select>
				</label>
				<label>Amount ($) <input name="amount" class="pixel-input" inputmode="decimal" required /></label>
				<div class="flex items-end"><button class="pixel-btn blue" type="submit">ADD LINE</button></div>
			</form>
		</section>
	</div>

	<div class="grid gap-6 lg:col-span-3">
		<section class="pixel-panel p-4">
			<h3 class="mb-3 flex items-center gap-2 text-[11px]" style="color: var(--accent-dark);">
				<Sprite name="coin" size={24} /> RESULTS (LIVE)
			</h3>
			<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
				<div>
					<div class="pixel-font text-[9px]">FIXED / MO</div>
					<div class="mono-num text-2xl">{fmtMoney(fixed.fixedMonthly)}</div>
				</div>
				<div>
					<div class="pixel-font flex items-center text-[9px]">
						CONTRIBUTION / JOB
						<Tip text={`Avg job value − materials (${fmtMoney(be.materialsPerJob)}) − labor (${fmtMoney(be.laborPerJob)}). What each job leaves to cover overhead.`} />
					</div>
					<div class="mono-num text-2xl" style="color: {tone(be.contributionPerJob)};">{fmtMoney(be.contributionPerJob)}</div>
					<div class="text-sm">{fmtPct(be.contributionRate)} of revenue</div>
				</div>
				<div>
					<div class="pixel-font flex items-center text-[9px]">
						BREAK-EVEN REVENUE
						<Tip text="Fixed / month ÷ contribution %. Monthly sales needed to cover overhead." />
					</div>
					<div class="mono-num text-2xl">{be.breakEvenRevenue === null ? '—' : fmtMoney(be.breakEvenRevenue)}</div>
				</div>
				<div>
					<div class="pixel-font flex items-center text-[9px]">
						BREAK-EVEN JOBS
						<Tip text="Fixed / month ÷ contribution per job, rounded up." />
					</div>
					<div class="mono-num text-2xl">{be.breakEvenJobs ?? '—'}</div>
					<div class="text-sm">/ month</div>
				</div>
				<div>
					<div class="pixel-font flex items-center text-[9px]">
						JOBS FOR TARGET
						<Tip text="(Fixed + target profit) ÷ contribution per job." />
					</div>
					<div class="mono-num text-2xl">{be.targetJobs ?? '—'}</div>
					<div class="text-sm">/ month</div>
				</div>
				<div>
					<div class="pixel-font flex items-center text-[9px]">
						PROJECTED NET / MO
						<Tip text="Jobs per month × contribution per job − fixed / month." />
					</div>
					<div class="mono-num text-2xl" style="color: {tone(be.projectedNet)};">{fmtMoney(be.projectedNet)}</div>
				</div>
				<div>
					<div class="pixel-font flex items-center text-[9px]">
						PAYBACK
						<Tip text="One-time costs ÷ projected net per month. 'never' when net is not positive." />
					</div>
					<div class="mono-num text-2xl">
						{#if fixed.oneTimeTotal === 0}—{:else if be.paybackMonths === null}never{:else}{fmtRatio(be.paybackMonths, 1)} mo{/if}
					</div>
				</div>
				<div>
					<div class="pixel-font text-[9px]">CASH-POSITIVE MONTH</div>
					<div class="mono-num text-2xl">{beMonth === null ? '—' : `M${beMonth}`}</div>
					<div class="text-sm">in 12-mo projection</div>
				</div>
			</div>
		</section>

		<section class="pixel-panel p-4">
			<h3 class="mb-3 flex items-center text-[11px]" style="color: var(--accent-dark);">
				12-MONTH PROJECTION
				<Tip text="Jobs compound by the monthly growth rate. Cumulative starts at −(one-time costs); the first non-negative month is highlighted." />
			</h3>
			<div class="overflow-x-auto">
				<table class="pixel-table">
					<thead>
						<tr><th>Mo</th><th>Jobs</th><th>Revenue</th><th>Materials</th><th>Labor</th><th>Fixed</th><th>Net</th><th>Cumulative</th></tr>
					</thead>
					<tbody>
						{#each rows as r (r.month)}
							<tr style={r.month === beMonth ? 'background: rgba(56,183,100,0.25);' : ''}>
								<td class="mono-num">{r.month}</td>
								<td class="mono-num">{fmtRatio(r.jobs, 1)}</td>
								<td class="mono-num" style="color: var(--green);">{fmtMoney(r.revenue)}</td>
								<td class="mono-num">{fmtMoney(r.variableCost)}</td>
								<td class="mono-num">{fmtMoney(r.labor)}</td>
								<td class="mono-num">{fmtMoney(r.fixed)}</td>
								<td class="mono-num" style="color: {tone(r.net)};">{fmtMoney(r.net)}</td>
								<td class="mono-num" style="color: {tone(r.cumulative)};">{fmtMoney(r.cumulative)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	</div>
</div>
