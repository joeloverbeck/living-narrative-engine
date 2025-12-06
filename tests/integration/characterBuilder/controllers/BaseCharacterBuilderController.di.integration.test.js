/**
 * @file Integration tests for DI registration powering BaseCharacterBuilderController.
 */

import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { configureMinimalContainer } from '../../../../src/dependencyInjection/minimalContainerConfig.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import BaseCharacterBuilderController from '../../../../src/characterBuilder/controllers/BaseCharacterBuilderController.js';

class DependencyProbeController extends BaseCharacterBuilderController {
  constructor(dependencies) {
    super(dependencies);
    this.receivedDependencies = dependencies;
  }

  async initialize() {
    // Override to bypass heavy lifecycle work for the probe controller.
  }

  cacheElementProbe(key, selector) {
    return this._cacheElement(key, selector, false);
  }

  addListenerProbe(element, event, handler) {
    return this._addEventListener(element, event, handler);
  }

  scheduleTimeoutProbe(callback, delay) {
    return this._setTimeout(callback, delay);
  }

  performanceMarkProbe(markName) {
    this._performanceMark(markName);
  }

  setWeakReferenceProbe(key, value) {
    this._setWeakReference(key, value);
  }

  validateProbe(data, schemaId) {
    return this._validateData(data, schemaId);
  }

  getInjectedDependencies() {
    return this.receivedDependencies;
  }
}

/**
 *
 */
function createLoggerMock() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 *
 * @param logger
 */
function createCharacterBuilderServiceMock(logger) {
  const noop = async () => ({ logger });
  return {
    initialize: jest.fn(noop),
    getAllCharacterConcepts: jest.fn(noop),
    createCharacterConcept: jest.fn(noop),
    updateCharacterConcept: jest.fn(noop),
    deleteCharacterConcept: jest.fn(noop),
    getCharacterConcept: jest.fn(noop),
    generateThematicDirections: jest.fn(noop),
    getThematicDirections: jest.fn(noop),
  };
}

/**
 *
 */
function createEventBusMock() {
  return {
    dispatch: jest.fn(),
    subscribe: jest.fn(() => jest.fn()),
    unsubscribe: jest.fn(),
  };
}

/**
 *
 */
function createSchemaValidatorMock() {
  return {
    validate: jest.fn(() => ({ isValid: true })),
  };
}

describe('BaseCharacterBuilderController DI integration', () => {
  let container;

  beforeEach(async () => {
    container = new AppContainer();
    await configureMinimalContainer(container, {
      includeCharacterBuilder: true,
    });
  });

  it('registers singleton infrastructure services in the container', () => {
    const infrastructureTokens = [
      tokens.DOMElementManager,
      tokens.EventListenerRegistry,
      tokens.ControllerLifecycleOrchestrator,
      tokens.ErrorHandlingStrategy,
      tokens.AsyncUtilitiesToolkit,
      tokens.PerformanceMonitor,
      tokens.ValidationService,
      tokens.MemoryManager,
    ];

    infrastructureTokens.forEach((token) => {
      const firstResolve = container.resolve(token);
      const secondResolve = container.resolve(token);
      expect(firstResolve).toBe(secondResolve);
    });
  });

  it('injects resolved services into BaseCharacterBuilderController', () => {
    const logger = createLoggerMock();
    const characterBuilderService = createCharacterBuilderServiceMock(logger);
    const eventBus = createEventBusMock();
    const schemaValidator = createSchemaValidatorMock();

    const domElementManager = container.resolve(tokens.DOMElementManager);
    const eventListenerRegistry = container.resolve(
      tokens.EventListenerRegistry
    );
    const controllerLifecycle = container.resolve(
      tokens.ControllerLifecycleOrchestrator
    );
    const asyncToolkit = container.resolve(tokens.AsyncUtilitiesToolkit);
    const performanceMonitor = container.resolve(tokens.PerformanceMonitor);
    const memoryManager = container.resolve(tokens.MemoryManager);
    const errorHandlingStrategy = container.resolve(
      tokens.ErrorHandlingStrategy
    );
    const validationService = container.resolve(tokens.ValidationService);

    const domConfigureSpy = jest.spyOn(domElementManager, 'configure');
    const domCacheSpy = jest.spyOn(domElementManager, 'cacheElement');
    const eventRegistrySpy = jest.spyOn(
      eventListenerRegistry,
      'addEventListener'
    );
    const toolkitSpy = jest.spyOn(asyncToolkit, 'setTimeout');
    const performanceMarkSpy = jest.spyOn(performanceMonitor, 'mark');
    const memoryContextSpy = jest.spyOn(memoryManager, 'setContextName');
    const memorySetSpy = jest.spyOn(memoryManager, 'setWeakReference');
    const errorConfigureSpy = jest.spyOn(
      errorHandlingStrategy,
      'configureContext'
    );
    const validationConfigureSpy = jest.spyOn(validationService, 'configure');
    const validationExecuteSpy = jest.spyOn(validationService, 'validateData');

    const controller = new DependencyProbeController({
      logger,
      characterBuilderService,
      eventBus,
      schemaValidator,
      controllerLifecycleOrchestrator: controllerLifecycle,
      domElementManager,
      eventListenerRegistry,
      asyncUtilitiesToolkit: asyncToolkit,
      performanceMonitor,
      memoryManager,
      errorHandlingStrategy,
      validationService,
    });

    expect(controller).toBeInstanceOf(DependencyProbeController);
    expect(domConfigureSpy).toHaveBeenCalled();
    expect(errorConfigureSpy).toHaveBeenCalled();
    expect(validationConfigureSpy).toHaveBeenCalled();
    expect(memoryContextSpy).toHaveBeenCalled();

    const probeElement = document.createElement('button');
    probeElement.id = 'di-probe';
    document.body.appendChild(probeElement);

    controller.cacheElementProbe('probe', '#di-probe');
    expect(domCacheSpy).toHaveBeenCalledWith('probe', '#di-probe', false);

    controller.addListenerProbe(probeElement, 'click', jest.fn());
    expect(eventRegistrySpy).toHaveBeenCalled();

    controller.scheduleTimeoutProbe(jest.fn(), 25);
    expect(toolkitSpy).toHaveBeenCalledWith(expect.any(Function), 25);

    controller.performanceMarkProbe('di-start');
    expect(performanceMarkSpy).toHaveBeenCalledWith('di-start');

    controller.setWeakReferenceProbe({}, 'value');
    expect(memorySetSpy).toHaveBeenCalled();

    controller.validateProbe({ foo: 'bar' }, 'schema#1');
    expect(validationExecuteSpy).toHaveBeenCalledWith(
      { foo: 'bar' },
      'schema#1',
      expect.objectContaining({ controllerName: 'DependencyProbeController' })
    );

    const injected = controller.getInjectedDependencies();
    expect(injected.domElementManager).toBe(domElementManager);
    expect(injected.eventListenerRegistry).toBe(eventListenerRegistry);
    expect(injected.asyncUtilitiesToolkit).toBe(asyncToolkit);
    expect(injected.performanceMonitor).toBe(performanceMonitor);
    expect(injected.memoryManager).toBe(memoryManager);
    expect(injected.errorHandlingStrategy).toBe(errorHandlingStrategy);
    expect(injected.validationService).toBe(validationService);
    expect(injected.controllerLifecycleOrchestrator).toBe(controllerLifecycle);
  });
});
