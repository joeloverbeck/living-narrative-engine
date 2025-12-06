/**
 * @file Analytics service for notes categorization tracking
 */

import { validateDependency } from '../utils/dependencyUtils.js';
import { SUBJECT_TYPES } from '../constants/subjectTypes.js';

/**
 * Analytics service for tracking notes categorization patterns and quality.
 */
class NotesAnalyticsService {
  #logger;
  #storage; // Store analytics data (could be in-memory or persistent)
  #metrics;

  constructor({ logger, storage = null }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#logger = logger;
    this.#storage = storage; // Optional persistent storage
    this.#metrics = this.initializeMetrics();
  }

  initializeMetrics() {
    return {
      totalNotes: 0,
      typeDistribution: Object.fromEntries(
        Object.values(SUBJECT_TYPES).map((type) => [type, 0])
      ),
      categorizationErrors: [],
      misclassificationPatterns: {},
      sessionData: [],
      lastReset: Date.now(),
    };
  }

  /**
   * Record a note creation event
   *
   * @param {object} note - The note to record
   * @param {object} [metadata] - Optional metadata to include
   */
  recordNoteCreation(note, metadata = {}) {
    this.#metrics.totalNotes++;
    this.#metrics.typeDistribution[note.subjectType]++;

    this.#metrics.sessionData.push({
      timestamp: Date.now(),
      subjectType: note.subjectType,
      subject: note.subject,
      textLength: note.text.length,
      hasContext: !!note.context,
      ...metadata,
    });

    this.#logger.debug(
      `Analytics: Recorded note creation - ${note.subjectType}`
    );
  }

  /**
   * Record a categorization error (manual correction or validation failure)
   *
   * @param {object} note - The note that was miscategorized
   * @param {string} incorrectType - The incorrect subject type assigned
   * @param {string} correctType - The correct subject type
   * @param {string} [reason] - Optional explanation for the correction
   */
  recordCategorizationError(note, incorrectType, correctType, reason = '') {
    const error = {
      timestamp: Date.now(),
      subject: note.subject,
      text: note.text,
      incorrectType,
      correctType,
      reason,
    };

    this.#metrics.categorizationErrors.push(error);

    // Track misclassification pattern
    const patternKey = `${incorrectType}→${correctType}`;
    this.#metrics.misclassificationPatterns[patternKey] =
      (this.#metrics.misclassificationPatterns[patternKey] || 0) + 1;

    this.#logger.warn(`Analytics: Categorization error - ${patternKey}`, {
      error,
    });
  }

  /**
   * Get current analytics summary
   *
   * @returns {object} Summary containing metrics, distributions, and insights
   */
  getAnalyticsSummary() {
    const totalNotes = this.#metrics.totalNotes;

    // Calculate type distribution percentages
    const typePercentages = {};
    Object.entries(this.#metrics.typeDistribution).forEach(([type, count]) => {
      typePercentages[type] =
        totalNotes > 0 ? ((count / totalNotes) * 100).toFixed(2) : '0.00';
    });

    // Calculate categorization accuracy
    const totalErrors = this.#metrics.categorizationErrors.length;
    const accuracy =
      totalNotes > 0
        ? (((totalNotes - totalErrors) / totalNotes) * 100).toFixed(2)
        : 100;

    // Identify most common misclassifications
    const topMisclassifications = Object.entries(
      this.#metrics.misclassificationPatterns
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pattern, count]) => ({ pattern, count }));

    // Identify underutilized types
    const underutilizedTypes = Object.entries(this.#metrics.typeDistribution)
      .filter(([_type, count]) => count === 0)
      .map(([type]) => type);

    // Identify most used types
    const mostUsedTypes = Object.entries(this.#metrics.typeDistribution)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({
        type,
        count,
        percentage: typePercentages[type],
      }));

    return {
      summary: {
        totalNotes,
        totalErrors,
        accuracy: `${accuracy}%`,
        sessionStart: new Date(this.#metrics.lastReset).toISOString(),
      },
      typeDistribution: typePercentages,
      mostUsedTypes,
      underutilizedTypes,
      topMisclassifications,
      categorizationErrors: this.#metrics.categorizationErrors,
    };
  }

  /**
   * Generate detailed analytics report
   *
   * @returns {string} Markdown-formatted analytics report
   */
  generateReport() {
    const summary = this.getAnalyticsSummary();

    let report = '# Notes Categorization Analytics Report\n\n';
    report += `**Generated:** ${new Date().toISOString()}\n`;
    report += `**Session Start:** ${summary.summary.sessionStart}\n\n`;

    report += '## Summary\n\n';
    report += `- **Total Notes:** ${summary.summary.totalNotes}\n`;
    report += `- **Categorization Accuracy:** ${summary.summary.accuracy}\n`;
    report += `- **Categorization Errors:** ${summary.summary.totalErrors}\n\n`;

    report += '## Type Distribution\n\n';
    report += '| Subject Type | Count | Percentage |\n';
    report += '|--------------|-------|------------|\n';
    Object.entries(this.#metrics.typeDistribution)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        const percentage = summary.typeDistribution[type];
        report += `| ${type} | ${count} | ${percentage}% |\n`;
      });
    report += '\n';

    report += '## Most Used Types\n\n';
    summary.mostUsedTypes.forEach(({ type, count, percentage }) => {
      report += `- **${type}**: ${count} notes (${percentage}%)\n`;
    });
    report += '\n';

    if (summary.underutilizedTypes.length > 0) {
      report += '## Underutilized Types (0 usage)\n\n';
      summary.underutilizedTypes.forEach((type) => {
        report += `- ${type}\n`;
      });
      report += '\n';
    }

    if (summary.topMisclassifications.length > 0) {
      report += '## Top Misclassification Patterns\n\n';
      report += '| Pattern | Count |\n';
      report += '|---------|-------|\n';
      summary.topMisclassifications.forEach(({ pattern, count }) => {
        report += `| ${pattern} | ${count} |\n`;
      });
      report += '\n';
    }

    if (summary.categorizationErrors.length > 0) {
      report += '## Categorization Errors\n\n';
      summary.categorizationErrors.slice(0, 10).forEach((error) => {
        report += `### ${error.subject}\n`;
        report += `- **Text:** ${error.text}\n`;
        report += `- **Incorrect Type:** ${error.incorrectType}\n`;
        report += `- **Correct Type:** ${error.correctType}\n`;
        if (error.reason) {
          report += `- **Reason:** ${error.reason}\n`;
        }
        report += `- **Timestamp:** ${new Date(error.timestamp).toISOString()}\n\n`;
      });
    }

    return report;
  }

  /**
   * Reset analytics (start new tracking session)
   */
  resetAnalytics() {
    this.#logger.info('Analytics: Resetting metrics');
    this.#metrics = this.initializeMetrics();
  }

  /**
   * Save analytics to persistent storage (if available)
   */
  async saveAnalytics() {
    if (!this.#storage) {
      this.#logger.warn('Analytics: No storage configured, cannot save');
      return;
    }

    try {
      await this.#storage.save('notes-analytics', this.#metrics);
      this.#logger.info('Analytics: Saved to persistent storage');
    } catch (error) {
      this.#logger.error('Analytics: Failed to save', error);
    }
  }

  /**
   * Load analytics from persistent storage (if available)
   */
  async loadAnalytics() {
    if (!this.#storage) {
      this.#logger.warn('Analytics: No storage configured, cannot load');
      return;
    }

    try {
      const loaded = await this.#storage.load('notes-analytics');
      if (loaded) {
        this.#metrics = loaded;
        this.#logger.info('Analytics: Loaded from persistent storage');
      }
    } catch (error) {
      this.#logger.error('Analytics: Failed to load', error);
    }
  }
}

export default NotesAnalyticsService;
