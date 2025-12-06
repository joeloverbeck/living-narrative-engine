/**
 * @file ControllerLifecycleOrchestrator
 * @description Coordinates initialization, reinitialization, and destruction
 *              flows for character builder controllers.
 */

import { ensureValidLogger } from '../../utils/loggerUtils.js';

/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/**
 * Lifecycle phases executed during controller initialization.
 *
 * @readonly
 * @enum {string}
 */
export const LIFECYCLE_PHASES = Object.freeze({
  PRE_INIT: 'preInit',
  CACHE_ELEMENTS: 'cacheElements',
  INIT_SERVICES: 'initServices',
  SETUP_EVENT_LISTENERS: 'setupEventListeners',
  LOAD_DATA: 'loadData',
  INIT_UI: 'initUI',
  POST_INIT: 'postInit',
  INIT_ERROR: 'initError',
});

/**
 * Lifecycle phases executed during controller destruction.
 *
 * @readonly
 * @enum {string}
 */
export const DESTRUCTION_PHASES = Object.freeze({
  PRE_DESTROY: 'destroy:pre',
  CANCEL_OPERATIONS: 'destroy:cancelOperations',
  REMOVE_LISTENERS: 'destroy:removeListeners',
  CLEANUP_SERVICES: 'destroy:cleanupServices',
  CLEAR_ELEMENTS: 'destroy:clearElements',
  CLEANUP_TASKS: 'destroy:cleanupTasks',
  CLEAR_REFERENCES: 'destroy:clearReferences',
  POST_DESTROY: 'destroy:post',
});

/**
 * Ordered initialization sequence.
 *
 * @type {string[]}
 */
export const DEFAULT_INITIALIZATION_SEQUENCE = [
  LIFECYCLE_PHASES.PRE_INIT,
  LIFECYCLE_PHASES.CACHE_ELEMENTS,
  LIFECYCLE_PHASES.INIT_SERVICES,
  LIFECYCLE_PHASES.SETUP_EVENT_LISTENERS,
  LIFECYCLE_PHASES.LOAD_DATA,
  LIFECYCLE_PHASES.INIT_UI,
  LIFECYCLE_PHASES.POST_INIT,
];

/**
 * Ordered destruction sequence.
 *
 * @type {string[]}
 */
export const DEFAULT_DESTRUCTION_SEQUENCE = [
  DESTRUCTION_PHASES.PRE_DESTROY,
  DESTRUCTION_PHASES.CANCEL_OPERATIONS,
  DESTRUCTION_PHASES.REMOVE_LISTENERS,
  DESTRUCTION_PHASES.CLEANUP_SERVICES,
  DESTRUCTION_PHASES.CLEAR_ELEMENTS,
  DESTRUCTION_PHASES.CLEANUP_TASKS,
  DESTRUCTION_PHASES.CLEAR_REFERENCES,
  DESTRUCTION_PHASES.POST_DESTROY,
];

/**
 * Coordinates lifecycle transitions for controllers.
 */
export class ControllerLifecycleOrchestrator {
  /** @type {import('../../interfaces/coreServices.js').ILogger} */
  #logger;

  /** @type {ISafeEventDispatcher|null} */
  #eventBus;

  /** @type {string} */
  #controllerName = 'Controller';

  /** @type {boolean} */
  #isInitialized = false;

  /** @type {boolean} */
  #isInitializing = false;

  /** @type {boolean} */
  #isDestroyed = false;

  /** @type {boolean} */
  #isDestroying = false;

  /** @type {Array<{task: Function, description: string}>} */
  #cleanupTasks = [];

  /** @type {Map<string, Function[]>} */
  #hooks = new Map();

  /**
   * @param {object} dependencies
   * @param {import('../../interfaces/coreServices.js').ILogger} dependencies.logger
   * @param {ISafeEventDispatcher} [dependencies.eventBus]
   * @param {Record<string, Function|Function[]>} [dependencies.hooks]
   */
  constructor({ logger, eventBus = null, hooks = {} } = {}) {
    this.#logger = ensureValidLogger(logger, 'ControllerLifecycleOrchestrator');
    this.#eventBus = eventBus ?? null;

    this.#registerHookConfiguration(hooks);
    this.registerHook(DESTRUCTION_PHASES.CLEANUP_TASKS, () =>
      this.#executeCleanupTasks()
    );
  }

  /**
   * Sets the display name used in log and error messages.
   *
   * @param {string} name
   */
  setControllerName(name) {
    if (typeof name === 'string' && name.trim().length > 0) {
      this.#controllerName = name.trim();
    }
  }

  /** @returns {boolean} */
  get isInitialized() {
    return this.#isInitialized;
  }

  /** @returns {boolean} */
  get isInitializing() {
    return this.#isInitializing;
  }

  /** @returns {boolean} */
  get isDestroyed() {
    return this.#isDestroyed;
  }

  /** @returns {boolean} */
  get isDestroying() {
    return this.#isDestroying;
  }

  /**
   * Registers a hook for a lifecycle phase.
   *
   * @param {string} phase
   * @param {Function} hook
   * @returns {Function} Deregistration function.
   */
  registerHook(phase, hook) {
    if (typeof hook !== 'function') {
      throw new TypeError('Lifecycle hook must be a function');
    }

    const normalizedPhase = String(phase);
    if (!this.#hooks.has(normalizedPhase)) {
      this.#hooks.set(normalizedPhase, []);
    }
    const phaseHooks = this.#hooks.get(normalizedPhase);
    phaseHooks.push(hook);

    return () => this.deregisterHook(normalizedPhase, hook);
  }

  /**
   * Deregisters a previously registered hook.
   *
   * @param {string} phase
   * @param {Function} hook
   * @returns {boolean} True if removed.
   */
  deregisterHook(phase, hook) {
    const phaseHooks = this.#hooks.get(phase);
    if (!phaseHooks) {
      return false;
    }

    const index = phaseHooks.indexOf(hook);
    if (index === -1) {
      return false;
    }

    phaseHooks.splice(index, 1);
    if (phaseHooks.length === 0) {
      this.#hooks.delete(phase);
    }
    return true;
  }

  /**
   * Creates a hook wrapper that safely executes controller methods.
   *
   * @param {object} options
   * @param {object} options.controller
   * @param controller
   * @param {string} options.methodName
   * @param methodName
   * @param {string} options.phaseName
   * @param phaseName
   * @param {boolean} [options.required]
   * @param root0
   * @param root0.required
   * @param phaseName.required
   * @param {boolean} [options.synchronous]
   * @param root0.synchronous
   * @param phaseName.synchronous
   * @param {boolean} [options.forwardArguments]
   * @param root0.forwardArguments
   * @param phaseName.forwardArguments
   * @returns {Function}
   */
  createControllerMethodHook(
    controller,
    methodName,
    phaseName,
    { required = false, synchronous = false, forwardArguments = false } = {}
  ) {
    if (!controller) {
      throw new Error('controller is required to create lifecycle hooks');
    }

    const execute = (...args) => {
      const invocationArgs = forwardArguments ? args : [];
      const method = controller[methodName];
      const controllerName =
        controller.constructor?.name ?? this.#controllerName;

      if (typeof method !== 'function') {
        if (required) {
          throw new Error(
            `${controllerName} must implement ${methodName}() method`
          );
        }

        this.#logger.debug(
          `${controllerName}: Skipping ${phaseName} (method not implemented)`
        );
        return synchronous ? undefined : Promise.resolve();
      }

      const startTime = performance.now();
      this.#logger.debug(`${controllerName}: Starting ${phaseName}`);

      const handleSuccess = () => {
        const duration = performance.now() - startTime;
        this.#logger.debug(
          `${controllerName}: Completed ${phaseName} in ${duration.toFixed(2)}ms`
        );
      };

      const handleError = (error) => {
        const duration = performance.now() - startTime;
        this.#logger.error(
          `${controllerName}: Failed ${phaseName} after ${duration.toFixed(2)}ms`,
          error
        );
        throw this.#createLifecycleError(phaseName, methodName, error);
      };

      try {
        const result = method.apply(controller, invocationArgs);
        if (synchronous) {
          handleSuccess();
          return;
        }

        return Promise.resolve(result)
          .then(() => {
            handleSuccess();
          })
          .catch((error) => {
            handleError(error);
          });
      } catch (error) {
        handleError(error);
      }
    };

    if (synchronous) {
      return (...args) => execute(...args);
    }

    return async (...args) => execute(...args);
  }
  /**
   * Runs the initialization sequence.
   *
   * @param {object} [options]
   * @param {string} [options.controllerName]
   * @returns {Promise<void>}
   */
  async initialize({ controllerName } = {}) {
    if (controllerName) {
      this.setControllerName(controllerName);
    }

    if (this.#isDestroyed) {
      throw new Error(
        `${this.#controllerName}: Cannot initialize after destruction`
      );
    }

    if (this.#isInitialized) {
      this.#logger.warn(
        `${this.#controllerName}: Already initialized, skipping re-initialization`
      );
      return;
    }

    if (this.#isInitializing) {
      this.#logger.warn(
        `${this.#controllerName}: Initialization already in progress, skipping concurrent initialization`
      );
      return;
    }

    this.#isInitializing = true;
    const startTime = performance.now();
    this.#logger.info(`${this.#controllerName}: Starting initialization`);

    try {
      for (const phase of DEFAULT_INITIALIZATION_SEQUENCE) {
        await this.#executeHooks(phase);
      }

      this.#isInitializing = false;
      this.#isInitialized = true;
      const duration = performance.now() - startTime;
      this.#logger.info(
        `${this.#controllerName}: Initialization completed in ${duration.toFixed(2)}ms`
      );

      this.#dispatchInitializationEvent(duration);
    } catch (error) {
      this.#isInitializing = false;
      this.#isInitialized = false;
      const duration = performance.now() - startTime;
      this.#logger.error(
        `${this.#controllerName}: Initialization failed after ${duration.toFixed(2)}ms`,
        error
      );

      await this.#executeHooks(LIFECYCLE_PHASES.INIT_ERROR, error);
      throw error;
    }
  }

  /**
   * Forces a reinitialization by resetting state and re-running the lifecycle.
   *
   * @param {object} [options]
   * @param {string} [options.controllerName]
   * @param {Function} [options.onReset]
   * @returns {Promise<void>}
   */
  async reinitialize({ controllerName, onReset } = {}) {
    if (controllerName) {
      this.setControllerName(controllerName);
    }

    this.#logger.warn(
      `${this.#controllerName}: Force re-initialization requested`
    );
    this.resetInitializationState(onReset);
    await this.initialize();
  }

  /**
   * Resets initialization bookkeeping.
   *
   * @param {Function} [onReset]
   */
  resetInitializationState(onReset) {
    this.#isInitialized = false;
    this.#isInitializing = false;

    if (typeof onReset === 'function') {
      try {
        onReset();
      } catch (error) {
        this.#logger.error(
          `${this.#controllerName}: Error while running reset callback`,
          error
        );
      }
    }
  }

  /**
   * Registers a cleanup task executed during destruction.
   *
   * @param {Function} task
   * @param {string} [description]
   */
  registerCleanupTask(task, description = 'Cleanup task') {
    if (typeof task !== 'function') {
      throw new TypeError('Cleanup task must be a function');
    }

    this.#cleanupTasks.push({ task, description });
    this.#logger.debug(
      `${this.#controllerName}: Registered cleanup task: ${description}`
    );
  }

  /**
   * Checks whether the controller has been destroyed.
   *
   * @param {string} [operation]
   * @returns {boolean}
   */
  checkDestroyed(operation) {
    if (this.#isDestroyed) {
      if (operation) {
        throw new Error(
          `${this.#controllerName}: Cannot ${operation} - controller is destroyed`
        );
      }
      return true;
    }
    return false;
  }

  /**
   * Wraps a method so that it cannot be invoked after destruction.
   *
   * @param {Function} method
   * @param {string} methodName
   * @returns {Function}
   */
  makeDestructionSafe(method, methodName) {
    return (...args) => {
      this.checkDestroyed(`call ${methodName}`);
      return method(...args);
    };
  }

  /**
   * Destroys the controller by executing all registered cleanup phases.
   *
   * @param {object} [options]
   * @param {string} [options.controllerName]
   */
  destroy({ controllerName } = {}) {
    if (controllerName) {
      this.setControllerName(controllerName);
    }

    if (this.#isDestroyed) {
      this.#logger.warn(
        `${this.#controllerName}: Already destroyed, skipping destruction`
      );
      return;
    }

    if (this.#isDestroying) {
      this.#logger.warn(
        `${this.#controllerName}: Destruction already in progress`
      );
      return;
    }

    this.#isDestroying = true;
    const startTime = performance.now();
    this.#logger.info(`${this.#controllerName}: Starting destruction`);

    try {
      for (const phase of DEFAULT_DESTRUCTION_SEQUENCE) {
        this.#executeDestructionPhase(phase);
      }

      this.#isDestroyed = true;
      this.#isDestroying = false;
      this.#isInitialized = false;

      const duration = performance.now() - startTime;
      this.#logger.info(
        `${this.#controllerName}: Destruction completed in ${duration.toFixed(2)}ms`
      );
      this.#dispatchDestructionEvent(duration);
    } catch (error) {
      this.#isDestroyed = true;
      this.#isDestroying = false;
      this.#logger.error(
        `${this.#controllerName}: Error during destruction`,
        error
      );
      throw error;
    } finally {
      this.#cleanupTasks = [];
    }
  }

  /**
   * Applies hook configuration passed to the constructor.
   *
   * @param {Record<string, Function|Function[]>} config
   */
  #registerHookConfiguration(config) {
    if (!config || typeof config !== 'object') {
      return;
    }

    Object.entries(config).forEach(([phase, value]) => {
      if (!value) {
        return;
      }

      const hooks = Array.isArray(value) ? value : [value];
      hooks.forEach((hook) => this.registerHook(phase, hook));
    });
  }

  /**
   * Executes every hook in a phase sequentially.
   *
   * @param {string} phase
   * @param {...any} args
   * @returns {Promise<void>}
   */
  async #executeHooks(phase, ...args) {
    const phaseHooks = this.#hooks.get(phase);
    if (!phaseHooks || phaseHooks.length === 0) {
      return;
    }

    for (const hook of phaseHooks) {
      await hook(...args);
    }
  }

  /**
   * Executes synchronous destruction hooks while suppressing errors.
   *
   * @param {string} phase
   */
  #executeDestructionPhase(phase) {
    const phaseHooks = this.#hooks.get(phase);
    if (!phaseHooks || phaseHooks.length === 0) {
      return;
    }

    for (const hook of phaseHooks) {
      try {
        const result = hook();
        if (result && typeof result.then === 'function') {
          result.catch((error) => {
            this.#logger.error(
              `${this.#controllerName}: Async hook rejected in ${phase}`,
              error
            );
          });
        }
      } catch (error) {
        this.#logger.error(`${this.#controllerName}: Error in ${phase}`, error);
      }
    }
  }

  /**
   * Runs and clears cleanup tasks in LIFO order.
   */
  #executeCleanupTasks() {
    const count = this.#cleanupTasks.length;
    if (count === 0) {
      return;
    }

    this.#logger.debug(
      `${this.#controllerName}: Executing ${count} cleanup tasks`
    );

    while (this.#cleanupTasks.length > 0) {
      const { task, description } = this.#cleanupTasks.pop();
      try {
        task();
        this.#logger.debug(
          `${this.#controllerName}: Executed cleanup task: ${description}`
        );
      } catch (error) {
        this.#logger.error(
          `${this.#controllerName}: Cleanup task failed: ${description}`,
          error
        );
      }
    }
  }

  /**
   * Dispatches the initialization completion event.
   *
   * @param {number} duration
   */
  #dispatchInitializationEvent(duration) {
    if (!this.#eventBus?.dispatch) {
      return;
    }

    try {
      this.#eventBus.dispatch('core:controller_initialized', {
        controllerName: this.#controllerName,
        initializationTime: duration,
      });
    } catch (error) {
      this.#logger.error(
        `${this.#controllerName}: Failed to dispatch initialization event`,
        error
      );
    }
  }

  /**
   * Dispatches the destruction completion event.
   *
   * @param {number} duration
   */
  #dispatchDestructionEvent(duration) {
    if (!this.#eventBus?.dispatch) {
      return;
    }

    try {
      this.#eventBus.dispatch('CONTROLLER_DESTROYED', {
        controllerName: this.#controllerName,
        destructionTime: duration,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.#logger.error(
        `${this.#controllerName}: Failed to dispatch destruction event`,
        error
      );
    }
  }

  /**
   * Creates a lifecycle-specific error wrapper.
   *
   * @param {string} phaseName
   * @param {string} methodName
   * @param {Error} error
   * @returns {Error}
   */
  #createLifecycleError(phaseName, methodName, error) {
    const lifecycleError = new Error(`${phaseName} failed: ${error.message}`);
    lifecycleError.originalError = error;
    lifecycleError.phase = phaseName;
    lifecycleError.methodName = methodName;
    return lifecycleError;
  }
}

export default ControllerLifecycleOrchestrator;
