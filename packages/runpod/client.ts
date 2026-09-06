import type {
	ApiRequestOptions,
	OpenAPIConfig,
	RateLimitConfig,
} from 'corsair/http';
import { ApiError, request } from 'corsair/http';

export class RunpodAPIError extends Error {
	constructor(
		message: string,
		public readonly code?: string,
		public readonly status?: number,
		public readonly retryAfter?: number,
	) {
		super(message);
		this.name = 'RunpodAPIError';
	}
}

const RUNPOD_REST_V1 = 'https://rest.runpod.io/v1';
const RUNPOD_API = 'https://api.runpod.io';

const NO_TRANSPORT_RETRIES: RateLimitConfig = {
	enabled: true,
	maxRetries: 0,
	initialRetryDelay: 0,
	backoffMultiplier: 1,
	headerNames: {
		retryAfter: 'retry-after',
		resetTime: 'x-ratelimit-reset',
		remaining: 'x-ratelimit-remaining',
		limit: 'x-ratelimit-limit',
	},
};

type GraphqlError = { message?: string };
type GraphqlPayload<T> = {
	data?: T;
	errors?: GraphqlError[];
};

function extractErrorMessage(body: unknown): string | undefined {
	if (typeof body !== 'object' || body === null) return undefined;
	const record = body as Record<string, unknown>;
	if (typeof record.detail === 'string' && record.detail) return record.detail;
	if (typeof record.title === 'string' && record.title) return record.title;
	if (typeof record.message === 'string' && record.message)
		return record.message;
	const errors = record.errors;
	if (Array.isArray(errors) && errors[0] && typeof errors[0] === 'object') {
		const first = errors[0] as { message?: unknown };
		if (typeof first.message === 'string' && first.message)
			return first.message;
	}
	return undefined;
}

function gqlValue(value: unknown): string {
	if (value === null) return 'null';
	if (typeof value === 'string') return JSON.stringify(value);
	if (typeof value === 'number' || typeof value === 'boolean')
		return String(value);
	if (Array.isArray(value)) return `[${value.map(gqlValue).join(', ')}]`;
	if (typeof value === 'object') {
		const fields = Object.entries(value as Record<string, unknown>)
			.filter(([, v]) => v !== undefined)
			.map(([k, v]) => `${k}: ${gqlValue(v)}`)
			.join(', ');
		return `{ ${fields} }`;
	}
	return 'null';
}

export function gqlInput(
	fields: Record<string, unknown>,
	enumKeys: string[] = [],
): string {
	const enums = new Set(enumKeys);
	const parts = Object.entries(fields)
		.filter(([, value]) => value !== undefined)
		.map(([key, value]) =>
			enums.has(key) && typeof value === 'string'
				? `${key}: ${value}`
				: `${key}: ${gqlValue(value)}`,
		);
	return `{ ${parts.join(', ')} }`;
}

export async function makeRunpodRequest<T>(
	base: 'v1' | 'v2',
	endpoint: string,
	apiKey: string,
	options: {
		method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
		body?: Record<string, unknown>;
		query?: Record<string, string | number | boolean | undefined>;
	} = {},
): Promise<T> {
	const { method = 'GET', body, query } = options;
	const writes = method === 'POST' || method === 'PUT' || method === 'PATCH';

	const config: OpenAPIConfig = {
		BASE: base === 'v1' ? RUNPOD_REST_V1 : RUNPOD_API,
		VERSION: base === 'v1' ? '1.0.0' : '2.0.0',
		WITH_CREDENTIALS: false,
		CREDENTIALS: 'omit',
		TOKEN: apiKey,
		HEADERS: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`,
		},
	};

	const requestOptions: ApiRequestOptions = {
		method,
		url: endpoint,
		body: writes ? body : undefined,
		mediaType: writes ? 'application/json; charset=utf-8' : undefined,
		query,
	};

	try {
		return await request<T>(config, requestOptions, {
			rateLimitConfig: NO_TRANSPORT_RETRIES,
		});
	} catch (error) {
		if (error instanceof ApiError) {
			throw new RunpodAPIError(
				extractErrorMessage(error.body) || error.message,
				undefined,
				error.status,
				error.retryAfter,
			);
		}
		if (error instanceof Error) {
			throw new RunpodAPIError(error.message);
		}
		throw new RunpodAPIError('Unknown RunPod API error');
	}
}

export async function makeRunpodGraphql<T>(
	apiKey: string,
	query: string,
	variables?: Record<string, unknown>,
): Promise<T> {
	const config: OpenAPIConfig = {
		BASE: RUNPOD_API,
		VERSION: '1.0.0',
		WITH_CREDENTIALS: false,
		CREDENTIALS: 'omit',
		TOKEN: apiKey,
		HEADERS: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`,
		},
	};

	const requestOptions: ApiRequestOptions = {
		method: 'POST',
		url: '/graphql',
		body: { query, variables },
		mediaType: 'application/json; charset=utf-8',
		query: { api_key: apiKey },
	};

	let payload: GraphqlPayload<T>;
	try {
		payload = await request<GraphqlPayload<T>>(config, requestOptions, {
			rateLimitConfig: NO_TRANSPORT_RETRIES,
		});
	} catch (error) {
		if (error instanceof ApiError) {
			throw new RunpodAPIError(
				extractErrorMessage(error.body) || error.message,
				undefined,
				error.status,
				error.retryAfter,
			);
		}
		if (error instanceof Error) {
			throw new RunpodAPIError(error.message);
		}
		throw new RunpodAPIError('Unknown RunPod GraphQL error');
	}

	const graphqlError = payload.errors?.[0]?.message;
	if (graphqlError) {
		throw new RunpodAPIError(graphqlError);
	}
	if (payload.data === undefined) {
		throw new RunpodAPIError('RunPod GraphQL response missing data');
	}
	return payload.data;
}
