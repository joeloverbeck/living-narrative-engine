/**
 * @file Performance monitoring dashboard for integration testing
 */

export class PerformanceDashboard {
  #metrics;
  #startTime;

  constructor() {
    this.#metrics = {
      payloadCreation: {
        total: 0,
        multiTarget: 0,
        legacy: 0,
        errors: 0,
        averageTime: 0,
        maxTime: 0,
      },
      ruleExecution: {
        total: 0,
        successful: 0,
        failed: 0,
        averageTime: 0,
      },
      memory: {
        initial: 0,
        peak: 0,
        current: 0,
        leaked: 0,
      },
      system: {
        uptime: 0,
        totalEvents: 0,
        errorRate: 0,
      },
    };
    this.#startTime = performance.now();
  }

  /**
   * Records payload creation metrics
   *
   * @param {object} payload - Created payload
   * @param {number} duration - Creation duration
   * @param {boolean} isMultiTarget - Whether payload is multi-target
   * @param {boolean} hasError - Whether creation had errors
   */
  recordPayloadCreation(payload, duration, isMultiTarget, hasError = false) {
    this.#metrics.payloadCreation.total++;

    if (hasError) {
      this.#metrics.payloadCreation.errors++;
    } else if (isMultiTarget) {
      this.#metrics.payloadCreation.multiTarget++;
    } else {
      this.#metrics.payloadCreation.legacy++;
    }

    // Update timing metrics
    const totalTime =
      this.#metrics.payloadCreation.averageTime *
        (this.#metrics.payloadCreation.total - 1) +
      duration;
    this.#metrics.payloadCreation.averageTime =
      totalTime / this.#metrics.payloadCreation.total;
    this.#metrics.payloadCreation.maxTime = Math.max(
      this.#metrics.payloadCreation.maxTime,
      duration
    );
  }

  /**
   * Records rule execution metrics
   *
   * @param {object} ruleResult - Rule execution result
   * @param {number} duration - Execution duration
   */
  recordRuleExecution(ruleResult, duration) {
    this.#metrics.ruleExecution.total++;

    if (ruleResult.success) {
      this.#metrics.ruleExecution.successful++;
    } else {
      this.#metrics.ruleExecution.failed++;
    }

    const totalTime =
      this.#metrics.ruleExecution.averageTime *
        (this.#metrics.ruleExecution.total - 1) +
      duration;
    this.#metrics.ruleExecution.averageTime =
      totalTime / this.#metrics.ruleExecution.total;
  }

  /**
   * Updates memory metrics
   */
  updateMemoryMetrics() {
    if (performance.memory) {
      const current = performance.memory.usedJSHeapSize;

      if (this.#metrics.memory.initial === 0) {
        this.#metrics.memory.initial = current;
      }

      this.#metrics.memory.current = current;
      this.#metrics.memory.peak = Math.max(this.#metrics.memory.peak, current);
      this.#metrics.memory.leaked = current - this.#metrics.memory.initial;
    }
  }

  /**
   * Generates comprehensive performance report
   *
   * @returns {object} Performance report
   */
  generateReport() {
    this.updateMemoryMetrics();

    const uptime = performance.now() - this.#startTime;
    const errorRate =
      this.#metrics.payloadCreation.total > 0
        ? (this.#metrics.payloadCreation.errors /
            this.#metrics.payloadCreation.total) *
          100
        : 0;

    return {
      timestamp: new Date().toISOString(),
      uptime: uptime.toFixed(2),
      payloadCreation: {
        ...this.#metrics.payloadCreation,
        multiTargetRate:
          this.#metrics.payloadCreation.total > 0
            ? (this.#metrics.payloadCreation.multiTarget /
                this.#metrics.payloadCreation.total) *
              100
            : 0,
        errorRate: errorRate,
      },
      ruleExecution: {
        ...this.#metrics.ruleExecution,
        successRate:
          this.#metrics.ruleExecution.total > 0
            ? (this.#metrics.ruleExecution.successful /
                this.#metrics.ruleExecution.total) *
              100
            : 0,
      },
      memory: {
        ...this.#metrics.memory,
        initialMB: (this.#metrics.memory.initial / 1024 / 1024).toFixed(2),
        peakMB: (this.#metrics.memory.peak / 1024 / 1024).toFixed(2),
        currentMB: (this.#metrics.memory.current / 1024 / 1024).toFixed(2),
        leakedMB: (this.#metrics.memory.leaked / 1024 / 1024).toFixed(2),
      },
      system: {
        uptime: uptime.toFixed(2),
        totalEvents:
          this.#metrics.payloadCreation.total +
          this.#metrics.ruleExecution.total,
        errorRate: errorRate.toFixed(2),
      },
    };
  }

  /**
   * Generates formatted dashboard display
   *
   * @returns {string} Formatted dashboard
   */
  generateDashboard() {
    const report = this.generateReport();

    return `
╔════════════════════════════════════════════════════════════════╗
║                    PERFORMANCE DASHBOARD                       ║
╠════════════════════════════════════════════════════════════════╣
║ System Uptime: ${report.uptime}ms                                       ║
║ Total Events:  ${report.system.totalEvents}                                          ║
║ Error Rate:    ${report.system.errorRate}%                                        ║
╠════════════════════════════════════════════════════════════════╣
║                    PAYLOAD CREATION                            ║
║ Total:         ${report.payloadCreation.total}                                          ║
║ Multi-Target:  ${report.payloadCreation.multiTarget} (${report.payloadCreation.multiTargetRate.toFixed(1)}%)                     ║
║ Legacy:        ${report.payloadCreation.legacy}                                          ║
║ Errors:        ${report.payloadCreation.errors} (${report.payloadCreation.errorRate.toFixed(1)}%)                       ║
║ Avg Time:      ${report.payloadCreation.averageTime.toFixed(2)}ms                              ║
║ Max Time:      ${report.payloadCreation.maxTime.toFixed(2)}ms                              ║
╠════════════════════════════════════════════════════════════════╣
║                    RULE EXECUTION                              ║
║ Total:         ${report.ruleExecution.total}                                          ║
║ Successful:    ${report.ruleExecution.successful} (${report.ruleExecution.successRate.toFixed(1)}%)                     ║
║ Failed:        ${report.ruleExecution.failed}                                          ║
║ Avg Time:      ${report.ruleExecution.averageTime.toFixed(2)}ms                              ║
╠════════════════════════════════════════════════════════════════╣
║                    MEMORY USAGE                                ║
║ Initial:       ${report.memory.initialMB}MB                                 ║
║ Peak:          ${report.memory.peakMB}MB                                 ║
║ Current:       ${report.memory.currentMB}MB                                 ║
║ Leaked:        ${report.memory.leakedMB}MB                                 ║
╚════════════════════════════════════════════════════════════════╝
    `.trim();
  }

  /**
   * Resets all metrics
   */
  reset() {
    this.#metrics = {
      payloadCreation: {
        total: 0,
        multiTarget: 0,
        legacy: 0,
        errors: 0,
        averageTime: 0,
        maxTime: 0,
      },
      ruleExecution: {
        total: 0,
        successful: 0,
        failed: 0,
        averageTime: 0,
      },
      memory: {
        initial: 0,
        peak: 0,
        current: 0,
        leaked: 0,
      },
      system: {
        uptime: 0,
        totalEvents: 0,
        errorRate: 0,
      },
    };
    this.#startTime = performance.now();
  }
}

export default PerformanceDashboard;
