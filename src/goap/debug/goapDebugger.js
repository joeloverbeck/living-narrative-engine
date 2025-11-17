/**
 * @file Main GOAP debugger API
 * @see planInspector.js
 * @see stateDiffViewer.js
 * @see refinementTracer.js
 */

import { assertNonBlankString } from '../../utils/dependencyUtils.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
import { GOAP_DEBUGGER_DIAGNOSTICS_CONTRACT } from './goapDebuggerDiagnosticsContract.js';

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
  #diagnosticWarningCache;
  #diagnosticsContractVersion;

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
    const diagnosticSections = GOAP_DEBUGGER_DIAGNOSTICS_CONTRACT.sections;

    validateDependency(goapController, 'IGoapController', logger, {
      requiredMethods: [
        'getActivePlan',
        'getFailedGoals',
        'getFailedTasks',
        'getDependencyDiagnostics',
        diagnosticSections.taskLibrary.controllerMethod,
        diagnosticSections.planningState.controllerMethod,
        diagnosticSections.eventCompliance.controllerMethod,
        'getDiagnosticsContractVersion',
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

    const controllerVersion = goapController.getDiagnosticsContractVersion();
    if (controllerVersion !== GOAP_DEBUGGER_DIAGNOSTICS_CONTRACT.version) {
      throw new Error(
        `GOAPDebugger diagnostics contract mismatch: expected ${GOAP_DEBUGGER_DIAGNOSTICS_CONTRACT.version} but received ${controllerVersion}. See docs/goap/debugging-tools.md#diagnostics-contract`
      );
    }

    this.#goapController = goapController;
    this.#planInspector = planInspector;
    this.#stateDiffViewer = stateDiffViewer;
    this.#refinementTracer = refinementTracer;
    this.#logger = logger;
    this.#diagnosticWarningCache = new Map();
    this.#diagnosticsContractVersion = controllerVersion;
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

    const diagnostics = this.#collectDiagnostics(actorId);

    report += `--- Task Library Diagnostics ---\n`;
    report += this.#formatTaskLibraryDiagnostics(
      diagnostics.taskLibraryDiagnostics,
      diagnostics.meta.taskLibrary
    );
    report += `\n`;

    report += `--- Planning State Diagnostics ---\n`;
    report += this.#formatPlanningStateDiagnostics(
      diagnostics.planningStateDiagnostics,
      diagnostics.meta.planningState
    );
    report += `\n`;

    report += `--- Event Contract Compliance ---\n`;
    report += this.#formatEventComplianceDiagnostics(
      diagnostics.eventComplianceDiagnostics,
      diagnostics.meta.eventCompliance
    );
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

    const diagnostics = this.#collectDiagnostics(actorId);

    return {
      actorId,
      timestamp: Date.now(),
      plan: this.inspectPlanJSON(actorId),
      failures: this.getFailureHistory(actorId),
      dependencies: this.getDependencyDiagnostics(),
      taskLibraryDiagnostics: diagnostics.taskLibraryDiagnostics,
      planningStateDiagnostics: diagnostics.planningStateDiagnostics,
       eventComplianceDiagnostics: diagnostics.eventComplianceDiagnostics,
      diagnosticsMeta: diagnostics.meta,
      trace: this.getTrace(actorId),
    };
  }

  #collectDiagnostics(actorId) {
    const taskLibraryDiagnostics = this.#goapController.getTaskLibraryDiagnostics(actorId);
    const planningStateDiagnostics = this.#goapController.getPlanningStateDiagnostics(actorId);
    const eventComplianceDiagnostics = this.#goapController.getEventComplianceDiagnostics(actorId);

    return {
      taskLibraryDiagnostics,
      planningStateDiagnostics,
      eventComplianceDiagnostics,
      meta: {
        taskLibrary: this.#buildDiagnosticsMeta({
          actorId,
          section: GOAP_DEBUGGER_DIAGNOSTICS_CONTRACT.sections.taskLibrary,
          payload: taskLibraryDiagnostics,
        }),
        planningState: this.#buildDiagnosticsMeta({
          actorId,
          section: GOAP_DEBUGGER_DIAGNOSTICS_CONTRACT.sections.planningState,
          payload: planningStateDiagnostics,
          lastUpdatedResolver: (payload) => {
            if (
              payload &&
              Array.isArray(payload.lastMisses) &&
              payload.lastMisses.length > 0
            ) {
              return payload.lastMisses[payload.lastMisses.length - 1].timestamp;
            }
            return null;
          },
        }),
        eventCompliance: this.#buildDiagnosticsMeta({
          actorId,
          section: GOAP_DEBUGGER_DIAGNOSTICS_CONTRACT.sections.eventCompliance,
          payload: eventComplianceDiagnostics,
          lastUpdatedResolver: (payload) => {
            if (!payload) {
              return null;
            }
            const timestamps = [
              payload.actor?.lastViolation?.timestamp,
              payload.global?.lastViolation?.timestamp,
            ].filter(Boolean);
            return timestamps.length > 0 ? Math.max(...timestamps) : null;
          },
        }),
      },
    };
  }

  #buildDiagnosticsMeta({ actorId, section, payload, lastUpdatedResolver }) {
    const meta = {
      sectionId: section.id,
      label: section.label,
      actorId,
      available: Boolean(payload),
      stale: false,
      lastUpdated: null,
    };

    if (!payload) {
      meta.available = false;
      meta.stale = true;
      this.#logMissingDiagnosticsWarning(actorId, section.id);
      return meta;
    }

    const timestampCandidate = this.#resolveTimestamp(
      lastUpdatedResolver ? lastUpdatedResolver(payload) : payload?.timestamp
    );

    if (timestampCandidate) {
      meta.lastUpdated = new Date(timestampCandidate).toISOString();
      meta.stale =
        Date.now() - timestampCandidate >
        GOAP_DEBUGGER_DIAGNOSTICS_CONTRACT.staleThresholdMs;
    } else {
      meta.stale = true;
    }

    return meta;
  }

  #resolveTimestamp(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  #formatTaskLibraryDiagnostics(payload, meta) {
    if (!meta.available) {
      return 'No task library diagnostics captured. (see docs/goap/debugging-tools.md#diagnostics-contract)\n';
    }

    const lines = [];
    if (meta.stale) {
      lines.push(
        `⚠️ STALE — last updated ${meta.lastUpdated || 'unknown'} (see docs/goap/debugging-tools.md#diagnostics-contract)`
      );
    } else if (meta.lastUpdated) {
      lines.push(`Last updated: ${meta.lastUpdated}`);
    }

    lines.push(`Total Tasks: ${payload.totalTasks ?? 0}`);
    const namespaces = payload.namespaces || {};
    if (Object.keys(namespaces).length === 0) {
      lines.push('Namespaces: ∅');
    } else {
      lines.push('Namespaces:');
      for (const [namespace, data] of Object.entries(namespaces)) {
        lines.push(`  - ${namespace}: ${data.taskCount ?? 0} tasks`);
      }
    }
    if (payload.missingActors && payload.missingActors.length > 0) {
      lines.push(`Missing Actors: ${payload.missingActors.join(', ')}`);
    }
    if (payload.warnings && payload.warnings.length > 0) {
      lines.push('Warnings:');
      for (const warning of payload.warnings) {
        lines.push(`  • ${warning}`);
      }
    }

    return `${lines.join('\n')}\n`;
  }

  #formatPlanningStateDiagnostics(payload, meta) {
    if (!meta.available) {
      return 'No planning-state diagnostics captured (see docs/goap/debugging-tools.md#planning-state-assertions).\n';
    }

    const lines = [];
    if (meta.stale) {
      lines.push(
        `⚠️ STALE — no recent misses (last updated ${meta.lastUpdated || 'unknown'})`
      );
    } else if (meta.lastUpdated) {
      lines.push(`Last miss recorded: ${meta.lastUpdated}`);
    }

    const totalMisses = payload.totalMisses ?? 0;
    lines.push(`Total Misses: ${totalMisses}`);

    const lastMisses = Array.isArray(payload.lastMisses)
      ? payload.lastMisses
      : [];
    if (lastMisses.length === 0) {
      lines.push('Recent Misses: ∅ (enable GOAP_STATE_ASSERT=1 to fail fast).');
    } else {
      lines.push('Recent Misses (max 5):');
      for (const miss of lastMisses) {
        lines.push(
          `  • ${new Date(miss.timestamp).toISOString()} :: path=${miss.path || 'n/a'} origin=${miss.origin || 'unknown'} reason=${miss.reason}`
        );
      }
      lines.push('See docs/goap/debugging-tools.md#planning-state-assertions for remediation steps.');
    }

    return `${lines.join('\n')}\n`;
  }

  #formatEventComplianceDiagnostics(payload, meta) {
    if (!meta.available) {
      return 'Event compliance diagnostics unavailable (ensure goapEventDispatcher is wired).\n';
    }

    const lines = [];
    if (meta.stale) {
      lines.push(
        `⚠️ STALE — last violation recorded ${meta.lastUpdated || 'unknown'}`
      );
    } else if (meta.lastUpdated) {
      lines.push(`Last violation recorded: ${meta.lastUpdated}`);
    }

    const formatEntry = (label, entry) => {
      if (!entry) {
        lines.push(`${label}: ∅`);
        return;
      }
      lines.push(
        `${label}: total=${entry.totalEvents ?? 0}, missingPayloads=${entry.missingPayloads ?? 0}`
      );
      if (entry.lastViolation) {
        lines.push(
          `  Last violation (${entry.lastViolation.code}): event=${entry.lastViolation.eventType}, reason=${entry.lastViolation.reason}`
        );
      }
    };

    formatEntry('Global Totals', payload.global);
    formatEntry(`Actor (${payload.actor?.actorId || meta.actorId})`, payload.actor);

    const actorViolations = payload.actor?.missingPayloads ?? 0;
    const globalViolations = payload.global?.missingPayloads ?? 0;
    if (actorViolations > 0 || globalViolations > 0) {
      lines.push(
        '⚠️ Event Contract Violations detected — see docs/goap/debugging-tools.md#Planner Contract Checklist.'
      );
    } else {
      lines.push('Event payload contract satisfied for this actor.');
    }

    return `${lines.join('\n')}\n`;
  }

  #logMissingDiagnosticsWarning(actorId, sectionId) {
    const cacheKey = `${actorId}:${sectionId}`;
    if (this.#diagnosticWarningCache.has(cacheKey)) {
      return;
    }

    this.#diagnosticWarningCache.set(cacheKey, true);
    this.#logger.warn(
      GOAP_DEBUGGER_DIAGNOSTICS_CONTRACT.missingWarningCode,
      {
        actorId,
        sectionId,
        contractVersion: this.#diagnosticsContractVersion,
        hint: 'Instrumentation missing — see docs/goap/debugging-tools.md#diagnostics-contract',
      }
    );
  }
}

export default GOAPDebugger;
