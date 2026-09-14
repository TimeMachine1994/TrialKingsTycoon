import type { AgentMessage } from '$lib/server/db';
import { describeProposal, isWriteAction, parseActions, type ReadAction, type WriteAction } from './actions';
import { chatCompletion } from './llm';
import { buildSystemPrompt } from './prompt';
import { runReadAction } from './readers';
import { appendMessage, listMessages, toLlmMessages } from './store';

const MAX_ITERATIONS = 5;

/**
 * Runs one user turn: persists the user message, then alternates between
 * calling the model and executing read actions until the model produces a
 * final answer or a write proposal. Returns every row created this turn.
 */
export async function runTurn(conversationId: number, text: string, imageName: string | null): Promise<AgentMessage[]> {
	const created: AgentMessage[] = [];
	const push = (m: AgentMessage) => (created.push(m), m);

	push(appendMessage(conversationId, { role: 'user', content: text, image_name: imageName }));

	const system = buildSystemPrompt();

	try {
		for (let i = 0; i < MAX_ITERATIONS; i++) {
			const history = toLlmMessages(listMessages(conversationId));
			const reply = await chatCompletion([{ role: 'system', content: system }, ...history]);
			const parsed = parseActions(reply);

			const reads = parsed.actions.filter((a): a is ReadAction => !isWriteAction(a));
			const writes = parsed.actions.filter((a): a is WriteAction => isWriteAction(a));
			const proposal = writes[0] ?? null;

			push(
				appendMessage(conversationId, {
					role: 'assistant',
					content: parsed.display || (proposal ? describeProposal(proposal) : ''),
					raw: reply,
					proposal_json: proposal ? JSON.stringify(proposal) : null
				})
			);

			const feedback: string[] = [];
			for (const err of parsed.errors) feedback.push(`[action_error] ${err}`);
			if (writes.length > 1) {
				feedback.push(`[action_error] Only one write action per reply is allowed; kept the first (${proposal!.type}) and ignored ${writes.length - 1} other(s).`);
			}
			for (const a of reads) {
				let result: unknown;
				try {
					result = runReadAction(a);
				} catch (e) {
					result = { error: e instanceof Error ? e.message : String(e) };
				}
				feedback.push(`[action_result] ${a.type}\n${JSON.stringify(result)}`);
			}

			for (const f of feedback) push(appendMessage(conversationId, { role: 'result', content: f }));

			// A proposal ends the turn (the user must confirm); so does a reply with nothing to feed back.
			if (proposal || feedback.length === 0) break;
			if (i === MAX_ITERATIONS - 1) {
				push(appendMessage(conversationId, { role: 'assistant', content: 'I ran out of steps for this request. Ask me to continue if you want more.' }));
			}
		}
	} catch (e) {
		push(appendMessage(conversationId, { role: 'assistant', content: `⚠ Agent error: ${e instanceof Error ? e.message : String(e)}` }));
	}

	return created;
}
