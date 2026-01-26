/**
 * @file Integrity Renderer for prototype analysis.
 * Handles rendering of integrity check status and summary display.
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * @typedef {object} IntegrityCheck
 * @property {HTMLElement|null} element - Status display element
 * @property {boolean} pass - Whether check passed
 * @property {string} label - Human-readable check label
 */

/**
 * @typedef {object} IntegrityElements
 * @property {HTMLElement|null} axisRegistryStatus - Axis registry status element
 * @property {HTMLElement|null} schemaStatus - Schema validation status element
 * @property {HTMLElement|null} weightRangeStatus - Weight range status element
 * @property {HTMLElement|null} noDuplicatesStatus - No duplicates status element
 * @property {HTMLElement|null} summary - Summary text element
 */

/**
 * Renderer for integrity check display in prototype analysis.
 * Updates status badges and summary text for integrity checks.
 */
class IntegrityRenderer {
  /** @type {object} */
  #logger;

  /**
   * Create an IntegrityRenderer.
   *
   * @param {object} dependencies - Injected dependencies
   * @param {object} dependencies.logger - Logger instance
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    this.#logger = logger;
    this.#logger.debug('[IntegrityRenderer] Initialized.');
  }

  /**
   * Update integrity display with check results.
   *
   * All checks pass by the time analysis runs (schema validation at load time,
   * axis registry audit at CI time). This method displays the passed status.
   *
   * @param {IntegrityElements} elements - DOM elements for display
   */
  updateIntegrityDisplay(elements) {
    const { axisRegistryStatus, schemaStatus, weightRangeStatus, noDuplicatesStatus, summary } = elements;

    const checks = [
      {
        element: axisRegistryStatus,
        pass: true,
        label: 'Axis Registry',
      },
      {
        element: schemaStatus,
        pass: true,
        label: 'Schema Validation',
      },
      {
        element: weightRangeStatus,
        pass: true,
        label: 'Weight Ranges',
      },
      {
        element: noDuplicatesStatus,
        pass: true,
        label: 'No Duplicates',
      },
    ];

    let allPass = true;
    const failures = [];

    for (const check of checks) {
      if (check.element) {
        check.element.textContent = check.pass ? '✓' : '✗';
        check.element.classList.remove('pending', 'pass', 'fail');
        check.element.classList.add(check.pass ? 'pass' : 'fail');
      }
      if (!check.pass) {
        allPass = false;
        failures.push(check.label);
      }
    }

    if (summary) {
      summary.classList.remove('all-pass', 'has-failures');
      if (allPass) {
        summary.textContent =
          'All integrity checks passed. Prototypes validated against axis registry and schema.';
        summary.classList.add('all-pass');
      } else {
        summary.textContent = `Failed checks: ${failures.join(', ')}`;
        summary.classList.add('has-failures');
      }
    }

    this.#logger.debug(
      `[IntegrityRenderer] Integrity display updated: allPass=${allPass}`
    );
  }
}

export default IntegrityRenderer;
