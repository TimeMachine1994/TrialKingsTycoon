<script lang="ts">
	import Sprite from '$lib/components/Sprite.svelte';
	import Tip from '$lib/components/Tip.svelte';
	import { fmtMoney, fmtUnitCost } from '$lib/money';
	import { fmtPct, fmtRatio, monthsOfSupply, ratioConfidence, wastePct } from '$lib/ratios';

	let { data } = $props();

	const totalValue = $derived(data.valuation.reduce((a, v) => a + v.value, 0));
	const eff = $derived(data.efficiency);
	const confidence = $derived(ratioConfidence(eff.dataMonths));
	const warn = $derived(confidence !== 'ok');
	const caveat = $derived(
		warn
			? ` Based on ${eff.dataMonths} month${eff.dataMonths === 1 ? '' : 's'} of job data — treat as directional until 3+.`
			: ` Based on ${eff.dataMonths} months of job data.`
	);
	const usageMonths = $derived(Math.max(eff.dataMonths, 1));
	const oh = $derived(data.overhead);
	const tone = (v: number) => (v >= 0 ? 'var(--green)' : 'var(--red)');
</script>

<svelte:head><title>Reports · Print Kings Tycoon</title></svelte:head>

<h2 class="mb-4 text-sm" style="color: var(--paper);">REPORTS — SALES, COGS &amp; MARGINS</h2>

<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
	<section class="pixel-panel p-4 lg:col-span-2">
		<h3 class="mb-3 flex flex-wrap items-center gap-2 text-[11px]" style="color: var(--accent-dark);">
			<Sprite name="coin" size={24} /> MONTHLY P&amp;L
			{#if oh}
				<a href="/planner/{oh.id}" class="pixel-badge" style="background: var(--green);">OVERHEAD FROM: {oh.name.toUpperCase()}</a>
			{/if}
		</h3>
		{#if data.periods.length === 0}
			<p>No jobs recorded yet.</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="pixel-table">
					<thead>
						<tr>
							<th>Month</th><th>Jobs</th><th>Sales</th><th>COGS (used)</th><th>Waste</th><th>Gross</th><th>Gross %</th>
							{#if oh}
								<th>Labor <Tip text={`Jobs × ${fmtMoney(oh.laborPerJob)} labor per job from the active scenario.`} /></th>
								<th>Overhead <Tip text="Active scenario's fixed cost per month. The current month is prorated by days elapsed." /></th>
								<th>Net</th>
							{/if}
						</tr>
					</thead>
					<tbody>
						{#each data.periods as p (p.period)}
							{@const margin = p.sales - p.cogs - p.waste}
							{@const net = margin - p.labor - p.overhead}
							<tr>
								<td class="mono-num">{p.period}</td>
								<td class="mono-num">{p.job_count}</td>
								<td class="mono-num" style="color: var(--green);">{fmtMoney(p.sales)}</td>
								<td class="mono-num">{fmtMoney(p.cogs)}</td>
								<td class="mono-num" style="color: var(--red);">{fmtMoney(p.waste)}</td>
								<td class="mono-num" style="color: {tone(margin)};">{fmtMoney(margin)}</td>
								<td class="mono-num">{fmtPct(p.sales > 0 ? margin / p.sales : null)}</td>
								{#if oh}
									<td class="mono-num">{fmtMoney(p.labor)}</td>
									<td class="mono-num">{fmtMoney(p.overhead)}</td>
									<td class="mono-num" style="color: {tone(net)};">{fmtMoney(net)}</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			{#if !oh}
				<p class="mt-2 text-sm">Mark a scenario active in <a href="/planner" class="underline">Planner</a> to see net after overhead.</p>
			{/if}
		{/if}
	</section>

	<section class="pixel-panel p-4 lg:col-span-2">
		<h3 class="mb-3 flex items-center gap-2 text-[11px]" style="color: var(--accent-dark);">
			<Sprite name="invoice" size={24} /> MARGIN ANALYSIS
			<Tip text="Gross = revenue − materials used − waste. Labor and overhead are excluded here; see the Planner for those." />
		</h3>
		{#if data.marginJobs.length === 0}
			<p>No jobs recorded yet.</p>
		{:else}
			<h4 class="pixel-font mb-2 text-[9px]">BY CLIENT</h4>
			<table class="pixel-table mb-4">
				<thead>
					<tr><th>Client</th><th>Jobs</th><th>Sales</th><th>Materials</th><th>Waste</th><th>Gross</th><th>Gross %</th></tr>
				</thead>
				<tbody>
					{#each data.marginClients as c (c.client)}
						<tr>
							<td>{c.client}</td>
							<td class="mono-num">{c.job_count}</td>
							<td class="mono-num" style="color: var(--green);">{fmtMoney(c.sales)}</td>
							<td class="mono-num">{fmtMoney(c.used)}</td>
							<td class="mono-num" style="color: var(--red);">{fmtMoney(c.waste)}</td>
							<td class="mono-num" style="color: {tone(c.gross)};">{fmtMoney(c.gross)}</td>
							<td class="mono-num">{fmtPct(c.sales > 0 ? c.gross / c.sales : null)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<h4 class="pixel-font mb-2 text-[9px]">BY JOB</h4>
			<div class="overflow-x-auto">
				<table class="pixel-table">
					<thead>
						<tr><th>Date</th><th>Job</th><th>Client</th><th>Sales</th><th>Materials</th><th>Waste</th><th>Gross</th><th>Gross %</th></tr>
					</thead>
					<tbody>
						{#each data.marginJobs as j (j.id)}
							<tr>
								<td class="mono-num">{j.job_date}</td>
								<td>
									<a href="/jobs/{j.id}" class="underline">{j.name}</a>
									{#if j.invoice_number}<div class="text-sm">INV {j.invoice_number}</div>{/if}
								</td>
								<td class="text-sm">{j.client ?? '—'}</td>
								<td class="mono-num" style="color: var(--green);">{fmtMoney(j.sales)}</td>
								<td class="mono-num">{fmtMoney(j.used)}</td>
								<td class="mono-num" style="color: var(--red);">{fmtMoney(j.waste)}</td>
								<td class="mono-num" style="color: {tone(j.gross)};">{fmtMoney(j.gross)}</td>
								<td class="mono-num">{fmtPct(j.sales > 0 ? j.gross / j.sales : null)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>

	<section class="pixel-panel p-4 lg:col-span-2">
		<h3 class="mb-3 flex items-center gap-2 text-[11px]" style="color: var(--accent-dark);">
			<Sprite name="coin" size={24} /> EFFICIENCY
			{#if warn}
				<span class="pixel-badge" style="background: var(--red); color: var(--paper);">
					{eff.dataMonths} MO OF DATA
				</span>
			{/if}
		</h3>
		<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
			<div>
				<div class="pixel-font flex items-center text-[9px]">
					TURNOVER / MO
					<Tip {warn} text={'Materials COGS per month ÷ average month-end inventory value. Higher = less cash parked on the shelf.' + caveat} />
				</div>
				<div class="mono-num text-2xl">{fmtRatio(eff.turnoverPerMonth, 2, 'x')}</div>
				<div class="text-sm">{eff.turnoverPerMonth === null ? '' : `≈ ${fmtRatio(eff.turnoverPerMonth * 12, 1, 'x')} / yr`}</div>
			</div>
			<div>
				<div class="pixel-font flex items-center text-[9px]">
					DAYS OF STOCK
					<Tip {warn} text={'30 ÷ monthly turnover: how many days the average inventory would last at the current consumption rate.' + caveat} />
				</div>
				<div class="mono-num text-2xl">{fmtRatio(eff.daysInventory, 0)}</div>
			</div>
			<div>
				<div class="pixel-font flex items-center text-[9px]">
					WASTE RATE
					<Tip text={'Waste cost ÷ (used + waste cost), all time. The share of consumed material that never became billable product.'} />
				</div>
				<div class="mono-num text-2xl" style="color: {eff.wastePct !== null && eff.wastePct > 0.05 ? 'var(--red)' : 'var(--ink)'};">
					{fmtPct(eff.wastePct)}
				</div>
			</div>
			<div>
				<div class="pixel-font flex items-center text-[9px]">
					AVG INVENTORY
					<Tip {warn} text={`Mean of month-end inventory values rebuilt from the stock ledger (qty × cost at movement time) over ${eff.periods} month${eff.periods === 1 ? '' : 's'}. Approximates weighted-average revaluation.` + caveat} />
				</div>
				<div class="mono-num text-2xl">{fmtMoney(eff.avgInventory)}</div>
			</div>
		</div>
	</section>

	<section class="pixel-panel p-4">
		<h3 class="mb-3 flex items-center gap-2 text-[11px]" style="color: var(--red);">
			<Sprite name="trash" size={24} /> WASTE BY PRODUCT
		</h3>
		{#if data.waste.length === 0}
			<p>No waste recorded. Impressive!</p>
		{:else}
			<table class="pixel-table">
				<thead>
					<tr>
						<th>Product</th><th>Qty wasted</th><th>Cost</th>
						<th>Waste % <Tip text="Wasted qty ÷ (used + wasted qty) for this product." /></th>
						<th>Reasons</th>
					</tr>
				</thead>
				<tbody>
					{#each data.waste as w (w.product_id)}
						<tr>
							<td><a href="/products/{w.product_id}" class="underline">{w.product_name}</a></td>
							<td class="mono-num">{w.qty.toLocaleString()} {w.base_unit}</td>
							<td class="mono-num" style="color: var(--red);">{fmtMoney(w.cost)}</td>
							<td class="mono-num">{fmtPct(wastePct(w.qty, w.used_qty))}</td>
							<td class="text-sm">{w.reasons ?? '—'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>

	<section class="pixel-panel p-4">
		<h3 class="mb-3 flex items-center gap-2 text-[11px]" style="color: var(--accent-dark);">
			<Sprite name="ream" size={24} /> INVENTORY VALUATION
		</h3>
		<table class="pixel-table">
			<thead>
				<tr>
					<th>Product</th><th>On hand</th><th>Avg cost</th><th>Value</th>
					<th>Supply <Tip {warn} text={'Months of supply: on hand ÷ average monthly consumption (used + waste).' + caveat} /></th>
				</tr>
			</thead>
			<tbody>
				{#each data.valuation as v (v.id)}
					{@const supply = monthsOfSupply(v.qty_on_hand, v.used_all_time / usageMonths)}
					<tr>
						<td><a href="/products/{v.id}" class="underline">{v.name}</a></td>
						<td class="mono-num">{v.qty_on_hand.toLocaleString()} {v.base_unit}</td>
						<td class="mono-num">{fmtUnitCost(v.avg_cost)}</td>
						<td class="mono-num">{fmtMoney(v.value)}</td>
						<td class="mono-num">{supply === null ? '—' : `${fmtRatio(supply, 1)} mo`}</td>
					</tr>
				{/each}
				<tr>
					<td class="pixel-font text-[10px]" colspan="3">TOTAL</td>
					<td class="mono-num" style="color: var(--green);">{fmtMoney(totalValue)}</td>
					<td></td>
				</tr>
			</tbody>
		</table>
	</section>
</div>
