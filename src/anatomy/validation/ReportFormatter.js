/**
 * @file Report formatter for multiple output formats
 * @see ./ValidationReport.js
 */

/**
 * Formats validation reports for multiple output types
 * Extends ValidationReport with HTML, Markdown, and CSV formats
 */
export class ReportFormatter {
  #report;

  /**
   * Create a report formatter
   *
   * @param {object} report - ValidationReport instance
   */
  constructor(report) {
    if (!report) {
      throw new Error('Report is required');
    }
    this.#report = report;
  }

  /**
   * Generate HTML report
   *
   * @returns {string} HTML formatted report
   */
  toHTML() {
    const summary = this.#report.summary;
    const errors = this.#report.errors;
    const warnings = this.#report.warnings;
    const suggestions = this.#report.suggestions;

    let html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n';
    html += '  <meta charset="UTF-8">\n';
    html +=
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n';
    html += `  <title>Validation Report - ${this.#escapeHtml(summary.recipeId)}</title>\n`;
    html += '  <style>\n';
    html += this.#getHTMLStyles();
    html += '  </style>\n';
    html += '</head>\n<body>\n';

    // Header
    html += '  <div class="header">\n';
    html += `    <h1>Validation Report</h1>\n`;
    html += `    <div class="recipe-info">\n`;
    html += `      <div><strong>Recipe:</strong> ${this.#escapeHtml(summary.recipeId)}</div>\n`;
    if (summary.recipePath) {
      html += `      <div><strong>Path:</strong> ${this.#escapeHtml(summary.recipePath)}</div>\n`;
    }
    html += `      <div><strong>Timestamp:</strong> ${this.#escapeHtml(summary.timestamp)}</div>\n`;
    html += `    </div>\n`;
    html += '  </div>\n';

    // Summary
    html += '  <div class="summary">\n';
    html += '    <h2>Summary</h2>\n';
    html += '    <div class="stats">\n';
    html += `      <div class="stat ${summary.isValid ? 'success' : 'error'}">\n`;
    html += `        <div class="stat-label">Status</div>\n`;
    html += `        <div class="stat-value">${summary.isValid ? '✅ PASSED' : '❌ FAILED'}</div>\n`;
    html += '      </div>\n';
    html += `      <div class="stat error">\n`;
    html += `        <div class="stat-label">Errors</div>\n`;
    html += `        <div class="stat-value">${summary.totalErrors}</div>\n`;
    html += '      </div>\n';
    html += `      <div class="stat warning">\n`;
    html += `        <div class="stat-label">Warnings</div>\n`;
    html += `        <div class="stat-value">${summary.totalWarnings}</div>\n`;
    html += '      </div>\n';
    html += `      <div class="stat suggestion">\n`;
    html += `        <div class="stat-label">Suggestions</div>\n`;
    html += `        <div class="stat-value">${summary.totalSuggestions}</div>\n`;
    html += '      </div>\n';
    html += `      <div class="stat success">\n`;
    html += `        <div class="stat-label">Passed Checks</div>\n`;
    html += `        <div class="stat-value">${summary.passedChecks}</div>\n`;
    html += '      </div>\n';
    html += '    </div>\n';
    html += '  </div>\n';

    // Errors
    if (errors.length > 0) {
      html += '  <div class="section error-section">\n';
      html += '    <h2>✗ Errors</h2>\n';
      for (const error of errors) {
        html += this.#formatErrorHTML(error);
      }
      html += '  </div>\n';
    }

    // Warnings
    if (warnings.length > 0) {
      html += '  <div class="section warning-section">\n';
      html += '    <h2>⚠ Warnings</h2>\n';
      for (const warning of warnings) {
        html += this.#formatWarningHTML(warning);
      }
      html += '  </div>\n';
    }

    // Suggestions
    if (suggestions.length > 0) {
      html += '  <div class="section suggestion-section">\n';
      html += '    <h2>💡 Suggestions</h2>\n';
      for (const suggestion of suggestions) {
        html += this.#formatSuggestionHTML(suggestion);
      }
      html += '  </div>\n';
    }

    html += '</body>\n</html>';
    return html;
  }

  /**
   * Generate Markdown report
   *
   * @returns {string} Markdown formatted report
   */
  toMarkdown() {
    const summary = this.#report.summary;
    const errors = this.#report.errors;
    const warnings = this.#report.warnings;
    const suggestions = this.#report.suggestions;

    let md = `# Validation Report: ${summary.recipeId}\n\n`;

    // Metadata
    md += '## Metadata\n\n';
    if (summary.recipePath) {
      md += `- **Path:** \`${summary.recipePath}\`\n`;
    }
    md += `- **Timestamp:** ${summary.timestamp}\n`;
    md += `- **Status:** ${summary.isValid ? '✅ PASSED' : '❌ FAILED'}\n\n`;

    // Summary
    md += '## Summary\n\n';
    md += `| Metric | Count |\n`;
    md += `|--------|-------|\n`;
    md += `| Errors | ${summary.totalErrors} |\n`;
    md += `| Warnings | ${summary.totalWarnings} |\n`;
    md += `| Suggestions | ${summary.totalSuggestions} |\n`;
    md += `| Passed Checks | ${summary.passedChecks} |\n\n`;

    // Errors
    if (errors.length > 0) {
      md += '## ✗ Errors\n\n';
      for (let i = 0; i < errors.length; i++) {
        md += `### Error ${i + 1}\n\n`;
        md += this.#formatErrorMarkdown(errors[i]);
        md += '\n';
      }
    }

    // Warnings
    if (warnings.length > 0) {
      md += '## ⚠ Warnings\n\n';
      for (let i = 0; i < warnings.length; i++) {
        md += `### Warning ${i + 1}\n\n`;
        md += this.#formatWarningMarkdown(warnings[i]);
        md += '\n';
      }
    }

    // Suggestions
    if (suggestions.length > 0) {
      md += '## 💡 Suggestions\n\n';
      for (let i = 0; i < suggestions.length; i++) {
        md += `### Suggestion ${i + 1}\n\n`;
        md += this.#formatSuggestionMarkdown(suggestions[i]);
        md += '\n';
      }
    }

    return md;
  }

  /**
   * Generate CSV report
   *
   * @returns {string} CSV formatted report
   */
  toCSV() {
    const errors = this.#report.errors;
    const warnings = this.#report.warnings;
    const suggestions = this.#report.suggestions;

    // CSV header
    let csv =
      'Severity,Type,Message,Location Type,Location Name,Component,Fix,Suggestion\n';

    // Add errors
    for (const error of errors) {
      csv += this.#formatIssueCSV('Error', error);
    }

    // Add warnings
    for (const warning of warnings) {
      csv += this.#formatIssueCSV('Warning', warning);
    }

    // Add suggestions
    for (const suggestion of suggestions) {
      csv += this.#formatIssueCSV('Suggestion', suggestion);
    }

    return csv;
  }

  #formatErrorHTML(error) {
    let html = '    <div class="issue error">\n';
    html += `      <div class="issue-message">${this.#escapeHtml(error.message)}</div>\n`;

    if (error.location) {
      html += `      <div class="issue-detail"><strong>Location:</strong> ${this.#escapeHtml(error.location.type)} '${this.#escapeHtml(error.location.name)}'</div>\n`;
    }

    if (error.componentId) {
      html += `      <div class="issue-detail"><strong>Component:</strong> ${this.#escapeHtml(error.componentId)}</div>\n`;
    }

    if (error.fix) {
      html += `      <div class="issue-fix"><strong>Fix:</strong> ${this.#escapeHtml(error.fix)}</div>\n`;
    }

    if (error.context?.location) {
      html += `      <div class="issue-detail"><strong>Location:</strong> ${this.#escapeHtml(error.context.location.type)} '${this.#escapeHtml(error.context.location.name)}'</div>\n`;
    }

    if (error.suggestion) {
      html += `      <div class="issue-suggestion"><strong>Suggestion:</strong> ${this.#escapeHtml(error.suggestion)}</div>\n`;
    }

    html += '    </div>\n';
    return html;
  }

  #formatWarningHTML(warning) {
    let html = '    <div class="issue warning">\n';
    html += `      <div class="issue-message">${this.#escapeHtml(warning.message)}</div>\n`;

    if (warning.location) {
      html += `      <div class="issue-detail"><strong>Location:</strong> ${this.#escapeHtml(warning.location.type)} '${this.#escapeHtml(warning.location.name)}'</div>\n`;
    }

    if (warning.suggestion) {
      html += `      <div class="issue-suggestion"><strong>Suggestion:</strong> ${this.#escapeHtml(warning.suggestion)}</div>\n`;
    }

    html += '    </div>\n';
    return html;
  }

  #formatSuggestionHTML(suggestion) {
    let html = '    <div class="issue suggestion">\n';
    html += `      <div class="issue-message">${this.#escapeHtml(suggestion.message)}</div>\n`;

    if (suggestion.location) {
      html += `      <div class="issue-detail"><strong>Location:</strong> ${this.#escapeHtml(suggestion.location.type)} '${this.#escapeHtml(suggestion.location.name)}'</div>\n`;
    }

    if (suggestion.suggestion) {
      html += `      <div class="issue-suggestion"><strong>Suggestion:</strong> ${this.#escapeHtml(suggestion.suggestion)}</div>\n`;
    }

    if (suggestion.reason) {
      html += `      <div class="issue-detail"><strong>Reason:</strong> ${this.#escapeHtml(suggestion.reason)}</div>\n`;
    }

    if (suggestion.impact) {
      html += `      <div class="issue-detail"><strong>Impact:</strong> ${this.#escapeHtml(suggestion.impact)}</div>\n`;
    }

    html += '    </div>\n';
    return html;
  }

  #formatErrorMarkdown(error) {
    let md = `**Message:** ${error.message}\n\n`;

    if (error.location) {
      md += `- **Location:** ${error.location.type} '${error.location.name}'\n`;
    }

    if (error.componentId) {
      md += `- **Component:** \`${error.componentId}\`\n`;
    }

    if (error.fix) {
      md += `- **Fix:** ${error.fix}\n`;
    }

    if (error.context?.location) {
      md += `- **Location:** ${error.context.location.type} '${error.context.location.name}'\n`;
    }

    if (error.suggestion) {
      md += `- **Suggestion:** ${error.suggestion}\n`;
    }

    return md;
  }

  #formatWarningMarkdown(warning) {
    let md = `**Message:** ${warning.message}\n\n`;

    if (warning.location) {
      md += `- **Location:** ${warning.location.type} '${warning.location.name}'\n`;
    }

    if (warning.suggestion) {
      md += `- **Suggestion:** ${warning.suggestion}\n`;
    }

    return md;
  }

  #formatSuggestionMarkdown(suggestion) {
    let md = `**Message:** ${suggestion.message}\n\n`;

    if (suggestion.location) {
      md += `- **Location:** ${suggestion.location.type} '${suggestion.location.name}'\n`;
    }

    if (suggestion.suggestion) {
      md += `- **Suggestion:** ${suggestion.suggestion}\n`;
    }

    if (suggestion.reason) {
      md += `- **Reason:** ${suggestion.reason}\n`;
    }

    if (suggestion.impact) {
      md += `- **Impact:** ${suggestion.impact}\n`;
    }

    return md;
  }

  #formatIssueCSV(severity, issue) {
    const type = issue.type || '';
    const message = this.#escapeCSV(issue.message || '');
    const locationType = issue.location?.type || '';
    const locationName = issue.location?.name || '';
    const componentId = this.#escapeCSV(issue.componentId || '');
    const fix = this.#escapeCSV(issue.fix || '');
    const suggestion = this.#escapeCSV(issue.suggestion || '');

    return `${severity},${type},${message},${locationType},${locationName},${componentId},${fix},${suggestion}\n`;
  }

  #escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  #escapeCSV(text) {
    if (!text) return '';
    const str = String(text);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  #getHTMLStyles() {
    return `
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .header {
      background-color: #fff;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header h1 {
      margin: 0 0 15px 0;
      color: #333;
    }
    .recipe-info {
      display: grid;
      gap: 8px;
      color: #666;
    }
    .summary {
      background-color: #fff;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .summary h2 {
      margin-top: 0;
      color: #333;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
    }
    .stat {
      padding: 15px;
      border-radius: 6px;
      text-align: center;
    }
    .stat.success {
      background-color: #d4edda;
      color: #155724;
    }
    .stat.error {
      background-color: #f8d7da;
      color: #721c24;
    }
    .stat.warning {
      background-color: #fff3cd;
      color: #856404;
    }
    .stat.suggestion {
      background-color: #d1ecf1;
      color: #0c5460;
    }
    .stat-label {
      font-size: 0.85em;
      font-weight: 600;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .stat-value {
      font-size: 1.5em;
      font-weight: bold;
    }
    .section {
      background-color: #fff;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .section h2 {
      margin-top: 0;
      color: #333;
      border-bottom: 2px solid #e0e0e0;
      padding-bottom: 10px;
    }
    .error-section h2 {
      color: #721c24;
      border-color: #f8d7da;
    }
    .warning-section h2 {
      color: #856404;
      border-color: #fff3cd;
    }
    .suggestion-section h2 {
      color: #0c5460;
      border-color: #d1ecf1;
    }
    .issue {
      padding: 15px;
      margin: 10px 0;
      border-left: 4px solid;
      border-radius: 4px;
    }
    .issue.error {
      background-color: #f8d7da;
      border-color: #721c24;
    }
    .issue.warning {
      background-color: #fff3cd;
      border-color: #856404;
    }
    .issue.suggestion {
      background-color: #d1ecf1;
      border-color: #0c5460;
    }
    .issue-message {
      font-weight: 600;
      margin-bottom: 10px;
    }
    .issue-detail, .issue-fix, .issue-suggestion {
      margin: 5px 0;
      font-size: 0.95em;
    }
    .issue-fix {
      color: #155724;
      background-color: #d4edda;
      padding: 8px;
      border-radius: 4px;
      margin-top: 10px;
    }
    .issue-suggestion {
      color: #004085;
      background-color: #cce5ff;
      padding: 8px;
      border-radius: 4px;
      margin-top: 10px;
    }
    code {
      background-color: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
    }
    `;
  }
}
