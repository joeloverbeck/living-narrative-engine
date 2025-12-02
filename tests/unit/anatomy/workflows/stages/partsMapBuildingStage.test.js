import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { executePartsMapBuilding } from '../../../../../src/anatomy/workflows/stages/partsMapBuildingStage.js';
import { createMockLogger } from '../../../../common/mockFactories/loggerMocks.js';

describe('partsMapBuildingStage', () => {
  let mockEntityManager;
  let mockDataRegistry;
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();

    mockEntityManager = {
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
      addComponent: jest.fn(),
    };

    mockDataRegistry = {
      get: jest.fn(),
    };
  });

  describe('executePartsMapBuilding', () => {
    it('should build parts map from valid entities', async () => {
      const graphResult = {
        entities: ['entity-1', 'entity-2'],
        rootId: 'root-entity',
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'entity-1') {
          return {
            hasComponent: jest.fn((comp) =>
              ['anatomy:part', 'core:name'].includes(comp)
            ),
            getComponentData: jest.fn((comp) => {
              if (comp === 'core:name') return { text: 'left arm' };
              return {};
            }),
          };
        }
        if (id === 'entity-2') {
          return {
            hasComponent: jest.fn((comp) =>
              ['anatomy:part', 'core:name'].includes(comp)
            ),
            getComponentData: jest.fn((comp) => {
              if (comp === 'core:name') return { text: 'right arm' };
              return {};
            }),
          };
        }
        return null;
      });

      mockEntityManager.getComponentData.mockReturnValue({});
      mockDataRegistry.get.mockReturnValue({});

      const result = await executePartsMapBuilding(
        {
          graphResult,
          ownerId: 'owner-1',
          recipeId: 'recipe-1',
        },
        {
          entityManager: mockEntityManager,
          dataRegistry: mockDataRegistry,
          logger: mockLogger,
        }
      );

      expect(result.partsMap).toBeInstanceOf(Map);
      expect(result.partsMap.size).toBe(2);
      expect(result.partsMap.get('left arm')).toBe('entity-1');
      expect(result.partsMap.get('right arm')).toBe('entity-2');
    });

    it('should throw error when duplicate part names are detected', async () => {
      const graphResult = {
        entities: ['entity-1', 'entity-2'],
        rootId: 'root-entity',
      };

      // Both entities have the same name - this should trigger fail-fast
      mockEntityManager.getEntityInstance.mockImplementation(() => ({
        hasComponent: jest.fn((comp) =>
          ['anatomy:part', 'core:name'].includes(comp)
        ),
        getComponentData: jest.fn((comp) => {
          if (comp === 'core:name') return { text: 'chicken foot' }; // Duplicate!
          return {};
        }),
      }));

      await expect(
        executePartsMapBuilding(
          {
            graphResult,
            ownerId: 'owner-1',
            recipeId: 'recipe-1',
          },
          {
            entityManager: mockEntityManager,
            dataRegistry: mockDataRegistry,
            logger: mockLogger,
          }
        )
      ).rejects.toThrow(/Duplicate part name 'chicken foot' detected/);
    });

    it('should include both entity IDs in duplicate error message', async () => {
      const graphResult = {
        entities: ['first-entity', 'second-entity'],
        rootId: 'root-entity',
      };

      mockEntityManager.getEntityInstance.mockImplementation(() => ({
        hasComponent: jest.fn((comp) =>
          ['anatomy:part', 'core:name'].includes(comp)
        ),
        getComponentData: jest.fn((comp) => {
          if (comp === 'core:name') return { text: 'duplicate name' };
          return {};
        }),
      }));

      await expect(
        executePartsMapBuilding(
          {
            graphResult,
            ownerId: 'owner-1',
            recipeId: 'recipe-1',
          },
          {
            entityManager: mockEntityManager,
            dataRegistry: mockDataRegistry,
            logger: mockLogger,
          }
        )
      ).rejects.toThrow(/first-entity.*second-entity|second-entity.*first-entity/);
    });

    it('should log error before throwing on duplicate', async () => {
      const graphResult = {
        entities: ['entity-1', 'entity-2'],
        rootId: 'root-entity',
      };

      mockEntityManager.getEntityInstance.mockImplementation(() => ({
        hasComponent: jest.fn((comp) =>
          ['anatomy:part', 'core:name'].includes(comp)
        ),
        getComponentData: jest.fn((comp) => {
          if (comp === 'core:name') return { text: 'duplicate' };
          return {};
        }),
      }));

      await expect(
        executePartsMapBuilding(
          {
            graphResult,
            ownerId: 'owner-1',
            recipeId: 'recipe-1',
          },
          {
            entityManager: mockEntityManager,
            dataRegistry: mockDataRegistry,
            logger: mockLogger,
          }
        )
      ).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Duplicate part name')
      );
    });

    it('should skip entities without anatomy:part component', async () => {
      const graphResult = {
        entities: ['part-entity', 'non-part-entity'],
        rootId: 'root-entity',
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'part-entity') {
          return {
            hasComponent: jest.fn((comp) =>
              ['anatomy:part', 'core:name'].includes(comp)
            ),
            getComponentData: jest.fn((comp) => {
              if (comp === 'core:name') return { text: 'valid part' };
              return {};
            }),
          };
        }
        // Non-part entity doesn't have anatomy:part
        return {
          hasComponent: jest.fn((comp) => comp === 'core:name'),
          getComponentData: jest.fn((comp) => {
            if (comp === 'core:name') return { text: 'not a part' };
            return {};
          }),
        };
      });

      mockEntityManager.getComponentData.mockReturnValue({});
      mockDataRegistry.get.mockReturnValue({});

      const result = await executePartsMapBuilding(
        {
          graphResult,
          ownerId: 'owner-1',
          recipeId: 'recipe-1',
        },
        {
          entityManager: mockEntityManager,
          dataRegistry: mockDataRegistry,
          logger: mockLogger,
        }
      );

      // Only the part entity should be in the map
      expect(result.partsMap.size).toBe(1);
      expect(result.partsMap.get('valid part')).toBe('part-entity');
    });

    it('should use entity ID as fallback key when name is missing', async () => {
      const graphResult = {
        entities: ['no-name-entity'],
        rootId: 'root-entity',
      };

      mockEntityManager.getEntityInstance.mockImplementation(() => ({
        hasComponent: jest.fn((comp) =>
          ['anatomy:part', 'core:name'].includes(comp)
        ),
        getComponentData: jest.fn((comp) => {
          if (comp === 'core:name') return null; // No name data
          return {};
        }),
      }));

      mockEntityManager.getComponentData.mockReturnValue({});
      mockDataRegistry.get.mockReturnValue({});

      const result = await executePartsMapBuilding(
        {
          graphResult,
          ownerId: 'owner-1',
          recipeId: 'recipe-1',
        },
        {
          entityManager: mockEntityManager,
          dataRegistry: mockDataRegistry,
          logger: mockLogger,
        }
      );

      // Should use entity ID as fallback
      expect(result.partsMap.get('no-name-entity')).toBe('no-name-entity');
    });
  });
});
