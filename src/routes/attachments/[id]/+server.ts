import { attachmentPath, getAttachment } from '$lib/server/services/attachments';
import { error } from '@sveltejs/kit';
import fs from 'node:fs';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params }) => {
	const attachment = getAttachment(Number(params.id));
	if (!attachment) throw error(404, 'Attachment not found');

	const filePath = attachmentPath(attachment);
	if (!fs.existsSync(filePath)) throw error(404, 'File missing from disk');

	const body = fs.readFileSync(filePath);
	return new Response(new Uint8Array(body), {
		headers: {
			'Content-Type': attachment.mime,
			'Content-Length': String(attachment.size),
			'Content-Disposition': `inline; filename="${attachment.original_name.replace(/"/g, '')}"`,
			'Cache-Control': 'private, max-age=31536000'
		}
	});
};
