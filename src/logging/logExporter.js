/**
 * @file Export functionality for critical logs
 * @see criticalLogNotifier.js, logFilter.js
 */

import { validateDependency } from '../utils/dependencyUtils.js';

/**
 * Utility class for exporting critical logs in various formats.
 * Provides JSON, CSV, text, and markdown export capabilities with
 * file download and clipboard functionality.
 */
class LogExporter {
  #logger;
  #appInfo;

  /**
   * Creates a new LogExporter instance.
   *
   * @param {object} dependencies - Dependencies object
   * @param {*} dependencies.logger - Logger instance with debug and error methods
   * @param {object} [dependencies.appInfo] - Application information for metadata
   */
  constructor({ logger, appInfo = {} }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'error'],
    });

    this.#logger = logger;
    this.#appInfo = {
      name: 'Living Narrative Engine',
      version: '0.0.1', // Match package.json
      ...appInfo,
    };
  }

  /**
   * Export logs as JSON with metadata
   *
   * @param {Array} logs - Logs to export
   * @param {object} options - Export options
   * @returns {string} JSON string with metadata and sanitized logs
   */
  exportAsJSON(logs, options = {}) {
    const exportData = {
      metadata: this.#createMetadata(options),
      logs: logs.map(this.#sanitizeLog),
      summary: this.#createSummary(logs),
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export logs as CSV
   *
   * @param {Array} logs - Logs to export
   * @param {object} options - Export options
   * @returns {string} CSV formatted string with headers and metadata
   */
  exportAsCSV(logs, options = {}) {
    const headers = [
      'Timestamp',
      'ISO Time',
      'Level',
      'Category',
      'Message',
      'Has Metadata',
      'Stack Trace',
    ];

    const rows = logs.map((log) => {
      const isoTime = new Date(log.timestamp).toISOString();
      const localTime = new Date(log.timestamp).toLocaleString();

      return [
        localTime,
        isoTime,
        log.level.toUpperCase(),
        log.category || 'general',
        this.#escapeCSV(log.message),
        log.metadata && Object.keys(log.metadata).length > 0 ? 'Yes' : 'No',
        this.#escapeCSV(log.metadata?.stack || ''),
      ];
    });

    // Add metadata as comments
    const metadata = [
      `# Exported: ${new Date().toISOString()}`,
      `# Application: ${this.#appInfo.name} v${this.#appInfo.version}`,
      `# Total Logs: ${logs.length}`,
      `# Filters Applied: ${options.filters ? 'Yes' : 'No'}`,
      '',
    ];

    return [
      ...metadata,
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');
  }

  /**
   * Export logs as plain text
   *
   * @param {Array} logs - Logs to export
   * @param {object} options - Export options
   * @returns {string} Human-readable formatted text
   */
  exportAsText(logs, options = {}) {
    const lines = [
      '='.repeat(80),
      'CRITICAL LOGS EXPORT',
      '='.repeat(80),
      '',
      `Application: ${this.#appInfo.name} v${this.#appInfo.version}`,
      `Exported: ${new Date().toLocaleString()}`,
      `Total Logs: ${logs.length}`,
      '',
    ];

    if (options.filters) {
      lines.push('Applied Filters:');
      Object.entries(options.filters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          lines.push(`  - ${key}: ${value}`);
        }
      });
      lines.push('');
    }

    lines.push('-'.repeat(80));
    lines.push('');

    // Group logs by level
    const warnings = logs.filter((l) => l.level === 'warn');
    const errors = logs.filter((l) => l.level === 'error');

    if (warnings.length > 0) {
      lines.push(`WARNINGS (${warnings.length}):`);
      lines.push('-'.repeat(40));
      warnings.forEach((log) => {
        lines.push(this.#formatLogAsText(log));
        lines.push('');
      });
    }

    if (errors.length > 0) {
      lines.push(`ERRORS (${errors.length}):`);
      lines.push('-'.repeat(40));
      errors.forEach((log) => {
        lines.push(this.#formatLogAsText(log));
        lines.push('');
      });
    }

    lines.push('='.repeat(80));
    lines.push('END OF EXPORT');

    return lines.join('\n');
  }

  /**
   * Export logs as Markdown
   *
   * @param {Array} logs - Logs to export
   * @param {object} options - Export options
   * @returns {string} Markdown formatted string with tables
   */
  exportAsMarkdown(logs, options = {}) {
    const lines = [
      '# Critical Logs Export',
      '',
      '## Metadata',
      '',
      `- **Application**: ${this.#appInfo.name} v${this.#appInfo.version}`,
      `- **Exported**: ${new Date().toLocaleString()}`,
      `- **Total Logs**: ${logs.length}`,
      `- **Browser**: ${navigator.userAgent}`,
      '',
    ];

    if (options.filters) {
      lines.push('### Applied Filters');
      lines.push('');
      Object.entries(options.filters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          lines.push(`- **${key}**: ${value}`);
        }
      });
      lines.push('');
    }

    // Summary statistics
    const stats = this.#createSummary(logs);
    lines.push('## Summary');
    lines.push('');
    lines.push(`- Warnings: ${stats.warnings}`);
    lines.push(`- Errors: ${stats.errors}`);
    lines.push(`- Time Range: ${stats.timeRange}`);
    lines.push('');

    // Logs table
    lines.push('## Logs');
    lines.push('');
    lines.push('| Time | Level | Category | Message |');
    lines.push('|------|-------|----------|---------|');

    logs.forEach((log) => {
      const time = new Date(log.timestamp).toLocaleTimeString();
      const level = log.level === 'warn' ? '⚠️ WARN' : '❌ ERROR';
      const category = log.category || 'general';
      const message = this.#escapeMarkdown(log.message);

      lines.push(`| ${time} | ${level} | ${category} | ${message} |`);
    });

    return lines.join('\n');
  }

  /**
   * Download logs as file
   *
   * @param {string} content - Content to download
   * @param {string} filename - Filename for download
   * @param {string} mimeType - MIME type
   */
  downloadAsFile(content, filename, mimeType = 'text/plain') {
    try {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();

      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);

      this.#logger.debug(`Downloaded logs as ${filename}`);
    } catch (error) {
      this.#logger.error('Failed to download logs', error);
      throw error;
    }
  }

  /**
   * Copy content to clipboard
   *
   * @param {string} content - Content to copy
   * @returns {Promise<boolean>} True if successful, false otherwise
   */
  async copyToClipboard(content) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(content);
        this.#logger.debug('Logs copied to clipboard');
        return true;
      } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = content;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';

        document.body.appendChild(textarea);
        textarea.select();

        const success = document.execCommand('copy');
        document.body.removeChild(textarea);

        if (success) {
          this.#logger.debug('Logs copied to clipboard (fallback)');
        }
        return success;
      }
    } catch (error) {
      this.#logger.error('Failed to copy to clipboard', error);
      return false;
    }
  }

  /**
   * Generate filename with timestamp
   *
   * @param {string} prefix - Filename prefix
   * @param {string} extension - File extension
   * @returns {string} Generated filename with timestamp
   */
  generateFilename(prefix = 'critical-logs', extension = 'json') {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .slice(0, -5); // Remove milliseconds and Z

    return `${prefix}_${timestamp}.${extension}`;
  }

  // Private helper methods
  #createMetadata(options) {
    return {
      application: this.#appInfo,
      exportedAt: new Date().toISOString(),
      exportedBy: 'CriticalLogNotifier',
      browser: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
      },
      filters: options.filters || null,
      exportFormat: options.format || 'json',
      totalLogs: options.totalLogs || 0,
    };
  }

  #createSummary(logs) {
    const warnings = logs.filter((l) => l.level === 'warn').length;
    const errors = logs.filter((l) => l.level === 'error').length;

    const timestamps = logs.map((l) => new Date(l.timestamp).getTime());
    // Use reduce to avoid stack overflow with large arrays
    const minTime =
      timestamps.length > 0
        ? timestamps.reduce((min, t) => Math.min(min, t), Infinity)
        : null;
    const maxTime =
      timestamps.length > 0
        ? timestamps.reduce((max, t) => Math.max(max, t), -Infinity)
        : null;

    return {
      total: logs.length,
      warnings,
      errors,
      timeRange:
        minTime && maxTime
          ? `${new Date(minTime).toLocaleString()} - ${new Date(maxTime).toLocaleString()}`
          : 'N/A',
      categories: [...new Set(logs.map((l) => l.category || 'general'))],
    };
  }

  #sanitizeLog(log) {
    // Remove circular references and sensitive data
    const sanitized = {
      timestamp: log.timestamp,
      level: log.level,
      message: log.message,
      category: log.category,
    };

    if (log.metadata) {
      sanitized.metadata = {};

      // Only include safe metadata fields
      const safeFields = [
        'stack',
        'errorName',
        'errorMessage',
        'userId',
        'action',
      ];
      Object.keys(log.metadata).forEach((key) => {
        if (safeFields.includes(key)) {
          sanitized.metadata[key] = log.metadata[key];
        }
      });
    }

    return sanitized;
  }

  #formatLogAsText(log) {
    const time = new Date(log.timestamp).toLocaleString();
    const level = log.level.toUpperCase().padEnd(5);
    const category = (log.category || 'general').padEnd(15);

    let text = `[${time}] ${level} [${category}] ${log.message}`;

    if (log.metadata?.stack) {
      text += '\n  Stack Trace:\n';
      text += log.metadata.stack
        .split('\n')
        .map((line) => '    ' + line)
        .join('\n');
    }

    return text;
  }

  #escapeCSV(value) {
    if (value === null || value === undefined) return '';

    const stringValue = String(value);

    // Escape quotes and wrap in quotes if contains comma, newline, or quotes
    if (
      stringValue.includes(',') ||
      stringValue.includes('\n') ||
      stringValue.includes('"')
    ) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
  }

  #escapeMarkdown(text) {
    if (!text) return '';

    // Escape markdown special characters
    return text
      .replace(/\|/g, '\\|')
      .replace(/\*/g, '\\*')
      .replace(/_/g, '\\_')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

export default LogExporter;
