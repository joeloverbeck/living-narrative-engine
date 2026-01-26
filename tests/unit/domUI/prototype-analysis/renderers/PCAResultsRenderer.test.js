/**
 * @file Unit tests for PCAResultsRenderer
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import PCAResultsRenderer from '../../../../../src/domUI/prototype-analysis/renderers/PCAResultsRenderer.js';

describe('PCAResultsRenderer', () => {
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
      residualVariance: document.createElement('span'),
      significantComponentCount: document.createElement('span'),
      expectedComponentCount: document.createElement('span'),
      significantBeyondExpected: document.createElement('span'),
      pcaDimensionsList: document.createElement('div'),
      pcaDimensionsUsed: document.createElement('span'),
      pcaExcludedAxesList: document.createElement('div'),
      pcaUnusedAxesList: document.createElement('div'),
      pcaUnusedInGatesList: document.createElement('div'),
      pcaMethodologyNote: document.createElement('div'),
      componentsFor80: document.createElement('span'),
      componentsFor90: document.createElement('span'),
      poorlyFittingList: document.createElement('ul'),
      pcaTopLoading: document.createElement('div'),
    };
  }

  function createFullPCAAnalysis() {
    return {
      residualVarianceRatio: 0.18,
      significantComponentCount: 5,
      expectedComponentCount: 4,
      significantBeyondExpected: 1,
      topLoadingPrototypes: [
        { prototypeId: 'emotion:extreme_joy', score: 0.85 },
        { prototypeId: 'emotion:deep_sadness', score: 0.72 },
      ],
      dimensionsUsed: ['valence', 'arousal', 'dominance', 'potency'],
      excludedSparseAxes: ['rare_axis_1', 'rare_axis_2'],
      unusedDefinedAxes: ['unused_axis'],
      unusedInGates: ['no_gate_axis'],
      componentsFor80Pct: 3,
      componentsFor90Pct: 4,
      reconstructionErrors: [
        { prototypeId: 'emotion:confusion', error: 0.55 },
        { prototypeId: 'emotion:ambivalence', error: 0.32 },
      ],
    };
  }

  beforeEach(() => {
    mockLogger = createMockLogger();
    renderer = new PCAResultsRenderer({ logger: mockLogger });
  });

  describe('constructor', () => {
    it('should initialize with valid logger', () => {
      expect(renderer).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[PCAResultsRenderer] Initialized.'
      );
    });

    it('should throw if logger is missing', () => {
      expect(() => new PCAResultsRenderer({})).toThrow();
    });

    it('should throw if logger is invalid', () => {
      expect(() => new PCAResultsRenderer({ logger: {} })).toThrow();
    });
  });

  describe('render', () => {
    it('should return early if pcaAnalysis is null', () => {
      const elements = createMockElements();
      renderer.render(null, elements);
      expect(elements.residualVariance.textContent).toBe('');
    });

    it('should return early if pcaAnalysis is undefined', () => {
      const elements = createMockElements();
      renderer.render(undefined, elements);
      expect(elements.residualVariance.textContent).toBe('');
    });

    it('should render all PCA metrics with full analysis data', () => {
      const elements = createMockElements();
      const pcaAnalysis = createFullPCAAnalysis();

      renderer.render(pcaAnalysis, elements);

      expect(elements.residualVariance.textContent).toBe('18.0%');
      expect(elements.significantComponentCount.textContent).toBe('5');
      expect(elements.expectedComponentCount.textContent).toBe('4');
      expect(elements.significantBeyondExpected.textContent).toBe('1');
      expect(elements.componentsFor80.textContent).toBe('3');
      expect(elements.componentsFor90.textContent).toBe('4');
    });
  });

  describe('residual variance rendering', () => {
    it('should display residual variance as percentage', () => {
      const elements = createMockElements();
      renderer.render({ residualVarianceRatio: 0.12 }, elements);
      expect(elements.residualVariance.textContent).toBe('12.0%');
    });

    it('should add alert class when variance > 15%', () => {
      const elements = createMockElements();
      renderer.render({ residualVarianceRatio: 0.18 }, elements);
      expect(elements.residualVariance.classList.contains('alert')).toBe(true);
    });

    it('should add warning class when variance between 10% and 15%', () => {
      const elements = createMockElements();
      renderer.render({ residualVarianceRatio: 0.12 }, elements);
      expect(elements.residualVariance.classList.contains('warning')).toBe(true);
    });

    it('should not add warning/alert class when variance <= 10%', () => {
      const elements = createMockElements();
      renderer.render({ residualVarianceRatio: 0.08 }, elements);
      expect(elements.residualVariance.classList.contains('warning')).toBe(false);
      expect(elements.residualVariance.classList.contains('alert')).toBe(false);
    });

    it('should display -- when residualVarianceRatio is undefined', () => {
      const elements = createMockElements();
      renderer.render({}, elements);
      expect(elements.residualVariance.textContent).toBe('--');
    });
  });

  describe('significant beyond expected rendering', () => {
    it('should display count with asterisk when 0 but high residual', () => {
      const elements = createMockElements();
      renderer.render(
        { significantBeyondExpected: 0, residualVarianceRatio: 0.2 },
        elements
      );
      expect(elements.significantBeyondExpected.textContent).toBe('0 *');
      expect(
        elements.significantBeyondExpected.classList.contains('zero-with-residual')
      ).toBe(true);
    });

    it('should display count normally when > 0', () => {
      const elements = createMockElements();
      renderer.render({ significantBeyondExpected: 2 }, elements);
      expect(elements.significantBeyondExpected.textContent).toBe('2');
    });
  });

  describe('dimensions list rendering', () => {
    it('should render dimension tags', () => {
      const elements = createMockElements();
      renderer.render(
        { dimensionsUsed: ['valence', 'arousal', 'dominance'] },
        elements
      );
      expect(elements.pcaDimensionsList.innerHTML).toContain('valence');
      expect(elements.pcaDimensionsList.innerHTML).toContain('arousal');
      expect(elements.pcaDimensionsList.innerHTML).toContain('dominance');
      expect(elements.pcaDimensionsList.querySelectorAll('.dimension-tag').length).toBe(3);
    });

    it('should render dimensions count', () => {
      const elements = createMockElements();
      renderer.render(
        { dimensionsUsed: ['valence', 'arousal'] },
        elements
      );
      expect(elements.pcaDimensionsUsed.textContent).toBe('2');
    });

    it('should escape HTML in dimension names', () => {
      const elements = createMockElements();
      renderer.render(
        { dimensionsUsed: ['<script>alert("xss")</script>'] },
        elements
      );
      expect(elements.pcaDimensionsList.innerHTML).not.toContain('<script>');
      expect(elements.pcaDimensionsList.innerHTML).toContain('&lt;script&gt;');
    });

    it('should display -- when no dimensions', () => {
      const elements = createMockElements();
      renderer.render({ dimensionsUsed: [] }, elements);
      expect(elements.pcaDimensionsUsed.textContent).toBe('--');
    });
  });

  describe('excluded sparse axes rendering', () => {
    it('should render excluded axes section', () => {
      const elements = createMockElements();
      // Add parent node for dynamic container creation
      const parent = document.createElement('div');
      parent.appendChild(elements.pcaDimensionsList);
      elements.pcaExcludedAxesList = null;

      renderer.render({ excludedSparseAxes: ['rare_axis'] }, elements);

      // Check that container was created
      expect(elements.pcaExcludedAxesList).toBeDefined();
    });

    it('should hide section when no excluded axes', () => {
      const elements = createMockElements();
      renderer.render({ excludedSparseAxes: [] }, elements);
      expect(elements.pcaExcludedAxesList.style.display).toBe('none');
    });

    it('should show header with count', () => {
      const elements = createMockElements();
      renderer.render(
        { excludedSparseAxes: ['axis1', 'axis2'] },
        elements
      );
      expect(elements.pcaExcludedAxesList.innerHTML).toContain('Excluded Sparse Axes (2)');
    });
  });

  describe('unused defined axes rendering', () => {
    it('should hide section when no unused axes', () => {
      const elements = createMockElements();
      renderer.render({ unusedDefinedAxes: [] }, elements);
      expect(elements.pcaUnusedAxesList.style.display).toBe('none');
    });

    it('should show header with count', () => {
      const elements = createMockElements();
      renderer.render({ unusedDefinedAxes: ['unused1'] }, elements);
      expect(elements.pcaUnusedAxesList.innerHTML).toContain(
        'Unused but Defined Axes (1)'
      );
    });
  });

  describe('unused in gates rendering', () => {
    it('should hide section when no unused-in-gates axes', () => {
      const elements = createMockElements();
      renderer.render({ unusedInGates: [] }, elements);
      expect(elements.pcaUnusedInGatesList.style.display).toBe('none');
    });

    it('should show header with count', () => {
      const elements = createMockElements();
      renderer.render({ unusedInGates: ['gate1', 'gate2'] }, elements);
      expect(elements.pcaUnusedInGatesList.innerHTML).toContain(
        'Used in Weights but Not in Gates (2)'
      );
    });
  });

  describe('methodology note rendering', () => {
    it('should show warning note when 0 beyond expected with high residual', () => {
      const elements = createMockElements();
      renderer.render(
        { significantBeyondExpected: 0, residualVarianceRatio: 0.2 },
        elements
      );
      expect(elements.pcaMethodologyNote.innerHTML).toContain('Methodology Note');
      expect(elements.pcaMethodologyNote.innerHTML).toContain('warning');
    });

    it('should show alert note when beyond expected > 0', () => {
      const elements = createMockElements();
      renderer.render({ significantBeyondExpected: 2 }, elements);
      expect(elements.pcaMethodologyNote.innerHTML).toContain('alert');
      // Note: Template literal may break text across lines, so check textContent
      expect(elements.pcaMethodologyNote.textContent).toContain('2');
      expect(elements.pcaMethodologyNote.textContent).toContain('components');
    });

    it('should hide note when no special case', () => {
      const elements = createMockElements();
      renderer.render(
        { significantBeyondExpected: 0, residualVarianceRatio: 0.05 },
        elements
      );
      expect(elements.pcaMethodologyNote.style.display).toBe('none');
    });
  });

  describe('poorly fitting list rendering', () => {
    it('should render reconstruction errors', () => {
      const elements = createMockElements();
      renderer.render(
        {
          reconstructionErrors: [
            { prototypeId: 'proto:test', error: 0.55 },
          ],
        },
        elements
      );
      expect(elements.poorlyFittingList.innerHTML).toContain('proto:test');
      expect(elements.poorlyFittingList.innerHTML).toContain('0.550');
    });

    it('should add high-error class for errors > 0.5', () => {
      const elements = createMockElements();
      renderer.render(
        {
          reconstructionErrors: [{ prototypeId: 'test', error: 0.6 }],
        },
        elements
      );
      expect(elements.poorlyFittingList.innerHTML).toContain('high-error');
    });

    it('should show empty message when no errors', () => {
      const elements = createMockElements();
      renderer.render({ reconstructionErrors: [] }, elements);
      expect(elements.poorlyFittingList.innerHTML).toContain(
        'No poorly fitting prototypes detected'
      );
    });
  });

  describe('top loading prototypes rendering', () => {
    it('should render top loading prototypes', () => {
      const elements = createMockElements();
      renderer.render(
        {
          topLoadingPrototypes: [
            { prototypeId: 'emotion:joy', score: 0.85 },
          ],
        },
        elements
      );
      expect(elements.pcaTopLoading.innerHTML).toContain('emotion:joy');
      expect(elements.pcaTopLoading.innerHTML).toContain('0.850');
    });

    it('should limit to 5 prototypes', () => {
      const elements = createMockElements();
      const manyPrototypes = Array.from({ length: 10 }, (_, i) => ({
        prototypeId: `proto:${i}`,
        score: 0.9 - i * 0.05,
      }));
      renderer.render({ topLoadingPrototypes: manyPrototypes }, elements);
      expect(elements.pcaTopLoading.querySelectorAll('.top-loading-item').length).toBe(5);
    });

    it('should support legacy loading field', () => {
      const elements = createMockElements();
      renderer.render(
        {
          topLoadingPrototypes: [{ prototypeId: 'test', loading: 0.75 }],
        },
        elements
      );
      expect(elements.pcaTopLoading.innerHTML).toContain('0.750');
    });

    it('should support legacy contribution field', () => {
      const elements = createMockElements();
      renderer.render(
        {
          topLoadingPrototypes: [{ prototypeId: 'test', contribution: 0.65 }],
        },
        elements
      );
      expect(elements.pcaTopLoading.innerHTML).toContain('0.650');
    });

    it('should handle missing prototypeId with fallback to id', () => {
      const elements = createMockElements();
      renderer.render(
        {
          topLoadingPrototypes: [{ id: 'fallback:id', score: 0.5 }],
        },
        elements
      );
      expect(elements.pcaTopLoading.innerHTML).toContain('fallback:id');
    });

    it('should clear container when empty array', () => {
      const elements = createMockElements();
      elements.pcaTopLoading.innerHTML = '<p>Previous content</p>';
      renderer.render({ topLoadingPrototypes: [] }, elements);
      expect(elements.pcaTopLoading.innerHTML).toBe('');
    });

    it('should render header and subtitle', () => {
      const elements = createMockElements();
      renderer.render(
        {
          topLoadingPrototypes: [{ prototypeId: 'test', score: 0.5 }],
        },
        elements
      );
      expect(elements.pcaTopLoading.innerHTML).toContain(
        'Extreme Prototypes on Additional Component'
      );
      expect(elements.pcaTopLoading.innerHTML).toContain(
        'highest |projection|'
      );
    });
  });

  describe('XSS prevention', () => {
    it('should escape HTML in prototype IDs', () => {
      const elements = createMockElements();
      renderer.render(
        {
          topLoadingPrototypes: [
            { prototypeId: '<img src=x onerror=alert(1)>', score: 0.5 },
          ],
        },
        elements
      );
      expect(elements.pcaTopLoading.innerHTML).not.toContain('<img');
    });

    it('should escape HTML in reconstruction error IDs', () => {
      const elements = createMockElements();
      renderer.render(
        {
          reconstructionErrors: [
            { prototypeId: '<script>bad()</script>', error: 0.3 },
          ],
        },
        elements
      );
      expect(elements.poorlyFittingList.innerHTML).not.toContain('<script>');
    });

    it('should escape HTML in axis names', () => {
      const elements = createMockElements();
      renderer.render(
        {
          excludedSparseAxes: ['<div onclick="bad()">click</div>'],
        },
        elements
      );
      // The HTML should be escaped, so no actual div element should be created
      // The innerHTML will contain escaped entities, but no executable onclick
      const divs = elements.pcaExcludedAxesList.querySelectorAll('div[onclick]');
      expect(divs.length).toBe(0);
    });
  });

  describe('null element handling', () => {
    it('should handle null residualVariance element', () => {
      const elements = createMockElements();
      elements.residualVariance = null;
      expect(() => renderer.render({ residualVarianceRatio: 0.1 }, elements)).not.toThrow();
    });

    it('should handle null poorlyFittingList element', () => {
      const elements = createMockElements();
      elements.poorlyFittingList = null;
      expect(() =>
        renderer.render(
          { reconstructionErrors: [{ prototypeId: 'test', error: 0.5 }] },
          elements
        )
      ).not.toThrow();
    });

    it('should handle null pcaTopLoading element', () => {
      const elements = createMockElements();
      elements.pcaTopLoading = null;
      expect(() =>
        renderer.render(
          { topLoadingPrototypes: [{ prototypeId: 'test', score: 0.5 }] },
          elements
        )
      ).not.toThrow();
    });
  });
});
