/**
 * @file General purpose test bed for integration tests
 */

/**
 *
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

    cleanup() {
      jest.clearAllMocks();
    },
  };
}
