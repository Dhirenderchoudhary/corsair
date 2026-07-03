import type {
	BindEndpoints,
	BindWebhooks,
	CorsairEndpoint,
	CorsairErrorHandler,
	CorsairPlugin,
	CorsairPluginContext,
	CorsairWebhook,
	KeyBuilderContext,
	PickAuth,
	PluginAuthConfig,
	PluginPermissionsConfig,
	RequiredPluginEndpointMeta,
	RequiredPluginEndpointSchemas,
	RequiredPluginWebhookSchemas,
} from 'corsair/core';
import type { AuthTypes } from 'corsair/core';
import type { YoucomEndpointInputs, YoucomEndpointOutputs } from './endpoints/types';
import { YoucomEndpointInputSchemas, YoucomEndpointOutputSchemas } from './endpoints/types';
import type {
	YoucomWebhookOutputs,
	ExampleEvent,
} from './webhooks/types';
import { ExampleEventSchema } from './webhooks/types';
import { Example } from './endpoints';
import { YoucomSchema } from './schema';
import { ExampleWebhooks } from './webhooks';
import { errorHandlers } from './error-handlers';
import { matchYoucomTenantWebhook } from './webhooks/tenant-matcher';
import { resolveYoucomOAuthWebhookTenantLink } from './webhooks/oauth-tenant-link';

export type YoucomPluginOptions = {
	authType?: PickAuth<'api_key' | 'oauth_2'>;
	key?: string;
	webhookSecret?: string;
	hooks?: InternalYoucomPlugin['hooks'];
	webhookHooks?: InternalYoucomPlugin['webhookHooks'];
	errorHandlers?: CorsairErrorHandler;
	permissions?: PluginPermissionsConfig<typeof youcomEndpointsNested>;
};

export type YoucomContext = CorsairPluginContext<
	typeof YoucomSchema,
	YoucomPluginOptions
>;

export type YoucomKeyBuilderContext = KeyBuilderContext<YoucomPluginOptions>;

export type YoucomBoundEndpoints = BindEndpoints<typeof youcomEndpointsNested>;

type YoucomEndpoint<
	K extends keyof YoucomEndpointOutputs,
> = CorsairEndpoint<
	YoucomContext,
	YoucomEndpointInputs[K],
	YoucomEndpointOutputs[K]
>;

export type YoucomEndpoints = {
	exampleGet: YoucomEndpoint<'exampleGet'>;
};

type YoucomWebhook<
	K extends keyof YoucomWebhookOutputs,
	TEvent,
> = CorsairWebhook<YoucomContext, TEvent, YoucomWebhookOutputs[K]>;

export type YoucomWebhooks = {
	example: YoucomWebhook<'example', ExampleEvent>;
};

export type YoucomBoundWebhooks = BindWebhooks<YoucomWebhooks>;

const youcomEndpointsNested = {
	example: {
		get: Example.get,
	},
} as const;

const youcomWebhooksNested = {
	example: {
		example: ExampleWebhooks.example,
	},
} as const;

export const youcomEndpointSchemas = {
	'example.get': {
		input: YoucomEndpointInputSchemas.exampleGet,
		output: YoucomEndpointOutputSchemas.exampleGet,
	},
} as const satisfies RequiredPluginEndpointSchemas<typeof youcomEndpointsNested>;

const youcomWebhookSchemas = {
	'example.example': {
		description: 'An example webhook event',
		payload: ExampleEventSchema,
		response: ExampleEventSchema,
	},
} as const satisfies RequiredPluginWebhookSchemas<typeof youcomWebhooksNested>;

const defaultAuthType: AuthTypes = 'api_key' as const;

const youcomEndpointMeta = {
	'example.get': {
		riskLevel: 'read',
		description: 'Get an example resource by ID',
	},
} as const satisfies RequiredPluginEndpointMeta<typeof youcomEndpointsNested>;

export const youcomAuthConfig = {
	api_key: {
		account: ['tenant_external_id'] as const,
	},
	oauth_2: {
		account: ['tenant_external_id'] as const,
	},
} as const satisfies PluginAuthConfig;

export type BaseYoucomPlugin<T extends YoucomPluginOptions> = CorsairPlugin<
	'youcom',
	typeof YoucomSchema,
	typeof youcomEndpointsNested,
	typeof youcomWebhooksNested,
	T,
	typeof defaultAuthType
>;

export type InternalYoucomPlugin = BaseYoucomPlugin<YoucomPluginOptions>;

export type ExternalYoucomPlugin<T extends YoucomPluginOptions> =
	BaseYoucomPlugin<T>;

export function youcom<const T extends YoucomPluginOptions>(
	incomingOptions: YoucomPluginOptions & T = {} as YoucomPluginOptions & T,
): ExternalYoucomPlugin<T> {
	const options = {
		...incomingOptions,
		authType: incomingOptions.authType ?? defaultAuthType,
	};
	return {
		id: 'youcom',
		authConfig: youcomAuthConfig,
		schema: YoucomSchema,
		options: options,
		hooks: options.hooks,
		webhookHooks: options.webhookHooks,
		endpoints: youcomEndpointsNested,
		webhooks: youcomWebhooksNested,
		endpointMeta: youcomEndpointMeta,
		endpointSchemas: youcomEndpointSchemas,
		webhookSchemas: youcomWebhookSchemas,
		pluginWebhookMatcher: (request) => {
			const headers = request.headers;
			// TODO: Update to match your webhook signature headers
			return 'x-youcom-signature' in headers;
		},
		pluginTenantWebhookMatcher: matchYoucomTenantWebhook,
		oauthWebhookTenantLinkResolver: resolveYoucomOAuthWebhookTenantLink,
		errorHandlers: {
			...errorHandlers,
			...options.errorHandlers,
		},
		keyBuilder: async (ctx: YoucomKeyBuilderContext, source) => {
			if (source === 'webhook' && options.webhookSecret) {
				return options.webhookSecret;
			}

			if (source === 'webhook') {
				const res = await ctx.keys.get_webhook_signature();
				return res ?? '';
			}

			if (source === 'endpoint' && options.key) {
				return options.key;
			}

			if (source === 'endpoint' && ctx.authType === 'api_key') {
				const res = await ctx.keys.get_api_key();
				return res ?? '';
			}

			if (source === 'endpoint' && ctx.authType === 'oauth_2') {
				const res = await ctx.keys.get_access_token();
				return res ?? '';
			}

			return '';
		},
	} satisfies InternalYoucomPlugin;
}

export type {
	ExampleEvent,
	YoucomWebhookOutputs,
} from './webhooks/types';

export type {
	YoucomEndpointInputs,
	YoucomEndpointOutputs,
	ExampleGetInput,
	ExampleGetResponse,
} from './endpoints/types';
