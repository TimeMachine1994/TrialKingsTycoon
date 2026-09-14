<script lang="ts">
	import { enhance } from '$app/forms';
	import ProductForm from '$lib/components/ProductForm.svelte';
	import ReceiptForm from '$lib/components/ReceiptForm.svelte';
	import Sprite from '$lib/components/Sprite.svelte';
	import { fmtMoney } from '$lib/money';

	let { data, form } = $props();

	let showForm = $state(false);
	let showVendorForm = $state(false);
	let showProductForm = $state(false);
	let receiptForm = $state<ReturnType<typeof ReceiptForm>>();

	$effect(() => {
		if (typeof form?.newProductId === 'number') showProductForm = false;
	});
</script>

<svelte:head><title>Receipts · Print Kings Tycoon</title></svelte:head>

<div class="mb-4 flex flex-wrap items-center justify-between gap-2">
	<h2 class="text-sm" style="color: var(--paper);">RECEIPTS (PURCHASES IN)</h2>
	<div class="flex gap-2">
		<button class="pixel-btn small" onclick={() => (showVendorForm = !showVendorForm)}>+ VENDOR</button>
		<button
			class="pixel-btn green"
			onclick={() => {
				showForm = !showForm;
				if (showForm) queueMicrotask(() => receiptForm?.addLine());
			}}
		>
			<Sprite name="receipt" size={24} />
			{showForm ? 'CLOSE' : 'NEW RECEIPT'}
		</button>
	</div>
</div>

{#if form?.error}
	<div class="pixel-panel mb-4 p-3" style="background: var(--red); color: white;">{form.error}</div>
{/if}

{#if showVendorForm}
	<form method="POST" action="?/addVendor" class="pixel-panel mb-4 flex flex-wrap items-end gap-3 p-4" use:enhance={() => ({ update }) => { showVendorForm = false; update(); }}>
		<label>Vendor name <input name="name" class="pixel-input" required placeholder="Amazon" /></label>
		<label>Website <input name="url" class="pixel-input" placeholder="https://..." /></label>
		<button class="pixel-btn small green" type="submit">SAVE VENDOR</button>
	</form>
{/if}

{#if showForm}
	{#if showProductForm}
		<div class="pixel-panel mb-4 p-4" style="border-color: var(--accent);">
			<h4 class="pixel-font mb-2 text-[10px]" style="color: var(--accent-dark);">
				QUICK-ADD PRODUCT (your receipt lines below are safe)
			</h4>
			<ProductForm action="?/addProduct" />
			<button type="button" class="pixel-btn small mt-2" onclick={() => (showProductForm = false)}>CANCEL</button>
		</div>
	{/if}

	<div class="pixel-panel mb-6 p-4">
		<h3 class="mb-3 text-[11px]">NEW RECEIPT</h3>
		<ReceiptForm
			bind:this={receiptForm}
			action="?/post"
			vendors={data.vendors}
			products={data.products}
			conversions={data.conversions}
			defaultTaxRate={data.defaultTaxRate}
			newProductId={typeof form?.newProductId === 'number' ? form.newProductId : 0}
			onNewProduct={() => (showProductForm = !showProductForm)}
			onsaved={() => (showForm = false)}
		/>
	</div>
{/if}

<div class="pixel-panel p-4">
	{#if data.receipts.length === 0}
		<p>No receipts yet. Post your first purchase!</p>
	{:else}
		<table class="pixel-table">
			<thead>
				<tr><th>Date</th><th>Vendor</th><th>Ref #</th><th>Lines</th><th>Total</th><th></th></tr>
			</thead>
			<tbody>
				{#each data.receipts as r (r.id)}
					<tr style={r.voided_at ? 'opacity: 0.55; text-decoration: line-through;' : ''}>
						<td class="mono-num">{r.purchased_at}</td>
						<td>
							{r.vendor_name}
							{#if r.voided_at}
								<span class="pixel-badge" style="background: var(--red); color: white; text-decoration: none;">VOID</span>
							{/if}
						</td>
						<td class="mono-num">{r.ref_number ?? '—'}</td>
						<td class="mono-num">{r.line_count}</td>
						<td class="mono-num">{fmtMoney(r.total)}</td>
						<td><a href="/receipts/{r.id}" class="pixel-btn small" style="text-decoration: none;">VIEW</a></td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>
