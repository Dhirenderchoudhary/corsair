import { logEventFromContext } from 'corsair/core';
import type { z } from 'zod';
import type { ApiLabzContext } from '..';
import { makeApiLabzRequest } from '../client';

export const APILABZ_MODULES = {
	dealsIntegrate: 'API_LABZ_INTEGRATE_DEAL',
	airtableListTables: 'API_LABZ_LIST_TABLES',
	trelloAiSearchEngine: 'API_LABZ_TRELLO_AI_SEARCH_ENGINE',
	ibanValidate: 'API_LABZ_IBAN_VALIDATOR',
} as const;

function redactOperationInput(
	moduleSlug: string,
	input: Record<string, unknown>,
): Record<string, unknown> {
	if (moduleSlug === APILABZ_MODULES.ibanValidate) {
		return {
			hasIban: typeof input.iban === 'string' && input.iban.length > 0,
		};
	}

	if (moduleSlug === APILABZ_MODULES.dealsIntegrate) {
		return {
			dealId: typeof input.dealId === 'string' ? input.dealId : undefined,
			status: typeof input.status === 'string' ? input.status : undefined,
			hasAmount: typeof input.amount === 'number',
			hasTitle: typeof input.title === 'string',
			hasCurrency: typeof input.currency === 'string',
			customFieldCount:
				typeof input.customFields === 'object' && input.customFields !== null
					? Object.keys(input.customFields as Record<string, unknown>).length
					: 0,
		};
	}

	return input;
}

/**
 * Execute one hub module: POST /module/<slug> with the operation input as body.
 */
export async function executeApiLabzModule<T>(
	ctx: ApiLabzContext,
	eventName: string,
	moduleSlug: string,
	input: Record<string, unknown>,
	outputSchema: z.ZodType<T>,
): Promise<T> {
	const response = await makeApiLabzRequest<unknown>(
		`module/${moduleSlug}`,
		ctx.key,
		{
			method: 'POST',
			body: input,
		},
	);

	const parsedResponse = outputSchema.parse(response);
	await logEventFromContext(
		ctx,
		eventName,
		redactOperationInput(moduleSlug, input),
		'completed',
	);
	return parsedResponse;
}
