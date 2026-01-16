/**
 * @file Unit tests for gate behavior before PrototypeGateChecker extraction.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import PrototypeFitRankingService from '../../../../src/expressionDiagnostics/services/PrototypeFitRankingService.js';

const buildContexts = (values) =>
  values.map((valence) => ({
    moodAxes: { valence },
  }));

describe('PrototypeGateChecker (via PrototypeFitRankingService)', () => {
  let mockLogger;

  const createService = (prototypes, prototypeConstraintAnalyzer = null) => {
    const mockDataRegistry = {
      get: jest.fn(() => null),
      getLookupData: jest.fn((lookupId) => {
        if (lookupId === 'core:emotion_prototypes') {
          return { entries: prototypes };
        }
        return null;
      }),
    };

    return new PrototypeFitRankingService({
      logger: mockLogger,
      dataRegistry: mockDataRegistry,
      prototypeConstraintAnalyzer,
    });
  };

  const getGatePassRate = (result, id) => {
    const entry = result.leaderboard.find((item) => item.prototypeId === id);
    expect(entry).toBeDefined();
    return entry.gatePassRate;
  };

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
  });

  it('computes pass rates across supported operators', () => {
    const prototypes = {
      ge: { id: 'ge', weights: {}, gates: ['valence >= 0.5'] },
      le: { id: 'le', weights: {}, gates: ['valence <= 0.4'] },
      gt: { id: 'gt', weights: {}, gates: ['valence > 0.5'] },
      lt: { id: 'lt', weights: {}, gates: ['valence < 0.5'] },
      eq: { id: 'eq', weights: {}, gates: ['valence == 0.5'] },
    };
    const service = createService(prototypes);
    const contexts = buildContexts([60, 50, 40]);

    const result = service.analyzeAllPrototypeFit(
      { id: 'expr' },
      contexts,
      new Map(),
      0.3
    );

    expect(getGatePassRate(result, 'ge')).toBeCloseTo(2 / 3, 6);
    expect(getGatePassRate(result, 'le')).toBeCloseTo(1 / 3, 6);
    expect(getGatePassRate(result, 'gt')).toBeCloseTo(1 / 3, 6);
    expect(getGatePassRate(result, 'lt')).toBeCloseTo(1 / 3, 6);
    expect(getGatePassRate(result, 'eq')).toBeCloseTo(1 / 3, 6);
  });

  it('defaults missing axes to 0 for gate checks', () => {
    const prototypes = {
      missingAxis: { id: 'missingAxis', weights: {}, gates: ['valence >= 0.1'] },
    };
    const service = createService(prototypes);
    const contexts = [{ moodAxes: {} }, {}];

    const result = service.analyzeAllPrototypeFit(
      { id: 'expr' },
      contexts,
      new Map(),
      0.3
    );

    expect(getGatePassRate(result, 'missingAxis')).toBe(0);
  });

  it('ignores invalid gate strings when evaluating pass rates', () => {
    const prototypes = {
      validAndInvalid: {
        id: 'validAndInvalid',
        weights: {},
        gates: ['valence >= 0.5', 'not a gate'],
      },
      invalidOnly: {
        id: 'invalidOnly',
        weights: {},
        gates: ['totally invalid'],
      },
    };
    const service = createService(prototypes);
    const contexts = buildContexts([60, 40]);

    const result = service.analyzeAllPrototypeFit(
      { id: 'expr' },
      contexts,
      new Map(),
      0.3
    );

    expect(getGatePassRate(result, 'validAndInvalid')).toBeCloseTo(0.5, 6);
    expect(getGatePassRate(result, 'invalidOnly')).toBe(1);
  });

  it('treats prototypes with no gates as always passing, but empty contexts as 0 pass rate', () => {
    const prototypes = {
      noGates: { id: 'noGates', weights: {}, gates: [] },
    };
    const service = createService(prototypes);
    const contexts = buildContexts([60, 40]);

    const result = service.analyzeAllPrototypeFit(
      { id: 'expr' },
      contexts,
      new Map(),
      0.3
    );

    expect(getGatePassRate(result, 'noGates')).toBe(1);

    const implied = service.computeImpliedPrototype(new Map(), [], []);
    expect(implied.byGatePass).toHaveLength(1);
    expect(implied.byGatePass[0].gatePassRate).toBe(0);
  });

  it('surfaces gate compatibility results from the prototype constraint analyzer', () => {
    const prototypes = {
      joy: { id: 'joy', weights: {}, gates: [] },
    };
    const prototypeConstraintAnalyzer = {
      analyzeEmotionThreshold: jest.fn(() => ({
        gateStatus: {
          allSatisfiable: false,
          blockingGates: [{ reason: 'valence below regime' }],
        },
      })),
      extractAxisConstraints: jest.fn(() => new Map()),
    };
    const service = createService(prototypes, prototypeConstraintAnalyzer);
    const contexts = buildContexts([60]);
    const axisConstraints = new Map([['valence', { min: 0.3, max: 1 }]]);

    const result = service.analyzeAllPrototypeFit(
      { id: 'expr' },
      contexts,
      axisConstraints,
      0.3
    );

    const entry = result.leaderboard[0];
    expect(entry.gateCompatibility).toEqual({
      compatible: false,
      reason: 'valence below regime',
    });
  });

  it('computes gate distance conflicts against desired ranges', () => {
    const prototypes = {
      compatible: { id: 'compatible', weights: {}, gates: ['valence >= 0.5'] },
      tooHighStrict: { id: 'tooHighStrict', weights: {}, gates: ['valence > 0.6'] },
      tooLowInclusive: { id: 'tooLowInclusive', weights: {}, gates: ['valence <= 0.3'] },
      equalOutside: { id: 'equalOutside', weights: {}, gates: ['valence == 0.9'] },
      tooLowExclusive: { id: 'tooLowExclusive', weights: {}, gates: ['valence < 0.4'] },
    };
    const service = createService(prototypes);
    const axisConstraints = new Map([['valence', { min: 0.4, max: 0.6 }]]);

    const result = service.detectPrototypeGaps(
      axisConstraints,
      [],
      axisConstraints,
      0.3
    );

    const distances = new Map(
      result.kNearestNeighbors.map((entry) => [entry.prototypeId, entry.gateDistance])
    );

    expect(distances.get('compatible')).toBeCloseTo(0, 6);
    expect(distances.get('tooHighStrict')).toBeCloseTo(1, 6);
    expect(distances.get('tooLowInclusive')).toBeCloseTo(1, 6);
    expect(distances.get('equalOutside')).toBeCloseTo(1, 6);
    expect(distances.get('tooLowExclusive')).toBeCloseTo(1, 6);
  });
});
