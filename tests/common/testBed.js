/**
 * @file General purpose test bed for integration tests
 */

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

    cleanup() {
      jest.clearAllMocks();
    },
  };
}
