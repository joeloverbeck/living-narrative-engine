/**
 * @file Unit tests for MetadataRenderer
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import MetadataRenderer from '../../../../../src/domUI/prototype-analysis/renderers/MetadataRenderer.js';

describe('MetadataRenderer', () => {
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
      resultsMetadata: document.createElement('div'),
      recommendationsContainer: document.createElement('div'),
    };
  }

  function createBaseMetadata() {
    return {
      prototypeFamily: 'emotion',
      totalPrototypes: 15,
      candidatePairsFound: 50,
      candidatePairsEvaluated: 40,
      redundantPairsFound: 5,
      sampleCountPerPair: 100,
    };
  }

  beforeEach(() => {
    mockLogger = createMockLogger();
    renderer = new MetadataRenderer({ logger: mockLogger });
  });

  describe('constructor', () => {
    it('should initialize with valid logger', () => {
      expect(renderer).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith('[MetadataRenderer] Initialized.');
    });

    it('should throw if logger is missing', () => {
      expect(() => new MetadataRenderer({})).toThrow();
    });

    it('should throw if logger is invalid', () => {
      expect(() => new MetadataRenderer({ logger: {} })).toThrow();
    });
  });

  describe('renderMetadata', () => {
    it('should render basic metadata grid', () => {
      const elements = createMockElements();
      const metadata = createBaseMetadata();

      renderer.renderMetadata(metadata, elements);

      expect(elements.resultsMetadata.innerHTML).toContain('emotion');
      expect(elements.resultsMetadata.innerHTML).toContain('15');
      expect(elements.resultsMetadata.innerHTML).toContain('50');
      expect(elements.resultsMetadata.innerHTML).toContain('40');
      expect(elements.resultsMetadata.innerHTML).toContain('5');
      expect(elements.resultsMetadata.innerHTML).toContain('100');
    });

    it('should render filtering stats when provided', () => {
      const elements = createMockElements();
      const metadata = {
        ...createBaseMetadata(),
        filteringStats: {
          totalPossiblePairs: 1000,
          passedFiltering: 50,
          rejectedByActiveAxisOverlap: 300,
          rejectedBySignAgreement: 400,
          rejectedByCosineSimilarity: 250,
        },
      };

      renderer.renderMetadata(metadata, elements);

      expect(elements.resultsMetadata.innerHTML).toContain('1,000');
      expect(elements.resultsMetadata.innerHTML).toContain('5.0%');
      expect(elements.resultsMetadata.innerHTML).toContain('Axis overlap: 300');
    });

    it('should render classification breakdown when provided', () => {
      const elements = createMockElements();
      const metadata = {
        ...createBaseMetadata(),
        classificationBreakdown: {
          mergeRecommended: 3,
          subsumedRecommended: 2,
          nestedSiblings: 1,
          needsSeparation: 4,
          convertToExpression: 0,
          keepDistinct: 30,
        },
      };

      renderer.renderMetadata(metadata, elements);

      expect(elements.resultsMetadata.innerHTML).toContain('3 merge');
      expect(elements.resultsMetadata.innerHTML).toContain('2 subsumed');
      expect(elements.resultsMetadata.innerHTML).toContain('4 separation');
    });

    it('should render summary insight when provided', () => {
      const elements = createMockElements();
      const metadata = {
        ...createBaseMetadata(),
        summaryInsight: {
          status: 'warning',
          message: 'Some prototypes are very similar',
          closestPair: {
            prototypeA: 'happy',
            prototypeB: 'joyful',
            compositeScore: 0.95,
            gateOverlapRatio: 0.8,
            correlation: 0.9,
            globalMeanAbsDiff: 0.05,
          },
        },
      };

      renderer.renderMetadata(metadata, elements);

      expect(elements.resultsMetadata.innerHTML).toContain('status-warning');
      expect(elements.resultsMetadata.innerHTML).toContain('Some prototypes are very similar');
      expect(elements.resultsMetadata.innerHTML).toContain('happy');
      expect(elements.resultsMetadata.innerHTML).toContain('joyful');
      expect(elements.resultsMetadata.innerHTML).toContain('0.950');
    });

    it('should handle null resultsMetadata element', () => {
      const elements = createMockElements();
      elements.resultsMetadata = null;
      const metadata = createBaseMetadata();

      expect(() => renderer.renderMetadata(metadata, elements)).not.toThrow();
      expect(mockLogger.debug).toHaveBeenCalledWith('[MetadataRenderer] No resultsMetadata element provided.');
    });

    it('should escape HTML in prototype family', () => {
      const elements = createMockElements();
      const metadata = {
        ...createBaseMetadata(),
        prototypeFamily: '<script>alert("xss")</script>',
      };

      renderer.renderMetadata(metadata, elements);

      expect(elements.resultsMetadata.innerHTML).not.toContain('<script>');
      expect(elements.resultsMetadata.innerHTML).toContain('&lt;script&gt;');
    });

    it('should handle zero filtering percentage', () => {
      const elements = createMockElements();
      const metadata = {
        ...createBaseMetadata(),
        filteringStats: {
          totalPossiblePairs: 0,
          passedFiltering: 0,
          rejectedByActiveAxisOverlap: 0,
          rejectedBySignAgreement: 0,
          rejectedByCosineSimilarity: 0,
        },
      };

      renderer.renderMetadata(metadata, elements);

      expect(elements.resultsMetadata.innerHTML).toContain('0.0%');
    });
  });

  describe('renderRecommendationCard', () => {
    it('should render v2 format recommendation', () => {
      const elements = createMockElements();
      const recommendation = {
        prototypes: { a: 'happy', b: 'joyful' },
        actions: ['Consider merging', 'Review overlapping contexts'],
        severity: 0.85,
        type: 'prototype_merge_suggestion',
      };

      renderer.renderRecommendationCard(recommendation, 0, elements);

      const card = elements.recommendationsContainer.querySelector('article');
      expect(card).not.toBeNull();
      expect(card.innerHTML).toContain('happy');
      expect(card.innerHTML).toContain('joyful');
      expect(card.innerHTML).toContain('Consider merging');
      expect(card.innerHTML).toContain('0.85');
    });

    it('should render v1 format recommendation (backward compatible)', () => {
      const elements = createMockElements();
      const recommendation = {
        prototypeA: 'angry',
        prototypeB: 'furious',
        actionableInsight: 'These prototypes are very similar',
        summary: 'High behavioral overlap detected',
        severity: 0.75,
        type: 'high_overlap',
      };

      renderer.renderRecommendationCard(recommendation, 0, elements);

      const card = elements.recommendationsContainer.querySelector('article');
      expect(card.innerHTML).toContain('angry');
      expect(card.innerHTML).toContain('furious');
      expect(card.innerHTML).toContain('These prototypes are very similar');
      expect(card.innerHTML).toContain('High behavioral overlap detected');
    });

    it('should use derived summary when not provided', () => {
      const elements = createMockElements();
      const recommendation = {
        prototypes: { a: 'sad', b: 'melancholy' },
        severity: 0.6,
        type: 'prototype_merge_suggestion',
      };

      renderer.renderRecommendationCard(recommendation, 0, elements);

      const card = elements.recommendationsContainer.querySelector('article');
      expect(card.innerHTML).toContain('behave nearly identically');
    });

    it('should apply correct severity class for high severity', () => {
      const elements = createMockElements();
      const recommendation = {
        prototypes: { a: 'a', b: 'b' },
        severity: 0.9,
        type: 'prototype_merge_suggestion',
      };

      renderer.renderRecommendationCard(recommendation, 0, elements);

      const card = elements.recommendationsContainer.querySelector('article');
      expect(card.classList.contains('severity-high')).toBe(true);
    });

    it('should apply correct severity class for medium severity', () => {
      const elements = createMockElements();
      const recommendation = {
        prototypes: { a: 'a', b: 'b' },
        severity: 0.6,
        type: 'prototype_merge_suggestion',
      };

      renderer.renderRecommendationCard(recommendation, 0, elements);

      const card = elements.recommendationsContainer.querySelector('article');
      expect(card.classList.contains('severity-medium')).toBe(true);
    });

    it('should apply correct severity class for low severity', () => {
      const elements = createMockElements();
      const recommendation = {
        prototypes: { a: 'a', b: 'b' },
        severity: 0.3,
        type: 'prototype_merge_suggestion',
      };

      renderer.renderRecommendationCard(recommendation, 0, elements);

      const card = elements.recommendationsContainer.querySelector('article');
      expect(card.classList.contains('severity-low')).toBe(true);
    });

    it('should render divergence examples', () => {
      const elements = createMockElements();
      const recommendation = {
        prototypes: { a: 'a', b: 'b' },
        severity: 0.5,
        type: 'high_overlap',
        evidence: {
          divergenceExamples: [
            { intensityDifference: 0.25, contextSummary: 'Combat context' },
            { intensityDifference: 0.15, contextSummary: 'Social context' },
          ],
        },
      };

      renderer.renderRecommendationCard(recommendation, 0, elements);

      const card = elements.recommendationsContainer.querySelector('article');
      expect(card.innerHTML).toContain('0.250');
      expect(card.innerHTML).toContain('Combat context');
    });

    it('should limit divergence examples to 3', () => {
      const elements = createMockElements();
      const recommendation = {
        prototypes: { a: 'a', b: 'b' },
        severity: 0.5,
        type: 'high_overlap',
        evidence: {
          divergenceExamples: [
            { intensityDifference: 0.1, contextSummary: 'Context 1' },
            { intensityDifference: 0.2, contextSummary: 'Context 2' },
            { intensityDifference: 0.3, contextSummary: 'Context 3' },
            { intensityDifference: 0.4, contextSummary: 'Context 4' },
            { intensityDifference: 0.5, contextSummary: 'Context 5' },
          ],
        },
      };

      renderer.renderRecommendationCard(recommendation, 0, elements);

      const card = elements.recommendationsContainer.querySelector('article');
      expect(card.innerHTML).toContain('Context 1');
      expect(card.innerHTML).toContain('Context 3');
      expect(card.innerHTML).not.toContain('Context 4');
    });

    it('should render additional evidence from secondary matches', () => {
      const elements = createMockElements();
      const recommendation = {
        prototypes: { a: 'a', b: 'b' },
        severity: 0.5,
        type: 'high_overlap',
        allMatchingClassifications: [
          { isPrimary: true, type: 'high_overlap', confidence: 0.9 },
          { isPrimary: false, type: 'needs_separation', confidence: 0.6, evidence: { metric: 0.5 } },
        ],
      };

      renderer.renderRecommendationCard(recommendation, 0, elements);

      const card = elements.recommendationsContainer.querySelector('article');
      expect(card.innerHTML).toContain('Additional Evidence');
      expect(card.innerHTML).toContain('Needs Separation');
    });

    it('should handle null recommendationsContainer', () => {
      const elements = createMockElements();
      elements.recommendationsContainer = null;
      const recommendation = {
        prototypes: { a: 'a', b: 'b' },
        severity: 0.5,
        type: 'high_overlap',
      };

      expect(() => renderer.renderRecommendationCard(recommendation, 0, elements)).not.toThrow();
      expect(mockLogger.debug).toHaveBeenCalledWith('[MetadataRenderer] No recommendationsContainer element provided.');
    });

    it('should use fallback prototype names when missing', () => {
      const elements = createMockElements();
      const recommendation = {
        severity: 0.5,
        type: 'high_overlap',
      };

      renderer.renderRecommendationCard(recommendation, 0, elements);

      const card = elements.recommendationsContainer.querySelector('article');
      expect(card.innerHTML).toContain('Unknown A');
      expect(card.innerHTML).toContain('Unknown B');
    });

    it('should use fallback action text when none provided', () => {
      const elements = createMockElements();
      const recommendation = {
        prototypes: { a: 'a', b: 'b' },
        severity: 0.5,
        type: 'high_overlap',
      };

      renderer.renderRecommendationCard(recommendation, 0, elements);

      const card = elements.recommendationsContainer.querySelector('article');
      expect(card.innerHTML).toContain('No specific actions recommended');
    });
  });

  describe('formatType', () => {
    it('should format v1 types correctly', () => {
      expect(renderer.formatType('structurally_redundant')).toBe('Structurally Redundant');
      expect(renderer.formatType('behaviorally_redundant')).toBe('Behaviorally Redundant');
      expect(renderer.formatType('high_overlap')).toBe('High Overlap');
      expect(renderer.formatType('not_redundant')).toBe('Not Redundant');
    });

    it('should format v2 types correctly', () => {
      expect(renderer.formatType('prototype_merge_suggestion')).toBe('Merge Suggestion');
      expect(renderer.formatType('prototype_subsumption_suggestion')).toBe('Subsumption Suggestion');
      expect(renderer.formatType('prototype_needs_separation')).toBe('Needs Separation');
    });

    it('should return original type for unknown types', () => {
      expect(renderer.formatType('unknown_type')).toBe('unknown_type');
    });
  });

  describe('getSeverityClass', () => {
    it('should return severity-high for values >= 0.8', () => {
      expect(renderer.getSeverityClass(0.8)).toBe('severity-high');
      expect(renderer.getSeverityClass(0.9)).toBe('severity-high');
      expect(renderer.getSeverityClass(1.0)).toBe('severity-high');
    });

    it('should return severity-medium for values >= 0.5 and < 0.8', () => {
      expect(renderer.getSeverityClass(0.5)).toBe('severity-medium');
      expect(renderer.getSeverityClass(0.7)).toBe('severity-medium');
      expect(renderer.getSeverityClass(0.79)).toBe('severity-medium');
    });

    it('should return severity-low for values < 0.5', () => {
      expect(renderer.getSeverityClass(0.0)).toBe('severity-low');
      expect(renderer.getSeverityClass(0.3)).toBe('severity-low');
      expect(renderer.getSeverityClass(0.49)).toBe('severity-low');
    });
  });

  describe('getRecommendationTypeClass', () => {
    it('should return correct class for known types', () => {
      expect(renderer.getRecommendationTypeClass('consider_new_axis')).toBe('rec-type-axis');
      expect(renderer.getRecommendationTypeClass('refine_bundle')).toBe('rec-type-refine');
      expect(renderer.getRecommendationTypeClass('investigate')).toBe('rec-type-investigate');
      expect(renderer.getRecommendationTypeClass('simplify')).toBe('rec-type-simplify');
    });

    it('should return default class for unknown types', () => {
      expect(renderer.getRecommendationTypeClass('unknown')).toBe('rec-type-info');
    });
  });

  describe('formatMetric', () => {
    it('should format valid numbers to 3 decimal places', () => {
      expect(renderer.formatMetric(0.12345)).toBe('0.123');
      expect(renderer.formatMetric(1.0)).toBe('1.000');
      expect(renderer.formatMetric(0.5)).toBe('0.500');
    });

    it('should return N/A for null', () => {
      expect(renderer.formatMetric(null)).toBe('N/A');
    });

    it('should return N/A for undefined', () => {
      expect(renderer.formatMetric(undefined)).toBe('N/A');
    });

    it('should return N/A for NaN', () => {
      expect(renderer.formatMetric(NaN)).toBe('N/A');
    });

    it('should return N/A for Infinity', () => {
      expect(renderer.formatMetric(Infinity)).toBe('N/A');
      expect(renderer.formatMetric(-Infinity)).toBe('N/A');
    });
  });

  describe('static constants', () => {
    it('should have TYPE_LABELS for v1 and v2 types', () => {
      expect(MetadataRenderer.TYPE_LABELS.structurally_redundant).toBe('Structurally Redundant');
      expect(MetadataRenderer.TYPE_LABELS.prototype_merge_suggestion).toBe('Merge Suggestion');
    });

    it('should have TYPE_SUMMARIES for v1 and v2 types', () => {
      expect(MetadataRenderer.TYPE_SUMMARIES.prototype_merge_suggestion).toContain('nearly identically');
      expect(MetadataRenderer.TYPE_SUMMARIES.structurally_redundant).toContain('structural overlap');
    });

    it('should have RECOMMENDATION_TYPE_CLASSES', () => {
      expect(MetadataRenderer.RECOMMENDATION_TYPE_CLASSES.consider_new_axis).toBe('rec-type-axis');
    });
  });

  describe('edge cases', () => {
    it('should handle empty divergence examples array', () => {
      const elements = createMockElements();
      const recommendation = {
        prototypes: { a: 'a', b: 'b' },
        severity: 0.5,
        type: 'high_overlap',
        evidence: { divergenceExamples: [] },
      };

      renderer.renderRecommendationCard(recommendation, 0, elements);

      const card = elements.recommendationsContainer.querySelector('article');
      expect(card.innerHTML).not.toContain('Divergence Examples');
    });

    it('should handle missing intensityDifference in divergence examples', () => {
      const elements = createMockElements();
      const recommendation = {
        prototypes: { a: 'a', b: 'b' },
        severity: 0.5,
        type: 'high_overlap',
        evidence: {
          divergenceExamples: [{ contextSummary: 'Test context' }],
        },
      };

      renderer.renderRecommendationCard(recommendation, 0, elements);

      const card = elements.recommendationsContainer.querySelector('article');
      expect(card.innerHTML).toContain('N/A');
      expect(card.innerHTML).toContain('Test context');
    });

    it('should handle empty additional evidence array', () => {
      const elements = createMockElements();
      const recommendation = {
        prototypes: { a: 'a', b: 'b' },
        severity: 0.5,
        type: 'high_overlap',
        allMatchingClassifications: [],
      };

      renderer.renderRecommendationCard(recommendation, 0, elements);

      const card = elements.recommendationsContainer.querySelector('article');
      expect(card.innerHTML).not.toContain('Additional Evidence');
    });

    it('should filter out primary matches from additional evidence', () => {
      const elements = createMockElements();
      const recommendation = {
        prototypes: { a: 'a', b: 'b' },
        severity: 0.5,
        type: 'high_overlap',
        allMatchingClassifications: [
          { isPrimary: true, type: 'high_overlap', confidence: 0.9 },
        ],
      };

      renderer.renderRecommendationCard(recommendation, 0, elements);

      const card = elements.recommendationsContainer.querySelector('article');
      expect(card.innerHTML).not.toContain('Additional Evidence');
    });

    it('should handle summary insight without closest pair', () => {
      const elements = createMockElements();
      const metadata = {
        ...createBaseMetadata(),
        summaryInsight: {
          status: 'ok',
          message: 'All prototypes are sufficiently distinct',
        },
      };

      renderer.renderMetadata(metadata, elements);

      expect(elements.resultsMetadata.innerHTML).toContain('status-ok');
      expect(elements.resultsMetadata.innerHTML).toContain('All prototypes are sufficiently distinct');
      expect(elements.resultsMetadata.innerHTML).not.toContain('Closest pair');
    });
  });
});
