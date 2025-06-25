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
  #domUiFacade; // eslint-disable-line no-unused-private-class-members
  #actionIndex;
  #gameDataRepository;
  #thoughtListener;
  #notesListener;

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
    thoughtListener,
    notesListener,
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
    if (
      !gameDataRepository ||
      typeof gameDataRepository.getAllActionDefinitions !== 'function'
    ) {
      throw new Error(
        "InitializationService: Missing or invalid required dependency 'gameDataRepository'."
      );
    }
    if (!domUiFacade) {
      throw new Error(
        'InitializationService requires a domUiFacade dependency'
      );
    }
    if (!thoughtListener || typeof thoughtListener.handleEvent !== 'function') {
      throw new Error(
        "InitializationService: Missing or invalid required dependency 'thoughtListener'."
      );
    }
    if (!notesListener || typeof notesListener.handleEvent !== 'function') {
      throw new Error(
        "InitializationService: Missing or invalid required dependency 'notesListener'."

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
    this.#thoughtListener = thoughtListener;
    this.#notesListener = notesListener;

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
      return { success: false, error };
    }

    try {
      await this.#loadMods(worldName);
      await this.#validateContentDependencies(worldName);
      await this.#initializeScopeRegistry();
      await this.#initLlmAdapter();
      await this.#initSystems();
      await this.#initWorld(worldName);
      this.#setupPersistenceListeners();

      this.#logger.debug(
        'Ensuring DomUiFacade is instantiated so UI components are ready...'
      );

      // Build ActionIndex with loaded action definitions
      this.#logger.debug(
        'Building ActionIndex with loaded action definitions...'
      );
      const allActionDefinitions =
        this.#gameDataRepository.getAllActionDefinitions();
      this.#actionIndex.buildIndex(allActionDefinitions);
      this.#logger.debug(
        `ActionIndex built with ${allActionDefinitions.length} action definitions.`
      );

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

      this.#logger.debug(
        `InitializationService: Initialization sequence for world '${worldName}' completed successfully (GameLoop resolution removed).`
      );
      return {
        success: true,
        details: { message: `World '${worldName}' initialized.` },
      };
    } catch (error) {
      await this.#reportFatalError(error, worldName);
      return {
        success: false,
        error: error instanceof Error ? error : new Error(error.message),
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
  async #validateContentDependencies(worldName) {
    this.#logger.debug(
      'InitializationService: Validating content dependencies...'
    );

    if (
      !this.#gameDataRepository ||
      typeof this.#gameDataRepository.getAllEntityInstanceDefinitions !==
        'function' ||
      typeof this.#gameDataRepository.getAllEntityDefinitions !== 'function' ||
      typeof this.#gameDataRepository.getWorld !== 'function'
    ) {
      this.#logger.warn(
        'Content dependency validation skipped: gameDataRepository lacks required methods.'
      );
      return;
    }

    const instanceDefs =
      this.#gameDataRepository.getAllEntityInstanceDefinitions();
    const definitionIds = new Set(
      this.#gameDataRepository.getAllEntityDefinitions().map((d) => d.id)
    );

    for (const inst of instanceDefs) {
      if (!definitionIds.has(inst.definitionId)) {
        this.#logger.error(
          `Content Validation: Instance '${inst.instanceId}' references missing definition '${inst.definitionId}'.`
        );
      }
    }

    const instanceIdSet = new Set(instanceDefs.map((i) => i.instanceId));
    const worldDef = this.#gameDataRepository.getWorld(worldName);
    const worldSpawnSet = new Set();
    if (worldDef && Array.isArray(worldDef.instances)) {
      for (const { instanceId } of worldDef.instances) {
        if (typeof instanceId === 'string') worldSpawnSet.add(instanceId);
      }
    }

    const entityDefs = this.#gameDataRepository.getAllEntityDefinitions();
    for (const def of entityDefs) {
      const exits = def?.components?.['core:exits'];
      if (Array.isArray(exits)) {
        for (const exit of exits) {
          const { target, blocker } = exit || {};
          if (target) {
            if (!instanceIdSet.has(target)) {
              this.#logger.error(
                `Content Validation: Exit target '${target}' in definition '${def.id}' has no corresponding instance data.`
              );
            } else if (!worldSpawnSet.has(target)) {
              this.#logger.error(
                `Content Validation: Exit target '${target}' in definition '${def.id}' is not spawned in world '${worldName}'.`
              );
            }
          }
          if (blocker) {
            if (!instanceIdSet.has(blocker)) {
              this.#logger.error(
                `Content Validation: Exit blocker '${blocker}' in definition '${def.id}' has no corresponding instance data.`
              );
            } else if (!worldSpawnSet.has(blocker)) {
              this.#logger.error(
                `Content Validation: Exit blocker '${blocker}' in definition '${def.id}' is not spawned in world '${worldName}'.`
              );
            }
          }
        }
      }
    }

    this.#logger.debug(
      'InitializationService: Content dependency validation complete.'
    );
  }

  async #initializeScopeRegistry() {
    this.#logger.debug('Initializing ScopeRegistry...');
    const scopes = this.#dataRegistry.getAll('scopes');
    const scopeMap = {};
    scopes.forEach((scope) => {
      if (scope.id) {
        scopeMap[scope.id] = scope;
      }
    });
    this.#scopeRegistry.initialize(scopeMap);
    this.#logger.debug('ScopeRegistry initialized.');
  }

  async #initLlmAdapter() {
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
    }
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
      throw new Error('World initialization failed via WorldInitializer.');
    }
    this.#logger.debug(
      'InitializationService: Initial world entities instantiated and spatial index built.'
    );
  }

  #setupPersistenceListeners() {
    const dispatcher = this.#safeEventDispatcher;
    dispatcher.subscribe(
      ACTION_DECIDED_ID,
      this.#thoughtListener.handleEvent.bind(this.#thoughtListener)
    );
    dispatcher.subscribe(
      ACTION_DECIDED_ID,
      this.#notesListener.handleEvent.bind(this.#notesListener)
    );
    this.#logger.debug('Registered AI persistence listeners.');
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
