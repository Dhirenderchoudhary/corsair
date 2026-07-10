import { makeFacebookRequest } from '../client';
import type { FacebookEndpoints } from '../index';
import type { FacebookEndpointOutputs } from './types';
import { logFacebookEvent, omitUndefined } from './shared';

export const add: FacebookEndpoints['addReaction'] = async (ctx, input) => {
	const { object_id, type } = input;
	const endpoint =
		type && type !== 'LIKE' ? `/${object_id}/reactions` : `/${object_id}/likes`;

	const result = await makeFacebookRequest<
		FacebookEndpointOutputs['addReaction']
	>(endpoint, ctx.key, {
		method: 'POST',
		body: omitUndefined({ type: type && type !== 'LIKE' ? type : undefined }),
	});

	await logFacebookEvent(ctx, 'facebook.reactions.add', { ...input });
	return result;
};

export const unlike: FacebookEndpoints['unlikePostOrComment'] = async (
	ctx,
	input,
) => {
	const result = await makeFacebookRequest<
		FacebookEndpointOutputs['unlikePostOrComment']
	>(`/${input.object_id}/likes`, ctx.key, {
		method: 'DELETE',
	});

	await logFacebookEvent(ctx, 'facebook.reactions.unlike', { ...input });
	return result;
};
