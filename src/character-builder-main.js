/**
 * @file Character Builder main entry point
 * @description Initializes and bootstraps the character builder application
 */

import ConsoleLogger from './logging/consoleLogger.js';
import EventBus from './events/eventBus.js';
import ValidatedEventDispatcher from './events/validatedEventDispatcher.js';
import { SafeEventDispatcher } from './events/safeEventDispatcher.js';
import GameDataRepository from './data/gameDataRepository.js';
import AjvSchemaValidator from './validation/ajvSchemaValidator.js';
// Removed complex LLM imports - using simple mocks instead

// Character Builder imports
import { CharacterDatabase } from './characterBuilder/storage/characterDatabase.js';
import { CharacterStorageService } from './characterBuilder/services/characterStorageService.js';
import { ThematicDirectionGenerator } from './characterBuilder/services/thematicDirectionGenerator.js';
import { CharacterBuilderService } from './characterBuilder/services/characterBuilderService.js';
import { CharacterBuilderController } from './characterBuilder/controllers/characterBuilderController.js';

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
      this.#logger.info('CharacterBuilderApp: Starting initialization');

      // Create schema validator first
      const schemaValidator = new AjvSchemaValidator({
        logger: this.#logger,
      });

      // Load schemas before creating event system
      await this.#loadSchemas(schemaValidator);

      // Create event system with proper initialization chain
      const rawEventBus = new EventBus({ logger: this.#logger });

      // Create a minimal mock registry for character builder
      // This is needed by ValidatedEventDispatcher but we won't use most game data features
      const mockRegistry = {
        // World-related methods
        getWorldDefinition: () => null,
        getAllWorldDefinitions: () => [],
        getStartingPlayerId: () => 'player',
        getStartingLocationId: () => 'starting_location',

        // Game content methods (unused in character builder)
        getActionDefinition: () => null,
        getAllActionDefinitions: () => [],
        getEntityDefinition: () => null,
        getAllEntityDefinitions: () => [],
        getEventDefinition: () => null,
        getAllEventDefinitions: () => [],
        getComponentDefinition: () => null,
        getAllComponentDefinitions: () => [],
        getConditionDefinition: () => null,
        getAllConditionDefinitions: () => [],
        getGoalDefinition: () => null,
        getAllGoalDefinitions: () => [],
        getEntityInstanceDefinition: () => null,
        getAllEntityInstanceDefinitions: () => [],

        // Generic data methods
        get: () => undefined,
        getAll: () => ({}),
        clear: () => {},
        store: () => {},
      };

      const gameDataRepository = new GameDataRepository(
        mockRegistry,
        this.#logger
      );

      const validatedEventDispatcher = new ValidatedEventDispatcher({
        eventBus: rawEventBus,
        gameDataRepository,
        schemaValidator,
        logger: this.#logger,
      });

      const eventBus = new SafeEventDispatcher({
        validatedEventDispatcher,
        logger: this.#logger,
      });

      // Create character builder specific services
      const database = new CharacterDatabase({
        logger: this.#logger,
      });

      const storageService = new CharacterStorageService({
        logger: this.#logger,
        database,
        schemaValidator,
      });

      // Create minimal mock LLM services for character builder
      // The character builder doesn't need full LLM functionality, just basic concept generation
      const mockLlmJsonService = {
        generateJsonWithSchema: async () => ({
          directions: [
            {
              theme: 'Adventure',
              description: 'A brave character ready for exploration',
            },
            {
              theme: 'Mystery',
              description: 'Someone with secrets to uncover',
            },
            {
              theme: 'Growth',
              description: 'A character on a journey of personal development',
            },
          ],
        }),
        clean: (text) => text || '', // Simple cleanup method for character builder
        parseAndRepair: (text) => {
          try {
            return JSON.parse(text || '{}');
          } catch {
            return {}; // Fallback for character builder
          }
        },
      };

      const mockLlmStrategyFactory = {
        createStrategy: () => ({
          generateText: async () => 'Generated thematic direction content',
        }),
        getStrategy: (strategyType) => ({
          generateText: async () => 'Generated thematic direction content',
        }),
      };

      const mockLlmConfigManager = {
        getCurrentConfig: () => ({
          modelName: 'mock-model',
          temperature: 0.7,
        }),
        loadConfiguration: async () => {
          // Mock configuration loading for character builder
          return Promise.resolve();
        },
      };

      const directionGenerator = new ThematicDirectionGenerator({
        logger: this.#logger,
        llmJsonService: mockLlmJsonService,
        llmStrategyFactory: mockLlmStrategyFactory,
        llmConfigManager: mockLlmConfigManager,
      });

      const characterBuilderService = new CharacterBuilderService({
        logger: this.#logger,
        storageService,
        directionGenerator,
        eventBus,
      });

      // Create UI controller
      this.#controller = new CharacterBuilderController({
        logger: this.#logger,
        characterBuilderService,
        eventBus,
      });

      // Initialize the controller
      await this.#controller.initialize();

      this.#initialized = true;
      this.#logger.info('CharacterBuilderApp: Successfully initialized');
    } catch (error) {
      this.#logger.error('CharacterBuilderApp: Failed to initialize', error);
      this.#showInitializationError(error);
      throw error;
    }
  }

  /**
   * Load JSON schemas for validation
   *
   * @private
   * @param {AjvSchemaValidator} schemaValidator - Schema validator instance
   */
  async #loadSchemas(schemaValidator) {
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
