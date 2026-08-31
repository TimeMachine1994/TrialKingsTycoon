<script lang="ts">
	import Sprite from '$lib/components/Sprite.svelte';
	import { fmtMoney, fmtUnitCost } from '$lib/money';

	let { data } = $props();
</script>

<svelte:head><title>Receipt #{data.receipt.id} · Print Kings Tycoon</title></svelte:head>

<div class="pixel-panel p-4">
	<div class="mb-4 flex flex-wrap items-center gap-4">
		<Sprite name="receipt" size={48} />
		<div>
			<h2 class="text-[13px]" style="color: var(--accent-dark);">
				RECEIPT #{data.receipt.id} — {data.vendor.name}
			</h2>
			<div class="mt-1 flex flex-wrap gap-2">
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
		<a href="/receipts" class="pixel-btn small ml-auto">← BACK</a>
	</div>

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
		<div><div class="pixel-font text-[9px]">TAX</div><div class="mono-num text-xl">{fmtMoney(data.receipt.tax)}</div></div>
		<div><div class="pixel-font text-[9px]">SHIPPING</div><div class="mono-num text-xl">{fmtMoney(data.receipt.shipping)}</div></div>
		<div><div class="pixel-font text-[9px]">TOTAL</div><div class="mono-num text-xl" style="color: var(--green);">{fmtMoney(data.receipt.total)}</div></div>
	</div>

	{#if data.receipt.allocate_extras && data.receipt.tax + data.receipt.shipping > 0}
		<p class="mt-3 text-sm">* Line costs include allocated tax &amp; shipping.</p>
	{/if}
	{#if data.receipt.notes}<p class="mt-2">Notes: {data.receipt.notes}</p>{/if}
</div>
