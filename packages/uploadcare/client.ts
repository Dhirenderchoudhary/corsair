import type { ApiRequestOptions, OpenAPIConfig } from 'corsair/http';
import { ApiError, request } from 'corsair/http';

export class UploadcareAPIError extends Error {
	constructor(
		message: string,
		public readonly code?: string,
		public readonly status?: number,
		// Provider error JSON is not a single documented object.
		public readonly body?: unknown,
		public readonly retryAfter?: number,
	) {
		super(message);
		this.name = 'UploadcareAPIError';
	}
}

const REST_BASE = 'https://api.uploadcare.com';
const UPLOAD_BASE = 'https://upload.uploadcare.com';

export function publicKeyFromAuth(apiKey: string): string {
	const raw = apiKey.startsWith('Uploadcare.Simple ')
		? apiKey.slice('Uploadcare.Simple '.length)
		: apiKey;
	return raw.split(':')[0] ?? raw;
}

function simpleAuthHeader(apiKey: string): string {
	return apiKey.startsWith('Uploadcare.Simple ')
		? apiKey
		: `Uploadcare.Simple ${apiKey}`;
}

function errorMessage(body: unknown, fallback: string): string {
	if (body && typeof body === 'object') {
		if ('detail' in body && body.detail != null) return String(body.detail);
		if ('message' in body && body.message != null) return String(body.message);
		if ('error' in body && body.error != null) return String(body.error);
	}
	return fallback;
}

function errorCode(body: unknown): string | undefined {
	if (body && typeof body === 'object' && 'code' in body && body.code != null) {
		return String(body.code);
	}
	return undefined;
}

// fetch/request can throw ApiError, Error, or a non-Error value.
function wrapRequestError(error: unknown): never {
	if (error instanceof ApiError) {
		throw new UploadcareAPIError(
			errorMessage(error.body, error.message),
			errorCode(error.body),
			error.status,
			error.body,
			error.retryAfter,
		);
	}
	if (error instanceof Error) {
		throw new UploadcareAPIError(error.message);
	}
	throw new UploadcareAPIError('Unknown error');
}

export async function makeUploadcareRequest<T>(
	endpoint: string,
	apiKey: string,
	options: {
		method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
		// REST bodies are arrays (batch UUIDs) or objects depending on the op.
		body?: unknown;
		query?: Record<string, string | number | boolean | undefined>;
		mediaType?: string;
		formData?: Record<string, string | number | boolean | undefined>;
	} = {},
): Promise<T> {
	const { method = 'GET', body, query, mediaType, formData } = options;

	const config: OpenAPIConfig = {
		BASE: REST_BASE,
		VERSION: '0.7.0',
		WITH_CREDENTIALS: false,
		CREDENTIALS: 'omit',
		HEADERS: {
			Accept: 'application/vnd.uploadcare-v0.7+json',
			Authorization: simpleAuthHeader(apiKey),
		},
	};

	const requestOptions: ApiRequestOptions = {
		method,
		url: endpoint.startsWith('/') ? endpoint : `/${endpoint}`,
		body: body !== undefined ? body : undefined,
		formData,
		mediaType:
			mediaType ??
			(body !== undefined ? 'application/json; charset=utf-8' : undefined),
		query,
	};

	try {
		return await request<T>(config, requestOptions);
	} catch (error: unknown) {
		wrapRequestError(error);
	}
}

export async function makeUploadcareUploadRequest<T>(
	endpoint: string,
	options: {
		method?: 'GET' | 'POST';
		query?: Record<string, string | number | boolean | undefined>;
		formData?: Record<string, string | number | boolean | undefined>;
	} = {},
): Promise<T> {
	const { method = 'POST', query, formData } = options;

	const config: OpenAPIConfig = {
		BASE: UPLOAD_BASE,
		VERSION: '0.7.0',
		WITH_CREDENTIALS: false,
		CREDENTIALS: 'omit',
		HEADERS: {},
	};

	const requestOptions: ApiRequestOptions = {
		method,
		url: endpoint.startsWith('/') ? endpoint : `/${endpoint}`,
		formData,
		query,
	};

	try {
		return await request<T>(config, requestOptions);
	} catch (error: unknown) {
		wrapRequestError(error);
	}
}
