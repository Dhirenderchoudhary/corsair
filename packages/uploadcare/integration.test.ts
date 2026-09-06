import {
	makeUploadcareRequest,
	makeUploadcareUploadRequest,
	publicKeyFromAuth,
} from './client';
import { UploadcareEndpointOutputSchemas } from './endpoints/types';

const API_KEY = process.env.UPLOADCARE_API_KEY;

const maybe = API_KEY ? it : it.skip;

describe('Uploadcare live API', () => {
	maybe('project.get matches official schema', async () => {
		const result = await makeUploadcareRequest<unknown>('/project/', API_KEY!, {
			method: 'GET',
		});
		const parsed = UploadcareEndpointOutputSchemas.projectGet.parse(result);
		expect(parsed.pub_key || parsed.name).toBeTruthy();
	});

	maybe('files.list matches official schema', async () => {
		const result = await makeUploadcareRequest<unknown>('/files/', API_KEY!, {
			method: 'GET',
			query: { limit: 5 },
		});
		UploadcareEndpointOutputSchemas.filesList.parse(result);
	});

	maybe('upload.from_url accepts the public key', async () => {
		const result = await makeUploadcareUploadRequest<unknown>('/from_url/', {
			method: 'POST',
			formData: {
				pub_key: publicKeyFromAuth(API_KEY!),
				source_url: 'https://uploadcare.com/favicon.ico',
			},
		});
		UploadcareEndpointOutputSchemas.uploadFromUrl.parse(result);
	});
});
