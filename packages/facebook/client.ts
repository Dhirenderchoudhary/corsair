import type { ApiRequestOptions, OpenAPIConfig } from 'corsair/http';
import { request } from 'corsair/http';

/** Latest stable Graph API version aligned with the Instagram plugin. */
export const FACEBOOK_GRAPH_API_VERSION = 'v25.0';

export const FACEBOOK_API_BASE = `https://graph.facebook.com/${FACEBOOK_GRAPH_API_VERSION}`;

/** Graph API error codes that indicate rate limiting or throttling. */
export const FACEBOOK_RATE_LIMIT_ERROR_CODES = new Set([4, 17, 32, 613, 80004]);

/** OAuth / permission error — invalid or expired access token. */
export const FACEBOOK_AUTH_ERROR_CODE = 190;

export class FacebookAPIError extends Error {
	constructor(
		message: string,
		public readonly code?: number,
		public readonly subcode?: number,
		public readonly type?: string,
		public readonly fbtraceId?: string,
	) {
		super(message);
		this.name = 'FacebookAPIError';
	}
}

export type FacebookPagingCursors = {
	before?: string;
	after?: string;
};

export type FacebookPaging = {
	cursors?: FacebookPagingCursors;
	next?: string;
	previous?: string;
};

export type FacebookListResponse<T> = {
	data: T[];
	paging?: FacebookPaging;
};

export type FacebookRequestOptions = {
	method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
	body?: Record<string, unknown>;
	query?: Record<string, string | number | boolean | undefined>;
	formData?: Record<string, string | Blob>;
};

type GraphErrorBody = {
	error?: {
		message?: string;
		code?: number;
		error_subcode?: number;
		type?: string;
		fbtrace_id?: string;
	};
};

function extractGraphError(error: unknown): GraphErrorBody['error'] | undefined {
	const err = error as {
		body?: GraphErrorBody;
		response?: {
			body?: GraphErrorBody;
			data?: GraphErrorBody;
		};
	};
	return (
		err?.body?.error ??
		err?.response?.body?.error ??
		err?.response?.data?.error
	);
}

export function isFacebookRateLimitError(error: unknown): boolean {
	if (error instanceof FacebookAPIError && error.code !== undefined) {
		return FACEBOOK_RATE_LIMIT_ERROR_CODES.has(error.code);
	}
	const msg =
		error instanceof Error ? error.message.toLowerCase() : String(error);
	return (
		msg.includes('rate limit') ||
		msg.includes('too many calls') ||
		msg.includes('request limit')
	);
}

export function isFacebookAuthError(error: unknown): boolean {
	if (error instanceof FacebookAPIError) {
		return error.code === FACEBOOK_AUTH_ERROR_CODE;
	}
	return false;
}

export async function makeFacebookRequest<T>(
	endpoint: string,
	accessToken: string,
	options: FacebookRequestOptions = {},
): Promise<T> {
	const { method = 'GET', body, query, formData } = options;

	const normalizedEndpoint = endpoint.startsWith('/')
		? endpoint.slice(1)
		: endpoint;

	const config: OpenAPIConfig = {
		BASE: FACEBOOK_API_BASE,
		VERSION: FACEBOOK_GRAPH_API_VERSION,
		WITH_CREDENTIALS: false,
		CREDENTIALS: 'omit',
		TOKEN: accessToken,
		HEADERS: {},
	};

	const requestOptions: ApiRequestOptions = {
		method,
		url: normalizedEndpoint,
		body:
			method === 'POST' ||
			method === 'PUT' ||
			method === 'PATCH' ||
			method === 'DELETE'
				? body
				: undefined,
		formData,
		mediaType: formData ? undefined : 'application/json; charset=utf-8',
		query:
			method === 'GET' || method === 'DELETE'
				? { ...query }
				: query,
	};

	try {
		return await request<T>(config, requestOptions);
	} catch (error: unknown) {
		const graphError = extractGraphError(error);
		if (graphError) {
			throw new FacebookAPIError(
				graphError.message ?? 'Unknown Facebook Graph API error',
				graphError.code,
				graphError.error_subcode,
				graphError.type,
				graphError.fbtrace_id,
			);
		}
		if (error instanceof Error) {
			throw new FacebookAPIError(error.message);
		}
		throw new FacebookAPIError('Unknown Facebook Graph API error');
	}
}

export type FacebookRequestContext = {
	key: string;
};

export async function resolvePageAccessToken(
	userAccessToken: string,
	pageId: string,
): Promise<string> {
	const page = await makeFacebookRequest<{ access_token?: string }>(
		`/${pageId}`,
		userAccessToken,
		{
			method: 'GET',
			query: { fields: 'access_token' },
		},
	);

	if (!page.access_token) {
		throw new FacebookAPIError(
			`No page access token found for page ${pageId}. Ensure the user has granted pages_show_list and manages this page.`,
		);
	}

	return page.access_token;
}

export async function makePageFacebookRequest<T>(
	endpoint: string,
	ctx: FacebookRequestContext,
	pageId: string,
	options: FacebookRequestOptions = {},
): Promise<T> {
	const pageToken = await resolvePageAccessToken(ctx.key, pageId);
	return makeFacebookRequest<T>(endpoint, pageToken, options);
}
