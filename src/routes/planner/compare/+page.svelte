<script lang="ts">
	import Sprite from '$lib/components/Sprite.svelte';
	import Tip from '$lib/components/Tip.svelte';
	import { fmtMoney, RATE_SCALE } from '$lib/money';
	import { fmtPct, fmtRatio } from '$lib/ratios';

	let { data } = $props();

	type Col = (typeof data.columns)[number];
	type Best = 'high' | 'low' | 'none';
	interface Metric {
		label: string;
		tip?: string;
		best: Best;
		value: (c: Col) => number | null;
		fmt: (v: number | null) => string;
		actual?: number | null;
	}

	const a = $derived(data.actuals);
	const actualVarRate = $derived(a.sales > 0 ? (a.used + a.waste) / a.sales : null);
	const actualAvgJob = $derived(a.jobCount > 0 ? Math.round(a.sales / a.jobCount) : null);
	const actualJobsMo = $derived(a.months > 0 ? a.jobCount / a.months : null);
	const actualSalesMo = $derived(a.months > 0 ? Math.round(a.sales / a.months) : null);

	const money = (v: number | null) => (v === null ? '—' : fmtMoney(v));
	const count = (v: number | null) => (v === null ? '—' : fmtRatio(v, 1));
	const months = (v: number | null) => (v === null ? 'never' : v === 0 ? '—' : `${fmtRatio(v, 1)} mo`);

	const metrics = $derived<Metric[]>([
		{ label: 'Fixed / month', best: 'low', value: (c) => c.inputs.fixedMonthly, fmt: money },
		{ label: 'One-time costs', best: 'low', value: (c) => c.inputs.oneTimeTotal, fmt: money },
		{ label: 'Materials % of revenue', best: 'low', value: (c) => c.inputs.variableCostRate / (100 * RATE_SCALE), fmt: fmtPct, actual: actualVarRate },
		{ label: 'Avg job value', best: 'high', value: (c) => c.inputs.avgJobValue, fmt: money, actual: actualAvgJob },
		{ label: 'Labor / job', best: 'low', value: (c) => c.be.laborPerJob, fmt: money },
		{ label: 'Contribution / job', best: 'high', value: (c) => c.be.contributionPerJob, fmt: money },
		{ label: 'Contribution %', best: 'high', value: (c) => c.be.contributionRate, fmt: fmtPct },
		{ label: 'Break-even revenue / mo', best: 'low', value: (c) => c.be.breakEvenRevenue, fmt: money, actual: actualSalesMo, tip: 'Actuals column shows average monthly sales to date.' },
		{ label: 'Break-even jobs / mo', best: 'low', value: (c) => c.be.breakEvenJobs, fmt: count, actual: actualJobsMo, tip: 'Actuals column shows average jobs per month to date.' },
		{ label: 'Assumed jobs / mo', best: 'none', value: (c) => c.inputs.jobsPerMonth, fmt: count, actual: actualJobsMo },
		{ label: 'Projected net / mo', best: 'high', value: (c) => c.be.projectedNet, fmt: money },
		{ label: 'Payback', best: 'low', value: (c) => c.be.paybackMonths, fmt: months, tip: 'One-time costs ÷ projected net. "never" when net is not positive.' },
		{ label: '12-mo cumulative', best: 'high', value: (c) => c.cumulative12, fmt: money }
	]);

	function bestIndex(m: Metric): number {
		if (m.best === 'none') return -1;
		let idx = -1;
		let bestVal: number | null = null;
		data.columns.forEach((c, i) => {
			const v = m.value(c);
			if (v === null) return;
			if (bestVal === null || (m.best === 'high' ? v > bestVal : v < bestVal)) {
				bestVal = v;
				idx = i;
			}
		});
		return data.columns.length > 1 ? idx : -1;
	}

	const tone = (v: number | null) => (v === null ? 'inherit' : v >= 0 ? 'var(--green)' : 'var(--red)');
</script>

<svelte:head><title>Compare · Planner</title></svelte:head>

<h2 class="mb-4 text-sm" style="color: var(--paper);">PLANNER — COMPARE SCENARIOS</h2>

<div class="pixel-panel mb-6 p-4">
	<form method="GET" class="flex flex-wrap items-center gap-3">
		<span class="pixel-font text-[9px]">PICK UP TO 4:</span>
		{#each data.all as s (s.id)}
			<label class="flex items-center gap-1">
				<input type="checkbox" name="pick" value={s.id} checked={data.ids.includes(s.id)} />
				{s.name}
			</label>
		{/each}
		<button
			class="pixel-btn small blue"
			type="submit"
			onclick={(e) => {
				e.preventDefault();
				const f = e.currentTarget.form!;
				const picked = [...f.querySelectorAll<HTMLInputElement>('input[name=pick]:checked')].map((i) => i.value).slice(0, 4);
				location.search = `?ids=${picked.join(',')}`;
			}}
		>
			COMPARE
		</button>
		<a href="/planner" class="pixel-btn small">← ALL SCENARIOS</a>
	</form>
</div>

{#if data.columns.length === 0}
	<div class="pixel-panel p-4"><p>Select at least one scenario above.</p></div>
{:else}
	<section class="pixel-panel p-4">
		<h3 class="mb-3 flex items-center gap-2 text-[11px]" style="color: var(--accent-dark);">
			<Sprite name="chart" size={24} /> SIDE BY SIDE
			<Tip text="Best value per row is highlighted green (lowest for costs, highest for contribution and net). The ACTUALS column is all-time averages from recorded jobs." />
		</h3>
		<div class="overflow-x-auto">
			<table class="pixel-table">
				<thead>
					<tr>
						<th>Metric</th>
						{#each data.columns as c (c.id)}
							<th>
								<a href="/planner/{c.id}" class="underline">{c.name}</a>
								{#if c.is_active}<span class="pixel-badge ml-1" style="background: var(--green); color: var(--ink);">ACTIVE</span>{/if}
							</th>
						{/each}
						<th style="color: var(--paper);">ACTUALS</th>
					</tr>
				</thead>
				<tbody>
					{#each metrics as m (m.label)}
						{@const best = bestIndex(m)}
						<tr>
							<td>
								{m.label}
								{#if m.tip}<Tip text={m.tip} />{/if}
							</td>
							{#each data.columns as c, i (c.id)}
								{@const v = m.value(c)}
								<td class="mono-num" style="{i === best ? 'background: rgba(56,183,100,0.25);' : ''} {m.label.startsWith('Projected') || m.label.startsWith('12-mo') || m.label.startsWith('Contribution /') ? `color: ${tone(v)};` : ''}">
									{m.fmt(v)}
								</td>
							{/each}
							<td class="mono-num" style="color: var(--accent-dark);">{m.actual === undefined ? '—' : m.fmt(m.actual)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
{/if}
