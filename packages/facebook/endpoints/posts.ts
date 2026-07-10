import { makeFacebookRequest, makePageFacebookRequest } from '../client';
import type { FacebookEndpoints } from '../index';
import type { FacebookEndpointOutputs } from './types';
import {
	buildPaginationQuery,
	logFacebookEvent,
	omitUndefined,
} from './shared';

function formatMetric(metric: string | string[]): string {
	return Array.isArray(metric) ? metric.join(',') : metric;
}

export const create: FacebookEndpoints['createPost'] = async (ctx, input) => {
	const { page_id, ...body } = input;
	const result = await makePageFacebookRequest<
		FacebookEndpointOutputs['createPost']
	>(`/${page_id}/feed`, ctx, page_id, {
		method: 'POST',
		body: omitUndefined(body),
	});

	await logFacebookEvent(ctx, 'facebook.posts.create', { ...input });
	return result;
};

export const get: FacebookEndpoints['getPost'] = async (ctx, input) => {
	const result = await makeFacebookRequest<FacebookEndpointOutputs['getPost']>(
		`/${input.post_id}`,
		ctx.key,
		{
			query: {
				fields:
					input.fields ??
					'id,message,created_time,updated_time,is_published,scheduled_publish_time,permalink_url,full_picture',
			},
		},
	);

	if (result.id) {
		try {
			await ctx.db.posts.upsertByEntityId(result.id, {
				postId: result.id,
				message: result.message,
				createdTime: result.created_time,
				isPublished: result.is_published,
				permalinkUrl: result.permalink_url,
			});
		} catch {
			// Non-fatal cache write
		}
	}

	await logFacebookEvent(ctx, 'facebook.posts.get', { ...input });
	return result;
};

export const list: FacebookEndpoints['getPagePosts'] = async (ctx, input) => {
	const result = await makePageFacebookRequest<
		FacebookEndpointOutputs['getPagePosts']
	>(`/${input.page_id}/posts`, ctx, input.page_id, {
		query: buildPaginationQuery({
			fields:
				input.fields ??
				'id,message,created_time,is_published,permalink_url,full_picture',
			limit: input.limit,
			after: input.after,
			before: input.before,
		}),
	});

	if (result.data) {
		for (const post of result.data) {
			if (!post.id) continue;
			try {
				await ctx.db.posts.upsertByEntityId(post.id, {
					postId: post.id,
					pageId: input.page_id,
					message: post.message,
					createdTime: post.created_time,
					isPublished: post.is_published,
				});
			} catch {
				// Non-fatal cache write
			}
		}
	}

	await logFacebookEvent(ctx, 'facebook.posts.list', { ...input });
	return result;
};

export const listScheduled: FacebookEndpoints['getScheduledPosts'] = async (
	ctx,
	input,
) => {
	const result = await makePageFacebookRequest<
		FacebookEndpointOutputs['getScheduledPosts']
	>(`/${input.page_id}/scheduled_posts`, ctx, input.page_id, {
		query: buildPaginationQuery({
			fields:
				input.fields ??
				'id,message,created_time,scheduled_publish_time,is_published',
			limit: input.limit,
			after: input.after,
			before: input.before,
		}),
	});

	await logFacebookEvent(ctx, 'facebook.posts.listScheduled', { ...input });
	return result;
};

export const update: FacebookEndpoints['updatePost'] = async (ctx, input) => {
	const { post_id, ...body } = input;
	const result = await makeFacebookRequest<
		FacebookEndpointOutputs['updatePost']
	>(`/${post_id}`, ctx.key, {
		method: 'POST',
		body: omitUndefined(body),
	});

	await logFacebookEvent(ctx, 'facebook.posts.update', { ...input });
	return result;
};

export const remove: FacebookEndpoints['deletePost'] = async (ctx, input) => {
	const result = await makeFacebookRequest<
		FacebookEndpointOutputs['deletePost']
	>(`/${input.post_id}`, ctx.key, {
		method: 'DELETE',
	});

	if (result.success) {
		try {
			await ctx.db.posts.deleteByEntityId(input.post_id);
		} catch {
			// Non-fatal cache write
		}
	}

	await logFacebookEvent(ctx, 'facebook.posts.delete', { ...input });
	return result;
};

export const reschedule: FacebookEndpoints['reschedulePost'] = async (
	ctx,
	input,
) => {
	const { post_id, scheduled_publish_time } = input;
	const result = await makeFacebookRequest<
		FacebookEndpointOutputs['reschedulePost']
	>(`/${post_id}`, ctx.key, {
		method: 'POST',
		body: { scheduled_publish_time },
	});

	await logFacebookEvent(ctx, 'facebook.posts.reschedule', { ...input });
	return result;
};

export const publishScheduled: FacebookEndpoints['publishScheduledPost'] =
	async (ctx, input) => {
		const result = await makeFacebookRequest<
			FacebookEndpointOutputs['publishScheduledPost']
		>(`/${input.post_id}`, ctx.key, {
			method: 'POST',
			body: { published: true },
		});

		await logFacebookEvent(ctx, 'facebook.posts.publishScheduled', {
			...input,
		});
		return result;
	};

export const listTagged: FacebookEndpoints['getPageTaggedPosts'] = async (
	ctx,
	input,
) => {
	const result = await makePageFacebookRequest<
		FacebookEndpointOutputs['getPageTaggedPosts']
	>(`/${input.page_id}/tagged`, ctx, input.page_id, {
		query: buildPaginationQuery({
			fields:
				input.fields ??
				'id,message,created_time,permalink_url,full_picture',
			limit: input.limit,
			after: input.after,
			before: input.before,
		}),
	});

	await logFacebookEvent(ctx, 'facebook.posts.listTagged', { ...input });
	return result;
};

export const getInsights: FacebookEndpoints['getPostInsights'] = async (
	ctx,
	input,
) => {
	const result = await makeFacebookRequest<
		FacebookEndpointOutputs['getPostInsights']
	>(`/${input.post_id}/insights`, ctx.key, {
		query: {
			metric: formatMetric(input.metric),
		},
	});

	await logFacebookEvent(ctx, 'facebook.posts.getInsights', { ...input });
	return result;
};

export const getReactions: FacebookEndpoints['getPostReactions'] = async (
	ctx,
	input,
) => {
	const { post_id, type, ...pagination } = input;
	const result = await makeFacebookRequest<
		FacebookEndpointOutputs['getPostReactions']
	>(`/${post_id}/reactions`, ctx.key, {
		query: omitUndefined({
			type,
			limit: pagination.limit,
			after: pagination.after,
			before: pagination.before,
		}),
	});

	if (result.data) {
		for (const reaction of result.data) {
			if (!reaction.id) continue;
			try {
				await ctx.db.reactions.upsertByEntityId(
					`${post_id}:${reaction.id}`,
					{
						objectId: post_id,
						userId: reaction.id,
						name: reaction.name,
						type: reaction.type,
					},
				);
			} catch {
				// Non-fatal cache write
			}
		}
	}

	await logFacebookEvent(ctx, 'facebook.posts.getReactions', { ...input });
	return result;
};
