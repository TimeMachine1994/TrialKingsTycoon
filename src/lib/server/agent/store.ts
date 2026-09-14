import { db, type AgentConversation, type AgentMessage, type AgentRole, type ProposalStatus } from '$lib/server/db';
import type { ChatMessage } from './llm';
import { uploadDataUrl } from './uploads';

export interface AgentCatalog {
	products: Array<{ id: number; name: string; base_unit: string }>;
	vendors: Array<{ id: number; name: string }>;
}

/** Names for ids so the client can render proposal cards without extra requests. */
export function agentCatalog(): AgentCatalog {
	return {
		products: db.prepare('SELECT id, name, base_unit FROM products ORDER BY name').all() as AgentCatalog['products'],
		vendors: db.prepare('SELECT id, name FROM vendors ORDER BY name').all() as AgentCatalog['vendors']
	};
}

export function getActiveConversation(): AgentConversation {
	const row = db.prepare('SELECT * FROM agent_conversations ORDER BY id DESC LIMIT 1').get() as
		| AgentConversation
		| undefined;
	return row ?? newConversation();
}

export function newConversation(): AgentConversation {
	const id = db.prepare('INSERT INTO agent_conversations (title) VALUES (NULL)').run().lastInsertRowid as number;
	return db.prepare('SELECT * FROM agent_conversations WHERE id = ?').get(id) as AgentConversation;
}

export function listMessages(conversationId: number): AgentMessage[] {
	return db
		.prepare('SELECT * FROM agent_messages WHERE conversation_id = ? ORDER BY id')
		.all(conversationId) as AgentMessage[];
}

export function getMessage(id: number): AgentMessage | undefined {
	return db.prepare('SELECT * FROM agent_messages WHERE id = ?').get(id) as AgentMessage | undefined;
}

/**
 * Image attached to the user message that triggered the given assistant
 * message (i.e. the latest user row before it). Null if that turn had no image,
 * so a photo from an earlier turn is never attached to a later receipt.
 */
export function imageForProposal(proposal: AgentMessage): string | null {
	const row = db
		.prepare(
			`SELECT image_name FROM agent_messages
			 WHERE conversation_id = ? AND id < ? AND role = 'user'
			 ORDER BY id DESC LIMIT 1`
		)
		.get(proposal.conversation_id, proposal.id) as { image_name: string | null } | undefined;
	return row?.image_name ?? null;
}

export interface NewMessage {
	role: AgentRole;
	content: string;
	raw?: string | null;
	image_name?: string | null;
	proposal_json?: string | null;
}

export function appendMessage(conversationId: number, m: NewMessage): AgentMessage {
	const id = db
		.prepare(
			`INSERT INTO agent_messages (conversation_id, role, content, raw, image_name, proposal_json, proposal_status)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			conversationId,
			m.role,
			m.content,
			m.raw ?? null,
			m.image_name ?? null,
			m.proposal_json ?? null,
			m.proposal_json ? 'pending' : null
		).lastInsertRowid as number;
	db.prepare(`UPDATE agent_conversations SET updated_at = datetime('now') WHERE id = ?`).run(conversationId);
	return getMessage(id)!;
}

export function setProposalStatus(id: number, status: ProposalStatus, result: unknown): AgentMessage {
	db.prepare('UPDATE agent_messages SET proposal_status = ?, proposal_result = ? WHERE id = ?').run(
		status,
		result === undefined ? null : JSON.stringify(result),
		id
	);
	return getMessage(id)!;
}

/**
 * Converts stored rows into the OpenAI message array. Only the image on the
 * most recent user message is sent as pixels; earlier images are replayed as a
 * text placeholder to keep request payloads small.
 */
export function toLlmMessages(rows: AgentMessage[]): ChatMessage[] {
	const lastUserWithImage = [...rows].reverse().find((r) => r.role === 'user' && r.image_name);
	const out: ChatMessage[] = [];
	for (const r of rows) {
		if (r.role === 'assistant') {
			out.push({ role: 'assistant', content: r.raw ?? r.content });
		} else if (r.role === 'result') {
			out.push({ role: 'user', content: r.content });
		} else if (r.image_name) {
			const dataUrl = r.id === lastUserWithImage?.id ? uploadDataUrl(r.image_name) : null;
			const text = r.content || 'Here is a receipt photo.';
			out.push(
				dataUrl
					? {
							role: 'user',
							content: [
								{ type: 'text', text },
								{ type: 'image_url', image_url: { url: dataUrl, detail: 'high' } }
							]
						}
					: { role: 'user', content: `${text}\n[image attached earlier]` }
			);
		} else {
			out.push({ role: 'user', content: r.content });
		}
	}
	return out;
}
