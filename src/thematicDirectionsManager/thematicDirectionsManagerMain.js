import { CharacterBuilderBootstrap } from '../characterBuilder/CharacterBuilderBootstrap.js';
import { ThematicDirectionsManagerController } from './controllers/thematicDirectionsManagerController.js';
import { tokens } from '../dependencyInjection/tokens.js';
import { Registrar } from '../utils/registrarHelpers.js';
import { UIStateManager } from '../shared/characterBuilder/uiStateManager.js';

/**
 * Character Builder Events for thematic directions manager
 */
const MANAGER_EVENTS = {
  DIRECTION_UPDATED: 'core:direction_updated',
  DIRECTION_DELETED: 'core:direction_deleted',
  ORPHANS_CLEANED: 'core:orphans_cleaned',
};

class ThematicDirectionsManagerApp {
  #bootstrap;
  #result;
  #initialized = false;

  constructor() {
    this.#bootstrap = new CharacterBuilderBootstrap();
  }

  async initialize() {
    if (this.#initialized) {
      console.warn('ThematicDirectionsManagerApp: Already initialized');
      return;
    }

    try {
      console.log('ThematicDirectionsManagerApp: Starting initialization');

      // Configure bootstrap with mod loading enabled to load event definitions from core mod
      const config = {
        pageName: 'Thematic Directions Manager',
        controllerClass: ThematicDirectionsManagerController,
        includeModLoading: true, // KEY FIX: Load event definitions from mods
        eventDefinitions: [
          // Add the custom events specific to this manager
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
                oldValue: {
                  type: 'string',
                  description: 'Previous field value',
                },
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
        ],
        hooks: {
          preContainer: async (container) => {
            // Register thematic directions manager controller factory
            const registrar = new Registrar(container);
            registrar.singletonFactory(
              tokens.ThematicDirectionsManagerController,
              (c) => {
                // The BaseCharacterBuilderController will automatically initialize UIStateManager
                // from the DOM elements it finds, so we don't need to create it here
                return new ThematicDirectionsManagerController({
                  logger: c.resolve(tokens.ILogger),
                  characterBuilderService: c.resolve(
                    tokens.CharacterBuilderService
                  ),
                  eventBus: c.resolve(tokens.ISafeEventDispatcher),
                  schemaValidator: c.resolve(tokens.ISchemaValidator),
                });
              }
            );
          },
        },
      };

      // Bootstrap the application
      this.#result = await this.#bootstrap.bootstrap(config);

      this.#initialized = true;
      console.log('ThematicDirectionsManagerApp: Successfully initialized');
    } catch (error) {
      console.error(
        'ThematicDirectionsManagerApp: Failed to initialize',
        error
      );
      this.#showInitializationError(error);
      throw error;
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
    if (typeof document !== 'undefined') {
      document.body.innerHTML = errorHtml;
    }
  }
}

/**
 * Initialize application when DOM is ready
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
 * Initialize the thematic directions manager application
 */
async function initialize() {
  try {
    const app = new ThematicDirectionsManagerApp();
    await app.initialize();
  } catch (error) {
    // Use error display instead of console for consistency
    if (typeof document !== 'undefined') {
      document.body.innerHTML = `
      <div style="color: red; text-align: center; padding: 2rem;">
        <h1>Failed to initialize thematic directions manager</h1>
        <p>${error.message}</p>
      </div>
    `;
    }
  }
}

if (typeof document !== 'undefined') {
  initializeWhenReady();
}

export { ThematicDirectionsManagerApp };
