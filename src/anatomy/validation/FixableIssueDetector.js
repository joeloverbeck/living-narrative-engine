/**
 * @file Detects auto-fixable validation issues
 * @see ./ValidationReport.js
 */

/**
 * Analyzes validation errors to identify auto-fixable issues
 */
export class FixableIssueDetector {
  /**
   * Analyze a validation report and identify fixable issues
   *
   * @param {object} report - ValidationReport instance
   * @returns {Array<object>} Array of fixable issues with fix metadata
   */
  static analyze(report) {
    const fixable = [];

    // Analyze errors
    for (const error of report.errors) {
      const fixInfo = this.#analyzeError(error);
      if (fixInfo) {
        fixable.push(fixInfo);
      }
    }

    // Analyze warnings (some may be auto-fixable)
    for (const warning of report.warnings) {
      const fixInfo = this.#analyzeWarning(warning);
      if (fixInfo) {
        fixable.push(fixInfo);
      }
    }

    return fixable;
  }

  /**
   * Analyze an error for fixability
   *
   * @param {object} error - Error object from validation report
   * @returns {object|null} Fix metadata or null if not fixable
   */
  static #analyzeError(error) {
    // Missing component reference
    if (error.type === 'COMPONENT_NOT_FOUND') {
      return {
        type: 'missing_component',
        severity: 'error',
        original: error,
        fixType: 'suggest_component',
        fixable: false, // Requires manual decision on which component to use
        reason: 'Component ID must be manually selected from available components',
        suggestion: error.suggestion || 'Review available components in data/mods/*/components/',
        action: 'manual',
      };
    }

    // Blueprint not found
    if (error.type === 'BLUEPRINT_NOT_FOUND') {
      return {
        type: 'missing_blueprint',
        severity: 'error',
        original: error,
        fixType: 'create_blueprint',
        fixable: false, // Requires manual blueprint creation
        reason: 'Blueprint file must be created manually',
        suggestion: error.fix || `Create blueprint file for ${error.blueprintId}`,
        action: 'manual',
        command: error.fix ? this.#extractFilePathFromFix(error.fix) : null,
      };
    }

    // Socket not found
    if (error.type === 'SOCKET_NOT_FOUND') {
      return {
        type: 'invalid_socket_reference',
        severity: 'error',
        original: error,
        fixType: 'fix_socket_reference',
        fixable: true, // Can suggest correct socket name
        reason: 'Socket reference can be corrected',
        suggestion: error.suggestion || 'Use a valid socket key from the blueprint',
        action: 'replace',
        oldValue: error.socketKey,
        suggestedValue: error.suggestion,
      };
    }

    // Schema validation errors
    if (error.type === 'SCHEMA_VALIDATION_ERROR') {
      // Property type mismatch - potentially fixable
      if (error.message?.includes('type') || error.message?.includes('schema')) {
        return {
          type: 'schema_violation',
          severity: 'error',
          original: error,
          fixType: 'fix_property_value',
          fixable: false, // Requires understanding of intended value
          reason: 'Property value must be manually corrected to match schema',
          suggestion: 'Review component schema and correct property value',
          action: 'manual',
        };
      }
    }

    return null;
  }

  /**
   * Analyze a warning for fixability
   *
   * @param {object} warning - Warning object from validation report
   * @returns {object|null} Fix metadata or null if not fixable
   */
  static #analyzeWarning(warning) {
    // Pattern matching warnings
    if (warning.type === 'PATTERN_NO_MATCH') {
      return {
        type: 'pattern_no_match',
        severity: 'warning',
        original: warning,
        fixType: 'adjust_pattern',
        fixable: false, // Requires design decision
        reason: 'Pattern match requires recipe or blueprint adjustment',
        suggestion: warning.suggestion || 'Adjust pattern tags or blueprint structure',
        action: 'manual',
      };
    }

    // Missing slot tag warnings
    if (warning.type === 'MISSING_SLOT_TAG') {
      return {
        type: 'missing_tag',
        severity: 'warning',
        original: warning,
        fixType: 'add_tag',
        fixable: true, // Can suggest tag to add
        reason: 'Tag can be added to slot definition',
        suggestion: warning.suggestion,
        action: 'add',
        location: warning.location,
        tagToAdd: warning.suggestedTag,
      };
    }

    return null;
  }

  /**
   * Extract file path from fix message
   *
   * @param {string} fixMessage - Fix message containing path
   * @returns {string|null} Extracted file path or null
   */
  static #extractFilePathFromFix(fixMessage) {
    // Match patterns like: "Create blueprint at data/mods/*/blueprints/..."
    const match = fixMessage.match(/at\s+(data\/mods\/[^\s]+)/);
    return match ? match[1] : null;
  }

  /**
   * Generate batch fix suggestions
   *
   * @param {Array<object>} fixableIssues - Array of fixable issues from analyze()
   * @returns {object} Batch fix suggestions organized by action type
   */
  static generateBatchSuggestions(fixableIssues) {
    const batched = {
      automatic: [],
      semiAutomatic: [],
      manual: [],
      summary: {
        total: fixableIssues.length,
        automatic: 0,
        semiAutomatic: 0,
        manual: 0,
      },
    };

    for (const issue of fixableIssues) {
      // Check action type first - replace and add are semi-automatic
      if (issue.action === 'replace' || issue.action === 'add') {
        batched.semiAutomatic.push(issue);
        batched.summary.semiAutomatic++;
      } else if (issue.fixable && issue.action !== 'manual') {
        batched.automatic.push(issue);
        batched.summary.automatic++;
      } else {
        batched.manual.push(issue);
        batched.summary.manual++;
      }
    }

    return batched;
  }

  /**
   * Generate fix script suggestions
   *
   * @param {Array<object>} fixableIssues - Array of fixable issues
   * @returns {Array<string>} Array of script commands
   */
  static generateFixScript(fixableIssues) {
    const commands = [];

    for (const issue of fixableIssues) {
      if (issue.command) {
        commands.push(`# ${issue.type}: ${issue.original.message}`);
        commands.push(`mkdir -p "$(dirname "${issue.command}")"`);
        commands.push(`# TODO: Create file at ${issue.command}`);
        commands.push('');
      } else if (issue.fixable && issue.action === 'replace') {
        commands.push(`# ${issue.type}: Replace '${issue.oldValue}' with '${issue.suggestedValue}'`);
        commands.push(`# Location: ${issue.original.location?.type || 'unknown'} '${issue.original.location?.name || 'unknown'}'`);
        commands.push('');
      }
    }

    return commands;
  }
}
