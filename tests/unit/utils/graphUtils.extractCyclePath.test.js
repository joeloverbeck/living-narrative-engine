/**
 * @file Unit tests for extractCyclePath function in graphUtils.js
 */

import { describe, it, expect } from '@jest/globals';
import { extractCyclePath, addEdge } from '../../../src/utils/graphUtils.js';

describe('extractCyclePath', () => {
  describe('edge cases', () => {
    it('should return empty arrays when cycleNodes is null', () => {
      const edges = new Map();
      const result = extractCyclePath(edges, null);

      expect(result.cycle).toEqual([]);
      expect(result.involvedNodes).toEqual([]);
    });

    it('should return empty arrays when cycleNodes is an empty set', () => {
      const edges = new Map();
      const cycleNodes = new Set();
      const result = extractCyclePath(edges, cycleNodes);

      expect(result.cycle).toEqual([]);
      expect(result.involvedNodes).toEqual([]);
    });

    it('should return empty arrays when cycleNodes is undefined', () => {
      const edges = new Map();
      const result = extractCyclePath(edges, undefined);

      expect(result.cycle).toEqual([]);
      expect(result.involvedNodes).toEqual([]);
    });
  });

  describe('simple two-node cycle (A ↔ B)', () => {
    it('should detect a simple bidirectional cycle', () => {
      // Graph: A → B → A
      const edges = new Map();
      addEdge(edges, 'A', 'B');
      addEdge(edges, 'B', 'A');

      const cycleNodes = new Set(['A', 'B']);
      const result = extractCyclePath(edges, cycleNodes);

      // Should find cycle like ['A', 'B', 'A'] or ['B', 'A', 'B']
      expect(result.cycle.length).toBe(3);
      expect(result.cycle[0]).toBe(result.cycle[result.cycle.length - 1]);
      expect(result.involvedNodes).toContain('A');
      expect(result.involvedNodes).toContain('B');
    });
  });

  describe('three-node cycle (A → B → C → A)', () => {
    it('should detect a triangular cycle', () => {
      // Graph: A → B → C → A
      const edges = new Map();
      addEdge(edges, 'A', 'B');
      addEdge(edges, 'B', 'C');
      addEdge(edges, 'C', 'A');

      const cycleNodes = new Set(['A', 'B', 'C']);
      const result = extractCyclePath(edges, cycleNodes);

      // Should find cycle like ['A', 'B', 'C', 'A']
      expect(result.cycle.length).toBe(4);
      expect(result.cycle[0]).toBe(result.cycle[result.cycle.length - 1]);
      expect(result.involvedNodes).toHaveLength(3);
    });
  });

  describe('complex graph with multiple cycles', () => {
    it('should find at least one cycle in a complex graph', () => {
      // Graph with multiple cycles:
      // A → B → C → A (triangle)
      // B → D → B (another cycle through B)
      const edges = new Map();
      addEdge(edges, 'A', 'B');
      addEdge(edges, 'B', 'C');
      addEdge(edges, 'C', 'A');
      addEdge(edges, 'B', 'D');
      addEdge(edges, 'D', 'B');

      const cycleNodes = new Set(['A', 'B', 'C', 'D']);
      const result = extractCyclePath(edges, cycleNodes);

      // Should find any valid cycle
      expect(result.cycle.length).toBeGreaterThanOrEqual(3);
      expect(result.cycle[0]).toBe(result.cycle[result.cycle.length - 1]);
      expect(result.involvedNodes.length).toBe(4);
    });
  });

  describe('real-world mod dependency scenario', () => {
    it('should detect cycle between facing-states and personal-space-states', () => {
      // Simulating the actual cycle we found:
      // facing-states → personal-space-states → facing-states
      const edges = new Map();
      addEdge(edges, 'facing-states', 'personal-space-states');
      addEdge(edges, 'personal-space-states', 'facing-states');

      const cycleNodes = new Set(['facing-states', 'personal-space-states']);
      const result = extractCyclePath(edges, cycleNodes);

      expect(result.cycle.length).toBe(3);
      expect(result.cycle[0]).toBe(result.cycle[result.cycle.length - 1]);
      expect(result.cycle).toContain('facing-states');
      expect(result.cycle).toContain('personal-space-states');
    });
  });

  describe('involvedNodes tracking', () => {
    it('should return all nodes from cycleNodes in involvedNodes', () => {
      const edges = new Map();
      addEdge(edges, 'A', 'B');
      addEdge(edges, 'B', 'A');

      const cycleNodes = new Set(['A', 'B']);
      const result = extractCyclePath(edges, cycleNodes);

      expect(result.involvedNodes).toHaveLength(2);
      expect(result.involvedNodes).toContain('A');
      expect(result.involvedNodes).toContain('B');
    });
  });

  describe('cycle with nodes having no outgoing edges in subgraph', () => {
    it('should handle nodes in cycleNodes that have no edges to other cycle nodes', () => {
      // Graph: A → B → A, C is isolated but in cycleNodes
      const edges = new Map();
      addEdge(edges, 'A', 'B');
      addEdge(edges, 'B', 'A');
      addEdge(edges, 'A', 'C'); // C has no outgoing edges to cycle nodes

      const cycleNodes = new Set(['A', 'B', 'C']);
      const result = extractCyclePath(edges, cycleNodes);

      // Should still find the A-B cycle
      expect(result.cycle.length).toBeGreaterThanOrEqual(3);
      expect(result.cycle[0]).toBe(result.cycle[result.cycle.length - 1]);
      expect(result.involvedNodes).toHaveLength(3);
    });
  });
});
