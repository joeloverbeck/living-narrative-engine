/**
 * @file Unit tests for AxisGapRenderer
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AxisGapRenderer from '../../../../../src/domUI/prototype-analysis/renderers/AxisGapRenderer.js';

describe('AxisGapRenderer', () => {
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
      axisGapTotalPrototypes: document.createElement('span'),
      axisGapRecommendations: document.createElement('span'),
      axisGapConfidence: document.createElement('span'),
      signalPca: document.createElement('span'),
      signalHubs: document.createElement('span'),
      signalCoverageGaps: document.createElement('span'),
      signalMultiAxisConflicts: document.createElement('span'),
      signalPcaStatus: document.createElement('span'),
      signalHubsStatus: document.createElement('span'),
      signalCoverageGapsStatus: document.createElement('span'),
      signalMultiAxisConflictsStatus: document.createElement('span'),
      signalPcaThreshold: document.createElement('span'),
      signalCoverageGapsThreshold: document.createElement('span'),
      hubList: document.createElement('ul'),
      coverageGapList: document.createElement('ul'),
      conflictList: document.createElement('ul'),
      signTensionList: document.createElement('ul'),
      polarityAnalysisList: document.createElement('ul'),
      corroborationStatusNote: document.createElement('div'),
      confidenceExplanation: document.createElement('p'),
      signalConfidenceLink: document.createElement('p'),
    };
  }

  beforeEach(() => {
    mockLogger = createMockLogger();
    renderer = new AxisGapRenderer({ logger: mockLogger });
  });

  describe('constructor', () => {
    it('should initialize with valid logger', () => {
      expect(renderer).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith('[AxisGapRenderer] Initialized.');
    });

    it('should throw if logger is missing', () => {
      expect(() => new AxisGapRenderer({})).toThrow();
    });

    it('should throw if logger is invalid', () => {
      expect(() => new AxisGapRenderer({ logger: {} })).toThrow();
    });
  });

  describe('renderSummary', () => {
    it('should return early if summary is null', () => {
      const elements = createMockElements();
      renderer.renderSummary(null, elements);
      expect(elements.axisGapTotalPrototypes.textContent).toBe('');
    });

    it('should render all summary statistics', () => {
      const elements = createMockElements();
      const summary = {
        totalPrototypesAnalyzed: 25,
        recommendationCount: 3,
        confidence: 'HIGH',
      };

      renderer.renderSummary(summary, elements);

      expect(elements.axisGapTotalPrototypes.textContent).toBe('25');
      expect(elements.axisGapRecommendations.textContent).toBe('3');
      expect(elements.axisGapConfidence.textContent).toBe('HIGH');
      expect(elements.axisGapConfidence.classList.contains('confidence-high')).toBe(true);
    });

    it('should use potentialGapsDetected as fallback for recommendationCount', () => {
      const elements = createMockElements();
      const summary = {
        totalPrototypesAnalyzed: 10,
        potentialGapsDetected: 2,
      };

      renderer.renderSummary(summary, elements);

      expect(elements.axisGapRecommendations.textContent).toBe('2');
    });

    it('should display -- when values are undefined', () => {
      const elements = createMockElements();
      renderer.renderSummary({}, elements);

      expect(elements.axisGapTotalPrototypes.textContent).toBe('--');
      expect(elements.axisGapRecommendations.textContent).toBe('--');
      expect(elements.axisGapConfidence.textContent).toBe('--');
    });

    it('should render signal breakdown when available', () => {
      const elements = createMockElements();
      const summary = {
        signalBreakdown: {
          pcaSignals: 2,
          hubSignals: 1,
          coverageGapSignals: 0,
          multiAxisConflictSignals: 3,
        },
      };

      renderer.renderSummary(summary, elements);

      expect(elements.signalPca.textContent).toBe('2');
      expect(elements.signalHubs.textContent).toBe('1');
      expect(elements.signalCoverageGaps.textContent).toBe('0');
      expect(elements.signalMultiAxisConflicts.textContent).toBe('3');
    });

    it('should update signal status indicators', () => {
      const elements = createMockElements();
      const summary = {
        signalBreakdown: {
          pcaSignals: 1,
          hubSignals: 0,
          coverageGapSignals: 2,
          multiAxisConflictSignals: 0,
        },
      };

      renderer.renderSummary(summary, elements);

      expect(elements.signalPcaStatus.textContent).toBe('✗ FAIL');
      expect(elements.signalPcaStatus.classList.contains('fail')).toBe(true);
      expect(elements.signalHubsStatus.textContent).toBe('✓ PASS');
      expect(elements.signalHubsStatus.classList.contains('pass')).toBe(true);
    });
  });

  describe('updatePcaThresholdDisplay', () => {
    it('should return early if element is null', () => {
      const elements = createMockElements();
      elements.signalPcaThreshold = null;
      expect(() => renderer.updatePcaThresholdDisplay({}, elements)).not.toThrow();
    });

    it('should show OR logic when both conditions trigger', () => {
      const elements = createMockElements();
      renderer.updatePcaThresholdDisplay(
        { residualVarianceRatio: 0.2, additionalSignificantComponents: 1 },
        elements
      );
      expect(elements.signalPcaThreshold.textContent).toContain('OR');
    });

    it('should show residual triggered when only high residual', () => {
      const elements = createMockElements();
      renderer.updatePcaThresholdDisplay(
        { residualVarianceRatio: 0.18, additionalSignificantComponents: 0 },
        elements
      );
      expect(elements.signalPcaThreshold.textContent).toContain('triggered');
    });

    it('should show components triggered when only extra components', () => {
      const elements = createMockElements();
      renderer.updatePcaThresholdDisplay(
        { residualVarianceRatio: 0.1, additionalSignificantComponents: 2 },
        elements
      );
      expect(elements.signalPcaThreshold.textContent).toContain('components >0');
    });

    it('should show pass message when neither condition triggers', () => {
      const elements = createMockElements();
      renderer.updatePcaThresholdDisplay(
        { residualVarianceRatio: 0.05, additionalSignificantComponents: 0 },
        elements
      );
      expect(elements.signalPcaThreshold.textContent).toContain('AND no extra components');
    });
  });

  describe('updateCoverageGapThresholdDisplay', () => {
    it('should display adaptive threshold message', () => {
      const elements = createMockElements();
      renderer.updateCoverageGapThresholdDisplay(elements);
      expect(elements.signalCoverageGapsThreshold.textContent).toBe('(adaptive threshold)');
    });

    it('should handle null element gracefully', () => {
      const elements = createMockElements();
      elements.signalCoverageGapsThreshold = null;
      expect(() => renderer.updateCoverageGapThresholdDisplay(elements)).not.toThrow();
    });
  });

  describe('renderHubPrototypes', () => {
    it('should handle null list element', () => {
      const elements = createMockElements();
      elements.hubList = null;
      expect(() => renderer.renderHubPrototypes([], elements)).not.toThrow();
    });

    it('should show empty message when no hubs', () => {
      const elements = createMockElements();
      renderer.renderHubPrototypes([], elements);
      expect(elements.hubList.innerHTML).toContain('No hub prototypes detected');
    });

    it('should render hub prototype items', () => {
      const elements = createMockElements();
      const hubs = [
        { prototypeId: 'hub:test', hubScore: 0.85, connectedClusters: 3, spanningAxes: 2 },
      ];

      renderer.renderHubPrototypes(hubs, elements);

      expect(elements.hubList.innerHTML).toContain('hub:test');
      expect(elements.hubList.innerHTML).toContain('0.850');
      expect(elements.hubList.innerHTML).toContain('connects 3 clusters');
    });

    it('should use fallback fields when primary fields missing', () => {
      const elements = createMockElements();
      const hubs = [{ id: 'fallback:id', score: 0.5, axisCount: 1 }];

      renderer.renderHubPrototypes(hubs, elements);

      expect(elements.hubList.innerHTML).toContain('fallback:id');
      expect(elements.hubList.innerHTML).toContain('0.500');
    });

    it('should escape HTML in prototype IDs', () => {
      const elements = createMockElements();
      const hubs = [{ prototypeId: '<script>alert(1)</script>', hubScore: 0.5 }];

      renderer.renderHubPrototypes(hubs, elements);

      expect(elements.hubList.innerHTML).not.toContain('<script>');
    });
  });

  describe('renderCoverageGaps', () => {
    it('should handle null list element', () => {
      const elements = createMockElements();
      elements.coverageGapList = null;
      expect(() => renderer.renderCoverageGaps([], elements)).not.toThrow();
    });

    it('should show empty message when no gaps', () => {
      const elements = createMockElements();
      renderer.renderCoverageGaps([], elements);
      expect(elements.coverageGapList.innerHTML).toContain('No coverage gaps detected');
    });

    it('should render coverage gap items', () => {
      const elements = createMockElements();
      const gaps = [
        { clusterLabel: 'High-Arousal Cluster', distanceFromAxes: 0.72, prototypeCount: 3 },
      ];

      renderer.renderCoverageGaps(gaps, elements);

      expect(elements.coverageGapList.innerHTML).toContain('High-Arousal Cluster');
      expect(elements.coverageGapList.innerHTML).toContain('0.720');
      expect(elements.coverageGapList.innerHTML).toContain('3 prototypes');
    });

    it('should use fallback fields when primary fields missing', () => {
      const elements = createMockElements();
      const gaps = [{ label: 'Fallback Gap', distance: 0.5 }];

      renderer.renderCoverageGaps(gaps, elements);

      expect(elements.coverageGapList.innerHTML).toContain('Fallback Gap');
    });

    it('should handle zero prototype count', () => {
      const elements = createMockElements();
      const gaps = [{ clusterLabel: 'Empty Gap', distanceFromAxes: 0.6, prototypeCount: 0 }];

      renderer.renderCoverageGaps(gaps, elements);

      expect(elements.coverageGapList.innerHTML).toContain('uncovered region detected');
    });
  });

  describe('renderMultiAxisConflicts', () => {
    it('should handle null list element', () => {
      const elements = createMockElements();
      elements.conflictList = null;
      expect(() => renderer.renderMultiAxisConflicts([], elements)).not.toThrow();
    });

    it('should show empty message when no conflicts', () => {
      const elements = createMockElements();
      renderer.renderMultiAxisConflicts([], elements);
      expect(elements.conflictList.innerHTML).toContain('No multi-axis conflicts detected');
    });

    it('should render conflict items', () => {
      const elements = createMockElements();
      const conflicts = [
        {
          prototypeId: 'conflict:test',
          activeAxisCount: 4,
          signBalance: 0.8,
          conflictingAxes: ['valence', 'arousal'],
        },
      ];

      renderer.renderMultiAxisConflicts(conflicts, elements);

      expect(elements.conflictList.innerHTML).toContain('conflict:test');
      expect(elements.conflictList.innerHTML).toContain('4');
      expect(elements.conflictList.innerHTML).toContain('valence');
      expect(elements.conflictList.innerHTML).toContain('arousal');
    });

    it('should display same-sign weighted for high sign balance', () => {
      const elements = createMockElements();
      const conflicts = [{ prototypeId: 'test', activeAxisCount: 3, signBalance: 0.85 }];

      renderer.renderMultiAxisConflicts(conflicts, elements);

      expect(elements.conflictList.innerHTML).toContain('same-sign weighted');
    });

    it('should display mixed signs for low sign balance', () => {
      const elements = createMockElements();
      const conflicts = [{ prototypeId: 'test', activeAxisCount: 3, signBalance: 0.2 }];

      renderer.renderMultiAxisConflicts(conflicts, elements);

      expect(elements.conflictList.innerHTML).toContain('evenly mixed signs');
    });
  });

  describe('renderSignTensions', () => {
    it('should handle null list element', () => {
      const elements = createMockElements();
      elements.signTensionList = null;
      expect(() => renderer.renderSignTensions([], elements)).not.toThrow();
    });

    it('should show empty message when no tensions', () => {
      const elements = createMockElements();
      renderer.renderSignTensions([], elements);
      expect(elements.signTensionList.innerHTML).toContain('No sign tensions detected');
    });

    it('should render sign tension items', () => {
      const elements = createMockElements();
      const tensions = [
        {
          prototypeId: 'tension:test',
          activeAxisCount: 5,
          signBalance: 0.3,
          highMagnitudePositive: ['valence', 'dominance'],
          highMagnitudeNegative: ['arousal'],
        },
      ];

      renderer.renderSignTensions(tensions, elements);

      expect(elements.signTensionList.innerHTML).toContain('tension:test');
      expect(elements.signTensionList.innerHTML).toContain('5 active axes');
      expect(elements.signTensionList.innerHTML).toContain('valence');
      expect(elements.signTensionList.innerHTML).toContain('Informational');
    });

    it('should show sign diversity percentage', () => {
      const elements = createMockElements();
      const tensions = [{ prototypeId: 'test', signBalance: 0.4 }];

      renderer.renderSignTensions(tensions, elements);

      expect(elements.signTensionList.innerHTML).toContain('60% sign diversity');
    });

    it('should use fallback fields for axes', () => {
      const elements = createMockElements();
      const tensions = [
        {
          id: 'fallback',
          positiveAxes: ['axis1'],
          negativeAxes: ['axis2'],
        },
      ];

      renderer.renderSignTensions(tensions, elements);

      expect(elements.signTensionList.innerHTML).toContain('fallback');
      expect(elements.signTensionList.innerHTML).toContain('axis1');
    });
  });

  describe('renderPolarityAnalysis', () => {
    it('should handle null list element', () => {
      const elements = createMockElements();
      elements.polarityAnalysisList = null;
      expect(() => renderer.renderPolarityAnalysis({}, elements)).not.toThrow();
    });

    it('should show empty message when no imbalances', () => {
      const elements = createMockElements();
      renderer.renderPolarityAnalysis({ imbalancedCount: 0 }, elements);
      expect(elements.polarityAnalysisList.innerHTML).toContain('No axis polarity imbalances');
    });

    it('should show empty message when imbalancedAxes is empty', () => {
      const elements = createMockElements();
      renderer.renderPolarityAnalysis({ imbalancedCount: 1, imbalancedAxes: [] }, elements);
      expect(elements.polarityAnalysisList.innerHTML).toContain('No axis polarity imbalances');
    });

    it('should render polarity analysis items', () => {
      const elements = createMockElements();
      const polarity = {
        imbalancedCount: 1,
        imbalancedAxes: [
          { axis: 'valence', direction: 'positive', ratio: 0.85, dominant: 8, minority: 2 },
        ],
      };

      renderer.renderPolarityAnalysis(polarity, elements);

      expect(elements.polarityAnalysisList.innerHTML).toContain('valence');
      expect(elements.polarityAnalysisList.innerHTML).toContain('85%');
      expect(elements.polarityAnalysisList.innerHTML).toContain('positive');
      expect(elements.polarityAnalysisList.innerHTML).toContain('8 prototypes');
      expect(elements.polarityAnalysisList.innerHTML).toContain('Actionable');
    });

    it('should render summary header with correct count', () => {
      const elements = createMockElements();
      const polarity = {
        imbalancedCount: 3,
        imbalancedAxes: [
          { axis: 'a1', direction: 'positive', ratio: 0.8 },
          { axis: 'a2', direction: 'negative', ratio: 0.7 },
          { axis: 'a3', direction: 'positive', ratio: 0.9 },
        ],
      };

      renderer.renderPolarityAnalysis(polarity, elements);

      expect(elements.polarityAnalysisList.innerHTML).toContain('3 imbalanced axes');
    });

    it('should handle singular axis count', () => {
      const elements = createMockElements();
      const polarity = {
        imbalancedCount: 1,
        imbalancedAxes: [{ axis: 'single', direction: 'positive', ratio: 0.9 }],
      };

      renderer.renderPolarityAnalysis(polarity, elements);

      expect(elements.polarityAnalysisList.innerHTML).toContain('1 imbalanced axis');
    });

    it('should render warnings when present', () => {
      const elements = createMockElements();
      const polarity = {
        imbalancedCount: 1,
        imbalancedAxes: [{ axis: 'test', direction: 'positive', ratio: 0.8 }],
        warnings: ['Low sample size', 'Consider more data'],
      };

      renderer.renderPolarityAnalysis(polarity, elements);

      expect(elements.polarityAnalysisList.innerHTML).toContain('Warnings');
      expect(elements.polarityAnalysisList.innerHTML).toContain('Low sample size');
      expect(elements.polarityAnalysisList.innerHTML).toContain('Consider more data');
    });

    it('should apply correct direction class', () => {
      const elements = createMockElements();
      const polarity = {
        imbalancedCount: 2,
        imbalancedAxes: [
          { axis: 'pos', direction: 'positive', ratio: 0.8 },
          { axis: 'neg', direction: 'negative', ratio: 0.7 },
        ],
      };

      renderer.renderPolarityAnalysis(polarity, elements);

      expect(elements.polarityAnalysisList.innerHTML).toContain('polarity-positive');
      expect(elements.polarityAnalysisList.innerHTML).toContain('polarity-negative');
    });

    it('should render Informational badge when all axes have expectedImbalance true', () => {
      const elements = createMockElements();
      const polarity = {
        imbalancedCount: 2,
        imbalancedAxes: [
          { axis: 'empathy', direction: 'positive', ratio: 0.9, dominant: 9, minority: 1, expectedImbalance: true },
          { axis: 'arousal', direction: 'positive', ratio: 0.85, dominant: 8, minority: 2, expectedImbalance: true },
        ],
      };

      renderer.renderPolarityAnalysis(polarity, elements);

      expect(elements.polarityAnalysisList.innerHTML).toContain('Informational');
      expect(elements.polarityAnalysisList.innerHTML).not.toContain('Actionable');
    });

    it('should render Actionable badge when any axis has expectedImbalance false', () => {
      const elements = createMockElements();
      const polarity = {
        imbalancedCount: 2,
        imbalancedAxes: [
          { axis: 'empathy', direction: 'positive', ratio: 0.9, dominant: 9, minority: 1, expectedImbalance: true },
          { axis: 'valence', direction: 'positive', ratio: 0.85, dominant: 8, minority: 2, expectedImbalance: false },
        ],
      };

      renderer.renderPolarityAnalysis(polarity, elements);

      expect(elements.polarityAnalysisList.innerHTML).toContain('Actionable');
    });

    it('should use "weights" not "values" in hint text', () => {
      const elements = createMockElements();
      const polarity = {
        imbalancedCount: 1,
        imbalancedAxes: [
          { axis: 'valence', direction: 'positive', ratio: 0.85, dominant: 8, minority: 2, expectedImbalance: false },
        ],
      };

      renderer.renderPolarityAnalysis(polarity, elements);

      expect(elements.polarityAnalysisList.innerHTML).toContain('weights');
      expect(elements.polarityAnalysisList.innerHTML).not.toMatch(/\bvalues\b/);
    });
  });

  describe('XSS prevention', () => {
    it('should escape HTML in hub prototype IDs', () => {
      const elements = createMockElements();
      renderer.renderHubPrototypes(
        [{ prototypeId: '<img src=x onerror=alert(1)>', hubScore: 0.5 }],
        elements
      );
      expect(elements.hubList.innerHTML).not.toContain('<img');
    });

    it('should escape HTML in coverage gap labels', () => {
      const elements = createMockElements();
      renderer.renderCoverageGaps(
        [{ clusterLabel: '<script>bad()</script>', distanceFromAxes: 0.5 }],
        elements
      );
      expect(elements.coverageGapList.innerHTML).not.toContain('<script>');
    });

    it('should escape HTML in conflict prototype IDs', () => {
      const elements = createMockElements();
      renderer.renderMultiAxisConflicts(
        [{ prototypeId: '<div onclick="bad()">click</div>', activeAxisCount: 2 }],
        elements
      );
      const divs = elements.conflictList.querySelectorAll('div[onclick]');
      expect(divs.length).toBe(0);
    });

    it('should escape HTML in conflicting axes', () => {
      const elements = createMockElements();
      renderer.renderMultiAxisConflicts(
        [{ prototypeId: 'test', activeAxisCount: 1, conflictingAxes: ['<b>bold</b>'] }],
        elements
      );
      expect(elements.conflictList.innerHTML).not.toContain('<b>');
    });

    it('should escape HTML in polarity warnings', () => {
      const elements = createMockElements();
      renderer.renderPolarityAnalysis(
        {
          imbalancedCount: 1,
          imbalancedAxes: [{ axis: 'test', direction: 'positive', ratio: 0.8 }],
          warnings: ['<script>alert(1)</script>'],
        },
        elements
      );
      expect(elements.polarityAnalysisList.innerHTML).not.toContain('<script>');
    });

    it('should escape HTML in axis names', () => {
      const elements = createMockElements();
      renderer.renderPolarityAnalysis(
        {
          imbalancedCount: 1,
          imbalancedAxes: [{ axis: '<em>evil</em>', direction: 'positive', ratio: 0.8 }],
        },
        elements
      );
      expect(elements.polarityAnalysisList.innerHTML).not.toContain('<em>');
    });
  });

  describe('null element handling', () => {
    it('should handle null axisGapTotalPrototypes element', () => {
      const elements = createMockElements();
      elements.axisGapTotalPrototypes = null;
      expect(() => renderer.renderSummary({ totalPrototypesAnalyzed: 10 }, elements)).not.toThrow();
    });

    it('should handle null signalPca element', () => {
      const elements = createMockElements();
      elements.signalPca = null;
      expect(() =>
        renderer.renderSummary({ signalBreakdown: { pcaSignals: 1 } }, elements)
      ).not.toThrow();
    });

    it('should handle null signalPcaStatus element', () => {
      const elements = createMockElements();
      elements.signalPcaStatus = null;
      expect(() =>
        renderer.renderSummary({ signalBreakdown: { pcaSignals: 1 } }, elements)
      ).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle non-array hubPrototypes', () => {
      const elements = createMockElements();
      renderer.renderHubPrototypes('not an array', elements);
      expect(elements.hubList.innerHTML).toContain('No hub prototypes detected');
    });

    it('should handle non-array coverageGaps', () => {
      const elements = createMockElements();
      renderer.renderCoverageGaps(null, elements);
      expect(elements.coverageGapList.innerHTML).toContain('No coverage gaps detected');
    });

    it('should handle non-array conflicts', () => {
      const elements = createMockElements();
      renderer.renderMultiAxisConflicts({}, elements);
      expect(elements.conflictList.innerHTML).toContain('No multi-axis conflicts detected');
    });

    it('should handle non-array signTensions', () => {
      const elements = createMockElements();
      renderer.renderSignTensions(undefined, elements);
      expect(elements.signTensionList.innerHTML).toContain('No sign tensions detected');
    });

    it('should handle undefined polarityAnalysis', () => {
      const elements = createMockElements();
      renderer.renderPolarityAnalysis(undefined, elements);
      expect(elements.polarityAnalysisList.innerHTML).toContain('No axis polarity imbalances');
    });

    it('should handle NaN metric values', () => {
      const elements = createMockElements();
      renderer.renderHubPrototypes([{ prototypeId: 'test', hubScore: NaN }], elements);
      expect(elements.hubList.innerHTML).toContain('--');
    });
  });

  describe('renderCorroborationStatus', () => {
    it('should render ON status when corroboration is enabled', () => {
      const elements = createMockElements();
      renderer.renderCorroborationStatus(true, elements);
      expect(elements.corroborationStatusNote.textContent).toContain(
        'Corroboration mode: ON'
      );
      expect(elements.corroborationStatusNote.textContent).toContain(
        'hub/gap/conflict corroboration'
      );
      const note = elements.corroborationStatusNote.querySelector('.corroboration-status-note');
      expect(note.classList.contains('corroboration-on')).toBe(true);
    });

    it('should render OFF status when corroboration is disabled', () => {
      const elements = createMockElements();
      renderer.renderCorroborationStatus(false, elements);
      expect(elements.corroborationStatusNote.textContent).toContain(
        'Corroboration mode: OFF'
      );
      expect(elements.corroborationStatusNote.textContent).toContain(
        'contribute independently'
      );
      const note = elements.corroborationStatusNote.querySelector('.corroboration-status-note');
      expect(note.classList.contains('corroboration-off')).toBe(true);
    });

    it('should handle null container element gracefully', () => {
      const elements = createMockElements();
      elements.corroborationStatusNote = null;
      expect(() => renderer.renderCorroborationStatus(true, elements)).not.toThrow();
    });

    it('should clear previous content before rendering', () => {
      const elements = createMockElements();
      elements.corroborationStatusNote.innerHTML = '<p>Old content</p>';
      renderer.renderCorroborationStatus(true, elements);
      expect(elements.corroborationStatusNote.innerHTML).not.toContain('Old content');
      expect(elements.corroborationStatusNote.textContent).toContain('Corroboration mode: ON');
    });
  });

  describe('renderConfidenceExplanation', () => {
    it('should render non-boosted confidence with triggered method names', () => {
      const elements = createMockElements();
      const summary = {
        confidence: 'medium',
        methodsTriggered: ['pca', 'hubs'],
        confidenceBoosted: false,
      };

      renderer.renderConfidenceExplanation(summary, elements);

      expect(elements.confidenceExplanation.textContent).toContain('Confidence: Medium');
      expect(elements.confidenceExplanation.textContent).toContain('2 methods triggered');
      expect(elements.confidenceExplanation.textContent).toContain('PCA Analysis');
      expect(elements.confidenceExplanation.textContent).toContain('Hub Prototypes');
      expect(elements.confidenceExplanation.textContent).toContain('No boost applied');
    });

    it('should render boosted confidence with boost information', () => {
      const elements = createMockElements();
      const summary = {
        confidence: 'high',
        methodsTriggered: ['pca', 'hubs'],
        confidenceBoosted: true,
      };

      renderer.renderConfidenceExplanation(summary, elements);

      expect(elements.confidenceExplanation.textContent).toContain('Confidence: High');
      expect(elements.confidenceExplanation.textContent).toContain('boosted from');
      expect(elements.confidenceExplanation.textContent).toContain(
        '3+ method families flagged the same prototype'
      );
    });

    it('should render low confidence with zero methods', () => {
      const elements = createMockElements();
      const summary = {
        confidence: 'low',
        methodsTriggered: [],
        confidenceBoosted: false,
      };

      renderer.renderConfidenceExplanation(summary, elements);

      expect(elements.confidenceExplanation.textContent).toContain('Confidence: Low');
      expect(elements.confidenceExplanation.textContent).toContain('0 methods triggered');
      expect(elements.confidenceExplanation.textContent).toContain('No boost applied');
    });

    it('should populate signal-confidence link text', () => {
      const elements = createMockElements();
      const summary = {
        confidence: 'low',
        methodsTriggered: [],
        confidenceBoosted: false,
      };

      renderer.renderConfidenceExplanation(summary, elements);

      expect(elements.signalConfidenceLink.textContent).toContain(
        'signal statuses above determine the confidence level'
      );
    });

    it('should return early if summary is null', () => {
      const elements = createMockElements();
      renderer.renderConfidenceExplanation(null, elements);

      expect(elements.confidenceExplanation.textContent).toBe('');
    });

    it('should handle null confidenceExplanation element gracefully', () => {
      const elements = createMockElements();
      elements.confidenceExplanation = null;
      const summary = {
        confidence: 'low',
        methodsTriggered: [],
        confidenceBoosted: false,
      };

      expect(() => renderer.renderConfidenceExplanation(summary, elements)).not.toThrow();
    });
  });
});
