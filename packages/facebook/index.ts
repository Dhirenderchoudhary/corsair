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
import type { FacebookEndpointInputs, FacebookEndpointOutputs } from './endpoints/types';
import { FacebookEndpointInputSchemas, FacebookEndpointOutputSchemas } from './endpoints/types';
import type {
	FacebookWebhookOutputs,
	ExampleEvent,
} from './webhooks/types';
import { ExampleEventSchema } from './webhooks/types';
import { Example } from './endpoints';
import { FacebookSchema } from './schema';
import { ExampleWebhooks } from './webhooks';
import { errorHandlers } from './error-handlers';
import { matchFacebookTenantWebhook } from './webhooks/tenant-matcher';
import { resolveFacebookOAuthWebhookTenantLink } from './webhooks/oauth-tenant-link';

export type FacebookPluginOptions = {
	authType?: PickAuth<'api_key' | 'oauth_2'>;
	key?: string;
	webhookSecret?: string;
	hooks?: InternalFacebookPlugin['hooks'];
	webhookHooks?: InternalFacebookPlugin['webhookHooks'];
	errorHandlers?: CorsairErrorHandler;
	permissions?: PluginPermissionsConfig<typeof facebookEndpointsNested>;
};

export type FacebookContext = CorsairPluginContext<
	typeof FacebookSchema,
	FacebookPluginOptions
>;

export type FacebookKeyBuilderContext = KeyBuilderContext<FacebookPluginOptions>;

export type FacebookBoundEndpoints = BindEndpoints<typeof facebookEndpointsNested>;

type FacebookEndpoint<
	K extends keyof FacebookEndpointOutputs,
> = CorsairEndpoint<
	FacebookContext,
	FacebookEndpointInputs[K],
	FacebookEndpointOutputs[K]
>;

export type FacebookEndpoints = {
	exampleGet: FacebookEndpoint<'exampleGet'>;
};

type FacebookWebhook<
	K extends keyof FacebookWebhookOutputs,
	TEvent,
> = CorsairWebhook<FacebookContext, TEvent, FacebookWebhookOutputs[K]>;

export type FacebookWebhooks = {
	example: FacebookWebhook<'example', ExampleEvent>;
};

export type FacebookBoundWebhooks = BindWebhooks<FacebookWebhooks>;

const facebookEndpointsNested = {
	example: {
		get: Example.get,
	},
} as const;

const facebookWebhooksNested = {
	example: {
		example: ExampleWebhooks.example,
	},
} as const;

export const facebookEndpointSchemas = {
	'example.get': {
		input: FacebookEndpointInputSchemas.exampleGet,
		output: FacebookEndpointOutputSchemas.exampleGet,
	},
} as const satisfies RequiredPluginEndpointSchemas<typeof facebookEndpointsNested>;

const facebookWebhookSchemas = {
	'example.example': {
		description: 'An example webhook event',
		payload: ExampleEventSchema,
		response: ExampleEventSchema,
	},
} as const satisfies RequiredPluginWebhookSchemas<typeof facebookWebhooksNested>;

const defaultAuthType: AuthTypes = 'api_key' as const;

const facebookEndpointMeta = {
	'example.get': {
		riskLevel: 'read',
		description: 'Get an example resource by ID',
	},
} as const satisfies RequiredPluginEndpointMeta<typeof facebookEndpointsNested>;

export const facebookAuthConfig = {
	api_key: {
		account: ['tenant_external_id'] as const,
	},
	oauth_2: {
		account: ['tenant_external_id'] as const,
	},
} as const satisfies PluginAuthConfig;

export type BaseFacebookPlugin<T extends FacebookPluginOptions> = CorsairPlugin<
	'facebook',
	typeof FacebookSchema,
	typeof facebookEndpointsNested,
	typeof facebookWebhooksNested,
	T,
	typeof defaultAuthType
>;

export type InternalFacebookPlugin = BaseFacebookPlugin<FacebookPluginOptions>;

export type ExternalFacebookPlugin<T extends FacebookPluginOptions> =
	BaseFacebookPlugin<T>;

export function facebook<const T extends FacebookPluginOptions>(
	incomingOptions: FacebookPluginOptions & T = {} as FacebookPluginOptions & T,
): ExternalFacebookPlugin<T> {
	const options = {
		...incomingOptions,
		authType: incomingOptions.authType ?? defaultAuthType,
	};
	return {
		id: 'facebook',
		authConfig: facebookAuthConfig,
		schema: FacebookSchema,
		options: options,
		hooks: options.hooks,
		webhookHooks: options.webhookHooks,
		endpoints: facebookEndpointsNested,
		webhooks: facebookWebhooksNested,
		endpointMeta: facebookEndpointMeta,
		endpointSchemas: facebookEndpointSchemas,
		webhookSchemas: facebookWebhookSchemas,
		pluginWebhookMatcher: (request) => {
			const headers = request.headers;
			// TODO: Update to match your webhook signature headers
			return 'x-facebook-signature' in headers;
		},
		pluginTenantWebhookMatcher: matchFacebookTenantWebhook,
		oauthWebhookTenantLinkResolver: resolveFacebookOAuthWebhookTenantLink,
		errorHandlers: {
			...errorHandlers,
			...options.errorHandlers,
		},
		keyBuilder: async (ctx: FacebookKeyBuilderContext, source) => {
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
	} satisfies InternalFacebookPlugin;
}

export type {
	ExampleEvent,
	FacebookWebhookOutputs,
} from './webhooks/types';

export type {
	FacebookEndpointInputs,
	FacebookEndpointOutputs,
	ExampleGetInput,
	ExampleGetResponse,
} from './endpoints/types';
