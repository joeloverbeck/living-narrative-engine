/**
 * @file Unified bootstrap system for character builder pages
 * @description Provides standardized initialization for all character builder pages
 * @see character-concepts-manager-main.js
 * @see thematic-direction-main.js
 */

import AppContainer from '../dependencyInjection/appContainer.js';
import { tokens } from '../dependencyInjection/tokens.js';
import { configureMinimalContainer } from '../dependencyInjection/minimalContainerConfig.js';
import {
  validateDependency,
  assertPresent,
  assertNonBlankString,
} from '../utils/dependencyUtils.js';
import { ensureValidLogger } from '../utils/loggerUtils.js';

/**
 * @typedef {object} BootstrapConfig
 * @property {string} pageName - Unique identifier for the page
 * @property {Function} controllerClass - Constructor for the page controller
 * @property {boolean} [includeModLoading=false] - Whether to load mod data
 * @property {Array<EventDefinition>} [eventDefinitions=[]] - Custom event definitions
 * @property {Array<string>} [customSchemas=[]] - Additional schema paths to load
 * @property {object} [services={}] - Page-specific services to register
 * @property {object} [hooks={}] - Lifecycle hooks for customization
 * @property {object} [errorDisplay={}] - Custom error display configuration
 */

/**
 * @typedef {object} BootstrapResult
 * @property {object} controller - The instantiated controller
 * @property {AppContainer} container - The configured DI container
 * @property {number} bootstrapTime - Time taken to bootstrap in milliseconds
 */

/**
 * @typedef {object} EventDefinition
 * @property {string} id - Event identifier
 * @property {string} description - Event description
 * @property {object} payloadSchema - JSON schema for event payload
 */

/**
 * @typedef {object} BootstrapHooks
 * @property {Function} [preContainer] - Called before container setup
 * @property {Function} [preInit] - Called before controller initialization
 * @property {Function} [postInit] - Called after controller initialization
 */

/**
 * @typedef {object} ErrorDisplayConfig
 * @property {string} [elementId='error-display'] - ID of error display element
 * @property {number} [displayDuration=5000] - How long to show errors (ms)
 * @property {boolean} [dismissible=true] - Whether errors can be dismissed
 */

/**
 * Unified bootstrap system for character builder pages
 * Eliminates code duplication and ensures consistent initialization
 */
export class CharacterBuilderBootstrap {
  #logger = null;
  #performanceMetrics = {
    containerSetup: 0,
    schemaLoading: 0,
    eventRegistration: 0,
    modLoading: 0,
    controllerInit: 0,
    total: 0,
  };

  /**
   * Bootstrap a character builder page with standardized initialization
   *
   * @param {BootstrapConfig} config - Configuration object
   * @returns {Promise<BootstrapResult>} Bootstrap result with controller instance
   * @throws {Error} If bootstrap fails at any stage
   */
  async bootstrap(config) {
    const startTime = performance.now();

    try {
      // Step 1: Validate configuration
      this.#validateConfig(config);

      // Step 2: Setup container with base services
      const container = await this.#setupContainer(config);

      // Step 3: Load schemas (including custom)
      await this.#loadSchemas(container, config);

      // Step 4: Register event definitions
      await this.#registerEvents(container, config);

      // Step 5: Load mods if required
      if (config.includeModLoading) {
        await this.#loadMods(container, config);
      }

      // Step 6: Register page-specific services
      await this.#registerCustomServices(container, config);

      // Step 7: Instantiate controller
      const controller = await this.#createController(container, config);

      // Step 8: Initialize controller
      await this.#initializeController(controller, config);

      // Step 9: Setup error display
      this.#setupErrorDisplay(container, config);

      const bootstrapTime = performance.now() - startTime;
      this.#performanceMetrics.total = bootstrapTime;

      if (this.#logger) {
        this.#logger.info(
          `[CharacterBuilderBootstrap] Page '${config.pageName}' bootstrapped in ${bootstrapTime.toFixed(2)}ms`,
          { metrics: this.#performanceMetrics }
        );
      }

      return {
        controller,
        container,
        bootstrapTime,
      };
    } catch (error) {
      this.#handleBootstrapError(error, config);
      throw error;
    }
  }

  /**
   * Validate bootstrap configuration
   *
   * @private
   * @param {BootstrapConfig} config
   * @throws {Error} If configuration is invalid
   */
  #validateConfig(config) {
    assertPresent(config, 'Bootstrap configuration is required');

    // Use temporary logger for early validation
    const tempLogger = this.#logger || console;
    assertNonBlankString(
      config.pageName,
      'pageName',
      'Bootstrap configuration',
      tempLogger
    );
    assertPresent(config.controllerClass, 'Controller class is required');

    if (typeof config.controllerClass !== 'function') {
      throw new Error('Controller class must be a constructor function');
    }

    if (config.eventDefinitions && !Array.isArray(config.eventDefinitions)) {
      throw new Error('Event definitions must be an array');
    }

    if (config.customSchemas && !Array.isArray(config.customSchemas)) {
      throw new Error('Custom schemas must be an array');
    }

    if (config.services && typeof config.services !== 'object') {
      throw new Error('Services must be an object');
    }

    if (config.hooks && typeof config.hooks !== 'object') {
      throw new Error('Hooks must be an object');
    }
  }

  /**
   * Setup DI container with base services
   *
   * @private
   * @param {BootstrapConfig} config
   * @returns {Promise<AppContainer>}
   */
  async #setupContainer(config) {
    const startTime = performance.now();
    const container = new AppContainer();

    // Configure minimal container with character builder support
    configureMinimalContainer(container, {
      includeCharacterBuilder: true,
    });

    // Execute pre-container hook if provided
    if (config.hooks?.preContainer) {
      await config.hooks.preContainer(container);
    }

    // Resolve logger early for use in other methods
    this.#logger = ensureValidLogger(container.resolve(tokens.ILogger));

    this.#performanceMetrics.containerSetup = performance.now() - startTime;
    if (this.#logger) {
      this.#logger.debug(
        `[CharacterBuilderBootstrap] Container setup completed in ${this.#performanceMetrics.containerSetup.toFixed(2)}ms`
      );
    }

    return container;
  }

  /**
   * Load schemas including custom ones
   *
   * @private
   * @param {AppContainer} container
   * @param {BootstrapConfig} config
   */
  async #loadSchemas(container, config) {
    const startTime = performance.now();
    const schemaValidator = container.resolve(tokens.ISchemaValidator);

    validateDependency(schemaValidator, 'ISchemaValidator', this.#logger, {
      requiredMethods: ['addSchema', 'isSchemaLoaded'],
    });

    // Base schemas required by all character builder pages
    const baseSchemas = [
      '/data/schemas/character-concept.schema.json',
      '/data/schemas/thematic-direction.schema.json',
    ];

    // Combine with custom schemas
    const allSchemas = [...baseSchemas, ...(config.customSchemas || [])];

    if (this.#logger) {
      this.#logger.info(
        `[CharacterBuilderBootstrap] Loading ${allSchemas.length} schemas`
      );
    }

    // Load schemas in parallel for better performance
    const schemaPromises = allSchemas.map(async (schemaPath) => {
      try {
        // Extract schema ID from path for checking if already loaded
        const schemaId = this.#getSchemaIdFromPath(schemaPath);

        if (schemaValidator.isSchemaLoaded?.(schemaId)) {
          if (this.#logger) {
            this.#logger.debug(`Schema already loaded: ${schemaId}`);
          }
          return;
        }

        const response = await fetch(schemaPath);
        if (!response.ok) {
          throw new Error(`Failed to load schema: ${response.status}`);
        }

        const schema = await response.json();
        await schemaValidator.addSchema(schema, schemaId);
        if (this.#logger) {
          this.#logger.debug(`Loaded schema: ${schemaId}`);
        }
      } catch (error) {
        // Log warning but don't fail bootstrap for schema loading issues
        if (this.#logger) {
          this.#logger.warn(
            `Failed to load schema ${schemaPath}: ${error.message}`
          );
        }
      }
    });

    await Promise.all(schemaPromises);

    this.#performanceMetrics.schemaLoading = performance.now() - startTime;
    if (this.#logger) {
      this.#logger.debug(
        `[CharacterBuilderBootstrap] Schema loading completed in ${this.#performanceMetrics.schemaLoading.toFixed(2)}ms`
      );
    }
  }

  /**
   * Register event definitions
   *
   * @private
   * @param {AppContainer} container
   * @param {BootstrapConfig} config
   */
  async #registerEvents(container, config) {
    const startTime = performance.now();
    const dataRegistry = container.resolve(tokens.IDataRegistry);
    const schemaValidator = container.resolve(tokens.ISchemaValidator);

    validateDependency(dataRegistry, 'IDataRegistry', this.#logger, {
      requiredMethods: ['setEventDefinition'],
    });

    // Base events used by all character builder pages
    // Only register these if mods are NOT being loaded (to avoid duplicate registration)
    const baseEvents = config.includeModLoading
      ? []
      : [
          {
            id: 'core:character_concept_created',
            description:
              'Fired when a character concept is successfully created',
            payloadSchema: {
              type: 'object',
              required: ['conceptId', 'concept', 'autoSaved'],
              properties: {
                conceptId: {
                  type: 'string',
                  description: 'The unique ID of the created character concept',
                },
                concept: {
                  type: 'string',
                  description:
                    'The character concept text (truncated for events)',
                },
                autoSaved: {
                  type: 'boolean',
                  description: 'Whether the concept was automatically saved',
                },
              },
              additionalProperties: false,
            },
          },
          {
            id: 'core:character_concept_updated',
            description: 'Fired when a character concept is updated',
            payloadSchema: {
              type: 'object',
              required: ['conceptId', 'previousConcept', 'newConcept'],
              properties: {
                conceptId: {
                  type: 'string',
                  description: 'The unique ID of the updated character concept',
                },
                previousConcept: {
                  type: 'string',
                  description: 'The previous concept text',
                },
                newConcept: {
                  type: 'string',
                  description: 'The new concept text',
                },
              },
              additionalProperties: false,
            },
          },
          {
            id: 'core:character_concept_deleted',
            description: 'Fired when a character concept is deleted',
            payloadSchema: {
              type: 'object',
              required: ['conceptId'],
              properties: {
                conceptId: {
                  type: 'string',
                  description: 'The unique ID of the deleted character concept',
                },
              },
              additionalProperties: false,
            },
          },
          {
            id: 'core:thematic_directions_generated',
            description:
              'Fired when thematic directions are generated for a concept',
            payloadSchema: {
              type: 'object',
              required: ['conceptId', 'directionCount', 'autoSaved'],
              properties: {
                conceptId: {
                  type: 'string',
                  description: 'The unique ID of the character concept',
                },
                directionCount: {
                  type: 'integer',
                  minimum: 0,
                  description: 'The number of thematic directions generated',
                },
                autoSaved: {
                  type: 'boolean',
                  description:
                    'Whether the directions were automatically saved',
                },
              },
              additionalProperties: false,
            },
          },
          {
            id: 'core:thematic_direction_updated',
            description: 'Fired when a thematic direction is updated',
            payloadSchema: {
              type: 'object',
              required: ['directionId', 'conceptId', 'field', 'value'],
              properties: {
                directionId: {
                  type: 'string',
                  description: 'The unique ID of the thematic direction',
                },
                conceptId: {
                  type: 'string',
                  description: 'The unique ID of the parent character concept',
                },
                field: {
                  type: 'string',
                  description: 'The field that was updated',
                },
                value: {
                  description: 'The new value of the field',
                },
              },
              additionalProperties: false,
            },
          },
        ];

    if (this.#logger && config.includeModLoading) {
      this.#logger.debug(
        '[CharacterBuilderBootstrap] Skipping base event registration - events will be loaded from mods'
      );
    }

    // Combine with custom events
    const allEvents = [...baseEvents, ...(config.eventDefinitions || [])];

    // Register events
    for (const eventDef of allEvents) {
      try {
        const payloadSchemaId = `${eventDef.id}#payload`;

        // Check if payload schema is already loaded (e.g., from mods)
        // Only register if not already present to avoid overwrite warnings
        if (!schemaValidator.isSchemaLoaded(payloadSchemaId)) {
          // Register payload schema first
          await schemaValidator.addSchema(
            eventDef.payloadSchema,
            payloadSchemaId
          );

          if (this.#logger) {
            this.#logger.debug(`Registered payload schema: ${payloadSchemaId}`);
          }
        } else {
          if (this.#logger) {
            this.#logger.debug(
              `Skipping payload schema registration for ${payloadSchemaId} - already loaded from mods`
            );
          }
        }

        // Register event definition (always register as data registry is separate)
        dataRegistry.setEventDefinition(eventDef.id, eventDef);

        if (this.#logger) {
          this.#logger.debug(`Registered event: ${eventDef.id}`);
        }
      } catch (error) {
        if (this.#logger) {
          this.#logger.warn(
            `Failed to register event ${eventDef.id}: ${error.message}`
          );
        }
      }
    }

    this.#performanceMetrics.eventRegistration = performance.now() - startTime;
    if (this.#logger) {
      this.#logger.debug(
        `[CharacterBuilderBootstrap] Event registration completed in ${this.#performanceMetrics.eventRegistration.toFixed(2)}ms`
      );
    }
  }

  /**
   * Load mods if required
   *
   * @private
   * @param {AppContainer} container
   * @param {BootstrapConfig} config
   */
  async #loadMods(container, config) {
    const startTime = performance.now();
    const modsLoader = container.resolve(tokens.ModsLoader);

    if (!modsLoader) {
      if (this.#logger) {
        this.#logger.warn(
          '[CharacterBuilderBootstrap] ModsLoader not available'
        );
      }
      return;
    }

    try {
      if (this.#logger) {
        this.#logger.info('[CharacterBuilderBootstrap] Loading core mod...');
      }
      await modsLoader.loadMods('default', ['core']);
      if (this.#logger) {
        this.#logger.info(
          '[CharacterBuilderBootstrap] Core mod loaded successfully'
        );
      }
    } catch (error) {
      if (this.#logger) {
        this.#logger.warn(
          `[CharacterBuilderBootstrap] Failed to load mods: ${error.message}`
        );
      }
    }

    this.#performanceMetrics.modLoading = performance.now() - startTime;
  }

  /**
   * Register page-specific services
   *
   * @private
   * @param {AppContainer} container
   * @param {BootstrapConfig} config
   */
  async #registerCustomServices(container, config) {
    if (!config.services) {
      return;
    }

    for (const [token, service] of Object.entries(config.services)) {
      try {
        container.register(token, service);
        if (this.#logger) {
          this.#logger.debug(
            `[CharacterBuilderBootstrap] Registered custom service: ${String(token)}`
          );
        }
      } catch (error) {
        if (this.#logger) {
          this.#logger.warn(
            `[CharacterBuilderBootstrap] Failed to register service ${String(token)}: ${error.message}`
          );
        }
      }
    }
  }

  /**
   * Create controller instance
   *
   * @private
   * @param {AppContainer} container
   * @param {BootstrapConfig} config
   * @returns {Promise<object>}
   */
  async #createController(container, config) {
    const { controllerClass } = config;

    // Resolve standard dependencies
    const dependencies = {
      logger: ensureValidLogger(container.resolve(tokens.ILogger)),
      characterBuilderService: container.resolve(
        tokens.CharacterBuilderService
      ),
      eventBus: container.resolve(tokens.ISafeEventDispatcher),
      schemaValidator: container.resolve(tokens.ISchemaValidator),
      clicheGenerator: container.resolve(tokens.ClicheGenerator),
      ...config.services, // Additional page-specific services
    };

    // Validate required services
    if (!dependencies.characterBuilderService) {
      throw new Error('CharacterBuilderService not found in container');
    }

    if (!dependencies.eventBus) {
      throw new Error('SafeEventDispatcher not found in container');
    }

    // Create controller instance
    return new controllerClass(dependencies);
  }

  /**
   * Initialize controller
   *
   * @private
   * @param {object} controller
   * @param {BootstrapConfig} config
   */
  async #initializeController(controller, config) {
    const startTime = performance.now();

    try {
      // Execute pre-init hook
      if (config.hooks?.preInit) {
        await config.hooks.preInit(controller);
      }

      // Initialize controller
      if (typeof controller.initialize !== 'function') {
        throw new Error('Controller must have an initialize method');
      }

      await controller.initialize();

      // Execute post-init hook
      if (config.hooks?.postInit) {
        await config.hooks.postInit(controller);
      }

      this.#performanceMetrics.controllerInit = performance.now() - startTime;
      if (this.#logger) {
        this.#logger.debug(
          `[CharacterBuilderBootstrap] Controller initialization completed in ${this.#performanceMetrics.controllerInit.toFixed(2)}ms`
        );
      }
    } catch (error) {
      throw new Error(`Controller initialization failed: ${error.message}`);
    }
  }

  /**
   * Setup error display
   *
   * @private
   * @param {AppContainer} container
   * @param {BootstrapConfig} config
   */
  #setupErrorDisplay(container, config) {
    const eventBus = container.resolve(tokens.ISafeEventDispatcher);
    const errorConfig = {
      elementId: 'error-display',
      displayDuration: 5000,
      dismissible: true,
      ...config.errorDisplay,
    };

    // Find or create error display element
    let errorElement = document.getElementById(errorConfig.elementId);
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.id = errorConfig.elementId;
      errorElement.className = 'cb-error-display';
      document.body.appendChild(errorElement);
    }

    // Listen for error events
    eventBus.subscribe('SYSTEM_ERROR_OCCURRED', (event) => {
      this.#displayError(event.payload.error, errorElement, errorConfig);
    });

    if (this.#logger) {
      this.#logger.debug(
        `[CharacterBuilderBootstrap] Error display configured with element: ${errorConfig.elementId}`
      );
    }
  }

  /**
   * Display error in UI
   *
   * @private
   * @param {Error|string} error
   * @param {HTMLElement} container
   * @param {ErrorDisplayConfig} config
   */
  #displayError(error, container, config) {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorDiv = document.createElement('div');
    errorDiv.className = 'cb-error-message';
    errorDiv.innerHTML = `
      <div class="cb-error-icon">⚠️</div>
      <div class="cb-error-text">${this.#escapeHtml(errorMessage)}</div>
      ${config.dismissible ? '<button class="cb-error-dismiss">×</button>' : ''}
    `;

    container.appendChild(errorDiv);

    // Setup dismiss button
    if (config.dismissible) {
      const dismissBtn = errorDiv.querySelector('.cb-error-dismiss');
      dismissBtn.addEventListener('click', () => errorDiv.remove());
    }

    // Auto-dismiss after timeout
    setTimeout(() => errorDiv.remove(), config.displayDuration);
  }

  /**
   * Handle bootstrap errors
   *
   * @private
   * @param {Error} error
   * @param {BootstrapConfig} config
   */
  #handleBootstrapError(error, config) {
    const errorMsg = `[CharacterBuilderBootstrap] Fatal error during initialization of '${config.pageName}': ${error.message}`;

    if (this.#logger) {
      this.#logger.error(errorMsg, error);
    } else {
      console.error(errorMsg, error);
    }

    // Display user-friendly error
    this.#showFatalError(config.pageName, error);
  }

  /**
   * Show fatal error to user
   *
   * @private
   * @param {string} pageName
   * @param {Error} error
   */
  #showFatalError(pageName, error) {
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
            ⚠️ ${this.#escapeHtml(pageName)} Failed to Start
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
            ">${this.#escapeHtml(error.message)}</pre>
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
            🔄 Reload Page
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
            🏠 Return to Menu
          </a>
        </div>
      </div>
    `;

    document.body.innerHTML = errorHtml;
  }

  /**
   * Get schema ID from file path
   *
   * @private
   * @param {string} schemaPath
   * @returns {string}
   */
  #getSchemaIdFromPath(schemaPath) {
    const filename = schemaPath.split('/').pop();
    return `schema://living-narrative-engine/${filename}`;
  }

  /**
   * Escape HTML for safe display
   *
   * @private
   * @param {string} text
   * @returns {string}
   */
  #escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

export default CharacterBuilderBootstrap;
