/**
 * @file prototypeConstraintAnalyzer.axisConflicts.test.js
 * @description Axis conflict calculations for PrototypeConstraintAnalyzer.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import PrototypeConstraintAnalyzer from '../../../../src/expressionDiagnostics/services/PrototypeConstraintAnalyzer.js';

describe('PrototypeConstraintAnalyzer axis conflicts', () => {
  let analyzer;

  beforeEach(() => {
    const mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const mockDataRegistry = {
      get: jest.fn(),
      getLookupData: jest.fn((lookupKey) => {
        if (lookupKey === 'core:emotion_prototypes') {
          return {
            entries: {
              joy: { weights: { valence: 0.5 }, gates: [] },
              dread: { weights: { valence: -0.5 }, gates: [] },
            },
          };
        }
        return null;
      }),
    };

    analyzer = new PrototypeConstraintAnalyzer({
      dataRegistry: mockDataRegistry,
      logger: mockLogger,
    });
  });

  it('flags positive weights when constraint max narrows default bounds', () => {
    // Create constraints directly to test conflict detection logic
    // (extraction is tested separately in prototypeConstraintAnalyzer.test.js)
    const axisConstraints = new Map();
    axisConstraints.set('valence', {
      max: 0.6,
      sources: [{ varPath: 'moodAxes.valence', operator: '<=', threshold: 60 }],
    });

    const result = analyzer.analyzeEmotionThreshold(
      'joy',
      'emotion',
      0.4,
      axisConstraints
    );
    const valence = result.axisAnalysis.find((axis) => axis.axis === 'valence');

    expect(valence.conflictType).toBe('positive_weight_low_max');
    expect(valence.defaultMin).toBe(-1);
    expect(valence.defaultMax).toBe(1);
    expect(valence.lostRawSum).toBeCloseTo(0.2, 6);
    expect(valence.lostIntensity).toBeCloseTo(0.4, 6);
    expect(valence.sources).toEqual([
      { varPath: 'moodAxes.valence', operator: '<=', threshold: 60 },
    ]);
  });

  it('flags negative weights when constraint min narrows default bounds', () => {
    // Create constraints directly to test conflict detection logic
    // (extraction is tested separately in prototypeConstraintAnalyzer.test.js)
    const axisConstraints = new Map();
    axisConstraints.set('valence', {
      min: -0.2,
      sources: [{ varPath: 'moodAxes.valence', operator: '>=', threshold: -20 }],
    });

    const result = analyzer.analyzeEmotionThreshold(
      'dread',
      'emotion',
      0.4,
      axisConstraints
    );
    const valence = result.axisAnalysis.find((axis) => axis.axis === 'valence');

    expect(valence.conflictType).toBe('negative_weight_high_min');
    expect(valence.defaultMin).toBe(-1);
    expect(valence.defaultMax).toBe(1);
    expect(valence.lostRawSum).toBeCloseTo(0.4, 6);
    expect(valence.lostIntensity).toBeCloseTo(0.8, 6);
    expect(valence.sources).toEqual([
      { varPath: 'moodAxes.valence', operator: '>=', threshold: -20 },
    ]);
  });
});
