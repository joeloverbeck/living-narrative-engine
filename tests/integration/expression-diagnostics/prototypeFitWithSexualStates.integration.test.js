/**
 * @file Integration tests for prototype fit analysis with sexual state references
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import PrototypeConstraintAnalyzer from '../../../src/expressionDiagnostics/services/PrototypeConstraintAnalyzer.js';
import PrototypeFitRankingService from '../../../src/expressionDiagnostics/services/PrototypeFitRankingService.js';
import MonteCarloReportGenerator from '../../../src/expressionDiagnostics/services/MonteCarloReportGenerator.js';

const SEXUAL_ONLY_FIXTURE = path.join(
  process.cwd(),
  'tests',
  'fixtures',
  'expressionDiagnostics',
  'sexualStatesOnly.expression.json'
);

function createLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

function createDataRegistry(logger) {
  const registry = new InMemoryDataRegistry({ logger });

  registry.store('lookups', 'core:emotion_prototypes', {
    id: 'core:emotion_prototypes',
    entries: {
      joy: {
        weights: { valence: 0.8, arousal: 0.3, engagement: 0.2 },
        gates: ['valence >= 0.2'],
      },
      calm: {
        weights: { valence: 0.4, arousal: -0.4, engagement: 0.1 },
        gates: ['arousal <= 0.4'],
      },
    },
  });

  registry.store('lookups', 'core:sexual_prototypes', {
    id: 'core:sexual_prototypes',
    entries: {
      sexual_lust: {
        weights: { sexual_arousal: 1.0, valence: 0.2, arousal: 0.3 },
        gates: ['sexual_arousal >= 0.3'],
      },
      passion: {
        weights: { sexual_arousal: 0.7, engagement: 0.6, valence: 0.4 },
        gates: ['sexual_arousal >= 0.3', 'engagement >= 0.2'],
      },
    },
  });

  return registry;
}

function createStoredContexts() {
  return [
    {
      moodAxes: { valence: 0.6, arousal: 0.4, threat: 0.1, engagement: 0.5 },
      sexualStates: { sexual_arousal: 0.6 },
    },
    {
      moodAxes: { valence: 0.4, arousal: 0.2, threat: 0.2, engagement: 0.3 },
      sexualStates: { sexual_arousal: 0.4 },
    },
    {
      moodAxes: { valence: 0.2, arousal: 0.5, threat: 0.4, engagement: 0.7 },
      sexualStates: { sexual_arousal: 0.7 },
    },
  ];
}

function createMixedPrerequisites() {
  return [
    {
      logic: {
        and: [
          { '>=': [{ var: 'sexualStates.sexual_lust' }, 0.4] },
          { '>=': [{ var: 'sexualStates.passion' }, 0.3] },
          { '>=': [{ var: 'emotions.joy' }, 0.2] },
          { '>=': [{ var: 'moodAxes.valence' }, 0.1] },
          { '<=': [{ var: 'moodAxes.threat' }, 0.5] },
        ],
      },
    },
  ];
}

function createSimulationResult(storedContexts) {
  return {
    triggerRate: 0.2,
    triggerCount: 2000,
    sampleCount: 10000,
    confidenceInterval: { low: 0.18, high: 0.22 },
    distribution: 'uniform',
    clauseFailures: [],
    storedContexts,
  };
}

function loadSexualOnlyExpression() {
  return JSON.parse(fs.readFileSync(SEXUAL_ONLY_FIXTURE, 'utf8'));
}

describe('Prototype Fit with Sexual States - Integration', () => {
  let logger;
  let prototypeFitRankingService;
  let reportGenerator;

  beforeEach(() => {
    logger = createLogger();
    const dataRegistry = createDataRegistry(logger);
    const prototypeConstraintAnalyzer = new PrototypeConstraintAnalyzer({
      dataRegistry,
      logger,
    });

    prototypeFitRankingService = new PrototypeFitRankingService({
      dataRegistry,
      logger,
      prototypeConstraintAnalyzer,
    });

    reportGenerator = new MonteCarloReportGenerator({
      logger,
      prototypeConstraintAnalyzer,
      prototypeFitRankingService,
    });
  });

  it('includes sexual prototypes in fit, implied, gap, and report sections for mixed prerequisites', () => {
    const storedContexts = createStoredContexts();
    const prerequisites = createMixedPrerequisites();

    const fitResults = prototypeFitRankingService.analyzeAllPrototypeFit(
      prerequisites,
      storedContexts
    );
    const impliedPrototype = prototypeFitRankingService.computeImpliedPrototype(
      prerequisites,
      storedContexts
    );
    const gapDetection = prototypeFitRankingService.detectPrototypeGaps(
      prerequisites,
      storedContexts
    );

    expect(fitResults.leaderboard.some((result) => result.type === 'sexual')).toBe(true);
    expect(fitResults.leaderboard.some((result) => result.type === 'emotion')).toBe(true);
    expect(impliedPrototype.bySimilarity.length).toBeGreaterThan(0);
    expect(gapDetection.kNearestNeighbors.length).toBeGreaterThan(0);
    expect(impliedPrototype.bySimilarity.some((result) => result.type === 'sexual')).toBe(true);
    expect(gapDetection.kNearestNeighbors.some((result) => result.type === 'sexual')).toBe(true);

    const report = reportGenerator.generate({
      expressionName: 'test:mixed_prereqs',
      simulationResult: createSimulationResult(storedContexts),
      blockers: [],
      summary: 'Integration test summary',
      prerequisites,
    });

    expect(report).toContain('Prototype Fit Analysis');
    expect(report).toContain('sexual_lust');
  });

  it('limits results to sexual prototypes when prerequisites only reference sexual states', () => {
    const storedContexts = createStoredContexts();
    const expression = loadSexualOnlyExpression();
    const prerequisites = expression.prerequisites;

    const fitResults = prototypeFitRankingService.analyzeAllPrototypeFit(
      prerequisites,
      storedContexts
    );
    const impliedPrototype = prototypeFitRankingService.computeImpliedPrototype(
      prerequisites,
      storedContexts
    );
    const gapDetection = prototypeFitRankingService.detectPrototypeGaps(
      prerequisites,
      storedContexts
    );

    expect(fitResults.leaderboard.length).toBeGreaterThan(0);
    expect(fitResults.leaderboard.every((result) => result.type === 'sexual')).toBe(true);
    expect(impliedPrototype.bySimilarity.length).toBeGreaterThan(0);
    expect(gapDetection.kNearestNeighbors.length).toBeGreaterThan(0);
    expect(impliedPrototype.bySimilarity.every((result) => result.type === 'sexual')).toBe(true);
    expect(gapDetection.kNearestNeighbors.every((result) => result.type === 'sexual')).toBe(true);
  });
});
