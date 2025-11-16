/**
 * @file State Diff Viewer for GOAP planning state comparison
 *
 * Visualizes differences between planning state hashes during GOAP planning.
 * Shows what changed in the symbolic world state when tasks are applied.
 *
 * IMPORTANT: Works with planning state hashes (symbolic key-value pairs),
 * NOT with ECS components (execution-time entities).
 *
 * Planning state format:
 * - Simple component: "entityId:componentId" → {} or boolean
 * - Component field: "entityId:componentId:field" → value
 *
 * Example:
 * {
 *   'actor-1:core:hungry': { level: 50 },      // Component with data
 *   'actor-1:core:satiated': {},                // Simple component
 *   'food-1:core:exists': true,                 // Boolean component
 *   'actor-1:core:actor:health': 100           // Component field
 * }
 */

import { ensureValidLogger } from '../../utils/loggerUtils.js';

/**
 * State difference result structure
 *
 * @typedef {object} StateDiff
 * @property {{[key: string]: unknown}} added - Facts added in afterState
 * @property {Array<{key: string, before: unknown, after: unknown}>} modified - Facts changed between states
 * @property {{[key: string]: unknown}} removed - Facts removed from beforeState
 */

class StateDiffViewer {
  /**
   * Create a new State Diff Viewer
   *
   * @param {object} params - Constructor parameters
   * @param {object} params.logger - Logger instance
   */
  constructor({ logger }) {
    const validLogger = ensureValidLogger(logger, 'logger');
    // Store for potential future use
    void validLogger;
  }

  /**
   * Compare two planning states and identify differences
   *
   * @param {{[key: string]: unknown}} beforeState - State before task application
   * @param {{[key: string]: unknown}} afterState - State after task application
   * @returns {StateDiff} Differences between states
   * @example
   * const diff = viewer.diff(
   *   { 'actor-1:core:hungry': { level: 50 } },
   *   { 'actor-1:core:satiated': {} }
   * );
   * // Returns: {
   * //   added: { 'actor-1:core:satiated': {} },
   * //   modified: [],
   * //   removed: { 'actor-1:core:hungry': { level: 50 } }
   * // }
   */
  diff(beforeState, afterState) {
    /** @type {{[key: string]: unknown}} */
    const added = {};
    /** @type {Array<{key: string, before: unknown, after: unknown}>} */
    const modified = [];
    /** @type {{[key: string]: unknown}} */
    const removed = {};

    // Find added and modified facts
    for (const [key, afterValue] of Object.entries(afterState)) {
      if (!(key in beforeState)) {
        // New fact added
        added[key] = afterValue;
      } else if (!this.#deepEquals(beforeState[key], afterValue)) {
        // Existing fact modified
        modified.push({
          key,
          before: beforeState[key],
          after: afterValue,
        });
      }
    }

    // Find removed facts
    for (const [key, beforeValue] of Object.entries(beforeState)) {
      if (!(key in afterState)) {
        removed[key] = beforeValue;
      }
    }

    return { added, modified, removed };
  }

  /**
   * Create human-readable visualization of state differences
   *
   * @param {StateDiff} diff - Diff result from diff() method
   * @param {object} [options] - Formatting options
   * @param {string} [options.taskName] - Name of task that caused changes
   * @param {number} [options.stepNumber] - Planning step number
   * @returns {string} Formatted text output
   * @example
   * const output = viewer.visualize(diff, {
   *   taskName: 'eat_food',
   *   stepNumber: 3
   * });
   */
  visualize(diff, options = {}) {
    const lines = [];

    // Header
    if (options.taskName || options.stepNumber !== undefined) {
      const parts = [];
      if (options.stepNumber !== undefined) {
        parts.push(`Step ${options.stepNumber}`);
      }
      if (options.taskName) {
        parts.push(`Task: ${options.taskName}`);
      }
      lines.push(`=== ${parts.join(' - ')} ===`);
      lines.push('');
    }

    // Summary
    const addedCount = Object.keys(diff.added).length;
    const modifiedCount = diff.modified.length;
    const removedCount = Object.keys(diff.removed).length;
    const totalChanges = addedCount + modifiedCount + removedCount;

    lines.push(`Changes: ${totalChanges} total (${addedCount} added, ${modifiedCount} modified, ${removedCount} removed)`);

    if (totalChanges === 0) {
      lines.push('No state changes detected.');
      return lines.join('\n');
    }

    lines.push('');

    // Added facts
    if (addedCount > 0) {
      lines.push('ADDED:');
      for (const [key, value] of Object.entries(diff.added)) {
        lines.push(`  + ${key}: ${this.#formatValue(value)}`);
      }
      lines.push('');
    }

    // Modified facts
    if (modifiedCount > 0) {
      lines.push('MODIFIED:');
      for (const change of diff.modified) {
        lines.push(`  ~ ${change.key}:`);
        lines.push(`      before: ${this.#formatValue(change.before)}`);
        lines.push(`      after:  ${this.#formatValue(change.after)}`);
      }
      lines.push('');
    }

    // Removed facts
    if (removedCount > 0) {
      lines.push('REMOVED:');
      for (const [key, value] of Object.entries(diff.removed)) {
        lines.push(`  - ${key}: ${this.#formatValue(value)}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate JSON output with diff and summary
   *
   * @param {{[key: string]: unknown}} beforeState - State before task application
   * @param {{[key: string]: unknown}} afterState - State after task application
   * @param {object} [options] - Additional metadata
   * @returns {object} JSON object with diff and summary
   * @example
   * const json = viewer.diffJSON(beforeState, afterState, {
   *   taskName: 'eat_food',
   *   stepNumber: 3
   * });
   */
  diffJSON(beforeState, afterState, options = {}) {
    const diff = this.diff(beforeState, afterState);

    return {
      ...options,
      summary: {
        totalChanges: Object.keys(diff.added).length + diff.modified.length + Object.keys(diff.removed).length,
        added: Object.keys(diff.added).length,
        modified: diff.modified.length,
        removed: Object.keys(diff.removed).length,
      },
      changes: {
        added: diff.added,
        modified: diff.modified,
        removed: diff.removed,
      },
    };
  }

  /**
   * Deep equality comparison for state values
   * Handles primitives, objects, arrays, null, and undefined
   *
   * @param {unknown} a - First value
   * @param {unknown} b - Second value
   * @returns {boolean} True if deeply equal
   */
  #deepEquals(a, b) {
    // Handle primitives and same reference
    if (a === b) return true;

    // Handle null and undefined
    if (a === null || a === undefined || b === null || b === undefined) {
      return a === b;
    }

    // Handle different types
    if (typeof a !== typeof b) return false;

    // Handle arrays
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((val, index) => this.#deepEquals(val, b[index]));
    }

    // Handle objects
    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);

      if (keysA.length !== keysB.length) return false;

      return keysA.every((key) => {
        return Object.prototype.hasOwnProperty.call(b, key) && this.#deepEquals(a[key], b[key]);
      });
    }

    // Primitives that aren't equal
    return false;
  }

  /**
   * Format a value for display
   *
   * @param {unknown} value - Value to format
   * @returns {string} Formatted string
   */
  #formatValue(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'boolean') return value.toString();
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'string') return `"${value}"`;
    if (Array.isArray(value)) return JSON.stringify(value);
    if (typeof value === 'object') {
      // Empty object
      if (Object.keys(value).length === 0) return '{}';
      // Object with properties
      return JSON.stringify(value);
    }
    return String(value);
  }
}

export default StateDiffViewer;
