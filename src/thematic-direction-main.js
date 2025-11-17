/**
 * @file Thematic Direction Generator main entry point
 * @description Initializes and bootstraps the thematic direction generator application
 */

import { CharacterBuilderBootstrap } from './characterBuilder/CharacterBuilderBootstrap.js';
import { ThematicDirectionController } from './thematicDirection/controllers/thematicDirectionController.js';
import { tokens } from './dependencyInjection/tokens.js';
import { Registrar } from './utils/registrarHelpers.js';

/**
 * Thematic Direction Generator Application class
 */
class ThematicDirectionApp {
  /**
   * Initialize the thematic direction generator application
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Create bootstrap instance
      const bootstrap = new CharacterBuilderBootstrap();

      // Configure bootstrap
      const config = {
        pageName: 'Thematic Direction Generator',
        controllerClass: ThematicDirectionController,
        includeModLoading: true, // Load core mod for event definitions
        customSchemas: [
          // Additional schemas specific to thematic direction
          '/data/schemas/llm-configs.schema.json',
        ],
        hooks: {
          preContainer: async (container) => {
            // Register thematic direction controller factory
            const registrar = new Registrar(container);
            registrar.singletonFactory(
              tokens.ThematicDirectionController,
              (c) => {
                return new ThematicDirectionController({
                  logger: c.resolve(tokens.ILogger),
                  characterBuilderService: c.resolve(
                    tokens.CharacterBuilderService
                  ),
                  eventBus: c.resolve(tokens.ISafeEventDispatcher),
                  schemaValidator: c.resolve(tokens.ISchemaValidator),
                });
              }
            );

            // Initialize LLM infrastructure
            // Load all schemas using SchemaLoader if available
            const schemaLoader = container.resolve(tokens.SchemaLoader);
            if (schemaLoader?.loadAndCompileAllSchemas) {
              await schemaLoader.loadAndCompileAllSchemas();
            }

            // Initialize LLM adapter if available
            const llmAdapter = container.resolve(tokens.LLMAdapter);
            if (llmAdapter?.init) {
              const llmConfigLoader = container.resolve(tokens.LlmConfigLoader);
              await llmAdapter.init({ llmConfigLoader });
            }
          },
        },
        errorDisplay: {
          elementId: 'error-display',
          displayDuration: 5000,
          dismissible: true,
        },
      };

      // Bootstrap the application
      const { controller, container, bootstrapTime } =
        await bootstrap.bootstrap(config);

      console.log(
        `Thematic Direction Generator initialized successfully in ${bootstrapTime.toFixed(2)}ms`
      );
    } catch (error) {
      console.error(
        'Failed to initialize thematic direction generator:',
        error
      );
      // Error display is handled by bootstrap
    }
  }
}

/**
 * Initialize the thematic direction generator when DOM is ready
 */
function initializeWhenReady() {
  if (typeof document === 'undefined') {
    return;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
}

/**
 * Initialize the application
 */
async function initialize() {
  try {
    const app = new ThematicDirectionApp();
    await app.initialize();
  } catch (error) {
    console.error('Failed to initialize thematic direction generator:', error);
    // Error display is handled by the app itself
  }
}

// Start the application
if (typeof document !== 'undefined') {
  initializeWhenReady();
}

export { ThematicDirectionApp };
