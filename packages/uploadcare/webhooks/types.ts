import type {
	CorsairWebhookMatcher,
	RawWebhookRequest,
	WebhookRequest,
} from 'corsair/core';
import * as crypto from 'crypto';
import { z } from 'zod';

const HookSchema = z.object({
	event: z.string().optional(),
	project: z.union([z.number(), z.string()]).optional(),
	id: z.number().optional(),
});

const FileDataSchema = z.object({
	uuid: z.string(),
	original_filename: z.string().nullable().optional(),
});

export const FileUploadedEventSchema = z
	.object({
		event: z.literal('file.uploaded').optional(),
		hook: HookSchema.optional(),
		data: FileDataSchema,
		file: z.string().optional(),
	})
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

const MatcherBodySchema = z.object({
	event: z.string().optional(),
	hook: HookSchema.optional(),
	data: z.object({ uuid: z.string().optional() }).optional(),
});

function parseBody(body: unknown) {
	let parsed: unknown = body;
	if (typeof body === 'string') {
		try {
			parsed = JSON.parse(body);
		} catch {
			return null;
		}
	}
	const result = MatcherBodySchema.safeParse(parsed);
	return result.success ? result.data : null;
}

export function createUploadcareMatch(
	eventType: string,
): CorsairWebhookMatcher {
	return (request: RawWebhookRequest) => {
		const parsedBody = parseBody(request.body);
		if (!parsedBody) return false;
		return (
			parsedBody.event === eventType || parsedBody.hook?.event === eventType
		);
	};
}

export function verifyUploadcareWebhookSignature(
	request: WebhookRequest<FileUploadedEvent>,
	secret: string,
): { valid: boolean; error?: string } {
	if (request.hubVerified === true) {
		return { valid: true };
	}

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

	// HMAC the exact signed bytes. Never JSON.stringify(payload) — that is not
	// what Uploadcare signed when a parser already materialized the body.
	const signedBody = request.rawBody;
	if (typeof signedBody !== 'string' || signedBody.length === 0) {
		return {
			valid: false,
			error: 'Original raw body required for signature verification',
		};
	}

	const signature = signatureHeader.replace(/^(v1=|sha256=)/i, '').trim();

	try {
		const expectedDigest = crypto
			.createHmac('sha256', secret)
			.update(signedBody)
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
