/**
 * @file Unit tests for AnatomySocketIndex service
 * @see src/anatomy/services/anatomySocketIndex.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AnatomySocketIndex from '../../../../src/anatomy/services/anatomySocketIndex.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

describe('AnatomySocketIndex', () => {
  let service;
  let mockLogger;
  let mockEntityManager;
  let mockBodyGraphService;
  let mockBodyGraph;

  beforeEach(() => {
    mockLogger = createMockLogger();

    // Create mock entity manager
    mockEntityManager = {
      getComponentData: jest.fn(),
      getEntitiesWithComponent: jest.fn(),
    };

    // Create mock body graph
    mockBodyGraph = {
      getAllPartIds: jest.fn(),
    };

    // Create mock body graph service
    mockBodyGraphService = {
      getBodyGraph: jest.fn().mockResolvedValue(mockBodyGraph),
    };

    service = new AnatomySocketIndex({
      logger: mockLogger,
      entityManager: mockEntityManager,
      bodyGraphService: mockBodyGraphService,
    });
  });

  describe('constructor', () => {
    it('should initialize with required dependencies', () => {
      expect(service).toBeDefined();
    });

    it('should validate entityManager has required methods', () => {
      expect(() => {
        new AnatomySocketIndex({
          logger: mockLogger,
          entityManager: {},
          bodyGraphService: mockBodyGraphService,
        });
      }).toThrow();
    });

    it('should validate bodyGraphService has required methods', () => {
      expect(() => {
        new AnatomySocketIndex({
          logger: mockLogger,
          entityManager: mockEntityManager,
          bodyGraphService: {},
        });
      }).toThrow();
    });
  });

  describe('buildIndex', () => {
    it('should validate rootEntityId parameter', async () => {
      await expect(service.buildIndex('')).rejects.toThrow('rootEntityId');
      await expect(service.buildIndex(null)).rejects.toThrow('rootEntityId');
      await expect(service.buildIndex(undefined)).rejects.toThrow(
        'rootEntityId'
      );
    });

    it('should build index for root entity with no parts', async () => {
      mockBodyGraph.getAllPartIds.mockReturnValue([]);
      mockEntityManager.getComponentData.mockResolvedValue({
        sockets: [
          { id: 'socket1', orientation: 'neutral' },
          { id: 'socket2', orientation: 'left' },
        ],
      });

      await service.buildIndex('root1');

      expect(mockBodyGraphService.getBodyGraph).toHaveBeenCalledWith('root1');
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'root1',
        'anatomy:sockets'
      );
    });

    it('should build index for root entity with child parts', async () => {
      mockBodyGraph.getAllPartIds.mockReturnValue(['part1', 'part2']);

      // Mock responses for each entity
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'anatomy:sockets') {
            if (entityId === 'root1') {
              return Promise.resolve({
                sockets: [{ id: 'root_socket', orientation: 'neutral' }],
              });
            }
            if (entityId === 'part1') {
              return Promise.resolve({
                sockets: [{ id: 'part1_socket', orientation: 'left' }],
              });
            }
            if (entityId === 'part2') {
              return Promise.resolve({
                sockets: [{ id: 'part2_socket', orientation: 'right' }],
              });
            }
          }
          return Promise.resolve(null);
        }
      );

      await service.buildIndex('root1');

      expect(mockEntityManager.getComponentData).toHaveBeenCalledTimes(3);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'root1',
        'anatomy:sockets'
      );
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'part1',
        'anatomy:sockets'
      );
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'part2',
        'anatomy:sockets'
      );
    });

    it('should handle entities without socket components', async () => {
      mockBodyGraph.getAllPartIds.mockReturnValue(['part1', 'part2']);

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'anatomy:sockets') {
            if (entityId === 'root1') {
              return Promise.resolve({
                sockets: [{ id: 'root_socket', orientation: 'neutral' }],
              });
            }
            // part1 and part2 have no socket components
            return Promise.resolve(null);
          }
          return Promise.resolve(null);
        }
      );

      await service.buildIndex('root1');

      expect(mockEntityManager.getComponentData).toHaveBeenCalledTimes(3);
      // Should not throw error for entities without sockets
    });

    it('should handle parallel socket collection with failures', async () => {
      mockBodyGraph.getAllPartIds.mockReturnValue(['part1', 'part2']);

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'anatomy:sockets') {
            if (entityId === 'root1') {
              return Promise.resolve({
                sockets: [{ id: 'root_socket', orientation: 'neutral' }],
              });
            }
            if (entityId === 'part1') {
              return Promise.reject(new Error('Component access failed'));
            }
            if (entityId === 'part2') {
              return Promise.resolve({
                sockets: [{ id: 'part2_socket', orientation: 'right' }],
              });
            }
          }
          return Promise.resolve(null);
        }
      );

      await service.buildIndex('root1');

      expect(mockEntityManager.getComponentData).toHaveBeenCalledTimes(3);
      // Should handle failures gracefully
    });

    it('should log and rethrow errors when index building fails', async () => {
      const failure = new Error('Graph unavailable');
      mockBodyGraphService.getBodyGraph.mockRejectedValue(failure);

      await expect(service.buildIndex('root1')).rejects.toThrow('Graph unavailable');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to build socket index for root entity root1'),
        failure
      );
    });

    it('should clear existing index before rebuilding', async () => {
      mockBodyGraph.getAllPartIds.mockReturnValue([]);
      mockEntityManager.getComponentData.mockResolvedValue({
        sockets: [{ id: 'socket1', orientation: 'neutral' }],
      });

      // Build index twice to test clearing
      await service.buildIndex('root1');
      await service.buildIndex('root1');

      expect(mockBodyGraphService.getBodyGraph).toHaveBeenCalledTimes(2);
    });
  });

  describe('findEntityWithSocket', () => {
    beforeEach(async () => {
      // Setup a basic index
      mockBodyGraph.getAllPartIds.mockReturnValue(['part1', 'part2']);
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'anatomy:sockets') {
            if (entityId === 'root1') {
              return Promise.resolve({
                sockets: [{ id: 'root_socket', orientation: 'neutral' }],
              });
            }
            if (entityId === 'part1') {
              return Promise.resolve({
                sockets: [{ id: 'part1_socket', orientation: 'left' }],
              });
            }
            if (entityId === 'part2') {
              return Promise.resolve({
                sockets: [{ id: 'part2_socket', orientation: 'right' }],
              });
            }
          }
          return Promise.resolve(null);
        }
      );

      await service.buildIndex('root1');
    });

    it('should validate parameters', async () => {
      await expect(service.findEntityWithSocket('', 'socket1')).rejects.toThrow(
        'rootEntityId'
      );
      await expect(service.findEntityWithSocket('root1', '')).rejects.toThrow(
        'socketId'
      );
      await expect(
        service.findEntityWithSocket(null, 'socket1')
      ).rejects.toThrow('rootEntityId');
      await expect(service.findEntityWithSocket('root1', null)).rejects.toThrow(
        'socketId'
      );
    });

    it('should find socket in root entity', async () => {
      const result = await service.findEntityWithSocket('root1', 'root_socket');
      expect(result).toBe('root1');
    });

    it('should find socket in child entity', async () => {
      const result = await service.findEntityWithSocket(
        'root1',
        'part1_socket'
      );
      expect(result).toBe('part1');
    });

    it('should return null for non-existent socket', async () => {
      const result = await service.findEntityWithSocket(
        'root1',
        'non_existent_socket'
      );
      expect(result).toBeNull();
    });

    it('should return null for socket not in hierarchy', async () => {
      // Build separate index
      mockBodyGraph.getAllPartIds.mockReturnValue([]);
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'anatomy:sockets' && entityId === 'root2') {
            return Promise.resolve({
              sockets: [{ id: 'root2_socket', orientation: 'neutral' }],
            });
          }
          return Promise.resolve(null);
        }
      );

      await service.buildIndex('root2');

      // Try to find socket from root1 hierarchy in root2
      const result = await service.findEntityWithSocket('root2', 'root_socket');
      expect(result).toBeNull();
    });

    it('should build index if not present', async () => {
      // Create new service instance without pre-built index
      const newService = new AnatomySocketIndex({
        logger: mockLogger,
        entityManager: mockEntityManager,
        bodyGraphService: mockBodyGraphService,
      });

      const result = await newService.findEntityWithSocket(
        'root1',
        'root_socket'
      );
      expect(result).toBe('root1');
      expect(mockBodyGraphService.getBodyGraph).toHaveBeenCalledWith('root1');
    });
  });

  describe('getEntitySockets', () => {
    beforeEach(async () => {
      // Setup a basic index
      mockBodyGraph.getAllPartIds.mockReturnValue(['part1']);
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'anatomy:sockets') {
            if (entityId === 'root1') {
              return Promise.resolve({
                sockets: [
                  { id: 'root_socket1', orientation: 'neutral' },
                  { id: 'root_socket2', orientation: 'up' },
                ],
              });
            }
            if (entityId === 'part1') {
              return Promise.resolve({
                sockets: [{ id: 'part1_socket', orientation: 'left' }],
              });
            }
          }
          return Promise.resolve(null);
        }
      );

      await service.buildIndex('root1');
    });

    it('should validate entityId parameter', async () => {
      await expect(service.getEntitySockets('')).rejects.toThrow('entityId');
      await expect(service.getEntitySockets(null)).rejects.toThrow('entityId');
      await expect(service.getEntitySockets(undefined)).rejects.toThrow(
        'entityId'
      );
    });

    it('should return sockets for cached entity', async () => {
      const result = await service.getEntitySockets('root1');
      expect(result).toEqual([
        { id: 'root_socket1', orientation: 'neutral' },
        { id: 'root_socket2', orientation: 'up' },
      ]);
    });

    it('should return empty array for entity without sockets', async () => {
      const result = await service.getEntitySockets('non_existent_entity');
      expect(result).toEqual([]);
    });

    it('should fetch sockets directly if not in cache', async () => {
      // Create new service instance without pre-built index
      const newService = new AnatomySocketIndex({
        logger: mockLogger,
        entityManager: mockEntityManager,
        bodyGraphService: mockBodyGraphService,
      });

      const result = await newService.getEntitySockets('root1');
      expect(result).toEqual([
        { id: 'root_socket1', orientation: 'neutral' },
        { id: 'root_socket2', orientation: 'up' },
      ]);
    });

    it('should handle missing orientation gracefully', async () => {
      mockEntityManager.getComponentData.mockResolvedValue({
        sockets: [{ id: 'socket_no_orientation' }],
      });

      const result = await service.getEntitySockets('test_entity');
      expect(result).toEqual([
        { id: 'socket_no_orientation', orientation: 'neutral' },
      ]);
    });
  });

  describe('getEntitiesWithSockets', () => {
    beforeEach(async () => {
      // Setup a basic index
      mockBodyGraph.getAllPartIds.mockReturnValue(['part1', 'part2']);
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'anatomy:sockets') {
            if (entityId === 'root1') {
              return Promise.resolve({
                sockets: [{ id: 'root_socket', orientation: 'neutral' }],
              });
            }
            if (entityId === 'part1') {
              return Promise.resolve({
                sockets: [{ id: 'part1_socket', orientation: 'left' }],
              });
            }
            // part2 has no sockets
            return Promise.resolve(null);
          }
          return Promise.resolve(null);
        }
      );

      await service.buildIndex('root1');
    });

    it('should validate rootEntityId parameter', async () => {
      await expect(service.getEntitiesWithSockets('')).rejects.toThrow(
        'rootEntityId'
      );
      await expect(service.getEntitiesWithSockets(null)).rejects.toThrow(
        'rootEntityId'
      );
      await expect(service.getEntitiesWithSockets(undefined)).rejects.toThrow(
        'rootEntityId'
      );
    });

    it('should return entities that have sockets', async () => {
      const result = await service.getEntitiesWithSockets('root1');
      expect(result).toEqual(expect.arrayContaining(['root1', 'part1']));
      expect(result).toHaveLength(2);
      expect(result).not.toContain('part2'); // part2 has no sockets
    });

    it('should return empty array for non-existent root entity', async () => {
      // Mock the body graph service to return empty parts for non-existent root
      mockBodyGraphService.getBodyGraph.mockResolvedValue({
        getAllPartIds: () => [],
      });

      // Mock entity manager to return no sockets for non-existent root
      mockEntityManager.getComponentData.mockResolvedValue(null);

      const result = await service.getEntitiesWithSockets('non_existent_root');
      expect(result).toEqual([]);
    });

    it('should build index if not present', async () => {
      // Create new service instance without pre-built index
      const newService = new AnatomySocketIndex({
        logger: mockLogger,
        entityManager: mockEntityManager,
        bodyGraphService: mockBodyGraphService,
      });

      const result = await newService.getEntitiesWithSockets('root1');
      expect(result).toEqual(expect.arrayContaining(['root1', 'part1']));
      expect(mockBodyGraphService.getBodyGraph).toHaveBeenCalledWith('root1');
    });

    it('should return empty array when index build does not populate cache', async () => {
      const isolatedLogger = createMockLogger();
      const isolatedEntityManager = {
        getComponentData: jest.fn(),
        getEntitiesWithComponent: jest.fn(),
      };
      const isolatedBodyGraphService = {
        getBodyGraph: jest.fn(),
      };

      const newService = new AnatomySocketIndex({
        logger: isolatedLogger,
        entityManager: isolatedEntityManager,
        bodyGraphService: isolatedBodyGraphService,
      });

      const buildIndexSpy = jest
        .spyOn(newService, 'buildIndex')
        .mockImplementation(async () => {});

      const result = await newService.getEntitiesWithSockets('root1');

      expect(buildIndexSpy).toHaveBeenCalledWith('root1');
      expect(result).toEqual([]);
      expect(isolatedBodyGraphService.getBodyGraph).not.toHaveBeenCalled();

      buildIndexSpy.mockRestore();
    });
  });

  describe('invalidateIndex', () => {
    beforeEach(async () => {
      // Setup a basic index
      mockBodyGraph.getAllPartIds.mockReturnValue(['part1']);
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'anatomy:sockets') {
            if (entityId === 'root1') {
              return Promise.resolve({
                sockets: [{ id: 'root_socket', orientation: 'neutral' }],
              });
            }
            if (entityId === 'part1') {
              return Promise.resolve({
                sockets: [{ id: 'part1_socket', orientation: 'left' }],
              });
            }
          }
          return Promise.resolve(null);
        }
      );

      await service.buildIndex('root1');
    });

    it('should validate rootEntityId parameter', () => {
      expect(() => service.invalidateIndex('')).toThrow('rootEntityId');
      expect(() => service.invalidateIndex(null)).toThrow('rootEntityId');
      expect(() => service.invalidateIndex(undefined)).toThrow('rootEntityId');
    });

    it('should invalidate index for specific root entity', async () => {
      // Verify index works before invalidation
      let result = await service.findEntityWithSocket('root1', 'root_socket');
      expect(result).toBe('root1');

      // Invalidate index
      service.invalidateIndex('root1');

      // Should rebuild index when queried again
      result = await service.findEntityWithSocket('root1', 'root_socket');
      expect(result).toBe('root1');
      expect(mockBodyGraphService.getBodyGraph).toHaveBeenCalledTimes(2); // Once for build, once for rebuild
    });

    it('should handle invalidation of non-existent root entity', () => {
      expect(() => service.invalidateIndex('non_existent_root')).not.toThrow();
    });
  });

  describe('clearCache', () => {
    beforeEach(async () => {
      // Setup a basic index
      mockBodyGraph.getAllPartIds.mockReturnValue(['part1']);
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'anatomy:sockets') {
            if (entityId === 'root1') {
              return Promise.resolve({
                sockets: [{ id: 'root_socket', orientation: 'neutral' }],
              });
            }
            if (entityId === 'part1') {
              return Promise.resolve({
                sockets: [{ id: 'part1_socket', orientation: 'left' }],
              });
            }
          }
          return Promise.resolve(null);
        }
      );

      await service.buildIndex('root1');
    });

    it('should clear all cached indexes', async () => {
      // Verify index works before clearing
      let result = await service.findEntityWithSocket('root1', 'root_socket');
      expect(result).toBe('root1');

      // Clear all caches
      service.clearCache();

      // Should rebuild index when queried again
      result = await service.findEntityWithSocket('root1', 'root_socket');
      expect(result).toBe('root1');
      expect(mockBodyGraphService.getBodyGraph).toHaveBeenCalledTimes(2); // Once for build, once for rebuild
    });
  });

  describe('O(1) performance characteristics', () => {
    it('should provide O(1) socket lookup after index is built', async () => {
      // Setup large hierarchy
      const largeParts = Array.from({ length: 1000 }, (_, i) => `part${i}`);
      mockBodyGraph.getAllPartIds.mockReturnValue(largeParts);

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'anatomy:sockets') {
            if (entityId === 'root1') {
              return Promise.resolve({
                sockets: [{ id: 'root_socket', orientation: 'neutral' }],
              });
            }
            if (entityId.startsWith('part')) {
              const partNum = entityId.replace('part', '');
              return Promise.resolve({
                sockets: [{ id: `socket${partNum}`, orientation: 'neutral' }],
              });
            }
          }
          return Promise.resolve(null);
        }
      );

      await service.buildIndex('root1');

      // Multiple lookups should be fast (O(1)) without additional entity manager calls
      const initialCallCount =
        mockEntityManager.getComponentData.mock.calls.length;

      const result1 = await service.findEntityWithSocket('root1', 'socket500');
      const result2 = await service.findEntityWithSocket('root1', 'socket999');
      const result3 = await service.findEntityWithSocket(
        'root1',
        'root_socket'
      );

      expect(result1).toBe('part500');
      expect(result2).toBe('part999');
      expect(result3).toBe('root1');

      // Should not make additional entity manager calls for cached lookups
      expect(mockEntityManager.getComponentData.mock.calls.length).toBe(
        initialCallCount
      );
    });
  });
});
