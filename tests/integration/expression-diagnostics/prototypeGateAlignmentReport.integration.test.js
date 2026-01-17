/**
 * @file Integration tests for Prototype Gate Alignment report section.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import PrototypeGateAlignmentAnalyzer from '../../../src/expressionDiagnostics/services/PrototypeGateAlignmentAnalyzer.js';
import MonteCarloReportGenerator from '../../../src/expressionDiagnostics/services/MonteCarloReportGenerator.js';

const EMOTION_LOOKUP_PATH = path.join(
  process.cwd(),
  'data',
  'mods',
  'core',
  'lookups',
  'emotion_prototypes.lookup.json'
);

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const loadJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const createDataRegistry = (logger) => {
  const registry = new InMemoryDataRegistry({ logger });
  const lookup = loadJson(EMOTION_LOOKUP_PATH);
  registry.store('lookups', lookup.id, lookup);
  return registry;
};

const createSimulationResult = (overrides = {}) => ({
  triggerRate: 0.1,
  triggerCount: 100,
  sampleCount: 1000,
  confidenceInterval: { low: 0.09, high: 0.11 },
  distribution: 'uniform',
  clauseFailures: [],
  storedContexts: [],
  ...overrides,
});

const createReportGenerator = (logger) => {
  const dataRegistry = createDataRegistry(logger);
  const analyzer = new PrototypeGateAlignmentAnalyzer({
    dataRegistry,
    logger,
  });

  return new MonteCarloReportGenerator({
    logger,
    prototypeGateAlignmentAnalyzer: analyzer,
  });
};

describe('Prototype Gate Alignment report integration', () => {
  let logger;
  let reportGenerator;

  beforeEach(() => {
    logger = createLogger();
    reportGenerator = createReportGenerator(logger);
  });

  it('includes the Prototype Gate Alignment section when contradictions exist', () => {
    const prerequisites = [
      {
        logic: {
          and: [
            { '>=': [{ var: 'moodAxes.agency_control' }, 0.3] },
            { '>=': [{ var: 'emotions.quiet_absorption' }, 0.55] },
          ],
        },
      },
    ];

    const report = reportGenerator.generate({
      expressionName: 'test:quiet-absorption-contradiction',
      simulationResult: createSimulationResult(),
      blockers: [],
      summary: 'Test summary',
      prerequisites,
    });

    expect(report).toContain('## Prototype Gate Alignment');
    expect(report).toContain('quiet_absorption');
    expect(report).toContain('agency_control <= 0.25');
    expect(report).toContain('**CONTRADICTION**');
    expect(report).toContain('0.050');
  });

  it('omits the Prototype Gate Alignment section when no contradictions exist', () => {
    const prerequisites = [
      {
        logic: {
          and: [
            { '<=': [{ var: 'moodAxes.agency_control' }, 0.2] },
            { '>=': [{ var: 'emotions.quiet_absorption' }, 0.55] },
          ],
        },
      },
    ];

    const report = reportGenerator.generate({
      expressionName: 'test:quiet-absorption-compatible',
      simulationResult: createSimulationResult(),
      blockers: [],
      summary: 'Test summary',
      prerequisites,
    });

    expect(report).not.toContain('## Prototype Gate Alignment');
  });

  it('includes recommendation text for contradictions', () => {
    const prerequisites = [
      {
        logic: {
          and: [
            { '>=': [{ var: 'moodAxes.agency_control' }, 0.3] },
            { '>=': [{ var: 'emotions.quiet_absorption' }, 0.55] },
          ],
        },
      },
    ];

    const report = reportGenerator.generate({
      expressionName: 'test:quiet-absorption-recommendation',
      simulationResult: createSimulationResult(),
      blockers: [],
      summary: 'Test summary',
      prerequisites,
    });

    expect(report).toContain('Unreachable emotion under regime');
    expect(report).toContain('Relax regime on `agency_control`');
  });
});
