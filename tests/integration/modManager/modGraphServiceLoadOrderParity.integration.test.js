/**
 * @file Integration tests for ModGraphService load order parity
 * @description Verifies that getLoadOrder() returns exactly the mods that are marked as active
 * in the graph, ensuring consistency between active mod count and load order count.
 *
 * This test addresses the bug where unrequested mods sharing dependencies with requested mods
 * were incorrectly included in the load order but not shown as active in the UI.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ModGraphService } from '../../../src/modManager/services/ModGraphService.js';

describe('ModGraphService - Load Order Parity', () => {
  let mockLogger;
  let service;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    service = new ModGraphService({ logger: mockLogger });
  });

  describe('active mods vs load order consistency', () => {
    it('should have matching counts between active mods and load order', () => {
      const mockMods = [
        { id: 'core', dependencies: [] },
        { id: 'dredgers', dependencies: [{ id: 'anatomy' }, { id: 'locations' }] },
        { id: 'anatomy', dependencies: [{ id: 'descriptors' }] },
        { id: 'locations', dependencies: [{ id: 'core' }] },
        { id: 'descriptors', dependencies: [] },
        // Unrequested mods that share dependencies - should NOT be included
        { id: 'sex-core', dependencies: [{ id: 'anatomy' }] },
        { id: 'hexing', dependencies: [{ id: 'anatomy' }] },
      ];

      service.buildGraph(mockMods);
      service.setExplicitMods(['dredgers']);

      const loadOrder = service.getLoadOrder();
      const allNodes = service.getAllNodes();
      const activeNodes = [...allNodes.values()].filter(
        (n) => n.status !== 'inactive'
      );

      expect(loadOrder.length).toBe(activeNodes.length);
    });

    it('should not include unrequested mods in load order even if they share dependencies', () => {
      const mockMods = [
        { id: 'core', dependencies: [] },
        { id: 'mod-a', dependencies: [{ id: 'shared-dep' }] },
        { id: 'shared-dep', dependencies: [{ id: 'core' }] },
        // mod-b shares shared-dep but is NOT requested
        { id: 'mod-b', dependencies: [{ id: 'shared-dep' }] },
        // mod-c also shares shared-dep but is NOT requested
        { id: 'mod-c', dependencies: [{ id: 'shared-dep' }] },
      ];

      service.buildGraph(mockMods);
      service.setExplicitMods(['mod-a']);

      const loadOrder = service.getLoadOrder();

      expect(loadOrder).toContain('core');
      expect(loadOrder).toContain('mod-a');
      expect(loadOrder).toContain('shared-dep');
      expect(loadOrder).not.toContain('mod-b');
      expect(loadOrder).not.toContain('mod-c');
    });

    it('should include transitive dependencies but not unrelated mods', () => {
      const mockMods = [
        { id: 'core', dependencies: [] },
        { id: 'requested', dependencies: [{ id: 'dep-a' }] },
        { id: 'dep-a', dependencies: [{ id: 'dep-b' }] },
        { id: 'dep-b', dependencies: [{ id: 'core' }] },
        // These share no path to 'requested' but share the same base dependency
        { id: 'unrelated-1', dependencies: [{ id: 'dep-b' }] },
        { id: 'unrelated-2', dependencies: [{ id: 'dep-a' }] },
      ];

      service.buildGraph(mockMods);
      service.setExplicitMods(['requested']);

      const loadOrder = service.getLoadOrder();

      // Should include requested and its chain
      expect(loadOrder).toContain('core');
      expect(loadOrder).toContain('requested');
      expect(loadOrder).toContain('dep-a');
      expect(loadOrder).toContain('dep-b');

      // Should NOT include unrelated mods
      expect(loadOrder).not.toContain('unrelated-1');
      expect(loadOrder).not.toContain('unrelated-2');

      // Verify exact count (core + requested + dep-a + dep-b = 4)
      expect(loadOrder.length).toBe(4);
    });

    it('should correctly handle diamond dependency without including unrequested branches', () => {
      // Diamond: A depends on B and C, both B and C depend on D
      // Also: E depends on D (unrequested branch)
      const mockMods = [
        { id: 'core', dependencies: [] },
        { id: 'A', dependencies: [{ id: 'B' }, { id: 'C' }] },
        { id: 'B', dependencies: [{ id: 'D' }] },
        { id: 'C', dependencies: [{ id: 'D' }] },
        { id: 'D', dependencies: [{ id: 'core' }] },
        // E shares D but is NOT requested
        { id: 'E', dependencies: [{ id: 'D' }] },
      ];

      service.buildGraph(mockMods);
      service.setExplicitMods(['A']);

      const loadOrder = service.getLoadOrder();

      // Should include A and all its dependencies
      expect(loadOrder).toContain('core');
      expect(loadOrder).toContain('A');
      expect(loadOrder).toContain('B');
      expect(loadOrder).toContain('C');
      expect(loadOrder).toContain('D');

      // Should NOT include E
      expect(loadOrder).not.toContain('E');

      // Verify exact count
      expect(loadOrder.length).toBe(5);
    });

    it('should handle multiple explicit mods correctly', () => {
      const mockMods = [
        { id: 'core', dependencies: [] },
        { id: 'mod-x', dependencies: [{ id: 'shared' }] },
        { id: 'mod-y', dependencies: [{ id: 'shared' }] },
        { id: 'shared', dependencies: [{ id: 'core' }] },
        // mod-z shares 'shared' but is NOT explicitly requested
        { id: 'mod-z', dependencies: [{ id: 'shared' }] },
      ];

      service.buildGraph(mockMods);
      service.setExplicitMods(['mod-x', 'mod-y']);

      const loadOrder = service.getLoadOrder();

      expect(loadOrder).toContain('core');
      expect(loadOrder).toContain('mod-x');
      expect(loadOrder).toContain('mod-y');
      expect(loadOrder).toContain('shared');
      expect(loadOrder).not.toContain('mod-z');

      // Verify count matches active mods
      const allNodes = service.getAllNodes();
      const activeNodes = [...allNodes.values()].filter(
        (n) => n.status !== 'inactive'
      );
      expect(loadOrder.length).toBe(activeNodes.length);
    });

    it('should match load order with active status for realistic mod structure', () => {
      // Simulate dredgers scenario with many unrequested mods
      const mockMods = [
        { id: 'core', dependencies: [] },
        { id: 'descriptors', dependencies: [{ id: 'core' }] },
        { id: 'anatomy', dependencies: [{ id: 'descriptors' }] },
        { id: 'locations', dependencies: [{ id: 'core' }] },
        { id: 'dredgers', dependencies: [{ id: 'anatomy' }, { id: 'locations' }] },
        // All these share 'anatomy' but are NOT requested
        { id: 'sex-core', dependencies: [{ id: 'anatomy' }] },
        { id: 'sex-vaginal', dependencies: [{ id: 'sex-core' }] },
        { id: 'sex-anal', dependencies: [{ id: 'sex-core' }] },
        { id: 'intimacy', dependencies: [{ id: 'anatomy' }] },
        { id: 'hexing', dependencies: [{ id: 'anatomy' }] },
        { id: 'music', dependencies: [{ id: 'core' }] },
        { id: 'violence', dependencies: [{ id: 'anatomy' }] },
      ];

      service.buildGraph(mockMods);
      service.setExplicitMods(['dredgers']);

      const loadOrder = service.getLoadOrder();
      const allNodes = service.getAllNodes();
      const activeNodeIds = [...allNodes.values()]
        .filter((n) => n.status !== 'inactive')
        .map((n) => n.id);

      // Verify parity
      expect(loadOrder.length).toBe(activeNodeIds.length);

      // Verify load order contains exactly the active mods
      for (const id of loadOrder) {
        expect(activeNodeIds).toContain(id);
      }
      for (const id of activeNodeIds) {
        expect(loadOrder).toContain(id);
      }

      // Verify unrequested mods are not included
      expect(loadOrder).not.toContain('sex-core');
      expect(loadOrder).not.toContain('sex-vaginal');
      expect(loadOrder).not.toContain('sex-anal');
      expect(loadOrder).not.toContain('intimacy');
      expect(loadOrder).not.toContain('hexing');
      expect(loadOrder).not.toContain('music');
      expect(loadOrder).not.toContain('violence');

      // Expected: core, descriptors, anatomy, locations, dredgers = 5
      expect(loadOrder.length).toBe(5);
    });
  });
});
