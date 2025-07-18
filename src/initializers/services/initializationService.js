// src/initializers/services/initializationService.js

// --- Type Imports ---
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../interfaces/IModsLoader.js').IModsLoader} IModsLoader */
/** @typedef {import('../systemInitializer.js').default} SystemInitializer */
/** @typedef {import('../worldInitializer.js').default} WorldInitializer */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../llms/services/llmConfigLoader.js').LlmConfigLoader} LlmConfigLoader */
/** @typedef {import('../../events/safeEventDispatcher.js').default} ISafeEventDispatcher */
/** @typedef {import('../../actions/actionIndex.js').ActionIndex} ActionIndex */
/** @typedef {import('../../interfaces/IThoughtListener.js').IThoughtListener} IThoughtListener */
/** @typedef {import('../../interfaces/INotesListener.js').INotesListener} INotesListener */
/** @typedef {import('../../interfaces/ISpatialIndexManager.js').ISpatialIndexManager} ISpatialIndexManager */

// --- Interface Imports for JSDoc & `extends` ---
/** @typedef {import('../../interfaces/IInitializationService.js').InitializationResult} InitializationResult */
import { IInitializationService } from '../../interfaces/IInitializationService.js';
import {
  ACTION_DECIDED_ID,
  INITIALIZATION_SERVICE_FAILED_ID,
  UI_SHOW_FATAL_ERROR_ID,
} from '../../constants/eventIds.js';
import loadAndInitScopes from './scopeRegistryUtils.js';
import {
  SystemInitializationError,
  WorldInitializationError,
  InitializationError,
} from '../../errors/InitializationError.js';
import { buildActionIndex } from '../../utils/initHelpers.js';
import { setupPersistenceListeners } from './initHelpers.js';
import { assertNonBlankString } from '../../utils/dependencyUtils.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';
import LlmAdapterInitializer from './llmAdapterInitializer.js';
import {
  assertFunction,
  assertMethods,
  assertPresent,
} from '../../utils/dependencyUtils.js';

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
  #domUiFacade; // eslint-disable-line no-unused-private-class-members
  #actionIndex;
  #gameDataRepository;
  #thoughtListener;
  #notesListener;
  #spatialIndexManager;
  #contentDependencyValidator;
  #llmAdapterInitializer;
  #anatomyFormattingService;

  /**
   * Creates a new InitializationService instance.
   *
   * @param {object} config - Grouped dependencies.
   * @param {{ logger: ILogger }} config.log - Logging utilities.
   * @param {{ validatedEventDispatcher: IValidatedEventDispatcher, safeEventDispatcher: ISafeEventDispatcher }} config.events - Event dispatchers.
   * @param {{ llmAdapter: import('../../turns/interfaces/ILLMAdapter.js').ILLMAdapter & {init?: Function, isInitialized?: Function, isOperational?: Function}, llmConfigLoader: LlmConfigLoader }} config.llm - LLM services.
   * @param {{
   *   entityManager: IEntityManager,
   *   domUiFacade: import('../../domUI/domUiFacade.js').DomUiFacade,
   *   actionIndex: ActionIndex,
   *   gameDataRepository: import('../../interfaces/IGameDataRepository.js').IGameDataRepository,
   *   thoughtListener: IThoughtListener,
   *   notesListener: INotesListener,
   *   spatialIndexManager: ISpatialIndexManager,
   * }} config.persistence - Persistence related services.
   * @param {{
   *   modsLoader: IModsLoader,
   *   scopeRegistry: import('../../interfaces/IScopeRegistry.js').IScopeRegistry,
   *   dataRegistry: import('../../data/inMemoryDataRegistry.js').DataRegistry,
   *   systemInitializer: SystemInitializer,
   *   worldInitializer: WorldInitializer,
   *   contentDependencyValidator: import('./contentDependencyValidator.js').default, // Required validator instance
   *   llmAdapterInitializer: LlmAdapterInitializer,
   *   anatomyFormattingService: import('../../services/anatomyFormattingService.js').AnatomyFormattingService,
   * }} config.coreSystems - Core engine systems.
   * @description Initializes the complete game system.
   */
  constructor({
    log = {},
    events = {},
    llm = {},
    persistence = {},
    coreSystems = {},
  } = {}) {
    const { logger } = log;
    const { validatedEventDispatcher, safeEventDispatcher } = events;
    const { llmAdapter, llmConfigLoader } = llm;
    const {
      entityManager,
      domUiFacade,
      actionIndex,
      gameDataRepository,
      thoughtListener,
      notesListener,
      spatialIndexManager,
    } = persistence;
    const {
      modsLoader,
      scopeRegistry,
      dataRegistry,
      systemInitializer,
      worldInitializer,
      contentDependencyValidator,
      llmAdapterInitializer = new LlmAdapterInitializer(),
      anatomyFormattingService,
    } = coreSystems;
    super();

    assertMethods(
      logger,
      ['error', 'debug'],
      "InitializationService: Missing or invalid required dependency 'logger'.",
      SystemInitializationError
    );

    this.#logger = logger;

    assertFunction(
      validatedEventDispatcher,
      'dispatch',
      "InitializationService: Missing or invalid required dependency 'validatedEventDispatcher'.",
      SystemInitializationError,
      this.#logger
    );

    assertFunction(
      modsLoader,
      'loadMods',
      "InitializationService: Missing or invalid required dependency 'modsLoader'.",
      SystemInitializationError
    );
    assertFunction(
      scopeRegistry,
      'initialize',
      "InitializationService: Missing or invalid required dependency 'scopeRegistry'.",
      SystemInitializationError
    );
    assertFunction(
      dataRegistry,
      'getAll',
      "InitializationService: Missing or invalid required dependency 'dataRegistry'.",
      SystemInitializationError
    );
    assertFunction(
      systemInitializer,
      'initializeAll',
      "InitializationService: Missing or invalid required dependency 'systemInitializer'.",
      SystemInitializationError
    );
    assertFunction(
      worldInitializer,
      'initializeWorldEntities',
      "InitializationService: Missing or invalid required dependency 'worldInitializer'.",
      SystemInitializationError
    );
    assertFunction(
      safeEventDispatcher,
      'subscribe',
      "InitializationService: Missing or invalid required dependency 'safeEventDispatcher'.",
      SystemInitializationError
    );
    assertPresent(
      entityManager,
      "InitializationService: Missing required dependency 'entityManager'.",
      SystemInitializationError
    );
    assertFunction(
      actionIndex,
      'buildIndex',
      "InitializationService: Missing or invalid required dependency 'actionIndex'.",
      SystemInitializationError
    );
    assertFunction(
      gameDataRepository,
      'getAllActionDefinitions',
      "InitializationService: Missing or invalid required dependency 'gameDataRepository'.",
      SystemInitializationError
    );
    assertPresent(
      domUiFacade,
      'InitializationService requires a domUiFacade dependency',
      SystemInitializationError
    );
    assertFunction(
      thoughtListener,
      'handleEvent',
      "InitializationService: Missing or invalid required dependency 'thoughtListener'.",
      SystemInitializationError
    );
    assertFunction(
      notesListener,
      'handleEvent',
      "InitializationService: Missing or invalid required dependency 'notesListener'.",
      SystemInitializationError
    );
    assertFunction(
      spatialIndexManager,
      'buildIndex',
      "InitializationService: Missing or invalid required dependency 'spatialIndexManager'.",
      SystemInitializationError
    );
    assertFunction(
      contentDependencyValidator,
      'validate',
      "InitializationService: Missing or invalid required dependency 'contentDependencyValidator'.",
      SystemInitializationError
    );
    assertFunction(
      llmAdapterInitializer,
      'initialize',
      "InitializationService: Missing or invalid required dependency 'llmAdapterInitializer'.",
      SystemInitializationError
    );
    assertFunction(
      anatomyFormattingService,
      'initialize',
      "InitializationService: Missing or invalid required dependency 'anatomyFormattingService'.",
      SystemInitializationError
    );
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
    this.#thoughtListener = thoughtListener;
    this.#notesListener = notesListener;
    this.#spatialIndexManager = spatialIndexManager;
    this.#contentDependencyValidator = contentDependencyValidator;
    this.#llmAdapterInitializer = llmAdapterInitializer;
    this.#anatomyFormattingService = anatomyFormattingService;

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
    try {
      assertNonBlankString(
        worldName,
        'worldName',
        'InitializationService',
        this.#logger
      );
      await this.#loadMods(worldName);

      // Initialize AnatomyFormattingService after mods are loaded
      this.#logger.debug(
        'Initializing AnatomyFormattingService after mod loading...'
      );
      await this.#anatomyFormattingService.initialize();
      this.#logger.debug('AnatomyFormattingService initialized successfully.');

      await this.#contentDependencyValidator.validate(worldName);
      await this.#initializeScopeRegistry();
      const llmReady = await this.#llmAdapterInitializer.initialize(
        this.#llmAdapter,
        this.#llmConfigLoader,
        this.#logger
      );
      if (llmReady === false) {
        throw new SystemInitializationError(
          'LLM adapter initialization failed.'
        );
      }
      await this.#initSystems();
      await this.#initWorld(worldName);
      setupPersistenceListeners(
        this.#safeEventDispatcher,
        [
          {
            eventId: ACTION_DECIDED_ID,
            handler: this.#thoughtListener.handleEvent.bind(
              this.#thoughtListener
            ),
          },
          {
            eventId: ACTION_DECIDED_ID,
            handler: this.#notesListener.handleEvent.bind(this.#notesListener),
          },
        ],
        this.#logger
      );

      this.#logger.debug(
        'Ensuring DomUiFacade is instantiated so UI components are ready...'
      );

      buildActionIndex(
        this.#actionIndex,
        this.#gameDataRepository,
        this.#logger
      );

      // ScopeRegistry was already initialized in #initializeScopeRegistry() above

      this.#logger.debug(
        `InitializationService: Initialization sequence for world '${worldName}' completed successfully (GameLoop resolution removed).`
      );
      return {
        success: true,
        details: { message: `World '${worldName}' initialized.` },
      };
    } catch (error) {
      if (error instanceof InvalidArgumentError) {
        return { success: false, error };
      }
      await this.#reportFatalError(error, worldName);
      return {
        success: false,
        error:
          error instanceof Error
            ? error
            : new SystemInitializationError(error.message),
        details: { worldName },
      };
    }
  }

  async #loadMods(worldName) {
    this.#logger.debug('Loading world data via ModsLoader...');
    const loadReport = await this.#modsLoader.loadMods(worldName);
    this.#logger.debug(
      `InitializationService: World data loaded successfully for world: ${worldName}. Load report: ${JSON.stringify(loadReport)}`
    );
  }

  /**
   * @description Performs sanity checks on loaded content to catch unresolved
   * references early. It verifies that each entity instance references a loaded
   * definition and that all instance IDs referenced in entity definitions exist
   * and are included in the world's initial instance list.
   * @param {string} worldName - Target world name for spawn checks.
   * @returns {Promise<void>} Resolves when validation completes.
   * @private
   * @async
   */

  async #initializeScopeRegistry() {
    await loadAndInitScopes({
      dataSource: this.#dataRegistry.getAll.bind(this.#dataRegistry),
      scopeRegistry: this.#scopeRegistry,
      logger: this.#logger,
    });
  }

  async #initSystems() {
    this.#logger.debug('Initializing tagged systems...');
    await this.#systemInitializer.initializeAll();
    this.#logger.debug(
      'InitializationService: Tagged system initialization complete.'
    );
  }

  async #initWorld(worldName) {
    this.#logger.debug('Initializing world entities...');
    const worldInitSuccess =
      await this.#worldInitializer.initializeWorldEntities(worldName);
    if (!worldInitSuccess) {
      throw new WorldInitializationError(
        'World initialization failed via WorldInitializer.'
      );
    }

    // FIX: Build spatial index from existing entities after world initialization
    // This fixes the timing bug where SpatialIndexSynchronizer is connected after
    // entities are created, leaving the spatial index empty
    this.#logger.debug('Building spatial index from existing entities...');
    this.#spatialIndexManager.buildIndex(this.#entityManager);
    this.#logger.debug('Spatial index built successfully.');

    this.#logger.debug(
      'InitializationService: Initial world entities instantiated and spatial index built.'
    );
  }

  async #reportFatalError(error, worldName) {
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
  }
}

export default InitializationService;
