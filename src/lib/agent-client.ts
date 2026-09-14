import type { AgentConversation, AgentMessage } from '$lib/server/db';
import type { AgentCatalog } from '$lib/server/agent/store';

export type { AgentCatalog, AgentConversation, AgentMessage };

export interface AgentState {
	conversation: AgentConversation;
	messages: AgentMessage[];
	catalog: AgentCatalog;
}

export interface ProposalResponse {
	proposal: AgentMessage;
	messages: AgentMessage[];
	catalog?: AgentCatalog;
}

async function parse<T>(res: Response): Promise<T> {
	const body = await res.json().catch(() => null);
	if (!res.ok) {
		const msg = (body && (body.message ?? body.error)) || `${res.status} ${res.statusText}`;
		throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
	}
	return body as T;
}

export function loadHistory(): Promise<AgentState> {
	return fetch('/api/agent/history').then((r) => parse<AgentState>(r));
}

export function startNewChat(): Promise<AgentState> {
	return fetch('/api/agent/history', { method: 'POST' }).then((r) => parse<AgentState>(r));
}

export function sendMessage(text: string, image: File | null): Promise<AgentState> {
	const form = new FormData();
	form.set('text', text);
	if (image) form.set('image', image, image.name);
	return fetch('/api/agent/chat', { method: 'POST', body: form }).then((r) => parse<AgentState>(r));
}

export async function decideProposal(id: number, decision: 'confirm' | 'reject'): Promise<ProposalResponse> {
	const res = await fetch(`/api/agent/proposals/${id}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ decision })
	});
	// 422 = executed-but-failed; the body still carries the updated proposal.
	if (res.status === 422) return (await res.json()) as ProposalResponse;
	return parse<ProposalResponse>(res);
}

/**
 * Shrinks a photo so its longest edge is <= maxEdge and re-encodes as JPEG.
 * Keeps the LLM payload small; the same file becomes the receipt attachment.
 */
export async function downscaleImage(file: File, maxEdge = 1600, quality = 0.85): Promise<File> {
	if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
	const bitmap = await createImageBitmap(file).catch(() => null);
	if (!bitmap) return file;
	const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
	if (scale === 1 && file.size < 1_500_000) {
		bitmap.close();
		return file;
	}
	const canvas = document.createElement('canvas');
	canvas.width = Math.round(bitmap.width * scale);
	canvas.height = Math.round(bitmap.height * scale);
	canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	bitmap.close();
	const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
	if (!blob) return file;
	const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
	return new File([blob], name, { type: 'image/jpeg' });
}
