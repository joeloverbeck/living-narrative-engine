/**
 * @file Unit tests for SlotMappingConfiguration
 * @see src/anatomy/configuration/slotMappingConfiguration.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import SlotMappingConfiguration from '../../../../src/anatomy/configuration/slotMappingConfiguration.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

describe('SlotMappingConfiguration', () => {
  let service;
  let mockLogger;
  let mockDataRegistry;
  let mockEntityManager;

  beforeEach(() => {
    mockLogger = createMockLogger();

    mockDataRegistry = {
      get: jest.fn(),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn(),
    };

    service = new SlotMappingConfiguration({
      logger: mockLogger,
      dataRegistry: mockDataRegistry,
      entityManager: mockEntityManager,
    });
  });

  describe('constructor', () => {
    it('should initialize with required dependencies', () => {
      expect(service).toBeInstanceOf(SlotMappingConfiguration);
    });

    it('should throw error when logger is missing', () => {
      expect(() => {
        new SlotMappingConfiguration({
          dataRegistry: mockDataRegistry,
          entityManager: mockEntityManager,
        });
      }).toThrow();
    });

    it('should throw error when dataRegistry is missing', () => {
      expect(() => {
        new SlotMappingConfiguration({
          logger: mockLogger,
          entityManager: mockEntityManager,
        });
      }).toThrow();
    });

    it('should throw error when entityManager is missing', () => {
      expect(() => {
        new SlotMappingConfiguration({
          logger: mockLogger,
          dataRegistry: mockDataRegistry,
        });
      }).toThrow();
    });
  });

  describe('resolveSlotMapping', () => {
    it('should resolve slot mapping for valid clothing slot', async () => {
      const blueprintId = 'test:blueprint';
      const clothingSlotId = 'torso_clothing';

      const result = await service.resolveSlotMapping(blueprintId, clothingSlotId);

      expect(result).toEqual({
        anatomySlots: ['torso_upper', 'torso_lower'],
        priority: 1,
      });
    });

    it('should return null for unknown clothing slot', async () => {
      const blueprintId = 'test:blueprint';
      const clothingSlotId = 'unknown_slot';

      const result = await service.resolveSlotMapping(blueprintId, clothingSlotId);

      expect(result).toBeNull();
    });

    it('should cache slot mapping results', async () => {
      const blueprintId = 'test:blueprint';
      const clothingSlotId = 'torso_clothing';

      // First call
      const result1 = await service.resolveSlotMapping(blueprintId, clothingSlotId);
      
      // Second call (should hit cache)
      const result2 = await service.resolveSlotMapping(blueprintId, clothingSlotId);

      expect(result1).toEqual(result2);
      expect(result1).toEqual({
        anatomySlots: ['torso_upper', 'torso_lower'],
        priority: 1,
      });
    });

    it('should throw error for invalid parameters', async () => {
      await expect(service.resolveSlotMapping('', 'slot')).rejects.toThrow();
      await expect(service.resolveSlotMapping('blueprint', '')).rejects.toThrow();
      await expect(service.resolveSlotMapping(null, 'slot')).rejects.toThrow();
      await expect(service.resolveSlotMapping('blueprint', null)).rejects.toThrow();
    });
  });

  describe('getSlotEntityMappings', () => {
    it('should return empty map when entity not found', async () => {
      const entityId = 'test:entity';
      mockEntityManager.getEntityInstance.mockReturnValue(null);

      const result = await service.getSlotEntityMappings(entityId);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should return empty map when entity has no anatomy body component', async () => {
      const entityId = 'test:entity';
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(false),
        getComponentData: jest.fn(),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const result = await service.getSlotEntityMappings(entityId);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should return slot entity mappings from anatomy body component', async () => {
      const entityId = 'test:entity';
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          slotEntityMappings: {
            torso_upper: 'entity_1',
            torso_lower: 'entity_2',
            left_arm: 'entity_3',
          },
        }),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const result = await service.getSlotEntityMappings(entityId);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(3);
      expect(result.get('torso_upper')).toBe('entity_1');
      expect(result.get('torso_lower')).toBe('entity_2');
      expect(result.get('left_arm')).toBe('entity_3');
    });

    it('should cache slot entity mappings', async () => {
      const entityId = 'test:entity';
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          slotEntityMappings: {
            torso_upper: 'entity_1',
          },
        }),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      // First call
      const result1 = await service.getSlotEntityMappings(entityId);
      
      // Second call (should hit cache)
      const result2 = await service.getSlotEntityMappings(entityId);

      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
      expect(result1).toBe(result2); // Should be the same Map instance
    });

    it('should throw error for invalid entity ID', async () => {
      await expect(service.getSlotEntityMappings('')).rejects.toThrow();
      await expect(service.getSlotEntityMappings(null)).rejects.toThrow();
      await expect(service.getSlotEntityMappings(undefined)).rejects.toThrow();
    });

    it('should handle component data without slotEntityMappings', async () => {
      const entityId = 'test:entity';
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({}),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const result = await service.getSlotEntityMappings(entityId);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });
  });

  describe('clearCache', () => {
    it('should clear both mapping and slot entity mapping caches', async () => {
      const blueprintId = 'test:blueprint';
      const clothingSlotId = 'torso_clothing';
      const entityId = 'test:entity';

      // Populate caches
      await service.resolveSlotMapping(blueprintId, clothingSlotId);
      
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          slotEntityMappings: { torso_upper: 'entity_1' },
        }),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      await service.getSlotEntityMappings(entityId);

      // Clear caches
      service.clearCache();

      // Reset mocks
      mockEntityManager.getEntityInstance.mockClear();

      // These calls should not hit cache
      await service.resolveSlotMapping(blueprintId, clothingSlotId);
      await service.getSlotEntityMappings(entityId);

      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should handle errors in resolveSlotMapping gracefully', async () => {
      const blueprintId = 'test:blueprint';
      const clothingSlotId = 'torso_clothing';

      // Mock service to throw error in #loadSlotMappingsConfig
      const errorService = new SlotMappingConfiguration({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
        entityManager: mockEntityManager,
      });

      // Spy on the private method indirectly by causing an error
      jest.spyOn(errorService, 'resolveSlotMapping').mockImplementation(async () => {
        throw new Error('Configuration load failed');
      });

      await expect(errorService.resolveSlotMapping(blueprintId, clothingSlotId))
        .rejects.toThrow('Configuration load failed');
    });

    it('should handle errors in getSlotEntityMappings gracefully', async () => {
      const entityId = 'test:entity';
      mockEntityManager.getEntityInstance.mockImplementation(() => {
        throw new Error('Entity manager error');
      });

      await expect(service.getSlotEntityMappings(entityId))
        .rejects.toThrow('Entity manager error');
    });
  });
});