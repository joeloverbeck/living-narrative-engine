/**
 * @file Resolves the load order of mods based on dependencies.
 * @typedef {import('../interfaces/coreServices.js').ILogger}  ILogger
 * @typedef {import('./modDependencyValidator.js').ModManifest} ModManifest
 */

import ModDependencyError from '../errors/modDependencyError.js';
import { CORE_MOD_ID } from '../constants/core.js';
import { assertIsLogger, assertIsMap } from '../utils/argValidation.js';
import { buildDependencyGraph, createMinHeap } from '../utils/graphUtils.js';

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
   * Create a new resolver using the provided logger.
   *
   * @param {ILogger} logger The application's logger instance.
   */
  constructor(logger) {
    assertIsLogger(
      logger,
      'logger',
      'ModLoadOrderResolver: constructor requires a valid logger instance.'
    );
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
    assertIsMap(manifestsMap, 'ModLoadOrderResolver.resolve: `manifestsMap`');

    /* 1 – Build graph */
    const { nodes, edges } = buildDependencyGraph(requestedIds, manifestsMap);

    /* 2 – Tie-breaker priorities derived from original request */
    const requestOrderIndex = new Map();
    requestedIds.forEach((id, i) => {
      const lc = String(id).toLowerCase();
      if (!requestOrderIndex.has(lc)) requestOrderIndex.set(lc, i);
    });
    const priorityOf = (id) =>
      id.toLowerCase() === CORE_MOD_ID
        ? -1
        : (requestOrderIndex.get(id.toLowerCase()) ?? Number.MAX_SAFE_INTEGER);

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
