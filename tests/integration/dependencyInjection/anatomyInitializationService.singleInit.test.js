/**
 * @file Test to ensure AnatomyInitializationService is only initialized once
 * @description Verifies that the service tagged with INITIALIZABLE is not manually initialized
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureBaseContainer } from '../../../src/dependencyInjection/baseContainerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { INITIALIZABLE } from '../../../src/dependencyInjection/tags.js';
import SystemInitializer from '../../../src/initializers/systemInitializer.js';
import { Registrar } from '../../../src/utils/registrarHelpers.js';

describe('AnatomyInitializationService - Single Initialization', () => {
  let container;
  let mockLogger;
  let mockAnatomyInitService;
  let initializeCallCount;
  let mockEventDispatcher;
  let mockEventDispatchService;

  beforeEach(() => {
    container = new AppContainer();
    initializeCallCount = 0;

    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock AnatomyInitializationService
    mockAnatomyInitService = {
      initialize: jest.fn(() => {
        initializeCallCount++;
      }),
    };

    // Mock event dispatcher
    mockEventDispatcher = {
      dispatch: jest.fn(),
    };

    // Mock event dispatch service
    mockEventDispatchService = {
      dispatchWithLogging: jest.fn(),
    };

    // Register mock logger and event services
    container.register(tokens.ILogger, mockLogger, { isInstance: true });
    container.register(tokens.IValidatedEventDispatcher, mockEventDispatcher, {
      isInstance: true,
    });
    container.register(tokens.EventDispatchService, mockEventDispatchService, {
      isInstance: true,
    });
  });

  it('should only initialize AnatomyInitializationService once through SystemInitializer', async () => {
    // Configure base container with anatomy systems enabled
    await configureBaseContainer(container, {
      includeAnatomySystems: true,
    });

    // Register mock AnatomyInitializationService tagged with INITIALIZABLE
    const registrar = new Registrar(container);
    registrar
      .tagged(INITIALIZABLE)
      .register(tokens.AnatomyInitializationService, mockAnatomyInitService, {
        isInstance: true,
      });

    // Register SystemInitializer with all required dependencies
    registrar.register(
      tokens.SystemInitializer,
      (c) =>
        new SystemInitializer({
          resolver: c,
          logger: c.resolve(tokens.ILogger),
          validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
          eventDispatchService: c.resolve(tokens.EventDispatchService),
          initializationTag: INITIALIZABLE[0],
        }),
      { lifecycle: 'singleton' }
    );

    // Get SystemInitializer and initialize all tagged systems
    const systemInitializer = container.resolve(tokens.SystemInitializer);
    await systemInitializer.initializeAll();

    // Verify initialize was called exactly once
    expect(mockAnatomyInitService.initialize).toHaveBeenCalledTimes(1);
    expect(initializeCallCount).toBe(1);

    // Verify no manual initialization warning was logged
    expect(mockLogger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining(
        'AnatomyInitializationService: Already initialized'
      )
    );
  });

  it('should warn if manual initialization is attempted after SystemInitializer', async () => {
    // Configure base container first - this registers the real service
    await configureBaseContainer(container, {
      includeAnatomySystems: true,
    });

    // Now get the actual registered service and spy on it
    const anatomyService = container.resolve(tokens.AnatomyInitializationService);
    
    // Spy on the initialize method to track calls
    const originalInitialize = anatomyService.initialize.bind(anatomyService);
    let callCount = 0;
    anatomyService.initialize = jest.fn(function() {
      callCount++;
      return originalInitialize();
    });

    // Register SystemInitializer with all required dependencies
    const registrar = new Registrar(container);
    registrar.register(
      tokens.SystemInitializer,
      (c) =>
        new SystemInitializer({
          resolver: c,
          logger: c.resolve(tokens.ILogger),
          validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
          eventDispatchService: c.resolve(tokens.EventDispatchService),
          initializationTag: INITIALIZABLE[0],
        }),
      { lifecycle: 'singleton' }
    );

    // Initialize through SystemInitializer
    const systemInitializer = container.resolve(tokens.SystemInitializer);
    await systemInitializer.initializeAll();
    
    // Verify it was initialized once by SystemInitializer
    expect(anatomyService.initialize).toHaveBeenCalledTimes(1);
    expect(callCount).toBe(1);

    // Now attempt manual initialization (simulating the old behavior)
    anatomyService.initialize();

    // Verify initialize was called twice total but only executed once (due to guard in the service)
    expect(anatomyService.initialize).toHaveBeenCalledTimes(2);
    expect(callCount).toBe(2); // Called twice
    
    // The actual service logs this warning when already initialized
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'AnatomyInitializationService: Already initialized'
    );
  });

  it('should not attempt manual initialization in baseContainerConfig', async () => {
    // Spy on the AnatomyInitializationService constructor to detect if initialize is called during registration
    let initializeCalledDuringRegistration = false;
    
    // Mock the AnatomyInitializationService before configuring the container
    const OriginalAnatomyInitService = require('../../../src/anatomy/anatomyInitializationService.js').AnatomyInitializationService;
    const mockInitialize = jest.fn();
    
    // Track if initialize is called during the configuration phase
    jest.spyOn(OriginalAnatomyInitService.prototype, 'initialize').mockImplementation(function() {
      // If this is called, it means manual initialization happened
      initializeCalledDuringRegistration = true;
      mockInitialize();
    });

    // Configure base container with anatomy systems
    await configureBaseContainer(container, {
      includeAnatomySystems: true,
    });

    // The test purpose is to verify AnatomyInitializationService is NOT manually initialized
    // Since it's now tagged with INITIALIZABLE, it should be handled by SystemInitializer
    expect(initializeCalledDuringRegistration).toBe(false);
    expect(mockInitialize).not.toHaveBeenCalled();

    // Verify that the service is registered in the container
    let anatomyService = null;
    expect(() => {
      anatomyService = container.resolve(tokens.AnatomyInitializationService);
    }).not.toThrow();
    
    expect(anatomyService).not.toBeNull();
    expect(anatomyService).toBeDefined();
    
    // Verify that the service is tagged with INITIALIZABLE
    const taggedServices = container.resolveByTag(INITIALIZABLE[0]);
    const hasAnatomyService = taggedServices.some(
      service => service === anatomyService
    );
    
    expect(hasAnatomyService).toBe(true);
    
    // Restore the original implementation
    OriginalAnatomyInitService.prototype.initialize.mockRestore();
  });
});
