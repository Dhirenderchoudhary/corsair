import { logEventFromContext } from 'corsair/core';
import type { FacebookContext } from '../index';

export async function logFacebookEvent(
	ctx: FacebookContext,
	eventKey: string,
	input: Record<string, unknown>,
): Promise<void> {
	await logEventFromContext(ctx, eventKey, input, 'completed');
}

export function omitUndefined<T extends Record<string, unknown>>(
	obj: T,
): Partial<T> {
	return Object.fromEntries(
		Object.entries(obj).filter(([, value]) => value !== undefined),
	) as Partial<T>;
}

export function buildPaginationQuery(input: {
	fields?: string;
	limit?: number;
	after?: string;
	before?: string;
}): Record<string, string | number | boolean | undefined> {
	return {
		fields: input.fields,
		limit: input.limit,
		after: input.after,
		before: input.before,
	};
}
