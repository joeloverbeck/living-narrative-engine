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
          // Add fallback definitions for core events in case mod loading fails
          {
            id: 'core:ui_state_changed',
            description: 'Signals when a UI controller changes its display state.',
            payloadSchema: {
              type: 'object',
              properties: {
                controller: {
                  description: 'The name of the controller that changed state',
                  type: 'string',
                  minLength: 1,
                },
                previousState: {
                  description: 'The previous state (null for initial state change)',
                  oneOf: [
                    {
                      type: 'string',
                      enum: ['empty', 'loading', 'results', 'error'],
                    },
                    {
                      type: 'null',
                    },
                  ],
                },
                currentState: {
                  description: 'The new current state',
                  type: 'string',
                  enum: ['empty', 'loading', 'results', 'error'],
                },
                timestamp: {
                  description: 'ISO 8601 timestamp of when the state change occurred',
                  type: 'string',
                  pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$',
                },
              },
              required: ['controller', 'currentState', 'timestamp'],
              additionalProperties: false,
            },
          },
          {
            id: 'core:controller_initialized',
            description: 'Signals when a character builder controller has completed its initialization process.',
            payloadSchema: {
              type: 'object',
              properties: {
                controllerName: {
                  description: 'The name of the controller that completed initialization',
                  type: 'string',
                  minLength: 1,
                },
                initializationTime: {
                  description: 'Time taken to initialize the controller in milliseconds',
                  type: 'number',
                  minimum: 0,
                },
              },
              required: ['controllerName', 'initializationTime'],
              additionalProperties: false,
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
                // Create a proper UIStateManager with the required DOM elements
                const stateElements = {
                  emptyState: document.getElementById('empty-state'),
                  loadingState: document.getElementById('loading-state'),
                  errorState: document.getElementById('error-state'),
                  resultsState: document.getElementById('results-state'),
                };

                // Only create UIStateManager if all required elements are present
                let uiStateManager = null;
                const hasAllElements = Object.values(stateElements).every(element => element !== null);
                
                if (hasAllElements) {
                  try {
                    uiStateManager = new UIStateManager(stateElements);
                  } catch (error) {
                    // If UIStateManager creation fails, use null and let the controller handle it
                    console.warn('Failed to create UIStateManager, controller will use fallback:', error.message);
                    uiStateManager = null;
                  }
                } else {
                  console.warn('Required UI state elements not found, UIStateManager will be null');
                }

                return new ThematicDirectionsManagerController({
                  logger: c.resolve(tokens.ILogger),
                  characterBuilderService: c.resolve(tokens.CharacterBuilderService),
                  eventBus: c.resolve(tokens.ISafeEventDispatcher),
                  schemaValidator: c.resolve(tokens.ISchemaValidator),
                  uiStateManager: uiStateManager,
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
      console.error('ThematicDirectionsManagerApp: Failed to initialize', error);
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
