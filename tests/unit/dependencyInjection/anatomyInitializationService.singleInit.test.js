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
    configureBaseContainer(container, {
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
    // Create a real-like mock that tracks initialization state
    const realAnatomyInitService = {
      isInitialized: false,
      initialize: jest.fn(function () {
        if (this.isInitialized) {
          mockLogger.warn('AnatomyInitializationService: Already initialized');
          return;
        }
        this.isInitialized = true;
        initializeCallCount++;
      }),
    };

    // Configure base container
    configureBaseContainer(container, {
      includeAnatomySystems: true,
    });

    // Register the service tagged with INITIALIZABLE
    const registrar = new Registrar(container);
    registrar
      .tagged(INITIALIZABLE)
      .register(tokens.AnatomyInitializationService, realAnatomyInitService, {
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

    // Initialize through SystemInitializer
    const systemInitializer = container.resolve(tokens.SystemInitializer);
    await systemInitializer.initializeAll();

    // Attempt manual initialization (simulating the old behavior)
    const anatomyService = container.resolve(
      tokens.AnatomyInitializationService
    );
    anatomyService.initialize();

    // Verify initialize was called twice but only executed once
    expect(realAnatomyInitService.initialize).toHaveBeenCalledTimes(2);
    expect(initializeCallCount).toBe(1);

    // Verify warning was logged on second attempt
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'AnatomyInitializationService: Already initialized'
    );
  });

  it('should not attempt manual initialization in baseContainerConfig', () => {
    // Configure base container with anatomy systems
    configureBaseContainer(container, {
      includeAnatomySystems: true,
    });

    // Verify that the logger was called during configuration
    const debugCalls = mockLogger.debug.mock.calls.map((call) => call[0]);

    // The test purpose is to verify AnatomyInitializationService is NOT manually initialized
    // Since it's now tagged with INITIALIZABLE, it should be handled by SystemInitializer
    // We just need to verify the old manual initialization message is NOT present
    expect(mockLogger.debug).not.toHaveBeenCalledWith(
      '[BaseContainerConfig] AnatomyInitializationService initialized'
    );

    // Also verify that anatomy systems were registered
    const hasAnatomyRegistration = debugCalls.some(
      (msg) =>
        msg.includes('Anatomy Registration') ||
        msg.includes('AnatomyInitializationService')
    );

    expect(hasAnatomyRegistration).toBe(true);
  });
});
