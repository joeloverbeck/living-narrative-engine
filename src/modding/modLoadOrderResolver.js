/**
 * @file Resolves the load order of mods based on dependencies.
 * @typedef {import('../interfaces/coreServices.js').ILogger}  ILogger
 * @typedef {import('./modDependencyValidator.js').ModManifest} ModManifest
 */

import ModDependencyError from '../errors/modDependencyError.js';
import { CORE_MOD_ID } from '../constants/core';

/*─────────────────────────────────────────────────────────────────────────*/
/* Private Helper Functions                                                */
/*─────────────────────────────────────────────────────────────────────────*/

/**
 * Adds a directed edge to the graph representation.
 *
 * @param {Map<string, Set<string>>} edges - The adjacency list.
 * @param {string} from - The starting node.
 * @param {string} to - The ending node.
 */
function addEdge(edges, from, to) {
  if (!edges.has(from)) {
    edges.set(from, new Set());
  }
  edges.get(from).add(to);
}

/**
 * Builds a dependency graph from a list of requested mods and all available manifests.
 *
 * @param {string[]} requestedIds - The list of mod IDs requested by the user.
 * @param {Map<string, ModManifest>} manifestsMap - All available mod manifests.
 * @returns {{nodes: Set<string>, edges: Map<string, Set<string>>}} The graph.
 */
function buildDependencyGraph(requestedIds, manifestsMap) {
  if (!Array.isArray(requestedIds)) {
    throw new Error('buildDependencyGraph: `requestedIds` must be an array.');
  }
  if (!(manifestsMap instanceof Map)) {
    throw new Error('buildDependencyGraph: `manifestsMap` must be a Map.');
  }

  const requestedLower = new Set(
    requestedIds.map((id) => String(id).toLowerCase())
  );
  const lcToOriginal = new Map();
  const originalCase = (id) => {
    const lc = String(id).toLowerCase();
    if (!lcToOriginal.has(lc)) lcToOriginal.set(lc, id);
    return lcToOriginal.get(lc);
  };

  const nodes = new Set();
  const edges = new Map();
  originalCase(CORE_MOD_ID);

  for (const reqId of requestedIds) {
    const orig = originalCase(reqId);
    nodes.add(orig);

    if (orig.toLowerCase() !== CORE_MOD_ID) {
      nodes.add(CORE_MOD_ID);
      addEdge(edges, CORE_MOD_ID, orig);
    }
  }

  for (const manifest of manifestsMap.values()) {
    if (!manifest || typeof manifest.id !== 'string') continue;

    const modOrig = originalCase(manifest.id);
    // The line `nodes.add(modOrig);` was here. It was the bug.
    // It incorrectly added ALL mods with a manifest to the graph,
    // instead of only requested mods and their required dependencies.

    const deps = Array.isArray(manifest.dependencies)
      ? manifest.dependencies
      : [];
    for (const dep of deps) {
      if (!dep || typeof dep.id !== 'string') continue;

      const depOrig = originalCase(dep.id);
      const isRequired = dep.required !== false; // Defaults to true if undefined or null
      const isDepRequested = requestedLower.has(dep.id.toLowerCase());
      const isDepManifestPresent = manifestsMap.has(dep.id.toLowerCase());

      if (isRequired && !isDepManifestPresent) {
        throw new ModDependencyError(
          `MISSING_DEPENDENCY: Mod '${modOrig}' requires mod '${depOrig}', but the manifest for '${depOrig}' was not found.`
        );
      }
      if (isRequired || (isDepRequested && isDepManifestPresent)) {
        nodes.add(depOrig);
        addEdge(edges, depOrig, modOrig); // Dependency -> Mod
      }
    }
  }

  return { nodes, edges };
}

/**
 * Creates a minimal heap data structure for stable sorting.
 *
 * @param {function(any): number} keyFn - Function to get the priority key of an item.
 */
function createMinHeap(keyFn) {
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

/*─────────────────────────────────────────────────────────────────────────*/
/* ModLoadOrderResolver Class                                              */
/*─────────────────────────────────────────────────────────────────────────*/

/**
 * Resolves the correct load order for mods based on their declared dependencies.
 * This class implements a topological sort (Kahn's algorithm) to ensure that
 * if Mod A depends on Mod B, Mod B is always loaded before Mod A.
 */
export default class ModLoadOrderResolver {
  /**
   * @private
   * @type {ILogger}
   */
  _logger;

  /**
   * @param {ILogger} logger The application's logger instance.
   */
  constructor(logger) {
    if (!logger || typeof logger.debug !== 'function') {
      throw new Error(
        'ModLoadOrderResolver: constructor requires a valid logger instance.'
      );
    }
    this._logger = logger;
  }

  /**
   * Calculates the definitive load order for a given set of requested mods.
   *
   * @param {string[]} requestedIds The list of mod IDs the user wishes to load.
   * @param {Map<string, ModManifest>} manifestsMap A map of all available mod manifests, keyed by lowercase mod ID.
   * @returns {string[]} The final, sorted list of mod IDs.
   * @throws {ModDependencyError} If a dependency is missing or a cycle is detected.
   */
  resolve(requestedIds, manifestsMap) {
    const logger = this._logger;

    /* Input checks */
    if (requestedIds === null || requestedIds === undefined)
      throw new Error(
        'ModLoadOrderResolver.resolve: `requestedIds` null/undefined.'
      );
    if (!Array.isArray(requestedIds))
      throw new Error(
        'ModLoadOrderResolver.resolve: `requestedIds` must be an array.'
      );
    if (!(manifestsMap instanceof Map))
      throw new Error(
        'ModLoadOrderResolver.resolve: `manifestsMap` must be a Map.'
      );

    /* 1 – Build graph */
    const { nodes, edges } = buildDependencyGraph(requestedIds, manifestsMap);

    /* 2 – Tie-breaker priorities derived from original request */
    const reqIndex = new Map();
    requestedIds.forEach((id, i) => {
      const lc = String(id).toLowerCase();
      if (!reqIndex.has(lc)) reqIndex.set(lc, i);
    });
    const priorityOf = (id) =>
      id.toLowerCase() === CORE_MOD_ID
        ? -1
        : (reqIndex.get(id.toLowerCase()) ?? Number.MAX_SAFE_INTEGER);

    /* 3 – Compute in-degrees */
    const inDeg = new Map();
    nodes.forEach((n) => inDeg.set(n, 0));
    for (const tos of edges.values())
      tos.forEach((to) => inDeg.set(to, inDeg.get(to) + 1));

    /* 4 – Kahn's algorithm with a stable min-heap for tie-breaking */
    const heap = createMinHeap(priorityOf);
    inDeg.forEach((d, n) => {
      if (d === 0) heap.push(n);
    });

    const sorted = [];
    while (heap.size()) {
      const n = heap.pop();
      sorted.push(n);
      const outs = edges.get(n);
      if (!outs) continue;
      outs.forEach((m) => {
        inDeg.set(m, inDeg.get(m) - 1);
        if (inDeg.get(m) === 0) heap.push(m);
      });
    }

    /* 5 – Cycle detection */
    if (sorted.length < nodes.size) {
      const cycle = [...nodes].filter((n) => inDeg.get(n) > 0);
      throw new ModDependencyError(
        `DEPENDENCY_CYCLE: Cyclic dependency detected among mods: ${cycle.join(', ')}`
      );
    }

    /* 6 – Log if the order was adjusted */
    const buildOriginalOrder = () => {
      const seen = new Set();
      const order = [];

      if (sorted.some((id) => id.toLowerCase() === CORE_MOD_ID)) {
        order.push(CORE_MOD_ID);
        seen.add(CORE_MOD_ID.toLowerCase());
      }

      for (const id of requestedIds) {
        const lc = String(id).toLowerCase();
        if (!seen.has(lc)) {
          order.push(id);
          seen.add(lc);
        }
      }
      return order;
    };

    const originalOrder = buildOriginalOrder();
    const differs =
      originalOrder.length !== sorted.length ||
      originalOrder.some(
        (id, idx) => id.toLowerCase() !== (sorted[idx] ?? '').toLowerCase()
      );

    if (differs) {
      logger.debug(
        [
          'Mod load order adjusted to satisfy dependencies.',
          `Original: ${originalOrder.join(', ')}`,
          `Final   : ${sorted.join(', ')}`,
        ].join('\n')
      );
    }

    /* 7 – Log final order for diagnostics */
    logger.debug(
      `modLoadOrderResolver: Resolved load order (${sorted.length} mods): ${sorted.join(' → ')}`
    );

    return sorted;
  }
}
