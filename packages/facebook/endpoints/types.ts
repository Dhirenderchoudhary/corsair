import { z } from 'zod';

const ExampleGetInputSchema = z.object({
	id: z.string(),
});

export type ExampleGetInput = z.infer<typeof ExampleGetInputSchema>;

const ExampleGetResponseSchema = z.object({
	id: z.string(),
});

export type ExampleGetResponse = z.infer<typeof ExampleGetResponseSchema>;

export type FacebookEndpointInputs = {
	exampleGet: ExampleGetInput;
};

export type FacebookEndpointOutputs = {
	exampleGet: ExampleGetResponse;
};

export const FacebookEndpointInputSchemas = {
	exampleGet: ExampleGetInputSchema,
} as const;

export const FacebookEndpointOutputSchemas = {
	exampleGet: ExampleGetResponseSchema,
} as const;
