import type { ApiRequestOptions } from '../async-core/ApiRequestOptions';
import type { OpenAPIConfig } from '../async-core/OpenAPI';
import { request } from '../async-core/request';

const originalFetch = global.fetch;

const config: OpenAPIConfig = {
	BASE: 'https://api.example.com',
	VERSION: '1',
	WITH_CREDENTIALS: false,
	CREDENTIALS: 'same-origin',
};

/** Runs a request against a stubbed fetch and returns the URL that was built. */
async function urlFor(options: ApiRequestOptions): Promise<string> {
	let seen = '';

	global.fetch = jest.fn(async (url: unknown) => {
		seen = String(url);
		return new Response('{}', {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	}) as unknown as typeof fetch;

	await request(config, options);
	return seen;
}

afterEach(() => {
	global.fetch = originalFetch;
});

describe('path template substitution', () => {
	it('substitutes named path parameters', async () => {
		const url = await urlFor({
			method: 'GET',
			url: '/users/{id}/posts/{postId}',
			path: { id: 'u_1', postId: 42 },
		});

		expect(url).toBe('https://api.example.com/users/u_1/posts/42');
	});

	it('leaves unknown placeholders untouched', async () => {
		const url = await urlFor({
			method: 'GET',
			url: '/users/{id}/{unknown}',
			path: { id: 'u_1' },
		});

		expect(url).toBe('https://api.example.com/users/u_1/{unknown}');
	});

	it('encodes substituted values', async () => {
		const url = await urlFor({
			method: 'GET',
			url: '/search/{term}',
			path: { term: 'a b/c' },
		});

		expect(url).toBe('https://api.example.com/search/a%20b/c');
	});

	it('substitutes the api-version placeholder', async () => {
		const url = await urlFor({ method: 'GET', url: '/v{api-version}/ping' });

		expect(url).toBe('https://api.example.com/v1/ping');
	});

	// Regression: the template matcher used `/{(.*?)}/g`, whose lazy quantifier
	// rescans the rest of the string from every `{`. A URL carrying many
	// unclosed braces therefore cost quadratic time (~5s at 100k characters).
	// `[^{}]*` cannot backtrack that way. Guards CodeQL
	// js/polynomial-redos on this sink.
	it('handles many unclosed braces in linear time', async () => {
		const pathological = `/${'{a'.repeat(50_000)}`;

		const started = Date.now();
		const url = await urlFor({ method: 'GET', url: pathological });
		const elapsed = Date.now() - started;

		// No placeholder is well-formed, so the path is passed through unchanged.
		expect(url).toBe(`https://api.example.com${pathological}`);
		// The old lazy pattern took well over a second on this input.
		expect(elapsed).toBeLessThan(1_000);
	});
});
