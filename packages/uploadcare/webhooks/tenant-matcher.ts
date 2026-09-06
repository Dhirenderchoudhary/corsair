import type { RawWebhookRequest, WebhookTenantMatch } from 'corsair/core';
import { asRecord, firstString, readBodyRecord } from 'corsair/core';

/** Official v0.7 payloads put the project id on `hook.project`. */
export function matchUploadcareTenantWebhook(
	request: RawWebhookRequest,
): WebhookTenantMatch | null {
	const body = readBodyRecord(request);
	if (!body) return null;

	const hook = asRecord(body.hook);
	const data = asRecord(body.data);
	const externalId = firstString([
		body.tenant_external_id,
		hook?.project,
		body.project,
		data?.project,
	]);

	if (!externalId) return null;

	return { linkType: 'tenant_external_id', externalId };
}
