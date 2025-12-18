/**
 * @module graphUtils
 * @description Helper utilities for dependency graph operations.
 */

import ModDependencyError from '../errors/modDependencyError.js';
import { CORE_MOD_ID } from '../constants/core.js';

/**
 * Adds a directed edge to a graph represented by an adjacency list.
 *
 * @param {Map<string, Set<string>>} edges - The adjacency list.
 * @param {string} from - The starting node.
 * @param {string} to - The ending node.
 * @returns {void}
 */
export function addEdge(edges, from, to) {
  if (!edges.has(from)) {
    edges.set(from, new Set());
  }
  edges.get(from).add(to);
}

/**
 * Builds a dependency graph from a list of requested mods and all available manifests.
 * Only includes mods that are either explicitly requested or are transitive dependencies
 * of requested mods. Unrequested mods that happen to share dependencies are excluded.
 *
 * @param {string[]} requestedIds - The list of mod IDs requested by the user.
 * @param {Map<string, {id: string, dependencies?: Array<{id: string, required?: boolean}>}>} manifestsMap
 *   Map of all available mod manifests keyed by lowercase mod ID.
 * @returns {{nodes: Set<string>, edges: Map<string, Set<string>>}} The resulting graph.
 */
export function buildDependencyGraph(requestedIds, manifestsMap) {
  if (!Array.isArray(requestedIds)) {
    throw new Error('buildDependencyGraph: `requestedIds` must be an array.');
  }
  if (!(manifestsMap instanceof Map)) {
    throw new Error('buildDependencyGraph: `manifestsMap` must be a Map.');
  }

  const lcToOriginal = new Map();
  const originalCase = (id) => {
    const lc = String(id).toLowerCase();
    if (!lcToOriginal.has(lc)) lcToOriginal.set(lc, id);
    return lcToOriginal.get(lc);
  };

  // Seed original casing with requested IDs so error messages preserve caller intent.
  requestedIds.forEach((id) => {
    const lc = String(id).toLowerCase();
    if (!lcToOriginal.has(lc)) {
      lcToOriginal.set(lc, id);
    }
  });

  // Step 1: Compute transitive closure of requested mods
  // This determines which mods should actually be included in the graph
  const transitiveSet = new Set();
  const queue = [...requestedIds.map((id) => String(id).toLowerCase())];

  while (queue.length > 0) {
    const current = queue.shift();
    if (transitiveSet.has(current)) continue;
    transitiveSet.add(current);

    const manifest = manifestsMap.get(current);
    if (!manifest || !Array.isArray(manifest.dependencies)) continue;

    for (const dep of manifest.dependencies) {
      if (!dep || typeof dep.id !== 'string') continue;
      const depLower = dep.id.toLowerCase();
      const isRequired = dep.required !== false;
      const isDepManifestPresent = manifestsMap.has(depLower);

      // Validate required dependencies exist
      if (isRequired && !isDepManifestPresent) {
        throw new ModDependencyError(
          `MISSING_DEPENDENCY: Mod '${originalCase(current)}' requires mod '${originalCase(dep.id)}', but the manifest for '${originalCase(dep.id)}' was not found.`
        );
      }

      // Only traverse required dependencies
      if (isRequired && !transitiveSet.has(depLower)) {
        queue.push(depLower);
      }
    }
  }

  // Always include core mod if not already included
  transitiveSet.add(CORE_MOD_ID.toLowerCase());
  originalCase(CORE_MOD_ID);

  // Step 2: Build the graph from only the transitive closure
  const nodes = new Set();
  const edges = new Map();

  for (const reqId of requestedIds) {
    const orig = originalCase(reqId);
    nodes.add(orig);

    if (orig.toLowerCase() !== CORE_MOD_ID) {
      nodes.add(CORE_MOD_ID);
      addEdge(edges, CORE_MOD_ID, orig);
    }
  }

  // Only process manifests that are in the transitive closure
  for (const manifest of manifestsMap.values()) {
    if (!manifest || typeof manifest.id !== 'string') continue;

    const modLower = manifest.id.toLowerCase();
    // Skip manifests not in the transitive closure
    if (!transitiveSet.has(modLower)) continue;

    const modOrig = originalCase(manifest.id);
    const deps = Array.isArray(manifest.dependencies)
      ? manifest.dependencies
      : [];

    for (const dep of deps) {
      if (!dep || typeof dep.id !== 'string') continue;

      const depOrig = originalCase(dep.id);
      const depLower = dep.id.toLowerCase();
      const isDepInTransitive = transitiveSet.has(depLower);

      // Only add edges for dependencies that are in the transitive closure
      // This includes both required and optional dependencies (if the dependency is also requested)
      if (isDepInTransitive) {
        nodes.add(depOrig);
        addEdge(edges, depOrig, modOrig);
      }
    }
  }

  return { nodes, edges };
}

/**
 * Creates a minimal heap data structure for stable sorting.
 *
 * @param {(value: any) => number} keyFn - Function returning the priority for a value.
 * @returns {{push: function(any): void, pop: function(): any, size: function(): number}} Min-heap API.
 */
export function createMinHeap(keyFn) {
  const data = [];
  const swap = (i, j) => {
    [data[i], data[j]] = [data[j], data[i]];
  };

  const up = (i) => {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keyFn(data[i]) >= keyFn(data[p])) break;
      swap(i, p);
      i = p;
    }
  };

  const down = (i) => {
    for (;;) {
      const l = (i << 1) + 1;
      const r = l + 1;
      let s = i;
      if (l < data.length && keyFn(data[l]) < keyFn(data[s])) s = l;
      if (r < data.length && keyFn(data[r]) < keyFn(data[s])) s = r;
      if (s === i) break;
      swap(i, s);
      i = s;
    }
  };

  return {
    push(v) {
      data.push(v);
      up(data.length - 1);
    },
    pop() {
      if (!data.length) return undefined;
      const top = data[0];
      const end = data.pop();
      if (data.length) {
        data[0] = end;
        down(0);
      }
      return top;
    },
    size() {
      return data.length;
    },
  };
}
