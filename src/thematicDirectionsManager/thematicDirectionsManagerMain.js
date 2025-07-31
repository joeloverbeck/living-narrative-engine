import ConsoleLogger from '../logging/consoleLogger.js';
import AppContainer from '../dependencyInjection/appContainer.js';
import { configureBaseContainer } from '../dependencyInjection/baseContainerConfig.js';
import { tokens } from '../dependencyInjection/tokens.js';
import { Registrar } from '../utils/registrarHelpers.js';
import { ThematicDirectionsManagerController } from './controllers/thematicDirectionsManagerController.js';

/**
 * Character Builder Events for thematic directions manager
 */
const MANAGER_EVENTS = {
  DIRECTION_UPDATED: 'core:direction_updated',
  DIRECTION_DELETED: 'core:direction_deleted',
  ORPHANS_CLEANED: 'core:orphans_cleaned',
};

class ThematicDirectionsManagerApp {
  #logger;
  #controller;
  #initialized = false;

  constructor() {
    this.#logger = new ConsoleLogger('debug');
  }

  async initialize() {
    if (this.#initialized) {
      this.#logger.warn('ThematicDirectionsManagerApp: Already initialized');
      return;
    }

    try {
      this.#logger.info(
        'ThematicDirectionsManagerApp: Starting initialization'
      );

      // Setup DI container
      const container = new AppContainer();
      container.register(tokens.ILogger, this.#logger);

      await configureBaseContainer(container, {
        includeGameSystems: true,
        includeCharacterBuilder: true,
        logger: this.#logger,
      });

      // Load schemas
      const schemaLoader = container.resolve(tokens.SchemaLoader);
      await schemaLoader.loadAndCompileAllSchemas();

      // Register events
      await this.#registerEventDefinitions(
        container.resolve(tokens.IDataRegistry),
        container.resolve(tokens.ISchemaValidator)
      );

      // Register controller
      this.#registerController(container);

      // Initialize LLM adapter (for any future needs)
      const llmAdapter = container.resolve(tokens.LLMAdapter);
      await llmAdapter.init({
        llmConfigLoader: container.resolve(tokens.LlmConfigLoader),
      });

      // Get and initialize controller
      this.#controller = container.resolve(
        tokens.ThematicDirectionsManagerController
      );
      await this.#controller.initialize();

      this.#initialized = true;
      this.#logger.info(
        'ThematicDirectionsManagerApp: Successfully initialized'
      );
    } catch (error) {
      this.#logger.error(
        'ThematicDirectionsManagerApp: Failed to initialize',
        error
      );
      this.#showInitializationError(error);
      throw error;
    }
  }

  #registerController(container) {
    const registrar = new Registrar(container);
    registrar.singletonFactory(
      tokens.ThematicDirectionsManagerController,
      (c) => {
        return new ThematicDirectionsManagerController({
          logger: c.resolve(tokens.ILogger),
          characterBuilderService: c.resolve(tokens.CharacterBuilderService),
          eventBus: c.resolve(tokens.ISafeEventDispatcher),
          schemaValidator: c.resolve(tokens.ISchemaValidator),
        });
      }
    );
  }

  async #registerEventDefinitions(dataRegistry, schemaValidator) {
    const events = [
      {
        id: MANAGER_EVENTS.DIRECTION_UPDATED,
        description: 'Fired when a thematic direction is updated.',
        payloadSchema: {
          type: 'object',
          required: ['directionId', 'field', 'oldValue', 'newValue'],
          properties: {
            directionId: {
              type: 'string',
              description: 'Updated direction ID',
            },
            field: { type: 'string', description: 'Updated field name' },
            oldValue: { type: 'string', description: 'Previous field value' },
            newValue: { type: 'string', description: 'New field value' },
          },
        },
      },
      {
        id: MANAGER_EVENTS.DIRECTION_DELETED,
        description: 'Fired when a thematic direction is deleted.',
        payloadSchema: {
          type: 'object',
          required: ['directionId'],
          properties: {
            directionId: {
              type: 'string',
              description: 'Deleted direction ID',
            },
          },
        },
      },
      {
        id: MANAGER_EVENTS.ORPHANS_CLEANED,
        description: 'Fired when orphaned directions are cleaned up.',
        payloadSchema: {
          type: 'object',
          required: ['deletedCount'],
          properties: {
            deletedCount: {
              type: 'number',
              description: 'Number of deleted orphaned directions',
            },
          },
        },
      },
    ];

    for (const event of events) {
      await schemaValidator.addSchema(
        event.payloadSchema,
        `${event.id}#payload`
      );
      dataRegistry.setEventDefinition(event.id, event);
    }
  }

  #showInitializationError(error) {
    const errorHtml = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <div style="
          background: #ffffff;
          border-radius: 12px;
          padding: 2rem;
          max-width: 500px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        ">
          <h1 style="
            color: #e74c3c;
            font-size: 1.5rem;
            margin: 0 0 1rem 0;
            font-weight: 600;
          ">
            Thematic Directions Manager Failed to Start
          </h1>
          <p style="
            color: #2c3e50;
            margin: 0 0 1.5rem 0;
            line-height: 1.6;
          ">
            The thematic directions manager could not be initialized. This may be due to 
            a database issue or missing dependencies.
          </p>
          <details style="
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 1rem;
            margin: 0 0 1.5rem 0;
          ">
            <summary style="cursor: pointer; font-weight: 500; color: #495057;">
              Technical Details
            </summary>
            <pre style="
              color: #e74c3c;
              font-size: 0.875rem;
              margin: 0.5rem 0 0 0;
              white-space: pre-wrap;
              word-break: break-word;
            ">${error.message}</pre>
          </details>
          <div style="display: flex; gap: 1rem;">
            <button onclick="window.location.reload()" style="
              background: #6c5ce7;
              color: #ffffff;
              border: none;
              padding: 0.75rem 1.5rem;
              border-radius: 8px;
              cursor: pointer;
              font-weight: 500;
              transition: background 0.2s ease;
            " onmouseover="this.style.background='#5f4bd8'" 
               onmouseout="this.style.background='#6c5ce7'">
              Retry
            </button>
            <a href="index.html" style="
              background: transparent;
              color: #6c5ce7;
              border: 2px solid #6c5ce7;
              padding: 0.75rem 1.5rem;
              border-radius: 8px;
              text-decoration: none;
              font-weight: 500;
              transition: all 0.2s ease;
            " onmouseover="this.style.background='#f8f9fa'" 
               onmouseout="this.style.background='transparent'">
              Back to Main Menu
            </a>
          </div>
        </div>
      </div>
    `;
    document.body.innerHTML = errorHtml;
  }
}

/**
 * Initialize application when DOM is ready
 */
function initializeWhenReady() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
}

/**
 * Initialize the thematic directions manager application
 */
async function initialize() {
  try {
    const app = new ThematicDirectionsManagerApp();
    await app.initialize();
  } catch (error) {
    // Use error display instead of console for consistency
    document.body.innerHTML = `
      <div style="color: red; text-align: center; padding: 2rem;">
        <h1>Failed to initialize thematic directions manager</h1>
        <p>${error.message}</p>
      </div>
    `;
  }
}

initializeWhenReady();

export { ThematicDirectionsManagerApp };
