/**
 * @file Multi-format violation reporter for cross-reference validation
 * @description Generates comprehensive reports in various formats (console, JSON, HTML, Markdown)
 * for violation detection results. Integrates with existing logging infrastructure.
 * @see src/validation/modCrossReferenceValidator.js - Source of validation data
 */

import { validateDependency } from '../utils/dependencyUtils.js';

/**
 * Multi-format violation reporter
 * Integrates with existing logging infrastructure
 */
class ViolationReporter {
  _logger;

  /**
   * Creates a new ViolationReporter instance
   *
   * @param {object} dependencies - Dependencies for the reporter
   * @param {import('../interfaces/coreServices.js').ILogger} dependencies.logger - Logger instance for logging
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this._logger = logger;
  }

  /**
   * Generates report in specified format
   * @param {ValidationReport|Map<string, ValidationReport>} data - Validation results
   * @param {string} format - Output format: 'console', 'json', 'html', 'markdown'
   * @param {Object} options - Formatting options
   * @returns {string} Formatted report
   */
  generateReport(data, format = 'console', options = {}) {
    this._logger.debug(`Generating ${format} report with options:`, options);

    switch (format.toLowerCase()) {
      case 'console':
        return this._generateConsoleReport(data, options);
      case 'json':
        return this._generateJsonReport(data, options);
      case 'html':
        return this._generateHtmlReport(data, options);
      case 'markdown':
        return this._generateMarkdownReport(data, options);
      default:
        throw new Error(`Unsupported report format: ${format}`);
    }
  }

  /**
   * Enhanced console report with colors and actionable suggestions
   * @private
   */
  _generateConsoleReport(data, options = {}) {
    const { colors = true, verbose = false, showSuggestions = true } = options;
    const lines = [];

    // Use existing report generation as base, enhance with new violation data
    if (data instanceof Map) {
      return this._generateEcosystemConsoleReport(data, options);
    }

    // Enhanced single mod report
    lines.push(`Cross-Reference Validation Report for '${data.modId}'`);
    lines.push('='.repeat(50));
    lines.push('');

    if (!data.hasViolations) {
      lines.push('✅ No cross-reference violations detected');
      lines.push('');
      lines.push(`Summary:`);
      lines.push(`  - References to ${data.referencedMods.length} mods`);
      lines.push(
        `  - ${data.summary.totalReferences} total component references`
      );
      lines.push(`  - All references properly declared as dependencies`);
      return lines.join('\n');
    }

    lines.push(
      `❌ ${data.violations.length} cross-reference violations detected`
    );
    lines.push('');

    // Group violations by severity if enhanced violations are available
    const violationsBySeverity = this._groupBySeverity(data.violations);

    if (violationsBySeverity.size > 0) {
      // Enhanced reporting with severity grouping
      ['critical', 'high', 'medium', 'low'].forEach((severity) => {
        const severityViolations = violationsBySeverity.get(severity) || [];
        if (severityViolations.length === 0) return;

        const severityIcon = this._getSeverityIcon(severity);
        const colorFunc = colors
          ? this._getSeverityColor(severity)
          : (text) => text;

        lines.push(
          colorFunc(
            `${severityIcon} ${severity.toUpperCase()} (${severityViolations.length}):`
          )
        );

        severityViolations.forEach((violation) => {
          lines.push(
            `  ❌ ${violation.referencedMod}:${violation.referencedComponent}`
          );

          if (violation.file && violation.line) {
            lines.push(`     📁 ${violation.file}:${violation.line}`);
          }

          if (violation.contextSnippet) {
            lines.push(`     📝 ${violation.contextSnippet}`);
          }

          if (showSuggestions && violation.suggestedFixes?.length > 0) {
            const primaryFix = violation.suggestedFixes.find(
              (f) => f.priority === 'primary'
            );
            if (primaryFix) {
              lines.push(`     💡 ${primaryFix.description}`);
            }
          }

          if (verbose && violation.impact) {
            lines.push(
              `     📊 Impact: loading=${violation.impact.loadingFailure}, runtime=${violation.impact.runtimeFailure}`
            );
          }

          lines.push('');
        });
      });
    } else {
      // Fallback to basic violation reporting
      lines.push('Violations:');
      const violationsByMod = this._groupByMod(data.violations);

      for (const [referencedMod, violations] of violationsByMod) {
        lines.push(`  📦 Missing dependency: ${referencedMod}`);
        violations.forEach((violation) => {
          lines.push(
            `    - References component: ${violation.referencedComponent}`
          );
          if (violation.file && violation.file !== 'multiple') {
            lines.push(
              `      📁 ${violation.file}${violation.line ? ':' + violation.line : ''}`
            );
          }
        });
        lines.push(
          `    💡 Fix: Add "${referencedMod}" to dependencies in mod-manifest.json`
        );
        lines.push('');
      }
    }

    // Summary section
    lines.push('Current Dependencies:');
    if (data.declaredDependencies.length > 0) {
      data.declaredDependencies.forEach((dep) => {
        lines.push(`  - ${dep}`);
      });
    } else {
      lines.push('  (none declared)');
    }
    lines.push('');

    lines.push('Referenced Mods:');
    if (data.referencedMods.length > 0) {
      data.referencedMods.forEach((mod) => {
        const status = data.declaredDependencies.includes(mod) ? '✅' : '❌';
        lines.push(`  ${status} ${mod}`);
      });
    } else {
      lines.push('  (no external references found)');
    }

    return lines.join('\n');
  }

  /**
   * Enhanced ecosystem console report
   * @private
   */
  _generateEcosystemConsoleReport(results, options = {}) {
    const { colors = true, showSuggestions = true } = options;
    const lines = [];
    const modsWithViolations = Array.from(results.entries()).filter(
      ([, report]) => report.hasViolations
    );

    lines.push('Living Narrative Engine - Cross-Reference Validation Report');
    lines.push('='.repeat(60));
    lines.push('');

    if (modsWithViolations.length === 0) {
      lines.push('✅ No cross-reference violations detected in ecosystem');
      lines.push(`📊 Validated ${results.size} mods successfully`);
      return lines.join('\n');
    }

    const totalViolations = modsWithViolations.reduce(
      (sum, [, report]) => sum + report.violations.length,
      0
    );

    lines.push(
      `❌ Found ${totalViolations} violations across ${modsWithViolations.length} mods`
    );
    lines.push('');

    // Enhanced summary table with severity if available
    const hasSeverityData = modsWithViolations.some(([, report]) =>
      report.violations.some((v) => v.severity)
    );

    if (hasSeverityData) {
      lines.push('Violation Summary by Severity:');
      const severityTotals =
        this._calculateEcosystemSeverityTotals(modsWithViolations);

      ['critical', 'high', 'medium', 'low'].forEach((severity) => {
        const count = severityTotals[severity] || 0;
        if (count > 0) {
          const icon = this._getSeverityIcon(severity);
          const colorFunc = colors
            ? this._getSeverityColor(severity)
            : (text) => text;
          lines.push(
            colorFunc(
              `  ${icon} ${severity.toUpperCase()}: ${count} violations`
            )
          );
        }
      });
      lines.push('');
    }

    // Mod summary table
    lines.push('Violation Summary by Mod:');
    lines.push(
      'Mod'.padEnd(20) + 'Violations'.padEnd(12) + 'Missing Dependencies'
    );
    lines.push('-'.repeat(60));

    modsWithViolations
      .sort((a, b) => b[1].violations.length - a[1].violations.length) // Sort by violation count
      .forEach(([modId, report]) => {
        const violationCount = report.violations.length.toString();
        const missingDeps = report.missingDependencies.join(', ');
        lines.push(modId.padEnd(20) + violationCount.padEnd(12) + missingDeps);
      });

    lines.push('');
    lines.push('Detailed Violations:');
    lines.push('='.repeat(30));

    // Detailed violations for each mod
    modsWithViolations.forEach(([modId, report]) => {
      lines.push('');
      lines.push(`📦 ${modId}:`);

      const violationsByMod = this._groupByMod(report.violations);

      for (const [referencedMod, violations] of violationsByMod) {
        lines.push(`  ❌ Missing dependency: ${referencedMod}`);
        violations.forEach((violation) => {
          let componentLine = `    - ${violation.referencedComponent}`;

          // Add context information if available
          if (violation.file && violation.file !== 'multiple') {
            componentLine += ` (${violation.file}${violation.line ? ':' + violation.line : ''})`;
          }

          if (violation.severity) {
            const icon = this._getSeverityIcon(violation.severity);
            componentLine += ` ${icon}`;
          }

          lines.push(componentLine);
        });

        // Show primary fix suggestion
        if (showSuggestions) {
          const firstViolation = violations[0];
          if (firstViolation.suggestedFixes?.length > 0) {
            const primaryFix = firstViolation.suggestedFixes.find(
              (f) => f.priority === 'primary'
            );
            if (primaryFix) {
              lines.push(`    💡 ${primaryFix.description}`);
            }
          } else if (firstViolation.suggestedFix) {
            lines.push(`    💡 ${firstViolation.suggestedFix}`);
          }
        }
      }
    });

    lines.push('');
    lines.push('📋 Next Steps:');
    lines.push("1. Review each mod's manifest file (mod-manifest.json)");
    lines.push('2. Add missing dependencies to the dependencies array');
    lines.push('3. Ensure version constraints are appropriate');
    lines.push('4. Re-run validation to confirm fixes');

    return lines.join('\n');
  }

  /**
   * JSON report for tooling integration
   * @private
   */
  _generateJsonReport(data, options = {}) {
    const { pretty = false } = options;

    const reportData = {
      timestamp: new Date().toISOString(),
      validatorVersion: '1.0.0', // TODO: Get from package.json
      format: 'json',
    };

    if (data instanceof Map) {
      reportData.type = 'ecosystem';
      reportData.mods = Object.fromEntries(data);
      reportData.summary = this._generateEcosystemSummary(data);
    } else {
      reportData.type = 'single-mod';
      reportData.mod = data;
    }

    return JSON.stringify(reportData, null, pretty ? 2 : 0);
  }

  /**
   * HTML report for web-based viewing
   * @private
   */
  _generateHtmlReport(data, options = {}) {
    const { title = 'Cross-Reference Validation Report' } = options;

    const html = [];
    html.push('<!DOCTYPE html>');
    html.push('<html lang="en">');
    html.push('<head>');
    html.push('  <meta charset="UTF-8">');
    html.push(
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0">'
    );
    html.push(`  <title>${title}</title>`);
    html.push('  <style>');
    html.push(this._getHtmlStyles());
    html.push('  </style>');
    html.push('</head>');
    html.push('<body>');
    html.push(`  <h1>${title}</h1>`);

    if (data instanceof Map) {
      html.push(this._generateEcosystemHtmlContent(data));
    } else {
      html.push(this._generateSingleModHtmlContent(data));
    }

    html.push('</body>');
    html.push('</html>');

    return html.join('\n');
  }

  /**
   * Markdown report for documentation integration
   * @private
   */
  _generateMarkdownReport(data, options = {}) {
    const { title = 'Cross-Reference Validation Report' } = options;
    const lines = [];

    lines.push(`# ${title}`);
    lines.push('');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');

    if (data instanceof Map) {
      lines.push(this._generateEcosystemMarkdownContent(data));
    } else {
      lines.push(this._generateSingleModMarkdownContent(data));
    }

    return lines.join('\n');
  }

  // Helper methods for enhanced reporting

  /**
   * Groups violations by severity level
   * @private
   */
  _groupBySeverity(violations) {
    const groups = new Map();
    violations.forEach((violation) => {
      const severity = violation.severity || 'low';
      if (!groups.has(severity)) {
        groups.set(severity, []);
      }
      groups.get(severity).push(violation);
    });
    return groups;
  }

  /**
   * Groups violations by referenced mod
   * @private
   */
  _groupByMod(violations) {
    const groups = new Map();
    violations.forEach((violation) => {
      const mod = violation.referencedMod;
      if (!groups.has(mod)) {
        groups.set(mod, []);
      }
      groups.get(mod).push(violation);
    });
    return groups;
  }

  /**
   * Gets severity icon for console display
   * @private
   */
  _getSeverityIcon(severity) {
    const icons = {
      critical: '🚨',
      high: '⚠️',
      medium: '⚡',
      low: '📝',
    };
    return icons[severity] || '❓';
  }

  /**
   * Gets color function for severity (basic implementation)
   * @private
   */
  _getSeverityColor(severity) {
    // Basic color implementation - could be enhanced with actual ANSI colors
    return (text) => text; // No coloring for now
  }

  /**
   * Calculates severity totals across ecosystem
   * @private
   */
  _calculateEcosystemSeverityTotals(modsWithViolations) {
    const totals = { critical: 0, high: 0, medium: 0, low: 0 };

    modsWithViolations.forEach(([, report]) => {
      report.violations.forEach((violation) => {
        const severity = violation.severity || 'low';
        if (Object.prototype.hasOwnProperty.call(totals, severity)) {
          totals[severity]++;
        }
      });
    });

    return totals;
  }

  /**
   * Generates ecosystem summary for JSON reports
   * @private
   */
  _generateEcosystemSummary(results) {
    const totalMods = results.size;
    const values = Array.from(results.values());
    
    // Handle the nested validation result structure
    // Each result has: { modId, dependencies, crossReferences, isValid, errors, warnings }
    // crossReferences contains: { hasViolations, violations, ... }
    const modsWithViolations = values.filter(
      (r) => r && r.crossReferences && r.crossReferences.hasViolations
    ).length;
    const totalViolations = values.reduce(
      (sum, r) => sum + (r && r.crossReferences && r.crossReferences.violations ? r.crossReferences.violations.length : 0),
      0
    );

    return {
      totalMods,
      modsWithViolations,
      totalViolations,
      validationPassed: totalViolations === 0,
    };
  }

  /**
   * Basic HTML styles for report
   * @private
   */
  _getHtmlStyles() {
    return `
      body { font-family: Arial, sans-serif; margin: 20px; }
      h1, h2, h3 { color: #333; }
      .success { color: green; }
      .error { color: red; }
      .warning { color: orange; }
      .violation { margin: 10px 0; padding: 10px; border-left: 3px solid #ff6b6b; background: #fff5f5; }
      .severity-critical { border-left-color: #e74c3c; }
      .severity-high { border-left-color: #f39c12; }
      .severity-medium { border-left-color: #3498db; }
      .severity-low { border-left-color: #95a5a6; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
      th { background-color: #f2f2f2; }
    `;
  }

  /**
   * Generates HTML content for ecosystem report
   * @private
   */
  _generateEcosystemHtmlContent(results) {
    const modsWithViolations = Array.from(results.entries()).filter(
      ([, report]) => report.hasViolations
    );
    const html = [];

    if (modsWithViolations.length === 0) {
      html.push('  <div class="success">');
      html.push('    <h2>✅ No violations detected</h2>');
      html.push(`    <p>Successfully validated ${results.size} mods.</p>`);
      html.push('  </div>');
      return html.join('\n');
    }

    const totalViolations = modsWithViolations.reduce(
      (sum, [, report]) => sum + report.violations.length,
      0
    );

    html.push('  <div class="error">');
    html.push(
      `    <h2>❌ ${totalViolations} violations found across ${modsWithViolations.length} mods</h2>`
    );
    html.push('  </div>');

    // Add detailed violation sections for each mod
    modsWithViolations.forEach(([modId, report]) => {
      html.push(`  <h3>📦 ${modId}</h3>`);
      html.push('  <div>');

      report.violations.forEach((violation) => {
        const severityClass = violation.severity
          ? `severity-${violation.severity}`
          : '';
        html.push(`    <div class="violation ${severityClass}">`);
        html.push(
          `      <strong>${violation.referencedMod}:${violation.referencedComponent}</strong>`
        );

        if (violation.file && violation.file !== 'multiple') {
          html.push(
            `      <br>📁 ${violation.file}${violation.line ? ':' + violation.line : ''}`
          );
        }

        if (violation.contextSnippet) {
          html.push(`      <br>📝 <code>${violation.contextSnippet}</code>`);
        }

        html.push(
          `      <br>💡 ${violation.suggestedFix || 'Add dependency to manifest'}`
        );
        html.push('    </div>');
      });

      html.push('  </div>');
    });

    return html.join('\n');
  }

  /**
   * Generates HTML content for single mod report
   * @private
   */
  _generateSingleModHtmlContent(data) {
    const html = [];

    html.push(`  <h2>Mod: ${data.modId}</h2>`);

    if (!data.hasViolations) {
      html.push('  <div class="success">');
      html.push('    <h3>✅ No violations detected</h3>');
      html.push('  </div>');
      return html.join('\n');
    }

    html.push('  <div class="error">');
    html.push(`    <h3>❌ ${data.violations.length} violations detected</h3>`);
    html.push('  </div>');

    data.violations.forEach((violation) => {
      const severityClass = violation.severity
        ? `severity-${violation.severity}`
        : '';
      html.push(`  <div class="violation ${severityClass}">`);
      html.push(
        `    <strong>${violation.referencedMod}:${violation.referencedComponent}</strong>`
      );

      if (violation.file && violation.file !== 'multiple') {
        html.push(
          `    <br>📁 ${violation.file}${violation.line ? ':' + violation.line : ''}`
        );
      }

      if (violation.contextSnippet) {
        html.push(`    <br>📝 <code>${violation.contextSnippet}</code>`);
      }

      html.push(
        `    <br>💡 ${violation.suggestedFix || 'Add dependency to manifest'}`
      );
      html.push('  </div>');
    });

    return html.join('\n');
  }

  /**
   * Generates Markdown content for ecosystem report
   * @private
   */
  _generateEcosystemMarkdownContent(results) {
    const modsWithViolations = Array.from(results.entries()).filter(
      ([, report]) => report.hasViolations
    );
    const lines = [];

    if (modsWithViolations.length === 0) {
      lines.push('## ✅ No violations detected');
      lines.push('');
      lines.push(`Successfully validated ${results.size} mods.`);
      return lines.join('\n');
    }

    const totalViolations = modsWithViolations.reduce(
      (sum, [, report]) => sum + report.violations.length,
      0
    );

    lines.push(
      `## ❌ ${totalViolations} violations found across ${modsWithViolations.length} mods`
    );
    lines.push('');

    modsWithViolations.forEach(([modId, report]) => {
      lines.push(`### 📦 ${modId}`);
      lines.push('');

      report.violations.forEach((violation) => {
        lines.push(
          `- **${violation.referencedMod}:${violation.referencedComponent}**`
        );

        if (violation.file && violation.file !== 'multiple') {
          lines.push(
            `  - 📁 \`${violation.file}${violation.line ? ':' + violation.line : ''}\``
          );
        }

        if (violation.contextSnippet) {
          lines.push(`  - 📝 \`${violation.contextSnippet}\``);
        }

        if (violation.severity) {
          lines.push(
            `  - ${this._getSeverityIcon(violation.severity)} Severity: ${violation.severity}`
          );
        }

        lines.push(
          `  - 💡 ${violation.suggestedFix || 'Add dependency to manifest'}`
        );
        lines.push('');
      });
    });

    return lines.join('\n');
  }

  /**
   * Generates Markdown content for single mod report
   * @private
   */
  _generateSingleModMarkdownContent(data) {
    const lines = [];

    lines.push(`## Mod: ${data.modId}`);
    lines.push('');

    if (!data.hasViolations) {
      lines.push('### ✅ No violations detected');
      lines.push('');
      return lines.join('\n');
    }

    lines.push(`### ❌ ${data.violations.length} violations detected`);
    lines.push('');

    data.violations.forEach((violation) => {
      lines.push(
        `- **${violation.referencedMod}:${violation.referencedComponent}**`
      );

      if (violation.file && violation.file !== 'multiple') {
        lines.push(
          `  - 📁 \`${violation.file}${violation.line ? ':' + violation.line : ''}\``
        );
      }

      if (violation.contextSnippet) {
        lines.push(`  - 📝 \`${violation.contextSnippet}\``);
      }

      if (violation.severity) {
        lines.push(
          `  - ${this._getSeverityIcon(violation.severity)} Severity: ${violation.severity}`
        );
      }

      lines.push(
        `  - 💡 ${violation.suggestedFix || 'Add dependency to manifest'}`
      );
      lines.push('');
    });

    return lines.join('\n');
  }
}

export default ViolationReporter;
