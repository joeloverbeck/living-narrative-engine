/**
 * @file Character Builder main entry point
 * @description Initializes and bootstraps the character builder application
 */

import ConsoleLogger from './logging/consoleLogger.js';

// DI Container imports
import AppContainer from './dependencyInjection/appContainer.js';
import { configureBaseContainer } from './dependencyInjection/baseContainerConfig.js';
import { tokens } from './dependencyInjection/tokens.js';

/**
 * Character Builder Application class
 */
class CharacterBuilderApp {
  #logger;
  #controller;
  #initialized = false;

  constructor() {
    this.#logger = new ConsoleLogger('debug');
  }

  /**
   * Initialize the character builder application
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.#initialized) {
      this.#logger.warn('CharacterBuilderApp: Already initialized');
      return;
    }

    try {
      this.#logger.info(
        'CharacterBuilderApp: Starting initialization with DI container'
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
        'CharacterBuilderApp: Loaded all schemas via SchemaLoader'
      );

      // Load character-specific schemas that might not be in the standard list
      const schemaValidator = container.resolve(tokens.ISchemaValidator);
      await this.#loadCharacterSpecificSchemas(schemaValidator);

      // Initialize LLM adapter
      const llmAdapter = container.resolve(tokens.LLMAdapter);
      await llmAdapter.init({
        llmConfigLoader: container.resolve(tokens.LlmConfigLoader),
      });

      // Get controller from container
      this.#controller = container.resolve(tokens.CharacterBuilderController);

      // Initialize the controller
      await this.#controller.initialize();

      this.#initialized = true;
      this.#logger.info(
        'CharacterBuilderApp: Successfully initialized with unified LLM infrastructure'
      );
    } catch (error) {
      this.#logger.error('CharacterBuilderApp: Failed to initialize', error);
      this.#showInitializationError(error);
      throw error;
    }
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

      this.#logger.debug('CharacterBuilderApp: Loaded JSON schemas');
    } catch (error) {
      this.#logger.error('CharacterBuilderApp: Failed to load schemas', error);
      throw new Error(`Schema loading failed: ${error.message}`);
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
        background: var(--bg-primary, #1a1a1a);
        color: var(--text-primary, #ffffff);
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
          <h1 style="color: var(--status-error, #ff4444); margin-bottom: 1rem;">
            Character Builder Failed to Start
          </h1>
          <p style="margin-bottom: 2rem; line-height: 1.6;">
            The character builder could not be initialized. Please check your browser's console for more details.
          </p>
          <details style="text-align: left; margin-bottom: 2rem;">
            <summary style="cursor: pointer; margin-bottom: 1rem;">Technical Details</summary>
            <pre style="
              background: rgba(255,255,255,0.1);
              padding: 1rem;
              border-radius: 4px;
              overflow-x: auto;
              font-size: 0.875rem;
            ">${error.message}</pre>
          </details>
          <button onclick="window.location.reload()" style="
            background: var(--accent-primary, #4a90e2);
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
            color: var(--text-secondary, #aaaaaa);
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
 * Initialize the character builder when DOM is ready
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
    const app = new CharacterBuilderApp();
    await app.initialize();
  } catch (error) {
    console.error('Failed to initialize character builder:', error);
    // Error display is handled by the app itself
  }
}

// Start the application
initializeWhenReady();

export { CharacterBuilderApp };
