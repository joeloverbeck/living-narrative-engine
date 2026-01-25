/**
 * @file Integration test for scalar sensitivity parity in expression diagnostics.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import MonteCarloSimulator from '../../../src/expressionDiagnostics/services/MonteCarloSimulator.js';
import FailureExplainer from '../../../src/expressionDiagnostics/services/FailureExplainer.js';
import SensitivityAnalyzer from '../../../src/expressionDiagnostics/services/SensitivityAnalyzer.js';
import ReportOrchestrator from '../../../src/expressionDiagnostics/services/ReportOrchestrator.js';
import MonteCarloReportGenerator from '../../../src/expressionDiagnostics/services/MonteCarloReportGenerator.js';
import EmotionCalculatorAdapter from '../../../src/expressionDiagnostics/adapters/EmotionCalculatorAdapter.js';
import EmotionCalculatorService from '../../../src/emotions/emotionCalculatorService.js';
import { MOOD_AXES } from '../../../src/expressionDiagnostics/services/RandomStateGenerator.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const buildEmotionCalculatorAdapter = (dataRegistry, logger) =>
  new EmotionCalculatorAdapter({
    emotionCalculatorService: new EmotionCalculatorService({
      dataRegistry,
      logger,
    }),
    logger,
  });

const createDeterministicGenerator = () => {
  let index = 0;
  const mood = Object.fromEntries(MOOD_AXES.map((axis) => [axis, 0]));
  const affectTraits = {
    affective_empathy: 50,
    cognitive_empathy: 50,
    harm_aversion: 50,
  };
  const sexualSamples = [
    { sex_excitation: 34, sex_inhibition: 0, baseline_libido: 0 },
    { sex_excitation: 36, sex_inhibition: 0, baseline_libido: 0 },
  ];

  return {
    generate() {
      const sexual = sexualSamples[index % sexualSamples.length];
      index += 1;

      return {
        current: { mood: { ...mood }, sexual: { ...sexual } },
        previous: { mood: { ...mood }, sexual: { ...sexual } },
        affectTraits: { ...affectTraits },
      };
    },
  };
};

const mockEmotionPrototypes = {
  entries: {
    joy: { weights: { valence: 1.0 }, gates: [] },
  },
};

const mockSexualPrototypes = {
  entries: {},
};

describe('Sensitivity scalar parity integration', () => {
  let logger;
  let dataRegistry;
  let monteCarloSimulator;
  let failureExplainer;
  let sensitivityAnalyzer;
  let reportOrchestrator;

  beforeEach(() => {
    logger = createLogger();
    dataRegistry = {
      get: jest.fn((category, lookupId) => {
        if (category !== 'lookups') {
          return null;
        }
        if (lookupId === 'core:emotion_prototypes') {
          return mockEmotionPrototypes;
        }
        if (lookupId === 'core:sexual_prototypes') {
          return mockSexualPrototypes;
        }
        return null;
      }),
      getLookupData: jest.fn((lookupId) => {
        if (lookupId === 'core:emotion_prototypes') {
          return mockEmotionPrototypes;
        }
        if (lookupId === 'core:sexual_prototypes') {
          return mockSexualPrototypes;
        }
        return null;
      }),
    };

    const randomStateGenerator = createDeterministicGenerator();
    const emotionCalculatorAdapter = buildEmotionCalculatorAdapter(
      dataRegistry,
      logger
    );

    monteCarloSimulator = new MonteCarloSimulator({
      logger,
      dataRegistry,
      emotionCalculatorAdapter,
      randomStateGenerator,
    });

    failureExplainer = new FailureExplainer({ logger, dataRegistry });
    sensitivityAnalyzer = new SensitivityAnalyzer({
      logger,
      monteCarloSimulator,
    });
    reportOrchestrator = new ReportOrchestrator({
      logger,
      sensitivityAnalyzer,
      monteCarloReportGenerator: new MonteCarloReportGenerator({ logger }),
      dataRegistry,
    });
  });

  it('includes sexualArousal in Top Blockers and global sensitivity output', async () => {
    const expression = {
      id: 'test:scalar_parity',
      prerequisites: [
        {
          logic: {
            and: [
              { '>=': [{ var: 'sexualArousal' }, 0.35] },
              { '>=': [{ var: 'moodAxes.valence' }, -20] },
            ],
          },
        },
      ],
    };

    const simulationResult = await monteCarloSimulator.simulate(expression, {
      sampleCount: 40,
      distribution: 'uniform',
      storeSamplesForSensitivity: true,
    });
    const blockers = failureExplainer.analyzeHierarchicalBlockers(
      simulationResult.clauseFailures
    );

    const report = reportOrchestrator.generateReport({
      expressionName: 'Scalar Parity Test',
      summary: '',
      simulationResult,
      blockers,
      prerequisites: expression.prerequisites,
    });

    expect(report).toContain('Most Tunable Condition');
    expect(report).toContain('sexualArousal >= 0.35');
    expect(report).toContain('Global Expression Sensitivity Analysis');
    expect(report).toContain(
      'Global Expression Sensitivity: sexualArousal >= [threshold]'
    );
  });
});
