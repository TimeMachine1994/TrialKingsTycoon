<script lang="ts">
	import { enhance } from '$app/forms';
	import ReceiptForm from '$lib/components/ReceiptForm.svelte';
	import Sprite from '$lib/components/Sprite.svelte';
	import { fmtMoney, fmtRate, fmtUnitCost } from '$lib/money';

	let { data, form } = $props();

	let confirmingVoid = $state(false);
	let editing = $state(false);
</script>

<svelte:head><title>Receipt #{data.receipt.id} · Print Kings Tycoon</title></svelte:head>

{#if form?.error}
	<div class="pixel-panel mb-4 p-3" style="background: var(--red); color: white;">{form.error}</div>
{/if}

<div class="pixel-panel p-4">
	<div class="mb-4 flex flex-wrap items-center gap-4">
		<Sprite name="receipt" size={48} />
		<div>
			<h2 class="text-[13px]" style="color: var(--accent-dark);">
				RECEIPT #{data.receipt.id} — {data.vendor.name}
			</h2>
			<div class="mt-1 flex flex-wrap gap-2">
				{#if data.receipt.voided_at}
					<span class="pixel-badge" style="background: var(--red); color: white;">VOIDED {data.receipt.voided_at.slice(0, 10)}</span>
				{/if}
				<span class="pixel-badge" style="background: var(--paper-dark);">{data.receipt.purchased_at}</span>
				{#if data.receipt.ref_number}
					<span class="pixel-badge">REF: {data.receipt.ref_number}</span>
				{/if}
				{#if data.vendor.url}
					<a href={data.vendor.url} target="_blank" rel="noopener" class="pixel-badge underline" style="background: var(--cyan); color: white;">
						VENDOR SITE ↗
					</a>
				{/if}
			</div>
		</div>
		<div class="ml-auto flex items-center gap-2">
			{#if !data.receipt.voided_at}
				<button class="pixel-btn small blue" onclick={() => (editing = !editing)}>{editing ? 'CANCEL EDIT' : 'EDIT'}</button>
				{#if confirmingVoid}
					<form method="POST" action="?/void" use:enhance={() => ({ update }) => { confirmingVoid = false; update(); }}>
						<button class="pixel-btn small red" type="submit">CONFIRM: REVERSE STOCK &amp; COSTS</button>
					</form>
					<button class="pixel-btn small" onclick={() => (confirmingVoid = false)}>KEEP</button>
				{:else}
					<button class="pixel-btn small red" onclick={() => (confirmingVoid = true)}>VOID</button>
				{/if}
			{/if}
			<a href="/receipts" class="pixel-btn small">← BACK</a>
		</div>
	</div>

	{#if editing}
		{#key data.receipt}
			<ReceiptForm
				action="?/edit"
				vendors={data.vendors}
				products={data.products}
				conversions={data.conversions}
				receipt={data.receipt}
				existingLines={data.lines}
				submitLabel="SAVE CHANGES"
				allowFiles={false}
				onsaved={() => (editing = false)}
			/>
		{/key}
	{:else}
	<table class="pixel-table">
		<thead>
			<tr><th>Product</th><th>Qty</th><th>Base units</th><th>Line cost*</th><th>Per base unit</th></tr>
		</thead>
		<tbody>
			{#each data.lines as l (l.id)}
				<tr>
					<td><a href="/products/{l.product_id}" class="underline">{l.product_name}</a></td>
					<td class="mono-num">{l.qty_purchased.toLocaleString()} × {l.unit_name}</td>
					<td class="mono-num">{l.qty_base.toLocaleString()} {l.base_unit}</td>
					<td class="mono-num">{fmtMoney(l.line_cost)}</td>
					<td class="mono-num">{fmtUnitCost(l.unit_cost_base)}</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
		<div><div class="pixel-font text-[9px]">SUBTOTAL</div><div class="mono-num text-xl">{fmtMoney(data.receipt.subtotal)}</div></div>
		<div>
			<div class="pixel-font text-[9px]">TAX{data.receipt.tax_rate !== null ? ` (${fmtRate(data.receipt.tax_rate)}%)` : ''}</div>
			<div class="mono-num text-xl">{fmtMoney(data.receipt.tax)}</div>
		</div>
		<div><div class="pixel-font text-[9px]">SHIPPING</div><div class="mono-num text-xl">{fmtMoney(data.receipt.shipping)}</div></div>
		<div><div class="pixel-font text-[9px]">TOTAL</div><div class="mono-num text-xl" style="color: var(--green);">{fmtMoney(data.receipt.total)}</div></div>
	</div>

	{#if data.receipt.allocate_extras && data.receipt.tax + data.receipt.shipping > 0}
		<p class="mt-3 text-sm">* Line costs include allocated tax &amp; shipping.</p>
	{/if}
	{#if data.receipt.notes}<p class="mt-2">Notes: {data.receipt.notes}</p>{/if}
	{/if}
</div>

<div class="pixel-panel mt-6 p-4">
	<h3 class="mb-3 text-[11px]" style="color: var(--accent-dark);">ATTACHMENTS</h3>

	{#if data.attachments.length === 0}
		<p class="mb-3">No files attached yet.</p>
	{:else}
		<div class="mb-4 flex flex-wrap gap-4">
			{#each data.attachments as a (a.id)}
				<div class="border-4 p-2" style="border-color: var(--ink); background: var(--paper);">
					<a href="/attachments/{a.id}" target="_blank" rel="noopener" title={a.original_name}>
						{#if a.mime.startsWith('image/')}
							<img
								src="/attachments/{a.id}"
								alt={a.original_name}
								class="block h-32 w-32 object-cover"
								style="image-rendering: auto;"
							/>
						{:else}
							<span class="flex h-32 w-32 flex-col items-center justify-center gap-2">
								<Sprite name="invoice" size={48} />
								<span class="pixel-font text-[8px]">OPEN PDF ↗</span>
							</span>
						{/if}
					</a>
					<div class="mt-1 flex items-center justify-between gap-2">
						<span class="max-w-24 truncate text-sm" title={a.original_name}>{a.original_name}</span>
						<form method="POST" action="?/deleteAttachment" use:enhance>
							<input type="hidden" name="attachment_id" value={a.id} />
							<button class="pixel-btn small red" type="submit" title="Delete file">X</button>
						</form>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<form method="POST" action="?/attach" enctype="multipart/form-data" class="flex flex-wrap items-end gap-3" use:enhance>
		<label class="min-w-64">
			Add files (images / PDF)
			<input
				type="file"
				name="files"
				multiple
				required
				accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
				class="pixel-input"
			/>
		</label>
		<button class="pixel-btn small green" type="submit">ATTACH</button>
	</form>
</div>
