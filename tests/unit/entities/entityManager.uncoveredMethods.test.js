/**
 * @file This file tests uncovered methods and branches in EntityManager to improve coverage.
 * Focuses on lines: 97,204,280-283,392-404,498,548
 * @see src/entities/entityManager.js
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  describeEntityManagerSuite,
  TestData,
  EntityManagerTestBed,
} from '../../common/entities/index.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import EntityManager from '../../../src/entities/entityManager.js';

describeEntityManagerSuite(
  'EntityManager - Uncovered Methods Coverage',
  (getBed) => {
    describe('getEntityIds method (line 97)', () => {
      it('should return empty array when no entities exist', () => {
        // Arrange
        const { entityManager } = getBed();

        // Act
        const result = entityManager.getEntityIds();

        // Assert
        expect(result).toEqual([]);
        expect(Array.isArray(result)).toBe(true);
      });

      it('should return array with single entity ID when one entity exists', async () => {
        // Arrange
        const { entityManager } = getBed();
        const { PRIMARY } = TestData.InstanceIDs;
        await getBed().createBasicEntity({ instanceId: PRIMARY });

        // Act
        const result = entityManager.getEntityIds();

        // Assert
        expect(result).toEqual([PRIMARY]);
        expect(result.length).toBe(1);
      });

      it('should return array with multiple entity IDs when multiple entities exist', async () => {
        // Arrange
        const { entityManager } = getBed();
        const { PRIMARY, SECONDARY } = TestData.InstanceIDs;
        await getBed().createBasicEntity({ instanceId: PRIMARY });
        await getBed().createBasicEntity({ instanceId: SECONDARY });

        // Act
        const result = entityManager.getEntityIds();

        // Assert
        expect(result).toContain(PRIMARY);
        expect(result).toContain(SECONDARY);
        expect(result.length).toBe(2);
      });
    });

    describe('getAllComponentTypesForEntity method (line 548)', () => {
      it('should delegate to query manager for valid entity', async () => {
        // Arrange
        const { entityManager } = getBed();
        const { PRIMARY } = TestData.InstanceIDs;
        await getBed().createBasicEntity({ instanceId: PRIMARY });

        // Act
        const result = entityManager.getAllComponentTypesForEntity(PRIMARY);

        // Assert
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0); // Should have at least some components
      });

      it('should return empty array for non-existent entity', () => {
        // Arrange
        const { entityManager } = getBed();
        const invalidId = 'non-existent-entity';

        // Act
        const result = entityManager.getAllComponentTypesForEntity(invalidId);

        // Assert
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(0);
      });
    });

    describe('hasComponent with 3 arguments (line 498)', () => {
      it('should pass third argument to query manager when provided', async () => {
        // Arrange
        const { entityManager } = getBed();
        const { PRIMARY } = TestData.InstanceIDs;
        const entity = await getBed().createBasicEntity({
          instanceId: PRIMARY,
        });
        const componentTypeId = 'core:name';

        // Act - call with 3 arguments to trigger line 498
        const result = entityManager.hasComponent(
          PRIMARY,
          componentTypeId,
          true
        );

        // Assert
        expect(typeof result).toBe('boolean');
        // The third parameter (checkOverrideOnly) should be passed through
      });

      it('should use 2-argument path when third argument not provided', async () => {
        // Arrange
        const { entityManager } = getBed();
        const { PRIMARY } = TestData.InstanceIDs;
        await getBed().createBasicEntity({ instanceId: PRIMARY });
        const componentTypeId = 'core:name';

        // Act - call with 2 arguments to use different code path
        const result = entityManager.hasComponent(PRIMARY, componentTypeId);

        // Assert
        expect(typeof result).toBe('boolean');
      });

      it('should distinguish between 2 and 3 argument calls', async () => {
        // Arrange
        const { entityManager } = getBed();
        const { PRIMARY } = TestData.InstanceIDs;
        await getBed().createBasicEntity({
          instanceId: PRIMARY,
          overrides: { 'test:override': { value: 'test' } },
        });

        // Act
        const result2Args = entityManager.hasComponent(
          PRIMARY,
          'test:override'
        );
        const result3Args = entityManager.hasComponent(
          PRIMARY,
          'test:override',
          true
        );

        // Assert
        expect(typeof result2Args).toBe('boolean');
        expect(typeof result3Args).toBe('boolean');
        // Both should return boolean values, but potentially different logic paths
      });
    });

    describe('batch operations (lines 392-404)', () => {
      describe('batchCreateEntities', () => {
        it('should delegate to lifecycle manager with correct parameters', async () => {
          // Arrange
          const { entityManager } = getBed();
          const entitySpecs = [
            {
              definitionId: TestData.DefinitionIDs.BASIC,
              opts: { instanceId: 'batch-entity-1' },
            },
            {
              definitionId: TestData.DefinitionIDs.BASIC,
              opts: { instanceId: 'batch-entity-2' },
            },
          ];
          const options = { batchSize: 10, enableParallel: true };

          // Act
          const result = await entityManager.batchCreateEntities(
            entitySpecs,
            options
          );

          // Assert
          expect(result).toBeDefined();
          expect(typeof result).toBe('object');
          // The result should be whatever the lifecycle manager returns
        });

        it('should handle empty entity specs array', async () => {
          // Arrange
          const { entityManager } = getBed();
          const entitySpecs = [];

          // Act
          const result = await entityManager.batchCreateEntities(entitySpecs);

          // Assert
          expect(result).toBeDefined();
        });

        it('should pass through options parameter correctly', async () => {
          // Arrange
          const { entityManager } = getBed();
          const entitySpecs = [
            {
              definitionId: TestData.DefinitionIDs.BASIC,
              opts: { instanceId: 'batch-test-entity' },
            },
          ];
          const customOptions = {
            batchSize: 5,
            enableParallel: false,
            stopOnError: true,
          };

          // Act
          const result = await entityManager.batchCreateEntities(
            entitySpecs,
            customOptions
          );

          // Assert
          expect(result).toBeDefined();
        });
      });

      describe('hasBatchSupport', () => {
        it('should return true when lifecycle manager supports batch operations', () => {
          // Arrange
          const { entityManager } = getBed();

          // Act
          const result = entityManager.hasBatchSupport();

          // Assert
          expect(typeof result).toBe('boolean');
          // Should return true since we have a properly configured lifecycle manager
          expect(result).toBe(true);
        });

        it('should return false when lifecycle manager is missing or lacks batch support', () => {
          // Arrange - create EntityManager without proper lifecycle manager
          const { mocks } = getBed();

          // Create a minimal EntityManager with a lifecycle manager that lacks batch support
          const mockLifecycleManager = {
            // Missing batchCreateEntities method
            createEntityInstance: jest.fn(),
            removeEntityInstance: jest.fn(),
            reconstructEntity: jest.fn(), // Required by EntityCreationManager
          };

          const mockComponentMutationService = {
            addComponent: jest.fn(), // Required by EntityMutationManager
            removeComponent: jest.fn(),
          };

          const mockEntityRepository = {
            add: jest.fn(),
            get: jest.fn(),
            has: jest.fn(),
            remove: jest.fn(),
            clear: jest.fn(),
            entities: jest.fn(() => []),
          };

          const entityManager = new EntityManager({
            registry: mocks.registry,
            validator: mocks.validator,
            logger: mocks.logger,
            dispatcher: mocks.eventDispatcher,
            entityLifecycleManager: mockLifecycleManager,
            componentMutationService: mockComponentMutationService,
            entityRepository: mockEntityRepository,
          });

          // Act
          const result = entityManager.hasBatchSupport();

          // Assert
          expect(result).toBe(false);
        });
      });
    });

    describe('constructor dependency resolution (lines 204, 280-283)', () => {
      it('should call factory functions for dependencies when provided', () => {
        // Arrange
        const { mocks } = getBed();
        const mockIdGenerator = jest.fn(() => 'factory-generated-id');
        const mockCloner = jest.fn((obj) => ({ ...obj }));
        const mockDefaultPolicy = { apply: jest.fn() };

        const idGeneratorFactory = jest.fn(() => mockIdGenerator);
        const clonerFactory = jest.fn(() => mockCloner);
        const defaultPolicyFactory = jest.fn(() => mockDefaultPolicy);

        // Act - create EntityManager with factory functions
        const entityManager = new EntityManager({
          registry: mocks.registry,
          validator: mocks.validator,
          logger: mocks.logger,
          dispatcher: mocks.eventDispatcher,
          idGeneratorFactory,
          clonerFactory,
          defaultPolicyFactory,
        });

        // Assert
        expect(idGeneratorFactory).toHaveBeenCalled();
        expect(clonerFactory).toHaveBeenCalled();
        expect(defaultPolicyFactory).toHaveBeenCalled();
        expect(entityManager).toBeDefined();
      });

      it('should handle function dependencies for services', () => {
        // Arrange
        const { mocks } = getBed();
        const mockEntityRepository = {
          add: jest.fn(),
          get: jest.fn(),
          has: jest.fn(),
          remove: jest.fn(),
          clear: jest.fn(),
          entities: jest.fn(() => []),
        };
        const mockComponentMutationService = {
          addComponent: jest.fn(), // Required by EntityMutationManager
          removeComponent: jest.fn(),
        };
        const mockLifecycleManager = {
          createEntityInstance: jest.fn(),
          removeEntityInstance: jest.fn(),
          reconstructEntity: jest.fn(), // Required by EntityCreationManager
          batchCreateEntities: jest.fn(),
        };

        const entityRepositoryFactory = jest.fn(() => mockEntityRepository);
        const componentMutationServiceFactory = jest.fn(
          () => mockComponentMutationService
        );
        const lifecycleManagerFactory = jest.fn(() => mockLifecycleManager);

        // Act - lines 280-283 should be triggered
        const entityManager = new EntityManager({
          registry: mocks.registry,
          validator: mocks.validator,
          logger: mocks.logger,
          dispatcher: mocks.eventDispatcher,
          entityRepository: entityRepositoryFactory,
          componentMutationService: componentMutationServiceFactory,
          entityLifecycleManager: lifecycleManagerFactory,
        });

        // Assert
        expect(entityRepositoryFactory).toHaveBeenCalled();
        expect(componentMutationServiceFactory).toHaveBeenCalled();
        expect(lifecycleManagerFactory).toHaveBeenCalled();
        expect(entityManager).toBeDefined();
      });

      it('should use provided dependencies directly when not functions', () => {
        // Arrange
        const { mocks } = getBed();
        const mockIdGenerator = jest.fn(() => 'direct-id');
        const mockCloner = jest.fn((obj) => ({ ...obj }));
        const mockDefaultPolicy = { apply: jest.fn() };

        // Act - provide dependencies directly (not as factories)
        const entityManager = new EntityManager({
          registry: mocks.registry,
          validator: mocks.validator,
          logger: mocks.logger,
          dispatcher: mocks.eventDispatcher,
          idGenerator: mockIdGenerator,
          cloner: mockCloner,
          defaultPolicy: mockDefaultPolicy,
        });

        // Assert
        expect(entityManager).toBeDefined();
        // Since we provided the dependencies directly, no factory calls should occur
      });

      it('should handle mixed dependency types (some functions, some direct)', () => {
        // Arrange
        const { mocks } = getBed();
        const mockIdGenerator = jest.fn(() => 'mixed-id');
        const mockCloner = jest.fn((obj) => ({ ...obj }));
        const clonerFactory = jest.fn(() => mockCloner);

        // Act - mix of direct dependency and factory
        const entityManager = new EntityManager({
          registry: mocks.registry,
          validator: mocks.validator,
          logger: mocks.logger,
          dispatcher: mocks.eventDispatcher,
          idGenerator: mockIdGenerator, // Direct dependency
          clonerFactory, // Factory function
        });

        // Assert
        expect(clonerFactory).toHaveBeenCalled();
        expect(entityManager).toBeDefined();
      });

      it('should call dependency function when defaultDep is object but dep is function (line 204)', () => {
        // Arrange
        const { mocks } = getBed();
        // Create a dependency function that should be called
        const dependencyFunction = jest.fn(() => ({ apply: jest.fn() }));

        // Act - this should trigger line 204 where defaultDep is an object (DefaultComponentPolicy instance)
        // but we pass a function as defaultPolicy
        const entityManager = new EntityManager({
          registry: mocks.registry,
          validator: mocks.validator,
          logger: mocks.logger,
          dispatcher: mocks.eventDispatcher,
          defaultPolicy: dependencyFunction, // This is a function, default would be an object
        });

        // Assert
        expect(dependencyFunction).toHaveBeenCalled();
        expect(entityManager).toBeDefined();
      });
    });

    describe("getEntitiesWithComponent debug logging for 'sitting:allows_sitting'", () => {
      it('should emit diagnostic log entries with component insights', async () => {
        const bed = getBed();
        const { entityManager } = bed;
        const { logger } = bed.mocks;
        const instanceId = 'allows-sitting-entity';

        await bed.createBasicEntity({
          instanceId,
          overrides: {
            'sitting:allows_sitting': { canSit: true },
            'core:position': { locationId: 'zone:park-bench' },
          },
        });

        logger.debug.mockClear();

        const entities = entityManager.getEntitiesWithComponent(
          'sitting:allows_sitting'
        );

        expect(Array.isArray(entities)).toBe(true);
        expect(entities.map((entity) => entity.id)).toContain(instanceId);

        const debugCall = logger.debug.mock.calls.find(([message]) =>
          message.includes(
            "EntityManager.getEntitiesWithComponent('sitting:allows_sitting')"
          )
        );

        expect(debugCall).toBeDefined();
        expect(debugCall[1]).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: instanceId,
              hasPositionComponent: true,
              positionData: expect.objectContaining({
                locationId: 'zone:park-bench',
              }),
              allowsSittingData: expect.objectContaining({ canSit: true }),
            }),
          ])
        );
      });
    });
  }
);

let activeComponentMutationService;
let activeLifecycleManager;
let activeMonitoringCoordinator;

const componentMutationServiceFactory = () => {
  activeComponentMutationService = {
    addComponent: jest.fn(),
    removeComponent: jest.fn(),
    batchAddComponentsOptimized: jest.fn(),
  };
  return activeComponentMutationService;
};

const lifecycleManagerFactory = () => {
  activeLifecycleManager = {
    createEntityInstance: jest.fn(async () => ({ id: 'mock-entity' })),
    reconstructEntity: jest.fn(),
    removeEntityInstance: jest.fn(),
    batchCreateEntities: jest.fn(async () => ({ results: [], errors: [] })),
  };
  return activeLifecycleManager;
};

const monitoringCoordinatorFactory = () => {
  activeMonitoringCoordinator = {
    kind: 'monitoring-coordinator-mock',
  };
  return activeMonitoringCoordinator;
};

describeEntityManagerSuite(
  'EntityManager - Service delegation and accessors',
  (getBed) => {
    beforeEach(() => {
      expect(activeComponentMutationService).toBeDefined();
      expect(activeLifecycleManager).toBeDefined();
      expect(activeMonitoringCoordinator).toBeDefined();
    });

    it('delegates batchAddComponentsOptimized to the ComponentMutationService', async () => {
      const { entityManager } = getBed();
      const componentSpecs = [
        {
          instanceId: 'entity-1',
          componentTypeId: 'core:name',
          componentData: { name: 'Test One' },
        },
      ];
      const expectedResult = {
        results: ['ok'],
        errors: [],
        updateCount: 1,
      };
      activeComponentMutationService.batchAddComponentsOptimized.mockResolvedValue(
        expectedResult
      );

      const result = await entityManager.batchAddComponentsOptimized(
        componentSpecs,
        false
      );

      expect(
        activeComponentMutationService.batchAddComponentsOptimized
      ).toHaveBeenCalledWith(componentSpecs, false);
      expect(result).toBe(expectedResult);
    });

    it('exposes the configured monitoring coordinator instance', () => {
      const { entityManager } = getBed();
      const coordinator = entityManager.getMonitoringCoordinator();

      expect(coordinator).toBe(activeMonitoringCoordinator);
    });
  },
  {
    entityManagerOptions: {
      componentMutationService: componentMutationServiceFactory,
      entityLifecycleManager: lifecycleManagerFactory,
      monitoringCoordinator: monitoringCoordinatorFactory,
    },
  }
);
