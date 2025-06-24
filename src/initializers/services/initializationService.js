// src/initializers/services/initializationService.js

// --- Type Imports ---
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../loaders/modsLoader.js').default} ModsLoader */
/** @typedef {import('../systemInitializer.js').default} SystemInitializer */
/** @typedef {import('../worldInitializer.js').default} WorldInitializer */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../loaders/llmConfigLoader.js').LlmConfigLoader} LlmConfigLoader */
/** @typedef {import('../../events/safeEventDispatcher.js').default} ISafeEventDispatcher */
/** @typedef {import('../../actions/actionIndex.js').ActionIndex} ActionIndex */

// --- Interface Imports for JSDoc & `extends` ---
/** @typedef {import('../../interfaces/IInitializationService.js').InitializationResult} InitializationResult */
import { IInitializationService } from '../../interfaces/IInitializationService.js';
import { ThoughtPersistenceListener } from '../../ai/thoughtPersistenceListener.js';
import { NotesPersistenceListener } from '../../ai/notesPersistenceListener.js';
import {
  ACTION_DECIDED_ID,
  INITIALIZATION_SERVICE_FAILED_ID,
  UI_SHOW_FATAL_ERROR_ID,
} from '../../constants/eventIds.js';

/**
 * Service responsible for orchestrating the entire game initialization sequence.
 *
 * @implements {IInitializationService}
 */
class InitializationService extends IInitializationService {
  #logger;
  #validatedEventDispatcher;
  #modsLoader;
  #scopeRegistry;
  #dataRegistry;
  #llmAdapter;
  #llmConfigLoader;
  #systemInitializer;
  #worldInitializer;
  #safeEventDispatcher;
  #entityManager;
  #domUiFacade;
  #actionIndex;
  #gameDataRepository;

  /**
   * Creates a new InitializationService instance.
   *
   * @param {object} dependencies - The required service dependencies.
   * @param {ILogger} dependencies.logger - The logging service.
   * @param {ValidatedEventDispatcher} dependencies.validatedEventDispatcher - The validated event dispatcher.
   * @param {ModsLoader} dependencies.modsLoader - Loader for world data mods.
   * @param {import('../../interfaces/IScopeRegistry.js').IScopeRegistry} dependencies.scopeRegistry - Registry of scopes.
   * @param {import('../../data/dataRegistry.js').DataRegistry} dependencies.dataRegistry - Data registry instance.
   * @param {import('../../turns/interfaces/ILLMAdapter.js').ILLMAdapter & {init?: Function, isInitialized?: Function, isOperational?: Function}} dependencies.llmAdapter - LLM adapter instance.
   * @param {LlmConfigLoader} dependencies.llmConfigLoader - Loader for LLM configuration.
   * @param {SystemInitializer} dependencies.systemInitializer - Initializes tagged systems.
   * @param {WorldInitializer} dependencies.worldInitializer - Initializes the game world.
   * @param {ISafeEventDispatcher} dependencies.safeEventDispatcher - Event dispatcher for safe events.
   * @param {IEntityManager} dependencies.entityManager - Entity manager instance.
   * @param {import('../../domUI/domUiFacade.js').DomUiFacade} dependencies.domUiFacade - UI facade instance.
   * @param {ActionIndex} dependencies.actionIndex - Action index for optimized action discovery.
   * @param {import('../../interfaces/IGameDataRepository.js').IGameDataRepository} dependencies.gameDataRepository - Game data repository instance.
   */
  constructor({
    logger,
    validatedEventDispatcher,
    modsLoader,
    scopeRegistry,
    dataRegistry,
    llmAdapter,
    llmConfigLoader,
    systemInitializer,
    worldInitializer,
    safeEventDispatcher,
    entityManager,
    domUiFacade,
    actionIndex,
    gameDataRepository,
  }) {
    super();

    if (
      !logger ||
      typeof logger.error !== 'function' ||
      typeof logger.debug !== 'function'
    ) {
      const errorMsg =
        "InitializationService: Missing or invalid required dependency 'logger'.";
      throw new Error(errorMsg);
    }
    this.#logger = logger;

    // FIX: Check for the correct 'dispatch' method name
    if (
      !validatedEventDispatcher ||
      typeof validatedEventDispatcher.dispatch !== 'function'
    ) {
      const errorMsg =
        "InitializationService: Missing or invalid required dependency 'validatedEventDispatcher'.";
      this.#logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    if (!modsLoader || typeof modsLoader.loadMods !== 'function') {
      throw new Error(
        "InitializationService: Missing or invalid required dependency 'modsLoader'."
      );
    }
    if (!scopeRegistry || typeof scopeRegistry.initialize !== 'function') {
      throw new Error(
        "InitializationService: Missing or invalid required dependency 'scopeRegistry'."
      );
    }
    if (!dataRegistry || typeof dataRegistry.getAll !== 'function') {
      throw new Error(
        "InitializationService: Missing or invalid required dependency 'dataRegistry'."
      );
    }
    if (!llmAdapter || typeof llmAdapter.init !== 'function') {
      throw new Error(
        "InitializationService: Missing or invalid required dependency 'llmAdapter'."
      );
    }
    if (!llmConfigLoader || typeof llmConfigLoader.loadConfigs !== 'function') {
      throw new Error(
        "InitializationService: Missing or invalid required dependency 'llmConfigLoader'."
      );
    }
    if (
      !systemInitializer ||
      typeof systemInitializer.initializeAll !== 'function'
    ) {
      throw new Error(
        "InitializationService: Missing or invalid required dependency 'systemInitializer'."
      );
    }
    if (
      !worldInitializer ||
      typeof worldInitializer.initializeWorldEntities !== 'function'
    ) {
      throw new Error(
        "InitializationService: Missing or invalid required dependency 'worldInitializer'."
      );
    }
    if (
      !safeEventDispatcher ||
      typeof safeEventDispatcher.subscribe !== 'function'
    ) {
      throw new Error(
        "InitializationService: Missing or invalid required dependency 'safeEventDispatcher'."
      );
    }
    if (!entityManager) {
      throw new Error(
        "InitializationService: Missing required dependency 'entityManager'."
      );
    }
    if (!actionIndex || typeof actionIndex.buildIndex !== 'function') {
      throw new Error(
        "InitializationService: Missing or invalid required dependency 'actionIndex'."
      );
    }
    if (!gameDataRepository || typeof gameDataRepository.getAllActionDefinitions !== 'function') {
      throw new Error(
        "InitializationService: Missing or invalid required dependency 'gameDataRepository'."
      );
    }
    if (!domUiFacade) {
      throw new Error(
        "InitializationService requires a domUiFacade dependency"
      );
    }

    this.#validatedEventDispatcher = validatedEventDispatcher;
    this.#modsLoader = modsLoader;
    this.#scopeRegistry = scopeRegistry;
    this.#dataRegistry = dataRegistry;
    this.#llmAdapter = llmAdapter;
    this.#llmConfigLoader = llmConfigLoader;
    this.#systemInitializer = systemInitializer;
    this.#worldInitializer = worldInitializer;
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#entityManager = entityManager;
    this.#domUiFacade = domUiFacade;
    this.#actionIndex = actionIndex;
    this.#gameDataRepository = gameDataRepository;

    this.#logger.debug(
      'InitializationService: Instance created successfully with dependencies.'
    );
  }

  /**
   * Runs the complete asynchronous sequence required to initialize the game for a specific world.
   *
   * @async
   * @param {string} worldName - The identifier of the world to initialize.
   * @returns {Promise<InitializationResult>} The result of the initialization attempt.
   */
  async runInitializationSequence(worldName) {
    this.#logger.debug(
      `InitializationService: Starting runInitializationSequence for world: ${worldName}.`
    );

    if (
      !worldName ||
      typeof worldName !== 'string' ||
      worldName.trim() === ''
    ) {
      const error = new TypeError(
        'InitializationService requires a valid non-empty worldName.'
      );
      this.#logger.error(
        'InitializationService requires a valid non-empty worldName.'
      );
      return { success: false, error: error };
    }

    try {
      this.#logger.debug('Loading world data via ModsLoader...');
      const loadReport = await this.#modsLoader.loadMods(worldName); // Schemas are loaded by this point
      this.#logger.debug(
        `InitializationService: World data loaded successfully for world: ${worldName}. Load report: ${JSON.stringify(loadReport)}`
      );

      // Build ActionIndex with loaded action definitions
      this.#logger.debug('Building ActionIndex with loaded action definitions...');
      const allActionDefinitions = this.#gameDataRepository.getAllActionDefinitions();
      this.#actionIndex.buildIndex(allActionDefinitions);
      this.#logger.debug(`ActionIndex built with ${allActionDefinitions.length} action definitions.`);

      this.#logger.debug('Initializing ScopeRegistry...');
      const scopes = this.#dataRegistry.getAll('scopes');

      // Convert array of scope objects to a map by qualified ID
      const scopeMap = {};
      scopes.forEach((scope) => {
        if (scope.id) {
          scopeMap[scope.id] = scope;
        }
      });

      this.#scopeRegistry.initialize(scopeMap);
      this.#logger.debug('ScopeRegistry initialized.');

      // ***** START: Initialize ConfigurableLLMAdapter *****
      this.#logger.debug(
        'InitializationService: Attempting to initialize ConfigurableLLMAdapter...'
      );
      try {
        const llmAdapter = this.#llmAdapter;

        if (!llmAdapter) {
          this.#logger.error(
            'InitializationService: Failed to resolve ILLMAdapter from container. Cannot initialize.'
          );
        } else if (typeof llmAdapter.init !== 'function') {
          this.#logger.error(
            'InitializationService: Resolved ILLMAdapter does not have an init method.'
          );
        } else if (
          typeof llmAdapter.isInitialized === 'function' &&
          llmAdapter.isInitialized()
        ) {
          this.#logger.debug(
            'InitializationService: ConfigurableLLMAdapter already initialized. Skipping re-initialization.'
          );
        } else {
          const llmConfigLoaderInstance = this.#llmConfigLoader;
          this.#logger.debug(
            'InitializationService: LlmConfigLoader resolved from container for adapter initialization.'
          );
          await llmAdapter.init({ llmConfigLoader: llmConfigLoaderInstance });

          if (
            typeof llmAdapter.isOperational === 'function' &&
            llmAdapter.isOperational()
          ) {
            this.#logger.debug(
              `InitializationService: ConfigurableLLMAdapter initialized successfully and is operational.`
            );
          } else {
            this.#logger.warn(
              `InitializationService: ConfigurableLLMAdapter.init() completed BUT THE ADAPTER IS NOT OPERATIONAL. Check adapter-specific logs (e.g., LlmConfigLoader errors).`
            );
          }
        }
      } catch (adapterInitError) {
        this.#logger.error(
          `InitializationService: CRITICAL error during ConfigurableLLMAdapter.init(): ${adapterInitError.message}`,
          {
            errorName: adapterInitError.name,
            errorStack: adapterInitError.stack,
            errorObj: adapterInitError,
          }
        );
        // Note: This error is logged but does not currently stop the entire initialization sequence.
        // The ILLMAdapter will be non-operational.
      }
      // ***** END: Initialize ConfigurableLLMAdapter *****

      this.#logger.debug('Initializing tagged systems...');
      await this.#systemInitializer.initializeAll();
      this.#logger.debug(
        'InitializationService: Tagged system initialization complete.'
      );

      this.#logger.debug('Initializing world entities...');
      const worldInitSuccess =
        await this.#worldInitializer.initializeWorldEntities(worldName);
      if (!worldInitSuccess) {
        throw new Error('World initialization failed via WorldInitializer.');
      }
      this.#logger.debug(
        'InitializationService: Initial world entities instantiated and spatial index built.'
      );

      // Register AI persistence listeners
      const dispatcher = this.#safeEventDispatcher;
      const entityManager = /** @type {IEntityManager} */ (this.#entityManager);
      const thoughtListener = new ThoughtPersistenceListener({
        logger: this.#logger,
        entityManager,
      });
      const notesListener = new NotesPersistenceListener({
        logger: this.#logger,
        entityManager,
        dispatcher,
      });
      dispatcher.subscribe(
        ACTION_DECIDED_ID,
        thoughtListener.handleEvent.bind(thoughtListener)
      );
      dispatcher.subscribe(
        ACTION_DECIDED_ID,
        notesListener.handleEvent.bind(notesListener)
      );
      this.#logger.debug('Registered AI persistence listeners.');

      this.#logger.debug(
        'Ensuring DomUiFacade is instantiated so UI components are ready...'
      );
      if (!this.#domUiFacade) {
        throw new Error('Failed to resolve DomUiFacade');
      }
      this.#logger.debug('DomUiFacade ready.');

      this.#logger.debug(
        `InitializationService: Initialization sequence for world '${worldName}' completed successfully (GameLoop resolution removed).`
      );

      return {
        success: true,
        details: { message: `World '${worldName}' initialized.` },
      };
    } catch (error) {
      this.#logger.error(
        `CRITICAL ERROR during initialization sequence for world '${worldName}': ${error.message}`,
        {
          errorMessage: error.message,
          errorName: error.name,
          errorStack: error.stack,
        }
      );

      const failedPayload = {
        worldName,
        error: error.message,
        stack: error instanceof Error ? error.stack : undefined,
      };
      this.#validatedEventDispatcher
        .dispatch(INITIALIZATION_SERVICE_FAILED_ID, failedPayload, {
          allowSchemaNotFound: true,
        })
        .then(() =>
          this.#logger.debug(
            `Dispatched ${INITIALIZATION_SERVICE_FAILED_ID} event.`,
            failedPayload
          )
        )
        .catch((e) =>
          this.#logger.error(
            `Failed to dispatch ${INITIALIZATION_SERVICE_FAILED_ID} event`,
            e
          )
        );

      try {
        await this.#validatedEventDispatcher.dispatch(UI_SHOW_FATAL_ERROR_ID, {
          title: 'Fatal Initialization Error',
          message: `Initialization failed for world '${worldName}'. Reason: ${error.message}`,
          details: error instanceof Error ? error.stack : 'No stack available.',
        });
        await this.#validatedEventDispatcher.dispatch('core:disable_input', {
          message: 'Fatal error during initialization. Cannot continue.',
        });
        this.#logger.debug(
          `InitializationService: Dispatched ${UI_SHOW_FATAL_ERROR_ID} and core:disable_input events.`
        );
      } catch (dispatchError) {
        this.#logger.error(
          `InitializationService: Failed to dispatch UI error events after initialization failure:`,
          dispatchError
        );
      }

      return {
        success: false,
        error: error instanceof Error ? error : new Error(error.message),
        details: { worldName },
      };
    }
  }
}

export default InitializationService;
