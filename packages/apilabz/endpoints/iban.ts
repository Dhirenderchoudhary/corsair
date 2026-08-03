import type { ApiLabzEndpoints } from '..';
import { APILABZ_MODULES, executeApiLabzModule } from './shared';
import {
	ApiLabzEndpointInputSchemas,
	ApiLabzEndpointOutputSchemas,
} from './types';

/** Validates an IBAN (API_LABZ_IBAN_VALIDATOR). */
export const validate: ApiLabzEndpoints['ibanValidate'] = async (
	ctx,
	input,
) => {
	const parsedInput = ApiLabzEndpointInputSchemas.ibanValidate.parse(input);
	return executeApiLabzModule(
		ctx,
		'apilabz.iban.validate',
		APILABZ_MODULES.ibanValidate,
		parsedInput,
		ApiLabzEndpointOutputSchemas.ibanValidate,
	);
};
