import { OpenRouterJsonSchemaStrategy } from './openRouterJsonSchemaStrategy.js';
import { OpenRouterToolCallingStrategy } from './openRouterToolCallingStrategy.js';

/**
 * Default mapping of API types and json output methods to their strategy classes.
 *
 * @type {Object<string, Object<string, Function>>}
 */
const strategyRegistry = {
  openrouter: {
    openrouter_json_schema: OpenRouterJsonSchemaStrategy,
    openrouter_tool_calling: OpenRouterToolCallingStrategy,
  },
};

export default strategyRegistry;
