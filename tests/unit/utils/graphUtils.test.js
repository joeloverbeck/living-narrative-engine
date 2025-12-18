/**
 * @file Unit tests for graphUtils module
 * @see src/utils/graphUtils.js
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  addEdge,
  buildDependencyGraph,
  createMinHeap,
} from '../../../src/utils/graphUtils.js';
import ModDependencyError from '../../../src/errors/modDependencyError.js';
import { CORE_MOD_ID } from '../../../src/constants/core.js';

describe('graphUtils', () => {
  describe('addEdge', () => {
    let edges;

    beforeEach(() => {
      edges = new Map();
    });

    it('should add an edge to an empty graph', () => {
      addEdge(edges, 'A', 'B');

      expect(edges.has('A')).toBe(true);
      expect(edges.get('A').has('B')).toBe(true);
      expect(edges.get('A').size).toBe(1);
    });

    it('should add an edge when the from node already exists', () => {
      edges.set('A', new Set(['C']));

      addEdge(edges, 'A', 'B');

      expect(edges.get('A').has('B')).toBe(true);
      expect(edges.get('A').has('C')).toBe(true);
      expect(edges.get('A').size).toBe(2);
    });

    it('should handle multiple edges from the same node', () => {
      addEdge(edges, 'A', 'B');
      addEdge(edges, 'A', 'C');
      addEdge(edges, 'A', 'D');

      expect(edges.get('A').size).toBe(3);
      expect(Array.from(edges.get('A'))).toEqual(['B', 'C', 'D']);
    });

    it('should handle self-referencing edges', () => {
      addEdge(edges, 'A', 'A');

      expect(edges.get('A').has('A')).toBe(true);
    });

    it('should not duplicate edges', () => {
      addEdge(edges, 'A', 'B');
      addEdge(edges, 'A', 'B');

      expect(edges.get('A').size).toBe(1);
    });
  });

  describe('buildDependencyGraph', () => {
    it('should throw an error if requestedIds is not an array', () => {
      const manifestsMap = new Map();

      expect(() => buildDependencyGraph('not-an-array', manifestsMap)).toThrow(
        'buildDependencyGraph: `requestedIds` must be an array.'
      );

      expect(() => buildDependencyGraph(null, manifestsMap)).toThrow(
        'buildDependencyGraph: `requestedIds` must be an array.'
      );

      expect(() => buildDependencyGraph(undefined, manifestsMap)).toThrow(
        'buildDependencyGraph: `requestedIds` must be an array.'
      );

      expect(() => buildDependencyGraph({}, manifestsMap)).toThrow(
        'buildDependencyGraph: `requestedIds` must be an array.'
      );
    });

    it('should throw an error if manifestsMap is not a Map', () => {
      const requestedIds = ['mod1'];

      expect(() => buildDependencyGraph(requestedIds, [])).toThrow(
        'buildDependencyGraph: `manifestsMap` must be a Map.'
      );

      expect(() => buildDependencyGraph(requestedIds, {})).toThrow(
        'buildDependencyGraph: `manifestsMap` must be a Map.'
      );

      expect(() => buildDependencyGraph(requestedIds, null)).toThrow(
        'buildDependencyGraph: `manifestsMap` must be a Map.'
      );
    });

    it('should handle empty requested IDs', () => {
      const manifestsMap = new Map();
      const { nodes, edges } = buildDependencyGraph([], manifestsMap);

      expect(nodes.size).toBe(0);
      expect(edges.size).toBe(0);
    });

    it('should add core dependency for non-core mods', () => {
      const requestedIds = ['myMod'];
      const manifestsMap = new Map([['mymod', { id: 'myMod' }]]);

      const { nodes, edges } = buildDependencyGraph(requestedIds, manifestsMap);

      expect(nodes.has('myMod')).toBe(true);
      expect(nodes.has(CORE_MOD_ID)).toBe(true);
      expect(edges.get(CORE_MOD_ID).has('myMod')).toBe(true);
    });

    it('should not add core as dependency of itself', () => {
      const requestedIds = [CORE_MOD_ID];
      const manifestsMap = new Map([
        [CORE_MOD_ID.toLowerCase(), { id: CORE_MOD_ID }],
      ]);

      const { nodes, edges } = buildDependencyGraph(requestedIds, manifestsMap);

      expect(nodes.has(CORE_MOD_ID)).toBe(true);
      expect(nodes.size).toBe(1);
      expect(edges.has(CORE_MOD_ID)).toBe(false);
    });

    it('should handle case-insensitive mod IDs', () => {
      const requestedIds = ['MyMod', 'AnotherMod'];
      const manifestsMap = new Map([
        ['mymod', { id: 'MyMod' }],
        ['anothermod', { id: 'AnotherMod' }],
      ]);

      const { nodes } = buildDependencyGraph(requestedIds, manifestsMap);

      expect(nodes.has('MyMod')).toBe(true);
      expect(nodes.has('AnotherMod')).toBe(true);
    });

    it('should process required dependencies', () => {
      const requestedIds = ['mod1'];
      const manifestsMap = new Map([
        [
          'mod1',
          {
            id: 'mod1',
            dependencies: [{ id: 'mod2', required: true }],
          },
        ],
        ['mod2', { id: 'mod2' }],
      ]);

      const { nodes, edges } = buildDependencyGraph(requestedIds, manifestsMap);

      expect(nodes.has('mod1')).toBe(true);
      expect(nodes.has('mod2')).toBe(true);
      expect(edges.get('mod2').has('mod1')).toBe(true);
    });

    it('should ignore optional dependencies that are not requested', () => {
      const requestedIds = ['mod1'];
      const manifestsMap = new Map([
        [
          'mod1',
          {
            id: 'mod1',
            dependencies: [{ id: 'mod2', required: false }],
          },
        ],
        ['mod2', { id: 'mod2' }],
      ]);

      const { nodes } = buildDependencyGraph(requestedIds, manifestsMap);

      expect(nodes.has('mod1')).toBe(true);
      expect(nodes.has('mod2')).toBe(false);
    });

    it('should include optional dependencies if requested', () => {
      const requestedIds = ['mod1', 'mod2'];
      const manifestsMap = new Map([
        [
          'mod1',
          {
            id: 'mod1',
            dependencies: [{ id: 'mod2', required: false }],
          },
        ],
        ['mod2', { id: 'mod2' }],
      ]);

      const { nodes, edges } = buildDependencyGraph(requestedIds, manifestsMap);

      expect(nodes.has('mod1')).toBe(true);
      expect(nodes.has('mod2')).toBe(true);
      expect(edges.get('mod2').has('mod1')).toBe(true);
    });

    it('should throw ModDependencyError for missing required dependency', () => {
      const requestedIds = ['mod1'];
      const manifestsMap = new Map([
        [
          'mod1',
          {
            id: 'mod1',
            dependencies: [{ id: 'missingMod', required: true }],
          },
        ],
      ]);

      expect(() => buildDependencyGraph(requestedIds, manifestsMap)).toThrow(
        ModDependencyError
      );

      expect(() => buildDependencyGraph(requestedIds, manifestsMap)).toThrow(
        "MISSING_DEPENDENCY: Mod 'mod1' requires mod 'missingMod', but the manifest for 'missingMod' was not found."
      );
    });

    it('should handle complex dependency chains', () => {
      const requestedIds = ['mod3'];
      const manifestsMap = new Map([
        ['mod1', { id: 'mod1' }],
        [
          'mod2',
          {
            id: 'mod2',
            dependencies: [{ id: 'mod1', required: true }],
          },
        ],
        [
          'mod3',
          {
            id: 'mod3',
            dependencies: [{ id: 'mod2', required: true }],
          },
        ],
      ]);

      const { nodes, edges } = buildDependencyGraph(requestedIds, manifestsMap);

      expect(nodes.has('mod1')).toBe(true);
      expect(nodes.has('mod2')).toBe(true);
      expect(nodes.has('mod3')).toBe(true);
      expect(edges.get('mod1').has('mod2')).toBe(true);
      expect(edges.get('mod2').has('mod3')).toBe(true);
    });

    it('should skip manifests without valid id', () => {
      const requestedIds = ['mod1'];
      const manifestsMap = new Map([
        ['mod1', { id: 'mod1' }],
        ['invalid1', null],
        ['invalid2', { id: null }],
        ['invalid3', { id: 123 }],
      ]);

      const { nodes } = buildDependencyGraph(requestedIds, manifestsMap);

      expect(nodes.has('mod1')).toBe(true);
      expect(nodes.size).toBe(2); // mod1 and core
    });

    it('should skip invalid dependencies', () => {
      const requestedIds = ['mod1'];
      const manifestsMap = new Map([
        [
          'mod1',
          {
            id: 'mod1',
            dependencies: [
              null,
              { id: null },
              { id: 123 },
              { id: 'validDep', required: true },
            ],
          },
        ],
        ['validdep', { id: 'validDep' }],
      ]);

      const { nodes } = buildDependencyGraph(requestedIds, manifestsMap);

      expect(nodes.has('mod1')).toBe(true);
      expect(nodes.has('validDep')).toBe(true);
      expect(nodes.size).toBe(3); // mod1, validDep, and core
    });

    it('should handle non-array dependencies gracefully', () => {
      const requestedIds = ['mod1'];
      const manifestsMap = new Map([
        [
          'mod1',
          {
            id: 'mod1',
            dependencies: 'not-an-array',
          },
        ],
      ]);

      const { nodes } = buildDependencyGraph(requestedIds, manifestsMap);

      expect(nodes.has('mod1')).toBe(true);
      expect(nodes.size).toBe(2); // mod1 and core
    });

    it('should handle string coercion for IDs', () => {
      // The function calls String() on IDs, so we test with various values
      const requestedIds = ['123', 'true', 'myMod'];
      const manifestsMap = new Map([
        ['123', { id: '123' }],
        ['true', { id: 'true' }],
        ['mymod', { id: 'myMod' }],
      ]);

      const { nodes } = buildDependencyGraph(requestedIds, manifestsMap);

      expect(nodes.has('123')).toBe(true);
      expect(nodes.has('true')).toBe(true);
      expect(nodes.has('myMod')).toBe(true);
    });
  });

  describe('buildDependencyGraph - unrequested mod filtering', () => {
    it('should not include mods that share dependencies but were not requested', () => {
      // BUG REPRODUCTION: If mod-a depends on shared-dep, and mod-b also depends on shared-dep,
      // but only mod-a is requested, mod-b should NOT appear in the graph.
      const requestedIds = ['mod-a'];
      const manifestsMap = new Map([
        ['core', { id: 'core', dependencies: [] }],
        ['mod-a', { id: 'mod-a', dependencies: [{ id: 'shared-dep', required: true }] }],
        ['shared-dep', { id: 'shared-dep', dependencies: [] }],
        ['mod-b', { id: 'mod-b', dependencies: [{ id: 'shared-dep', required: true }] }], // NOT requested
      ]);

      const { nodes } = buildDependencyGraph(requestedIds, manifestsMap);

      expect(nodes.has('mod-a')).toBe(true);
      expect(nodes.has('shared-dep')).toBe(true);
      expect(nodes.has(CORE_MOD_ID)).toBe(true);
      expect(nodes.has('mod-b')).toBe(false); // SHOULD NOT be included
    });

    it('should include all transitive dependencies of requested mods', () => {
      const requestedIds = ['mod-a'];
      const manifestsMap = new Map([
        ['core', { id: 'core', dependencies: [] }],
        ['mod-a', { id: 'mod-a', dependencies: [{ id: 'mod-b', required: true }] }],
        ['mod-b', { id: 'mod-b', dependencies: [{ id: 'mod-c', required: true }] }],
        ['mod-c', { id: 'mod-c', dependencies: [] }],
        ['unrelated', { id: 'unrelated', dependencies: [] }], // NOT in dependency chain
      ]);

      const { nodes, edges } = buildDependencyGraph(requestedIds, manifestsMap);

      expect(nodes.has('mod-a')).toBe(true);
      expect(nodes.has('mod-b')).toBe(true);
      expect(nodes.has('mod-c')).toBe(true);
      expect(nodes.has('unrelated')).toBe(false); // Should NOT be included
      // Verify edges are correct
      expect(edges.get('mod-b').has('mod-a')).toBe(true);
      expect(edges.get('mod-c').has('mod-b')).toBe(true);
    });

    it('should not include mods that only share transitive dependencies', () => {
      // Scenario: dredgers depends on anatomy, sex-core also depends on anatomy
      // Only dredgers is requested, sex-core should NOT appear
      const requestedIds = ['dredgers'];
      const manifestsMap = new Map([
        ['core', { id: 'core', dependencies: [] }],
        ['dredgers', { id: 'dredgers', dependencies: [{ id: 'anatomy', required: true }] }],
        ['anatomy', { id: 'anatomy', dependencies: [{ id: 'descriptors', required: true }] }],
        ['descriptors', { id: 'descriptors', dependencies: [] }],
        ['sex-core', { id: 'sex-core', dependencies: [{ id: 'anatomy', required: true }] }], // NOT requested
        ['hexing', { id: 'hexing', dependencies: [{ id: 'anatomy', required: true }] }], // NOT requested
      ]);

      const { nodes } = buildDependencyGraph(requestedIds, manifestsMap);

      // Should include: core, dredgers, anatomy, descriptors
      expect(nodes.has('core')).toBe(true);
      expect(nodes.has('dredgers')).toBe(true);
      expect(nodes.has('anatomy')).toBe(true);
      expect(nodes.has('descriptors')).toBe(true);

      // Should NOT include: sex-core, hexing
      expect(nodes.has('sex-core')).toBe(false);
      expect(nodes.has('hexing')).toBe(false);
    });

    it('should handle diamond dependencies correctly without including unrequested mods', () => {
      // Diamond: A depends on B and C, both B and C depend on D
      // Unrelated mod E also depends on D but shouldn't be included
      const requestedIds = ['a'];
      const manifestsMap = new Map([
        ['core', { id: 'core', dependencies: [] }],
        ['a', { id: 'a', dependencies: [{ id: 'b', required: true }, { id: 'c', required: true }] }],
        ['b', { id: 'b', dependencies: [{ id: 'd', required: true }] }],
        ['c', { id: 'c', dependencies: [{ id: 'd', required: true }] }],
        ['d', { id: 'd', dependencies: [] }],
        ['e', { id: 'e', dependencies: [{ id: 'd', required: true }] }], // NOT requested
      ]);

      const { nodes } = buildDependencyGraph(requestedIds, manifestsMap);

      expect(nodes.has('a')).toBe(true);
      expect(nodes.has('b')).toBe(true);
      expect(nodes.has('c')).toBe(true);
      expect(nodes.has('d')).toBe(true);
      expect(nodes.has('e')).toBe(false); // SHOULD NOT be included
    });
  });

  describe('createMinHeap', () => {
    it('should create an empty heap', () => {
      const heap = createMinHeap((x) => x);

      expect(heap.size()).toBe(0);
      expect(heap.pop()).toBeUndefined();
    });

    it('should maintain min heap property with single element', () => {
      const heap = createMinHeap((x) => x);

      heap.push(5);

      expect(heap.size()).toBe(1);
      expect(heap.pop()).toBe(5);
      expect(heap.size()).toBe(0);
    });

    it('should maintain min heap property with multiple elements', () => {
      const heap = createMinHeap((x) => x);
      const elements = [5, 3, 7, 1, 9, 2, 8, 4, 6];

      elements.forEach((el) => heap.push(el));

      const sorted = [];
      while (heap.size() > 0) {
        sorted.push(heap.pop());
      }

      expect(sorted).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('should work with custom key functions', () => {
      const heap = createMinHeap((obj) => obj.priority);
      const items = [
        { name: 'A', priority: 3 },
        { name: 'B', priority: 1 },
        { name: 'C', priority: 4 },
        { name: 'D', priority: 2 },
      ];

      items.forEach((item) => heap.push(item));

      expect(heap.pop().name).toBe('B');
      expect(heap.pop().name).toBe('D');
      expect(heap.pop().name).toBe('A');
      expect(heap.pop().name).toBe('C');
    });

    it('should handle duplicate priorities correctly', () => {
      const heap = createMinHeap((x) => x);

      heap.push(3);
      heap.push(3);
      heap.push(3);

      expect(heap.pop()).toBe(3);
      expect(heap.pop()).toBe(3);
      expect(heap.pop()).toBe(3);
      expect(heap.pop()).toBeUndefined();
    });

    it('should handle large heaps efficiently', () => {
      const heap = createMinHeap((x) => x);
      const n = 1000;

      // Push random numbers
      const numbers = [];
      for (let i = 0; i < n; i++) {
        const num = Math.floor(Math.random() * 1000);
        numbers.push(num);
        heap.push(num);
      }

      // Pop all and verify they come out sorted
      numbers.sort((a, b) => a - b);
      for (let i = 0; i < n; i++) {
        expect(heap.pop()).toBe(numbers[i]);
      }

      expect(heap.size()).toBe(0);
    });

    it('should handle edge case of alternating push/pop operations', () => {
      const heap = createMinHeap((x) => x);

      heap.push(5);
      heap.push(3);
      expect(heap.pop()).toBe(3);

      heap.push(1);
      heap.push(7);
      expect(heap.pop()).toBe(1);
      expect(heap.pop()).toBe(5);

      heap.push(2);
      expect(heap.pop()).toBe(2);
      expect(heap.pop()).toBe(7);
      expect(heap.pop()).toBeUndefined();
    });

    it('should handle negative numbers correctly', () => {
      const heap = createMinHeap((x) => x);

      heap.push(-5);
      heap.push(3);
      heap.push(-10);
      heap.push(0);
      heap.push(-2);

      expect(heap.pop()).toBe(-10);
      expect(heap.pop()).toBe(-5);
      expect(heap.pop()).toBe(-2);
      expect(heap.pop()).toBe(0);
      expect(heap.pop()).toBe(3);
    });

    it('should trigger all branches in up and down functions', () => {
      const heap = createMinHeap((x) => x);

      // Build a heap that will exercise all paths
      // This creates a specific heap structure to trigger all branches
      const values = [10, 15, 20, 25, 30, 35, 40, 45, 50];
      values.forEach((v) => heap.push(v));

      // Now push smaller values to trigger bubbling up through different paths
      heap.push(5); // Will bubble all the way up
      heap.push(12); // Will bubble partially up
      heap.push(22); // Will stop early

      // Pop elements to trigger down function branches
      const results = [];
      while (heap.size() > 0) {
        results.push(heap.pop());
      }

      // Verify heap was correct
      const expected = [5, 10, 12, 15, 20, 22, 25, 30, 35, 40, 45, 50];
      expect(results).toEqual(expected);
    });

    it('should handle heap with only two elements correctly', () => {
      const heap = createMinHeap((x) => x);

      heap.push(2);
      heap.push(1);

      expect(heap.pop()).toBe(1);
      expect(heap.pop()).toBe(2);
      expect(heap.pop()).toBeUndefined();
    });

    it('should handle complex heap reorganization', () => {
      const heap = createMinHeap((x) => x);

      // Create a specific structure that requires complex reorganization
      [7, 4, 9, 2, 6, 8, 10, 1, 3, 5].forEach((v) => heap.push(v));

      // This should trigger various branches in the down function
      expect(heap.pop()).toBe(1); // Removing min causes major reorganization

      // Add element that needs to bubble up through multiple levels
      heap.push(0);

      expect(heap.pop()).toBe(0);

      // Continue popping to ensure heap integrity
      const remaining = [];
      while (heap.size() > 0) {
        remaining.push(heap.pop());
      }

      expect(remaining).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });
  });
});
