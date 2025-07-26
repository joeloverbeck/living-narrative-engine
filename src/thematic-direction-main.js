/**
 * @file Thematic Direction Generator main entry point
 * @description Initializes and bootstraps the thematic direction generator application
 */

import ConsoleLogger from './logging/consoleLogger.js';

// DI Container imports
import AppContainer from './dependencyInjection/appContainer.js';
import { configureBaseContainer } from './dependencyInjection/baseContainerConfig.js';
import { tokens } from './dependencyInjection/tokens.js';
import { Registrar } from './utils/registrarHelpers.js';

// Import the controller we'll create
import { ThematicDirectionController } from './thematicDirection/controllers/thematicDirectionController.js';

/**
 * Thematic Direction Generator Application class
 */
class ThematicDirectionApp {
  #logger;
  #controller;
  #initialized = false;

  constructor() {
    this.#logger = new ConsoleLogger('debug');
  }

  /**
   * Initialize the thematic direction generator application
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.#initialized) {
      this.#logger.warn('ThematicDirectionApp: Already initialized');
      return;
    }

    try {
      this.#logger.info(
        'ThematicDirectionApp: Starting initialization with DI container'
      );

      // Create and configure DI container
      const container = new AppContainer();

      // Register logger first so it's available during container configuration
      container.register(tokens.ILogger, this.#logger);

      // Configure the container with character builder services
      await configureBaseContainer(container, {
        includeGameSystems: true, // Needed for LLM infrastructure
        includeCharacterBuilder: true, // Enable character builder services
        logger: this.#logger,
      });

      // Load all schemas using SchemaLoader (includes llm-configs.schema.json)
      const schemaLoader = container.resolve(tokens.SchemaLoader);
      await schemaLoader.loadAndCompileAllSchemas();
      this.#logger.info(
        'ThematicDirectionApp: Loaded all schemas via SchemaLoader'
      );

      // Load character-specific schemas that might not be in the standard list
      const schemaValidator = container.resolve(tokens.ISchemaValidator);
      await this.#loadCharacterSpecificSchemas(schemaValidator);

      // Register required event definitions for this standalone page
      const dataRegistry = container.resolve(tokens.IDataRegistry);
      await this.#registerEventDefinitions(dataRegistry, schemaValidator);

      // Register the thematic direction controller
      this.#registerThematicDirectionController(container);

      // Initialize LLM adapter
      const llmAdapter = container.resolve(tokens.LLMAdapter);
      await llmAdapter.init({
        llmConfigLoader: container.resolve(tokens.LlmConfigLoader),
      });

      // Get controller from container
      this.#controller = container.resolve(tokens.ThematicDirectionController);

      // Initialize the controller
      await this.#controller.initialize();

      this.#initialized = true;
      this.#logger.info(
        'ThematicDirectionApp: Successfully initialized with unified LLM infrastructure'
      );
    } catch (error) {
      this.#logger.error('ThematicDirectionApp: Failed to initialize', error);
      this.#showInitializationError(error);
      throw error;
    }
  }

  /**
   * Register the thematic direction controller in the container
   *
   * @private
   * @param {AppContainer} container - DI container
   */
  #registerThematicDirectionController(container) {
    const registrar = new Registrar(container);

    registrar.singletonFactory(tokens.ThematicDirectionController, (c) => {
      return new ThematicDirectionController({
        logger: c.resolve(tokens.ILogger),
        characterBuilderService: c.resolve(tokens.CharacterBuilderService),
        eventBus: c.resolve(tokens.ISafeEventDispatcher),
        schemaValidator: c.resolve(tokens.ISchemaValidator),
      });
    });

    this.#logger.debug(
      'ThematicDirectionApp: Registered ThematicDirectionController'
    );
  }

  /**
   * Load character-specific schemas that aren't in the standard schema list
   *
   * @private
   * @param {AjvSchemaValidator} schemaValidator - Schema validator instance
   */
  async #loadCharacterSpecificSchemas(schemaValidator) {
    try {
      // Load thematic direction schema first (it has no dependencies)
      const directionSchemaResponse = await fetch(
        'data/schemas/thematic-direction.schema.json'
      );
      if (!directionSchemaResponse.ok) {
        throw new Error(
          `Failed to load thematic direction schema: ${directionSchemaResponse.status}`
        );
      }
      const directionSchema = await directionSchemaResponse.json();
      await schemaValidator.addSchema(directionSchema, 'thematic-direction');

      // Load character concept schema second (it references thematic-direction)
      const conceptSchemaResponse = await fetch(
        'data/schemas/character-concept.schema.json'
      );
      if (!conceptSchemaResponse.ok) {
        throw new Error(
          `Failed to load character concept schema: ${conceptSchemaResponse.status}`
        );
      }
      const conceptSchema = await conceptSchemaResponse.json();
      await schemaValidator.addSchema(conceptSchema, 'character-concept');

      this.#logger.debug('ThematicDirectionApp: Loaded JSON schemas');
    } catch (error) {
      this.#logger.error('ThematicDirectionApp: Failed to load schemas', error);
      throw new Error(`Schema loading failed: ${error.message}`);
    }
  }

  /**
   * Register event definitions required by the thematic direction generator
   *
   * @private
   * @param {IDataRegistry} dataRegistry - Data registry instance
   * @param {ISchemaValidator} schemaValidator - Schema validator instance
   */
  async #registerEventDefinitions(dataRegistry, schemaValidator) {
    try {
      // Define CHARACTER_CONCEPT_CREATED event
      const characterConceptCreatedEvent = {
        id: 'thematic:character_concept_created',
        description: 'Fired when a character concept is successfully created in the thematic direction generator.',
        payloadSchema: {
          description: 'Defines the structure for the CHARACTER_CONCEPT_CREATED event payload.',
          type: 'object',
          required: ['conceptId', 'concept', 'autoSaved'],
          properties: {
            conceptId: {
              type: 'string',
              description: 'The unique ID of the created character concept.'
            },
            concept: {
              type: 'string',
              description: 'The character concept text (truncated for events).'
            },
            autoSaved: {
              type: 'boolean',
              description: 'Whether the concept was automatically saved.'
            }
          },
          additionalProperties: false
        }
      };

      // Define THEMATIC_DIRECTIONS_GENERATED event
      const thematicDirectionsGeneratedEvent = {
        id: 'thematic:thematic_directions_generated',
        description: 'Fired when thematic directions are successfully generated for a character concept.',
        payloadSchema: {
          description: 'Defines the structure for the THEMATIC_DIRECTIONS_GENERATED event payload.',
          type: 'object',
          required: ['conceptId', 'directionCount', 'autoSaved'],
          properties: {
            conceptId: {
              type: 'string',
              description: 'The unique ID of the character concept.'
            },
            directionCount: {
              type: 'integer',
              minimum: 0,
              description: 'The number of thematic directions generated.'
            },
            autoSaved: {
              type: 'boolean',
              description: 'Whether the directions were automatically saved.'
            }
          },
          additionalProperties: false
        }
      };

      // Register payload schemas first
      await schemaValidator.addSchema(
        characterConceptCreatedEvent.payloadSchema,
        'thematic:character_concept_created#payload'
      );
      await schemaValidator.addSchema(
        thematicDirectionsGeneratedEvent.payloadSchema,
        'thematic:thematic_directions_generated#payload'
      );

      // Register event definitions in the data registry
      dataRegistry.setEventDefinition('thematic:character_concept_created', characterConceptCreatedEvent);
      dataRegistry.setEventDefinition('thematic:thematic_directions_generated', thematicDirectionsGeneratedEvent);

      this.#logger.info('ThematicDirectionApp: Registered event definitions for thematic:character_concept_created and thematic:thematic_directions_generated');

    } catch (error) {
      this.#logger.error('ThematicDirectionApp: Failed to register event definitions', error);
      throw new Error(`Event definition registration failed: ${error.message}`);
    }
  }

  /**
   * Show initialization error to user
   *
   * @private
   * @param {Error} error - Initialization error
   */
  #showInitializationError(error) {
    const errorHtml = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: var(--primary-bg-color, #f5f5f5);
        color: var(--primary-text-color, #333333);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 2rem;
        font-family: system-ui, -apple-system, sans-serif;
        z-index: 10000;
      ">
        <div style="max-width: 500px;">
          <h1 style="color: var(--error-color, #d32f2f); margin-bottom: 1rem;">
            Thematic Direction Generator Failed to Start
          </h1>
          <p style="margin-bottom: 2rem; line-height: 1.6;">
            The application could not be initialized. Please check your browser's console for more details.
          </p>
          <details style="text-align: left; margin-bottom: 2rem;">
            <summary style="cursor: pointer; margin-bottom: 1rem;">Technical Details</summary>
            <pre style="
              background: rgba(0,0,0,0.05);
              padding: 1rem;
              border-radius: 4px;
              overflow-x: auto;
              font-size: 0.875rem;
            ">${error.message}</pre>
          </details>
          <button onclick="window.location.reload()" style="
            background: var(--primary-color, #1976d2);
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1rem;
          ">
            Retry
          </button>
          <a href="index.html" style="
            display: inline-block;
            margin-left: 1rem;
            padding: 0.75rem 1.5rem;
            color: var(--secondary-text-color, #666666);
            text-decoration: none;
            border: 1px solid currentColor;
            border-radius: 6px;
          ">
            Back to Main Menu
          </a>
        </div>
      </div>
    `;

    document.body.innerHTML = errorHtml;
  }
}

/**
 * Initialize the thematic direction generator when DOM is ready
 */
function initializeWhenReady() {
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
initializeWhenReady();

export { ThematicDirectionApp };
