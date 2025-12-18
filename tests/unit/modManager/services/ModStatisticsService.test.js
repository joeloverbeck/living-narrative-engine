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
});
