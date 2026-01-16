/**
 * @file Unit tests for context axis normalization and filtering via PrototypeFitRankingService.
 */
import { describe, expect, it, jest } from '@jest/globals';
import PrototypeFitRankingService from '../../../../src/expressionDiagnostics/services/PrototypeFitRankingService.js';

const buildService = ({ prototypes = [], constraintAnalyzer = null } = {}) => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const mockDataRegistry = {
    get: jest.fn(),
    getLookupData: jest.fn(),
  };

  const mockPrototypeRegistryService = {
    getPrototypesByType: jest.fn(() => prototypes),
    getAllPrototypes: jest.fn(() => prototypes),
    getPrototypeDefinitions: jest.fn(),
    getPrototype: jest.fn(),
  };

  const mockPrototypeTypeDetector = {
    detectReferencedTypes: jest.fn(() => ({ hasEmotions: true, hasSexualStates: false })),
    extractCurrentPrototype: jest.fn(),
  };

  const service = new PrototypeFitRankingService({
    dataRegistry: mockDataRegistry,
    logger: mockLogger,
    prototypeConstraintAnalyzer: constraintAnalyzer,
    prototypeRegistryService: mockPrototypeRegistryService,
    prototypeTypeDetector: mockPrototypeTypeDetector,
  });

  return {
    service,
    mockLogger,
    mockPrototypeRegistryService,
    mockPrototypeTypeDetector,
  };
};

describe('Context axis normalization (PrototypeFitRankingService)', () => {
  it('filters contexts using normalized mood axes across mood and moodAxes', () => {
    const prototypes = [
      {
        id: 'proto-valence',
        type: 'emotion',
        weights: { valence: 1 },
        gates: ['valence >= 0.7'],
      },
    ];

    const { service } = buildService({ prototypes });
    const axisConstraints = new Map([['valence', { min: 0.5, max: 1 }]]);
    const contexts = [
      { mood: { valence: 80 } },
      { moodAxes: { valence: 40 } },
    ];

    const result = service.computeImpliedPrototype(axisConstraints, contexts);

    expect(result.byGatePass).toHaveLength(1);
    expect(result.byGatePass[0].gatePassRate).toBeCloseTo(1, 6);
  });

  it('filters contexts using normalized sexual_arousal from sexual data', () => {
    const prototypes = [
      {
        id: 'proto-sexual',
        type: 'emotion',
        weights: { sexual_arousal: 1 },
        gates: ['sexual_arousal >= 0.7'],
      },
    ];

    const { service } = buildService({ prototypes });
    const axisConstraints = new Map([['sexual_arousal', { min: 0.7, max: 1 }]]);
    const contexts = [
      {
        sexual: {
          sex_excitation: 80,
          sex_inhibition: 20,
          baseline_libido: 10,
        },
      },
      {
        sexual: {
          sex_excitation: 10,
          sex_inhibition: 60,
          baseline_libido: 0,
        },
      },
    ];

    const result = service.computeImpliedPrototype(axisConstraints, contexts);

    expect(result.byGatePass).toHaveLength(1);
    expect(result.byGatePass[0].gatePassRate).toBeCloseTo(1, 6);
  });

  it('uses affect-trait defaults when filtering regimes', () => {
    const prototypes = [
      {
        id: 'proto-trait',
        type: 'emotion',
        weights: { valence: 1 },
        gates: ['valence >= -1'],
      },
    ];

    const { service } = buildService({ prototypes });
    const axisConstraints = new Map([['harm_aversion', { min: 0.6, max: 1 }]]);
    const contexts = [{ mood: { valence: 80 } }];

    const result = service.computeImpliedPrototype(axisConstraints, contexts);

    expect(result.byGatePass).toHaveLength(1);
    expect(result.byGatePass[0].gatePassRate).toBe(0);
  });

  it('extracts constraints from prerequisites via PrototypeConstraintAnalyzer', () => {
    const prototypes = [
      {
        id: 'proto-constraints',
        type: 'emotion',
        weights: { valence: 1 },
        gates: [],
      },
    ];

    const constraintMap = new Map([['valence', { min: 0.2, max: 0.6 }]]);
    const mockConstraintAnalyzer = {
      extractAxisConstraints: jest.fn(() => constraintMap),
      analyzeEmotionThreshold: jest.fn(() => ({
        axisConstraints: constraintMap,
        gates: [],
      })),
    };

    const { service } = buildService({
      prototypes,
      constraintAnalyzer: mockConstraintAnalyzer,
    });

    const prerequisites = [{ condition: 'test' }];
    const contexts = [{ mood: { valence: 80 } }];
    const result = service.computeImpliedPrototype(prerequisites, contexts);

    expect(mockConstraintAnalyzer.extractAxisConstraints).toHaveBeenCalledWith(prerequisites);
    expect(result.targetSignature.has('valence')).toBe(true);
  });
});
