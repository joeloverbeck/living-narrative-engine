/**
 * @file MonteCarloReportWorker - Generates Monte Carlo reports off the main thread.
 */

import jsonLogic from 'json-logic-js';
import PrototypeConstraintAnalyzer from '../services/PrototypeConstraintAnalyzer.js';
import PrototypeFitRankingService from '../services/PrototypeFitRankingService.js';
import ReportOrchestrator from '../services/ReportOrchestrator.js';
import SensitivityAnalyzer from '../services/SensitivityAnalyzer.js';
import { createReportGenerator } from '../services/reportGeneratorFactory.js';

class WorkerLogger {
  debug() {}
  info() {}
  warn() {}
  error() {}
}

class WorkerDataRegistry {
  #lookups;

  constructor(lookups = {}) {
    this.#lookups = lookups;
  }

  getLookupData(key) {
    return this.#lookups[key] || null;
  }

  get() {
    return null;
  }
}

class SensitivitySimulator {
  #logger;

  constructor({ logger }) {
    this.#logger = logger;
  }

  computeThresholdSensitivity(
    storedContexts,
    varPath,
    operator,
    originalThreshold,
    options = {}
  ) {
    const { steps = 9, stepSize = 0.05 } = options;

    if (!storedContexts || storedContexts.length === 0) {
      this.#logger.warn(
        'MonteCarloSimulator: No stored contexts for sensitivity analysis'
      );
      return {
        kind: 'marginalClausePassRateSweep',
        conditionPath: varPath,
        operator,
        originalThreshold,
        grid: [],
      };
    }

    const grid = [];
    const halfSteps = Math.floor(steps / 2);

    for (let i = -halfSteps; i <= halfSteps; i++) {
      const threshold = originalThreshold + i * stepSize;
      let passCount = 0;

      for (const context of storedContexts) {
        const actualValue = this.#getNestedValue(context, varPath);
        if (actualValue === undefined || actualValue === null) continue;

        const passes = this.#evaluateThresholdCondition(
          actualValue,
          operator,
          threshold
        );
        if (passes) passCount++;
      }

      const passRate = passCount / storedContexts.length;

      grid.push({
        threshold,
        passRate,
        passCount,
        sampleCount: storedContexts.length,
      });
    }

    return {
      kind: 'marginalClausePassRateSweep',
      conditionPath: varPath,
      operator,
      originalThreshold,
      grid,
    };
  }

  computeExpressionSensitivity(
    storedContexts,
    expressionLogic,
    varPath,
    operator,
    originalThreshold,
    options = {}
  ) {
    const { steps = 9, stepSize = 0.05 } = options;

    if (!storedContexts || storedContexts.length === 0) {
      this.#logger.warn(
        'MonteCarloSimulator: No stored contexts for expression sensitivity analysis'
      );
      return {
        kind: 'expressionTriggerRateSweep',
        varPath,
        operator,
        originalThreshold,
        grid: [],
        isExpressionLevel: true,
      };
    }

    if (!expressionLogic) {
      this.#logger.warn(
        'MonteCarloSimulator: No expression logic for expression sensitivity analysis'
      );
      return {
        kind: 'expressionTriggerRateSweep',
        varPath,
        operator,
        originalThreshold,
        grid: [],
        isExpressionLevel: true,
      };
    }

    const grid = [];
    const halfSteps = Math.floor(steps / 2);

    for (let i = -halfSteps; i <= halfSteps; i++) {
      const threshold = originalThreshold + i * stepSize;
      const modifiedLogic = this.#replaceThresholdInLogic(
        expressionLogic,
        varPath,
        operator,
        threshold
      );

      let triggerCount = 0;
      for (const context of storedContexts) {
        try {
          const result = jsonLogic.apply(modifiedLogic, context);
          if (result) triggerCount++;
        } catch {
          // Skip contexts that cause evaluation errors
        }
      }

      const triggerRate = triggerCount / storedContexts.length;

      grid.push({
        threshold,
        triggerRate,
        triggerCount,
        sampleCount: storedContexts.length,
      });
    }

    return {
      kind: 'expressionTriggerRateSweep',
      varPath,
      operator,
      originalThreshold,
      grid,
      isExpressionLevel: true,
    };
  }

  #getNestedValue(obj, path) {
    return path.split('.').reduce((o, k) => o?.[k], obj);
  }

  #replaceThresholdInLogic(logic, varPath, operator, newThreshold) {
    const clone =
      typeof globalThis.structuredClone === 'function'
        ? globalThis.structuredClone(logic)
        : JSON.parse(JSON.stringify(logic));
    this.#replaceThresholdRecursive(clone, varPath, operator, newThreshold);
    return clone;
  }

  #replaceThresholdRecursive(node, varPath, operator, newThreshold) {
    if (!node || typeof node !== 'object') return;

    if (node[operator] && Array.isArray(node[operator])) {
      const [left, right] = node[operator];

      if (left?.var === varPath && typeof right === 'number') {
        node[operator][1] = newThreshold;
        return;
      }

      if (right?.var === varPath && typeof left === 'number') {
        node[operator][0] = newThreshold;
        return;
      }
    }

    for (const key of Object.keys(node)) {
      const value = node[key];
      if (Array.isArray(value)) {
        for (const child of value) {
          if (child && typeof child === 'object') {
            this.#replaceThresholdRecursive(child, varPath, operator, newThreshold);
          }
        }
      } else if (value && typeof value === 'object') {
        this.#replaceThresholdRecursive(value, varPath, operator, newThreshold);
      }
    }
  }

  #evaluateThresholdCondition(actual, operator, threshold) {
    switch (operator) {
      case '>=':
        return actual >= threshold;
      case '>':
        return actual > threshold;
      case '<=':
        return actual <= threshold;
      case '<':
        return actual < threshold;
      default:
        return false;
    }
  }
}

function buildReport(payload) {
  const logger = new WorkerLogger();
  const dataRegistry = new WorkerDataRegistry(payload.lookups || {});
  const prototypeConstraintAnalyzer = new PrototypeConstraintAnalyzer({
    dataRegistry,
    logger,
  });
  const prototypeFitRankingService = new PrototypeFitRankingService({
    dataRegistry,
    logger,
    prototypeConstraintAnalyzer,
  });
  const reportGenerator = createReportGenerator({
    logger,
    prototypeConstraintAnalyzer,
    prototypeFitRankingService,
  });
  const sensitivityAnalyzer = new SensitivityAnalyzer({
    logger,
    monteCarloSimulator: new SensitivitySimulator({ logger }),
  });
  const reportOrchestrator = new ReportOrchestrator({
    logger,
    sensitivityAnalyzer,
    monteCarloReportGenerator: reportGenerator,
  });

  return reportOrchestrator.generateReport(payload);
}

self.addEventListener('message', (event) => {
  const { id, payload } = event.data || {};

  if (!payload || typeof id !== 'number') {
    self.postMessage({
      id,
      type: 'error',
      error: 'Missing payload for report generation',
    });
    return;
  }

  try {
    const report = buildReport(payload);
    self.postMessage({ id, type: 'report', report });
  } catch (err) {
    self.postMessage({
      id,
      type: 'error',
      error: err?.message || 'Report generation failed',
    });
  }
});
