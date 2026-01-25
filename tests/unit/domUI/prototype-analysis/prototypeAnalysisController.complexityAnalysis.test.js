/**
 * @file Tests for complexity analysis rendering in PrototypeAnalysisController
 * @description Verifies fixes for histogram [object Object] and missing outlier names
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import PrototypeAnalysisController from '../../../../src/domUI/prototype-analysis/PrototypeAnalysisController.js';

describe('PrototypeAnalysisController - Complexity Analysis Rendering', () => {
  let mockLogger;
  let mockAnalyzer;

  /**
   * Sets up the DOM with all required elements matching the HTML file structure.
   */
  function setupDom() {
    document.body.innerHTML = `
      <!-- Control panel -->
      <section class="panel controls-panel">
        <div class="form-group">
          <label for="prototype-family">Prototype Family:</label>
          <select id="prototype-family" class="form-select">
            <option value="emotion">Emotions</option>
            <option value="sexual">Sexual States</option>
            <option value="both">Both (Combined)</option>
          </select>
        </div>
        <button id="run-analysis-btn" class="action-button" disabled>Run Analysis</button>
      </section>

      <!-- Progress panel -->
      <section id="progress-panel" class="panel progress-panel" hidden>
        <div id="progress-bar" class="progress-bar"></div>
        <p id="progress-status" class="progress-status">Initializing...</p>
      </section>

      <!-- Results panel -->
      <section id="results-panel" class="panel results-panel" hidden>
        <div id="results-metadata" class="results-metadata"></div>
        <div id="recommendations-container" class="recommendations-container"></div>
        <div id="empty-state" class="empty-state" hidden></div>
      </section>

      <!-- Axis gap panel with complexity analysis container -->
      <section id="axis-gap-panel" class="panel axis-gap-panel" hidden>
        <div id="axis-gap-total-prototypes"></div>
        <div id="axis-gap-recommendations"></div>
        <div id="axis-gap-confidence"></div>
        <div id="decision-verdict"></div>
        <div id="decision-rationale"></div>
        <div id="variance-top4"></div>
        <div id="variance-axis-count"></div>
        <div id="variance-topk"></div>
        <div id="residual-variance"></div>
        <div id="significant-component-count"></div>
        <div id="expected-component-count"></div>
        <div id="significant-beyond-expected"></div>
        <div id="pca-dimensions-used"></div>
        <div id="components-for-80"></div>
        <div id="signal-pca"></div>
        <div id="signal-pca-status"></div>
        <div id="signal-pca-threshold"></div>
        <div id="signal-hubs"></div>
        <div id="signal-hubs-status"></div>
        <div id="signal-hubs-threshold"></div>
        <div id="signal-coverage-gaps"></div>
        <div id="signal-coverage-gaps-status"></div>
        <div id="signal-coverage-gaps-threshold"></div>
        <div id="signal-multi-axis-conflicts"></div>
        <div id="signal-multi-axis-conflicts-status"></div>
        <div id="signal-multi-axis-conflicts-threshold"></div>
        <div id="hub-prototypes-container"></div>
        <div id="coverage-gaps-container"></div>
        <div id="multi-axis-conflicts-container"></div>
        <div id="sign-tensions-container"></div>
        <div id="polarity-analysis-container"></div>
        <div id="complexity-analysis-container" class="complexity-analysis-container"></div>
        <div id="axis-recommendations-container"></div>
        <div id="candidate-axes-container"></div>
        <div id="prototype-weight-cards-container"></div>
        <div id="data-integrity-status"></div>
        <div id="data-integrity-message"></div>
      </section>
    `;
  }

  /**
   * Creates a mock analysis result object with the given complexity analysis.
   *
   * @param {object} complexityAnalysis - The complexity analysis data to include
   * @returns {object} Complete analysis result object
   */
  function createAnalysisResult(complexityAnalysis) {
    return {
      recommendations: [],
      metadata: {
        prototypeFamily: 'emotion',
        totalPrototypes: 10,
        candidatePairsFound: 0,
        candidatePairsEvaluated: 0,
        redundantPairsFound: 0,
        sampleCountPerPair: 8000,
      },
      axisGapAnalysis: {
        summary: { totalPrototypes: 10, recommendationCount: 0 },
        pcaAnalysis: null,
        hubPrototypes: [],
        coverageGaps: [],
        multiAxisConflicts: [],
        signTensions: [],
        polarityAnalysis: null,
        complexityAnalysis,
        recommendations: [],
        candidateAxes: [],
        prototypeWeightSummaries: [],
      },
    };
  }

  beforeEach(() => {
    setupDom();
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    mockAnalyzer = {
      analyze: jest.fn(),
      getPrototypes: jest.fn().mockReturnValue([]),
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('Histogram Rendering - Issue 1: [object Object] fix', () => {
    it('should render histogram from array of {bin, count} objects without [object Object]', async () => {
      const complexityAnalysis = {
        totalPrototypes: 10,
        averageComplexity: 5.0,
        distribution: {
          histogram: [
            { bin: 2, count: 5 },
            { bin: 3, count: 12 },
            { bin: 4, count: 8 },
          ],
          median: 3,
          q1: 2,
          q3: 4,
          outliers: [],
        },
      };

      mockAnalyzer.analyze.mockResolvedValue(
        createAnalysisResult(complexityAnalysis)
      );

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();
      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 50));

      const container = document.getElementById(
        'complexity-analysis-container'
      );
      const html = container.innerHTML;

      // Should NOT contain [object Object]
      expect(html).not.toContain('[object Object]');

      // Should contain the actual bin values as labels
      expect(html).toMatch(/>2<\/span>/);
      expect(html).toMatch(/>3<\/span>/);
      expect(html).toMatch(/>4<\/span>/);

      // Should contain the counts
      expect(html).toMatch(/>5<\/span>/);
      expect(html).toMatch(/>12<\/span>/);
      expect(html).toMatch(/>8<\/span>/);
    });

    it('should handle empty histogram array', async () => {
      const complexityAnalysis = {
        totalPrototypes: 0,
        averageComplexity: 0,
        distribution: {
          histogram: [],
          median: 0,
          q1: 0,
          q3: 0,
          outliers: [],
        },
      };

      mockAnalyzer.analyze.mockResolvedValue(
        createAnalysisResult(complexityAnalysis)
      );

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();
      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 50));

      const container = document.getElementById(
        'complexity-analysis-container'
      );
      expect(container.innerHTML).toContain('No histogram data');
    });

    it('should sort histogram bins numerically', async () => {
      const complexityAnalysis = {
        totalPrototypes: 10,
        averageComplexity: 5.0,
        distribution: {
          histogram: [
            { bin: 10, count: 2 },
            { bin: 2, count: 5 },
            { bin: 5, count: 8 },
          ],
          median: 5,
          q1: 2,
          q3: 10,
          outliers: [],
        },
      };

      mockAnalyzer.analyze.mockResolvedValue(
        createAnalysisResult(complexityAnalysis)
      );

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();
      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 50));

      const bars = document.querySelectorAll('.histogram-bar-container');
      const labels = Array.from(bars).map(
        (b) => b.querySelector('.histogram-label').textContent
      );

      expect(labels).toEqual(['2', '5', '10']);
    });
  });

  describe('Outliers Rendering - Issue 2: Missing prototype names', () => {
    it('should render outliers using prototypeId property', async () => {
      const complexityAnalysis = {
        totalPrototypes: 110,
        averageComplexity: 7.81,
        distribution: {
          histogram: [{ bin: 8, count: 50 }],
          median: 8,
          q1: 6,
          q3: 9,
          outliers: [
            { prototypeId: 'emotion:joy_burst', axisCount: 3 },
            { prototypeId: 'emotion:complex_feeling', axisCount: 13 },
          ],
        },
      };

      mockAnalyzer.analyze.mockResolvedValue(
        createAnalysisResult(complexityAnalysis)
      );

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();
      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 50));

      const container = document.getElementById(
        'complexity-analysis-container'
      );
      const html = container.innerHTML;

      // Should contain prototype IDs (the main fix)
      expect(html).toContain('emotion:joy_burst');
      expect(html).toContain('emotion:complex_feeling');

      // Should contain axis counts
      expect(html).toContain('3 axes');
      expect(html).toContain('13 axes');
    });

    it('should not render outliers section when outliers array is empty', async () => {
      const complexityAnalysis = {
        totalPrototypes: 10,
        averageComplexity: 5.0,
        distribution: {
          histogram: [{ bin: 5, count: 10 }],
          median: 5,
          q1: 4,
          q3: 6,
          outliers: [],
        },
      };

      mockAnalyzer.analyze.mockResolvedValue(
        createAnalysisResult(complexityAnalysis)
      );

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();
      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 50));

      const outliersSection = document.querySelector(
        '.complexity-outliers-section'
      );
      expect(outliersSection).toBeNull();
    });

    it('should escape HTML in prototype IDs for XSS safety', async () => {
      const complexityAnalysis = {
        totalPrototypes: 10,
        averageComplexity: 5.0,
        distribution: {
          histogram: [{ bin: 5, count: 10 }],
          median: 5,
          q1: 4,
          q3: 6,
          outliers: [
            { prototypeId: '<script>alert("xss")</script>', axisCount: 3 },
          ],
        },
      };

      mockAnalyzer.analyze.mockResolvedValue(
        createAnalysisResult(complexityAnalysis)
      );

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();
      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 50));

      const container = document.getElementById(
        'complexity-analysis-container'
      );
      const html = container.innerHTML;

      // Should NOT contain unescaped script tag
      expect(html).not.toContain('<script>');
      // Should contain escaped version
      expect(html).toContain('&lt;script&gt;');
    });
  });
});
