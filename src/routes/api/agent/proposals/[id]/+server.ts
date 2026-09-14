import type { WriteAction } from '$lib/server/agent/actions';
import { executeProposal } from '$lib/server/agent/executor';
import { agentCatalog, appendMessage, getMessage, imageForProposal, setProposalStatus } from '$lib/server/agent/store';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	const message = getMessage(Number(params.id));
	if (!message?.proposal_json) throw error(404, 'Proposal not found');
	if (message.proposal_status !== 'pending') throw error(409, `Proposal is already ${message.proposal_status}`);

	const { decision } = (await request.json().catch(() => ({}))) as { decision?: string };
	if (decision !== 'confirm' && decision !== 'reject') throw error(400, 'decision must be "confirm" or "reject"');

	const action = JSON.parse(message.proposal_json) as WriteAction;

	if (decision === 'reject') {
		const updated = setProposalStatus(message.id, 'rejected', null);
		const note = appendMessage(message.conversation_id, {
			role: 'result',
			content: `[action_result] The owner REJECTED the proposed ${action.type}. Nothing was saved.`
		});
		return json({ proposal: updated, messages: [note] });
	}

	try {
		const result = executeProposal(action, imageForProposal(message));
		const updated = setProposalStatus(message.id, 'confirmed', result);
		const extras = [
			result.created_products?.length ? `New products: ${result.created_products.join(', ')}.` : '',
			result.created_vendors?.length ? `New vendors: ${result.created_vendors.join(', ')}.` : ''
		]
			.filter(Boolean)
			.join(' ');
		const note = appendMessage(message.conversation_id, {
			role: 'result',
			content: `[action_result] The owner CONFIRMED the ${action.type}. ${result.summary}. ${extras}`.trim()
		});
		return json({ proposal: updated, messages: [note], catalog: agentCatalog() });
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		const updated = setProposalStatus(message.id, 'failed', { error: msg });
		const note = appendMessage(message.conversation_id, {
			role: 'result',
			content: `[action_error] The ${action.type} was confirmed but FAILED to save: ${msg}. Nothing was changed. Propose a corrected version if possible.`
		});
		return json({ proposal: updated, messages: [note] }, { status: 422 });
	}
};
