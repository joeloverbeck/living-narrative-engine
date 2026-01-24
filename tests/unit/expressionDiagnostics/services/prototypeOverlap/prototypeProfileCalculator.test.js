import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import PrototypeProfileCalculator from '../../../../../src/expressionDiagnostics/services/prototypeOverlap/PrototypeProfileCalculator.js';

const buildVector = ({
  prototypeId = 'proto-a',
  gateResults = [1, 0, 1, 0],
  intensities = [0.2, 0, 0.6, 0],
  activationRate = 0.5,
} = {}) => ({
  prototypeId,
  gateResults: Float32Array.from(gateResults),
  intensities: Float32Array.from(intensities),
  activationRate,
  meanIntensity: 0,
  stdIntensity: 0,
});

describe('PrototypeProfileCalculator', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  it('calculates gate volume, weight entropy, and weight concentration', () => {
    const calculator = new PrototypeProfileCalculator({
      logger: mockLogger,
      config: { clusterCount: 1 },
    });

    const prototype = {
      id: 'proto-a',
      weights: { valence: 1, arousal: 1 },
    };
    const outputVector = buildVector({ activationRate: 0.25 });

    const profile = calculator.calculateSingle(prototype, outputVector, [
      { id: 'cluster-0', centroid: outputVector.intensities },
    ]);

    expect(profile.gateVolume).toBeCloseTo(0.25, 6);
    expect(profile.weightEntropy).toBeCloseTo(1, 6);
    expect(profile.weightConcentration).toBeCloseTo(0.5, 6);
  });

  it('computes delta-from-nearest-center using L2 distance', () => {
    const calculator = new PrototypeProfileCalculator({
      logger: mockLogger,
      config: { clusterCount: 1, maxIterations: 5 },
    });

    const prototypes = [
      { id: 'proto-a', weights: { valence: 1 } },
      { id: 'proto-b', weights: { valence: 1 } },
    ];

    const vectorA = buildVector({
      prototypeId: 'proto-a',
      gateResults: [1, 1],
      intensities: [1, 1],
      activationRate: 1,
    });
    const vectorB = buildVector({
      prototypeId: 'proto-b',
      gateResults: [1, 1],
      intensities: [3, 3],
      activationRate: 1,
    });

    const outputVectors = new Map([
      ['proto-a', vectorA],
      ['proto-b', vectorB],
    ]);

    const profiles = calculator.calculateAll(prototypes, outputVectors);
    const profileA = profiles.get('proto-a');

    expect(profileA.nearestClusterId).toBe('cluster-0');
    expect(profileA.deltaFromNearestCenter).toBeCloseTo(Math.sqrt(2), 6);
  });

  it('flags expression candidates when thresholds are met', () => {
    const calculator = new PrototypeProfileCalculator({
      logger: mockLogger,
      config: {
        clusterCount: 1,
        lowVolumeThreshold: 0.1,
        lowNoveltyThreshold: 0.2,
        singleAxisFocusThreshold: 0.8,
      },
    });

    const prototype = { id: 'proto-a', weights: { valence: 1, arousal: 0.1 } };
    const outputVector = buildVector({
      prototypeId: 'proto-a',
      gateResults: [1, 0, 0, 0],
      intensities: [0.5, 0, 0, 0],
      activationRate: 0.05,
    });

    const profile = calculator.calculateSingle(prototype, outputVector, [
      { id: 'cluster-0', centroid: outputVector.intensities },
    ]);

    expect(profile.isExpressionCandidate).toBe(true);
  });

  it('caps cluster count to available vectors and keeps deterministic centroids', () => {
    const calculator = new PrototypeProfileCalculator({
      logger: mockLogger,
      config: { clusterCount: 5 },
    });

    const vectorA = buildVector({
      prototypeId: 'proto-a',
      gateResults: [1, 1],
      intensities: [0.1, 0.2],
    });
    const vectorB = buildVector({
      prototypeId: 'proto-b',
      gateResults: [1, 1],
      intensities: [0.8, 0.9],
    });

    const outputVectors = new Map([
      ['proto-a', vectorA],
      ['proto-b', vectorB],
    ]);

    const centroids = calculator.computeClusterCentroids(outputVectors);

    expect(centroids).toHaveLength(2);
    const centroidA = Array.from(centroids[0].centroid);
    const centroidB = Array.from(centroids[1].centroid);
    expect(centroidA[0]).toBeCloseTo(0.1, 6);
    expect(centroidA[1]).toBeCloseTo(0.2, 6);
    expect(centroidB[0]).toBeCloseTo(0.8, 6);
    expect(centroidB[1]).toBeCloseTo(0.9, 6);
  });
});
