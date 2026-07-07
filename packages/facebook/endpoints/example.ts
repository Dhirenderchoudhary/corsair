import { logEventFromContext } from 'corsair/core';
import type { FacebookEndpoints } from '..';
import type { FacebookEndpointOutputs } from './types';
import { makeFacebookRequest } from '../client';

export const get: FacebookEndpoints['exampleGet'] = async (ctx, input) => {
	const response = await makeFacebookRequest<FacebookEndpointOutputs['exampleGet']>(
		`example/${input.id}`,
		ctx.key,
		{ method: 'GET' },
	);

	await logEventFromContext(ctx, 'facebook.example.get', { ...input }, 'completed');
	return response;
};
