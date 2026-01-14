/**
 * @file Unit tests for PrototypeFitRankingService normalization parity.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import PrototypeFitRankingService from '../../../../src/expressionDiagnostics/services/PrototypeFitRankingService.js';

describe('PrototypeFitRankingService normalization parity', () => {
  let service;
  let mockLogger;
  let mockDataRegistry;

  const samplePrototypes = {
    resonance: {
      id: 'resonance',
      weights: { valence: 1, sexual_arousal: 1, harm_aversion: 1 },
      gates: ['sexual_arousal >= 0.5', 'harm_aversion >= 0.5'],
    },
  };

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockDataRegistry = {
      get: jest.fn(() => null),
      getLookupData: jest.fn((lookupId) => {
        if (lookupId === 'core:emotion_prototypes') {
          return { entries: samplePrototypes };
        }
        return null;
      }),
    };

    service = new PrototypeFitRankingService({
      logger: mockLogger,
      dataRegistry: mockDataRegistry,
    });
  });

  it('normalizes mood, sexual axes, and affect traits for gates and intensity', () => {
    const contexts = [
      {
        moodAxes: { valence: 50 },
        sexualAxes: { sex_excitation: 80, sex_inhibition: 20, baseline_libido: 20 },
        affectTraits: { harm_aversion: 70 },
      },
      {
        moodAxes: { valence: 50 },
        sexualAxes: { sex_excitation: 20, sex_inhibition: 80, baseline_libido: 10 },
        affectTraits: { harm_aversion: 70 },
      },
    ];

    const result = service.analyzeAllPrototypeFit(
      { id: 'test-expression' },
      contexts,
      new Map(),
      0.6
    );

    expect(result.leaderboard).toHaveLength(1);
    const entry = result.leaderboard[0];
    const expectedIntensity = (0.5 + 0.8 + 0.7) / 3;

    expect(entry.gatePassRate).toBeCloseTo(0.5, 6);
    expect(entry.intensityDistribution.p50).toBeCloseTo(expectedIntensity, 6);
    expect(entry.intensityDistribution.pAboveThreshold).toBe(1);
  });

  it('treats pre-normalized axes as raw values', () => {
    const contexts = [
      {
        moodAxes: { valence: 0.5 },
        sexualAxes: { sex_excitation: 0.8, sex_inhibition: 0.2, baseline_libido: 0.2 },
        affectTraits: { harm_aversion: 0.7 },
      },
    ];

    const result = service.analyzeAllPrototypeFit(
      { id: 'test-expression' },
      contexts,
      new Map(),
      0.6
    );

    const entry = result.leaderboard[0];
    expect(entry.gatePassRate).toBeCloseTo(0, 6);
    expect(entry.intensityDistribution.p50).toBeCloseTo(0, 6);
  });
});
