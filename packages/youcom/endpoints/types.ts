import { z } from 'zod';

const ExampleGetInputSchema = z.object({
	id: z.string(),
});

export type ExampleGetInput = z.infer<typeof ExampleGetInputSchema>;

const ExampleGetResponseSchema = z.object({
	id: z.string(),
});

export type ExampleGetResponse = z.infer<typeof ExampleGetResponseSchema>;

export type YoucomEndpointInputs = {
	exampleGet: ExampleGetInput;
};

export type YoucomEndpointOutputs = {
	exampleGet: ExampleGetResponse;
};

export const YoucomEndpointInputSchemas = {
	exampleGet: ExampleGetInputSchema,
} as const;

export const YoucomEndpointOutputSchemas = {
	exampleGet: ExampleGetResponseSchema,
} as const;
