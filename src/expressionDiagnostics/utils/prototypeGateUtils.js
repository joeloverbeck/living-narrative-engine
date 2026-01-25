/**
 * @file Utilities for extracting mood axis constraints from prototype gates
 * referenced in expression prerequisites.
 *
 * Instead of extracting moodAxes.* patterns from prerequisites directly,
 * this module derives constraints from the gates defined on emotion/sexual
 * prototypes that are referenced in prerequisites.
 */

import GateConstraint from '../models/GateConstraint.js';
import { getAxisCategory } from '../../constants/prototypeAxisConstants.js';

/**
 * @typedef {object} PrototypeReference
 * @property {string} prototypeId - The prototype ID (e.g., 'joy', 'aroused')
 * @property {'emotion'|'sexual'} type - The prototype type
 * @property {string} varPath - Original variable path (e.g., 'emotions.joy')
 */

/**
 * @typedef {object} MoodConstraint
 * @property {string} varPath - Variable path in moodAxes.* format
 * @property {string} operator - Comparison operator (>=, <=, >, <, ==)
 * @property {number} threshold - Threshold value (normalized to [-100, 100] for mood axes)
 */

const COMPARISON_OPERATORS = ['>=', '<=', '>', '<', '=='];

/**
 * Extract all prototype references from a JSON Logic expression.
 *
 * Finds patterns like {"var": "emotions.joy"} or {"var": "sexualStates.aroused"}
 * and extracts the prototype IDs.
 *
 * @param {object} logic - JSON Logic expression
 * @returns {PrototypeReference[]} Array of prototype references
 */
export const extractPrototypeReferencesFromLogic = (logic) => {
  const references = [];
  const seen = new Set();

  const traverse = (node) => {
    if (!node || typeof node !== 'object') return;

    // Check for {"var": "..."} pattern
    if (node.var && typeof node.var === 'string') {
      const varPath = node.var;
      const parts = varPath.split('.');

      if (parts.length >= 2) {
        const [domain, prototypeId] = parts;

        // Skip 'previous' prefix variants - they use the same prototype
        const normalizedDomain = domain.replace(/^previous/i, '');

        if (
          normalizedDomain === 'emotions' ||
          normalizedDomain === 'Emotions'
        ) {
          const key = `emotion:${prototypeId}`;
          if (!seen.has(key)) {
            seen.add(key);
            references.push({
              prototypeId,
              type: 'emotion',
              varPath,
            });
          }
        } else if (
          normalizedDomain === 'sexualStates' ||
          normalizedDomain === 'SexualStates'
        ) {
          const key = `sexual:${prototypeId}`;
          if (!seen.has(key)) {
            seen.add(key);
            references.push({
              prototypeId,
              type: 'sexual',
              varPath,
            });
          }
        }
      }
      return;
    }

    // Recurse into arrays and objects
    for (const key of Object.keys(node)) {
      const value = node[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          traverse(item);
        }
      } else if (typeof value === 'object' && value !== null) {
        traverse(value);
      }
    }
  };

  traverse(logic);
  return references;
};

/**
 * Get gates for a prototype from the data registry.
 *
 * @param {string} prototypeId - Prototype ID (e.g., 'joy')
 * @param {'emotion'|'sexual'} type - Prototype type
 * @param {object} dataRegistry - Data registry for lookups
 * @returns {string[]} Array of gate strings (e.g., ['valence >= 0.35'])
 */
export const getPrototypeGates = (prototypeId, type, dataRegistry) => {
  if (!dataRegistry || typeof dataRegistry.getLookupData !== 'function') {
    return [];
  }

  const lookupKey =
    type === 'emotion' ? 'core:emotion_prototypes' : 'core:sexual_prototypes';

  try {
    const lookup = dataRegistry.getLookupData(lookupKey);
    const prototype = lookup?.entries?.[prototypeId];
    return prototype?.gates || [];
  } catch {
    return [];
  }
};

/**
 * Convert a GateConstraint to a MoodConstraint in the format expected by
 * filterContextsByConstraints and other mood regime utilities.
 *
 * Gate values are in normalized [-1, 1] range for mood axes.
 * The constraint threshold is converted to [-100, 100] range to match
 * the format used by moodRegimeUtils.
 *
 * @param {GateConstraint} gateConstraint - Parsed gate constraint
 * @returns {MoodConstraint} Mood constraint in moodRegimeUtils format
 */
export const convertGateToMoodConstraint = (gateConstraint) => {
  const axis = gateConstraint.axis;
  const operator = gateConstraint.operator;
  const value = gateConstraint.value;

  // Convert normalized [-1, 1] value to [-100, 100] range
  // This matches the format expected by moodRegimeUtils
  const threshold = value * 100;

  // Determine the correct prefix based on axis category
  const category = getAxisCategory(axis);
  const prefix = category === 'sexual' ? 'sexualAxes' : 'moodAxes';

  return {
    varPath: `${prefix}.${axis}`,
    operator,
    threshold,
  };
};

/**
 * Extract mood axis constraints from the gates of prototypes
 * referenced in expression prerequisites.
 *
 * This is the main entry point that replaces the prerequisite-based
 * moodAxes.* extraction approach. Instead of looking for mood constraints
 * in prerequisites, it derives them from the gates defined on the
 * emotion/sexual prototypes that the prerequisites reference.
 *
 * @param {Array<{logic?: object}>} prerequisites - Expression prerequisites
 * @param {object} dataRegistry - Data registry for prototype lookups
 * @param {object} [options] - Optional configuration
 * @param {boolean} [options.deduplicateByAxis=true] - Combine constraints for same axis
 * @returns {MoodConstraint[]} Constraints in moodRegimeUtils format
 */
export const extractConstraintsFromPrototypeGates = (
  prerequisites,
  dataRegistry,
  options = {}
) => {
  const { deduplicateByAxis = true } = options;

  if (!Array.isArray(prerequisites) || !dataRegistry) {
    return [];
  }

  // Step 1: Collect ALL constraints first (no deduplication yet)
  const allConstraints = [];

  for (const prereq of prerequisites) {
    if (!prereq?.logic) continue;

    const refs = extractPrototypeReferencesFromLogic(prereq.logic);

    for (const ref of refs) {
      const gates = getPrototypeGates(ref.prototypeId, ref.type, dataRegistry);

      for (const gateStr of gates) {
        try {
          const gateConstraint = GateConstraint.parse(gateStr);
          const moodConstraint = convertGateToMoodConstraint(gateConstraint);
          allConstraints.push(moodConstraint);
        } catch {
          // Skip unparseable gates
          continue;
        }
      }
    }
  }

  if (!deduplicateByAxis) {
    // No deduplication - just sort and return all constraints
    return allConstraints.sort((a, b) => {
      const pathCompare = String(a.varPath).localeCompare(String(b.varPath));
      if (pathCompare !== 0) return pathCompare;
      const opCompare = String(a.operator).localeCompare(String(b.operator));
      if (opCompare !== 0) return opCompare;
      return Number(a.threshold) - Number(b.threshold);
    });
  }

  // Step 2: Group constraints by axis
  // Structure: Map<axis, { ge: constraint[], le: constraint[], eq: constraint[] }>
  const axisBuckets = new Map();

  for (const constraint of allConstraints) {
    // Extract axis from varPath (e.g., 'moodAxes.arousal' -> 'arousal', 'sexualAxes.sex_excitation' -> 'sex_excitation')
    const axis = constraint.varPath
      .replace('moodAxes.', '')
      .replace('sexualAxes.', '');

    if (!axisBuckets.has(axis)) {
      axisBuckets.set(axis, { ge: [], le: [], eq: [] });
    }

    const bucket = axisBuckets.get(axis);

    if (constraint.operator === '>=' || constraint.operator === '>') {
      bucket.ge.push(constraint);
    } else if (constraint.operator === '<=' || constraint.operator === '<') {
      bucket.le.push(constraint);
    } else {
      // == operator
      bucket.eq.push(constraint);
    }
  }

  // Step 3: For each axis, keep most restrictive constraint per operator type
  const deduplicatedConstraints = [];

  // Sort axis keys for deterministic iteration
  const sortedAxes = [...axisBuckets.keys()].sort();

  for (const axis of sortedAxes) {
    const bucket = axisBuckets.get(axis);

    // For >= constraints, keep the one with highest threshold (most restrictive)
    if (bucket.ge.length > 0) {
      const mostRestrictiveGe = bucket.ge.reduce((best, current) =>
        current.threshold > best.threshold ? current : best
      );
      deduplicatedConstraints.push(mostRestrictiveGe);
    }

    // For <= constraints, keep the one with lowest threshold (most restrictive)
    if (bucket.le.length > 0) {
      const mostRestrictiveLe = bucket.le.reduce((best, current) =>
        current.threshold < best.threshold ? current : best
      );
      deduplicatedConstraints.push(mostRestrictiveLe);
    }

    // Keep all == constraints (they're typically unique)
    for (const eqConstraint of bucket.eq) {
      deduplicatedConstraints.push(eqConstraint);
    }
  }

  // Step 4: Sort constraints deterministically to ensure hash consistency
  return deduplicatedConstraints.sort((a, b) => {
    const pathCompare = String(a.varPath).localeCompare(String(b.varPath));
    if (pathCompare !== 0) return pathCompare;
    const opCompare = String(a.operator).localeCompare(String(b.operator));
    if (opCompare !== 0) return opCompare;
    return Number(a.threshold) - Number(b.threshold);
  });
};

/**
 * Extract all unique axis names referenced in gates across all prototypes.
 *
 * This is used to detect weight-gate mismatches: axes that are used in
 * prototype weights but never referenced in any gates.
 *
 * @param {Array<{id: string, type: 'emotion'|'sexual'}>} prototypes - Array of prototype info
 * @param {object} dataRegistry - Data registry for prototype lookups
 * @returns {Set<string>} Set of unique axis names found in gates
 */
export const extractAllGateAxes = (prototypes, dataRegistry) => {
  const gateAxes = new Set();

  if (!Array.isArray(prototypes) || !dataRegistry) {
    return gateAxes;
  }

  for (const proto of prototypes) {
    if (!proto?.id || !proto?.type) continue;

    const gates = getPrototypeGates(proto.id, proto.type, dataRegistry);

    for (const gateStr of gates) {
      try {
        const gateConstraint = GateConstraint.parse(gateStr);
        gateAxes.add(gateConstraint.axis);
      } catch {
        // Skip unparseable gates
        continue;
      }
    }
  }

  return gateAxes;
};

/**
 * Check if prerequisites contain OR blocks with prototype references.
 * Used to determine if mood regime filtering should be skipped
 * (similar to hasOrMoodConstraints in moodRegimeUtils).
 *
 * @param {Array<{logic?: object}>} prerequisites - Expression prerequisites
 * @returns {boolean} True if OR blocks with prototype references exist
 */
export const hasOrPrototypeReferences = (prerequisites) => {
  if (!Array.isArray(prerequisites)) {
    return false;
  }

  const checkLogic = (node, inOrBlock) => {
    if (!node || typeof node !== 'object') return false;

    // Check for prototype references in OR blocks
    if (inOrBlock && node.var && typeof node.var === 'string') {
      const varPath = node.var;
      if (
        varPath.startsWith('emotions.') ||
        varPath.startsWith('sexualStates.')
      ) {
        return true;
      }
    }

    // Check comparison operators for var patterns
    for (const op of COMPARISON_OPERATORS) {
      if (node[op] && Array.isArray(node[op])) {
        const [left] = node[op];
        if (inOrBlock && left?.var) {
          const varPath = left.var;
          if (
            varPath.startsWith('emotions.') ||
            varPath.startsWith('sexualStates.')
          ) {
            return true;
          }
        }
      }
    }

    // Recurse into OR blocks
    if (node.or && Array.isArray(node.or)) {
      for (const child of node.or) {
        if (checkLogic(child, true)) return true;
      }
    }

    // Recurse into AND blocks
    if (node.and && Array.isArray(node.and)) {
      for (const child of node.and) {
        if (checkLogic(child, inOrBlock)) return true;
      }
    }

    return false;
  };

  for (const prereq of prerequisites) {
    if (prereq?.logic && checkLogic(prereq.logic, false)) {
      return true;
    }
  }

  return false;
};
