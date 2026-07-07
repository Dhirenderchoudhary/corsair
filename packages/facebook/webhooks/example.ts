import { logEventFromContext } from 'corsair/core';
import type { FacebookWebhooks } from '..';
import { createFacebookMatch, verifyFacebookWebhookSignature } from './types';

export const example: FacebookWebhooks['example'] = {
	match: createFacebookMatch('example'),

	handler: async (ctx, request) => {
		const verification = verifyFacebookWebhookSignature(request, ctx.key);
		if (!verification.valid) {
			return {
				success: false,
				statusCode: 401,
				error: verification.error || 'Signature verification failed',
			};
		}

		const event = request.payload;
		if (event.type !== 'example') {
			return { success: true, data: undefined };
		}

		await logEventFromContext(ctx, 'facebook.webhook.example', { ...event }, 'completed');

		return { success: true, data: event };
	},
};
