/**
 * @file General purpose test bed for integration tests
 */

import { jest } from '@jest/globals';
import { createMockElement } from './testHelpers/thematicDirectionDOMSetup.js';

// Action tracing classes imported dynamically to avoid circular dependencies

/**
 * Creates a test bed with common mock objects and utilities
 */
export function createTestBed() {
  const mockObjects = {
    mockWorldContext: {},
    mockRepository: {
      getWorld: jest.fn(),
      getEntityInstanceDefinition: jest.fn(),
      get: jest.fn(),
    },
    mockValidatedEventDispatcher: {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
    },
    mockEventDispatchService: {
      dispatchWithLogging: jest.fn(),
    },
    mockLogger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    mockScopeRegistry: {
      initialize: jest.fn(),
    },
  };

  return {
    ...mockObjects,

    // Convenience aliases for common mock objects
    logger: mockObjects.mockLogger,
    eventDispatcher: mockObjects.mockValidatedEventDispatcher,
    entityManager: {
      getEntityInstance: jest.fn(),
    },

    createMockEntityManager(options = {}) {
      const { hasBatchSupport = true, enableBatchOperations = true } = options;

      return {
        hasBatchSupport: jest.fn().mockReturnValue(hasBatchSupport),
        batchCreateEntities: jest.fn(),
        createEntityInstance: jest.fn(),
      };
    },

    async createActionAwareTrace(options = {}) {
      const {
        tracedActions = [],
        verbosity = 'standard',
        includeComponentData = false,
        includePrerequisites = false,
        includeTargets = false,
        actorId = 'test-actor',
        enabled = true,
      } = options;

      // Dynamic import to avoid circular dependencies
      const { default: ActionAwareStructuredTrace } = await import(
        '../../src/actions/tracing/actionAwareStructuredTrace.js'
      );

      const mockFilter = this.createMockActionTraceFilter({
        tracedActions,
        verbosity,
        includeComponentData,
        includePrerequisites,
        includeTargets,
        enabled,
      });

      return new ActionAwareStructuredTrace({
        actionTraceFilter: mockFilter,
        actorId,
        context: { test: true },
        logger: mockObjects.mockLogger,
      });
    },

    createMockActionTraceFilter(config = {}) {
      const {
        tracedActions = [],
        verbosity = 'standard',
        includeComponentData = false,
        includePrerequisites = false,
        includeTargets = false,
        enabled = true,
      } = config;

      const tracedActionsSet = new Set(tracedActions);

      return {
        isEnabled: jest.fn().mockReturnValue(enabled),
        shouldTrace: jest.fn().mockImplementation((actionId) => {
          if (tracedActions.includes('*')) return true;
          if (tracedActionsSet.has(actionId)) return true;

          // Handle wildcards like 'core:*'
          return tracedActions.some((pattern) => {
            if (pattern.endsWith('*')) {
              const prefix = pattern.slice(0, -1);
              return actionId.startsWith(prefix);
            }
            return false;
          });
        }),
        getVerbosityLevel: jest.fn().mockReturnValue(verbosity),
        getInclusionConfig: jest.fn().mockReturnValue({
          componentData: includeComponentData,
          prerequisites: includePrerequisites,
          targets: includeTargets,
        }),
        setVerbosityLevel: jest.fn(),
        updateInclusionConfig: jest.fn(),
        addTracedActions: jest.fn(),
        removeTracedActions: jest.fn(),
        addExcludedActions: jest.fn(),
        getConfigurationSummary: jest.fn().mockReturnValue({
          enabled,
          tracedActionCount: tracedActions.length,
          excludedActionCount: 0,
          verbosityLevel: verbosity,
          inclusionConfig: {
            componentData: includeComponentData,
            prerequisites: includePrerequisites,
            targets: includeTargets,
          },
          tracedActions,
          excludedActions: [],
        }),
      };
    },

    /**
     * Creates an EventDispatchService with event dispatch tracing enabled for testing
     *
     * @param {object} options - Configuration options
     * @param {string[]} options.tracedEvents - Events to trace (defaults to ['*'])
     * @param {boolean} options.tracingEnabled - Whether tracing is enabled (default: true)
     * @returns {Promise<{service: object, getWrittenTraces: Function, mockComponents: object}>}
     */
    async createEventDispatchServiceWithTracing(options = {}) {
      const { tracedEvents = ['*'], tracingEnabled = true } = options;

      // Dynamic import to avoid circular dependencies
      const { EventDispatchService } = await import(
        '../../src/utils/eventDispatchService.js'
      );
      const { EventDispatchTracer } = await import(
        '../../src/events/tracing/eventDispatchTracer.js'
      );

      const writtenTraces = [];

      // Create mock components
      const mockSafeEventDispatcher = {
        dispatch: jest.fn(),
      };

      const mockActionTraceFilter = this.createMockActionTraceFilter({
        tracedActions: tracedEvents,
        enabled: tracingEnabled,
      });

      const mockOutputService = {
        writeTrace: jest.fn().mockImplementation((trace) => {
          writtenTraces.push(trace.toJSON());
          return Promise.resolve();
        }),
      };

      const mockEventDispatchTracer = new EventDispatchTracer({
        logger: mockObjects.mockLogger,
        outputService: mockOutputService,
      });

      const service = new EventDispatchService({
        safeEventDispatcher: mockSafeEventDispatcher,
        logger: mockObjects.mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        eventDispatchTracer: mockEventDispatchTracer,
      });

      return {
        service,
        getWrittenTraces: () => [...writtenTraces],
        mockComponents: {
          mockSafeEventDispatcher,
          mockActionTraceFilter,
          mockOutputService,
          mockEventDispatchTracer,
        },
      };
    },

    /**
     * Creates mock event dispatch tracing components
     *
     * @param {object} options - Configuration options
     * @param {boolean} options.tracingEnabled - Whether tracing is enabled
     * @param {string[]} options.tracedEvents - Events to trace
     * @returns {object} Mock components for event dispatch tracing
     */
    createMockEventDispatchTracingComponents(options = {}) {
      const { tracingEnabled = true, tracedEvents = ['*'] } = options;

      const writtenTraces = [];

      const mockOutputService = {
        writeTrace: jest.fn().mockImplementation((trace) => {
          writtenTraces.push(trace.toJSON());
          return Promise.resolve();
        }),
      };

      const mockEventDispatchTracer = {
        createTrace: jest.fn().mockImplementation((context) => {
          const mockTrace = {
            captureDispatchStart: jest.fn(),
            captureDispatchSuccess: jest.fn(),
            captureDispatchError: jest.fn(),
            toJSON: jest.fn().mockReturnValue({
              metadata: {
                traceType: 'event_dispatch',
                eventName: context.eventName,
                context: context.context,
                timestamp: context.timestamp,
                createdAt: new Date().toISOString(),
                version: '1.0',
              },
              dispatch: {
                startTime: null,
                endTime: null,
                duration: null,
                success: null,
                error: null,
              },
              payload: context.payload,
            }),
          };
          return mockTrace;
        }),
        writeTrace: jest.fn().mockImplementation((trace) => {
          writtenTraces.push(trace.toJSON());
          return Promise.resolve();
        }),
      };

      const mockActionTraceFilter = this.createMockActionTraceFilter({
        tracedActions: tracedEvents,
        enabled: tracingEnabled,
      });

      return {
        mockOutputService,
        mockEventDispatchTracer,
        mockActionTraceFilter,
        getWrittenTraces: () => [...writtenTraces],
        clearTraces: () => {
          writtenTraces.length = 0;
        },
      };
    },

    createMockDualFormatConfig() {
      return {
        outputFormats: ['json', 'text'],
        textFormatOptions: {
          enableColors: false,
          lineWidth: 120,
          indentSize: 2,
          sectionSeparator: '=',
          includeTimestamps: true,
          performanceSummary: true,
        },
      };
    },

    createFormattedTraceArray() {
      return [
        { content: '{"test": "json"}', fileName: 'test.json' },
        { content: '=== Test Trace ===', fileName: 'test.txt' },
      ];
    },

    createMock(name, methods) {
      if (methods.length === 0) {
        // If no methods specified, return a jest function
        return jest.fn();
      }
      const mock = {};
      methods.forEach((method) => {
        mock[method] = jest.fn();
      });
      return mock;
    },

    createMockLogger() {
      return {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };
    },

    createMockValidator() {
      return {
        validate: jest.fn(),
        validateSchema: jest.fn(),
        addSchema: jest.fn(),
        removeSchema: jest.fn(),
        isSchemaLoaded: jest.fn().mockReturnValue(false),
      };
    },

    createMockTrace(overrides = {}) {
      return {
        id: 'test-trace-123',
        actionId: 'test_action',
        actorId: 'test_actor',
        timestamp: new Date().toISOString(),
        data: { test: 'data' },
        toJSON: jest.fn().mockReturnValue({
          id: 'test-trace-123',
          actionId: 'test_action',
          actorId: 'test_actor',
          timestamp: new Date().toISOString(),
          data: { test: 'data' },
        }),
        ...overrides,
      };
    },

    createMockElement,

    cleanup() {
      jest.clearAllMocks();
    },
  };
}
