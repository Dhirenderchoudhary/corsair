import { logEventFromContext } from 'corsair/core';
import type { RunpodEndpoints } from '..';
import { gqlInput, makeRunpodGraphql, makeRunpodRequest } from '../client';
import type {
	CreateClusterOutput,
	CreateSecretOutput,
	DeleteRegistryAuthOutput,
	GetGpuTypesOutput,
	GetPodOutput,
	ListCpuTypesOutput,
	MyselfOutput,
	SaveEndpointOutput,
	SaveRegistryAuthOutput,
	SaveTemplateOutput,
	UpdateRegistryAuthOutput,
	UpdateUserSettingsOutput,
} from './types';

export const getMyself: RunpodEndpoints['getMyself'] = async (ctx) => {
	const data = await makeRunpodGraphql<{ myself: MyselfOutput }>(
		ctx.key,
		`query {
			myself {
				id
				email
				multiFactorEnabled
				pubKey
			}
		}`,
	);
	await logEventFromContext(ctx, 'runpod.account.myself', {}, 'completed');
	return data.myself;
};

export const updateUserSettings: RunpodEndpoints['updateUserSettings'] = async (
	ctx,
	input,
) => {
	const data = await makeRunpodGraphql<{
		updateUserSettings: UpdateUserSettingsOutput;
	}>(
		ctx.key,
		`mutation { updateUserSettings(input: ${gqlInput({ pubKey: input.pubKey })}) { id pubKey } }`,
	);
	await logEventFromContext(
		ctx,
		'runpod.account.updateSettings',
		{},
		'completed',
	);
	return data.updateUserSettings;
};

export const getGpuTypes: RunpodEndpoints['getGpuTypes'] = async (
	ctx,
	input,
) => {
	const gpuCount = input.gpuCount ?? 1;
	const selection = `
		id
		displayName
		memoryInGb
		secureCloud
		communityCloud
		lowestPrice(input: { gpuCount: ${gpuCount} }) {
			uninterruptablePrice
			stockStatus
			availableGpuCounts
		}
	`;
	const query = input.id
		? `query { gpuTypes(input: { id: ${JSON.stringify(input.id)} }) { ${selection} } }`
		: `query { gpuTypes { ${selection} } }`;
	const data = await makeRunpodGraphql<{ gpuTypes: GetGpuTypesOutput }>(
		ctx.key,
		query,
	);
	await logEventFromContext(
		ctx,
		'runpod.catalog.gpuTypes',
		{ id: input.id },
		'completed',
	);
	return data.gpuTypes;
};

export const listCpuTypes: RunpodEndpoints['listCpuTypes'] = async (
	ctx,
	input,
) => {
	const response = await makeRunpodRequest<ListCpuTypesOutput>(
		'v2',
		'/v2/catalog/cpus',
		ctx.key,
		{
			method: 'GET',
			query: {
				include: input.include,
				product: input.product,
				vcpuCount: input.vcpuCount,
			},
		},
	);
	await logEventFromContext(ctx, 'runpod.catalog.cpuTypes', input, 'completed');
	return response;
};

export const getPod: RunpodEndpoints['getPod'] = async (ctx, input) => {
	const { podId, ...query } = input;
	const response = await makeRunpodRequest<GetPodOutput>(
		'v1',
		`/pods/${encodeURIComponent(podId)}`,
		ctx.key,
		{ method: 'GET', query },
	);
	await logEventFromContext(ctx, 'runpod.pods.get', { podId }, 'completed');
	return response;
};

export const createCluster: RunpodEndpoints['createCluster'] = async (
	ctx,
	input,
) => {
	const response = await makeRunpodRequest<CreateClusterOutput>(
		'v2',
		'/v2/clusters',
		ctx.key,
		{ method: 'POST', body: input },
	);
	await logEventFromContext(
		ctx,
		'runpod.clusters.create',
		{ name: input.name, type: input.type },
		'completed',
	);
	return response;
};

export const createSecret: RunpodEndpoints['createSecret'] = async (
	ctx,
	input,
) => {
	const data = await makeRunpodGraphql<{ secretCreate: CreateSecretOutput }>(
		ctx.key,
		`mutation { secretCreate(input: ${gqlInput(input)}) { id name description } }`,
	);
	await logEventFromContext(
		ctx,
		'runpod.secrets.create',
		{ name: input.name },
		'completed',
	);
	return data.secretCreate;
};

export const saveRegistryAuth: RunpodEndpoints['saveRegistryAuth'] = async (
	ctx,
	input,
) => {
	const response = await makeRunpodRequest<SaveRegistryAuthOutput>(
		'v1',
		'/containerregistryauth',
		ctx.key,
		{ method: 'POST', body: input },
	);
	await logEventFromContext(
		ctx,
		'runpod.registries.save',
		{ name: input.name },
		'completed',
	);
	return response;
};

export const updateRegistryAuth: RunpodEndpoints['updateRegistryAuth'] = async (
	ctx,
	input,
) => {
	const data = await makeRunpodGraphql<{
		updateRegistryAuth: UpdateRegistryAuthOutput;
	}>(
		ctx.key,
		`mutation { updateRegistryAuth(input: ${gqlInput(input)}) { id name } }`,
	);
	await logEventFromContext(
		ctx,
		'runpod.registries.update',
		{ id: input.id },
		'completed',
	);
	return data.updateRegistryAuth;
};

export const deleteRegistryAuth: RunpodEndpoints['deleteRegistryAuth'] = async (
	ctx,
	input,
) => {
	const response = await makeRunpodRequest<DeleteRegistryAuthOutput>(
		'v1',
		`/containerregistryauth/${encodeURIComponent(input.containerRegistryAuthId)}`,
		ctx.key,
		{ method: 'DELETE' },
	);
	await logEventFromContext(
		ctx,
		'runpod.registries.delete',
		{ containerRegistryAuthId: input.containerRegistryAuthId },
		'completed',
	);
	return response ?? {};
};

export const saveTemplate: RunpodEndpoints['saveTemplate'] = async (
	ctx,
	input,
) => {
	const data = await makeRunpodGraphql<{ saveTemplate: SaveTemplateOutput }>(
		ctx.key,
		`mutation { saveTemplate(input: ${gqlInput({
			...input,
			dockerArgs: input.dockerArgs ?? '',
			env: input.env ?? [],
			ports: input.ports ?? '',
			readme: input.readme ?? '',
			volumeMountPath: input.volumeMountPath ?? '',
		})}) {
			id name imageName containerDiskInGb volumeInGb isServerless
			dockerArgs ports readme volumeMountPath env { key value }
		} }`,
	);
	await logEventFromContext(
		ctx,
		'runpod.templates.save',
		{ name: input.name, id: input.id },
		'completed',
	);
	return data.saveTemplate;
};

export const deleteTemplate: RunpodEndpoints['deleteTemplate'] = async (
	ctx,
	input,
) => {
	await makeRunpodGraphql<{ deleteTemplate: null }>(
		ctx.key,
		`mutation { deleteTemplate(templateName: ${JSON.stringify(input.templateName)}) }`,
	);
	await logEventFromContext(
		ctx,
		'runpod.templates.delete',
		{ templateName: input.templateName },
		'completed',
	);
	return { success: true as const };
};

export const saveEndpoint: RunpodEndpoints['saveEndpoint'] = async (
	ctx,
	input,
) => {
	const data = await makeRunpodGraphql<{ saveEndpoint: SaveEndpointOutput }>(
		ctx.key,
		`mutation { saveEndpoint(input: ${gqlInput(input, ['type', 'flashBootType'])}) {
			id name gpuIds templateId idleTimeout locations
			flashBootType scalerType scalerValue workersMin workersMax
		} }`,
	);
	await logEventFromContext(
		ctx,
		'runpod.endpoints.save',
		{ name: input.name, id: input.id },
		'completed',
	);
	return data.saveEndpoint;
};
