/**
 * @file Unit tests for TaskLibraryConstructor
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import TaskLibraryConstructor from '../../../../src/goap/planner/taskLibraryConstructor.js';

describe('TaskLibraryConstructor', () => {
  let mockDataRegistry;
  let mockEntityManager;
  let mockContextAssembly;
  let mockJsonLogicService;
  let mockLogger;
  let constructor;

  beforeEach(() => {
    // Mock dependencies
    mockDataRegistry = {
      getAll: jest.fn(),
    };

    mockEntityManager = {
      getAllComponentTypesForEntity: jest.fn(),
    };

    mockContextAssembly = {
      assemblePlanningContext: jest.fn(),
    };

    mockJsonLogicService = {
      evaluate: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    constructor = new TaskLibraryConstructor({
      dataRegistry: mockDataRegistry,
      entityManager: mockEntityManager,
      contextAssembly: mockContextAssembly,
      jsonLogicService: mockJsonLogicService,
      logger: mockLogger,
    });
  });

  describe('Constructor Validation', () => {
    it('should validate dataRegistry dependency', () => {
      expect(() => {
        new TaskLibraryConstructor({
          dataRegistry: {},
          entityManager: mockEntityManager,
          contextAssembly: mockContextAssembly,
          jsonLogicService: mockJsonLogicService,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should validate entityManager dependency', () => {
      expect(() => {
        new TaskLibraryConstructor({
          dataRegistry: mockDataRegistry,
          entityManager: {},
          contextAssembly: mockContextAssembly,
          jsonLogicService: mockJsonLogicService,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should validate contextAssembly dependency', () => {
      expect(() => {
        new TaskLibraryConstructor({
          dataRegistry: mockDataRegistry,
          entityManager: mockEntityManager,
          contextAssembly: {},
          jsonLogicService: mockJsonLogicService,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should validate jsonLogicService dependency', () => {
      expect(() => {
        new TaskLibraryConstructor({
          dataRegistry: mockDataRegistry,
          entityManager: mockEntityManager,
          contextAssembly: mockContextAssembly,
          jsonLogicService: {},
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should validate logger dependency', () => {
      expect(() => {
        new TaskLibraryConstructor({
          dataRegistry: mockDataRegistry,
          entityManager: mockEntityManager,
          contextAssembly: mockContextAssembly,
          jsonLogicService: mockJsonLogicService,
          logger: {},
        });
      }).toThrow();
    });

    it('should create instance with valid dependencies', () => {
      expect(constructor).toBeInstanceOf(TaskLibraryConstructor);
    });
  });

  describe('constructLibrary - Input Validation', () => {
    it('should throw error for missing actorId', () => {
      expect(() => constructor.constructLibrary()).toThrow(
        'Actor ID must be a non-empty string'
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should throw error for empty actorId', () => {
      expect(() => constructor.constructLibrary('')).toThrow(
        'Actor ID must be a non-empty string'
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should throw error for non-string actorId', () => {
      expect(() => constructor.constructLibrary(123)).toThrow(
        'Actor ID must be a non-empty string'
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('constructLibrary - Cache Key Generation', () => {
    beforeEach(() => {
      mockDataRegistry.getAll.mockReturnValue([{ id: 'core' }]);
      mockDataRegistry.getAll.mockImplementation((key) => {
        if (key === 'tasks') return [];
        return [];
      });
    });

    it('should generate cache key from actor components (sorted)', () => {
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:hands',
        'core:digestive_system',
        'core:actor',
      ]);

      constructor.constructLibrary('actor-1');

      // Cache key should be actorId:sortedComponentIds
      const expectedKey = 'actor-1:core:actor|core:digestive_system|core:hands';
      const stats = constructor.getCacheStats();
      expect(stats.keys).toContain(expectedKey);
    });

    it('should generate different cache keys for different component sets', () => {
      mockEntityManager.getAllComponentTypesForEntity
        .mockReturnValueOnce(['core:hands', 'core:actor'])
        .mockReturnValueOnce(['core:digestive_system', 'core:actor']);

      constructor.constructLibrary('actor-1');
      const stats1 = constructor.getCacheStats();
      const key1 = stats1.keys[0];

      constructor.clearCache();

      constructor.constructLibrary('actor-1');
      const stats2 = constructor.getCacheStats();
      const key2 = stats2.keys[0];

      expect(key1).not.toEqual(key2);
    });

    it('should throw error for actor with no components', () => {
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([]);

      expect(() => constructor.constructLibrary('actor-1')).toThrow(
        'Actor not found or has no components'
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should throw error if actor not found', () => {
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(null);

      expect(() => constructor.constructLibrary('nonexistent')).toThrow(
        'Actor not found or has no components'
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('constructLibrary - Cache Management', () => {
    beforeEach(() => {
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:actor',
      ]);
      mockDataRegistry.getAll.mockImplementation((key) => {
        if (key === 'tasks')
          return [
            {
              id: 'core:test_task',
              structuralGates: {
                condition: { has_component: ['actor', 'core:hands'] },
              },
            },
          ];
        return [];
      });
      mockContextAssembly.assemblePlanningContext.mockReturnValue({
        actor: { components: { 'core:actor': {} } },
        world: {},
      });
      mockJsonLogicService.evaluate.mockReturnValue(true);
    });

    it('should cache library results', () => {
      const result1 = constructor.constructLibrary('actor-1');
      const result2 = constructor.constructLibrary('actor-1');

      expect(result1).toBe(result2); // Same reference
      expect(mockDataRegistry.getAll).toHaveBeenCalledTimes(1); // Only called once for tasks (cached on second call)
    });

    it('should return cached result on cache hit', () => {
      constructor.constructLibrary('actor-1');
      mockDataRegistry.getAll.mockClear();

      constructor.constructLibrary('actor-1');

      expect(mockDataRegistry.getAll).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Cache hit for actor actor-1')
      );
    });

    it('should log cache miss when building new library', () => {
      constructor.constructLibrary('actor-1');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Cache miss for actor actor-1')
      );
    });
  });

  describe('clearCache', () => {
    beforeEach(() => {
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:actor',
      ]);
      mockDataRegistry.getAll.mockImplementation((key) => {
        return [];
      });
    });

    it('should clear all cache entries', () => {
      constructor.constructLibrary('actor-1');
      expect(constructor.getCacheStats().size).toBe(1);

      const cleared = constructor.clearCache();

      expect(cleared).toBe(1);
      expect(constructor.getCacheStats().size).toBe(0);
    });

    it('should return 0 when clearing empty cache', () => {
      const cleared = constructor.clearCache();

      expect(cleared).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[TaskLibraryConstructor] Cache cleared: 0 entries removed'
      );
    });

    it('should allow rebuilding library after cache clear', () => {
      constructor.constructLibrary('actor-1');
      constructor.clearCache();

      mockDataRegistry.getAll.mockClear();
      constructor.constructLibrary('actor-1');

      expect(mockDataRegistry.getAll).toHaveBeenCalled();
    });
  });

  describe('getCacheStats', () => {
    beforeEach(() => {
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:actor',
      ]);
      mockDataRegistry.getAll.mockImplementation((key) => {
        return [];
      });
    });

    it('should return cache statistics', () => {
      const stats = constructor.getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('keys');
      expect(Array.isArray(stats.keys)).toBe(true);
    });

    it('should reflect current cache size', () => {
      expect(constructor.getCacheStats().size).toBe(0);

      constructor.constructLibrary('actor-1');

      expect(constructor.getCacheStats().size).toBe(1);
    });

    it('should include all cache keys', () => {
      constructor.constructLibrary('actor-1');

      const stats = constructor.getCacheStats();
      expect(stats.keys.length).toBe(1);
      expect(stats.keys[0]).toMatch(/^actor-1:/);
    });
  });

  describe('Task Retrieval from Registry', () => {
    it('should retrieve tasks from registry', () => {
      mockDataRegistry.getAll.mockImplementation((key) => {
        if (key === 'tasks')
          return [{ id: 'core:task1' }, { id: 'custom:task1' }];
        return [];
      });
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:actor',
      ]);

      constructor.constructLibrary('actor-1');

      expect(mockDataRegistry.getAll).toHaveBeenCalledWith('tasks');
    });

    it('should handle empty task registry', () => {
      mockDataRegistry.getAll.mockImplementation((key) => {
        if (key === 'tasks') return [];
        return [];
      });
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:actor',
      ]);

      const result = constructor.constructLibrary('actor-1');

      expect(result).toEqual([]);
    });

    it('should handle null task registry', () => {
      mockDataRegistry.getAll.mockImplementation((key) => {
        if (key === 'tasks') return null;
        return [];
      });
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:actor',
      ]);

      const result = constructor.constructLibrary('actor-1');

      expect(result).toEqual([]);
    });

    it('should throw error if registry access fails', () => {
      mockDataRegistry.getAll.mockImplementation(() => {
        throw new Error('Registry error');
      });
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:actor',
      ]);

      expect(() => constructor.constructLibrary('actor-1')).toThrow(
        'Failed to retrieve tasks'
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Structural Gate Evaluation', () => {
    beforeEach(() => {
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:actor',
        'core:hands',
      ]);
      mockDataRegistry.getAll.mockImplementation((key) => {
        return [];
      });
      mockContextAssembly.assemblePlanningContext.mockReturnValue({
        actor: { components: { 'core:actor': {}, 'core:hands': {} } },
        world: {},
      });
    });

    it('should include task with no structural gates', () => {
      mockDataRegistry.getAll.mockImplementation((key) => {
        if (key === 'tasks') return [{ id: 'core:always_applicable' }];
        return [];
      });

      const result = constructor.constructLibrary('actor-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('core:always_applicable');
    });

    it('should include task when structural gate passes', () => {
      mockDataRegistry.getAll.mockImplementation((key) => {
        if (key === 'tasks')
          return [
            {
              id: 'core:requires_hands',
              structuralGates: {
                condition: { has_component: ['actor', 'core:hands'] },
              },
            },
          ];
        return [];
      });
      mockJsonLogicService.evaluate.mockReturnValue(true);

      const result = constructor.constructLibrary('actor-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('core:requires_hands');
    });

    it('should exclude task when structural gate fails', () => {
      mockDataRegistry.getAll.mockImplementation((key) => {
        if (key === 'tasks')
          return [
            {
              id: 'core:requires_wings',
              structuralGates: {
                condition: { has_component: ['actor', 'core:wings'] },
              },
            },
          ];
        return [];
      });
      mockJsonLogicService.evaluate.mockReturnValue(false);

      const result = constructor.constructLibrary('actor-1');

      expect(result).toHaveLength(0);
    });

    it('should exclude task when gate evaluation throws error', () => {
      mockDataRegistry.getAll.mockImplementation((key) => {
        if (key === 'tasks')
          return [
            {
              id: 'core:invalid_gate',
              structuralGates: {
                condition: { malformed_operator: [] },
              },
            },
          ];
        return [];
      });
      mockJsonLogicService.evaluate.mockImplementation(() => {
        throw new Error('Invalid operator');
      });

      const result = constructor.constructLibrary('actor-1');

      expect(result).toHaveLength(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Structural gate evaluation failed')
      );
    });

    it('should handle mix of passing and failing gates', () => {
      mockDataRegistry.getAll.mockImplementation((key) => {
        if (key === 'tasks')
          return [
            {
              id: 'core:task1',
              structuralGates: { condition: { '==': [1, 1] } },
            },
            {
              id: 'core:task2',
              structuralGates: { condition: { '==': [1, 2] } },
            },
            { id: 'core:task3' }, // No gates
          ];
        return [];
      });
      mockJsonLogicService.evaluate
        .mockReturnValueOnce(true) // task1 passes
        .mockReturnValueOnce(false); // task2 fails

      const result = constructor.constructLibrary('actor-1');

      expect(result).toHaveLength(2);
      expect(result.map((t) => t.id)).toEqual(['core:task1', 'core:task3']);
    });

    it('should assemble planning context for each gate evaluation', () => {
      mockDataRegistry.getAll.mockImplementation((key) => {
        if (key === 'tasks')
          return [
            {
              id: 'core:task1',
              structuralGates: { condition: {} },
            },
          ];
        return [];
      });
      mockJsonLogicService.evaluate.mockReturnValue(true);

      constructor.constructLibrary('actor-1');

      expect(mockContextAssembly.assemblePlanningContext).toHaveBeenCalledWith(
        'actor-1'
      );
    });

    it('should use context assembly result for gate evaluation', () => {
      const context = {
        actor: { components: { 'core:actor': {} } },
        world: { time: 100 },
      };
      mockContextAssembly.assemblePlanningContext.mockReturnValue(context);
      mockDataRegistry.getAll.mockImplementation((key) => {
        if (key === 'tasks')
          return [
            {
              id: 'core:task1',
              structuralGates: { condition: { '==': [1, 1] } },
            },
          ];
        return [];
      });
      mockJsonLogicService.evaluate.mockReturnValue(true);

      constructor.constructLibrary('actor-1');

      expect(mockJsonLogicService.evaluate).toHaveBeenCalledWith(
        { '==': [1, 1] },
        context
      );
    });
  });

  describe('Library Statistics Logging', () => {
    beforeEach(() => {
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:actor',
      ]);
    });

    it('should log library construction stats', () => {
      mockDataRegistry.getAll.mockImplementation((key) => {
        if (key === 'tasks')
          return [{ id: 'task1' }, { id: 'task2' }, { id: 'task3' }];
        return [];
      });

      constructor.constructLibrary('actor-1');

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          'Library constructed for actor-1: 3/3 tasks (0.0% filtered)'
        )
      );
    });

    it('should calculate correct filter percentage', () => {
      mockDataRegistry.getAll.mockImplementation((key) => {
        if (key === 'tasks')
          return [
            {
              id: 'task1',
              structuralGates: { condition: {} },
            },
            {
              id: 'task2',
              structuralGates: { condition: {} },
            },
            {
              id: 'task3',
              structuralGates: { condition: {} },
            },
            {
              id: 'task4',
              structuralGates: { condition: {} },
            },
          ];
        return [];
      });
      mockContextAssembly.assemblePlanningContext.mockReturnValue({});
      mockJsonLogicService.evaluate
        .mockReturnValueOnce(true) // task1
        .mockReturnValueOnce(false) // task2
        .mockReturnValueOnce(true) // task3
        .mockReturnValueOnce(false); // task4

      constructor.constructLibrary('actor-1');

      // 2 out of 4 = 50% filtered
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('2/4 tasks (50.0% filtered)')
      );
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:actor',
      ]);
    });

    it('should handle context assembly failure gracefully', () => {
      mockDataRegistry.getAll.mockImplementation((key) => {
        if (key === 'tasks')
          return [
            {
              id: 'task1',
              structuralGates: { condition: {} },
            },
          ];
        return [];
      });
      mockContextAssembly.assemblePlanningContext.mockImplementation(() => {
        throw new Error('Context assembly failed');
      });

      const result = constructor.constructLibrary('actor-1');

      // Task should be excluded on error
      expect(result).toHaveLength(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Structural gate evaluation failed')
      );
    });

    it('should continue processing other tasks after single task error', () => {
      mockDataRegistry.getAll.mockImplementation((key) => {
        if (key === 'tasks')
          return [
            {
              id: 'task1',
              structuralGates: { condition: {} },
            },
            { id: 'task2' }, // No gates
          ];
        return [];
      });
      mockContextAssembly.assemblePlanningContext.mockReturnValue({});
      mockJsonLogicService.evaluate.mockImplementationOnce(() => {
        throw new Error('Evaluation error');
      });

      const result = constructor.constructLibrary('actor-1');

      // task2 should still be included
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('task2');
    });

    it('should log error and throw when entire construction fails', () => {
      mockEntityManager.getAllComponentTypesForEntity.mockImplementation(() => {
        throw new Error('Critical failure');
      });

      expect(() => constructor.constructLibrary('actor-1')).toThrow(
        'Failed to construct task library'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to construct task library'),
        expect.any(Error)
      );
    });
  });
});
