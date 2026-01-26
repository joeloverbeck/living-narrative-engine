/**
 * @file Unit tests for DecisionSummaryRenderer
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import DecisionSummaryRenderer from '../../../../../src/domUI/prototype-analysis/renderers/DecisionSummaryRenderer.js';

describe('DecisionSummaryRenderer', () => {
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
      decisionVerdict: document.createElement('span'),
      decisionRationale: document.createElement('p'),
      varianceTop4: document.createElement('span'),
      varianceAxisCount: document.createElement('span'),
      varianceTopK: document.createElement('span'),
    };
  }

  function createFullAxisGapAnalysis() {
    return {
      pcaAnalysis: {
        residualVarianceRatio: 0.18,
        explainedVariance: [0.4, 0.25, 0.15, 0.1, 0.05],
        axisCount: 4,
      },
      summary: {
        signalBreakdown: {
          pcaSignals: 1,
          hubSignals: 2,
          coverageGapSignals: 1,
          multiAxisConflictSignals: 0,
        },
      },
    };
  }

  beforeEach(() => {
    mockLogger = createMockLogger();
    renderer = new DecisionSummaryRenderer({ logger: mockLogger });
  });

  describe('constructor', () => {
    it('should initialize with valid logger', () => {
      expect(renderer).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith('[DecisionSummaryRenderer] Initialized.');
    });

    it('should throw if logger is missing', () => {
      expect(() => new DecisionSummaryRenderer({})).toThrow();
    });

    it('should throw if logger is invalid', () => {
      expect(() => new DecisionSummaryRenderer({ logger: {} })).toThrow();
    });
  });

  describe('render', () => {
    it('should return early if axisGapAnalysis is null', () => {
      const elements = createMockElements();
      renderer.render(null, elements);
      expect(elements.decisionVerdict.textContent).toBe('');
    });

    it('should return early if axisGapAnalysis is undefined', () => {
      const elements = createMockElements();
      renderer.render(undefined, elements);
      expect(elements.decisionVerdict.textContent).toBe('');
    });

    it('should return early if decisionVerdict element is missing', () => {
      const elements = createMockElements();
      elements.decisionVerdict = null;
      renderer.render(createFullAxisGapAnalysis(), elements);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[DecisionSummaryRenderer] Missing required decision elements.'
      );
    });

    it('should return early if decisionRationale element is missing', () => {
      const elements = createMockElements();
      elements.decisionRationale = null;
      renderer.render(createFullAxisGapAnalysis(), elements);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[DecisionSummaryRenderer] Missing required decision elements.'
      );
    });

    it('should render complete decision with full analysis data', () => {
      const elements = createMockElements();
      renderer.render(createFullAxisGapAnalysis(), elements);

      expect(elements.decisionVerdict.textContent).toBeTruthy();
      expect(elements.decisionRationale.textContent).toBeTruthy();
    });
  });

  describe('YES verdict - high residual + coverage gaps', () => {
    it('should render YES when high residual and coverage gaps exist', () => {
      const elements = createMockElements();
      const analysis = {
        pcaAnalysis: { residualVarianceRatio: 0.20 },
        summary: {
          signalBreakdown: {
            pcaSignals: 0,
            hubSignals: 0,
            coverageGapSignals: 2,
            multiAxisConflictSignals: 0,
          },
        },
      };

      renderer.render(analysis, elements);

      expect(elements.decisionVerdict.textContent).toBe('YES');
      expect(elements.decisionVerdict.classList.contains('verdict-yes')).toBe(true);
      expect(elements.decisionRationale.textContent).toContain('High residual variance');
      expect(elements.decisionRationale.textContent).toContain('coverage gaps');
    });

    it('should mention specific coverage gap count in rationale', () => {
      const elements = createMockElements();
      const analysis = {
        pcaAnalysis: { residualVarianceRatio: 0.18 },
        summary: {
          signalBreakdown: {
            pcaSignals: 0,
            hubSignals: 0,
            coverageGapSignals: 3,
            multiAxisConflictSignals: 0,
          },
        },
      };

      renderer.render(analysis, elements);

      expect(elements.decisionRationale.textContent).toContain('3 coverage gaps');
    });

    it('should use singular form for single coverage gap', () => {
      const elements = createMockElements();
      const analysis = {
        pcaAnalysis: { residualVarianceRatio: 0.16 },
        summary: {
          signalBreakdown: {
            pcaSignals: 0,
            hubSignals: 0,
            coverageGapSignals: 1,
            multiAxisConflictSignals: 0,
          },
        },
      };

      renderer.render(analysis, elements);

      expect(elements.decisionRationale.textContent).toContain('1 coverage gap');
      expect(elements.decisionRationale.textContent).not.toContain('1 coverage gaps');
    });
  });

  describe('YES verdict - hubs + multi-axis conflicts', () => {
    it('should render YES when hubs and multi-axis conflicts exist', () => {
      const elements = createMockElements();
      const analysis = {
        pcaAnalysis: { residualVarianceRatio: 0.10 },
        summary: {
          signalBreakdown: {
            pcaSignals: 0,
            hubSignals: 2,
            coverageGapSignals: 0,
            multiAxisConflictSignals: 3,
          },
        },
      };

      renderer.render(analysis, elements);

      expect(elements.decisionVerdict.textContent).toBe('YES');
      expect(elements.decisionRationale.textContent).toContain('hub prototype');
      expect(elements.decisionRationale.textContent).toContain('multi-axis conflict');
    });

    it('should use plural forms appropriately', () => {
      const elements = createMockElements();
      const analysis = {
        pcaAnalysis: { residualVarianceRatio: 0.08 },
        summary: {
          signalBreakdown: {
            pcaSignals: 0,
            hubSignals: 3,
            coverageGapSignals: 0,
            multiAxisConflictSignals: 2,
          },
        },
      };

      renderer.render(analysis, elements);

      expect(elements.decisionRationale.textContent).toContain('3 hub prototypes');
      expect(elements.decisionRationale.textContent).toContain('2 multi-axis conflicts');
    });

    it('should use singular forms for single counts', () => {
      const elements = createMockElements();
      const analysis = {
        pcaAnalysis: { residualVarianceRatio: 0.05 },
        summary: {
          signalBreakdown: {
            pcaSignals: 0,
            hubSignals: 1,
            coverageGapSignals: 0,
            multiAxisConflictSignals: 1,
          },
        },
      };

      renderer.render(analysis, elements);

      expect(elements.decisionRationale.textContent).toContain('1 hub prototype');
      expect(elements.decisionRationale.textContent).not.toContain('1 hub prototypes');
    });
  });

  describe('MAYBE verdict - high residual only', () => {
    it('should render MAYBE when only high residual exists', () => {
      const elements = createMockElements();
      const analysis = {
        pcaAnalysis: { residualVarianceRatio: 0.18 },
        summary: {
          signalBreakdown: {
            pcaSignals: 0,
            hubSignals: 0,
            coverageGapSignals: 0,
            multiAxisConflictSignals: 0,
          },
        },
      };

      renderer.render(analysis, elements);

      expect(elements.decisionVerdict.textContent).toBe('MAYBE');
      expect(elements.decisionVerdict.classList.contains('verdict-maybe')).toBe(true);
      expect(elements.decisionRationale.textContent).toContain('exceeds 15% threshold');
      expect(elements.decisionRationale.textContent).toContain('no strong secondary signals');
    });

    it('should include residual percentage in rationale', () => {
      const elements = createMockElements();
      const analysis = {
        pcaAnalysis: { residualVarianceRatio: 0.22 },
        summary: {
          signalBreakdown: {
            pcaSignals: 0,
            hubSignals: 0,
            coverageGapSignals: 0,
            multiAxisConflictSignals: 0,
          },
        },
      };

      renderer.render(analysis, elements);

      expect(elements.decisionRationale.textContent).toContain('22.0%');
    });
  });

  describe('MAYBE verdict - signals present with acceptable residual', () => {
    it('should render MAYBE when signals exist with low residual', () => {
      const elements = createMockElements();
      const analysis = {
        pcaAnalysis: { residualVarianceRatio: 0.10 },
        summary: {
          signalBreakdown: {
            pcaSignals: 2,
            hubSignals: 1,
            coverageGapSignals: 0,
            multiAxisConflictSignals: 0,
          },
        },
      };

      renderer.render(analysis, elements);

      expect(elements.decisionVerdict.textContent).toBe('MAYBE');
      expect(elements.decisionRationale.textContent).toContain('acceptable');
      expect(elements.decisionRationale.textContent).toContain('some signals detected');
    });

    it('should list all present signals in rationale', () => {
      const elements = createMockElements();
      // Note: Can't have both hubs AND multi-axis conflicts (triggers YES)
      // Using only PCA, coverage gaps, and hubs (no multi-axis conflicts)
      const analysis = {
        pcaAnalysis: { residualVarianceRatio: 0.08 },
        summary: {
          signalBreakdown: {
            pcaSignals: 1,
            hubSignals: 2,
            coverageGapSignals: 3,
            multiAxisConflictSignals: 0,
          },
        },
      };

      renderer.render(analysis, elements);

      expect(elements.decisionRationale.textContent).toContain('PCA signals');
      expect(elements.decisionRationale.textContent).toContain('2 hub prototype(s)');
      expect(elements.decisionRationale.textContent).toContain('3 coverage gap(s)');
    });

    it('should only include non-zero signals', () => {
      const elements = createMockElements();
      const analysis = {
        pcaAnalysis: { residualVarianceRatio: 0.08 },
        summary: {
          signalBreakdown: {
            pcaSignals: 0,
            hubSignals: 1,
            coverageGapSignals: 0,
            multiAxisConflictSignals: 0,
          },
        },
      };

      renderer.render(analysis, elements);

      expect(elements.decisionRationale.textContent).toContain('1 hub prototype(s)');
      expect(elements.decisionRationale.textContent).not.toContain('PCA signals');
      expect(elements.decisionRationale.textContent).not.toContain('coverage gap');
    });
  });

  describe('NO verdict', () => {
    it('should render NO when no signals and acceptable residual', () => {
      const elements = createMockElements();
      const analysis = {
        pcaAnalysis: { residualVarianceRatio: 0.08 },
        summary: {
          signalBreakdown: {
            pcaSignals: 0,
            hubSignals: 0,
            coverageGapSignals: 0,
            multiAxisConflictSignals: 0,
          },
        },
      };

      renderer.render(analysis, elements);

      expect(elements.decisionVerdict.textContent).toBe('NO');
      expect(elements.decisionVerdict.classList.contains('verdict-no')).toBe(true);
      expect(elements.decisionRationale.textContent).toContain('within acceptable range');
      expect(elements.decisionRationale.textContent).toContain('adequately captures');
    });

    it('should include residual percentage in NO rationale', () => {
      const elements = createMockElements();
      const analysis = {
        pcaAnalysis: { residualVarianceRatio: 0.05 },
        summary: {
          signalBreakdown: {
            pcaSignals: 0,
            hubSignals: 0,
            coverageGapSignals: 0,
            multiAxisConflictSignals: 0,
          },
        },
      };

      renderer.render(analysis, elements);

      expect(elements.decisionRationale.textContent).toContain('5.0%');
    });
  });

  describe('verdict CSS class management', () => {
    it('should remove previous verdict classes when updating', () => {
      const elements = createMockElements();
      elements.decisionVerdict.classList.add('verdict-yes');

      const analysis = {
        pcaAnalysis: { residualVarianceRatio: 0.05 },
        summary: {
          signalBreakdown: {
            pcaSignals: 0,
            hubSignals: 0,
            coverageGapSignals: 0,
            multiAxisConflictSignals: 0,
          },
        },
      };

      renderer.render(analysis, elements);

      expect(elements.decisionVerdict.classList.contains('verdict-yes')).toBe(false);
      expect(elements.decisionVerdict.classList.contains('verdict-no')).toBe(true);
    });

    it('should apply correct class for each verdict type', () => {
      const elements = createMockElements();

      // YES verdict
      renderer.render({
        pcaAnalysis: { residualVarianceRatio: 0.20 },
        summary: {
          signalBreakdown: { coverageGapSignals: 1 },
        },
      }, elements);
      expect(elements.decisionVerdict.classList.contains('verdict-yes')).toBe(true);

      // MAYBE verdict
      renderer.render({
        pcaAnalysis: { residualVarianceRatio: 0.16 },
        summary: {
          signalBreakdown: {},
        },
      }, elements);
      expect(elements.decisionVerdict.classList.contains('verdict-maybe')).toBe(true);
      expect(elements.decisionVerdict.classList.contains('verdict-yes')).toBe(false);
    });
  });

  describe('variance summary rendering', () => {
    it('should render top 4 variance sum', () => {
      const elements = createMockElements();
      const analysis = {
        pcaAnalysis: {
          residualVarianceRatio: 0.05,
          explainedVariance: [0.4, 0.25, 0.15, 0.1, 0.05],
          axisCount: 4,
        },
        summary: { signalBreakdown: {} },
      };

      renderer.render(analysis, elements);

      // 0.4 + 0.25 + 0.15 + 0.1 = 0.9 = 90%
      expect(elements.varianceTop4.textContent).toBe('90.0%');
    });

    it('should render axis count', () => {
      const elements = createMockElements();
      const analysis = {
        pcaAnalysis: {
          residualVarianceRatio: 0.05,
          explainedVariance: [0.4, 0.25, 0.15, 0.1],
          axisCount: 4,
        },
        summary: { signalBreakdown: {} },
      };

      renderer.render(analysis, elements);

      expect(elements.varianceAxisCount.textContent).toBe('4');
    });

    it('should render top K variance sum based on axis count', () => {
      const elements = createMockElements();
      const analysis = {
        pcaAnalysis: {
          residualVarianceRatio: 0.05,
          explainedVariance: [0.4, 0.25, 0.15, 0.1, 0.05],
          axisCount: 3,
        },
        summary: { signalBreakdown: {} },
      };

      renderer.render(analysis, elements);

      // Top 3: 0.4 + 0.25 + 0.15 = 0.8 = 80%
      expect(elements.varianceTopK.textContent).toBe('80.0%');
    });

    it('should display -- when no explained variance', () => {
      const elements = createMockElements();
      const analysis = {
        pcaAnalysis: {
          residualVarianceRatio: 0.05,
          explainedVariance: [],
          axisCount: 4,
        },
        summary: { signalBreakdown: {} },
      };

      renderer.render(analysis, elements);

      expect(elements.varianceTop4.textContent).toBe('--');
      expect(elements.varianceTopK.textContent).toBe('--');
    });

    it('should display -- when axis count is 0', () => {
      const elements = createMockElements();
      const analysis = {
        pcaAnalysis: {
          residualVarianceRatio: 0.05,
          explainedVariance: [0.4, 0.25],
          axisCount: 0,
        },
        summary: { signalBreakdown: {} },
      };

      renderer.render(analysis, elements);

      expect(elements.varianceAxisCount.textContent).toBe('--');
      expect(elements.varianceTopK.textContent).toBe('--');
    });

    it('should handle missing PCA analysis gracefully', () => {
      const elements = createMockElements();
      const analysis = {
        summary: { signalBreakdown: {} },
      };

      renderer.render(analysis, elements);

      expect(elements.varianceTop4.textContent).toBe('--');
      expect(elements.varianceAxisCount.textContent).toBe('--');
      expect(elements.varianceTopK.textContent).toBe('--');
    });

    it('should handle null variance elements gracefully', () => {
      const elements = createMockElements();
      elements.varianceTop4 = null;
      elements.varianceAxisCount = null;
      elements.varianceTopK = null;

      const analysis = {
        pcaAnalysis: {
          residualVarianceRatio: 0.05,
          explainedVariance: [0.4, 0.25, 0.15, 0.1],
          axisCount: 4,
        },
        summary: { signalBreakdown: {} },
      };

      expect(() => renderer.render(analysis, elements)).not.toThrow();
    });
  });

  describe('threshold constant', () => {
    it('should use 15% as high residual threshold', () => {
      expect(DecisionSummaryRenderer.HIGH_RESIDUAL_THRESHOLD).toBe(0.15);
    });

    it('should treat exactly 15% as high residual', () => {
      const elements = createMockElements();
      const analysis = {
        pcaAnalysis: { residualVarianceRatio: 0.15 },
        summary: { signalBreakdown: {} },
      };

      renderer.render(analysis, elements);

      expect(elements.decisionVerdict.textContent).toBe('MAYBE');
      expect(elements.decisionRationale.textContent).toContain('exceeds 15% threshold');
    });

    it('should not treat 14.9% as high residual', () => {
      const elements = createMockElements();
      const analysis = {
        pcaAnalysis: { residualVarianceRatio: 0.149 },
        summary: { signalBreakdown: {} },
      };

      renderer.render(analysis, elements);

      expect(elements.decisionVerdict.textContent).toBe('NO');
    });
  });

  describe('edge cases', () => {
    it('should handle missing signal breakdown', () => {
      const elements = createMockElements();
      const analysis = {
        pcaAnalysis: { residualVarianceRatio: 0.05 },
        summary: {},
      };

      renderer.render(analysis, elements);

      expect(elements.decisionVerdict.textContent).toBe('NO');
    });

    it('should handle missing summary', () => {
      const elements = createMockElements();
      const analysis = {
        pcaAnalysis: { residualVarianceRatio: 0.05 },
      };

      renderer.render(analysis, elements);

      expect(elements.decisionVerdict.textContent).toBe('NO');
    });

    it('should handle empty pcaAnalysis', () => {
      const elements = createMockElements();
      const analysis = {
        pcaAnalysis: {},
        summary: { signalBreakdown: {} },
      };

      renderer.render(analysis, elements);

      expect(elements.decisionVerdict.textContent).toBe('NO');
      expect(elements.decisionRationale.textContent).toContain('0.0%');
    });

    it('should handle fewer than 4 components for top4 variance', () => {
      const elements = createMockElements();
      const analysis = {
        pcaAnalysis: {
          residualVarianceRatio: 0.05,
          explainedVariance: [0.5, 0.3],
          axisCount: 2,
        },
        summary: { signalBreakdown: {} },
      };

      renderer.render(analysis, elements);

      // Only 2 components: 0.5 + 0.3 = 0.8 = 80%
      expect(elements.varianceTop4.textContent).toBe('80.0%');
    });
  });
});
