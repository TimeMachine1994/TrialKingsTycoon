<script lang="ts">
	import { enhance } from '$app/forms';
	import Sprite from '$lib/components/Sprite.svelte';
	import Tip from '$lib/components/Tip.svelte';
	import { fmtMoney } from '$lib/money';
	import { fmtPct } from '$lib/ratios';

	let { data, form } = $props();

	let compareIds = $state<number[]>([]);

	const compareHref = $derived(`/planner/compare?ids=${compareIds.join(',')}`);
	const actualVarRate = $derived(
		data.actuals.sales > 0 ? (data.actuals.used + data.actuals.waste) / data.actuals.sales : null
	);

	function confirmDelete(e: SubmitEvent) {
		if (!confirm('Delete this scenario and all its cost lines?')) e.preventDefault();
	}
</script>

<svelte:head><title>Planner · Print Kings Tycoon</title></svelte:head>

<h2 class="mb-4 text-sm" style="color: var(--paper);">PLANNER — BREAK-EVEN &amp; OVERHEAD SCENARIOS</h2>

{#if form?.error}
	<div class="pixel-panel mb-4 p-3" style="background: var(--red); color: white;">{form.error}</div>
{/if}

<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
	<section class="pixel-panel p-4">
		<h3 class="mb-3 flex items-center gap-2 text-[11px]" style="color: var(--accent-dark);">
			<Sprite name="chart" size={24} /> NEW SCENARIO
		</h3>
		<form method="POST" action="?/create" class="grid gap-3" use:enhance>
			<label>Name <input name="name" class="pixel-input" placeholder="Lease the Oviedo unit" required /></label>
			<label>Notes <input name="notes" class="pixel-input" placeholder="optional" /></label>
			<button class="pixel-btn green" type="submit">CREATE</button>
		</form>
		<p class="mt-3 text-sm">
			New scenarios start from your actuals: {fmtPct(actualVarRate)} materials,
			{fmtMoney(data.actuals.jobCount > 0 ? Math.round(data.actuals.sales / data.actuals.jobCount) : 0)} avg job,
			{data.actuals.jobCount} job{data.actuals.jobCount === 1 ? '' : 's'} over {data.actuals.months} month{data.actuals.months === 1 ? '' : 's'}.
		</p>
	</section>

	<section class="pixel-panel p-4 lg:col-span-2">
		<h3 class="mb-3 flex items-center gap-2 text-[11px]" style="color: var(--accent-dark);">
			<Sprite name="coin" size={24} /> SCENARIOS
			<Tip text="The ACTIVE scenario's overhead and labor feed the Net columns on the Reports page." />
		</h3>
		{#if data.scenarios.length === 0}
			<p>No scenarios yet. Create one to start exploring.</p>
		{:else}
			<table class="pixel-table">
				<thead>
					<tr><th></th><th>Scenario</th><th>Fixed / mo</th><th>Break-even jobs</th><th>Net / mo</th><th></th></tr>
				</thead>
				<tbody>
					{#each data.scenarios as s (s.id)}
						<tr>
							<td><input type="checkbox" value={s.id} bind:group={compareIds} aria-label="Compare {s.name}" /></td>
							<td>
								<a href="/planner/{s.id}" class="underline">{s.name}</a>
								{#if s.is_active}<span class="pixel-badge ml-2" style="background: var(--green);">ACTIVE</span>{/if}
								{#if s.notes}<div class="text-sm">{s.notes}</div>{/if}
							</td>
							<td class="mono-num">{fmtMoney(s.fixedMonthly)}</td>
							<td class="mono-num">{s.be.breakEvenJobs ?? '—'}</td>
							<td class="mono-num" style="color: {s.be.projectedNet >= 0 ? 'var(--green)' : 'var(--red)'};">{fmtMoney(s.be.projectedNet)}</td>
							<td>
								<div class="flex flex-wrap gap-1">
									{#if !s.is_active}
										<form method="POST" action="?/setActive" use:enhance>
											<input type="hidden" name="id" value={s.id} />
											<button class="pixel-btn small blue" type="submit">ACTIVATE</button>
										</form>
									{/if}
									<form method="POST" action="?/duplicate" use:enhance>
										<input type="hidden" name="id" value={s.id} />
										<button class="pixel-btn small" type="submit">COPY</button>
									</form>
									{#if !s.is_active}
										<form method="POST" action="?/delete" use:enhance onsubmit={confirmDelete}>
											<input type="hidden" name="id" value={s.id} />
											<button class="pixel-btn small red" type="submit">X</button>
										</form>
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<div class="mt-3 flex items-center gap-3">
				<a
					href={compareIds.length >= 1 ? compareHref : undefined}
					class="pixel-btn small {compareIds.length >= 1 ? 'blue' : ''}"
					aria-disabled={compareIds.length < 1}
				>
					COMPARE SELECTED ({compareIds.length})
				</a>
				<span class="text-sm">Tick up to 4 scenarios.</span>
			</div>
		{/if}
	</section>
</div>
