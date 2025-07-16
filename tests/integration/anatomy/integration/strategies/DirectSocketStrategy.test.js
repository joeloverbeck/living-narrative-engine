/**
 * @file Unit tests for DirectSocketStrategy class
 * @see src/anatomy/integration/strategies/DirectSocketStrategy.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import DirectSocketStrategy from '../../../../../src/anatomy/integration/strategies/DirectSocketStrategy.js';

describe('DirectSocketStrategy', () => {
  let strategy;
  let mockLogger;
  let mockEntityManager;
  let mockBodyGraphService;

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

    strategy = new DirectSocketStrategy({
      logger: mockLogger,
      entityManager: mockEntityManager,
      bodyGraphService: mockBodyGraphService,
    });
  });

  describe('constructor', () => {
    it('should initialize with all required dependencies', () => {
      expect(strategy).toBeDefined();
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should validate required dependencies', () => {
      expect(() => {
        new DirectSocketStrategy({
          logger: mockLogger,
          // Missing entityManager
          bodyGraphService: mockBodyGraphService,
        });
      }).toThrow();
    });

    it('should validate bodyGraphService dependency', () => {
      expect(() => {
        new DirectSocketStrategy({
          logger: mockLogger,
          entityManager: mockEntityManager,
          // Missing bodyGraphService
        });
      }).toThrow();
    });
  });

  describe('canResolve', () => {
    it('should return true for mapping with anatomySockets array', () => {
      const mapping = { anatomySockets: ['vagina', 'pubic_hair'] };
      expect(strategy.canResolve(mapping)).toBe(true);
    });

    it('should return false for null mapping', () => {
      expect(strategy.canResolve(null)).toBe(false);
    });

    it('should return false for undefined mapping', () => {
      expect(strategy.canResolve(undefined)).toBe(false);
    });

    it('should return false for mapping without anatomySockets', () => {
      const mapping = { blueprintSlots: ['left_breast'] };
      expect(strategy.canResolve(mapping)).toBe(false);
    });

    it('should return false for mapping with non-array anatomySockets', () => {
      const mapping = { anatomySockets: 'not-an-array' };
      expect(strategy.canResolve(mapping)).toBe(false);
    });

    it('should return true for mapping with empty anatomySockets', () => {
      const mapping = { anatomySockets: [] };
      expect(strategy.canResolve(mapping)).toBe(true);
    });
  });

  describe('resolve', () => {
    const mockBodyGraph = {
      getAllPartIds: jest.fn(),
    };

    beforeEach(() => {
      mockBodyGraphService.getBodyGraph.mockResolvedValue(mockBodyGraph);
      mockBodyGraph.getAllPartIds.mockReturnValue(['part1', 'part2', 'part3']);
    });

    it('should return empty array for non-resolvable mapping', async () => {
      const mapping = { blueprintSlots: ['left_breast'] };
      const result = await strategy.resolve('actor123', mapping);
      expect(result).toEqual([]);
    });

    it('should resolve direct socket references from body parts', async () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (entityId === 'part1' && componentType === 'anatomy:sockets') {
            return Promise.resolve({
              sockets: [
                { id: 'vagina', orientation: 'neutral' },
                { id: 'pubic_hair', orientation: 'neutral' },
              ],
            });
          }
          if (entityId === 'part2' && componentType === 'anatomy:sockets') {
            return Promise.resolve({
              sockets: [{ id: 'chest', orientation: 'neutral' }],
            });
          }
          return Promise.resolve(null);
        }
      );

      const mapping = { anatomySockets: ['vagina', 'chest'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        entityId: 'part1',
        socketId: 'vagina',
        slotPath: 'direct',
        orientation: 'neutral',
      });
      expect(result[1]).toEqual({
        entityId: 'part2',
        socketId: 'chest',
        slotPath: 'direct',
        orientation: 'neutral',
      });
    });

    it('should use default orientation when socket has no orientation', async () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (entityId === 'part1' && componentType === 'anatomy:sockets') {
            return Promise.resolve({
              sockets: [
                { id: 'vagina' }, // No orientation property
              ],
            });
          }
          return Promise.resolve(null);
        }
      );

      const mapping = { anatomySockets: ['vagina'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result).toHaveLength(1);
      expect(result[0].orientation).toBe('neutral');
    });

    it('should skip parts with no sockets component', async () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (entityId === 'part1' && componentType === 'anatomy:sockets') {
            return Promise.resolve(null);
          }
          if (entityId === 'part2' && componentType === 'anatomy:sockets') {
            return Promise.resolve({
              sockets: [{ id: 'chest', orientation: 'neutral' }],
            });
          }
          return Promise.resolve(null);
        }
      );

      const mapping = { anatomySockets: ['chest'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result).toHaveLength(1);
      expect(result[0].entityId).toBe('part2');
    });

    it('should skip parts with empty sockets array', async () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (entityId === 'part1' && componentType === 'anatomy:sockets') {
            return Promise.resolve({ sockets: [] });
          }
          if (entityId === 'part2' && componentType === 'anatomy:sockets') {
            return Promise.resolve({
              sockets: [{ id: 'chest', orientation: 'neutral' }],
            });
          }
          return Promise.resolve(null);
        }
      );

      const mapping = { anatomySockets: ['chest'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result).toHaveLength(1);
      expect(result[0].entityId).toBe('part2');
    });

    it('should fall back to root entity when no body parts have sockets', async () => {
      // Mock body parts with no matching sockets
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (entityId === 'actor123' && componentType === 'anatomy:sockets') {
            return Promise.resolve({
              sockets: [{ id: 'root_socket', orientation: 'neutral' }],
            });
          }
          return Promise.resolve(null);
        }
      );

      const mapping = { anatomySockets: ['root_socket'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        entityId: 'actor123',
        socketId: 'root_socket',
        slotPath: 'direct',
        orientation: 'neutral',
      });
    });

    it('should handle root entity with no sockets component', async () => {
      // Mock all entities with no sockets
      mockEntityManager.getComponentData.mockResolvedValue(null);

      const mapping = { anatomySockets: ['nonexistent'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result).toEqual([]);
    });

    it('should handle root entity with empty sockets array', async () => {
      // Mock body parts with no matching sockets
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (entityId === 'actor123' && componentType === 'anatomy:sockets') {
            return Promise.resolve({ sockets: [] });
          }
          return Promise.resolve(null);
        }
      );

      const mapping = { anatomySockets: ['nonexistent'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result).toEqual([]);
    });

    it('should handle root entity with no matching sockets', async () => {
      // Mock body parts with no matching sockets
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (entityId === 'actor123' && componentType === 'anatomy:sockets') {
            return Promise.resolve({
              sockets: [{ id: 'different_socket', orientation: 'neutral' }],
            });
          }
          return Promise.resolve(null);
        }
      );

      const mapping = { anatomySockets: ['nonexistent'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result).toEqual([]);
    });

    it('should handle multiple sockets from same part', async () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (entityId === 'part1' && componentType === 'anatomy:sockets') {
            return Promise.resolve({
              sockets: [
                { id: 'socket1', orientation: 'left' },
                { id: 'socket2', orientation: 'right' },
                { id: 'socket3', orientation: 'neutral' },
              ],
            });
          }
          return Promise.resolve(null);
        }
      );

      const mapping = { anatomySockets: ['socket1', 'socket2', 'socket3'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        entityId: 'part1',
        socketId: 'socket1',
        slotPath: 'direct',
        orientation: 'left',
      });
      expect(result[1]).toEqual({
        entityId: 'part1',
        socketId: 'socket2',
        slotPath: 'direct',
        orientation: 'right',
      });
      expect(result[2]).toEqual({
        entityId: 'part1',
        socketId: 'socket3',
        slotPath: 'direct',
        orientation: 'neutral',
      });
    });

    it('should not check root entity if body parts have matching sockets', async () => {
      const rootGetComponentData = jest.fn();

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (entityId === 'part1' && componentType === 'anatomy:sockets') {
            return Promise.resolve({
              sockets: [{ id: 'body_socket', orientation: 'neutral' }],
            });
          }
          if (entityId === 'actor123' && componentType === 'anatomy:sockets') {
            rootGetComponentData();
            return Promise.resolve({
              sockets: [{ id: 'root_socket', orientation: 'neutral' }],
            });
          }
          return Promise.resolve(null);
        }
      );

      const mapping = { anatomySockets: ['body_socket'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result).toHaveLength(1);
      expect(result[0].entityId).toBe('part1');
      expect(rootGetComponentData).not.toHaveBeenCalled();
    });

    it('should handle sockets component with no sockets property', async () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'anatomy:sockets') {
            return Promise.resolve({}); // No sockets property
          }
          return Promise.resolve(null);
        }
      );

      const mapping = { anatomySockets: ['any_socket'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result).toEqual([]);
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      mockBodyGraphService.getBodyGraph.mockResolvedValue({
        getAllPartIds: jest.fn().mockReturnValue(['part1']),
      });
    });

    it('should handle empty body parts list', async () => {
      mockBodyGraphService.getBodyGraph.mockResolvedValue({
        getAllPartIds: jest.fn().mockReturnValue([]),
      });

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (entityId === 'actor123' && componentType === 'anatomy:sockets') {
            return Promise.resolve({
              sockets: [{ id: 'root_socket', orientation: 'neutral' }],
            });
          }
          return Promise.resolve(null);
        }
      );

      const mapping = { anatomySockets: ['root_socket'] };
      const result = await strategy.resolve('actor123', mapping);

      expect(result).toHaveLength(1);
      expect(result[0].entityId).toBe('actor123');
    });

    it('should handle body graph service errors', async () => {
      mockBodyGraphService.getBodyGraph.mockRejectedValue(
        new Error('Body graph error')
      );

      const mapping = { anatomySockets: ['any_socket'] };

      await expect(strategy.resolve('actor123', mapping)).rejects.toThrow(
        'Body graph error'
      );
    });

    it('should handle entity manager errors', async () => {
      mockBodyGraphService.getBodyGraph.mockResolvedValue({
        getAllPartIds: jest.fn().mockReturnValue(['part1']),
      });

      mockEntityManager.getComponentData.mockRejectedValue(
        new Error('Entity manager error')
      );

      const mapping = { anatomySockets: ['any_socket'] };

      await expect(strategy.resolve('actor123', mapping)).rejects.toThrow(
        'Entity manager error'
      );
    });
  });
});
