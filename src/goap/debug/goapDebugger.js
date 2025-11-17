/**
 * @file Main GOAP debugger API
 * @see planInspector.js
 * @see stateDiffViewer.js
 * @see refinementTracer.js
 */

import { assertNonBlankString } from '../../utils/dependencyUtils.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Main debugging API for GOAP system.
 * Coordinates all debug tools and provides unified interface.
 *
 * ⚠️ IMPLEMENTATION NOTE: This class delegates to specialized debug tools
 * and handles the nested failure history structure from GoapController.
 */
class GOAPDebugger {
  #goapController;
  #planInspector;
  #stateDiffViewer;
  #refinementTracer;
  #logger;

  /**
   * Creates a new GOAPDebugger instance.
   *
   * @param {object} deps - Dependencies injected by the DI container
   * @param {object} deps.goapController - GOAP controller
   * @param {object} deps.planInspector - Plan inspection tool
   * @param {object} deps.stateDiffViewer - State diff tool
   * @param {object} deps.refinementTracer - Refinement tracing tool
   * @param {object} deps.logger - Logger instance
   */
  constructor({
    goapController,
    planInspector,
    stateDiffViewer,
    refinementTracer,
    logger,
  }) {
    validateDependency(goapController, 'IGoapController', logger, {
      requiredMethods: [
        'getActivePlan',
        'getFailedGoals',
        'getFailedTasks',
        'getDependencyDiagnostics',
      ],
    });
    validateDependency(planInspector, 'IPlanInspector', logger, {
      requiredMethods: ['inspect', 'inspectJSON'],
    });
    validateDependency(stateDiffViewer, 'IStateDiffViewer', logger, {
      requiredMethods: ['diff', 'visualize', 'diffJSON'],
    });
    validateDependency(refinementTracer, 'IRefinementTracer', logger, {
      requiredMethods: ['startCapture', 'stopCapture', 'getTrace', 'format'],
    });

    this.#goapController = goapController;
    this.#planInspector = planInspector;
    this.#stateDiffViewer = stateDiffViewer;
    this.#refinementTracer = refinementTracer;
    this.#logger = logger;
  }

  // ==================== Plan Inspection ====================

  /**
   * Inspect active plan for an actor.
   *
   * @param {string} actorId - Actor entity ID
   * @returns {string} Formatted plan text
   */
  inspectPlan(actorId) {
    assertNonBlankString(
      actorId,
      'actorId',
      'GOAPDebugger.inspectPlan',
      this.#logger
    );
    return this.#planInspector.inspect(actorId);
  }

  /**
   * Get active plan as JSON.
   *
   * @param {string} actorId - Actor entity ID
   * @returns {object|null} Plan data
   */
  inspectPlanJSON(actorId) {
    assertNonBlankString(
      actorId,
      'actorId',
      'GOAPDebugger.inspectPlanJSON',
      this.#logger
    );
    return this.#planInspector.inspectJSON(actorId);
  }

  /**
   * Get current goal for an actor.
   *
   * @param {string} actorId - Actor entity ID
   * @returns {object|null} Current goal
   */
  inspectCurrentGoal(actorId) {
    assertNonBlankString(
      actorId,
      'actorId',
      'GOAPDebugger.inspectCurrentGoal',
      this.#logger
    );

    const plan = this.#goapController.getActivePlan(actorId);
    return plan ? plan.goal : null;
  }

  /**
   * Get failure history for an actor.
   *
   * ⚠️ CORRECTED: Returns nested structure with failure arrays
   * Structure: { failedGoals: Array<{goalId, failures: Array<{reason, timestamp}>>>, failedTasks: [...] }
   *
   * @param {string} actorId - Actor entity ID
   * @returns {object} Failed goals and tasks with nested failure arrays
   */
  getFailureHistory(actorId) {
    assertNonBlankString(
      actorId,
      'actorId',
      'GOAPDebugger.getFailureHistory',
      this.#logger
    );

    return {
      failedGoals: this.#goapController.getFailedGoals(actorId),
      failedTasks: this.#goapController.getFailedTasks(actorId),
    };
  }

  /**
   * Surface dependency diagnostics collected by GoapController.
   * @returns {Array<object>} Dependency snapshots
   */
  getDependencyDiagnostics() {
    return this.#goapController.getDependencyDiagnostics();
  }

  // ==================== State Visualization ====================

  /**
   * Show state diff between two planning states.
   *
   * @param {object} beforeState - State before task
   * @param {object} afterState - State after task
   * @param {object} [options] - Formatting options
   * @returns {string} Formatted diff text
   */
  showStateDiff(beforeState, afterState, options = {}) {
    const diff = this.#stateDiffViewer.diff(beforeState, afterState);
    return this.#stateDiffViewer.visualize(diff, options);
  }

  /**
   * Get state diff as JSON.
   *
   * @param {object} beforeState - State before task
   * @param {object} afterState - State after task
   * @returns {object} Diff data
   */
  showStateDiffJSON(beforeState, afterState) {
    return this.#stateDiffViewer.diffJSON(beforeState, afterState);
  }

  // ==================== Refinement Tracing ====================

  /**
   * Start capturing refinement trace for an actor.
   *
   * @param {string} actorId - Actor entity ID
   */
  startTrace(actorId) {
    assertNonBlankString(
      actorId,
      'actorId',
      'GOAPDebugger.startTrace',
      this.#logger
    );
    this.#refinementTracer.startCapture(actorId);
  }

  /**
   * Stop capturing and return trace for an actor.
   *
   * @param {string} actorId - Actor entity ID
   * @returns {object|null} Trace data
   */
  stopTrace(actorId) {
    assertNonBlankString(
      actorId,
      'actorId',
      'GOAPDebugger.stopTrace',
      this.#logger
    );
    return this.#refinementTracer.stopCapture(actorId);
  }

  /**
   * Get current trace without stopping.
   *
   * @param {string} actorId - Actor entity ID
   * @returns {object|null} Current trace
   */
  getTrace(actorId) {
    assertNonBlankString(
      actorId,
      'actorId',
      'GOAPDebugger.getTrace',
      this.#logger
    );
    return this.#refinementTracer.getTrace(actorId);
  }

  /**
   * Format trace as text.
   *
   * @param {object} trace - Trace from stopTrace() or getTrace()
   * @returns {string} Formatted trace
   */
  formatTrace(trace) {
    return this.#refinementTracer.format(trace);
  }

  // ==================== Combined Reporting ====================

  /**
   * Generate comprehensive debug report for an actor.
   *
   * ⚠️ CORRECTED: Properly handles nested failure structure from GoapController
   *
   * @param {string} actorId - Actor entity ID
   * @returns {string} Complete debug report
   */
  generateReport(actorId) {
    assertNonBlankString(
      actorId,
      'actorId',
      'GOAPDebugger.generateReport',
      this.#logger
    );

    let report = '';
    report += `=== GOAP Debug Report: ${actorId} ===\n`;
    report += `Generated: ${new Date().toISOString()}\n`;
    report += `\n`;

    // Plan inspection
    report += `--- Active Plan ---\n`;
    report += this.#planInspector.inspect(actorId);
    report += `\n`;

    // Failure history
    // ⚠️ CORRECTED: Handle nested failure array structure
    const failures = this.getFailureHistory(actorId);
    report += `--- Failure History ---\n`;
    report += `Failed Goals: ${failures.failedGoals.length}\n`;
    for (const failedGoal of failures.failedGoals) {
      report += `  Goal: ${failedGoal.goalId}\n`;
      for (const failure of failedGoal.failures) {
        const label = failure.code ? `[${failure.code}] ` : '';
        report += `    - ${label}${failure.reason} (${new Date(failure.timestamp).toISOString()})\n`;
      }
    }
    report += `Failed Tasks: ${failures.failedTasks.length}\n`;
    for (const failedTask of failures.failedTasks) {
      report += `  Task: ${failedTask.taskId}\n`;
      for (const failure of failedTask.failures) {
        const label = failure.code ? `[${failure.code}] ` : '';
        report += `    - ${label}${failure.reason} (${new Date(failure.timestamp).toISOString()})\n`;
      }
    }
    report += `\n`;

    // Dependency diagnostics
    const dependencies = this.getDependencyDiagnostics();
    report += `--- Dependency Contracts ---\n`;
    if (!dependencies || dependencies.length === 0) {
      report += `No dependency diagnostics captured.\n`;
    } else {
      for (const dependency of dependencies) {
        const required = dependency.requiredMethods || [];
        const provided = dependency.providedMethods || [];
        const missing = dependency.missingMethods || [];
        report += `  ${dependency.dependency || 'unknown'}: status=${dependency.status}\n`;
        report += `    required: ${required.length ? required.join(', ') : '∅'}\n`;
        report += `    provided: ${provided.length ? provided.join(', ') : '∅'}\n`;
        if (missing.length > 0) {
          report += `    missing: ${missing.join(', ')}\n`;
        }
        report += `    validated: ${new Date(dependency.timestamp).toISOString()}\n`;
      }
    }
    report += `\n`;

    // Task library diagnostics
    const libraryDiagnostics = this.#goapController.getTaskLibraryDiagnostics(actorId);
    report += `--- Task Library Diagnostics ---\n`;
    if (!libraryDiagnostics) {
      report += `No task library diagnostics captured.\n`;
    } else {
      report += `Captured: ${new Date(libraryDiagnostics.timestamp || Date.now()).toISOString()}\n`;
      report += `Total Tasks: ${libraryDiagnostics.totalTasks ?? 0}\n`;
      const namespaces = libraryDiagnostics.namespaces || {};
      if (Object.keys(namespaces).length === 0) {
        report += `Namespaces: ∅\n`;
      } else {
        report += `Namespaces:\n`;
        for (const [namespace, data] of Object.entries(namespaces)) {
          report += `  - ${namespace}: ${data.taskCount ?? 0} tasks\n`;
        }
      }
      if (libraryDiagnostics.missingActors && libraryDiagnostics.missingActors.length > 0) {
        report += `Missing Actors: ${libraryDiagnostics.missingActors.join(', ')}\n`;
      }
      if (libraryDiagnostics.warnings && libraryDiagnostics.warnings.length > 0) {
        report += `Warnings:\n`;
        for (const warning of libraryDiagnostics.warnings) {
          report += `  • ${warning}\n`;
        }
      }
    }
    report += `\n`;

    // Current trace (if any)
    const trace = this.getTrace(actorId);
    if (trace) {
      report += `--- Active Trace ---\n`;
      report += this.formatTrace(trace);
      report += `\n`;
    }

    report += `=== End Report ===\n`;

    return report;
  }

  /**
   * Generate report as JSON.
   *
   * @param {string} actorId - Actor entity ID
   * @returns {object} Debug report data
   */
  generateReportJSON(actorId) {
    assertNonBlankString(
      actorId,
      'actorId',
      'GOAPDebugger.generateReportJSON',
      this.#logger
    );

    const libraryDiagnostics = this.#goapController.getTaskLibraryDiagnostics(actorId);

    return {
      actorId,
      timestamp: Date.now(),
      plan: this.inspectPlanJSON(actorId),
      failures: this.getFailureHistory(actorId),
      dependencies: this.getDependencyDiagnostics(),
      taskLibraryDiagnostics: libraryDiagnostics,
      trace: this.getTrace(actorId),
    };
  }
}

export default GOAPDebugger;
