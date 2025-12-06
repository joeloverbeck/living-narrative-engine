/**
 * @file MemoryReporter - Memory reporting and metrics aggregation
 * @module MemoryReporter
 */

import { BaseService } from '../../utils/serviceBase.js';
import {
  validateDependency,
  assertNonBlankString,
} from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./MemoryMonitor.js').default} MemoryMonitor */
/** @typedef {import('./MemoryAnalyzer.js').default} MemoryAnalyzer */
/** @typedef {import('./MemoryProfiler.js').default} MemoryProfiler */
/** @typedef {import('./MemoryPressureManager.js').default} MemoryPressureManager */

/**
 * @typedef {object} MemoryReport
 * @property {object} summary - Report summary
 * @property {object} currentState - Current memory state
 * @property {object} trends - Memory trends
 * @property {object} leaks - Leak detection results
 * @property {object} hotspots - Memory hotspots
 * @property {object} pressure - Pressure management info
 * @property {object} recommendations - Action recommendations
 * @property {number} timestamp - Report timestamp
 */

/**
 * @typedef {object} ReportFormat
 * @enum {string}
 * @property
 */
const ReportFormat = {
  JSON: 'json',
  TEXT: 'text',
  HTML: 'html',
  MARKDOWN: 'markdown',
};

/**
 * Comprehensive memory reporting service
 */
export default class MemoryReporter extends BaseService {
  #logger;
  #monitor;
  #analyzer;
  #profiler;
  #pressureManager;
  #reportHistory;
  #config;
  #autoReportInterval;

  /**
   * Creates a new MemoryReporter instance
   *
   * @param {object} deps - Dependencies
   * @param {ILogger} deps.logger - Logger instance
   * @param {MemoryMonitor} deps.monitor - Memory monitor
   * @param {MemoryAnalyzer} deps.analyzer - Memory analyzer
   * @param {MemoryProfiler} deps.profiler - Memory profiler
   * @param {MemoryPressureManager} deps.pressureManager - Pressure manager
   * @param {object} [config] - Reporter configuration
   */
  constructor(
    { logger, monitor, analyzer, profiler, pressureManager },
    config = {}
  ) {
    super();

    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });
    validateDependency(monitor, 'MemoryMonitor', logger, {
      requiredMethods: ['getCurrentUsage', 'getHistory', 'detectMemoryLeak'],
    });
    validateDependency(analyzer, 'MemoryAnalyzer', logger, {
      requiredMethods: ['analyzeTrend', 'detectPatterns', 'generateReport'],
    });
    validateDependency(profiler, 'MemoryProfiler', logger, {
      requiredMethods: ['findMemoryHotspots', 'generateReport'],
    });
    validateDependency(pressureManager, 'MemoryPressureManager', logger, {
      requiredMethods: ['getCurrentPressureLevel', 'getStatistics'],
    });

    this.#logger = this._init('MemoryReporter', logger);
    this.#monitor = monitor;
    this.#analyzer = analyzer;
    this.#profiler = profiler;
    this.#pressureManager = pressureManager;

    this.#config = {
      maxReportHistory: config.maxReportHistory || 100,
      autoReportInterval: config.autoReportInterval || 0, // 0 = disabled
      includeRecommendations: config.includeRecommendations !== false,
      verbosity: config.verbosity || 'normal', // minimal, normal, detailed
      ...config,
    };

    this.#reportHistory = [];

    this.#logger.info('MemoryReporter initialized', this.#config);

    // Start auto-reporting if configured
    if (this.#config.autoReportInterval > 0) {
      this.#startAutoReporting();
    }
  }

  /**
   * Generate a comprehensive memory report
   *
   * @param {object} [options] - Report options
   * @returns {MemoryReport}
   */
  generateReport(options = {}) {
    const verbosity = options.verbosity || this.#config.verbosity;
    const includeRecommendations =
      options.includeRecommendations ?? this.#config.includeRecommendations;

    this.#logger.debug('Generating memory report', {
      verbosity,
      includeRecommendations,
    });

    // Gather current state
    const currentUsage = this.#monitor.getCurrentUsage();
    const history = this.#monitor.getHistory(300000); // Last 5 minutes
    const pressureLevel = this.#pressureManager.getCurrentPressureLevel();

    // Perform analyses
    const trend =
      history.length > 0 ? this.#analyzer.analyzeTrend(history) : null;
    const patterns =
      history.length > 0 ? this.#analyzer.detectPatterns(history) : [];
    const leakDetection = this.#monitor.detectMemoryLeak();
    const hotspots = this.#profiler.findMemoryHotspots();
    const profilerReport = this.#profiler.generateReport();
    const pressureStats = this.#pressureManager.getStatistics();

    // Build report
    const report = {
      summary: this.#generateSummary(
        currentUsage,
        pressureLevel,
        leakDetection
      ),
      currentState: this.#generateCurrentState(currentUsage, pressureLevel),
      trends: trend,
      patterns: patterns,
      leaks: leakDetection,
      hotspots: verbosity !== 'minimal' ? hotspots : hotspots.slice(0, 5),
      profiling: verbosity === 'detailed' ? profilerReport : null,
      pressure: {
        level: pressureLevel,
        statistics: verbosity !== 'minimal' ? pressureStats : null,
      },
      recommendations: includeRecommendations
        ? this.#generateRecommendations(
            leakDetection,
            trend,
            patterns,
            pressureLevel
          )
        : null,
      metadata: {
        timestamp: Date.now(),
        verbosity,
        historyLength: history.length,
      },
    };

    // Store in history
    this.#addToHistory(report);

    this.#logger.info('Memory report generated', {
      pressureLevel,
      leakDetected: leakDetection.detected,
      hotspots: hotspots.length,
    });

    return report;
  }

  /**
   * Generate report summary
   *
   * @param currentUsage
   * @param pressureLevel
   * @param leakDetection
   * @private
   */
  #generateSummary(currentUsage, pressureLevel, leakDetection) {
    return {
      heapUsed: currentUsage ? currentUsage.heapUsed : 0,
      heapTotal: currentUsage ? currentUsage.heapTotal : 0,
      usagePercent: currentUsage ? currentUsage.usagePercent : 0,
      pressureLevel,
      leakDetected: leakDetection.detected,
      status: this.#determineStatus(pressureLevel, leakDetection.detected),
    };
  }

  /**
   * Generate current state section
   *
   * @param currentUsage
   * @param pressureLevel
   * @private
   */
  #generateCurrentState(currentUsage, pressureLevel) {
    if (!currentUsage) {
      return { available: false };
    }

    return {
      memory: {
        heapUsed: currentUsage.heapUsed,
        heapTotal: currentUsage.heapTotal,
        heapLimit: currentUsage.heapLimit,
        external: currentUsage.external,
        usagePercent: currentUsage.usagePercent,
      },
      pressure: pressureLevel,
      timestamp: currentUsage.timestamp,
    };
  }

  /**
   * Generate recommendations
   *
   * @param leakDetection
   * @param trend
   * @param patterns
   * @param pressureLevel
   * @private
   */
  #generateRecommendations(leakDetection, trend, patterns, pressureLevel) {
    const recommendations = [];

    // Leak-based recommendations
    if (leakDetection.detected) {
      recommendations.push({
        priority: 'high',
        category: 'leak',
        message:
          'Memory leak detected. Investigate and fix memory retention issues.',
        action: 'profile_and_fix_leaks',
      });

      if (leakDetection.estimatedTimeToOOM) {
        recommendations.push({
          priority: 'critical',
          category: 'leak',
          message: `Estimated time to out-of-memory: ${leakDetection.estimatedTimeToOOM.toFixed(1)} minutes`,
          action: 'immediate_investigation',
        });
      }
    }

    // Trend-based recommendations
    if (trend && trend.trend === 'growing') {
      if (trend.slope > 10) {
        recommendations.push({
          priority: 'high',
          category: 'trend',
          message: `Rapid memory growth: ${trend.slope.toFixed(2)} MB/min`,
          action: 'investigate_growth',
        });
      }
    }

    // Pattern-based recommendations
    patterns.forEach((pattern) => {
      if (pattern.type === 'exponential') {
        recommendations.push({
          priority: 'critical',
          category: 'pattern',
          message: 'Exponential memory growth detected',
          action: 'immediate_intervention',
        });
      } else if (
        pattern.type === 'sawtooth' &&
        pattern.characteristics.amplitude > 100 * 1048576
      ) {
        recommendations.push({
          priority: 'medium',
          category: 'pattern',
          message: 'Large GC cycles detected. Consider tuning GC parameters.',
          action: 'tune_gc',
        });
      }
    });

    // Pressure-based recommendations
    if (pressureLevel === 'critical') {
      recommendations.push({
        priority: 'critical',
        category: 'pressure',
        message: 'Critical memory pressure. Immediate action required.',
        action: 'release_memory',
      });
    } else if (pressureLevel === 'warning') {
      recommendations.push({
        priority: 'medium',
        category: 'pressure',
        message: 'Warning memory pressure. Monitor closely.',
        action: 'monitor_and_prepare',
      });
    }

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    recommendations.sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    );

    return recommendations;
  }

  /**
   * Determine overall status
   *
   * @param pressureLevel
   * @param leakDetected
   * @private
   */
  #determineStatus(pressureLevel, leakDetected) {
    if (pressureLevel === 'critical' || leakDetected) {
      return 'critical';
    }
    if (pressureLevel === 'warning') {
      return 'warning';
    }
    return 'healthy';
  }

  /**
   * Format report as text
   *
   * @param {MemoryReport} report - Report to format
   * @returns {string}
   */
  formatAsText(report) {
    const lines = [];

    lines.push('=== MEMORY REPORT ===');
    lines.push(
      `Timestamp: ${new Date(report.metadata.timestamp).toISOString()}`
    );
    lines.push(`Status: ${report.summary.status.toUpperCase()}`);
    lines.push('');

    // Summary
    lines.push('SUMMARY:');
    lines.push(
      `  Heap Used: ${(report.summary.heapUsed / 1048576).toFixed(2)} MB`
    );
    lines.push(
      `  Heap Total: ${(report.summary.heapTotal / 1048576).toFixed(2)} MB`
    );
    lines.push(`  Usage: ${(report.summary.usagePercent * 100).toFixed(1)}%`);
    lines.push(`  Pressure Level: ${report.summary.pressureLevel}`);
    lines.push(
      `  Leak Detected: ${report.summary.leakDetected ? 'YES' : 'NO'}`
    );
    lines.push('');

    // Trends
    if (report.trends) {
      lines.push('TRENDS:');
      lines.push(`  Pattern: ${report.trends.trend}`);
      lines.push(`  Growth Rate: ${report.trends.slope.toFixed(2)} MB/min`);
      lines.push(
        `  Confidence: ${(report.trends.confidence * 100).toFixed(1)}%`
      );
      lines.push('');
    }

    // Patterns
    if (report.patterns && report.patterns.length > 0) {
      lines.push('PATTERNS DETECTED:');
      report.patterns.forEach((pattern) => {
        lines.push(`  - ${pattern.type}: ${pattern.description}`);
      });
      lines.push('');
    }

    // Hotspots
    if (report.hotspots && report.hotspots.length > 0) {
      lines.push('MEMORY HOTSPOTS:');
      report.hotspots.slice(0, 5).forEach((hotspot) => {
        lines.push(
          `  - ${hotspot.operation}: ${(hotspot.averageMemoryIncrease / 1048576).toFixed(2)} MB avg`
        );
      });
      lines.push('');
    }

    // Recommendations
    if (report.recommendations && report.recommendations.length > 0) {
      lines.push('RECOMMENDATIONS:');
      report.recommendations.forEach((rec) => {
        lines.push(`  [${rec.priority.toUpperCase()}] ${rec.message}`);
      });
      lines.push('');
    }

    lines.push('=== END REPORT ===');

    return lines.join('\n');
  }

  /**
   * Format report as Markdown
   *
   * @param {MemoryReport} report - Report to format
   * @returns {string}
   */
  formatAsMarkdown(report) {
    const lines = [];

    lines.push('# Memory Report');
    lines.push(
      `**Generated**: ${new Date(report.metadata.timestamp).toISOString()}`
    );
    lines.push(`**Status**: ${report.summary.status.toUpperCase()}`);
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(
      `| Heap Used | ${(report.summary.heapUsed / 1048576).toFixed(2)} MB |`
    );
    lines.push(
      `| Heap Total | ${(report.summary.heapTotal / 1048576).toFixed(2)} MB |`
    );
    lines.push(
      `| Usage | ${(report.summary.usagePercent * 100).toFixed(1)}% |`
    );
    lines.push(`| Pressure Level | ${report.summary.pressureLevel} |`);
    lines.push(
      `| Leak Detected | ${report.summary.leakDetected ? '⚠️ YES' : '✅ NO'} |`
    );
    lines.push('');

    // Trends
    if (report.trends) {
      lines.push('## Memory Trends');
      lines.push(`- **Pattern**: ${report.trends.trend}`);
      lines.push(`- **Growth Rate**: ${report.trends.slope.toFixed(2)} MB/min`);
      lines.push(
        `- **Confidence**: ${(report.trends.confidence * 100).toFixed(1)}%`
      );
      lines.push('');
    }

    // Recommendations
    if (report.recommendations && report.recommendations.length > 0) {
      lines.push('## Recommendations');
      report.recommendations.forEach((rec) => {
        const icon =
          rec.priority === 'critical'
            ? '🚨'
            : rec.priority === 'high'
              ? '⚠️'
              : rec.priority === 'medium'
                ? '📊'
                : 'ℹ️';
        lines.push(
          `- ${icon} **[${rec.priority.toUpperCase()}]** ${rec.message}`
        );
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Export report in specified format
   *
   * @param {MemoryReport} [report] - Report to export (or generate new)
   * @param {string} [format] - Export format
   * @returns {string|object}
   */
  exportReport(report, format = ReportFormat.JSON) {
    assertNonBlankString(format, 'Export format');

    if (!report) {
      report = this.generateReport();
    }

    switch (format.toLowerCase()) {
      case ReportFormat.JSON:
        return JSON.stringify(report, null, 2);

      case ReportFormat.TEXT:
        return this.formatAsText(report);

      case ReportFormat.MARKDOWN:
        return this.formatAsMarkdown(report);

      case ReportFormat.HTML:
        return this.#formatAsHtml(report);

      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Format report as HTML
   *
   * @param report
   * @private
   */
  #formatAsHtml(report) {
    const statusClass =
      report.summary.status === 'critical'
        ? 'critical'
        : report.summary.status === 'warning'
          ? 'warning'
          : 'healthy';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Memory Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .status-critical { color: #d32f2f; }
    .status-warning { color: #f57c00; }
    .status-healthy { color: #388e3c; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
    .section { margin: 20px 0; }
  </style>
</head>
<body>
  <h1>Memory Report</h1>
  <p><strong>Status:</strong> <span class="status-${statusClass}">${report.summary.status.toUpperCase()}</span></p>
  <p><strong>Generated:</strong> ${new Date(report.metadata.timestamp).toISOString()}</p>

  <div class="section">
    <h2>Summary</h2>
    <table>
      <tr><th>Metric</th><th>Value</th></tr>
      <tr><td>Heap Used</td><td>${(report.summary.heapUsed / 1048576).toFixed(2)} MB</td></tr>
      <tr><td>Heap Total</td><td>${(report.summary.heapTotal / 1048576).toFixed(2)} MB</td></tr>
      <tr><td>Usage</td><td>${(report.summary.usagePercent * 100).toFixed(1)}%</td></tr>
      <tr><td>Pressure Level</td><td>${report.summary.pressureLevel}</td></tr>
      <tr><td>Leak Detected</td><td>${report.summary.leakDetected ? 'YES' : 'NO'}</td></tr>
    </table>
  </div>

  ${
    report.recommendations && report.recommendations.length > 0
      ? `
  <div class="section">
    <h2>Recommendations</h2>
    <ul>
      ${report.recommendations
        .map(
          (rec) =>
            `<li><strong>[${rec.priority.toUpperCase()}]</strong> ${rec.message}</li>`
        )
        .join('')}
    </ul>
  </div>
  `
      : ''
  }
</body>
</html>`;

    return html;
  }

  /**
   * Add report to history
   *
   * @param report
   * @private
   */
  #addToHistory(report) {
    this.#reportHistory.push({
      timestamp: report.metadata.timestamp,
      summary: report.summary,
      recommendations: report.recommendations
        ? report.recommendations.length
        : 0,
    });

    // Maintain history size limit
    if (this.#reportHistory.length > this.#config.maxReportHistory) {
      this.#reportHistory.shift();
    }
  }

  /**
   * Start automatic reporting
   *
   * @private
   */
  #startAutoReporting() {
    this.#autoReportInterval = setInterval(() => {
      const report = this.generateReport();

      if (report.summary.status === 'critical') {
        this.#logger.warn(
          'Auto-report: Critical memory status',
          report.summary
        );
      }
    }, this.#config.autoReportInterval);

    this.#logger.info(
      `Auto-reporting started: every ${this.#config.autoReportInterval}ms`
    );
  }

  /**
   * Stop automatic reporting
   */
  stopAutoReporting() {
    if (this.#autoReportInterval) {
      clearInterval(this.#autoReportInterval);
      this.#autoReportInterval = null;
      this.#logger.info('Auto-reporting stopped');
    }
  }

  /**
   * Get report history
   *
   * @param {number} [limit] - Number of reports to return
   */
  getHistory(limit) {
    if (limit) {
      return this.#reportHistory.slice(-limit);
    }
    return [...this.#reportHistory];
  }

  /**
   * Clear report history
   */
  clearHistory() {
    this.#reportHistory = [];
    this.#logger.info('Report history cleared');
  }

  /**
   * Destroy reporter
   */
  destroy() {
    this.stopAutoReporting();
    this.clearHistory();
    this.#logger.info('MemoryReporter destroyed');
  }
}
