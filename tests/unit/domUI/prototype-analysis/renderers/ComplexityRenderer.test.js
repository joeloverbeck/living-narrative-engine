/**
 * @file Unit tests for ComplexityRenderer
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ComplexityRenderer from '../../../../../src/domUI/prototype-analysis/renderers/ComplexityRenderer.js';

describe('ComplexityRenderer', () => {
  let renderer;
  let mockLogger;

  function createMockLogger() {
    return {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  }

  function createMockElements() {
    return {
      complexityAnalysisContainer: document.createElement('div'),
    };
  }

  beforeEach(() => {
    mockLogger = createMockLogger();
    renderer = new ComplexityRenderer({ logger: mockLogger });
  });

  describe('constructor', () => {
    it('should initialize with valid logger', () => {
      expect(renderer).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith('[ComplexityRenderer] Initialized.');
    });

    it('should throw if logger is missing', () => {
      expect(() => new ComplexityRenderer({})).toThrow();
    });

    it('should throw if logger is invalid', () => {
      expect(() => new ComplexityRenderer({ logger: {} })).toThrow();
    });
  });

  describe('getRecommendationTypeClass', () => {
    it('should return correct class for consider_new_axis', () => {
      expect(renderer.getRecommendationTypeClass('consider_new_axis')).toBe('rec-type-axis');
    });

    it('should return correct class for refine_bundle', () => {
      expect(renderer.getRecommendationTypeClass('refine_bundle')).toBe('rec-type-refine');
    });

    it('should return correct class for investigate', () => {
      expect(renderer.getRecommendationTypeClass('investigate')).toBe('rec-type-investigate');
    });

    it('should return correct class for simplify', () => {
      expect(renderer.getRecommendationTypeClass('simplify')).toBe('rec-type-simplify');
    });

    it('should return default class for unknown type', () => {
      expect(renderer.getRecommendationTypeClass('unknown_type')).toBe('rec-type-info');
    });

    it('should return default class for null', () => {
      expect(renderer.getRecommendationTypeClass(null)).toBe('rec-type-info');
    });

    it('should return default class for undefined', () => {
      expect(renderer.getRecommendationTypeClass(undefined)).toBe('rec-type-info');
    });
  });

  describe('renderComplexityAnalysis', () => {
    describe('empty state', () => {
      it('should render empty message when complexityAnalysis is null', () => {
        const elements = createMockElements();

        renderer.renderComplexityAnalysis(null, elements);

        expect(elements.complexityAnalysisContainer.innerHTML).toContain('Complexity analysis not available');
        expect(elements.complexityAnalysisContainer.querySelector('.empty-list-message')).not.toBeNull();
      });

      it('should render empty message when complexityAnalysis is undefined', () => {
        const elements = createMockElements();

        renderer.renderComplexityAnalysis(undefined, elements);

        expect(elements.complexityAnalysisContainer.innerHTML).toContain('Complexity analysis not available');
      });

      it('should handle null container', () => {
        const elements = { complexityAnalysisContainer: null };

        expect(() => renderer.renderComplexityAnalysis({}, elements)).not.toThrow();
      });
    });

    describe('summary rendering', () => {
      it('should render total prototypes', () => {
        const elements = createMockElements();
        const analysis = {
          totalPrototypes: 25,
          averageComplexity: 3.5,
        };

        renderer.renderComplexityAnalysis(analysis, elements);

        expect(elements.complexityAnalysisContainer.innerHTML).toContain('25');
        expect(elements.complexityAnalysisContainer.innerHTML).toContain('Prototypes Analyzed');
      });

      it('should render average complexity', () => {
        const elements = createMockElements();
        const analysis = {
          totalPrototypes: 10,
          averageComplexity: 4.75,
        };

        renderer.renderComplexityAnalysis(analysis, elements);

        expect(elements.complexityAnalysisContainer.innerHTML).toContain('4.75');
        expect(elements.complexityAnalysisContainer.innerHTML).toContain('Average Axis Count');
      });

      it('should render distribution statistics when available', () => {
        const elements = createMockElements();
        const analysis = {
          totalPrototypes: 10,
          averageComplexity: 3.0,
          distribution: {
            median: 3,
            q1: 2,
            q3: 4,
          },
        };

        renderer.renderComplexityAnalysis(analysis, elements);

        expect(elements.complexityAnalysisContainer.innerHTML).toContain('Median');
        expect(elements.complexityAnalysisContainer.innerHTML).toContain('Q1 / Q3');
        expect(elements.complexityAnalysisContainer.innerHTML).toContain('2 / 4');
      });

      it('should handle default values', () => {
        const elements = createMockElements();

        renderer.renderComplexityAnalysis({}, elements);

        expect(elements.complexityAnalysisContainer.innerHTML).toContain('0');
        expect(elements.complexityAnalysisContainer.innerHTML).toContain('0.00');
      });
    });

    describe('histogram rendering', () => {
      it('should render histogram when available', () => {
        const elements = createMockElements();
        const analysis = {
          totalPrototypes: 10,
          averageComplexity: 3.0,
          distribution: {
            median: 3,
            q1: 2,
            q3: 4,
            histogram: [
              { bin: 1, count: 2 },
              { bin: 2, count: 5 },
              { bin: 3, count: 3 },
            ],
          },
        };

        renderer.renderComplexityAnalysis(analysis, elements);

        expect(elements.complexityAnalysisContainer.innerHTML).toContain('Axis Count Distribution');
        expect(elements.complexityAnalysisContainer.innerHTML).toContain('complexity-histogram');
      });

      it('should not render histogram when not available', () => {
        const elements = createMockElements();
        const analysis = {
          totalPrototypes: 10,
          averageComplexity: 3.0,
          distribution: {
            median: 3,
            q1: 2,
            q3: 4,
          },
        };

        renderer.renderComplexityAnalysis(analysis, elements);

        expect(elements.complexityAnalysisContainer.innerHTML).not.toContain('Axis Count Distribution');
      });
    });

    describe('outliers rendering', () => {
      it('should render outliers when available', () => {
        const elements = createMockElements();
        const analysis = {
          totalPrototypes: 10,
          averageComplexity: 3.0,
          distribution: {
            median: 3,
            q1: 2,
            q3: 4,
            outliers: [
              { prototypeId: 'proto_complex', axisCount: 15 },
              { prototypeId: 'proto_very_complex', axisCount: 20 },
            ],
          },
        };

        renderer.renderComplexityAnalysis(analysis, elements);

        expect(elements.complexityAnalysisContainer.innerHTML).toContain('Complexity Outliers');
        expect(elements.complexityAnalysisContainer.innerHTML).toContain('proto_complex');
        expect(elements.complexityAnalysisContainer.innerHTML).toContain('15 axes');
        expect(elements.complexityAnalysisContainer.innerHTML).toContain('proto_very_complex');
        expect(elements.complexityAnalysisContainer.innerHTML).toContain('20 axes');
      });

      it('should not render outliers section when empty', () => {
        const elements = createMockElements();
        const analysis = {
          totalPrototypes: 10,
          averageComplexity: 3.0,
          distribution: {
            median: 3,
            q1: 2,
            q3: 4,
            outliers: [],
          },
        };

        renderer.renderComplexityAnalysis(analysis, elements);

        expect(elements.complexityAnalysisContainer.innerHTML).not.toContain('Complexity Outliers');
      });

      it('should escape HTML in prototype IDs', () => {
        const elements = createMockElements();
        const analysis = {
          totalPrototypes: 10,
          averageComplexity: 3.0,
          distribution: {
            outliers: [
              { prototypeId: '<script>alert("xss")</script>', axisCount: 15 },
            ],
          },
        };

        renderer.renderComplexityAnalysis(analysis, elements);

        expect(elements.complexityAnalysisContainer.innerHTML).not.toContain('<script>');
        expect(elements.complexityAnalysisContainer.innerHTML).toContain('&lt;script&gt;');
      });
    });

    describe('co-occurrence bundles rendering', () => {
      it('should render bundles when available', () => {
        const elements = createMockElements();
        const analysis = {
          totalPrototypes: 10,
          averageComplexity: 3.0,
          coOccurrence: {
            bundles: [
              { axes: ['strength', 'power'], frequency: 8, suggestedConcept: 'Physical Power' },
              { axes: ['wisdom', 'intelligence'], frequency: 6 },
            ],
          },
        };

        renderer.renderComplexityAnalysis(analysis, elements);

        expect(elements.complexityAnalysisContainer.innerHTML).toContain('Frequently Co-occurring Axis Bundles');
        expect(elements.complexityAnalysisContainer.innerHTML).toContain('strength');
        expect(elements.complexityAnalysisContainer.innerHTML).toContain('power');
        expect(elements.complexityAnalysisContainer.innerHTML).toContain('Appears in 8 prototypes');
        expect(elements.complexityAnalysisContainer.innerHTML).toContain('Physical Power');
      });

      it('should not render bundles section when empty', () => {
        const elements = createMockElements();
        const analysis = {
          totalPrototypes: 10,
          averageComplexity: 3.0,
          coOccurrence: {
            bundles: [],
          },
        };

        renderer.renderComplexityAnalysis(analysis, elements);

        expect(elements.complexityAnalysisContainer.innerHTML).not.toContain('Frequently Co-occurring');
      });

      it('should handle missing suggestedConcept', () => {
        const elements = createMockElements();
        const analysis = {
          totalPrototypes: 10,
          averageComplexity: 3.0,
          coOccurrence: {
            bundles: [
              { axes: ['axis1', 'axis2'], frequency: 5 },
            ],
          },
        };

        renderer.renderComplexityAnalysis(analysis, elements);

        expect(elements.complexityAnalysisContainer.innerHTML).not.toContain('Suggested:');
      });

      it('should escape HTML in axis names and suggested concepts', () => {
        const elements = createMockElements();
        const analysis = {
          totalPrototypes: 10,
          averageComplexity: 3.0,
          coOccurrence: {
            bundles: [
              {
                axes: ['<img src=x onerror=alert(1)>'],
                frequency: 3,
                suggestedConcept: '<script>evil()</script>',
              },
            ],
          },
        };

        renderer.renderComplexityAnalysis(analysis, elements);

        expect(elements.complexityAnalysisContainer.innerHTML).not.toContain('<img');
        expect(elements.complexityAnalysisContainer.innerHTML).not.toContain('<script>');
      });
    });

    describe('recommendations rendering', () => {
      it('should render recommendations when available', () => {
        const elements = createMockElements();
        const analysis = {
          totalPrototypes: 10,
          averageComplexity: 3.0,
          recommendations: [
            { type: 'consider_new_axis', bundle: ['a', 'b'], reason: 'These axes frequently co-occur' },
            { type: 'simplify', reason: 'Too complex' },
          ],
        };

        renderer.renderComplexityAnalysis(analysis, elements);

        expect(elements.complexityAnalysisContainer.innerHTML).toContain('Complexity Recommendations');
        expect(elements.complexityAnalysisContainer.innerHTML).toContain('consider_new_axis');
        expect(elements.complexityAnalysisContainer.innerHTML).toContain('a + b');
        expect(elements.complexityAnalysisContainer.innerHTML).toContain('These axes frequently co-occur');
        expect(elements.complexityAnalysisContainer.innerHTML).toContain('rec-type-axis');
        expect(elements.complexityAnalysisContainer.innerHTML).toContain('rec-type-simplify');
      });

      it('should not render recommendations section when empty', () => {
        const elements = createMockElements();
        const analysis = {
          totalPrototypes: 10,
          averageComplexity: 3.0,
          recommendations: [],
        };

        renderer.renderComplexityAnalysis(analysis, elements);

        expect(elements.complexityAnalysisContainer.innerHTML).not.toContain('Complexity Recommendations');
      });

      it('should handle missing optional fields in recommendations', () => {
        const elements = createMockElements();
        const analysis = {
          totalPrototypes: 10,
          averageComplexity: 3.0,
          recommendations: [{}],
        };

        renderer.renderComplexityAnalysis(analysis, elements);

        expect(elements.complexityAnalysisContainer.innerHTML).toContain('info');
      });
    });
  });

  describe('renderHistogramBars', () => {
    it('should render histogram bars correctly', () => {
      const histogram = [
        { bin: 1, count: 2 },
        { bin: 2, count: 5 },
        { bin: 3, count: 3 },
      ];

      const result = renderer.renderHistogramBars(histogram);

      expect(result).toContain('histogram-bar-container');
      expect(result).toContain('histogram-bar');
      expect(result).toContain('histogram-label');
      expect(result).toContain('histogram-count');
    });

    it('should sort histogram bins by bin value', () => {
      const histogram = [
        { bin: 3, count: 3 },
        { bin: 1, count: 2 },
        { bin: 2, count: 5 },
      ];

      const result = renderer.renderHistogramBars(histogram);

      // Check that labels appear in order (1, 2, 3)
      const labelMatches = result.match(/histogram-label">\d+</g);
      expect(labelMatches).toEqual([
        'histogram-label">1<',
        'histogram-label">2<',
        'histogram-label">3<',
      ]);
    });

    it('should calculate height percentages correctly', () => {
      const histogram = [
        { bin: 1, count: 50 },
        { bin: 2, count: 100 }, // max
        { bin: 3, count: 25 },
      ];

      const result = renderer.renderHistogramBars(histogram);

      expect(result).toContain('height: 100%'); // max
      expect(result).toContain('height: 50%');  // 50/100
      expect(result).toContain('height: 25%');  // 25/100
    });

    it('should include table fallback', () => {
      const histogram = [
        { bin: 1, count: 5 },
      ];

      const result = renderer.renderHistogramBars(histogram);

      expect(result).toContain('histogram-table-fallback');
      expect(result).toContain('View as table');
      expect(result).toContain('<table');
      expect(result).toContain('Axis Count');
      expect(result).toContain('Prototypes');
    });

    it('should return empty message for null histogram', () => {
      const result = renderer.renderHistogramBars(null);

      expect(result).toContain('No histogram data');
    });

    it('should return empty message for empty histogram', () => {
      const result = renderer.renderHistogramBars([]);

      expect(result).toContain('No histogram data');
    });

    it('should return empty message for all-zero histogram', () => {
      const histogram = [
        { bin: 1, count: 0 },
        { bin: 2, count: 0 },
      ];

      const result = renderer.renderHistogramBars(histogram);

      expect(result).toContain('No histogram data');
    });

    it('should return empty message for non-array', () => {
      const result = renderer.renderHistogramBars('not an array');

      expect(result).toContain('No histogram data');
    });
  });

  describe('static constants', () => {
    it('should have recommendation type classes', () => {
      expect(ComplexityRenderer.RECOMMENDATION_TYPE_CLASSES).toBeDefined();
      expect(ComplexityRenderer.RECOMMENDATION_TYPE_CLASSES.consider_new_axis).toBe('rec-type-axis');
      expect(ComplexityRenderer.RECOMMENDATION_TYPE_CLASSES.refine_bundle).toBe('rec-type-refine');
      expect(ComplexityRenderer.RECOMMENDATION_TYPE_CLASSES.investigate).toBe('rec-type-investigate');
      expect(ComplexityRenderer.RECOMMENDATION_TYPE_CLASSES.simplify).toBe('rec-type-simplify');
    });
  });
});
