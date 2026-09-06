import type {
	CorsairWebhookMatcher,
	RawWebhookRequest,
	WebhookRequest,
} from 'corsair/core';
import * as crypto from 'crypto';
import { z } from 'zod';

export const UploadcareWebhookPayloadSchema = z
	.object({
		event: z.string().optional(),
		hook: z.record(z.string(), z.json()).optional(),
		data: z.record(z.string(), z.json()),
	})
	.loose();

export type UploadcareWebhookPayload = z.infer<
	typeof UploadcareWebhookPayloadSchema
>;

export const FileUploadedEventSchema = z
	.object({
		event: z.literal('file.uploaded').optional(),
		hook: z
			.object({
				event: z.string().optional(),
				project: z.union([z.number(), z.string()]).optional(),
				id: z.number().optional(),
			})
			.loose()
			.optional(),
		data: z
			.object({
				uuid: z.string(),
				original_filename: z.string().optional().nullable(),
			})
			.loose(),
		file: z.string().optional(),
	})
	.loose()
	.refine(
		(payload) =>
			payload.event === 'file.uploaded' ||
			payload.hook?.event === 'file.uploaded',
		{ message: 'expected file.uploaded event' },
	);

export type FileUploadedEvent = z.infer<typeof FileUploadedEventSchema>;

export type UploadcareWebhookOutputs = {
	fileUploaded: FileUploadedEvent;
};

function parseBody(body: unknown): Record<string, unknown> | null {
	if (typeof body === 'string') {
		try {
			const parsed = JSON.parse(body);
			return parsed !== null &&
				typeof parsed === 'object' &&
				!Array.isArray(parsed)
				? (parsed as Record<string, unknown>)
				: null;
		} catch {
			return null;
		}
	}
	return body !== null && typeof body === 'object' && !Array.isArray(body)
		? (body as Record<string, unknown>)
		: null;
}

export function createUploadcareMatch(
	eventType: string,
): CorsairWebhookMatcher {
	return (request: RawWebhookRequest) => {
		const parsedBody = parseBody(request.body);
		if (!parsedBody) return false;
		const hook = parsedBody.hook;
		const hookEvent =
			hook && typeof hook === 'object' && 'event' in hook
				? String(hook.event)
				: undefined;
		return parsedBody.event === eventType || hookEvent === eventType;
	};
}

export function verifyUploadcareWebhookSignature(
	request: WebhookRequest<FileUploadedEvent>,
	secret: string,
): { valid: boolean; error?: string } {
	if (!secret) {
		return { valid: false, error: 'Missing webhook secret' };
	}

	const rawHeader =
		request.headers['x-uc-signature'] ||
		request.headers['x-uploadcare-signature'];
	const signatureHeader = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

	if (!signatureHeader) {
		return { valid: false, error: 'Missing webhook signature header' };
	}

	const rawBody = request.rawBody;
	if (typeof rawBody !== 'string' || !rawBody) {
		return {
			valid: false,
			error: 'Missing raw body for signature verification',
		};
	}

	const signature = signatureHeader.replace(/^(v1=|sha256=)/i, '').trim();

	try {
		const expectedDigest = crypto
			.createHmac('sha256', secret)
			.update(rawBody)
			.digest('hex');

		const isValid = crypto.timingSafeEqual(
			Buffer.from(signature.toLowerCase()),
			Buffer.from(expectedDigest.toLowerCase()),
		);

		if (!isValid) {
			return { valid: false, error: 'Invalid webhook signature' };
		}

		return { valid: true };
	} catch {
		return { valid: false, error: 'Invalid webhook signature' };
	}
}
