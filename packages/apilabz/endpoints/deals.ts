import type { ApiLabzEndpoints } from '..';
import { APILABZ_MODULES, executeApiLabzModule } from './shared';
import {
	ApiLabzEndpointInputSchemas,
	ApiLabzEndpointOutputSchemas,
} from './types';

/** Integrates a deal into API Labz (API_LABZ_INTEGRATE_DEAL). */
export const integrate: ApiLabzEndpoints['dealsIntegrate'] = async (
	ctx,
	input,
) => {
	const parsedInput = ApiLabzEndpointInputSchemas.dealsIntegrate.parse(input);
	return executeApiLabzModule(
		ctx,
		'apilabz.deals.integrate',
		APILABZ_MODULES.dealsIntegrate,
		parsedInput,
		ApiLabzEndpointOutputSchemas.dealsIntegrate,
	);
};
