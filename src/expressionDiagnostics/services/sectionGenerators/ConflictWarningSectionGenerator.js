/**
 * @file ConflictWarningSectionGenerator - Generates fit vs feasibility conflict warning sections
 * @description Renders FitFeasibilityConflict data as markdown for Monte Carlo reports.
 * @see FitFeasibilityConflict.js
 * @see FitFeasibilityConflictDetector.js
 */

/** @typedef {import('../../models/FitFeasibilityConflict.js').FitFeasibilityConflict} FitFeasibilityConflict */
/** @typedef {import('../../models/FitFeasibilityConflict.js').PrototypeScore} PrototypeScore */
/** @typedef {import('../../models/FitFeasibilityConflict.js').ConflictType} ConflictType */

/**
 * Section generator for fit vs feasibility conflict warnings in Monte Carlo reports.
 */
class ConflictWarningSectionGenerator {
  #logger;

  /**
   * Create a ConflictWarningSectionGenerator.
   *
   * @param {object} [options] - Optional configuration.
   * @param {object} [options.logger] - Logger for debugging (optional).
   */
  constructor({ logger = null } = {}) {
    this.#logger = logger;
  }

  /**
   * Get the severity emoji for a conflict type.
   *
   * @param {ConflictType} type - The conflict type.
   * @returns {string} Emoji for the severity level.
   */
  #getSeverityEmoji(type) {
    switch (type) {
      case 'fit_vs_clause_impossible':
        return '🚨';
      case 'gate_contradiction':
        return '⚠️';
      default:
        return '⚠️';
    }
  }

  /**
   * Format a conflict type as a human-readable label.
   *
   * @param {ConflictType} type - The conflict type.
   * @returns {string} Human-readable label.
   */
  #formatConflictType(type) {
    switch (type) {
      case 'fit_vs_clause_impossible':
        return 'Fit vs Clause Impossible';
      case 'gate_contradiction':
        return 'Gate Contradiction';
      default:
        return 'Unknown Conflict';
    }
  }

  /**
   * Format a single prototype score entry.
   *
   * @param {PrototypeScore} prototypeScore - The prototype score.
   * @returns {string} Formatted string.
   */
  #formatPrototypeScore(prototypeScore) {
    const { prototypeId, score } = prototypeScore;
    const scoreStr = typeof score === 'number' ? score.toFixed(3) : 'N/A';
    return `\`${prototypeId}\`: ${scoreStr}`;
  }

  /**
   * Format a single conflict as markdown.
   *
   * @param {FitFeasibilityConflict} conflict - The conflict to format.
   * @param {number} index - 1-based index of the conflict.
   * @returns {string} Markdown string for this conflict.
   */
  #formatConflict(conflict, index) {
    const emoji = this.#getSeverityEmoji(conflict.type);
    const typeLabel = this.#formatConflictType(conflict.type);

    const lines = [];

    // Conflict header
    lines.push(`#### ${emoji} Conflict #${index}: ${typeLabel}`);
    lines.push('');

    // Explanation
    lines.push(`**Explanation**: ${conflict.explanation}`);
    lines.push('');

    // Top Prototypes section (only if non-empty)
    if (
      Array.isArray(conflict.topPrototypes) &&
      conflict.topPrototypes.length > 0
    ) {
      lines.push('**Top Prototypes**:');
      for (const proto of conflict.topPrototypes) {
        lines.push(`- ${this.#formatPrototypeScore(proto)}`);
      }
      lines.push('');
    }

    // Impossible Clauses section (only if non-empty)
    if (
      Array.isArray(conflict.impossibleClauseIds) &&
      conflict.impossibleClauseIds.length > 0
    ) {
      lines.push('**Impossible Clauses**:');
      for (const clauseId of conflict.impossibleClauseIds) {
        lines.push(`- \`${clauseId}\``);
      }
      lines.push('');
    }

    // Suggested Fixes section (only if non-empty)
    if (
      Array.isArray(conflict.suggestedFixes) &&
      conflict.suggestedFixes.length > 0
    ) {
      lines.push('**Suggested Fixes**:');
      for (const fix of conflict.suggestedFixes) {
        lines.push(`- ${fix}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Generate the conflict warning section for a Monte Carlo report.
   *
   * @param {FitFeasibilityConflict[]|null|undefined} conflicts - Array of conflicts to render.
   * @returns {string} Markdown section string, or empty string if no conflicts.
   */
  generate(conflicts) {
    // Return empty string for null, undefined, or empty array
    if (!conflicts || !Array.isArray(conflicts) || conflicts.length === 0) {
      return '';
    }

    this.#logger?.debug?.(
      `ConflictWarningSectionGenerator: Generating section for ${conflicts.length} conflict(s)`
    );

    const lines = [];

    // Section header with warning emoji
    lines.push('## ⚠️ Fit vs Feasibility Conflicts');
    lines.push('');
    lines.push(
      '> The following conflicts indicate discrepancies between prototype fit rankings and clause feasibility analysis.'
    );
    lines.push('');

    // Format each conflict
    for (let i = 0; i < conflicts.length; i++) {
      const conflict = conflicts[i];
      lines.push(this.#formatConflict(conflict, i + 1));
    }

    return lines.join('\n');
  }
}

export default ConflictWarningSectionGenerator;
