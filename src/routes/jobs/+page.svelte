<script lang="ts">
	import { enhance } from '$app/forms';
	import Sprite from '$lib/components/Sprite.svelte';
	import { fmtMoney } from '$lib/money';

	let { data, form } = $props();

	let showForm = $state(false);
	const today = new Date().toISOString().slice(0, 10);
</script>

<svelte:head><title>Jobs · Print Kings Tycoon</title></svelte:head>

<div class="mb-4 flex items-center justify-between">
	<h2 class="text-sm" style="color: var(--paper);">JOBS (SALES OUT)</h2>
	<button class="pixel-btn green" onclick={() => (showForm = !showForm)}>
		<Sprite name="binder" size={24} />
		{showForm ? 'CLOSE' : 'NEW JOB'}
	</button>
</div>

{#if form?.error}
	<div class="pixel-panel mb-4 p-3" style="background: var(--red); color: white;">{form.error}</div>
{/if}

{#if showForm}
	<form method="POST" action="?/create" class="pixel-panel mb-6 p-4" use:enhance>
		<h3 class="mb-3 text-[11px]">NEW JOB</h3>
		<div class="grid grid-cols-1 gap-3 md:grid-cols-3">
			<label>Job name* <input name="name" class="pixel-input" required placeholder="Smith trial binders x4" /></label>
			<label>Client <input name="client" class="pixel-input" /></label>
			<label>Invoice # <input name="invoice_number" class="pixel-input" /></label>
			<label>Invoiced amount ($) <input name="invoiced_amount" class="pixel-input" placeholder="450.00" /></label>
			<label>Date <input name="job_date" type="date" class="pixel-input" value={today} /></label>
			<label>Notes <input name="notes" class="pixel-input" /></label>
		</div>
		<button class="pixel-btn green mt-4" type="submit">CREATE &amp; ADD MATERIALS →</button>
	</form>
{/if}

<div class="pixel-panel p-4">
	{#if data.jobs.length === 0}
		<p>No jobs yet. Create one and start tracking materials &amp; waste.</p>
	{:else}
		<table class="pixel-table">
			<thead>
				<tr><th>Date</th><th>Job</th><th>Client</th><th>Invoiced</th><th>Materials</th><th>Waste</th><th>Profit</th><th>Status</th><th></th></tr>
			</thead>
			<tbody>
				{#each data.jobs as j (j.id)}
					{@const profit = j.invoiced_amount - j.used_cost - j.waste_cost}
					<tr>
						<td class="mono-num">{j.job_date}</td>
						<td>{j.name}</td>
						<td>{j.client ?? '—'}</td>
						<td class="mono-num">{fmtMoney(j.invoiced_amount)}</td>
						<td class="mono-num">{fmtMoney(j.used_cost)}</td>
						<td class="mono-num" style="color: var(--red);">{fmtMoney(j.waste_cost)}</td>
						<td class="mono-num" style="color: {profit >= 0 ? 'var(--green)' : 'var(--red)'};">{fmtMoney(profit)}</td>
						<td>
							<span class="pixel-badge" style="background: {j.status === 'open' ? 'var(--gold)' : 'var(--green)'};">
								{j.status.toUpperCase()}
							</span>
						</td>
						<td><a href="/jobs/{j.id}" class="pixel-btn small">OPEN</a></td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>
