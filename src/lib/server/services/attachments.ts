import { db, type Attachment } from '$lib/server/db';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const ATTACHMENTS_DIR = path.resolve('data', 'attachments');
fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });

export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

const ALLOWED_MIME: Record<string, string> = {
	'image/jpeg': '.jpg',
	'image/png': '.png',
	'image/webp': '.webp',
	'image/gif': '.gif',
	'application/pdf': '.pdf'
};

export function isAllowedMime(mime: string): boolean {
	return mime in ALLOWED_MIME;
}

/** Persists an uploaded File to disk and records it against a receipt. */
export async function saveAttachment(receiptId: number, file: File): Promise<Attachment> {
	if (!isAllowedMime(file.type)) {
		throw new Error(`Unsupported file type: ${file.type || 'unknown'} (images & PDFs only)`);
	}
	if (file.size <= 0) throw new Error('File is empty');
	if (file.size > MAX_ATTACHMENT_BYTES) {
		throw new Error(`File too large (max ${MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB)`);
	}

	const storedName = `${crypto.randomUUID()}${ALLOWED_MIME[file.type]}`;
	const buffer = Buffer.from(await file.arrayBuffer());
	fs.writeFileSync(path.join(ATTACHMENTS_DIR, storedName), buffer);

	const id = db
		.prepare(
			`INSERT INTO attachments (receipt_id, original_name, stored_name, mime, size)
			 VALUES (?, ?, ?, ?, ?)`
		)
		.run(receiptId, file.name || storedName, storedName, file.type, file.size)
		.lastInsertRowid as number;

	return db.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as Attachment;
}

export function getAttachment(id: number): Attachment | undefined {
	return db.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as Attachment | undefined;
}

export function listAttachments(receiptId: number): Attachment[] {
	return db
		.prepare('SELECT * FROM attachments WHERE receipt_id = ? ORDER BY id')
		.all(receiptId) as Attachment[];
}

export function deleteAttachment(id: number): void {
	const attachment = getAttachment(id);
	if (!attachment) return;
	db.prepare('DELETE FROM attachments WHERE id = ?').run(id);
	const filePath = path.join(ATTACHMENTS_DIR, attachment.stored_name);
	if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

export function attachmentPath(attachment: Attachment): string {
	return path.join(ATTACHMENTS_DIR, attachment.stored_name);
}
