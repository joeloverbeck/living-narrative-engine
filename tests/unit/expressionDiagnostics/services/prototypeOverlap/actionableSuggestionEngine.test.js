import ActionableSuggestionEngine from '../../../../../src/expressionDiagnostics/services/prototypeOverlap/ActionableSuggestionEngine.js';
import ContextAxisNormalizer from '../../../../../src/expressionDiagnostics/services/ContextAxisNormalizer.js';

const buildVector = (gateResults, intensities) => ({
  prototypeId: 'test:vector',
  gateResults: Float32Array.from(gateResults),
  intensities: Float32Array.from(intensities),
  activationRate: 0,
  meanIntensity: 0,
  stdIntensity: 0,
});

const buildContext = (valence, arousal = 0) => ({
  moodAxes: { valence, arousal },
});

const createLogger = () => ({
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('ActionableSuggestionEngine', () => {
  it('generates a decision stump suggestion with impact estimates', () => {
    const logger = createLogger();
    const contextAxisNormalizer = new ContextAxisNormalizer({ logger });

    const engine = new ActionableSuggestionEngine({
      config: {
        minSamplesForStump: 2,
        minInfoGainForSuggestion: 0.01,
        maxSuggestionsPerPair: 1,
      },
      logger,
      contextAxisNormalizer,
    });

    const contextPool = [
      buildContext(-100),
      buildContext(-50),
      buildContext(0),
      buildContext(50),
      buildContext(100),
    ];

    const vectorA = buildVector([1, 1, 1, 1, 1], [0.6, 0.6, 0.6, 0.2, 0.2]);
    const vectorB = buildVector([0, 0, 0, 1, 1], [0, 0, 0, 0.8, 0.8]);

    const suggestions = engine.generateSuggestions(
      vectorA,
      vectorB,
      contextPool,
      'needs_separation'
    );

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].axis).toBe('valence');
    expect(suggestions[0].operator).toBe('<=');
    expect(suggestions[0].targetPrototype).toBe('a');
    expect(suggestions[0].threshold).toBeCloseTo(0.25, 2);
    expect(suggestions[0].overlapReductionEstimate).toBeCloseTo(1, 6);
    expect(suggestions[0].activationImpactEstimate).toBeLessThan(0);
    expect(suggestions[0].isValid).toBe(true);
  });

  it('clamps thresholds that exceed configured axis ranges', () => {
    const logger = createLogger();
    const contextAxisNormalizer = new ContextAxisNormalizer({ logger });

    const engine = new ActionableSuggestionEngine({
      config: {
        minSamplesForStump: 2,
        minInfoGainForSuggestion: 0.01,
        maxSuggestionsPerPair: 1,
        axisRanges: {
          valence: { min: -0.2, max: 0.2 },
        },
      },
      logger,
      contextAxisNormalizer,
    });

    const contextPool = [
      buildContext(-100),
      buildContext(-50),
      buildContext(0),
      buildContext(50),
      buildContext(100),
    ];

    const vectorA = buildVector([1, 1, 1, 1, 1], [0.6, 0.6, 0.6, 0.2, 0.2]);
    const vectorB = buildVector([0, 0, 0, 1, 1], [0, 0, 0, 0.8, 0.8]);

    const [suggestion] = engine.generateSuggestions(
      vectorA,
      vectorB,
      contextPool,
      'needs_separation'
    );

    expect(suggestion.threshold).toBeCloseTo(0.2, 6);
    expect(suggestion.validationMessage).toMatch(/clamped/i);
    expect(suggestion.isValid).toBe(true);
  });

  it('handles insufficient divergent samples gracefully', () => {
    const logger = createLogger();
    const contextAxisNormalizer = new ContextAxisNormalizer({ logger });

    const engine = new ActionableSuggestionEngine({
      config: {
        minSamplesForStump: 10,
      },
      logger,
      contextAxisNormalizer,
    });

    const contextPool = [
      buildContext(-100),
      buildContext(-50),
      buildContext(0),
      buildContext(50),
      buildContext(100),
    ];

    const vectorA = buildVector([1, 1, 1, 1, 1], [0.6, 0.6, 0.6, 0.2, 0.2]);
    const vectorB = buildVector([0, 0, 0, 1, 1], [0, 0, 0, 0.8, 0.8]);

    const suggestions = engine.generateSuggestions(
      vectorA,
      vectorB,
      contextPool,
      'needs_separation'
    );

    expect(suggestions).toHaveLength(0);
  });

  it('returns multiple suggestions when multiple axes separate the samples', () => {
    const logger = createLogger();
    const contextAxisNormalizer = new ContextAxisNormalizer({ logger });

    const engine = new ActionableSuggestionEngine({
      config: {
        minSamplesForStump: 2,
        minInfoGainForSuggestion: 0.01,
        maxSuggestionsPerPair: 2,
        minOverlapReductionForSuggestion: 0,
      },
      logger,
      contextAxisNormalizer,
    });

    const contextPool = [
      buildContext(-100, -100),
      buildContext(-50, -50),
      buildContext(-20, -20),
      buildContext(20, 20),
      buildContext(50, 50),
      buildContext(100, 100),
    ];

    const vectorA = buildVector([1, 1, 1, 0, 0, 0], [0.6, 0.6, 0.6, 0, 0, 0]);
    const vectorB = buildVector([0, 0, 0, 1, 1, 1], [0, 0, 0, 0.7, 0.7, 0.7]);

    const suggestions = engine.generateSuggestions(
      vectorA,
      vectorB,
      contextPool,
      'needs_separation'
    );

    const axes = suggestions.map((suggestion) => suggestion.axis).sort();
    expect(suggestions).toHaveLength(2);
    expect(axes).toEqual(['arousal', 'valence']);
  });
});
