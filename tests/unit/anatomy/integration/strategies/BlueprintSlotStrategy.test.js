/**
 * @file Unit tests for BlueprintSlotStrategy class
 * @see src/anatomy/integration/strategies/BlueprintSlotStrategy.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import BlueprintSlotStrategy from '../../../../../src/anatomy/integration/strategies/BlueprintSlotStrategy.js';

describe('BlueprintSlotStrategy', () => {
  let strategy;
  let mockLogger;
  let mockEntityManager;
  let mockBodyGraphService;
  let mockAnatomyBlueprintRepository;
  let mockAnatomySocketIndex;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
    };

    mockBodyGraphService = {
      getBodyGraph: jest.fn(),
    };

    mockAnatomyBlueprintRepository = {
      getBlueprintByRecipeId: jest.fn(),
    };

    mockAnatomySocketIndex = {
      findEntityWithSocket: jest.fn(),
    };

    strategy = new BlueprintSlotStrategy({
      logger: mockLogger,
      entityManager: mockEntityManager,
      bodyGraphService: mockBodyGraphService,
      anatomyBlueprintRepository: mockAnatomyBlueprintRepository,
      anatomySocketIndex: mockAnatomySocketIndex,
    });
  });

  describe('constructor', () => {
    it('should initialize with all required dependencies', () => {
      expect(strategy).toBeDefined();
    });

    it('should validate required dependencies', () => {
      expect(() => {
        new BlueprintSlotStrategy({
          logger: mockLogger,
          // Missing entityManager
          bodyGraphService: mockBodyGraphService,
          anatomyBlueprintRepository: mockAnatomyBlueprintRepository,
          anatomySocketIndex: mockAnatomySocketIndex,
        });
      }).toThrow();
    });

    it('should initialize with default empty Map for slotEntityMappings', () => {
      const strategyWithDefaults = new BlueprintSlotStrategy({
        logger: mockLogger,
        entityManager: mockEntityManager,
        bodyGraphService: mockBodyGraphService,
        anatomyBlueprintRepository: mockAnatomyBlueprintRepository,
        anatomySocketIndex: mockAnatomySocketIndex,
      });
      expect(strategyWithDefaults).toBeDefined();
    });
  });

  describe('canResolve', () => {
    it('should return true for mapping with blueprintSlots array', () => {
      const mapping = { blueprintSlots: ['left_breast', 'right_breast'] };
      expect(strategy.canResolve(mapping)).toBe(true);
    });

    it('should return true for mapping with empty blueprintSlots array', () => {
      const mapping = { blueprintSlots: [] };
      expect(strategy.canResolve(mapping)).toBe(true);
    });

    it('should return false for null mapping', () => {
      expect(strategy.canResolve(null)).toBe(false);
    });

    it('should return false for undefined mapping', () => {
      expect(strategy.canResolve(undefined)).toBe(false);
    });

    it('should return false for mapping without blueprintSlots', () => {
      const mapping = { anatomySockets: ['vagina'] };
      expect(strategy.canResolve(mapping)).toBe(false);
    });

    it('should return false for mapping with non-array blueprintSlots', () => {
      const mapping = { blueprintSlots: 'not-an-array' };
      expect(strategy.canResolve(mapping)).toBe(false);
    });
  });

  describe('resolve', () => {
    it('should return empty array for non-resolvable mapping', async () => {
      const mapping = { anatomySockets: ['vagina'] };
      const result = await strategy.resolve('actor123', mapping);
      expect(result).toEqual([]);
    });

    it('should return empty array when no blueprint found', async () => {
      mockEntityManager.getComponentData.mockResolvedValue(null);
      const mapping = { blueprintSlots: ['left_breast'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No blueprint found for entity actor123'
      );
    });

    it('should return empty array when body component has no recipeId', async () => {
      mockEntityManager.getComponentData.mockResolvedValue({});
      const mapping = { blueprintSlots: ['left_breast'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No blueprint found for entity actor123'
      );
    });

    it('should resolve basic blueprint slot successfully', async () => {
      const mockBlueprint = {
        slots: {
          torso: { socket: 'torso_socket' },
        },
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'anatomy:body') {
            return Promise.resolve({ recipeId: 'human_base' });
          }
          if (componentType === 'anatomy:sockets') {
            return Promise.resolve({
              sockets: [{ id: 'torso_socket', orientation: 'neutral' }],
            });
          }
          return Promise.resolve(null);
        }
      );

      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        mockBlueprint
      );
      mockBodyGraphService.getBodyGraph.mockResolvedValue({
        getConnectedParts: jest.fn().mockReturnValue([]),
      });
      mockAnatomySocketIndex.findEntityWithSocket.mockResolvedValue(
        'torso_entity'
      );

      const mapping = { blueprintSlots: ['torso'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        entityId: 'torso_entity',
        socketId: 'torso_socket',
        slotPath: 'torso',
        orientation: 'neutral',
      });
    });

    it('should skip slot when blueprint slot not found', async () => {
      const mockBlueprint = {
        slots: {
          existing_slot: { socket: 'socket1' },
        },
      };

      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'human_base',
      });
      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        mockBlueprint
      );
      mockBodyGraphService.getBodyGraph.mockResolvedValue({
        getConnectedParts: jest.fn().mockReturnValue([]),
      });

      const mapping = { blueprintSlots: ['nonexistent_slot'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Blueprint slot 'nonexistent_slot' not found"
      );
    });

    it('should warn when slot has no socket defined', async () => {
      const mockBlueprint = {
        slots: {
          no_socket_slot: { type: 'test' }, // No socket property
        },
      };

      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'human_base',
      });
      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        mockBlueprint
      );
      mockBodyGraphService.getBodyGraph.mockResolvedValue({
        getConnectedParts: jest.fn().mockReturnValue([]),
      });

      const mapping = { blueprintSlots: ['no_socket_slot'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "BlueprintSlotStrategy: Blueprint slot 'no_socket_slot' has no socket defined"
      );
    });

    it('should warn when no entity found with socket', async () => {
      const mockBlueprint = {
        slots: {
          test_slot: { socket: 'test_socket' },
        },
      };

      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'human_base',
      });
      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        mockBlueprint
      );
      mockBodyGraphService.getBodyGraph.mockResolvedValue({
        getConnectedParts: jest.fn().mockReturnValue([]),
      });
      mockAnatomySocketIndex.findEntityWithSocket.mockResolvedValue(null);

      const mapping = { blueprintSlots: ['test_slot'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "No entity found with socket 'test_socket' for slot 'test_slot'"
      );
    });

    it('should extract orientation from slot name when socket has no orientation', async () => {
      const mockBlueprint = {
        slots: {
          left_breast: { socket: 'left_breast_socket' },
        },
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'anatomy:body') {
            return Promise.resolve({ recipeId: 'human_base' });
          }
          if (componentType === 'anatomy:sockets') {
            return Promise.resolve({
              sockets: [{ id: 'left_breast_socket' }], // No orientation
            });
          }
          return Promise.resolve(null);
        }
      );

      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        mockBlueprint
      );
      mockBodyGraphService.getBodyGraph.mockResolvedValue({
        getConnectedParts: jest.fn().mockReturnValue([]),
      });
      mockAnatomySocketIndex.findEntityWithSocket.mockResolvedValue(
        'breast_entity'
      );

      const mapping = { blueprintSlots: ['left_breast'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result).toHaveLength(1);
      expect(result[0].orientation).toBe('left');
    });

    it('should handle socket data retrieval errors gracefully', async () => {
      const mockBlueprint = {
        slots: {
          test_slot: { socket: 'test_socket' },
        },
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'anatomy:body') {
            return Promise.resolve({ recipeId: 'human_base' });
          }
          if (componentType === 'anatomy:sockets') {
            throw new Error('Socket error');
          }
          return Promise.resolve(null);
        }
      );

      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        mockBlueprint
      );
      mockBodyGraphService.getBodyGraph.mockResolvedValue({
        getConnectedParts: jest.fn().mockReturnValue([]),
      });
      mockAnatomySocketIndex.findEntityWithSocket.mockResolvedValue(
        'test_entity'
      );

      const mapping = { blueprintSlots: ['test_slot'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result).toHaveLength(1);
      expect(result[0].orientation).toBe('neutral'); // Default orientation
    });

    it('should use direct slot mapping when available', async () => {
      const slotMappings = new Map([['direct_slot', 'mapped_entity']]);

      const strategyWithMappings = new BlueprintSlotStrategy({
        logger: mockLogger,
        entityManager: mockEntityManager,
        bodyGraphService: mockBodyGraphService,
        anatomyBlueprintRepository: mockAnatomyBlueprintRepository,
        anatomySocketIndex: mockAnatomySocketIndex,
        slotEntityMappings: slotMappings,
      });

      const mockBlueprint = {
        slots: {
          direct_slot: { socket: 'direct_socket' },
        },
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'anatomy:body') {
            return Promise.resolve({ recipeId: 'human_base' });
          }
          if (componentType === 'anatomy:sockets') {
            return Promise.resolve({
              sockets: [{ id: 'direct_socket', orientation: 'neutral' }],
            });
          }
          return Promise.resolve(null);
        }
      );

      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        mockBlueprint
      );
      mockBodyGraphService.getBodyGraph.mockResolvedValue({
        getConnectedParts: jest.fn().mockReturnValue([]),
      });

      const mapping = { blueprintSlots: ['direct_slot'] };
      const result = await strategyWithMappings.resolve('actor123', mapping);

      expect(result).toHaveLength(1);
      expect(result[0].entityId).toBe('mapped_entity');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "BlueprintSlotStrategy: Found direct slot mapping for 'direct_slot' → 'mapped_entity'"
      );
    });

    it('should resolve to the root entity when slot path is empty', async () => {
      const mockBlueprint = {
        slots: {
          '': { socket: 'root_socket' },
        },
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'anatomy:body') {
            return Promise.resolve({ recipeId: 'human_base' });
          }
          if (componentType === 'anatomy:sockets') {
            return Promise.resolve({
              sockets: [{ id: 'root_socket', orientation: 'neutral' }],
            });
          }
          return Promise.resolve(null);
        }
      );

      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        mockBlueprint
      );
      mockBodyGraphService.getBodyGraph.mockResolvedValue({});

      const mapping = { blueprintSlots: [''] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result).toEqual([
        {
          entityId: 'actor123',
          socketId: 'root_socket',
          slotPath: '',
          orientation: 'neutral',
        },
      ]);
      expect(mockAnatomySocketIndex.findEntityWithSocket).not.toHaveBeenCalled();
    });
  });

  describe('setSlotEntityMappings', () => {
    it('should set mappings from Map', () => {
      const mappings = new Map([
        ['slot1', 'entity1'],
        ['slot2', 'entity2'],
      ]);

      strategy.setSlotEntityMappings(mappings);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'BlueprintSlotStrategy: Updated slot-entity mappings with 2 entries'
      );
    });

    it('should set mappings from plain object', () => {
      const mappings = {
        slot1: 'entity1',
        slot2: 'entity2',
      };

      strategy.setSlotEntityMappings(mappings);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'BlueprintSlotStrategy: Updated slot-entity mappings with 2 entries'
      );
    });

    it('should set empty Map for null mappings', () => {
      strategy.setSlotEntityMappings(null);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'BlueprintSlotStrategy: Updated slot-entity mappings with 0 entries'
      );
    });

    it('should set empty Map for invalid mappings', () => {
      strategy.setSlotEntityMappings('invalid');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'BlueprintSlotStrategy: Updated slot-entity mappings with 0 entries'
      );
    });
  });

  describe('orientation extraction', () => {
    it('should extract left orientation from slot name', async () => {
      const mockBlueprint = {
        slots: {
          left_arm: { socket: 'left_arm_socket' },
        },
      };

      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'human_base',
      });
      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        mockBlueprint
      );
      mockBodyGraphService.getBodyGraph.mockResolvedValue({
        getConnectedParts: jest.fn().mockReturnValue([]),
      });
      mockAnatomySocketIndex.findEntityWithSocket.mockResolvedValue(
        'arm_entity'
      );

      const mapping = { blueprintSlots: ['left_arm'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result[0].orientation).toBe('left');
    });

    it('should extract right orientation from slot name', async () => {
      const mockBlueprint = {
        slots: {
          right_arm: { socket: 'right_arm_socket' },
        },
      };

      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'human_base',
      });
      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        mockBlueprint
      );
      mockBodyGraphService.getBodyGraph.mockResolvedValue({
        getConnectedParts: jest.fn().mockReturnValue([]),
      });
      mockAnatomySocketIndex.findEntityWithSocket.mockResolvedValue(
        'arm_entity'
      );

      const mapping = { blueprintSlots: ['right_arm'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result[0].orientation).toBe('right');
    });

    it('should extract upper orientation from slot name', async () => {
      const mockBlueprint = {
        slots: {
          upper_torso: { socket: 'upper_torso_socket' },
        },
      };

      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'human_base',
      });
      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        mockBlueprint
      );
      mockBodyGraphService.getBodyGraph.mockResolvedValue({
        getConnectedParts: jest.fn().mockReturnValue([]),
      });
      mockAnatomySocketIndex.findEntityWithSocket.mockResolvedValue(
        'torso_entity'
      );

      const mapping = { blueprintSlots: ['upper_torso'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result[0].orientation).toBe('upper');
    });

    it('should extract lower orientation from slot name', async () => {
      const mockBlueprint = {
        slots: {
          lower_torso: { socket: 'lower_torso_socket' },
        },
      };

      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'human_base',
      });
      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        mockBlueprint
      );
      mockBodyGraphService.getBodyGraph.mockResolvedValue({
        getConnectedParts: jest.fn().mockReturnValue([]),
      });
      mockAnatomySocketIndex.findEntityWithSocket.mockResolvedValue(
        'torso_entity'
      );

      const mapping = { blueprintSlots: ['lower_torso'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result[0].orientation).toBe('lower');
    });

    it('should default to neutral orientation', async () => {
      const mockBlueprint = {
        slots: {
          torso: { socket: 'torso_socket' },
        },
      };

      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'human_base',
      });
      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        mockBlueprint
      );
      mockBodyGraphService.getBodyGraph.mockResolvedValue({
        getConnectedParts: jest.fn().mockReturnValue([]),
      });
      mockAnatomySocketIndex.findEntityWithSocket.mockResolvedValue(
        'torso_entity'
      );

      const mapping = { blueprintSlots: ['torso'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result[0].orientation).toBe('neutral');
    });
  });

  describe('complex slot path resolution', () => {
    it('should handle complex slot path traversal through findEntityAtSlotPath', async () => {
      const mockBlueprint = {
        slots: {
          root_slot: { type: 'root', parent: null },
          child_slot: { type: 'child', parent: 'root_slot' },
          target_slot: {
            type: 'target',
            socket: 'target_socket',
            parent: 'child_slot',
          },
        },
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'anatomy:body') {
            return Promise.resolve({ recipeId: 'human_base' });
          }
          if (componentType === 'anatomy:joint') {
            return Promise.resolve({ parentEntityId: 'parent_123' });
          }
          if (componentType === 'anatomy:sockets') {
            return Promise.resolve({
              sockets: [{ id: 'target_socket', orientation: 'neutral' }],
            });
          }
          return Promise.resolve(null);
        }
      );

      const mockBodyGraph = {
        getConnectedParts: jest.fn().mockReturnValue(['connected_entity']),
      };

      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        mockBlueprint
      );
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);
      mockAnatomySocketIndex.findEntityWithSocket.mockResolvedValue(null);

      const mapping = { blueprintSlots: ['target_slot'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(mockBodyGraph.getConnectedParts).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].entityId).toBe('connected_entity');
    });

    it('should handle slot path building with multiple parent levels', async () => {
      const mockBlueprint = {
        slots: {
          root: { type: 'root', parent: null },
          level1: { type: 'level1', parent: 'root' },
          level2: { type: 'level2', parent: 'level1' },
          target: { type: 'target', socket: 'deep_socket', parent: 'level2' },
        },
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'anatomy:body') {
            return Promise.resolve({ recipeId: 'human_base' });
          }
          if (componentType === 'anatomy:joint') {
            return Promise.resolve({ parentEntityId: 'parent_123' });
          }
          return Promise.resolve(null);
        }
      );

      const mockBodyGraph = {
        getConnectedParts: jest.fn().mockReturnValue(['entity1', 'entity2']),
      };

      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        mockBlueprint
      );
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);
      mockAnatomySocketIndex.findEntityWithSocket.mockResolvedValue(null);

      const mapping = { blueprintSlots: ['target'] };
      await strategy.resolve('actor123', mapping);

      // Should call getConnectedParts multiple times during traversal
      expect(mockBodyGraph.getConnectedParts).toHaveBeenCalled();
    });

    it('should handle findEntityBySlotType when no type specified', async () => {
      const mockBlueprint = {
        slots: {
          no_type_slot: { socket: 'no_type_socket' }, // No type property
        },
      };

      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'human_base',
      });

      const mockBodyGraph = {
        getConnectedParts: jest.fn().mockReturnValue(['entity1']),
      };

      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        mockBlueprint
      );
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);
      mockAnatomySocketIndex.findEntityWithSocket.mockResolvedValue(null);

      const mapping = { blueprintSlots: ['no_type_slot'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result).toEqual([]);
      // getConnectedParts should NOT be called when slot has no type
      expect(mockBodyGraph.getConnectedParts).not.toHaveBeenCalled();
    });

    it('should handle findEntityBySlotType when entity has no joint component', async () => {
      const mockBlueprint = {
        slots: {
          typed_slot: { type: 'some_type', socket: 'typed_socket' },
        },
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'anatomy:body') {
            return Promise.resolve({ recipeId: 'human_base' });
          }
          if (componentType === 'anatomy:joint') {
            throw new Error('No joint component');
          }
          return Promise.resolve(null);
        }
      );

      const mockBodyGraph = {
        getConnectedParts: jest.fn().mockReturnValue(['bad_entity']),
      };

      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        mockBlueprint
      );
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);
      mockAnatomySocketIndex.findEntityWithSocket.mockResolvedValue(null);

      const mapping = { blueprintSlots: ['typed_slot'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result).toEqual([]);
    });

    it('should handle async getComponentData in findEntityBySlotType', async () => {
      const mockBlueprint = {
        slots: {
          async_slot: { type: 'async_type', socket: 'async_socket' },
        },
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'anatomy:body') {
            return Promise.resolve({ recipeId: 'human_base' });
          }
          if (componentType === 'anatomy:joint') {
            // Return a Promise that resolves to joint data
            return Promise.resolve(
              Promise.resolve({ parentEntityId: 'async_parent' })
            );
          }
          if (componentType === 'anatomy:sockets') {
            return Promise.resolve({
              sockets: [{ id: 'async_socket', orientation: 'neutral' }],
            });
          }
          return Promise.resolve(null);
        }
      );

      const mockBodyGraph = {
        getConnectedParts: jest.fn().mockReturnValue(['async_entity']),
      };

      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        mockBlueprint
      );
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);
      mockAnatomySocketIndex.findEntityWithSocket.mockResolvedValue(null);

      const mapping = { blueprintSlots: ['async_slot'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result).toHaveLength(1);
      expect(result[0].entityId).toBe('async_entity');
    });

    it('should await promise-like joint data returned from entity manager', async () => {
      const mockBlueprint = {
        slots: {
          promise_slot: { type: 'promise_type', socket: 'promise_socket' },
        },
      };

      const fakePromise = Object.create(Promise.prototype);
      fakePromise.then = undefined;
      fakePromise.parentEntityId = 'promise_parent';

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'anatomy:body') {
            return Promise.resolve({ recipeId: 'human_base' });
          }
          if (componentType === 'anatomy:joint') {
            return fakePromise;
          }
          if (componentType === 'anatomy:sockets') {
            return Promise.resolve({
              sockets: [{ id: 'promise_socket', orientation: 'neutral' }],
            });
          }
          return Promise.resolve(null);
        }
      );

      const mockBodyGraph = {
        getConnectedParts: jest.fn().mockReturnValue(['promise_entity']),
      };

      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        mockBlueprint
      );
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);
      mockAnatomySocketIndex.findEntityWithSocket.mockResolvedValue(null);

      const mapping = { blueprintSlots: ['promise_slot'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result).toHaveLength(1);
      expect(result[0].entityId).toBe('promise_entity');
    });

    it('should handle missing intermediate slots in path', async () => {
      const mockBlueprint = {
        slots: {
          existing_slot: { type: 'existing' },
          // missing_intermediate is not defined
          target_slot: {
            type: 'target',
            socket: 'target_socket',
            parent: 'missing_intermediate',
          },
        },
      };

      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'human_base',
      });

      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        mockBlueprint
      );
      mockBodyGraphService.getBodyGraph.mockResolvedValue({
        getConnectedParts: jest.fn().mockReturnValue([]),
      });
      mockAnatomySocketIndex.findEntityWithSocket.mockResolvedValue(null);

      const mapping = { blueprintSlots: ['target_slot'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Blueprint slot 'missing_intermediate' not found in path"
      );
    });

    it('should handle missing entity for intermediate slot', async () => {
      const mockBlueprint = {
        slots: {
          intermediate: { type: 'intermediate' },
          target_slot: {
            type: 'target',
            socket: 'target_socket',
            parent: 'intermediate',
          },
        },
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'anatomy:body') {
            return Promise.resolve({ recipeId: 'human_base' });
          }
          return Promise.resolve(null);
        }
      );

      const mockBodyGraph = {
        getConnectedParts: jest.fn().mockReturnValue([]), // No connected parts
      };

      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        mockBlueprint
      );
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);
      mockAnatomySocketIndex.findEntityWithSocket.mockResolvedValue(null);

      const mapping = { blueprintSlots: ['target_slot'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "No entity found for intermediate slot 'intermediate'"
      );
    });

    it('should continue searching when joint type does not match blueprint slot', async () => {
      const mockBlueprint = {
        slots: {
          unmatched_slot: { type: 'unmatched_type', socket: 'unmatched_socket' },
        },
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'anatomy:body') {
            return Promise.resolve({ recipeId: 'human_base' });
          }
          if (componentType === 'anatomy:joint') {
            return { unrelated: true };
          }
          if (componentType === 'anatomy:sockets') {
            if (entityId === 'fallback_entity') {
              return Promise.resolve({
                sockets: [
                  { id: 'unmatched_socket', orientation: 'neutral' },
                ],
              });
            }
            return Promise.resolve({ sockets: [] });
          }
          return Promise.resolve(null);
        }
      );

      const mockBodyGraph = {
        getConnectedParts: jest.fn().mockReturnValue(['candidate_entity']),
      };

      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        mockBlueprint
      );
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);
      mockAnatomySocketIndex.findEntityWithSocket.mockResolvedValue(
        'fallback_entity'
      );

      const mapping = { blueprintSlots: ['unmatched_slot'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result).toHaveLength(1);
      expect(result[0].entityId).toBe('fallback_entity');
      expect(mockAnatomySocketIndex.findEntityWithSocket).toHaveBeenCalledWith(
        'actor123',
        'unmatched_socket'
      );
    });

    it('should successfully traverse slot path and return final entity (covers line 280)', async () => {
      const mockBlueprint = {
        slots: {
          root: { type: 'root', parent: null },
          // This is an intermediate slot, not the final one
          intermediate: { type: 'intermediate', parent: 'root' },
        },
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'anatomy:body') {
            return Promise.resolve({ recipeId: 'human_base' });
          }
          if (componentType === 'anatomy:joint') {
            return Promise.resolve({ parentEntityId: 'parent_123' });
          }
          return Promise.resolve(null);
        }
      );

      const mockBodyGraph = {
        getConnectedParts: jest.fn().mockImplementation((entityId) => {
          if (entityId === 'actor123') return ['root_entity'];
          if (entityId === 'root_entity') return ['intermediate_entity'];
          return [];
        }),
      };

      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        mockBlueprint
      );
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);
      mockAnatomySocketIndex.findEntityWithSocket.mockResolvedValue(null);

      const mapping = { blueprintSlots: ['intermediate'] };
      await strategy.resolve('actor123', mapping);

      // This test exercises the slot path traversal that reaches line 280 (return currentEntity)
      expect(mockBodyGraph.getConnectedParts).toHaveBeenCalledWith('actor123');
      expect(mockBodyGraph.getConnectedParts).toHaveBeenCalledWith(
        'root_entity'
      );
    });

    it('should handle slot with undefined blueprint definition', async () => {
      const mockBlueprint = {
        slots: {
          undefined_slot: undefined, // Slot exists but is undefined
        },
      };

      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'human_base',
      });
      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        mockBlueprint
      );
      mockBodyGraphService.getBodyGraph.mockResolvedValue({
        getConnectedParts: jest.fn().mockReturnValue([]),
      });
      mockAnatomySocketIndex.findEntityWithSocket.mockResolvedValue(null);

      const mapping = { blueprintSlots: ['undefined_slot'] };
      const result = await strategy.resolve('actor123', mapping);

      // Should return empty array and handle gracefully
      expect(result).toEqual([]);
    });
  });

  describe('socket data handling', () => {
    it('should handle missing socket component gracefully', async () => {
      const mockBlueprint = {
        slots: {
          test_slot: { socket: 'test_socket' },
        },
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'anatomy:body') {
            return Promise.resolve({ recipeId: 'human_base' });
          }
          if (componentType === 'anatomy:sockets') {
            return Promise.resolve(null); // No sockets component
          }
          return Promise.resolve(null);
        }
      );

      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        mockBlueprint
      );
      mockBodyGraphService.getBodyGraph.mockResolvedValue({
        getConnectedParts: jest.fn().mockReturnValue([]),
      });
      mockAnatomySocketIndex.findEntityWithSocket.mockResolvedValue(
        'socket_entity'
      );

      const mapping = { blueprintSlots: ['test_slot'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result).toHaveLength(1);
      expect(result[0].orientation).toBe('neutral'); // Default orientation
    });

    it('should handle socket component without sockets array', async () => {
      const mockBlueprint = {
        slots: {
          test_slot: { socket: 'test_socket' },
        },
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'anatomy:body') {
            return Promise.resolve({ recipeId: 'human_base' });
          }
          if (componentType === 'anatomy:sockets') {
            return Promise.resolve({}); // Empty component
          }
          return Promise.resolve(null);
        }
      );

      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        mockBlueprint
      );
      mockBodyGraphService.getBodyGraph.mockResolvedValue({
        getConnectedParts: jest.fn().mockReturnValue([]),
      });
      mockAnatomySocketIndex.findEntityWithSocket.mockResolvedValue(
        'socket_entity'
      );

      const mapping = { blueprintSlots: ['test_slot'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result).toHaveLength(1);
      expect(result[0].orientation).toBe('neutral');
    });

    it('should find correct socket in sockets array', async () => {
      const mockBlueprint = {
        slots: {
          multi_socket_slot: { socket: 'socket_b' },
        },
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'anatomy:body') {
            return Promise.resolve({ recipeId: 'human_base' });
          }
          if (componentType === 'anatomy:sockets') {
            return Promise.resolve({
              sockets: [
                { id: 'socket_a', orientation: 'left' },
                { id: 'socket_b', orientation: 'right' },
                { id: 'socket_c', orientation: 'neutral' },
              ],
            });
          }
          return Promise.resolve(null);
        }
      );

      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        mockBlueprint
      );
      mockBodyGraphService.getBodyGraph.mockResolvedValue({
        getConnectedParts: jest.fn().mockReturnValue([]),
      });
      mockAnatomySocketIndex.findEntityWithSocket.mockResolvedValue(
        'multi_socket_entity'
      );

      const mapping = { blueprintSlots: ['multi_socket_slot'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result).toHaveLength(1);
      expect(result[0].orientation).toBe('right');
      expect(result[0].socketId).toBe('socket_b');
    });
  });

  describe('body graph integration', () => {
    it('should handle missing getConnectedParts method on body graph', async () => {
      const mockBlueprint = {
        slots: {
          graph_slot: { type: 'graph_type', socket: 'graph_socket' },
        },
      };

      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'human_base',
      });

      const mockBodyGraph = {}; // No getConnectedParts method

      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        mockBlueprint
      );
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);
      mockAnatomySocketIndex.findEntityWithSocket.mockResolvedValue(null);

      const mapping = { blueprintSlots: ['graph_slot'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result).toEqual([]);
    });
  });

  describe('blueprint retrieval edge cases', () => {
    it('should handle blueprint repository errors', async () => {
      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'human_base',
      });
      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockRejectedValue(
        new Error('Blueprint repository error')
      );

      const mapping = { blueprintSlots: ['test_slot'] };

      await expect(strategy.resolve('actor123', mapping)).rejects.toThrow(
        'Blueprint repository error'
      );
    });

    it('should handle null blueprint from repository', async () => {
      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'human_base',
      });
      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        null
      );

      const mapping = { blueprintSlots: ['test_slot'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No blueprint found for entity actor123'
      );
    });
  });

  describe('entity manager edge cases', () => {
    it('should handle entity manager errors for body component', async () => {
      mockEntityManager.getComponentData.mockRejectedValue(
        new Error('Entity manager error')
      );

      const mapping = { blueprintSlots: ['test_slot'] };

      await expect(strategy.resolve('actor123', mapping)).rejects.toThrow(
        'Entity manager error'
      );
    });
  });
});
