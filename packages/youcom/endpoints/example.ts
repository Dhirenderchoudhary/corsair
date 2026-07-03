import { logEventFromContext } from 'corsair/core';
import type { YoucomEndpoints } from '..';
import type { YoucomEndpointOutputs } from './types';
import { makeYoucomRequest } from '../client';

export const get: YoucomEndpoints['exampleGet'] = async (ctx, input) => {
	const response = await makeYoucomRequest<YoucomEndpointOutputs['exampleGet']>(
		`example/${input.id}`,
		ctx.key,
		{ method: 'GET' },
	);

	await logEventFromContext(ctx, 'youcom.example.get', { ...input }, 'completed');
	return response;
};
