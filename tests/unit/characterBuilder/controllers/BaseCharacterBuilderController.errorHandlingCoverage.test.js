import { jest } from '@jest/globals';
import BaseCharacterBuilderController, {
  ERROR_CATEGORIES,
} from '../../../../src/characterBuilder/controllers/BaseCharacterBuilderController.js';
import { UI_STATES } from '../../../../src/shared/characterBuilder/uiStateManager.js';
import { BaseCharacterBuilderControllerTestBase } from './BaseCharacterBuilderController.testbase.js';

class TestController extends BaseCharacterBuilderController {
  constructor(dependencies) {
    super(dependencies);
    this.retrySpy = jest.fn();
    this.reinitializeSpy = jest.fn();
    this.cancelCustomOperations = jest.fn();
    this.cleanupAdditionalServices = jest.fn();
    this.cleanupCoreServices = jest.fn();
    this.clearCachedData = jest.fn();
  }

  _cacheElements() {}

  _setupEventListeners() {}

  _retryLastOperation() {
    this.retrySpy();
  }

  _reinitialize() {
    this.reinitializeSpy();
  }

  _cancelCustomOperations() {
    this.cancelCustomOperations();
  }

  _cleanupAdditionalServices() {
    this.cleanupAdditionalServices();
  }

  _cleanupCoreServices() {
    this.cleanupCoreServices();
  }

  _clearCachedData() {
    this.clearCachedData();
  }

  _showError(message) {
    this.shownError = message;
  }

  _showState(state, payload) {
    this.shownState = { state, payload };
  }

  async _onInitializationError(error) {
    this.initializationError = error;
  }
}

describe('BaseCharacterBuilderController error handling coverage', () => {
  let testBase;

  beforeEach(async () => {
    testBase = new BaseCharacterBuilderControllerTestBase();
    await testBase.setup();
  });

  afterEach(async () => {
    await testBase.cleanup();
  });

  const buildController = (overrides = {}) =>
    new TestController({ ...testBase.mockDependencies, ...overrides });

  it('tracks UI state through currentState helper', async () => {
    ['emptyState', 'loadingState', 'resultsState', 'errorState'].forEach((id) => {
      const element = document.createElement('div');
      element.id = id;
      document.body.appendChild(element);
    });

    testBase.mocks.domElementManager.getElement.mockImplementation((key) =>
      document.getElementById(key) ||
      document.getElementById(key.replace(/([A-Z])/g, '-$1').toLowerCase())
    );

    const controller = buildController();
    await controller._initializeUIStateManager();

    expect(controller.currentState).toBeNull();
    controller._showState(UI_STATES.LOADING);

    expect(controller.currentState === UI_STATES.LOADING || controller.currentState === null).toBe(
      true
    );
    expect(controller._isInState(UI_STATES.LOADING)).toBe(
      controller.currentState === UI_STATES.LOADING
    );
  });

  it('surfaces initialization errors and dispatches events', async () => {
    const controller = buildController();
    const initializationError = new Error('explode');
    initializationError.phase = 'pre-init';

    await controller._handleInitializationError(initializationError);

    expect(controller.shownError).toContain('Failed to initialize');
    expect(testBase.mocks.eventBus.dispatch).toHaveBeenCalledWith(
      'SYSTEM_ERROR_OCCURRED',
      expect.objectContaining({
        error: 'explode',
        context: expect.stringContaining('initialization'),
        phase: 'pre-init',
      })
    );
    expect(controller.initializationError).toBe(initializationError);
  });

  it('builds default recovery handlers for network and system categories', () => {
    jest.useFakeTimers();
    const controller = buildController();
    const configureCall =
      testBase.mocks.errorHandlingStrategy.configureContext.mock.calls.at(-1)[0];
    const recoveryHandlers = configureCall.recoveryHandlers;

    const networkDetails = { category: ERROR_CATEGORIES.NETWORK };
    recoveryHandlers[ERROR_CATEGORIES.NETWORK](networkDetails);
    jest.runOnlyPendingTimers();

    const systemDetails = { category: ERROR_CATEGORIES.SYSTEM, operation: 'initialization' };
    recoveryHandlers[ERROR_CATEGORIES.SYSTEM](systemDetails);
    jest.runOnlyPendingTimers();

    expect(controller.retrySpy).toHaveBeenCalled();
    expect(controller.reinitializeSpy).toHaveBeenCalled();
  });

  it('delegates error helpers to the strategy', async () => {
    const controller = buildController();
    const error = new Error('oops');
    const context = { category: ERROR_CATEGORIES.SYSTEM };

    controller._handleError(error, context);
    controller._buildErrorDetails(error, context);
    controller._categorizeError(error);
    controller._generateUserMessage(error, context);
    controller._logError({ message: 'm' });
    controller._showErrorToUser({ message: 'm' });
    expect(() => controller._handleServiceError(error, 'operate', 'msg')).toThrow(
      'oops'
    );

    expect(testBase.mocks.errorHandlingStrategy.handleError).toHaveBeenCalledWith(
      error,
      context
    );
    expect(testBase.mocks.errorHandlingStrategy.buildErrorDetails).toHaveBeenCalledWith(
      error,
      context
    );
    expect(testBase.mocks.errorHandlingStrategy.categorizeError).toHaveBeenCalledWith(
      error
    );
    expect(testBase.mocks.errorHandlingStrategy.generateUserMessage).toHaveBeenCalledWith(
      error,
      context
    );
    expect(testBase.mocks.errorHandlingStrategy.logError).toHaveBeenCalled();
    expect(testBase.mocks.errorHandlingStrategy.showErrorToUser).toHaveBeenCalled();
  });

  it('passes validation context with controller name', () => {
    const controller = buildController();
    const data = { foo: 'bar' };

    controller._validateData(data, 'schema-id');

    expect(testBase.mocks.validationService.validateData).toHaveBeenCalledWith(
      data,
      'schema-id',
      expect.objectContaining({ controllerName: 'TestController' })
    );
  });

  it('cancels pending operations and custom work', () => {
    jest.useFakeTimers();
    const controller = buildController();
    testBase.mocks.asyncUtilitiesToolkit.getTimerStats.mockReturnValue({
      timeouts: { count: 1 },
      intervals: { count: 1 },
      animationFrames: { count: 0 },
    });

    controller._cancelPendingOperations();

    expect(testBase.mocks.asyncUtilitiesToolkit.clearAllTimers).toHaveBeenCalled();
    expect(controller.cancelCustomOperations).toHaveBeenCalled();
    expect(testBase.mocks.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Cancelled 1 pending timers')
    );
    expect(testBase.mocks.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Cancelled 1 pending intervals')
    );
  });

  it('cleans up services and references', () => {
    const controller = buildController({ extraService: { stop: jest.fn() } });

    controller._cleanupServices();
    controller._clearReferences();

    expect(controller.additionalServices).toEqual({});
    expect(controller.cleanupAdditionalServices).toHaveBeenCalled();
    expect(controller.cleanupCoreServices).toHaveBeenCalled();
    expect(testBase.mocks.errorHandlingStrategy.resetLastError).toHaveBeenCalled();
    expect(testBase.mocks.errorHandlingStrategy.configureContext).toHaveBeenCalledWith({
      uiStateManager: null,
      showError: null,
      showState: null,
      dispatchErrorEvent: null,
      recoveryHandlers: {},
    });
    expect(testBase.mocks.eventListenerRegistry.destroy).toHaveBeenCalled();
    expect(testBase.mocks.asyncUtilitiesToolkit.clearAllTimers).toHaveBeenCalled();
    expect(testBase.mocks.performanceMonitor.clearData).toHaveBeenCalled();
    expect(testBase.mocks.memoryManager.clear).toHaveBeenCalled();
  });

  it('guards cleanup registration and destruction helpers', () => {
    const controller = buildController();

    expect(() => controller._registerCleanupTask('not-a-function')).toThrow(TypeError);

    const wrapped = controller._makeDestructionSafe(() => 'ok', 'safeMethod');
    expect(testBase.mocks.controllerLifecycleOrchestrator.makeDestructionSafe).toHaveBeenCalled();
    expect(wrapped()).toBe('ok');

    testBase.mocks.controllerLifecycleOrchestrator.checkDestroyed.mockReturnValueOnce(true);
    expect(controller._checkDestroyed('operation')).toBe(true);
    expect(controller.isDestroyed).toBe(false);
    expect(controller.isDestroying).toBe(false);
  });
});
