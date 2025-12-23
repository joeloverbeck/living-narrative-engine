/**
 * @file Unit tests for ModStatisticsService
 * @see src/modManager/services/ModStatisticsService.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ModStatisticsService from '../../../../src/modManager/services/ModStatisticsService.js';

describe('ModStatisticsService', () => {
  let mockLogger;
  let mockModGraphService;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockModGraphService = {
      getAllNodes: jest.fn().mockReturnValue(new Map()),
      getLoadOrder: jest.fn().mockReturnValue([]),
      getModStatus: jest.fn().mockReturnValue('inactive'),
    };
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });
      expect(service).toBeDefined();
    });

    it('should throw when modGraphService is not provided', () => {
      expect(
        () => new ModStatisticsService({ logger: mockLogger })
      ).toThrow();
    });

    it('should throw when modGraphService is missing required methods', () => {
      const incompleteGraphService = {
        getAllNodes: jest.fn(),
        // Missing getLoadOrder and getModStatus
      };
      expect(
        () =>
          new ModStatisticsService({
            modGraphService: incompleteGraphService,
            logger: mockLogger,
          })
      ).toThrow();
    });

    it('should throw when logger is not provided', () => {
      expect(
        () => new ModStatisticsService({ modGraphService: mockModGraphService })
      ).toThrow();
    });

    it('should throw when logger is missing required methods', () => {
      const incompleteLogger = {
        debug: jest.fn(),
        // Missing info, warn, error
      };
      expect(
        () =>
          new ModStatisticsService({
            modGraphService: mockModGraphService,
            logger: incompleteLogger,
          })
      ).toThrow();
    });
  });

  describe('invalidateCache', () => {
    it('should log cache invalidation', () => {
      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      service.invalidateCache();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[ModStatisticsService] Cache invalidated'
      );
    });

    it('should be callable multiple times without error', () => {
      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      expect(() => {
        service.invalidateCache();
        service.invalidateCache();
        service.invalidateCache();
      }).not.toThrow();

      expect(mockLogger.debug).toHaveBeenCalledTimes(3);
    });
  });

  describe('getGraphService', () => {
    it('should return the injected graph service', () => {
      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      expect(service.getGraphService()).toBe(mockModGraphService);
    });

    it('should return the same reference on multiple calls', () => {
      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      const first = service.getGraphService();
      const second = service.getGraphService();

      expect(first).toBe(second);
      expect(first).toBe(mockModGraphService);
    });
  });

  describe('cache state', () => {
    it('should start with invalid cache', () => {
      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      expect(service.isCacheValid()).toBe(false);
    });

    it('should remain invalid after invalidateCache is called', () => {
      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      service.invalidateCache();
      expect(service.isCacheValid()).toBe(false);
    });
  });

  describe('isCacheValid', () => {
    it('should return false initially', () => {
      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      expect(service.isCacheValid()).toBe(false);
    });
  });

  describe('getDependencyHotspots', () => {
    it('should return empty array for empty graph', () => {
      mockModGraphService.getAllNodes.mockReturnValue(new Map());

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      expect(service.getDependencyHotspots()).toEqual([]);
    });

    it('should return mods sorted by dependent count descending', () => {
      const nodes = new Map([
        ['core', { id: 'core', dependents: ['a', 'b', 'c'], status: 'core' }],
        [
          'anatomy',
          { id: 'anatomy', dependents: ['x'], status: 'dependency' },
        ],
        ['items', { id: 'items', dependents: ['y', 'z'], status: 'explicit' }],
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodes);

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      const result = service.getDependencyHotspots();

      expect(result[0].modId).toBe('core');
      expect(result[0].dependentCount).toBe(3);
      expect(result[1].modId).toBe('items');
      expect(result[1].dependentCount).toBe(2);
      expect(result[2].modId).toBe('anatomy');
      expect(result[2].dependentCount).toBe(1);
    });

    it('should use default limit of 5', () => {
      const nodes = new Map([
        ['a', { id: 'a', dependents: ['x1', 'x2', 'x3', 'x4', 'x5', 'x6'], status: 'explicit' }],
        ['b', { id: 'b', dependents: ['x1', 'x2', 'x3', 'x4', 'x5'], status: 'explicit' }],
        ['c', { id: 'c', dependents: ['x1', 'x2', 'x3', 'x4'], status: 'explicit' }],
        ['d', { id: 'd', dependents: ['x1', 'x2', 'x3'], status: 'explicit' }],
        ['e', { id: 'e', dependents: ['x1', 'x2'], status: 'explicit' }],
        ['f', { id: 'f', dependents: ['x1'], status: 'explicit' }],
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodes);

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      const result = service.getDependencyHotspots();

      expect(result).toHaveLength(5);
      expect(result[0].modId).toBe('a');
      expect(result[4].modId).toBe('e');
    });

    it('should respect custom limit parameter', () => {
      const nodes = new Map([
        ['a', { id: 'a', dependents: ['x', 'y', 'z'], status: 'explicit' }],
        ['b', { id: 'b', dependents: ['x', 'y'], status: 'explicit' }],
        ['c', { id: 'c', dependents: ['x'], status: 'explicit' }],
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodes);

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      expect(service.getDependencyHotspots(2)).toHaveLength(2);
      expect(service.getDependencyHotspots(1)).toHaveLength(1);
    });

    it('should return all mods when fewer than limit exist', () => {
      const nodes = new Map([
        ['a', { id: 'a', dependents: ['x'], status: 'explicit' }],
        ['b', { id: 'b', dependents: [], status: 'explicit' }],
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodes);

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      expect(service.getDependencyHotspots(10)).toHaveLength(2);
    });

    it('should exclude inactive mods', () => {
      const nodes = new Map([
        ['active', { id: 'active', dependents: ['x'], status: 'explicit' }],
        [
          'inactive',
          { id: 'inactive', dependents: ['a', 'b', 'c'], status: 'inactive' },
        ],
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodes);

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      const result = service.getDependencyHotspots();

      expect(result).toHaveLength(1);
      expect(result[0].modId).toBe('active');
    });

    it('should cache results until invalidation', () => {
      const nodes = new Map([
        ['core', { id: 'core', dependents: ['a'], status: 'core' }],
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodes);

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      service.getDependencyHotspots();
      service.getDependencyHotspots();

      // Should only call getAllNodes once due to caching
      expect(mockModGraphService.getAllNodes).toHaveBeenCalledTimes(1);

      service.invalidateCache();
      service.getDependencyHotspots();

      // After invalidation, should call again
      expect(mockModGraphService.getAllNodes).toHaveBeenCalledTimes(2);
    });

    it('should mark cache as valid after computation', () => {
      const nodes = new Map([
        ['core', { id: 'core', dependents: ['a'], status: 'core' }],
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodes);

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      expect(service.isCacheValid()).toBe(false);
      service.getDependencyHotspots();
      expect(service.isCacheValid()).toBe(true);
    });

    it('should include all active status types', () => {
      const nodes = new Map([
        ['core', { id: 'core', dependents: ['a', 'b'], status: 'core' }],
        ['explicit', { id: 'explicit', dependents: ['c'], status: 'explicit' }],
        ['dep', { id: 'dep', dependents: [], status: 'dependency' }],
        ['inactive', { id: 'inactive', dependents: ['x', 'y', 'z'], status: 'inactive' }],
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodes);

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      const result = service.getDependencyHotspots();

      expect(result).toHaveLength(3);
      const modIds = result.map((h) => h.modId);
      expect(modIds).toContain('core');
      expect(modIds).toContain('explicit');
      expect(modIds).toContain('dep');
      expect(modIds).not.toContain('inactive');
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status for valid configuration', () => {
      const nodes = new Map([
        [
          'core',
          {
            id: 'core',
            dependencies: [],
            dependents: ['anatomy'],
            status: 'core',
          },
        ],
        [
          'anatomy',
          {
            id: 'anatomy',
            dependencies: ['core'],
            dependents: [],
            status: 'dependency',
          },
        ],
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodes);
      mockModGraphService.getLoadOrder.mockReturnValue(['core', 'anatomy']);

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      const health = service.getHealthStatus();

      expect(health.hasCircularDeps).toBe(false);
      expect(health.missingDeps).toEqual([]);
      expect(health.loadOrderValid).toBe(true);
      expect(health.errors).toEqual([]);
    });

    it('should detect missing dependencies', () => {
      const nodes = new Map([
        [
          'mod-a',
          {
            id: 'mod-a',
            dependencies: ['missing-mod'],
            dependents: [],
            status: 'explicit',
          },
        ],
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodes);
      mockModGraphService.getLoadOrder.mockReturnValue(['mod-a']);

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      const health = service.getHealthStatus();

      expect(health.missingDeps).toContain('missing-mod');
      expect(health.errors.length).toBeGreaterThan(0);
    });

    it('should detect empty load order as warning', () => {
      const nodes = new Map([
        [
          'core',
          { id: 'core', dependencies: [], dependents: [], status: 'core' },
        ],
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodes);
      mockModGraphService.getLoadOrder.mockReturnValue([]);

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      const health = service.getHealthStatus();

      expect(health.loadOrderValid).toBe(false);
      expect(health.warnings.length).toBeGreaterThan(0);
    });

    it('should detect potential circular dependency', () => {
      const nodes = new Map([
        [
          'mod-a',
          {
            id: 'mod-a',
            dependencies: ['mod-b'],
            dependents: ['mod-b'],
            status: 'explicit',
          },
        ],
        [
          'mod-b',
          {
            id: 'mod-b',
            dependencies: ['mod-a'],
            dependents: ['mod-a'],
            status: 'explicit',
          },
        ],
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodes);
      mockModGraphService.getLoadOrder.mockReturnValue([]); // Failed to compute

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      const health = service.getHealthStatus();

      expect(health.hasCircularDeps).toBe(true);
    });

    it('should detect circular dependency via explicit hasCircularDependency method', () => {
      const nodes = new Map([
        [
          'mod-a',
          {
            id: 'mod-a',
            dependencies: ['mod-b'],
            dependents: ['mod-b'],
            status: 'explicit',
          },
        ],
        [
          'mod-b',
          {
            id: 'mod-b',
            dependencies: ['mod-a'],
            dependents: ['mod-a'],
            status: 'explicit',
          },
        ],
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodes);
      mockModGraphService.getLoadOrder.mockReturnValue([]);
      // New: ModGraphService provides explicit circular dependency detection
      mockModGraphService.hasCircularDependency = jest.fn().mockReturnValue(true);
      mockModGraphService.getCircularDependencyError = jest
        .fn()
        .mockReturnValue('DEPENDENCY_CYCLE: mod-a <-> mod-b');

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      const health = service.getHealthStatus();

      expect(health.hasCircularDeps).toBe(true);
      expect(health.loadOrderValid).toBe(false);
      expect(health.errors).toContain('DEPENDENCY_CYCLE: mod-a <-> mod-b');
    });

    it('should cache results until invalidation', () => {
      const nodes = new Map([
        [
          'core',
          { id: 'core', dependencies: [], dependents: [], status: 'core' },
        ],
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodes);
      mockModGraphService.getLoadOrder.mockReturnValue(['core']);

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      const result1 = service.getHealthStatus();
      const result2 = service.getHealthStatus();

      expect(result1).toBe(result2);
      expect(mockModGraphService.getAllNodes).toHaveBeenCalledTimes(1);

      service.invalidateCache();
      service.getHealthStatus();

      expect(mockModGraphService.getAllNodes).toHaveBeenCalledTimes(2);
    });

    it('should skip inactive mods when checking dependencies', () => {
      const nodes = new Map([
        [
          'active',
          { id: 'active', dependencies: [], dependents: [], status: 'explicit' },
        ],
        [
          'inactive',
          {
            id: 'inactive',
            dependencies: ['missing'],
            dependents: [],
            status: 'inactive',
          },
        ],
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodes);
      mockModGraphService.getLoadOrder.mockReturnValue(['active']);

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      const health = service.getHealthStatus();

      expect(health.missingDeps).toEqual([]);
      expect(health.errors).toEqual([]);
    });
  });

  describe('getDependencyDepthAnalysis', () => {
    it('should return zeros for empty graph', () => {
      mockModGraphService.getAllNodes.mockReturnValue(new Map());

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      const result = service.getDependencyDepthAnalysis();

      expect(result.maxDepth).toBe(0);
      expect(result.deepestChain).toEqual([]);
      expect(result.averageDepth).toBe(0);
    });

    it('should return depth 1 for mod with no dependencies', () => {
      const nodes = new Map([
        [
          'standalone',
          {
            id: 'standalone',
            dependencies: [],
            dependents: [],
            status: 'explicit',
          },
        ],
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodes);

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      const result = service.getDependencyDepthAnalysis();

      expect(result.maxDepth).toBe(1);
      expect(result.deepestChain).toEqual(['standalone']);
    });

    it('should calculate correct depth for linear chain', () => {
      // Chain: mod-c → mod-b → mod-a (depth 3)
      const nodes = new Map([
        [
          'mod-a',
          {
            id: 'mod-a',
            dependencies: [],
            dependents: ['mod-b'],
            status: 'core',
          },
        ],
        [
          'mod-b',
          {
            id: 'mod-b',
            dependencies: ['mod-a'],
            dependents: ['mod-c'],
            status: 'dependency',
          },
        ],
        [
          'mod-c',
          {
            id: 'mod-c',
            dependencies: ['mod-b'],
            dependents: [],
            status: 'explicit',
          },
        ],
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodes);

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      const result = service.getDependencyDepthAnalysis();

      expect(result.maxDepth).toBe(3);
      expect(result.deepestChain).toEqual(['mod-c', 'mod-b', 'mod-a']);
    });

    it('should find longest path when multiple paths exist', () => {
      // mod-d depends on mod-b (short) and mod-c (long via mod-a)
      const nodes = new Map([
        [
          'mod-a',
          {
            id: 'mod-a',
            dependencies: [],
            dependents: ['mod-c'],
            status: 'core',
          },
        ],
        [
          'mod-b',
          {
            id: 'mod-b',
            dependencies: [],
            dependents: ['mod-d'],
            status: 'dependency',
          },
        ],
        [
          'mod-c',
          {
            id: 'mod-c',
            dependencies: ['mod-a'],
            dependents: ['mod-d'],
            status: 'dependency',
          },
        ],
        [
          'mod-d',
          {
            id: 'mod-d',
            dependencies: ['mod-b', 'mod-c'],
            dependents: [],
            status: 'explicit',
          },
        ],
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodes);

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      const result = service.getDependencyDepthAnalysis();

      expect(result.maxDepth).toBe(3); // mod-d → mod-c → mod-a
      expect(result.deepestChain[0]).toBe('mod-d');
      expect(result.deepestChain).toContain('mod-c');
      expect(result.deepestChain).toContain('mod-a');
    });

    it('should calculate correct average depth', () => {
      const nodes = new Map([
        [
          'core',
          { id: 'core', dependencies: [], dependents: ['dep'], status: 'core' },
        ], // depth 1
        [
          'dep',
          {
            id: 'dep',
            dependencies: ['core'],
            dependents: ['leaf'],
            status: 'dependency',
          },
        ], // depth 2
        [
          'leaf',
          {
            id: 'leaf',
            dependencies: ['dep'],
            dependents: [],
            status: 'explicit',
          },
        ], // depth 3
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodes);

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      const result = service.getDependencyDepthAnalysis();

      expect(result.averageDepth).toBe(2); // (1 + 2 + 3) / 3 = 2
    });

    it('should exclude inactive mods from analysis', () => {
      const nodes = new Map([
        [
          'active',
          {
            id: 'active',
            dependencies: [],
            dependents: [],
            status: 'explicit',
          },
        ],
        [
          'inactive',
          {
            id: 'inactive',
            dependencies: ['deep1', 'deep2'],
            dependents: [],
            status: 'inactive',
          },
        ],
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodes);

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      const result = service.getDependencyDepthAnalysis();

      expect(result.maxDepth).toBe(1);
      expect(result.deepestChain).toEqual(['active']);
    });

    it('should cache results until invalidation', () => {
      const nodes = new Map([
        [
          'mod',
          { id: 'mod', dependencies: [], dependents: [], status: 'explicit' },
        ],
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodes);

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      const result1 = service.getDependencyDepthAnalysis();
      const result2 = service.getDependencyDepthAnalysis();

      expect(result1).toBe(result2);
      expect(mockModGraphService.getAllNodes).toHaveBeenCalledTimes(1);

      service.invalidateCache();
      service.getDependencyDepthAnalysis();

      expect(mockModGraphService.getAllNodes).toHaveBeenCalledTimes(2);
    });

    it('should handle circular dependencies without infinite loop', () => {
      const nodes = new Map([
        [
          'mod-a',
          {
            id: 'mod-a',
            dependencies: ['mod-b'],
            dependents: ['mod-b'],
            status: 'explicit',
          },
        ],
        [
          'mod-b',
          {
            id: 'mod-b',
            dependencies: ['mod-a'],
            dependents: ['mod-a'],
            status: 'explicit',
          },
        ],
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodes);

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      // Should complete without hanging
      const result = service.getDependencyDepthAnalysis();

      expect(result.maxDepth).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.deepestChain)).toBe(true);
    });

    it('should mark cache as valid after computation', () => {
      const nodes = new Map([
        [
          'mod',
          { id: 'mod', dependencies: [], dependents: [], status: 'explicit' },
        ],
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodes);

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      expect(service.isCacheValid()).toBe(false);
      service.getDependencyDepthAnalysis();
      expect(service.isCacheValid()).toBe(true);
    });

    it('should round average depth to one decimal place', () => {
      // Set up mods with depths that produce non-integer average
      // Two mods: depth 1 and depth 2, average = 1.5
      const nodes = new Map([
        [
          'root',
          { id: 'root', dependencies: [], dependents: ['child'], status: 'core' },
        ], // depth 1
        [
          'child',
          {
            id: 'child',
            dependencies: ['root'],
            dependents: [],
            status: 'explicit',
          },
        ], // depth 2
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodes);

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      const result = service.getDependencyDepthAnalysis();

      expect(result.averageDepth).toBe(1.5); // (1 + 2) / 2 = 1.5
    });
  });

  describe('getTransitiveDependencyFootprints', () => {
    it('should return empty footprints for no explicit mods', () => {
      const nodes = new Map([
        ['core', { id: 'core', dependencies: [], dependents: [], status: 'core' }],
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodes);

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      const result = service.getTransitiveDependencyFootprints();

      expect(result.footprints).toEqual([]);
      expect(result.totalUniqueDeps).toBe(0);
      expect(result.overlapPercentage).toBe(0);
    });

    it('should calculate correct footprint for single explicit mod', () => {
      const nodes = new Map([
        [
          'core',
          {
            id: 'core',
            dependencies: [],
            dependents: ['anatomy'],
            status: 'core',
          },
        ],
        [
          'anatomy',
          {
            id: 'anatomy',
            dependencies: ['core'],
            dependents: ['explicit1'],
            status: 'dependency',
          },
        ],
        [
          'explicit1',
          {
            id: 'explicit1',
            dependencies: ['anatomy'],
            dependents: [],
            status: 'explicit',
          },
        ],
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodes);

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      const result = service.getTransitiveDependencyFootprints();

      expect(result.footprints).toHaveLength(1);
      expect(result.footprints[0].modId).toBe('explicit1');
      expect(result.footprints[0].count).toBe(2); // anatomy + core
      expect(result.footprints[0].dependencies).toContain('anatomy');
      expect(result.footprints[0].dependencies).toContain('core');
    });

    it('should sort footprints by count descending', () => {
      const nodes = new Map([
        ['core', { id: 'core', dependencies: [], dependents: [], status: 'core' }],
        [
          'dep1',
          { id: 'dep1', dependencies: ['core'], dependents: [], status: 'dependency' },
        ],
        [
          'dep2',
          { id: 'dep2', dependencies: ['core'], dependents: [], status: 'dependency' },
        ],
        [
          'small',
          { id: 'small', dependencies: ['core'], dependents: [], status: 'explicit' },
        ],
        [
          'large',
          {
            id: 'large',
            dependencies: ['core', 'dep1', 'dep2'],
            dependents: [],
            status: 'explicit',
          },
        ],
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodes);

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      const result = service.getTransitiveDependencyFootprints();

      expect(result.footprints[0].modId).toBe('large');
      expect(result.footprints[1].modId).toBe('small');
    });

    it('should calculate correct overlap percentage', () => {
      // Two explicit mods both depending on 'core' (shared)
      // explicit1 also depends on dep1, explicit2 on dep2 (unique)
      const nodes = new Map([
        ['core', { id: 'core', dependencies: [], dependents: [], status: 'core' }],
        ['dep1', { id: 'dep1', dependencies: [], dependents: [], status: 'dependency' }],
        ['dep2', { id: 'dep2', dependencies: [], dependents: [], status: 'dependency' }],
        [
          'explicit1',
          {
            id: 'explicit1',
            dependencies: ['core', 'dep1'],
            dependents: [],
            status: 'explicit',
          },
        ],
        [
          'explicit2',
          {
            id: 'explicit2',
            dependencies: ['core', 'dep2'],
            dependents: [],
            status: 'explicit',
          },
        ],
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodes);

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      const result = service.getTransitiveDependencyFootprints();

      expect(result.totalUniqueDeps).toBe(3); // core, dep1, dep2
      expect(result.sharedDepsCount).toBe(1); // only core is shared
      expect(result.overlapPercentage).toBe(33); // 1/3 ≈ 33%
    });

    it('should report 100% overlap when all deps are shared', () => {
      const nodes = new Map([
        ['core', { id: 'core', dependencies: [], dependents: [], status: 'core' }],
        [
          'explicit1',
          {
            id: 'explicit1',
            dependencies: ['core'],
            dependents: [],
            status: 'explicit',
          },
        ],
        [
          'explicit2',
          {
            id: 'explicit2',
            dependencies: ['core'],
            dependents: [],
            status: 'explicit',
          },
        ],
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodes);

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      const result = service.getTransitiveDependencyFootprints();

      expect(result.overlapPercentage).toBe(100);
    });

    it('should report 0% overlap when no deps are shared', () => {
      const nodes = new Map([
        ['dep1', { id: 'dep1', dependencies: [], dependents: [], status: 'dependency' }],
        ['dep2', { id: 'dep2', dependencies: [], dependents: [], status: 'dependency' }],
        [
          'explicit1',
          {
            id: 'explicit1',
            dependencies: ['dep1'],
            dependents: [],
            status: 'explicit',
          },
        ],
        [
          'explicit2',
          {
            id: 'explicit2',
            dependencies: ['dep2'],
            dependents: [],
            status: 'explicit',
          },
        ],
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodes);

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      const result = service.getTransitiveDependencyFootprints();

      expect(result.sharedDepsCount).toBe(0);
      expect(result.overlapPercentage).toBe(0);
    });

    it('should include transitive dependencies', () => {
      // explicit1 → dep1 → core (transitive)
      const nodes = new Map([
        [
          'core',
          { id: 'core', dependencies: [], dependents: ['dep1'], status: 'core' },
        ],
        [
          'dep1',
          {
            id: 'dep1',
            dependencies: ['core'],
            dependents: ['explicit1'],
            status: 'dependency',
          },
        ],
        [
          'explicit1',
          {
            id: 'explicit1',
            dependencies: ['dep1'],
            dependents: [],
            status: 'explicit',
          },
        ],
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodes);

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      const result = service.getTransitiveDependencyFootprints();

      expect(result.footprints[0].dependencies).toContain('core');
      expect(result.footprints[0].dependencies).toContain('dep1');
      expect(result.footprints[0].count).toBe(2);
    });

    it('should cache results until invalidation', () => {
      const nodes = new Map([
        [
          'explicit1',
          { id: 'explicit1', dependencies: [], dependents: [], status: 'explicit' },
        ],
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodes);

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      const result1 = service.getTransitiveDependencyFootprints();
      const result2 = service.getTransitiveDependencyFootprints();

      expect(result1).toBe(result2);
      expect(mockModGraphService.getAllNodes).toHaveBeenCalledTimes(1);

      service.invalidateCache();
      service.getTransitiveDependencyFootprints();

      expect(mockModGraphService.getAllNodes).toHaveBeenCalledTimes(2);
    });

    it('should handle circular dependencies without infinite loop', () => {
      const nodes = new Map([
        [
          'explicit1',
          {
            id: 'explicit1',
            dependencies: ['mod-a'],
            dependents: [],
            status: 'explicit',
          },
        ],
        [
          'mod-a',
          {
            id: 'mod-a',
            dependencies: ['mod-b'],
            dependents: ['mod-b', 'explicit1'],
            status: 'dependency',
          },
        ],
        [
          'mod-b',
          {
            id: 'mod-b',
            dependencies: ['mod-a'],
            dependents: ['mod-a'],
            status: 'dependency',
          },
        ],
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodes);

      const service = new ModStatisticsService({
        modGraphService: mockModGraphService,
        logger: mockLogger,
      });

      // Should complete without hanging
      const result = service.getTransitiveDependencyFootprints();

      expect(result.footprints).toHaveLength(1);
      expect(Array.isArray(result.footprints[0].dependencies)).toBe(true);
    });
  });
});
