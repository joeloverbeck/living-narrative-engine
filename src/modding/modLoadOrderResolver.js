// src/modding/modLoadOrderResolver.js

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger}  ILogger
 * @typedef {import('./modDependencyValidator.js').ModManifest} ModManifest
 */

import ModDependencyError from '../errors/modDependencyError.js';
import { CORE_MOD_ID } from '../constants/core';

/*─────────────────────────────────────────────────────────────────────────*/
/* Helper – addEdge                                                        */

/*─────────────────────────────────────────────────────────────────────────*/
/**
 *
 * @param edges
 * @param from
 * @param to
 */
function addEdge(edges, from, to) {
  if (!edges.has(from)) edges.set(from, new Set());
  edges.get(from).add(to);
}

/*─────────────────────────────────────────────────────────────────────────*/
/* Ticket T-2 – buildDependencyGraph                                       */

/*─────────────────────────────────────────────────────────────────────────*/
/**
 *
 * @param requestedIds
 * @param manifestsMap
 */
function buildDependencyGraph(requestedIds, manifestsMap) {
  // … unchanged implementation from the previous ticket …
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
    nodes.add(modOrig);

    const deps = Array.isArray(manifest.dependencies)
      ? manifest.dependencies
      : [];
    for (const dep of deps) {
      if (!dep || typeof dep.id !== 'string') continue;

      const depOrig = originalCase(dep.id);
      const isRequired = dep.required !== false; // Defaults to true if undefined or null
      const isDepRequested = requestedLower.has(dep.id.toLowerCase());
      const isDepManifestPresent = manifestsMap.has(dep.id.toLowerCase()); // Check map using lowercase key

      if (isRequired && !isDepManifestPresent) {
        // If a dependency is required, its manifest *must* exist in the provided map.
        throw new ModDependencyError(
          `MISSING_DEPENDENCY: Mod '${modOrig}' requires mod '${depOrig}', but the manifest for '${depOrig}' was not found.`
        );
      }
      // Add the edge if:
      // 1. The dependency is required (its presence is already validated above if required)
      // 2. The dependency is optional AND it was explicitly requested by the user.
      // We only care about optional dependencies if they are part of the requested set.
      // We must also ensure the optional dependency's manifest actually exists if we are adding it.
      if (isRequired || (isDepRequested && isDepManifestPresent)) {
        // Ensure the dependency node exists before adding edge
        // Note: If it's required, isDepManifestPresent is true. If optional, we check isDepRequested && isDepManifestPresent.
        // So, the node we are adding an edge *from* should always correspond to a present manifest here.
        nodes.add(depOrig);
        addEdge(edges, depOrig, modOrig); // Dependency -> Mod
      }
    }
  }

  return { nodes, edges };
}

/*─────────────────────────────────────────────────────────────────────────*/
/* Internal helper – tiny min-heap used by Kahn                            */

/*─────────────────────────────────────────────────────────────────────────*/
/**
 *
 * @param keyFn
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
/* resolveOrder – stable Kahn + adjustment logging (this ticket)          */

/*─────────────────────────────────────────────────────────────────────────*/
/**
 * @param {string[]}                requestedIds
 * @param {Map<string,ModManifest>} manifestsMap
 * @param {ILogger}                 logger
 * @returns {string[]} final load order
 */
function resolveOrder(requestedIds, manifestsMap, logger) {
  /* Input checks */
  if (requestedIds === null || requestedIds === undefined)
    throw new Error(
      'modLoadOrderResolver.resolveOrder: `requestedIds` null/undefined.'
    );
  if (!Array.isArray(requestedIds))
    throw new Error(
      'modLoadOrderResolver.resolveOrder: `requestedIds` must be an array.'
    );
  if (!(manifestsMap instanceof Map))
    throw new Error(
      'modLoadOrderResolver.resolveOrder: `manifestsMap` must be a Map.'
    );
  if (!logger) {
    throw new Error(
      'modLoadOrderResolver.resolveOrder: `logger` does not implement ILogger.'
    );
  }

  /* 1 – Build graph */
  const { nodes, edges } = buildDependencyGraph(requestedIds, manifestsMap);

  /* 2 – tie-breaker priorities derived from original request */
  const reqIndex = new Map();
  requestedIds.forEach((id, i) => {
    const lc = String(id).toLowerCase();
    if (!reqIndex.has(lc)) reqIndex.set(lc, i);
  });
  const priorityOf = (id) =>
    id.toLowerCase() === CORE_MOD_ID
      ? -1
      : (reqIndex.get(id.toLowerCase()) ?? Number.MAX_SAFE_INTEGER);

  /* 3 – compute in-degrees */
  const inDeg = new Map();
  nodes.forEach((n) => inDeg.set(n, 0));
  for (const tos of edges.values())
    tos.forEach((to) => inDeg.set(to, inDeg.get(to) + 1));

  /* 4 – Kahn with stable min-heap */
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

  /* 5 – cycle check */
  if (sorted.length < nodes.size) {
    const cycle = [...nodes].filter((n) => inDeg.get(n) > 0);
    // --- TICKET CHANGE ---
    // Prepend DEPENDENCY_CYCLE: to the error message
    throw new ModDependencyError(
      `DEPENDENCY_CYCLE: Cyclic dependency detected among mods: ${cycle.join(', ')}`
    );
    // --- END TICKET CHANGE ---
  }

  /* 6 – NEW: detect whether we had to move anything */
  const buildOriginalOrder = () => {
    const seen = new Set();
    const order = [];

    if (sorted.some((id) => id.toLowerCase() === CORE_MOD_ID)) {
      order.push(CORE_MOD_ID);
      seen.add(CORE_MOD_ID);
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

  /* 7 – always log final order for diagnostics */
  logger.debug(
    `modLoadOrderResolver: Resolved load order (${sorted.length} mods): ${sorted.join(' → ')}`
  );

  return sorted;
}

export { buildDependencyGraph, resolveOrder };
