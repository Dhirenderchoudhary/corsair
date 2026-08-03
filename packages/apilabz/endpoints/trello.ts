import type { ApiLabzEndpoints } from '..';
import { APILABZ_MODULES, executeApiLabzModule } from './shared';
import {
	ApiLabzEndpointInputSchemas,
	ApiLabzEndpointOutputSchemas,
} from './types';

/** AI search across Trello cards (API_LABZ_TRELLO_AI_SEARCH_ENGINE). */
export const aiSearchEngine: ApiLabzEndpoints['trelloAiSearchEngine'] = async (
	ctx,
	input,
) => {
	const parsedInput =
		ApiLabzEndpointInputSchemas.trelloAiSearchEngine.parse(input);
	return executeApiLabzModule(
		ctx,
		'apilabz.trello.aiSearchEngine',
		APILABZ_MODULES.trelloAiSearchEngine,
		parsedInput,
		ApiLabzEndpointOutputSchemas.trelloAiSearchEngine,
	);
};
