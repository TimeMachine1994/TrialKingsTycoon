<script lang="ts">
	import type { AgentCatalog, AgentMessage } from '$lib/agent-client';
	import type { MaterialSpec, ProductRef, VendorRef, WriteAction } from '$lib/server/agent/actions';
	import { fmtMoney, parseMoney, parseRate, taxFromRate } from '$lib/money';

	let {
		message,
		catalog,
		busy = false,
		ondecide
	}: {
		message: AgentMessage;
		catalog: AgentCatalog;
		busy?: boolean;
		ondecide: (decision: 'confirm' | 'reject') => void;
	} = $props();

	const action = $derived(JSON.parse(message.proposal_json ?? '{}') as WriteAction);
	const status = $derived(message.proposal_status ?? 'pending');
	const result = $derived(message.proposal_result ? (JSON.parse(message.proposal_result) as Record<string, unknown>) : null);

	function productName(ref: ProductRef): { name: string; isNew: boolean } {
		if ('id' in ref) {
			return { name: catalog.products.find((p) => p.id === ref.id)?.name ?? `product #${ref.id}`, isNew: false };
		}
		return { name: ref.new.name, isNew: true };
	}

	function vendorName(ref: VendorRef): { name: string; isNew: boolean } {
		if ('id' in ref) {
			return { name: catalog.vendors.find((v) => v.id === ref.id)?.name ?? `vendor #${ref.id}`, isNew: false };
		}
		return { name: ref.new.name, isNew: true };
	}

	function safeMoney(v: string | undefined): number {
		try {
			return parseMoney(v || '0');
		} catch {
			return 0;
		}
	}

	const receiptTotals = $derived.by(() => {
		if (action.type !== 'post_receipt') return null;
		const subtotal = action.lines.reduce((s, l) => s + safeMoney(l.line_cost), 0);
		let tax = 0;
		try {
			tax = action.tax_rate !== undefined ? taxFromRate(subtotal, parseRate(action.tax_rate)) : safeMoney(action.tax);
		} catch {
			tax = 0;
		}
		const shipping = safeMoney(action.shipping);
		return { subtotal, tax, shipping, total: subtotal + tax + shipping };
	});

	function materialLabel(m: MaterialSpec): string {
		const ref = m.product;
		const unit = m.unit_name ?? (('id' in ref && catalog.products.find((p) => p.id === ref.id)?.base_unit) || 'units');
		return `${m.qty} ${unit}${m.base_units_per && m.base_units_per > 1 ? ` (x${m.base_units_per})` : ''}`;
	}

	const title = $derived(
		{
			post_receipt: 'POST RECEIPT',
			create_job: 'CREATE JOB',
			add_job_materials: 'ADD JOB MATERIALS',
			update_job: 'UPDATE JOB',
			create_product: 'CREATE PRODUCT',
			create_vendor: 'CREATE VENDOR'
		}[action.type] ?? 'PROPOSAL'
	);

	const statusColor: Record<string, string> = {
		pending: 'var(--gold)',
		confirmed: 'var(--green)',
		rejected: 'var(--paper-dark)',
		failed: 'var(--red)'
	};

	const link = $derived.by(() => {
		if (!result) return null;
		if (typeof result.receipt_id === 'number') return { href: `/receipts/${result.receipt_id}`, label: `VIEW RECEIPT #${result.receipt_id}` };
		if (typeof result.job_id === 'number') return { href: `/jobs/${result.job_id}`, label: `VIEW JOB #${result.job_id}` };
		if (typeof result.product_id === 'number') return { href: `/products/${result.product_id}`, label: `VIEW PRODUCT` };
		if (typeof result.vendor_id === 'number') return { href: `/vendors`, label: `VIEW VENDORS` };
		return null;
	});
</script>

{#snippet badge(isNew: boolean)}
	{#if isNew}<span class="pixel-badge ml-1" style="background: var(--magenta); color: white;">NEW</span>{/if}
{/snippet}

<div class="pixel-panel p-3 text-sm" style="border-color: {statusColor[status]};">
	<div class="mb-2 flex items-center justify-between gap-2">
		<span class="pixel-font text-[9px]" style="color: var(--accent-dark);">{title}</span>
		<span class="pixel-badge" style="background: {statusColor[status]}; {status === 'failed' ? 'color: white;' : ''}">{status.toUpperCase()}</span>
	</div>

	{#if action.type === 'post_receipt'}
		{@const v = vendorName(action.vendor)}
		<div class="mb-2">
			<strong>{v.name}</strong>{@render badge(v.isNew)}
			<span class="mono-num"> · {action.purchased_at}</span>
			{#if action.ref_number}<span class="mono-num"> · ref {action.ref_number}</span>{/if}
		</div>
		<table class="w-full text-xs">
			<tbody>
				{#each action.lines as line, i (i)}
					{@const p = productName(line.product)}
					<tr style="border-bottom: 1px dashed var(--paper-dark);">
						<td class="py-1 pr-2">{p.name}{@render badge(p.isNew)}</td>
						<td class="mono-num py-1 pr-2 whitespace-nowrap">{line.qty_purchased} {line.unit_name}{line.base_units_per > 1 ? ` (x${line.base_units_per})` : ''}</td>
						<td class="mono-num py-1 text-right whitespace-nowrap">{fmtMoney(safeMoney(line.line_cost))}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		{#if receiptTotals}
			<div class="mono-num mt-2 grid grid-cols-2 gap-x-3 text-xs">
				<span>Subtotal</span><span class="text-right">{fmtMoney(receiptTotals.subtotal)}</span>
				<span>Tax{action.tax_rate !== undefined ? ` (${action.tax_rate}%)` : ''}</span><span class="text-right">{fmtMoney(receiptTotals.tax)}</span>
				<span>Shipping</span><span class="text-right">{fmtMoney(receiptTotals.shipping)}</span>
				<span class="font-bold">Total</span><span class="text-right font-bold" style="color: var(--green);">{fmtMoney(receiptTotals.total)}</span>
			</div>
			<div class="mt-1 text-[11px] opacity-70">
				{action.allocate_extras === false ? 'Tax + shipping kept separate from item costs.' : 'Tax + shipping folded into item costs.'}
			</div>
		{/if}
		{#if action.notes}<div class="mt-1 text-xs italic">{action.notes}</div>{/if}

	{:else if action.type === 'create_job'}
		<div><strong>{action.name}</strong> <span class="mono-num">· {action.job_date}</span></div>
		<div class="text-xs">
			{#if action.client}Client: {action.client} · {/if}
			{#if action.invoice_number}Invoice #{action.invoice_number} · {/if}
			Invoiced: <span class="mono-num">{fmtMoney(safeMoney(action.invoiced_amount))}</span>
		</div>
		{#if action.materials?.length}
			<ul class="mt-2 text-xs">
				{#each action.materials as m, i (i)}
					{@const p = productName(m.product)}
					<li>
						<span class="pixel-badge" style="background: {m.kind === 'waste' ? 'var(--red)' : 'var(--cyan)'}; color: white;">{m.kind.toUpperCase()}</span>
						{materialLabel(m)} {p.name}{@render badge(p.isNew)}{m.waste_reason ? ` — ${m.waste_reason}` : ''}
					</li>
				{/each}
			</ul>
		{/if}
		{#if action.notes}<div class="mt-1 text-xs italic">{action.notes}</div>{/if}

	{:else if action.type === 'add_job_materials'}
		<div>Job <span class="mono-num">#{action.job_id}</span></div>
		<ul class="mt-2 text-xs">
			{#each action.materials as m, i (i)}
				{@const p = productName(m.product)}
				<li>
					<span class="pixel-badge" style="background: {m.kind === 'waste' ? 'var(--red)' : 'var(--cyan)'}; color: white;">{m.kind.toUpperCase()}</span>
					{materialLabel(m)} {p.name}{@render badge(p.isNew)}{m.waste_reason ? ` — ${m.waste_reason}` : ''}
				</li>
			{/each}
		</ul>

	{:else if action.type === 'update_job'}
		<div>Job <span class="mono-num">#{action.job_id}</span></div>
		<ul class="mt-1 text-xs">
			{#if action.client !== undefined}<li>Client → {action.client}</li>{/if}
			{#if action.invoice_number !== undefined}<li>Invoice # → {action.invoice_number}</li>{/if}
			{#if action.invoiced_amount !== undefined}<li>Invoiced → <span class="mono-num">{fmtMoney(safeMoney(action.invoiced_amount))}</span></li>{/if}
			{#if action.status}<li>Status → {action.status}</li>{/if}
		</ul>

	{:else if action.type === 'create_product'}
		<div><strong>{action.name}</strong> <span class="text-xs">[{action.category ?? 'other'}]</span></div>
		<div class="text-xs">
			Base unit: {action.base_unit || 'each'}
			{#if action.conv_name}· {action.conv_name} = {action.conv_per} {action.base_unit || 'each'}{/if}
			{#if action.sku}· SKU {action.sku}{/if}
			{#if action.reorder_point !== undefined}· reorder at {action.reorder_point}{/if}
		</div>

	{:else if action.type === 'create_vendor'}
		<div><strong>{action.name}</strong>{#if action.url} <span class="text-xs">· {action.url}</span>{/if}</div>
	{/if}

	{#if status === 'pending'}
		<div class="mt-3 flex gap-2">
			<button type="button" class="pixel-btn small green" disabled={busy} onclick={() => ondecide('confirm')}>CONFIRM</button>
			<button type="button" class="pixel-btn small red" disabled={busy} onclick={() => ondecide('reject')}>REJECT</button>
		</div>
	{:else if status === 'confirmed' && result}
		<div class="mt-2 text-xs">
			{String(result.summary ?? '')}
			{#if result.attachment_saved} · photo attached{/if}
			{#if link}<a href={link.href} class="pixel-btn small ml-2" style="text-decoration: none;">{link.label}</a>{/if}
		</div>
	{:else if status === 'failed' && result}
		<div class="mt-2 text-xs" style="color: var(--red);">Failed: {String(result.error ?? 'unknown error')}</div>
	{/if}
</div>
