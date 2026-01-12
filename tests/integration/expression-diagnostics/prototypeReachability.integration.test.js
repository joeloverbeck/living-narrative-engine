/**
 * @file Integration test for prototype reachability semantics.
 * @see archive/specs/prototype-math-reachability-operator-fix.md
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import PrototypeConstraintAnalyzer from '../../../src/expressionDiagnostics/services/PrototypeConstraintAnalyzer.js';
import MonteCarloReportGenerator from '../../../src/expressionDiagnostics/services/MonteCarloReportGenerator.js';

const EMOTION_LOOKUP_PATH = path.join(
  process.cwd(),
  'data',
  'mods',
  'core',
  'lookups',
  'emotion_prototypes.lookup.json'
);

const HURT_ANGER_EXPRESSION_PATH = path.join(
  process.cwd(),
  'data',
  'mods',
  'emotions-anger',
  'expressions',
  'hurt_anger.expression.json'
);

function createLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function createDataRegistry(logger) {
  const registry = new InMemoryDataRegistry({ logger });
  const lookup = loadJson(EMOTION_LOOKUP_PATH);

  registry.store('lookups', lookup.id, lookup);
  return registry;
}

function createSimulationResult() {
  return {
    triggerRate: 0.1,
    triggerCount: 100,
    sampleCount: 1000,
    confidenceInterval: { low: 0.09, high: 0.11 },
    distribution: 'uniform',
    clauseFailures: [],
    storedContexts: [],
  };
}

function createDissociationBlocker() {
  return {
    clauseDescription: 'emotions.dissociation <= 0.65',
    failureRate: 0.2,
    averageViolation: 0.05,
    rank: 1,
    severity: 'medium',
    hierarchicalBreakdown: {
      variablePath: 'emotions.dissociation',
      comparisonOperator: '<=',
      thresholdValue: 0.65,
      isSingleClause: true,
    },
  };
}

describe('Prototype Reachability - Integration', () => {
  let logger;
  let reportGenerator;

  beforeEach(() => {
    logger = createLogger();
    const dataRegistry = createDataRegistry(logger);
    const prototypeConstraintAnalyzer = new PrototypeConstraintAnalyzer({
      dataRegistry,
      logger,
    });

    reportGenerator = new MonteCarloReportGenerator({
      logger,
      prototypeConstraintAnalyzer,
    });
  });

  it('marks dissociation <= 0.65 as ALWAYS and explains always satisfied', () => {
    const expression = loadJson(HURT_ANGER_EXPRESSION_PATH);

    const report = reportGenerator.generate({
      expressionName: expression.id,
      simulationResult: createSimulationResult(),
      blockers: [createDissociationBlocker()],
      summary: 'Integration test summary',
      prerequisites: expression.prerequisites,
    });

    expect(report).toContain('dissociation <= 0.65 ✅ ALWAYS');
    expect(report).toContain('always satisfied');
  });
});
