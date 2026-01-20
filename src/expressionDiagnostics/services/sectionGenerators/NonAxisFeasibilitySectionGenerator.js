/**
 * @file NonAxisFeasibilitySectionGenerator - Generates non-axis clause feasibility sections
 * @description Renders NonAxisClauseFeasibility data as markdown for Monte Carlo reports.
 * @see NonAxisClauseFeasibility.js
 * @see NonAxisFeasibilityAnalyzer.js
 */

import { SCOPE_METADATA } from '../../models/AnalysisScopeMetadata.js';
import { renderScopeMetadataHeader } from '../../utils/scopeMetadataRenderer.js';

/** @typedef {import('../../models/NonAxisClauseFeasibility.js').NonAxisClauseFeasibility} NonAxisClauseFeasibility */
/** @typedef {import('../../models/NonAxisClauseFeasibility.js').FeasibilityClassification} FeasibilityClassification */

/**
 * Section generator for non-axis clause feasibility results in Monte Carlo reports.
 */
class NonAxisFeasibilitySectionGenerator {
  #logger;

  /**
   * Create a NonAxisFeasibilitySectionGenerator.
   *
   * @param {object} [options] - Optional configuration.
   * @param {object} [options.logger] - Logger for debugging (optional).
   */
  constructor({ logger = null } = {}) {
    this.#logger = logger;
  }

  /**
   * Get the classification emoji for a feasibility classification.
   *
   * @param {FeasibilityClassification} classification - The classification value.
   * @returns {string} Emoji for the classification.
   */
  #getClassificationEmoji(classification) {
    switch (classification) {
      case 'IMPOSSIBLE':
        return '⛔';
      case 'RARE':
        return '⚠️';
      case 'OK':
        return '✅';
      case 'UNKNOWN':
      default:
        return '❓';
    }
  }

  /**
   * Format a number value for display.
   *
   * @param {number | null} value - The value to format.
   * @param {number} [decimals] - Number of decimal places (defaults to 3).
   * @returns {string} Formatted value or 'N/A'.
   */
  #formatNumber(value, decimals = 3) {
    if (value === null || value === undefined) {
      return 'N/A';
    }
    return value.toFixed(decimals);
  }

  /**
   * Format a percentage value for display.
   *
   * @param {number | null} passRate - The pass rate (0-1).
   * @returns {string} Formatted percentage string or 'N/A'.
   */
  #formatPassRate(passRate) {
    if (passRate === null || passRate === undefined) {
      return 'N/A';
    }
    return `${(passRate * 100).toFixed(1)}%`;
  }

  /**
   * Build the "previous" version of a variable path for delta expressions.
   * Transforms "emotions.remorse" to "previousEmotions.remorse".
   *
   * @param {string} varPath - The original variable path.
   * @returns {string} The path prefixed with "previous" and first segment capitalized.
   */
  #buildPreviousVarPath(varPath) {
    if (!varPath || typeof varPath !== 'string') {
      return 'previous';
    }
    const segments = varPath.split('.');
    if (segments.length === 0) {
      return 'previous';
    }
    const firstSegment = segments[0];
    const capitalizedFirst =
      firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1);
    segments[0] = capitalizedFirst;
    return `previous${segments.join('.')}`;
  }

  /**
   * Render the clause expression, handling delta clauses specially.
   * Delta clauses render as "(varPath - previousVarPath) operator threshold".
   * Non-delta clauses render as "operator threshold".
   *
   * @param {NonAxisClauseFeasibility} result - The feasibility result.
   * @returns {string} The rendered clause expression.
   */
  #renderClauseExpression(result) {
    const threshold = this.#formatNumber(result.threshold);

    if (result.signal === 'delta') {
      const prevPath = this.#buildPreviousVarPath(result.varPath);
      return `(${result.varPath} - ${prevPath}) ${result.operator} ${threshold}`;
    }

    return `${result.operator} ${threshold}`;
  }

  /**
   * Render the variable display for breakdown headers.
   * Delta clauses show "(varPath - previousVarPath)".
   * Non-delta clauses show just the varPath.
   *
   * @param {NonAxisClauseFeasibility} result - The feasibility result.
   * @returns {string} The variable display string (without backticks).
   */
  #renderVariableDisplay(result) {
    if (result.signal === 'delta') {
      const prevPath = this.#buildPreviousVarPath(result.varPath);
      return `(${result.varPath} - ${prevPath})`;
    }
    return result.varPath;
  }

  /**
   * Format a single row of the feasibility table.
   *
   * @param {NonAxisClauseFeasibility} result - The feasibility result.
   * @returns {string} Markdown table row.
   */
  #formatTableRow(result) {
    const emoji = this.#getClassificationEmoji(result.classification);
    const varPath = `\`${result.varPath}\``;
    const clause = this.#renderClauseExpression(result);
    const passRate = this.#formatPassRate(result.passRate);
    const maxValue = this.#formatNumber(result.maxValue);
    const classification = `${emoji} ${result.classification}`;

    return `| ${varPath} | ${clause} | ${passRate} | ${maxValue} | ${classification} |`;
  }

  /**
   * Generate detailed breakdown for IMPOSSIBLE or RARE clauses.
   *
   * @param {NonAxisClauseFeasibility[]} results - Filtered results for breakdown.
   * @param {string} label - Section label (e.g., "IMPOSSIBLE", "RARE").
   * @returns {string} Markdown breakdown section.
   */
  #generateBreakdownSection(results, label) {
    if (results.length === 0) {
      return '';
    }

    const lines = [];
    lines.push(`### ${label} Clauses`);
    lines.push('');

    for (const result of results) {
      const varDisplay = this.#renderVariableDisplay(result);
      lines.push(`#### \`${varDisplay}\` ${result.operator} ${this.#formatNumber(result.threshold)}`);
      lines.push('');
      lines.push(`- **Clause ID**: \`${result.clauseId}\``);
      lines.push(`- **Pass Rate**: ${this.#formatPassRate(result.passRate)}`);
      lines.push(`- **Max Value**: ${this.#formatNumber(result.maxValue)}`);
      lines.push(`- **P95 Value**: ${this.#formatNumber(result.p95Value)}`);
      lines.push(`- **Margin (max - threshold)**: ${this.#formatNumber(result.marginMax)}`);
      lines.push(`- **Signal**: ${result.signal}`);

      if (result.evidence && result.evidence.note) {
        lines.push(`- **Note**: ${result.evidence.note}`);
      }
      if (result.evidence && result.evidence.bestSampleRef) {
        lines.push(`- **Best Sample**: \`${result.evidence.bestSampleRef}\``);
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Generate the non-axis feasibility section for a Monte Carlo report.
   *
   * @param {NonAxisClauseFeasibility[]|null|undefined} feasibilityResults - Array of feasibility results.
   * @param {number} [inRegimeSampleCount] - Number of in-regime samples analyzed (defaults to 0).
   * @returns {string} Markdown section string.
   */
  generate(feasibilityResults, inRegimeSampleCount = 0) {
    // Handle empty/null input
    if (!feasibilityResults || !Array.isArray(feasibilityResults) || feasibilityResults.length === 0) {
      const lines = [];
      lines.push('## Non-Axis Clause Feasibility');
      lines.push('');
      lines.push(renderScopeMetadataHeader(SCOPE_METADATA.NON_AXIS_FEASIBILITY));
      lines.push('No non-axis clauses found in prerequisites.');
      lines.push('');
      return lines.join('\n');
    }

    this.#logger?.debug?.(
      `NonAxisFeasibilitySectionGenerator: Generating section for ${feasibilityResults.length} result(s)`
    );

    const lines = [];

    // Section header
    lines.push('## Non-Axis Clause Feasibility');
    lines.push('');

    // Scope metadata badges
    lines.push(renderScopeMetadataHeader(SCOPE_METADATA.NON_AXIS_FEASIBILITY));

    // Population info
    const formattedCount = inRegimeSampleCount.toLocaleString();
    lines.push(`**Population**: ${formattedCount} in-regime samples analyzed`);
    lines.push('');

    // Summary table
    lines.push('| Variable | Clause | Pass Rate | Max Value | Classification |');
    lines.push('|----------|--------|-----------|-----------|----------------|');

    for (const result of feasibilityResults) {
      lines.push(this.#formatTableRow(result));
    }

    lines.push('');

    // Detailed breakdown sections for IMPOSSIBLE and RARE
    const impossibleResults = feasibilityResults.filter(r => r.classification === 'IMPOSSIBLE');
    const rareResults = feasibilityResults.filter(r => r.classification === 'RARE');

    const impossibleSection = this.#generateBreakdownSection(impossibleResults, '⛔ IMPOSSIBLE');
    const rareSection = this.#generateBreakdownSection(rareResults, '⚠️ RARE');

    if (impossibleSection) {
      lines.push(impossibleSection);
    }

    if (rareSection) {
      lines.push(rareSection);
    }

    return lines.join('\n');
  }
}

export default NonAxisFeasibilitySectionGenerator;
