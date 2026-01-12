/**
 * @file Unit tests for SensitivityAnalyzer.
 */

import { describe, expect, it, jest } from '@jest/globals';
import SensitivityAnalyzer from '../../../../src/expressionDiagnostics/services/SensitivityAnalyzer.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('SensitivityAnalyzer', () => {
  it('computes sensitivity data for tunable conditions', () => {
    const logger = createLogger();
    const monteCarloSimulator = {
      computeThresholdSensitivity: jest
        .fn()
        .mockReturnValueOnce({ varPath: 'emotions.joy' })
        .mockReturnValueOnce({ varPath: 'sexual.arousal' })
        .mockReturnValueOnce({ varPath: 'sexualArousal' })
        .mockReturnValueOnce({ varPath: 'moodAxes.valence' }),
      computeExpressionSensitivity: jest.fn(),
    };
    const analyzer = new SensitivityAnalyzer({ logger, monteCarloSimulator });

    const storedContexts = [
      {
        emotions: { joy: 0.3 },
        sexual: { arousal: 0.4 },
        sexualArousal: 0.4,
        moodAxes: { valence: 10 },
      },
    ];
    const blockers = [
      {
        hierarchicalBreakdown: {
          isCompound: true,
          children: [
            {
              isCompound: false,
              variablePath: 'emotions.joy',
              thresholdValue: 0.5,
              comparisonOperator: '>=',
            },
            {
              isCompound: false,
              variablePath: 'emotions.joy',
              thresholdValue: 0.5,
              comparisonOperator: '>=',
            },
            {
              isCompound: false,
              variablePath: 'sexual.arousal',
              thresholdValue: 0.2,
              comparisonOperator: '>',
            },
            {
              isCompound: false,
              variablePath: 'sexualArousal',
              thresholdValue: 0.35,
              comparisonOperator: '>=',
            },
            {
              isCompound: false,
              variablePath: 'moodAxes.valence',
              thresholdValue: 10,
              comparisonOperator: '>=',
            },
            {
              isCompound: false,
              variablePath: 'unknown.energy',
              thresholdValue: 0.2,
              comparisonOperator: '>=',
            },
          ],
        },
      },
    ];

    const results = analyzer.computeSensitivityData(storedContexts, blockers);

    expect(monteCarloSimulator.computeThresholdSensitivity).toHaveBeenCalledTimes(4);
    expect(monteCarloSimulator.computeThresholdSensitivity).toHaveBeenNthCalledWith(
      1,
      storedContexts,
      'emotions.joy',
      '>=',
      0.5
    );
    expect(monteCarloSimulator.computeThresholdSensitivity).toHaveBeenNthCalledWith(
      2,
      storedContexts,
      'sexual.arousal',
      '>',
      0.2
    );
    expect(monteCarloSimulator.computeThresholdSensitivity).toHaveBeenNthCalledWith(
      3,
      storedContexts,
      'sexualArousal',
      '>=',
      0.35
    );
    expect(monteCarloSimulator.computeThresholdSensitivity).toHaveBeenNthCalledWith(
      4,
      storedContexts,
      'moodAxes.valence',
      '>=',
      10
    );
    expect(results).toEqual([
      { varPath: 'emotions.joy' },
      { varPath: 'sexual.arousal' },
      { varPath: 'sexualArousal' },
      { varPath: 'moodAxes.valence' },
    ]);
  });

  it('returns an empty array when stored contexts are missing', () => {
    const logger = createLogger();
    const monteCarloSimulator = {
      computeThresholdSensitivity: jest.fn(),
      computeExpressionSensitivity: jest.fn(),
    };
    const analyzer = new SensitivityAnalyzer({ logger, monteCarloSimulator });

    const results = analyzer.computeSensitivityData([], []);

    expect(results).toEqual([]);
    expect(monteCarloSimulator.computeThresholdSensitivity).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      'No stored contexts available for sensitivity analysis'
    );
  });

  it('returns an empty array when blockers are missing', () => {
    const logger = createLogger();
    const monteCarloSimulator = {
      computeThresholdSensitivity: jest.fn(),
      computeExpressionSensitivity: jest.fn(),
    };
    const analyzer = new SensitivityAnalyzer({ logger, monteCarloSimulator });

    const results = analyzer.computeSensitivityData([{ emotions: { joy: 0.4 } }], null);

    expect(results).toEqual([]);
    expect(monteCarloSimulator.computeThresholdSensitivity).not.toHaveBeenCalled();
  });

  it('traverses nested compound blockers for sensitivity', () => {
    const logger = createLogger();
    const monteCarloSimulator = {
      computeThresholdSensitivity: jest
        .fn()
        .mockReturnValueOnce({ varPath: 'emotions.joy' })
        .mockReturnValueOnce({ varPath: 'sexual.arousal' }),
      computeExpressionSensitivity: jest.fn(),
    };
    const analyzer = new SensitivityAnalyzer({ logger, monteCarloSimulator });

    const storedContexts = [{ emotions: { joy: 0.7 }, sexual: { arousal: 0.2 } }];
    const blockers = [
      {
        hierarchicalBreakdown: {
          isCompound: true,
          children: [
            {
              isCompound: false,
              variablePath: 'emotions.joy',
              thresholdValue: 0.4,
              comparisonOperator: '>=',
            },
            {
              isCompound: true,
              children: [
                {
                  isCompound: false,
                  variablePath: 'sexual.arousal',
                  thresholdValue: 0.1,
                  comparisonOperator: '>',
                },
              ],
            },
          ],
        },
      },
    ];

    const results = analyzer.computeSensitivityData(storedContexts, blockers);

    expect(monteCarloSimulator.computeThresholdSensitivity).toHaveBeenCalledTimes(2);
    expect(results).toEqual([
      { varPath: 'emotions.joy' },
      { varPath: 'sexual.arousal' },
    ]);
  });

  it('logs a warning when threshold sensitivity fails', () => {
    const logger = createLogger();
    const monteCarloSimulator = {
      computeThresholdSensitivity: jest.fn(() => {
        throw new Error('boom');
      }),
      computeExpressionSensitivity: jest.fn(),
    };
    const analyzer = new SensitivityAnalyzer({ logger, monteCarloSimulator });

    const storedContexts = [{ emotions: { joy: 0.3 } }];
    const blockers = [
      {
        hierarchicalBreakdown: {
          isCompound: false,
          variablePath: 'emotions.joy',
          thresholdValue: 0.5,
          comparisonOperator: '>=',
        },
      },
    ];

    const results = analyzer.computeSensitivityData(storedContexts, blockers);

    expect(results).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to compute sensitivity for emotions.joy: boom'
    );
  });

  it('computes global sensitivity data for the top scoring candidates', () => {
    const logger = createLogger();
    const monteCarloSimulator = {
      computeThresholdSensitivity: jest.fn(),
      computeExpressionSensitivity: jest
        .fn()
        .mockReturnValue({ grid: [], isExpressionLevel: true }),
    };
    const analyzer = new SensitivityAnalyzer({ logger, monteCarloSimulator });

    const storedContexts = [{ emotions: { anger: 0.2 }, sexual: { arousal: 0.5 } }];
    const blockers = [
      {
        hierarchicalBreakdown: {
          isCompound: true,
          children: [
            {
              isCompound: false,
              variablePath: 'emotions.anger',
              thresholdValue: 0.6,
              comparisonOperator: '>=',
              nearMissRate: 0.1,
              failureRate: 0.4,
              lastMileFailRate: 0.7,
            },
            {
              isCompound: false,
              variablePath: 'emotions.joy',
              thresholdValue: 0.3,
              comparisonOperator: '>=',
              nearMissRate: 0.8,
              failureRate: 0.2,
              lastMileFailRate: 0.1,
            },
            {
              isCompound: false,
              variablePath: 'sexual.arousal',
              thresholdValue: 0.5,
              comparisonOperator: '>=',
              nearMissRate: 0.4,
              failureRate: 0.5,
              lastMileFailRate: 0.6,
            },
            {
              isCompound: false,
              variablePath: 'emotions.sadness',
              thresholdValue: 0.2,
              comparisonOperator: '>=',
              nearMissRate: 0.2,
              failureRate: 0.1,
              lastMileFailRate: 0.1,
            },
            {
              isCompound: false,
              variablePath: 'emotions.anger',
              thresholdValue: 0.6,
              comparisonOperator: '>=',
              nearMissRate: 0.1,
              failureRate: 0.4,
              lastMileFailRate: 0.7,
            },
          ],
        },
      },
    ];
    const prerequisites = [{ logic: { type: 'and' } }];

    const results = analyzer.computeGlobalSensitivityData(
      storedContexts,
      blockers,
      prerequisites
    );

    expect(monteCarloSimulator.computeExpressionSensitivity).toHaveBeenCalledTimes(3);
    expect(monteCarloSimulator.computeExpressionSensitivity).toHaveBeenNthCalledWith(
      1,
      storedContexts,
      prerequisites[0].logic,
      'sexual.arousal',
      '>=',
      0.5,
      { steps: 9, stepSize: 0.05 }
    );
    expect(monteCarloSimulator.computeExpressionSensitivity).toHaveBeenNthCalledWith(
      2,
      storedContexts,
      prerequisites[0].logic,
      'emotions.anger',
      '>=',
      0.6,
      { steps: 9, stepSize: 0.05 }
    );
    expect(monteCarloSimulator.computeExpressionSensitivity).toHaveBeenNthCalledWith(
      3,
      storedContexts,
      prerequisites[0].logic,
      'emotions.joy',
      '>=',
      0.3,
      { steps: 9, stepSize: 0.05 }
    );
    expect(results).toHaveLength(3);
  });

  it('includes scalar and moodAxes paths in global sensitivity candidates', () => {
    const logger = createLogger();
    const monteCarloSimulator = {
      computeThresholdSensitivity: jest.fn(),
      computeExpressionSensitivity: jest
        .fn()
        .mockReturnValue({ grid: [], isExpressionLevel: true }),
    };
    const analyzer = new SensitivityAnalyzer({ logger, monteCarloSimulator });

    const storedContexts = [{ moodAxes: { valence: 5 }, sexualArousal: 0.4 }];
    const blockers = [
      {
        hierarchicalBreakdown: {
          isCompound: true,
          children: [
            {
              isCompound: false,
              variablePath: 'sexualArousal',
              thresholdValue: 0.35,
              comparisonOperator: '>=',
              nearMissRate: 0.2,
              failureRate: 0.3,
              lastMileFailRate: 0.8,
            },
            {
              isCompound: false,
              variablePath: 'moodAxes.valence',
              thresholdValue: 10,
              comparisonOperator: '>=',
              nearMissRate: 0.1,
              failureRate: 0.1,
              lastMileFailRate: 0.1,
            },
          ],
        },
      },
    ];
    const prerequisites = [{ logic: { type: 'and' } }];

    const results = analyzer.computeGlobalSensitivityData(
      storedContexts,
      blockers,
      prerequisites
    );

    expect(monteCarloSimulator.computeExpressionSensitivity).toHaveBeenCalledTimes(2);
    expect(monteCarloSimulator.computeExpressionSensitivity).toHaveBeenNthCalledWith(
      1,
      storedContexts,
      prerequisites[0].logic,
      'sexualArousal',
      '>=',
      0.35,
      { steps: 9, stepSize: 0.05 }
    );
    expect(monteCarloSimulator.computeExpressionSensitivity).toHaveBeenNthCalledWith(
      2,
      storedContexts,
      prerequisites[0].logic,
      'moodAxes.valence',
      '>=',
      10,
      { steps: 9, stepSize: 0.05 }
    );
    expect(results).toHaveLength(2);
  });

  it('includes previousSexualArousal in global sensitivity candidates', () => {
    const logger = createLogger();
    const monteCarloSimulator = {
      computeThresholdSensitivity: jest.fn(),
      computeExpressionSensitivity: jest
        .fn()
        .mockReturnValue({ grid: [], isExpressionLevel: true }),
    };
    const analyzer = new SensitivityAnalyzer({ logger, monteCarloSimulator });

    const storedContexts = [{ previousSexualArousal: 0.2 }];
    const blockers = [
      {
        hierarchicalBreakdown: {
          isCompound: false,
          variablePath: 'previousSexualArousal',
          thresholdValue: 0.15,
          comparisonOperator: '>=',
          nearMissRate: 0.2,
          failureRate: 0.3,
          lastMileFailRate: 0.8,
        },
      },
    ];
    const prerequisites = [{ logic: { type: 'and' } }];

    const results = analyzer.computeGlobalSensitivityData(
      storedContexts,
      blockers,
      prerequisites
    );

    expect(monteCarloSimulator.computeExpressionSensitivity).toHaveBeenCalledTimes(1);
    expect(monteCarloSimulator.computeExpressionSensitivity).toHaveBeenCalledWith(
      storedContexts,
      prerequisites[0].logic,
      'previousSexualArousal',
      '>=',
      0.15,
      { steps: 9, stepSize: 0.05 }
    );
    expect(results).toHaveLength(1);
  });

  it('returns an empty array when prerequisites are missing', () => {
    const logger = createLogger();
    const monteCarloSimulator = {
      computeThresholdSensitivity: jest.fn(),
      computeExpressionSensitivity: jest.fn(),
    };
    const analyzer = new SensitivityAnalyzer({ logger, monteCarloSimulator });

    const results = analyzer.computeGlobalSensitivityData(
      [{ emotions: { joy: 0.1 } }],
      [],
      null
    );

    expect(results).toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith(
      'No prerequisites available for global sensitivity'
    );
  });

  it('returns an empty array when prerequisites have no logic', () => {
    const logger = createLogger();
    const monteCarloSimulator = {
      computeThresholdSensitivity: jest.fn(),
      computeExpressionSensitivity: jest.fn(),
    };
    const analyzer = new SensitivityAnalyzer({ logger, monteCarloSimulator });

    const results = analyzer.computeGlobalSensitivityData(
      [{ emotions: { joy: 0.1 } }],
      [],
      [{}]
    );

    expect(results).toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith('No logic found in prerequisites');
  });

  it('logs a warning when global sensitivity fails', () => {
    const logger = createLogger();
    const monteCarloSimulator = {
      computeThresholdSensitivity: jest.fn(),
      computeExpressionSensitivity: jest.fn(() => {
        throw new Error('failed');
      }),
    };
    const analyzer = new SensitivityAnalyzer({ logger, monteCarloSimulator });

    const storedContexts = [{ emotions: { joy: 0.4 } }];
    const blockers = [
      {
        hierarchicalBreakdown: {
          isCompound: false,
          variablePath: 'emotions.joy',
          thresholdValue: 0.2,
          comparisonOperator: '>=',
          nearMissRate: 0.1,
          failureRate: 0.2,
          lastMileFailRate: 0.3,
        },
      },
    ];
    const prerequisites = [{ logic: { type: 'and' } }];

    const results = analyzer.computeGlobalSensitivityData(
      storedContexts,
      blockers,
      prerequisites
    );

    expect(results).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to compute global sensitivity for emotions.joy: failed'
    );
  });

  it('validates constructor dependencies', () => {
    const logger = createLogger();
    expect(() => {
      new SensitivityAnalyzer({
        logger,
        monteCarloSimulator: { computeThresholdSensitivity: jest.fn() },
      });
    }).toThrow();
  });
});
