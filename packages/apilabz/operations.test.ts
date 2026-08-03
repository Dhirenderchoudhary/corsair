import { logEventFromContext } from 'corsair/core';
import { ApiError } from 'corsair/http';
import { makeApiLabzRequest } from './client';
import { Airtable, Deals, Iban, Trello } from './endpoints';
import { errorHandlers } from './error-handlers';

jest.mock('corsair/core', () => ({
	logEventFromContext: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./client', () => ({
	makeApiLabzRequest: jest.fn(),
	ApiLabzAPIError: class ApiLabzAPIError extends Error {
		status?: number;
		retryAfter?: number;
		constructor(
			message: string,
			public code?: string,
			options?: { cause?: Error },
		) {
			super(message, options);
			this.name = 'ApiLabzAPIError';
		}
	},
}));

const mockRequest = jest.mocked(makeApiLabzRequest);
const mockLog = jest.mocked(logEventFromContext);

type AnyEndpoint = (ctx: unknown, input: unknown) => Promise<unknown>;

function createContext() {
	return {
		key: 'test-api-key',
		options: {
			authType: 'api_key' as const,
		},
	};
}

describe('ApiLabz endpoint routing', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockRequest.mockResolvedValue({
			message: 'Module executed successfully',
			response: { ok: true },
		});
	});

	const cases: Array<{
		name: string;
		fn: AnyEndpoint;
		input: Record<string, unknown>;
		eventName: string;
		modulePath: string;
		logPayload: Record<string, unknown>;
		mockResponse?: Record<string, unknown>;
	}> = [
		{
			name: 'deals.integrate',
			fn: Deals.integrate as AnyEndpoint,
			input: {
				title: 'Acme',
				amount: 1000,
				dealId: 'deal-1',
				status: 'open',
			},
			eventName: 'apilabz.deals.integrate',
			modulePath: 'module/API_LABZ_INTEGRATE_DEAL',
			logPayload: {
				dealId: 'deal-1',
				status: 'open',
				hasAmount: true,
				hasTitle: true,
				hasCurrency: false,
				customFieldCount: 0,
			},
		},
		{
			name: 'airtable.listTables',
			fn: Airtable.listTables as AnyEndpoint,
			input: {
				base_id: 'app123',
			},
			eventName: 'apilabz.airtable.listTables',
			modulePath: 'module/API_LABZ_LIST_TABLES',
			logPayload: {
				base_id: 'app123',
			},
		},
		{
			name: 'trello.aiSearchEngine',
			fn: Trello.aiSearchEngine as AnyEndpoint,
			input: {
				query: 'bug reports from last week',
				limit: 5,
			},
			eventName: 'apilabz.trello.aiSearchEngine',
			modulePath: 'module/API_LABZ_TRELLO_AI_SEARCH_ENGINE',
			logPayload: {
				query: 'bug reports from last week',
				limit: 5,
			},
		},
		{
			name: 'iban.validate',
			fn: Iban.validate as AnyEndpoint,
			input: {
				iban: 'GB82WEST12345698765432',
			},
			eventName: 'apilabz.iban.validate',
			modulePath: 'module/API_LABZ_IBAN_VALIDATOR',
			logPayload: {
				hasIban: true,
			},
			mockResponse: {
				message: 'Module executed successfully',
				response: {
					iban: 'GB82WEST12345698765432',
					is_valid: true,
				},
			},
		},
	];

	it.each(cases)(
		'$name routes through hub module slug',
		async ({ fn, input, eventName, modulePath, logPayload, mockResponse }) => {
			if (mockResponse) {
				mockRequest.mockResolvedValueOnce(mockResponse);
			}
			const ctx = createContext();
			await fn(ctx, input);

			expect(mockRequest).toHaveBeenCalledWith(modulePath, 'test-api-key', {
				method: 'POST',
				body: input,
			});
			expect(mockLog).toHaveBeenCalledWith(
				ctx,
				eventName,
				logPayload,
				'completed',
			);
		},
	);

	it('rejects invalid IBAN input', async () => {
		const ctx = createContext();
		await expect(
			(Iban.validate as AnyEndpoint)(ctx, { iban: 'x' }),
		).rejects.toThrow();
	});

	it('rejects deal input missing catalog fields', async () => {
		const ctx = createContext();
		await expect(
			(Deals.integrate as AnyEndpoint)(ctx, { deal: { id: '1' } }),
		).rejects.toThrow();
	});

	it('parses the API response before logging completion', async () => {
		mockRequest.mockResolvedValue(null as never);
		const ctx = createContext();
		await expect(
			(Deals.integrate as AnyEndpoint)(ctx, {
				title: 'Acme',
				amount: 1,
				dealId: 'd1',
				status: 'open',
			}),
		).rejects.toThrow();
		expect(mockLog).not.toHaveBeenCalled();
	});
});

describe('ApiLabz error handlers', () => {
	function createMockApiError(
		status: number,
		message: string,
		retryAfter?: number,
	) {
		return new ApiError(
			{
				method: 'GET',
				url: '/test',
			},
			{
				url: '/test',
				ok: false,
				status,
				statusText: 'Error',
				body: null,
			},
			message,
			{ retryAfter },
		);
	}

	it('matches and handles rate limit errors', async () => {
		const rateLimitError = createMockApiError(429, 'rate_limited', 2000);
		expect(errorHandlers.RATE_LIMIT_ERROR.match(rateLimitError)).toBe(true);
		expect(errorHandlers.RATE_LIMIT_ERROR.match(new Error('random'))).toBe(
			false,
		);
		await expect(
			errorHandlers.RATE_LIMIT_ERROR.handler(rateLimitError),
		).resolves.toEqual({
			maxRetries: 5,
			headersRetryAfterMs: 2000,
		});
	});

	it('matches and handles auth errors', async () => {
		const authError = createMockApiError(401, 'unauthorized');
		expect(errorHandlers.AUTH_ERROR.match(authError)).toBe(true);
		expect(errorHandlers.AUTH_ERROR.match(new Error('something else'))).toBe(
			false,
		);
		await expect(errorHandlers.AUTH_ERROR.handler()).resolves.toEqual({
			maxRetries: 0,
		});
	});

	it('matches insufficient credits as permission errors', async () => {
		const creditError = createMockApiError(403, 'Insufficient credits');
		expect(errorHandlers.PERMISSION_ERROR.match(creditError)).toBe(true);
		await expect(errorHandlers.PERMISSION_ERROR.handler()).resolves.toEqual({
			maxRetries: 0,
		});
	});
});
