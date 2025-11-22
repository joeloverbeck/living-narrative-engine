/* eslint-env node */
/**
 * @file Test suite to cover command and action registrations.
 * @see src/dependencyInjection/registrations/commandAndActionRegistrations.js
 */

// --- Test Framework & Mocker Imports ---
import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { mock, mockDeep } from 'jest-mock-extended';

// --- DI & System Under Test (SUT) Imports ---
import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { registerCommandAndAction } from '../../../../src/dependencyInjection/registrations/commandAndActionRegistrations.js';
import { INITIALIZABLE } from '../../../../src/dependencyInjection/tags.js';
import { ServiceSetup } from '../../../../src/utils/serviceInitializerUtils.js';
import { actionTracingTokens } from '../../../../src/dependencyInjection/tokens/actionTracingTokens.js';

// --- Concrete Class Imports for `instanceof` checks ---
import { ActionDiscoveryService } from '../../../../src/actions/actionDiscoveryService.js';
import { ActionValidationContextBuilder } from '../../../../src/actions/validation/actionValidationContextBuilder.js';
import { PrerequisiteEvaluationService } from '../../../../src/actions/validation/prerequisiteEvaluationService.js';
import CommandProcessor from '../../../../src/commands/commandProcessor.js';
import { expectSingleton } from '../../../common/containerAssertions.js';

describe('registerCommandAndAction', () => {
  /** @type {AppContainer} */
  let container;
  let registerSpy;

  // --- Mock External Dependencies ---
  const mockLogger = mock();
  const mockGameDataRepository = mockDeep();
  const mockEntityManager = mockDeep();
  const mockJsonLogicEvaluationService = mockDeep();
  const mockWorldContext = mockDeep();
  const mockValidatedEventDispatcher = mockDeep();
  const mockSafeEventDispatcher = mockDeep();
  const mockScopeRegistry = mockDeep();
  const mockScopeEngine = mockDeep();
  const mockDslParser = { parse: jest.fn() };
  const mockEventDispatchService = mockDeep();

  // Mock pipeline services that are registered by registerPipelineServices
  const mockTargetDependencyResolver = mockDeep();
  const mockLegacyTargetCompatibilityLayer = mockDeep();
  const mockScopeContextBuilder = mockDeep();
  const mockTargetDisplayNameResolver = mockDeep();
  const mockTargetResolutionTracingOrchestrator = mockDeep();
  const mockTargetResolutionResultBuilder = mockDeep();
  const mockTargetResolutionCoordinator = mockDeep();

  // Additional mocks for comprehensive coverage
  const mockTraceConfiguration = mockDeep();
  const mockActionAwareStructuredTrace = mockDeep();
  const mockActionTraceFilter = mockDeep();
  const mockCommandOutcomeInterpreter = mockDeep();

  beforeEach(() => {
    container = new AppContainer();

    // Spy on the container's register method to check options later
    registerSpy = jest.spyOn(container, 'register');

    // Register all necessary mock dependencies that the SUT's factories will resolve.
    // These are dependencies external to the group of services being registered.
    container.register(tokens.ILogger, () => mockLogger);
    container.register(
      tokens.IGameDataRepository,
      () => mockGameDataRepository
    );
    container.register(tokens.IEntityManager, () => mockEntityManager);
    container.register(
      tokens.JsonLogicEvaluationService,
      () => mockJsonLogicEvaluationService
    );
    container.register(tokens.IWorldContext, () => mockWorldContext);
    container.register(
      tokens.IValidatedEventDispatcher,
      () => mockValidatedEventDispatcher
    );
    container.register(
      tokens.ISafeEventDispatcher,
      () => mockSafeEventDispatcher
    );
    container.register(tokens.IScopeRegistry, () => mockScopeRegistry);
    container.register(tokens.IScopeEngine, () => mockScopeEngine);
    container.register(tokens.DslParser, () => mockDslParser);
    container.register(tokens.ServiceSetup, () => new ServiceSetup());
    container.register(
      tokens.EventDispatchService,
      () => mockEventDispatchService
    );

    // Register pipeline service dependencies that commandAndActionRegistrations expects
    // These are normally registered by registerPipelineServices() which runs before registerCommandAndAction()
    container.register(
      tokens.ITargetDependencyResolver,
      () => mockTargetDependencyResolver
    );
    container.register(
      tokens.ILegacyTargetCompatibilityLayer,
      () => mockLegacyTargetCompatibilityLayer
    );
    container.register(
      tokens.IScopeContextBuilder,
      () => mockScopeContextBuilder
    );
    container.register(
      tokens.ITargetDisplayNameResolver,
      () => mockTargetDisplayNameResolver
    );
    container.register(
      tokens.ITargetResolutionTracingOrchestrator,
      () => mockTargetResolutionTracingOrchestrator
    );
    container.register(
      tokens.ITargetResolutionResultBuilder,
      () => mockTargetResolutionResultBuilder
    );
    container.register(
      tokens.ITargetResolutionCoordinator,
      () => mockTargetResolutionCoordinator
    );

    // Register additional dependencies for comprehensive coverage
    container.register(
      tokens.ICommandOutcomeInterpreter,
      () => mockCommandOutcomeInterpreter
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should log start, intermediate, and end messages in order', () => {
    registerCommandAndAction(container);

    const logCalls = mockLogger.debug.mock.calls.map((call) => call[0]);

    expect(logCalls[0]).toBe('Command and Action Registration: Starting...');
    expect(logCalls).toContain(
      `Command and Action Registration: Registered ${String(
        tokens.IActionDiscoveryService
      )}.`
    );
    expect(logCalls).toContain(
      'Command and Action Registration: Registered Action Validation services.'
    );
    expect(logCalls).toContain(
      `Command and Action Registration: Registered ${String(
        tokens.ICommandProcessor
      )}.`
    );
    expect(logCalls[logCalls.length - 1]).toBe(
      'Command and Action Registration: Completed.'
    );
  });

  describe('Service Registrations', () => {
    const registrations = [
      {
        token: tokens.IActionDiscoveryService,
        Class: ActionDiscoveryService,
        lifecycle: 'singletonFactory',
        // --- FINAL FIX IS HERE ---
        // The constant INITIALIZABLE is already an array: ['initializableSystem'].
        // Wrapping it in another array `[INITIALIZABLE]` created a nested array `[['...']]`
        // which does not match the flattened array produced by the Registrar.
        // We provide the constant directly.
        tags: INITIALIZABLE,
      },
      {
        token: tokens.ActionValidationContextBuilder,
        Class: ActionValidationContextBuilder,
        lifecycle: 'singleton',
        tags: undefined,
      },
      {
        token: tokens.PrerequisiteEvaluationService,
        Class: PrerequisiteEvaluationService,
        lifecycle: 'singleton',
        tags: undefined,
      },
      {
        token: tokens.ICommandProcessor,
        Class: CommandProcessor,
        lifecycle: 'singletonFactory',
        tags: undefined,
      },
    ];

    test.each(registrations)(
      'should register $token correctly as a $lifecycle',
      ({ token, Class, lifecycle, tags }) => {
        // --- Act ---
        registerCommandAndAction(container);

        // --- Assert ---
        expectSingleton(container, token, Class);

        // 3. Find the call to container.register for the specific token using the spy
        const registrationCall = registerSpy.mock.calls.find(
          (call) => call[0] === token
        );
        expect(registrationCall).toBeDefined();

        // 4. Verify the registration options (lifecycle and tags)
        const options = registrationCall[2] || {};
        expect(options.lifecycle).toBe(lifecycle);

        // Verify tags - either match expected or be undefined
        const expectedTags = tags || undefined;
        expect(options.tags).toEqual(expectedTags);
      }
    );
  });

  describe('TraceContextFactory Error Handling', () => {
    test('should handle ITraceConfiguration not being registered', () => {
      // Arrange - Don't register ITraceConfiguration to trigger the catch block

      // Act
      registerCommandAndAction(container);

      // Assert - Get the factory and test it creates trace with fallback config
      const traceFactory = container.resolve(tokens.TraceContextFactory);
      expect(traceFactory).toBeDefined();

      const trace = traceFactory();
      expect(trace).toBeDefined();
    });

    test('should handle ITraceConfiguration resolution failure', () => {
      // Arrange - Register ITraceConfiguration that throws on resolve
      const throwingConfig = () => {
        throw new Error('Configuration resolution failed');
      };
      container.register(tokens.ITraceConfiguration, throwingConfig);

      // Act
      registerCommandAndAction(container);

      // Assert - Factory should still work with fallback config
      const traceFactory = container.resolve(tokens.TraceContextFactory);
      expect(traceFactory).toBeDefined();

      const trace = traceFactory();
      expect(trace).toBeDefined();
    });

    test('should use ITraceConfiguration when available', () => {
      // Arrange - Register ITraceConfiguration properly
      container.register(
        tokens.ITraceConfiguration,
        () => mockTraceConfiguration
      );

      // Act
      registerCommandAndAction(container);

      // Assert - Factory should work with the registered config
      const traceFactory = container.resolve(tokens.TraceContextFactory);
      expect(traceFactory).toBeDefined();

      const trace = traceFactory();
      expect(trace).toBeDefined();
    });
  });

  describe('Optional Action Tracing Dependencies', () => {
    test('should handle IActionAwareStructuredTrace resolution error', () => {
      // Arrange - Register IActionAwareStructuredTrace that throws during resolution
      container.register(tokens.IActionAwareStructuredTrace, () => {
        throw new Error('ActionAwareStructuredTrace resolution failed');
      });

      // Act
      registerCommandAndAction(container);

      // Assert - ActionDiscoveryService should be created without tracing
      const actionDiscovery = container.resolve(tokens.IActionDiscoveryService);
      expect(actionDiscovery).toBeInstanceOf(ActionDiscoveryService);

      // Check that debug logging occurred for the error
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ActionAwareStructuredTrace not available',
        expect.any(Error)
      );
    });

    test('should handle IActionTraceFilter resolution error', () => {
      // Arrange - Register IActionTraceFilter that throws during resolution
      container.register(tokens.IActionTraceFilter, () => {
        throw new Error('ActionTraceFilter resolution failed');
      });

      // Act
      registerCommandAndAction(container);

      // Assert - ActionDiscoveryService should be created
      const actionDiscovery = container.resolve(tokens.IActionDiscoveryService);
      expect(actionDiscovery).toBeInstanceOf(ActionDiscoveryService);

      // Check that debug logging occurred for the error
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ActionTraceFilter not available',
        expect.any(Error)
      );
    });

    test('should handle both action tracing dependencies missing', () => {
      // Arrange - Don't register either tracing dependency

      // Act
      registerCommandAndAction(container);

      // Assert - ActionDiscoveryService should be created without tracing
      const actionDiscovery = container.resolve(tokens.IActionDiscoveryService);
      expect(actionDiscovery).toBeInstanceOf(ActionDiscoveryService);

      // Check that info logging shows tracing not available
      // Note: ActionTraceOutputService is always available because it's automatically registered
      expect(mockLogger.info).toHaveBeenCalledWith(
        'ActionDiscoveryService: Action tracing not available, output available',
        {
          hasActionAwareTraceFactory: false,
          hasActionTraceFilter: false,
          hasActionTraceOutputService: true,
        }
      );
    });

    test('should handle both action tracing dependencies available', () => {
      // Arrange - Register both tracing dependencies
      container.register(
        tokens.IActionAwareStructuredTrace,
        () => mockActionAwareStructuredTrace
      );
      container.register(
        tokens.IActionTraceFilter,
        () => mockActionTraceFilter
      );

      // Act
      registerCommandAndAction(container);

      // Assert - ActionDiscoveryService should be created with tracing
      const actionDiscovery = container.resolve(tokens.IActionDiscoveryService);
      expect(actionDiscovery).toBeInstanceOf(ActionDiscoveryService);

      // Check that info logging shows tracing available
      // Note: ActionTraceOutputService is always available because it's automatically registered
      expect(mockLogger.info).toHaveBeenCalledWith(
        'ActionDiscoveryService: Action tracing available, output available',
        {
          hasActionAwareTraceFactory: true,
          hasActionTraceFilter: true,
          hasActionTraceOutputService: true,
        }
      );
    });

    test('should handle IActionTraceOutputService resolution error', () => {
      // Arrange - Register IActionTraceOutputService that throws during resolution
      const throwingActionTraceOutputService = jest.fn(() => {
        throw new Error('ActionTraceOutputService resolution failed');
      });
      container.register(
        actionTracingTokens.IActionTraceOutputService,
        throwingActionTraceOutputService
      );

      // Act
      registerCommandAndAction(container);

      // Assert - ActionDiscoveryService should be created and log the failure gracefully
      const actionDiscovery = container.resolve(tokens.IActionDiscoveryService);
      expect(actionDiscovery).toBeInstanceOf(ActionDiscoveryService);
      expect(throwingActionTraceOutputService).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ActionTraceOutputService not available',
        expect.any(Error)
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'ActionDiscoveryService: Action tracing not available, output not available',
        {
          hasActionAwareTraceFactory: false,
          hasActionTraceFilter: false,
          hasActionTraceOutputService: false,
        }
      );
    });
  });

  describe('Factory Function Coverage', () => {
    test('should register ActionCandidateProcessor via singletonFactory', () => {
      // Act
      registerCommandAndAction(container);

      // Assert - Service should be resolvable and be a singleton
      const first = container.resolve(tokens.ActionCandidateProcessor);
      const second = container.resolve(tokens.ActionCandidateProcessor);

      expect(first).toBeDefined();
      expect(first).toBe(second); // Singleton behavior
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Command and Action Registration: Registered ActionCandidateProcessor.'
      );
    });

    test('should register UnifiedErrorHandler via singletonFactory', () => {
      // Act
      registerCommandAndAction(container);

      // Assert - Service should be resolvable and be a singleton
      const first = container.resolve(tokens.UnifiedErrorHandler);
      const second = container.resolve(tokens.UnifiedErrorHandler);

      expect(first).toBeDefined();
      expect(first).toBe(second); // Singleton behavior
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Command and Action Registration: Registered UnifiedErrorHandler.'
      );
    });

    test('should register DirectiveStrategyResolver via singletonFactory', () => {
      // Act
      registerCommandAndAction(container);

      // Assert - Service should be resolvable and be a singleton
      const first = container.resolve(tokens.DirectiveStrategyResolver);
      const second = container.resolve(tokens.DirectiveStrategyResolver);

      expect(first).toBeDefined();
      expect(first).toBe(second); // Singleton behavior
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Command and Action Registration: Registered DirectiveStrategyResolver.'
      );
    });

    test('should register CommandDispatcher via singletonFactory', () => {
      // Act
      registerCommandAndAction(container);

      // Assert - Service should be resolvable and be a singleton
      const first = container.resolve(tokens.CommandDispatcher);
      const second = container.resolve(tokens.CommandDispatcher);

      expect(first).toBeDefined();
      expect(first).toBe(second); // Singleton behavior
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Command and Action Registration: Registered CommandDispatcher.'
      );
    });

    test('should register DirectiveExecutor via singletonFactory', () => {
      // Act
      registerCommandAndAction(container);

      // Assert - Service should be resolvable and be a singleton
      const first = container.resolve(tokens.DirectiveExecutor);
      const second = container.resolve(tokens.DirectiveExecutor);

      expect(first).toBeDefined();
      expect(first).toBe(second); // Singleton behavior
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Command and Action Registration: Registered DirectiveExecutor.'
      );
    });

    test('should register ResultInterpreter via singletonFactory', () => {
      // Act
      registerCommandAndAction(container);

      // Assert - Service should be resolvable and be a singleton
      const first = container.resolve(tokens.ResultInterpreter);
      const second = container.resolve(tokens.ResultInterpreter);

      expect(first).toBeDefined();
      expect(first).toBe(second); // Singleton behavior
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Command and Action Registration: Registered ResultInterpreter.'
      );
    });
  });

  describe('Complex Service Registrations', () => {
    test('should register all singletonFactory services with proper dependencies', () => {
      // Act
      registerCommandAndAction(container);

      // Assert - All factory-based services should be resolvable
      const services = [
        tokens.IScopeRegistry,
        tokens.IScopeCacheStrategy,
        tokens.IUnifiedScopeResolver,
        tokens.ITargetContextBuilder,
        tokens.IMultiTargetResolutionStage,
        tokens.ITargetResolutionService,
        tokens.TraceContextFactory,
        tokens.IFixSuggestionEngine,
        tokens.IActionErrorContextBuilder,
        tokens.ActionCandidateProcessor,
        tokens.ActionPipelineOrchestrator,
        tokens.IActionDiscoveryService,
        tokens.ICommandProcessor,
        tokens.UnifiedErrorHandler,
        tokens.DirectiveStrategyResolver,
        tokens.CommandDispatcher,
        tokens.DirectiveExecutor,
        tokens.ResultInterpreter,
      ];

      services.forEach((token) => {
        expect(() => container.resolve(token)).not.toThrow();
        const instance = container.resolve(token);
        expect(instance).toBeDefined();
      });
    });

    test('should maintain proper service dependencies and initialization order', () => {
      // Act
      registerCommandAndAction(container);

      // Assert - Complex service dependencies should work
      const actionDiscovery = container.resolve(tokens.IActionDiscoveryService);
      const commandProcessor = container.resolve(tokens.ICommandProcessor);
      const pipelineOrchestrator = container.resolve(
        tokens.ActionPipelineOrchestrator
      );

      expect(actionDiscovery).toBeInstanceOf(ActionDiscoveryService);
      expect(commandProcessor).toBeInstanceOf(CommandProcessor);
      expect(pipelineOrchestrator).toBeDefined();

      // Verify logging shows complete registration
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Command and Action Registration: Starting...'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Command and Action Registration: Completed.'
      );
    });
  });

  describe('Command Processor optional dependencies', () => {
    test('should handle optional tracing dependencies throwing errors', () => {
      // Arrange - Register optional tracing dependencies that throw when resolved
      const throwingActionTraceFilter = jest.fn(() => {
        throw new Error('Command trace filter resolution failed');
      });
      const throwingActionExecutionTraceFactory = jest.fn(() => {
        throw new Error('Command execution trace factory resolution failed');
      });
      const throwingActionTraceOutputService = jest.fn(() => {
        throw new Error('Command trace output service resolution failed');
      });

      container.register(
        actionTracingTokens.IActionTraceFilter,
        throwingActionTraceFilter
      );
      container.register(
        actionTracingTokens.IActionExecutionTraceFactory,
        throwingActionExecutionTraceFactory
      );
      container.register(
        actionTracingTokens.IActionTraceOutputService,
        throwingActionTraceOutputService
      );

      // Act
      registerCommandAndAction(container);

      // Assert - CommandProcessor should resolve successfully and log tracing as disabled
      const commandProcessor = container.resolve(tokens.ICommandProcessor);
      expect(commandProcessor).toBeInstanceOf(CommandProcessor);

      expect(throwingActionTraceFilter).toHaveBeenCalled();
      expect(throwingActionExecutionTraceFactory).toHaveBeenCalled();
      expect(throwingActionTraceOutputService).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CommandProcessor: Action execution tracing disabled'
      );
    });
  });
});
