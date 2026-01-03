import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import CascadeDestructionService from '../../../../src/anatomy/services/cascadeDestructionService.js';

describe('CascadeDestructionService', () => {
  let service;
  let mockLogger;
  let mockEntityManager;
  let mockBodyGraphService;
  let mockDispatcher;

  const PART_HEALTH_COMPONENT_ID = 'anatomy:part_health';
  const PART_COMPONENT_ID = 'anatomy:part';
  const VITAL_ORGAN_COMPONENT_ID = 'anatomy:vital_organ';

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
      addComponent: jest.fn().mockResolvedValue(true),
    };

    mockBodyGraphService = {
      getAllDescendants: jest.fn(),
    };

    mockDispatcher = {
      dispatch: jest.fn(),
    };

    service = new CascadeDestructionService({
      logger: mockLogger,
      entityManager: mockEntityManager,
      bodyGraphService: mockBodyGraphService,
      safeEventDispatcher: mockDispatcher,
    });
  });

  describe('constructor', () => {
    it('should initialize with all dependencies', () => {
      expect(service).toBeDefined();
    });

    it('should throw if logger is missing', () => {
      expect(
        () =>
          new CascadeDestructionService({
            entityManager: mockEntityManager,
            bodyGraphService: mockBodyGraphService,
            safeEventDispatcher: mockDispatcher,
          })
      ).toThrow();
    });

    it('should throw if entityManager is missing', () => {
      expect(
        () =>
          new CascadeDestructionService({
            logger: mockLogger,
            bodyGraphService: mockBodyGraphService,
            safeEventDispatcher: mockDispatcher,
          })
      ).toThrow();
    });

    it('should throw if bodyGraphService is missing', () => {
      expect(
        () =>
          new CascadeDestructionService({
            logger: mockLogger,
            entityManager: mockEntityManager,
            safeEventDispatcher: mockDispatcher,
          })
      ).toThrow();
    });

    it('should throw if safeEventDispatcher is missing', () => {
      expect(
        () =>
          new CascadeDestructionService({
            logger: mockLogger,
            entityManager: mockEntityManager,
            bodyGraphService: mockBodyGraphService,
          })
      ).toThrow();
    });

    it('should throw if entityManager missing required methods', () => {
      const invalidEntityManager = { hasComponent: jest.fn() };
      expect(
        () =>
          new CascadeDestructionService({
            logger: mockLogger,
            entityManager: invalidEntityManager,
            bodyGraphService: mockBodyGraphService,
            safeEventDispatcher: mockDispatcher,
          })
      ).toThrow();
    });

    it('should throw if bodyGraphService missing getAllDescendants', () => {
      const invalidBodyGraphService = {};
      expect(
        () =>
          new CascadeDestructionService({
            logger: mockLogger,
            entityManager: mockEntityManager,
            bodyGraphService: invalidBodyGraphService,
            safeEventDispatcher: mockDispatcher,
          })
      ).toThrow();
    });

    it('should throw if safeEventDispatcher missing dispatch', () => {
      const invalidDispatcher = {};
      expect(
        () =>
          new CascadeDestructionService({
            logger: mockLogger,
            entityManager: mockEntityManager,
            bodyGraphService: mockBodyGraphService,
            safeEventDispatcher: invalidDispatcher,
          })
      ).toThrow();
    });
  });

  describe('executeCascade', () => {
    it('should return empty result when part has no descendants', async () => {
      mockBodyGraphService.getAllDescendants.mockReturnValue([]);

      const result = await service.executeCascade('root', 'owner');

      expect(result).toEqual({
        destroyedPartIds: [],
        destroyedParts: [],
        vitalOrganDestroyed: false,
      });
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should destroy all living descendants when parent destroyed', async () => {
      const components = {
        childA: {
          [PART_HEALTH_COMPONENT_ID]: { currentHealth: 10, maxHealth: 10 },
          [PART_COMPONENT_ID]: { subType: 'arm', orientation: 'left' },
        },
        childB: {
          [PART_HEALTH_COMPONENT_ID]: { currentHealth: 5, maxHealth: 5 },
          [PART_COMPONENT_ID]: { subType: 'hand', orientation: 'left' },
        },
      };

      mockBodyGraphService.getAllDescendants.mockReturnValue([
        'childA',
        'childB',
      ]);
      mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
        return Boolean(components[id]?.[componentId]);
      });
      mockEntityManager.getComponentData.mockImplementation((id, componentId) => {
        return components[id]?.[componentId] ?? null;
      });

      const result = await service.executeCascade('root', 'owner');

      expect(result.destroyedPartIds).toEqual(['childA', 'childB']);
      expect(result.destroyedParts).toHaveLength(2);
      expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(2);
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        'anatomy:part_destroyed',
        expect.objectContaining({
          entityId: 'owner',
          partId: 'childA',
          timestamp: expect.any(Number),
        })
      );
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        'anatomy:part_destroyed',
        expect.objectContaining({
          entityId: 'owner',
          partId: 'childB',
          timestamp: expect.any(Number),
        })
      );
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        'anatomy:cascade_destruction',
        expect.objectContaining({
          entityId: 'owner',
          cascadedFrom: 'root',
          destroyedPartIds: ['childA', 'childB'],
          vitalOrganDestroyed: false,
          timestamp: expect.any(Number),
        })
      );
    });

    it('should skip descendants already at 0 health', async () => {
      const components = {
        childA: {
          [PART_HEALTH_COMPONENT_ID]: { currentHealth: 0, maxHealth: 10 },
          [PART_COMPONENT_ID]: { subType: 'arm', orientation: 'left' },
        },
        childB: {
          [PART_HEALTH_COMPONENT_ID]: { currentHealth: 3, maxHealth: 5 },
          [PART_COMPONENT_ID]: { subType: 'hand', orientation: 'left' },
        },
      };

      mockBodyGraphService.getAllDescendants.mockReturnValue([
        'childA',
        'childB',
      ]);
      mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
        return Boolean(components[id]?.[componentId]);
      });
      mockEntityManager.getComponentData.mockImplementation((id, componentId) => {
        return components[id]?.[componentId] ?? null;
      });

      const result = await service.executeCascade('root', 'owner');

      expect(result.destroyedPartIds).toEqual(['childB']);
      expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(1);
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        'anatomy:part_destroyed',
        expect.objectContaining({
          partId: 'childB',
        })
      );
    });

    it('should correctly traverse multi-level hierarchy (grandchildren)', async () => {
      const components = {
        childA: {
          [PART_HEALTH_COMPONENT_ID]: { currentHealth: 4, maxHealth: 4 },
          [PART_COMPONENT_ID]: { subType: 'arm', orientation: 'right' },
        },
        grandchildA: {
          [PART_HEALTH_COMPONENT_ID]: { currentHealth: 2, maxHealth: 2 },
          [PART_COMPONENT_ID]: { subType: 'hand', orientation: 'right' },
        },
      };

      mockBodyGraphService.getAllDescendants.mockReturnValue([
        'childA',
        'grandchildA',
      ]);
      mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
        return Boolean(components[id]?.[componentId]);
      });
      mockEntityManager.getComponentData.mockImplementation((id, componentId) => {
        return components[id]?.[componentId] ?? null;
      });

      const result = await service.executeCascade('root', 'owner');

      expect(result.destroyedPartIds).toEqual(['childA', 'grandchildA']);
      expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(2);
    });

    it('should identify vital organ destruction correctly', async () => {
      const components = {
        heart: {
          [PART_HEALTH_COMPONENT_ID]: { currentHealth: 6, maxHealth: 6 },
          [PART_COMPONENT_ID]: { subType: 'heart', orientation: null },
          [VITAL_ORGAN_COMPONENT_ID]: { organType: 'heart' },
        },
      };

      mockBodyGraphService.getAllDescendants.mockReturnValue(['heart']);
      mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
        return Boolean(components[id]?.[componentId]);
      });
      mockEntityManager.getComponentData.mockImplementation((id, componentId) => {
        return components[id]?.[componentId] ?? null;
      });

      const result = await service.executeCascade('root', 'owner');

      expect(result.vitalOrganDestroyed).toBe(true);
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        'anatomy:cascade_destruction',
        expect.objectContaining({
          vitalOrganDestroyed: true,
        })
      );
    });

    it('should handle entity with no health component gracefully', async () => {
      const components = {
        childA: {
          [PART_COMPONENT_ID]: { subType: 'arm', orientation: 'left' },
        },
      };

      mockBodyGraphService.getAllDescendants.mockReturnValue(['childA']);
      mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
        return Boolean(components[id]?.[componentId]);
      });
      mockEntityManager.getComponentData.mockImplementation((id, componentId) => {
        return components[id]?.[componentId] ?? null;
      });

      const result = await service.executeCascade('root', 'owner');

      expect(result).toEqual({
        destroyedPartIds: [],
        destroyedParts: [],
        vitalOrganDestroyed: false,
      });
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });
  });
});
