/**
 * @file Unit tests for mood constraint unit display in MonteCarloReportGenerator.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import MonteCarloReportGenerator from '../../../../src/expressionDiagnostics/services/MonteCarloReportGenerator.js';

const createMockSimulationResult = (overrides = {}) => ({
  triggerRate: 0.1,
  triggerCount: 10,
  sampleCount: 100,
  confidenceInterval: { low: 0.05, high: 0.15 },
  distribution: 'uniform',
  clauseFailures: [],
  storedContexts: [],
  ...overrides,
});

describe('MonteCarloReportGenerator mood constraint units', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
  });

  it('prints raw and normalized units for mood constraints', () => {
    const generator = new MonteCarloReportGenerator({ logger: mockLogger });

    const storedContexts = Array.from({ length: 12 }, () => ({
      moodAxes: { arousal: 25, threat: 10 },
      emotions: { joy: 0.6 },
    }));

    const prerequisites = [
      {
        logic: {
          and: [
            { '>=': [{ var: 'moodAxes.arousal' }, 20] },
            { '<=': [{ var: 'moodAxes.threat' }, 30] },
            { '>=': [{ var: 'emotions.joy' }, 0.5] },
          ],
        },
      },
    ];

    const report = generator.generate({
      expressionName: 'test:expression',
      simulationResult: createMockSimulationResult({ storedContexts }),
      blockers: [],
      summary: 'Test summary',
      prerequisites,
    });

    expect(report).toContain(
      '`moodAxes.arousal >= 20 (normalized >= 0.20)`'
    );
    expect(report).toContain('`moodAxes.threat <= 30 (normalized <= 0.30)`');
  });
});
