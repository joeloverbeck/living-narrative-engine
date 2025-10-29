import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import EntityLifecycleManager from '../../../../src/entities/services/entityLifecycleManager.js';
import BatchOperationManager from '../../../../src/entities/operations/BatchOperationManager.js';

// Mock the helper classes to avoid complex setup
jest.mock(
  '../../../../src/entities/services/helpers/EntityLifecycleValidator.js',
  () => {
    const { jest: jestMock } = require('@jest/globals');
    const mock = {
      validateCreateEntityParams: jestMock.fn(),
      validateCreationOptions: jestMock.fn(),
      validateReconstructEntityParams: jestMock.fn(),
      validateSerializedEntityStructure: jestMock.fn(),
      validateRemoveEntityInstanceParams: jestMock.fn(),
    };
    global.__validatorMock = mock;
    return { __esModule: true, default: jestMock.fn(() => mock) };
  }
);

jest.mock(
  '../../../../src/entities/services/helpers/EntityEventDispatcher.js',
  () => {
    const { jest: jestMock } = require('@jest/globals');
    const mock = {
      dispatchEntityCreated: jestMock.fn(),
      dispatchEntityRemoved: jestMock.fn(),
      getStats: jestMock.fn(() => ({ dispatched: 0 })),
    };
    global.__eventDispatcherMock = mock;
    return { __esModule: true, default: jestMock.fn(() => mock) };
  }
);

jest.mock(
  '../../../../src/entities/services/helpers/EntityDefinitionHelper.js',
  () => {
    const { jest: jestMock } = require('@jest/globals');
    const mock = {
      getDefinitionForCreate: jestMock.fn((id) => ({ id })),
      getDefinitionForReconstruct: jestMock.fn((id) => ({ id })),
      preloadDefinitions: jestMock.fn((ids) => ({
        loaded: ids,
        failed: [],
        alreadyCached: [],
      })),
      getCacheStats: jestMock.fn(() => ({ hits: 0 })),
      clearCache: jestMock.fn(),
    };
    global.__definitionHelperMock = mock;
    return { __esModule: true, default: jestMock.fn(() => mock) };
  }
);

// Mock the BatchOperationManager
jest.mock('../../../../src/entities/operations/BatchOperationManager.js');

describe('EntityLifecycleManager - Batch Operations', () => {
  let manager;
  let deps;
  let mockBatchOperationManager;

  beforeEach(() => {
    deps = createDependencies();
    mockBatchOperationManager = createMockBatchOperationManager();
    BatchOperationManager.mockImplementation(() => mockBatchOperationManager);
  });

  /**
   *
   */
  function createDependencies() {
    return {
      registry: { getEntityDefinition: jest.fn() },
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      },
      entityRepository: {
        add: jest.fn(),
        get: jest.fn(),
        has: jest.fn(),
        remove: jest.fn(() => true),
        clear: jest.fn(),
        entities: jest.fn(() => []),
        size: 0,
      },
      factory: {
        create: jest.fn((id, opts) => ({
          id,
          instanceId: opts?.instanceId || `${id}-instance`,
        })),
        reconstruct: jest.fn(),
      },
      errorTranslator: { translate: jest.fn((e) => e) },
      eventDispatcher: { dispatch: jest.fn(), getStats: jest.fn() },
      definitionCache: { get: jest.fn(), clear: jest.fn() },
    };
  }

  /**
   *
   */
  function createMockBatchOperationManager() {
    return {
      batchCreateEntities: jest.fn(),
      batchAddComponents: jest.fn(),
      batchRemoveEntities: jest.fn(),
      getStats: jest.fn(() => ({ defaultBatchSize: 50 })),
    };
  }

  describe('Batch Operations Enabled', () => {
    beforeEach(() => {
      manager = new EntityLifecycleManager({
        ...deps,
        batchOperationManager: mockBatchOperationManager,
        enableBatchOperations: true,
      });
    });

    describe('batchCreateEntities', () => {
      it('should delegate to BatchOperationManager when enabled', async () => {
        const entitySpecs = [
          { definitionId: 'test:entity1', opts: { instanceId: 'e1' } },
          { definitionId: 'test:entity2', opts: { instanceId: 'e2' } },
        ];

        const expectedResult = {
          successes: [{ id: 'e1' }, { id: 'e2' }],
          failures: [],
          totalProcessed: 2,
          successCount: 2,
          failureCount: 0,
          processingTime: 100,
        };

        mockBatchOperationManager.batchCreateEntities.mockResolvedValue(
          expectedResult
        );

        const result = await manager.batchCreateEntities(entitySpecs);

        expect(
          mockBatchOperationManager.batchCreateEntities
        ).toHaveBeenCalledWith(entitySpecs, {});
        expect(result).toEqual(expectedResult);
        expect(deps.logger.info).toHaveBeenCalledWith(
          'Executing batch entity creation',
          expect.objectContaining({
            entityCount: 2,
            batchSize: 50,
          })
        );
      });

      it('should pass options to BatchOperationManager', async () => {
        const entitySpecs = [{ definitionId: 'test:entity1' }];
        const options = {
          batchSize: 10,
          enableParallel: true,
          stopOnError: true,
        };

        mockBatchOperationManager.batchCreateEntities.mockResolvedValue({
          successes: [],
          failures: [],
          totalProcessed: 0,
          successCount: 0,
          failureCount: 0,
          processingTime: 0,
        });

        await manager.batchCreateEntities(entitySpecs, options);

        expect(
          mockBatchOperationManager.batchCreateEntities
        ).toHaveBeenCalledWith(entitySpecs, options);
      });
    });

    describe('batchAddComponents', () => {
      it('should delegate to BatchOperationManager when enabled', async () => {
        const componentSpecs = [
          {
            instanceId: 'e1',
            componentTypeId: 'core:health',
            componentData: { maxHealth: 100 },
          },
        ];

        const expectedResult = {
          successes: [{ instanceId: 'e1', componentTypeId: 'core:health' }],
          failures: [],
          totalProcessed: 1,
          successCount: 1,
          failureCount: 0,
          processingTime: 50,
        };

        mockBatchOperationManager.batchAddComponents.mockResolvedValue(
          expectedResult
        );

        const result = await manager.batchAddComponents(componentSpecs);

        expect(
          mockBatchOperationManager.batchAddComponents
        ).toHaveBeenCalledWith(componentSpecs, {});
        expect(result).toEqual(expectedResult);
      });
    });

    describe('batchRemoveEntities', () => {
      it('should delegate to BatchOperationManager when enabled', async () => {
        const instanceIds = ['e1', 'e2', 'e3'];

        const expectedResult = {
          successes: instanceIds,
          failures: [],
          totalProcessed: 3,
          successCount: 3,
          failureCount: 0,
          processingTime: 75,
        };

        mockBatchOperationManager.batchRemoveEntities.mockResolvedValue(
          expectedResult
        );

        const result = await manager.batchRemoveEntities(instanceIds);

        expect(
          mockBatchOperationManager.batchRemoveEntities
        ).toHaveBeenCalledWith(instanceIds, {});
        expect(result).toEqual(expectedResult);
      });
    });
  });

  describe('Batch Operations Disabled (Fallback)', () => {
    beforeEach(() => {
      manager = new EntityLifecycleManager({
        ...deps,
        batchOperationManager: null,
        enableBatchOperations: false,
      });
    });

    describe('batchCreateEntities fallback', () => {
      it('should fall back to sequential creation when batch disabled', async () => {
        const entitySpecs = [
          { definitionId: 'test:entity1', opts: { instanceId: 'e1' } },
          { definitionId: 'test:entity2', opts: { instanceId: 'e2' } },
        ];

        const result = await manager.batchCreateEntities(entitySpecs);

        expect(
          mockBatchOperationManager.batchCreateEntities
        ).not.toHaveBeenCalled();
        expect(deps.factory.create).toHaveBeenCalledTimes(2);
        expect(result.successCount).toBe(2);
        expect(result.failureCount).toBe(0);
        expect(result.successes).toHaveLength(2);
        expect(result.processingTime).toBeGreaterThan(0);
      });

      it('should handle errors in fallback mode', async () => {
        const entitySpecs = [
          { definitionId: 'test:entity1', opts: { instanceId: 'e1' } },
          { definitionId: 'test:entity2', opts: { instanceId: 'e2' } },
        ];

        deps.factory.create
          .mockImplementationOnce(() => ({ id: 'e1' }))
          .mockImplementationOnce(() => {
            throw new Error('Creation failed');
          });

        const result = await manager.batchCreateEntities(entitySpecs);

        expect(result.successCount).toBe(1);
        expect(result.failureCount).toBe(1);
        expect(result.failures).toHaveLength(1);
        expect(result.failures[0].error.message).toBe('Creation failed');
      });

      it('should stop on error when option is set', async () => {
        const entitySpecs = [
          { definitionId: 'test:entity1', opts: { instanceId: 'e1' } },
          { definitionId: 'test:entity2', opts: { instanceId: 'e2' } },
          { definitionId: 'test:entity3', opts: { instanceId: 'e3' } },
        ];

        deps.factory.create
          .mockImplementationOnce(() => ({ id: 'e1' }))
          .mockImplementationOnce(() => {
            throw new Error('Creation failed');
          });

        const result = await manager.batchCreateEntities(entitySpecs, {
          stopOnError: true,
        });

        expect(deps.factory.create).toHaveBeenCalledTimes(2); // Should stop after error
        expect(result.totalProcessed).toBe(2);
        expect(result.successCount).toBe(1);
        expect(result.failureCount).toBe(1);
      });
    });

    describe('batchAddComponents fallback', () => {
      it('should return error for component operations in fallback mode', async () => {
        const componentSpecs = [
          {
            instanceId: 'e1',
            componentTypeId: 'core:health',
            componentData: { maxHealth: 100 },
          },
        ];

        const result = await manager.batchAddComponents(componentSpecs);

        expect(result.failureCount).toBe(1);
        expect(result.failures[0].error.message).toContain(
          'Component operations not available in EntityLifecycleManager'
        );
        expect(deps.logger.warn).toHaveBeenCalled();
      });
    });

    describe('batchRemoveEntities fallback', () => {
      it('should fall back to sequential removal when batch disabled', async () => {
        const instanceIds = ['e1', 'e2', 'e3'];

        deps.entityRepository.get.mockImplementation((id) => ({ id }));

        const result = await manager.batchRemoveEntities(instanceIds);

        expect(deps.entityRepository.remove).toHaveBeenCalledTimes(3);
        expect(result.successCount).toBe(3);
        expect(result.failureCount).toBe(0);
        expect(result.successes).toEqual(instanceIds);
      });

      it('should handle removal errors in fallback mode', async () => {
        const instanceIds = ['e1', 'e2', 'e3'];

        deps.entityRepository.get
          .mockImplementationOnce((id) => ({ id }))
          .mockImplementationOnce(() => null) // Entity not found
          .mockImplementationOnce((id) => ({ id }));

        const result = await manager.batchRemoveEntities(instanceIds);

        expect(result.successCount).toBe(2);
        expect(result.failureCount).toBe(1);
        expect(result.failures).toHaveLength(1);
      });

      it('should stop processing further removals when stopOnError is enabled', async () => {
        const instanceIds = ['e1', 'e2'];
        const removeSpy = jest
          .spyOn(manager, 'removeEntityInstance')
          .mockRejectedValueOnce(new Error('boom'))
          .mockResolvedValueOnce(undefined);

        const result = await manager.batchRemoveEntities(instanceIds, {
          stopOnError: true,
        });

        expect(removeSpy).toHaveBeenCalledTimes(1);
        expect(result.totalProcessed).toBe(1);
        expect(result.failureCount).toBe(1);
        expect(result.successCount).toBe(0);
        expect(result.failures).toHaveLength(1);

        removeSpy.mockRestore();
      });
    });
  });

  describe('Constructor Validation', () => {
    it('should allow batch operations enabled without BatchOperationManager (for circular dependency resolution)', () => {
      expect(() => {
        new EntityLifecycleManager({
          ...deps,
          batchOperationManager: null,
          enableBatchOperations: true,
        });
      }).not.toThrow();
    });

    it('should validate BatchOperationManager if provided', () => {
      const invalidBatchManager = {
        // Missing required methods
        batchCreateEntities: jest.fn(),
      };

      expect(() => {
        new EntityLifecycleManager({
          ...deps,
          batchOperationManager: invalidBatchManager,
          enableBatchOperations: true,
        });
      }).toThrow();
    });

    it('should validate BatchOperationManager when set via setBatchOperationManager', () => {
      const manager = new EntityLifecycleManager({
        ...deps,
        batchOperationManager: null,
        enableBatchOperations: true,
      });

      const invalidBatchManager = {
        // Missing required methods
        batchCreateEntities: jest.fn(),
      };

      expect(() => {
        manager.setBatchOperationManager(invalidBatchManager);
      }).toThrow();
    });

    it('should warn when setting batch manager while batch operations are disabled', () => {
      const localDeps = createDependencies();
      const disabledManager = new EntityLifecycleManager({
        ...localDeps,
        batchOperationManager: null,
        enableBatchOperations: false,
      });

      const validBatchManager = {
        batchCreateEntities: jest.fn(),
        batchAddComponents: jest.fn(),
        batchRemoveEntities: jest.fn(),
      };

      disabledManager.setBatchOperationManager(validBatchManager);

      expect(localDeps.logger.warn).toHaveBeenCalledWith(
        'Setting batch operation manager but batch operations are disabled'
      );
      expect(localDeps.logger.debug).not.toHaveBeenCalledWith(
        'Batch operation manager set'
      );
    });

    it('should set the batch manager and delegate operations when enabled', async () => {
      const localDeps = createDependencies();
      const enabledManager = new EntityLifecycleManager({
        ...localDeps,
        batchOperationManager: null,
        enableBatchOperations: true,
      });

      const validBatchManager = {
        batchCreateEntities: jest.fn().mockResolvedValue({ successes: [] }),
        batchAddComponents: jest.fn().mockResolvedValue({ successes: [] }),
        batchRemoveEntities: jest.fn().mockResolvedValue({
          successes: ['e1'],
          failures: [],
          totalProcessed: 1,
          successCount: 1,
          failureCount: 0,
          processingTime: 1,
        }),
      };

      enabledManager.setBatchOperationManager(validBatchManager);

      expect(localDeps.logger.debug).toHaveBeenCalledWith(
        'Batch operation manager set'
      );

      const result = await enabledManager.batchRemoveEntities(['e1']);

      expect(validBatchManager.batchRemoveEntities).toHaveBeenCalledWith(
        ['e1'],
        {}
      );
      expect(result.successCount).toBe(1);
    });
  });
});
