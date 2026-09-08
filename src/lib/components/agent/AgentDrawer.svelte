<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import {
		decideProposal,
		downscaleImage,
		loadHistory,
		sendMessage,
		startNewChat,
		type AgentCatalog,
		type AgentMessage as AgentMessageRow
	} from '$lib/agent-client';
	import Sprite from '$lib/components/Sprite.svelte';
	import { tick } from 'svelte';
	import AgentMessage from './AgentMessage.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	let messages = $state<AgentMessageRow[]>([]);
	let catalog = $state<AgentCatalog>({ products: [], vendors: [] });
	let loaded = $state(false);
	let busy = $state(false);
	let error = $state<string | null>(null);
	let text = $state('');
	let image = $state<File | null>(null);
	let imagePreview = $state<string | null>(null);
	let dragging = $state(false);
	let listEl = $state<HTMLDivElement>();
	let fileInput = $state<HTMLInputElement>();

	$effect(() => {
		if (open && !loaded) void refresh();
	});

	async function scrollToBottom() {
		await tick();
		listEl?.scrollTo({ top: listEl.scrollHeight });
	}

	async function refresh() {
		try {
			const s = await loadHistory();
			messages = s.messages;
			catalog = s.catalog;
			loaded = true;
			error = null;
			await scrollToBottom();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}

	async function newChat() {
		if (busy) return;
		busy = true;
		try {
			const s = await startNewChat();
			messages = s.messages;
			catalog = s.catalog;
			error = null;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}

	async function setImage(file: File | null) {
		if (imagePreview) URL.revokeObjectURL(imagePreview);
		if (!file) {
			image = null;
			imagePreview = null;
			return;
		}
		if (!file.type.startsWith('image/')) {
			error = 'Only images can be sent to the assistant. Attach PDFs through the receipt form.';
			return;
		}
		image = await downscaleImage(file);
		imagePreview = URL.createObjectURL(image);
		error = null;
	}

	async function send() {
		const t = text.trim();
		if (busy || (!t && !image)) return;
		busy = true;
		error = null;
		const outgoingText = t;
		const outgoingImage = image;
		text = '';
		await setImage(null);
		try {
			const s = await sendMessage(outgoingText, outgoingImage);
			messages = [...messages, ...s.messages];
			catalog = s.catalog;
			await scrollToBottom();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			text = outgoingText;
		} finally {
			busy = false;
		}
	}

	async function decide(id: number, decision: 'confirm' | 'reject') {
		if (busy) return;
		busy = true;
		error = null;
		try {
			const r = await decideProposal(id, decision);
			messages = messages.map((m) => (m.id === r.proposal.id ? r.proposal : m)).concat(r.messages);
			if (r.catalog) catalog = r.catalog;
			if (decision === 'confirm' && r.proposal.proposal_status === 'confirmed') await invalidateAll();
			await scrollToBottom();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			void send();
		}
	}

	function onPaste(e: ClipboardEvent) {
		const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'));
		if (file) {
			e.preventDefault();
			void setImage(file);
		}
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		const file = e.dataTransfer?.files?.[0];
		if (file) void setImage(file);
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && open && (open = false)} />

{#if open}
	<div
		class="fixed inset-y-0 right-0 z-50 flex w-full flex-col md:w-[440px]"
		style="background: var(--ink); border-left: 4px solid var(--gold); box-shadow: -6px 0 0 0 rgba(0,0,0,0.35);"
		role="dialog"
		aria-label="HQ Assistant"
		tabindex="-1"
		ondragover={(e) => {
			e.preventDefault();
			dragging = true;
		}}
		ondragleave={() => (dragging = false)}
		ondrop={onDrop}
	>
		<div class="flex items-center gap-2 p-3" style="border-bottom: 4px solid var(--gold);">
			<Sprite name="invoice" size={28} />
			<h2 class="text-[11px]" style="color: var(--gold);">HQ ASSISTANT</h2>
			<span class="flex-1"></span>
			<button type="button" class="pixel-btn small" onclick={newChat} disabled={busy}>NEW CHAT</button>
			<button type="button" class="pixel-btn small red" onclick={() => (open = false)}>X</button>
		</div>

		<div bind:this={listEl} class="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
			{#if !loaded && !error}
				<p class="text-xs" style="color: var(--paper);">Loading…</p>
			{:else if messages.length === 0}
				<div class="border-3 p-3 text-xs" style="background: var(--panel); border-color: var(--paper-dark);">
					<p class="mb-2"><strong>Try:</strong></p>
					<ul class="list-disc pl-4">
						<li>Drop a receipt photo and say “Staples, 2 reams of the 3-hole paper and a toner.”</li>
						<li>“Create a job for Acme, invoice 1042 for $350, used 200 sheets of letter paper.”</li>
						<li>“What’s low on stock?” · “Show margin by client.” · “Receipts from Amazon this month?”</li>
					</ul>
					<p class="mt-2 opacity-70">Anything that changes data shows a preview you confirm first.</p>
				</div>
			{/if}
			{#each messages as m (m.id)}
				<AgentMessage message={m} {catalog} {busy} ondecide={decide} />
			{/each}
			{#if busy}
				<div class="pixel-font text-[9px]" style="color: var(--gold);">THINKING<span class="blink">…</span></div>
			{/if}
		</div>

		{#if error}
			<div class="mx-3 mb-2 p-2 text-xs" style="background: var(--red); color: white;">{error}</div>
		{/if}

		<div class="p-3" style="border-top: 4px solid var(--gold); {dragging ? 'outline: 3px dashed var(--cyan);' : ''}">
			{#if imagePreview}
				<div class="mb-2 flex items-center gap-2">
					<img src={imagePreview} alt="to send" class="max-h-20 border-2" style="border-color: var(--paper);" />
					<button type="button" class="pixel-btn small red" onclick={() => setImage(null)}>REMOVE</button>
				</div>
			{/if}
			<div class="flex items-end gap-2">
				<input
					bind:this={fileInput}
					type="file"
					accept="image/jpeg,image/png,image/webp,image/gif"
					class="hidden"
					onchange={(e) => setImage((e.currentTarget as HTMLInputElement).files?.[0] ?? null)}
				/>
				<button type="button" class="pixel-btn small" title="Attach a receipt photo" onclick={() => fileInput?.click()} disabled={busy}>
					<Sprite name="receipt" size={18} />
				</button>
				<textarea
					class="pixel-input flex-1 resize-none"
					rows="2"
					placeholder="Describe a purchase, a job, or ask a question…"
					bind:value={text}
					onkeydown={onKeydown}
					onpaste={onPaste}
					disabled={busy}
				></textarea>
				<button type="button" class="pixel-btn small green" onclick={send} disabled={busy || (!text.trim() && !image)}>SEND</button>
			</div>
			<div class="mt-1 text-[10px]" style="color: var(--paper-dark);">Enter to send · Shift+Enter for a new line · paste or drop an image</div>
		</div>
	</div>
{/if}

<style>
	.blink {
		animation: blink 1s steps(2, start) infinite;
	}
	@keyframes blink {
		to {
			visibility: hidden;
		}
	}
</style>
