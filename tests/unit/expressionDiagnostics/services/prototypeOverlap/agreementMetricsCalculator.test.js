import AgreementMetricsCalculator from '../../../../../src/expressionDiagnostics/services/prototypeOverlap/AgreementMetricsCalculator.js';
import { wilsonInterval } from '../../../../../src/expressionDiagnostics/services/prototypeOverlap/WilsonInterval.js';

const buildVector = (gateResults, intensities) => ({
  prototypeId: 'test:vector',
  gateResults: Float32Array.from(gateResults),
  intensities: Float32Array.from(intensities),
  activationRate: 0,
  meanIntensity: 0,
  stdIntensity: 0,
});

describe('AgreementMetricsCalculator', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  it('calculates co-pass and global MAE/RMSE', () => {
    const calculator = new AgreementMetricsCalculator({
      wilsonInterval,
      logger: mockLogger,
      minSamplesForReliableCorrelation: 2,
    });

    const vectorA = buildVector([1, 1, 0, 0], [0.2, 0.7, 0, 0]);
    const vectorB = buildVector([1, 1, 0, 0], [0.1, 0.9, 0, 0]);

    const metrics = calculator.calculate(vectorA, vectorB);

    expect(metrics.maeCoPass).toBeCloseTo(0.15, 6);
    expect(metrics.rmseCoPass).toBeCloseTo(Math.sqrt(0.025), 6);
    expect(metrics.maeGlobal).toBeCloseTo(0.075, 6);
    expect(metrics.rmseGlobal).toBeCloseTo(Math.sqrt(0.0125), 6);
    expect(metrics.correlationReliable).toBe(true);
  });

  it('computes activation Jaccard and Wilson CIs for conditional probabilities', () => {
    const calculator = new AgreementMetricsCalculator({
      wilsonInterval,
      logger: mockLogger,
      confidenceLevel: 0.9,
    });

    const vectorA = buildVector([1, 1, 0, 0], [0.2, 0.2, 0, 0]);
    const vectorB = buildVector([1, 0, 1, 0], [0.2, 0, 0.8, 0]);

    const metrics = calculator.calculate(vectorA, vectorB);
    const expectedInterval = wilsonInterval(1, 2, 1.645);

    expect(metrics.activationJaccard).toBeCloseTo(1 / 3, 6);
    expect(metrics.pA_given_B).toBeCloseTo(0.5, 6);
    expect(metrics.pB_given_A).toBeCloseTo(0.5, 6);
    expect(metrics.pA_given_B_lower).toBeCloseTo(expectedInterval.lower, 6);
    expect(metrics.pA_given_B_upper).toBeCloseTo(expectedInterval.upper, 6);
    expect(metrics.pB_given_A_lower).toBeCloseTo(expectedInterval.lower, 6);
    expect(metrics.pB_given_A_upper).toBeCloseTo(expectedInterval.upper, 6);
  });

  it('handles no co-pass samples with NaN co-pass metrics', () => {
    const calculator = new AgreementMetricsCalculator({
      wilsonInterval,
      logger: mockLogger,
      minSamplesForReliableCorrelation: 2,
    });

    const vectorA = buildVector([1, 0], [0.2, 0]);
    const vectorB = buildVector([0, 1], [0, 0.7]);

    const metrics = calculator.calculate(vectorA, vectorB);

    expect(metrics.activationJaccard).toBe(0);
    expect(metrics.pA_given_B).toBe(0);
    expect(metrics.pB_given_A).toBe(0);
    expect(Number.isNaN(metrics.maeCoPass)).toBe(true);
    expect(Number.isNaN(metrics.rmseCoPass)).toBe(true);
    expect(Number.isNaN(metrics.pearsonCoPass)).toBe(true);
    expect(metrics.correlationReliable).toBe(false);
  });
});
