<script lang="ts">
	import { enhance } from '$app/forms';
	import Sprite from '$lib/components/Sprite.svelte';
	import { fmtMoney } from '$lib/money';

	let { data, form } = $props();

	let showForm = $state(false);
</script>

<svelte:head><title>Vendors · Print Kings Tycoon</title></svelte:head>

<div class="mb-4 flex items-center justify-between">
	<h2 class="text-sm" style="color: var(--paper);">VENDORS</h2>
	<button class="pixel-btn green" onclick={() => (showForm = !showForm)}>
		<Sprite name="truck" size={24} />
		{showForm ? 'CLOSE' : 'NEW VENDOR'}
	</button>
</div>

{#if form?.error}
	<div class="pixel-panel mb-4 p-3" style="background: var(--red); color: white;">{form.error}</div>
{/if}

{#if showForm}
	<form method="POST" action="?/create" class="pixel-panel mb-6 flex flex-wrap items-end gap-3 p-4" use:enhance={() => ({ update }) => { showForm = false; update(); }}>
		<label>Name* <input name="name" class="pixel-input" required /></label>
		<label>Website <input name="url" class="pixel-input" placeholder="https://..." /></label>
		<label>Notes <input name="notes" class="pixel-input" /></label>
		<button class="pixel-btn green small" type="submit">SAVE</button>
	</form>
{/if}

<div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
	{#each data.vendors as v (v.id)}
		<div class="pixel-panel p-4">
			<div class="flex items-center gap-3">
				<Sprite name="truck" size={40} />
				<div>
					<div class="pixel-font text-[10px]" style="color: var(--accent-dark);">{v.name}</div>
					{#if v.url}
						<a href={v.url} target="_blank" rel="noopener" class="text-sm underline" style="color: var(--accent);">
							{v.url} ↗
						</a>
					{/if}
				</div>
			</div>
			<div class="mt-3 text-lg">
				<div>Receipts: <span class="mono-num">{v.receipt_count}</span></div>
				<div>Total spent: <span class="mono-num">{fmtMoney(v.total_spent)}</span></div>
			</div>
		</div>
	{/each}
</div>

<div class="pixel-panel p-4">
	<h3 class="mb-3 text-[11px]" style="color: var(--accent-dark);">RECENT PURCHASES (ALL VENDORS)</h3>
	{#if data.receipts.length === 0}
		<p>Nothing purchased yet.</p>
	{:else}
		<table class="pixel-table">
			<thead>
				<tr><th>Date</th><th>Vendor</th><th>Ref #</th><th>Total</th><th></th></tr>
			</thead>
			<tbody>
				{#each data.receipts as r (r.id)}
					<tr>
						<td class="mono-num">{r.purchased_at}</td>
						<td>{r.vendor_name}</td>
						<td class="mono-num">{r.ref_number ?? '—'}</td>
						<td class="mono-num">{fmtMoney(r.total)}</td>
						<td><a href="/receipts/{r.id}" class="pixel-btn small">VIEW</a></td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>
