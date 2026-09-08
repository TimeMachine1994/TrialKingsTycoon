<script lang="ts">
	import type { AgentCatalog, AgentMessage } from '$lib/agent-client';
	import ProposalCard from './ProposalCard.svelte';

	let {
		message,
		catalog,
		busy = false,
		ondecide
	}: {
		message: AgentMessage;
		catalog: AgentCatalog;
		busy?: boolean;
		ondecide: (id: number, decision: 'confirm' | 'reject') => void;
	} = $props();

	let showResult = $state(false);

	/** Compact label for a stored [action_result]/[action_error] row. */
	const resultLabel = $derived.by(() => {
		const firstLine = message.content.split('\n')[0];
		return firstLine.replace(/^\[action_(result|error)\]\s*/, (_m, kind) => (kind === 'error' ? 'error: ' : '')).slice(0, 120);
	});
	const isError = $derived(message.content.startsWith('[action_error]'));
</script>

{#if message.role === 'user'}
	<div class="flex justify-end">
		<div class="max-w-[85%] rounded-none border-3 px-3 py-2 text-sm" style="background: var(--accent); color: var(--paper); border-color: var(--ink);">
			{#if message.image_name}
				<img src="/api/agent/uploads/{message.image_name}" alt="attached" class="mb-2 max-h-48 border-2" style="border-color: var(--ink);" />
			{/if}
			{#if message.content}<div class="whitespace-pre-wrap">{message.content}</div>{/if}
		</div>
	</div>
{:else if message.role === 'assistant'}
	<div class="flex flex-col gap-2">
		{#if message.content}
			<div class="max-w-[92%] border-3 px-3 py-2 text-sm whitespace-pre-wrap" style="background: var(--panel); border-color: var(--ink);">
				{message.content}
			</div>
		{/if}
		{#if message.proposal_json}
			<div class="max-w-[95%]">
				<ProposalCard {message} {catalog} {busy} ondecide={(d) => ondecide(message.id, d)} />
			</div>
		{/if}
	</div>
{:else}
	<button
		type="button"
		class="self-start text-left text-[11px] opacity-70 hover:opacity-100"
		style="color: {isError ? 'var(--red)' : 'var(--paper)'};"
		onclick={() => (showResult = !showResult)}
		title="Click to expand"
	>
		▸ {resultLabel}
	</button>
	{#if showResult}
		<pre class="max-h-60 overflow-auto border-2 p-2 text-[10px] whitespace-pre-wrap" style="background: var(--panel); border-color: var(--paper-dark);">{message.content}</pre>
	{/if}
{/if}
