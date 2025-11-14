/**
 * @file Integration tests for BaseCharacterBuilderController error recovery and cleanup flows
 */

import ConsoleLogger from '../../../../src/logging/consoleLogger.js';
import { SafeEventDispatcher } from '../../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../../src/events/eventBus.js';
import InMemoryDataRegistry from '../../../../src/data/inMemoryDataRegistry.js';
import GameDataRepository from '../../../../src/data/gameDataRepository.js';
import AjvSchemaValidator from '../../../../src/validation/ajvSchemaValidator.js';
import BaseCharacterBuilderController, {
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
} from '../../../../src/characterBuilder/controllers/BaseCharacterBuilderController.js';

class MinimalCharacterBuilderService {
  constructor(logger) {
    this.logger = logger;
  }

  async initialize() {
    this.logger.debug('Minimal service initialized');
  }

  async getAllCharacterConcepts() {
    return [];
  }

  async getCharacterConcept() {
    return null;
  }

  async createCharacterConcept() {
    return { id: 'generated-id' };
  }

  async updateCharacterConcept() {
    return { id: 'updated-id' };
  }

  async deleteCharacterConcept() {
    return true;
  }

  async generateThematicDirections() {
    return [];
  }

  async getThematicDirections() {
    return [];
  }
}

class RecoveryTestController extends BaseCharacterBuilderController {
  constructor(dependencies) {
    super(dependencies);
    this.retryAttempts = 0;
    this.reinitializeAttempts = 0;
    this.shouldRetryFail = false;
    this.shouldReinitializeFail = false;
  }

  cacheElement(key, selector, required = true) {
    return this._cacheElement(key, selector, required);
  }

  validateElementCache() {
    return this._validateElementCache();
  }

  buildValidationErrorMessage(errors) {
    return this._buildValidationErrorMessage(errors);
  }

  determineRecoverability(error, context) {
    return this._determineRecoverability(error, context);
  }

  isRecoverableError(details) {
    return this._isRecoverableError(details);
  }

  attemptErrorRecovery(details) {
    return this._attemptErrorRecovery(details);
  }

  createStandardError(message, category, metadata) {
    return this._createError(message, category, metadata);
  }

  wrapError(error, context) {
    return this._wrapError(error, context);
  }

  executePhase(name, fn) {
    return this._executePhase(name, fn);
  }

  cancelPendingOperations() {
    return this._cancelPendingOperations();
  }

  registerCleanupTask(task, description) {
    this._registerCleanupTask(task, description);
  }

  executeCleanupTasks() {
    this._executeCleanupTasks();
  }

  scheduleTimeout(callback, delay) {
    return this._setTimeout(callback, delay);
  }

  scheduleInterval(callback, delay) {
    return this._setInterval(callback, delay);
  }

  scheduleAnimation(callback) {
    return this._requestAnimationFrame(callback);
  }

  cancelAnimationById(frameId) {
    return this._cancelAnimationFrame(frameId);
  }

  createDebounced(fn, delay, options) {
    return this._debounce(fn, delay, options);
  }

  _retryLastOperation() {
    this.retryAttempts += 1;
    if (this.shouldRetryFail) {
      throw new Error('retry failure');
    }
  }

  _reinitialize() {
    this.reinitializeAttempts += 1;
    if (this.shouldReinitializeFail) {
      throw new Error('reinitialize failure');
    }
  }

  _cancelCustomOperations() {
    this.customCancellationCount =
      (this.customCancellationCount || 0) + 1;
  }

  _cleanupAdditionalServices() {
    this.additionalServicesCleaned = true;
  }

  _cleanupCoreServices() {
    this.coreServicesCleaned = true;
  }

  _clearCachedData() {
    this.cacheCleared = true;
  }
}

function createControllerDependencies() {
  const logger = new ConsoleLogger('DEBUG');
  logger.setLogLevel('DEBUG');

  const registry = new InMemoryDataRegistry({ logger });
  const repository = new GameDataRepository(registry, logger);
  const schemaValidator = new AjvSchemaValidator({ logger });
  const eventBus = new EventBus({ logger });
  const validatedDispatcher = new ValidatedEventDispatcher({
    eventBus,
    gameDataRepository: repository,
    schemaValidator,
    logger,
  });
  const safeDispatcher = new SafeEventDispatcher({
    validatedEventDispatcher: validatedDispatcher,
    logger,
  });
  const characterBuilderService = new MinimalCharacterBuilderService(logger);

  return {
    logger,
    schemaValidator,
    eventBus: safeDispatcher,
    characterBuilderService,
  };
}

function mountBaseDOM(extra = '') {
  document.body.innerHTML = `
    <div id="empty-state" class="state-container"></div>
    <div id="loading-state" class="state-container"></div>
    <div id="error-state" class="state-container"></div>
    <div id="results-state" class="state-container"></div>
    ${extra}
  `;
}

function setupController(extraDom = '') {
  mountBaseDOM(extraDom);
  const dependencies = createControllerDependencies();
  const controller = new RecoveryTestController(dependencies);

  return { controller, dependencies };
}

describe('BaseCharacterBuilderController recovery helpers (integration)', () => {
  afterEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = '';
    jest.clearAllTimers();
  });

  it('validates cached elements and warns about missing DOM nodes', () => {
    const { controller, dependencies } = setupController(`
      <section id="existing-node"></section>
      <div id="temporary-node"></div>
    `);

    try {
      controller.cacheElement('existing', '#existing-node');
      controller.cacheElement('temporary', '#temporary-node');
      controller.cacheElement('optional', '#missing-node', false);

      const removable = document.getElementById('temporary-node');
      removable.remove();

      const warnSpy = jest.spyOn(dependencies.logger, 'warn');
      const results = controller.validateElementCache();

      expect(results.total).toBe(3);
      expect(results.valid).toEqual(['existing']);
      expect(results.invalid).toEqual(
        expect.arrayContaining(['temporary', 'optional'])
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Cached element 'temporary' no longer in DOM")
      );
      warnSpy.mockRestore();
    } finally {
      controller.destroy();
    }
  });

  it('builds validation messages and drives recovery flows across error categories', () => {
    jest.useFakeTimers();
    const { controller, dependencies } = setupController();

    try {
      const infoSpy = jest.spyOn(dependencies.logger, 'info');
      const errorSpy = jest.spyOn(dependencies.logger, 'error');

      expect(
        controller.buildValidationErrorMessage(['Missing core motivation'])
      ).toBe('Missing core motivation');

      expect(
        controller.buildValidationErrorMessage([
          'Fix alignment',
          'Provide archetype',
        ])
      ).toBe(
        'Please fix the following errors:\n• Fix alignment\n• Provide archetype'
      );

      expect(
        controller.determineRecoverability(new Error('offline'), {
          category: ERROR_CATEGORIES.NETWORK,
        })
      ).toBe(true);

      expect(
        controller.determineRecoverability(
          new Error('temporary overload'),
          { category: ERROR_CATEGORIES.SYSTEM }
        )
      ).toBe(true);

      expect(
        controller.determineRecoverability(new Error('blocked'), {
          category: ERROR_CATEGORIES.PERMISSION,
        })
      ).toBe(false);

      expect(
        controller.isRecoverableError({
          isRecoverable: true,
          severity: ERROR_SEVERITY.WARNING,
        })
      ).toBe(true);
      expect(
        controller.isRecoverableError({
          isRecoverable: true,
          severity: ERROR_SEVERITY.CRITICAL,
        })
      ).toBe(false);

      controller.shouldRetryFail = true;
      controller.shouldReinitializeFail = true;

      controller.attemptErrorRecovery({
        category: ERROR_CATEGORIES.NETWORK,
        operation: 'generate-directions',
        isRecoverable: true,
        severity: ERROR_SEVERITY.WARNING,
      });

      controller.attemptErrorRecovery({
        category: ERROR_CATEGORIES.SYSTEM,
        operation: 'initialization',
        isRecoverable: true,
        severity: ERROR_SEVERITY.ERROR,
      });

      controller.attemptErrorRecovery({
        category: ERROR_CATEGORIES.USER,
        operation: 'noop',
      });

      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Attempting recovery from network error')
      );

      jest.runOnlyPendingTimers();

      expect(controller.retryAttempts).toBeGreaterThan(0);
      expect(controller.reinitializeAttempts).toBeGreaterThan(0);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Recovery retry failed'),
        expect.any(Error)
      );
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Recovery reinitialize failed'),
        expect.any(Error)
      );

      infoSpy.mockRestore();
      errorSpy.mockRestore();
    } finally {
      controller.destroy();
    }
  });

  it('handles destruction helpers, pending operations, and cleanup failures', () => {
    jest.useFakeTimers();
    const { controller, dependencies } = setupController();

    const originalRAF = global.requestAnimationFrame;
    const originalCAF = global.cancelAnimationFrame;

    const scheduledFrames = new Map();
    global.requestAnimationFrame = jest.fn((callback) => {
      const id = scheduledFrames.size + 1;
      scheduledFrames.set(id, callback);
      return id;
    });
    global.cancelAnimationFrame = jest.fn((id) => {
      scheduledFrames.delete(id);
    });

    try {
      const errorSpy = jest.spyOn(dependencies.logger, 'error');

      controller.executePhase('failing-phase', () => {
        throw new Error('phase failure');
      });

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in failing-phase'),
        expect.any(Error)
      );

      controller.scheduleTimeout(() => {}, 25);
      controller.scheduleInterval(() => {}, 50);
      const animationFrame = controller.scheduleAnimation(() => {});
      controller.cancelAnimationById(animationFrame);
      expect(global.cancelAnimationFrame).toHaveBeenCalledWith(animationFrame);

      const frameToCancelDuringCleanup = controller.scheduleAnimation(() => {});

      controller.cancelPendingOperations();
      expect(global.cancelAnimationFrame).toHaveBeenCalledWith(
        frameToCancelDuringCleanup
      );
      expect(controller.customCancellationCount).toBe(1);

      controller.registerCleanupTask(() => {}, 'safe cleanup');
      controller.registerCleanupTask(() => {
        throw new Error('cleanup failure');
      }, 'failing cleanup');

      controller.executeCleanupTasks();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cleanup task failed: failing cleanup'),
        expect.any(Error)
      );

      errorSpy.mockRestore();
    } finally {
      global.requestAnimationFrame = originalRAF;
      global.cancelAnimationFrame = originalCAF;
      controller.destroy();
    }
  });

  it('clears maxWait timers when cancelling debounced handlers', () => {
    const { controller } = setupController();

    try {
      const clearTimeoutSpy = jest.spyOn(controller, '_clearTimeout');
      const dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => 0);

      const debounced = controller.createDebounced(
        () => {},
        20,
        { maxWait: 50, leading: false }
      );

      debounced('first-call');
      debounced.cancel();

      expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);

      clearTimeoutSpy.mockRestore();
      dateNowSpy.mockRestore();
    } finally {
      controller.destroy();
    }
  });
});
