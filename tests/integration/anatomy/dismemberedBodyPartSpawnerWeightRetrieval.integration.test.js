/**
 * @file Integration test for DismemberedBodyPartSpawner weight retrieval
 * Verifies that the spawner correctly retrieves weight from entity definitions
 * via the core:weight component, not from the anatomy:part component.
 *
 * @see src/anatomy/services/dismemberedBodyPartSpawner.js
 * @see data/mods/anatomy/entities/definitions/human_breast_c_cup_soft.entity.json
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import DismemberedBodyPartSpawner from '../../../src/anatomy/services/dismemberedBodyPartSpawner.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';

describe('DismemberedBodyPartSpawner - Weight Retrieval from Entity Definition', () => {
  let spawner;
  let mockLogger;
  let mockEntityManager;
  let mockEventBus;
  let mockEntityLifecycleManager;
  let mockGameDataRepository;
  let mockUnsubscribe;
  let handleDismemberment;

  // Test constants matching real entity definition structure
  const TEST_DEFINITION_ID = 'anatomy:human_breast_c_cup_soft';
  const TEST_ENTITY_ID = 'character-123';
  const TEST_PART_ID = 'part-breast-456';
  const TEST_LOCATION_ID = 'location-tavern';
  const EXPECTED_WEIGHT = 0.5; // From actual entity definition

  // Mock entity definition matching real data structure
  const mockEntityDefinition = {
    id: TEST_DEFINITION_ID,
    description: 'A C-cup, soft breast',
    components: {
      'anatomy:part': {
        subType: 'breast',
        hit_probability_weight: 3,
        health_calculation_weight: 0.3,
      },
      'anatomy:part_health': {
        currentHealth: 20,
        maxHealth: 20,
        state: 'healthy',
      },
      'core:name': {
        text: 'breast',
      },
      'core:weight': {
        weight: EXPECTED_WEIGHT, // This is where weight SHOULD come from
      },
    },
  };

  beforeEach(() => {
    mockLogger = createMockLogger();

    mockUnsubscribe = jest.fn();
    mockEventBus = {
      subscribe: jest.fn().mockReturnValue(mockUnsubscribe),
      dispatch: jest.fn(),
    };

    mockEntityLifecycleManager = {
      createEntityInstance: jest
        .fn()
        .mockResolvedValue({ id: 'spawned-entity-789' }),
    };

    mockEntityManager = {
      getComponentData: jest
        .fn()
        .mockImplementation((entityId, componentId) => {
          // Simulate anatomy:part component WITHOUT weight (matching real schema)
          if (entityId === TEST_PART_ID && componentId === 'anatomy:part') {
            return {
              definitionId: TEST_DEFINITION_ID,
              subType: 'breast',
              // NOTE: No weight property here - this is the bug scenario
            };
          }
          if (entityId === TEST_ENTITY_ID && componentId === 'core:position') {
            return { locationId: TEST_LOCATION_ID };
          }
          if (entityId === TEST_ENTITY_ID && componentId === 'core:name') {
            return { text: 'Sarah' };
          }
          return null;
        }),
    };

    mockGameDataRepository = {
      getEntityDefinition: jest.fn().mockImplementation((definitionId) => {
        if (definitionId === TEST_DEFINITION_ID) {
          return mockEntityDefinition;
        }
        return null;
      }),
    };

    spawner = new DismemberedBodyPartSpawner({
      logger: mockLogger,
      entityManager: mockEntityManager,
      eventBus: mockEventBus,
      entityLifecycleManager: mockEntityLifecycleManager,
      gameDataRepository: mockGameDataRepository,
    });

    spawner.initialize();
    handleDismemberment = mockEventBus.subscribe.mock.calls[0][1];
  });

  afterEach(() => {
    spawner.destroy();
    jest.clearAllMocks();
  });

  describe('Weight retrieval from entity definition', () => {
    it('should retrieve weight from entity definition core:weight component', async () => {
      await handleDismemberment({
        type: 'anatomy:dismembered',
        payload: {
          entityId: TEST_ENTITY_ID,
          partId: TEST_PART_ID,
          partType: 'breast',
          orientation: 'left',
        },
      });

      // Verify the spawner looked up the entity definition
      expect(mockGameDataRepository.getEntityDefinition).toHaveBeenCalledWith(
        TEST_DEFINITION_ID
      );

      // Verify the created entity has the correct weight from definition
      expect(
        mockEntityLifecycleManager.createEntityInstance
      ).toHaveBeenCalledWith(
        TEST_DEFINITION_ID,
        expect.objectContaining({
          componentOverrides: expect.objectContaining({
            'core:weight': { weight: EXPECTED_WEIGHT },
          }),
        })
      );

      // Should NOT log a warning about missing weight
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('Missing weight')
      );
    });

    it('should use default weight when entity definition has no core:weight component', async () => {
      // Override mock to return definition without weight
      mockGameDataRepository.getEntityDefinition.mockImplementation(
        (definitionId) => {
          if (definitionId === TEST_DEFINITION_ID) {
            return {
              id: TEST_DEFINITION_ID,
              components: {
                'anatomy:part': { subType: 'breast' },
                'core:name': { text: 'breast' },
                // No core:weight component
              },
            };
          }
          return null;
        }
      );

      await handleDismemberment({
        type: 'anatomy:dismembered',
        payload: {
          entityId: TEST_ENTITY_ID,
          partId: TEST_PART_ID,
          partType: 'breast',
          orientation: 'left',
        },
      });

      // Should use default weight of 1.0 kg
      expect(
        mockEntityLifecycleManager.createEntityInstance
      ).toHaveBeenCalledWith(
        TEST_DEFINITION_ID,
        expect.objectContaining({
          componentOverrides: expect.objectContaining({
            'core:weight': { weight: 1.0 },
          }),
        })
      );

      // Should log warning about missing weight
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Missing weight')
      );
    });

    it('should use default weight when entity definition is not found', async () => {
      // Override mock to return null (definition not found)
      mockGameDataRepository.getEntityDefinition.mockReturnValue(null);

      await handleDismemberment({
        type: 'anatomy:dismembered',
        payload: {
          entityId: TEST_ENTITY_ID,
          partId: TEST_PART_ID,
          partType: 'breast',
          orientation: 'left',
        },
      });

      // Should use default weight of 1.0 kg
      expect(
        mockEntityLifecycleManager.createEntityInstance
      ).toHaveBeenCalledWith(
        TEST_DEFINITION_ID,
        expect.objectContaining({
          componentOverrides: expect.objectContaining({
            'core:weight': { weight: 1.0 },
          }),
        })
      );

      // Should log warning about missing weight
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Missing weight')
      );
    });

    it('should handle various weight values from different entity definitions', async () => {
      const testCases = [
        { definitionId: 'anatomy:human_leg', weight: 8.5 },
        { definitionId: 'anatomy:human_arm', weight: 4.2 },
        { definitionId: 'anatomy:human_finger', weight: 0.02 },
      ];

      for (const testCase of testCases) {
        // Reset mocks
        mockEntityLifecycleManager.createEntityInstance.mockClear();
        mockGameDataRepository.getEntityDefinition.mockClear();

        // Set up mock for this test case
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:part') {
              return { definitionId: testCase.definitionId };
            }
            if (componentId === 'core:position') {
              return { locationId: TEST_LOCATION_ID };
            }
            if (componentId === 'core:name') {
              return { text: 'Test' };
            }
            return null;
          }
        );

        mockGameDataRepository.getEntityDefinition.mockReturnValue({
          id: testCase.definitionId,
          components: {
            'anatomy:part': { subType: 'test' },
            'core:weight': { weight: testCase.weight },
          },
        });

        await handleDismemberment({
          type: 'anatomy:dismembered',
          payload: {
            entityId: TEST_ENTITY_ID,
            partId: TEST_PART_ID,
            partType: 'test',
            orientation: 'left',
          },
        });

        expect(
          mockEntityLifecycleManager.createEntityInstance
        ).toHaveBeenCalledWith(
          testCase.definitionId,
          expect.objectContaining({
            componentOverrides: expect.objectContaining({
              'core:weight': { weight: testCase.weight },
            }),
          })
        );
      }
    });
  });

  describe('Regression: anatomy:part should NOT have weight', () => {
    it('should NOT look for weight on anatomy:part component', async () => {
      // Even if anatomy:part somehow had a weight property, we should
      // still get weight from the entity definition's core:weight component
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (entityId === TEST_PART_ID && componentId === 'anatomy:part') {
            return {
              definitionId: TEST_DEFINITION_ID,
              subType: 'breast',
              weight: 999.99, // Bogus weight that should be IGNORED
            };
          }
          if (entityId === TEST_ENTITY_ID && componentId === 'core:position') {
            return { locationId: TEST_LOCATION_ID };
          }
          if (entityId === TEST_ENTITY_ID && componentId === 'core:name') {
            return { text: 'Sarah' };
          }
          return null;
        }
      );

      await handleDismemberment({
        type: 'anatomy:dismembered',
        payload: {
          entityId: TEST_ENTITY_ID,
          partId: TEST_PART_ID,
          partType: 'breast',
          orientation: 'left',
        },
      });

      // Should use the weight from entity definition (0.5), NOT the bogus 999.99
      expect(
        mockEntityLifecycleManager.createEntityInstance
      ).toHaveBeenCalledWith(
        TEST_DEFINITION_ID,
        expect.objectContaining({
          componentOverrides: expect.objectContaining({
            'core:weight': { weight: EXPECTED_WEIGHT },
          }),
        })
      );
    });
  });
});
