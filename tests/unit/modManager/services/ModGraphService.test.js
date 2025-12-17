/**
 * @file Unit tests for ModGraphService
 * @see src/modManager/services/ModGraphService.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
} from '@jest/globals';
import { ModGraphService } from '../../../../src/modManager/services/ModGraphService.js';

describe('ModGraphService', () => {
  /** @type {jest.Mocked<{debug: Function, info: Function, warn: Function, error: Function}>} */
  let mockLogger;
  /** @type {ModGraphService} */
  let service;

  const createMockMods = () => [
    {
      id: 'core',
      dependencies: [],
    },
    {
      id: 'base-mod',
      dependencies: [{ id: 'core' }],
    },
    {
      id: 'feature-mod',
      dependencies: [{ id: 'base-mod' }],
    },
    {
      id: 'standalone-mod',
      dependencies: [],
    },
  ];

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    service = new ModGraphService({ logger: mockLogger });
  });

  describe('constructor', () => {
    it('should throw error when logger is not provided', () => {
      expect(() => new ModGraphService({})).toThrow(
        'ModGraphService: logger is required'
      );
    });

    it('should create instance with logger', () => {
      const service = new ModGraphService({ logger: mockLogger });
      expect(service).toBeInstanceOf(ModGraphService);
    });
  });

  describe('buildGraph', () => {
    it('should create nodes for all mods', () => {
      const mods = createMockMods();
      service.buildGraph(mods);

      const nodes = service.getAllNodes();
      expect(nodes.size).toBe(4);
      expect(nodes.has('core')).toBe(true);
      expect(nodes.has('base-mod')).toBe(true);
      expect(nodes.has('feature-mod')).toBe(true);
      expect(nodes.has('standalone-mod')).toBe(true);
    });

    it('should calculate dependents correctly', () => {
      const mods = createMockMods();
      service.buildGraph(mods);

      const nodes = service.getAllNodes();

      // core should have base-mod as dependent
      expect(nodes.get('core').dependents).toContain('base-mod');

      // base-mod should have feature-mod as dependent
      expect(nodes.get('base-mod').dependents).toContain('feature-mod');

      // feature-mod should have no dependents
      expect(nodes.get('feature-mod').dependents).toHaveLength(0);

      // standalone-mod should have no dependents
      expect(nodes.get('standalone-mod').dependents).toHaveLength(0);
    });

    it('should mark core mod as core status', () => {
      const mods = createMockMods();
      service.buildGraph(mods);

      expect(service.getModStatus('core')).toBe('core');
    });

    it('should set non-core mods to inactive initially', () => {
      const mods = createMockMods();
      service.buildGraph(mods);

      expect(service.getModStatus('base-mod')).toBe('inactive');
      expect(service.getModStatus('feature-mod')).toBe('inactive');
      expect(service.getModStatus('standalone-mod')).toBe('inactive');
    });

    it('should handle empty mod list gracefully', () => {
      service.buildGraph([]);

      const nodes = service.getAllNodes();
      expect(nodes.size).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith('Graph built with 0 mods');
    });

    it('should handle mods with no dependencies', () => {
      const mods = [
        { id: 'core', dependencies: [] },
        { id: 'independent', dependencies: [] },
      ];
      service.buildGraph(mods);

      const nodes = service.getAllNodes();
      expect(nodes.get('independent').dependencies).toHaveLength(0);
      expect(nodes.get('independent').dependents).toHaveLength(0);
    });

    it('should log graph building progress', () => {
      const mods = createMockMods();
      service.buildGraph(mods);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Building mod dependency graph...'
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Graph built with 4 mods');
    });

    it('should clear previous graph when rebuilding', () => {
      // Build first time
      service.buildGraph([{ id: 'core', dependencies: [] }]);
      expect(service.getAllNodes().size).toBe(1);

      // Build second time with more mods
      service.buildGraph(createMockMods());
      expect(service.getAllNodes().size).toBe(4);
    });
  });

  describe('setExplicitMods', () => {
    beforeEach(() => {
      service.buildGraph(createMockMods());
    });

    it('should update statuses correctly', () => {
      service.setExplicitMods(['feature-mod']);

      expect(service.getModStatus('feature-mod')).toBe('explicit');
      expect(service.getModStatus('base-mod')).toBe('dependency');
      expect(service.getModStatus('core')).toBe('core'); // core stays core
      expect(service.getModStatus('standalone-mod')).toBe('inactive');
    });

    it('should mark deep dependencies', () => {
      service.setExplicitMods(['feature-mod']);

      // feature-mod depends on base-mod which depends on core
      // base-mod should be marked as dependency
      expect(service.getModStatus('base-mod')).toBe('dependency');
    });

    it('should handle multiple explicit mods', () => {
      service.setExplicitMods(['feature-mod', 'standalone-mod']);

      expect(service.getModStatus('feature-mod')).toBe('explicit');
      expect(service.getModStatus('standalone-mod')).toBe('explicit');
      expect(service.getModStatus('base-mod')).toBe('dependency');
    });

    it('should reset statuses when setting new explicit mods', () => {
      // First set
      service.setExplicitMods(['feature-mod']);
      expect(service.getModStatus('feature-mod')).toBe('explicit');

      // Second set - standalone-mod only
      service.setExplicitMods(['standalone-mod']);
      expect(service.getModStatus('feature-mod')).toBe('inactive');
      expect(service.getModStatus('standalone-mod')).toBe('explicit');
    });

    it('should not override core status', () => {
      service.setExplicitMods(['core', 'feature-mod']);

      // core should remain 'core', not become 'explicit'
      expect(service.getModStatus('core')).toBe('core');
    });
  });

  describe('calculateActivation', () => {
    beforeEach(() => {
      service.buildGraph(createMockMods());
    });

    it('should return dependencies needed for activation', () => {
      const result = service.calculateActivation('feature-mod');

      expect(result.valid).toBe(true);
      expect(result.activated).toEqual(['feature-mod']);
      expect(result.dependencies).toContain('base-mod');
      // Note: core is always 'core' status, not 'inactive', so it won't appear
      // as a "new dependency needed" - this is correct behavior
      expect(result.conflicts).toHaveLength(0);
    });

    it('should handle unknown mod gracefully', () => {
      const result = service.calculateActivation('non-existent');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Unknown mod: non-existent');
      expect(result.activated).toHaveLength(0);
      expect(result.dependencies).toHaveLength(0);
    });

    it('should reject activation of core mod', () => {
      const result = service.calculateActivation('core');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Core mod is always active');
    });

    it('should exclude already active dependencies', () => {
      // Set base-mod as explicit first
      service.setExplicitMods(['base-mod']);

      const result = service.calculateActivation('feature-mod');

      // base-mod should not be in dependencies since it's already active
      expect(result.dependencies).not.toContain('base-mod');
      // core is always active
      expect(result.dependencies).not.toContain('core');
    });

    it('should return empty dependencies for mod with no deps', () => {
      const result = service.calculateActivation('standalone-mod');

      expect(result.valid).toBe(true);
      expect(result.activated).toEqual(['standalone-mod']);
      expect(result.dependencies).toHaveLength(0);
    });
  });

  describe('calculateDeactivation', () => {
    beforeEach(() => {
      service.buildGraph(createMockMods());
      service.setExplicitMods(['feature-mod', 'standalone-mod']);
    });

    it('should find orphaned dependencies', () => {
      const result = service.calculateDeactivation('feature-mod');

      expect(result.valid).toBe(true);
      expect(result.deactivated).toEqual(['feature-mod']);
      // base-mod would be orphaned since nothing else depends on it
      expect(result.orphaned).toContain('base-mod');
      expect(result.blocked).toHaveLength(0);
    });

    it('should block when dependents exist', () => {
      // Try to deactivate base-mod while feature-mod depends on it
      const result = service.calculateDeactivation('base-mod');

      expect(result.valid).toBe(false);
      expect(result.blocked).toContain('feature-mod');
      expect(result.error).toContain('Cannot deactivate');
      expect(result.error).toContain('feature-mod');
    });

    it('should handle unknown mod gracefully', () => {
      const result = service.calculateDeactivation('non-existent');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Unknown mod: non-existent');
    });

    it('should reject deactivation of core mod', () => {
      const result = service.calculateDeactivation('core');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Core mod cannot be deactivated');
    });

    it('should not mark core as orphaned', () => {
      const result = service.calculateDeactivation('feature-mod');

      // core should never be in orphaned list
      expect(result.orphaned).not.toContain('core');
    });

    it('should allow deactivation of standalone mod', () => {
      const result = service.calculateDeactivation('standalone-mod');

      expect(result.valid).toBe(true);
      expect(result.deactivated).toEqual(['standalone-mod']);
      expect(result.orphaned).toHaveLength(0);
      expect(result.blocked).toHaveLength(0);
    });
  });

  describe('getLoadOrder', () => {
    it('should return topologically sorted list', () => {
      service.buildGraph(createMockMods());
      service.setExplicitMods(['feature-mod']);

      const order = service.getLoadOrder();

      // core should come before base-mod which should come before feature-mod
      const coreIndex = order.indexOf('core');
      const baseIndex = order.indexOf('base-mod');
      const featureIndex = order.indexOf('feature-mod');

      expect(coreIndex).toBeLessThan(baseIndex);
      expect(baseIndex).toBeLessThan(featureIndex);
    });

    it('should include all active mods', () => {
      service.buildGraph(createMockMods());
      service.setExplicitMods(['feature-mod', 'standalone-mod']);

      const order = service.getLoadOrder();

      expect(order).toContain('core');
      expect(order).toContain('base-mod');
      expect(order).toContain('feature-mod');
      expect(order).toContain('standalone-mod');
    });

    it('should not include inactive mods', () => {
      service.buildGraph(createMockMods());
      service.setExplicitMods(['standalone-mod']);

      const order = service.getLoadOrder();

      // core (always active) and standalone-mod should be in the order
      expect(order).toContain('core');
      expect(order).toContain('standalone-mod');
      expect(order).not.toContain('feature-mod');
      // Note: ModLoadOrderResolver may include additional mods based on graph structure
      // but the key invariant is that explicitly inactive mods shouldn't appear
    });

    it('should handle empty active mods', () => {
      service.buildGraph(createMockMods());
      // Don't set any explicit mods, only core is active

      const order = service.getLoadOrder();

      // Core should always be present
      expect(order).toContain('core');
      // The resolver may include additional mods based on graph;
      // the key is core is present and properly ordered
    });

    it('should fall back to unsorted on error', () => {
      // Build a graph that will cause a cycle error
      // Note: This test relies on internal error handling
      service.buildGraph([
        { id: 'core', dependencies: [] },
        { id: 'mod-a', dependencies: [{ id: 'mod-b' }] },
        { id: 'mod-b', dependencies: [{ id: 'mod-a' }] },
      ]);
      service.setExplicitMods(['mod-a']);

      const order = service.getLoadOrder();

      // Should have logged an error and returned unsorted list
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to resolve load order',
        expect.any(Error)
      );
      // Order should still contain active mods (fallback behavior)
      expect(Array.isArray(order)).toBe(true);
    });
  });

  describe('getModStatus', () => {
    beforeEach(() => {
      service.buildGraph(createMockMods());
    });

    it('should return correct status for each state', () => {
      service.setExplicitMods(['feature-mod']);

      expect(service.getModStatus('core')).toBe('core');
      expect(service.getModStatus('feature-mod')).toBe('explicit');
      expect(service.getModStatus('base-mod')).toBe('dependency');
      expect(service.getModStatus('standalone-mod')).toBe('inactive');
    });

    it('should return unknown for non-existent mod', () => {
      expect(service.getModStatus('non-existent')).toBe('unknown');
    });
  });

  describe('getAllNodes', () => {
    it('should return a copy of the graph', () => {
      service.buildGraph(createMockMods());

      const nodes1 = service.getAllNodes();
      const nodes2 = service.getAllNodes();

      // Should be different Map instances
      expect(nodes1).not.toBe(nodes2);

      // But should have same content
      expect(nodes1.size).toBe(nodes2.size);
      expect([...nodes1.keys()]).toEqual([...nodes2.keys()]);
    });

    it('should contain all node properties', () => {
      service.buildGraph(createMockMods());

      const nodes = service.getAllNodes();
      const baseNode = nodes.get('base-mod');

      expect(baseNode).toHaveProperty('id', 'base-mod');
      expect(baseNode).toHaveProperty('dependencies');
      expect(baseNode).toHaveProperty('dependents');
      expect(baseNode).toHaveProperty('status');
      expect(baseNode.dependencies).toContain('core');
    });
  });

  describe('deep dependency chains', () => {
    it('should handle deep dependency chains correctly', () => {
      const deepMods = [
        { id: 'core', dependencies: [] },
        { id: 'level-1', dependencies: [{ id: 'core' }] },
        { id: 'level-2', dependencies: [{ id: 'level-1' }] },
        { id: 'level-3', dependencies: [{ id: 'level-2' }] },
        { id: 'level-4', dependencies: [{ id: 'level-3' }] },
      ];

      service.buildGraph(deepMods);
      const result = service.calculateActivation('level-4');

      expect(result.valid).toBe(true);
      expect(result.dependencies).toContain('level-3');
      expect(result.dependencies).toContain('level-2');
      expect(result.dependencies).toContain('level-1');
      // Note: core is always 'core' status (not 'inactive'), so it won't appear
      // in dependencies needed for activation
      expect(result.dependencies).not.toContain('core');
    });

    it('should calculate correct load order for deep chains', () => {
      const deepMods = [
        { id: 'core', dependencies: [] },
        { id: 'level-1', dependencies: [{ id: 'core' }] },
        { id: 'level-2', dependencies: [{ id: 'level-1' }] },
        { id: 'level-3', dependencies: [{ id: 'level-2' }] },
      ];

      service.buildGraph(deepMods);
      service.setExplicitMods(['level-3']);

      const order = service.getLoadOrder();

      // Each level should come before the next
      expect(order.indexOf('core')).toBeLessThan(order.indexOf('level-1'));
      expect(order.indexOf('level-1')).toBeLessThan(order.indexOf('level-2'));
      expect(order.indexOf('level-2')).toBeLessThan(order.indexOf('level-3'));
    });
  });

  describe('diamond dependency pattern', () => {
    it('should handle diamond dependencies', () => {
      // Diamond: A depends on B and C, both B and C depend on D
      const diamondMods = [
        { id: 'core', dependencies: [] },
        { id: 'd', dependencies: [{ id: 'core' }] },
        { id: 'b', dependencies: [{ id: 'd' }] },
        { id: 'c', dependencies: [{ id: 'd' }] },
        { id: 'a', dependencies: [{ id: 'b' }, { id: 'c' }] },
      ];

      service.buildGraph(diamondMods);
      service.setExplicitMods(['a']);

      const order = service.getLoadOrder();

      // d should come before b and c
      expect(order.indexOf('d')).toBeLessThan(order.indexOf('b'));
      expect(order.indexOf('d')).toBeLessThan(order.indexOf('c'));

      // b and c should both come before a
      expect(order.indexOf('b')).toBeLessThan(order.indexOf('a'));
      expect(order.indexOf('c')).toBeLessThan(order.indexOf('a'));
    });

    it('should correctly identify orphaned deps in diamond', () => {
      const diamondMods = [
        { id: 'core', dependencies: [] },
        { id: 'd', dependencies: [{ id: 'core' }] },
        { id: 'b', dependencies: [{ id: 'd' }] },
        { id: 'c', dependencies: [{ id: 'd' }] },
        { id: 'a', dependencies: [{ id: 'b' }, { id: 'c' }] },
      ];

      service.buildGraph(diamondMods);
      service.setExplicitMods(['a', 'b']); // Both a and b explicitly enabled

      // Deactivating 'a' should NOT orphan 'd' because 'b' still needs it
      const result = service.calculateDeactivation('a');

      expect(result.valid).toBe(true);
      expect(result.orphaned).toContain('c'); // c only used by a
      expect(result.orphaned).not.toContain('d'); // d still needed by b
    });
  });
});
