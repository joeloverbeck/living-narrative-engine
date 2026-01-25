/**
 * @file Unit tests for PrototypeAnalysisController integrity checks
 *
 * Tests the model integrity display functionality that shows validation
 * status for axis registry, schema validation, weight ranges, and duplicates.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import PrototypeAnalysisController from '../../../src/domUI/prototype-analysis/PrototypeAnalysisController.js';

describe('PrototypeAnalysisController - Integrity Checks', () => {
  let mockLogger;
  let mockAnalyzer;
  let controller;

  /**
   * Set up the DOM structure required by the controller, including integrity panel.
   */
  function setupDom() {
    document.body.innerHTML = `
      <section class="panel controls-panel">
        <select id="prototype-family" class="form-select">
          <option value="emotion">Emotions</option>
        </select>
        <button id="run-analysis-btn" class="action-button" disabled>
          Run Analysis
        </button>
      </section>

      <section id="progress-panel" class="panel progress-panel" hidden>
        <div id="progress-bar" class="progress-bar"></div>
        <p id="progress-status" class="progress-status">Initializing...</p>
      </section>

      <section id="results-panel" class="panel results-panel" hidden>
        <div id="results-metadata" class="results-metadata"></div>
        <div id="recommendations-container" class="recommendations-container"></div>
        <div id="empty-state" class="empty-state" hidden></div>
      </section>

      <section id="axis-gap-panel" class="panel axis-gap-panel" hidden>
        <h2>Axis Space Analysis</h2>

        <!-- Model Integrity Status Panel -->
        <div id="integrity-panel" class="integrity-panel">
          <h4>Model Integrity Status</h4>
          <div class="integrity-grid">
            <div class="integrity-item">
              <span id="integrity-axis-registry-status" class="integrity-status pending">⏳</span>
              <span class="integrity-label">Axis Registry</span>
            </div>
            <div class="integrity-item">
              <span id="integrity-schema-status" class="integrity-status pending">⏳</span>
              <span class="integrity-label">Schema Validation</span>
            </div>
            <div class="integrity-item">
              <span id="integrity-weight-range-status" class="integrity-status pending">⏳</span>
              <span class="integrity-label">Weight Ranges</span>
            </div>
            <div class="integrity-item">
              <span id="integrity-no-duplicates-status" class="integrity-status pending">⏳</span>
              <span class="integrity-label">No Duplicates</span>
            </div>
          </div>
          <p id="integrity-summary" class="integrity-summary">Waiting for analysis...</p>
        </div>

        <div class="axis-gap-summary">
          <span id="axis-gap-total-prototypes" class="summary-value">--</span>
          <span id="axis-gap-recommendations" class="summary-value">--</span>
          <span id="axis-gap-confidence" class="summary-value confidence-badge">--</span>
        </div>
        <div id="decision-panel" class="decision-panel">
          <span id="decision-verdict" class="decision-badge verdict-no">NO</span>
          <p id="decision-rationale" class="decision-rationale"></p>
          <span id="variance-top4" class="variance-value">--</span>
          <span id="variance-axis-count" class="variance-value">--</span>
          <span id="variance-topk" class="variance-value">--</span>
        </div>
        <div class="signal-breakdown">
          <span id="signal-pca" class="signal-value">0</span>
          <span id="signal-pca-status" class="signal-status pass">✓ PASS</span>
          <span id="signal-pca-threshold" class="signal-threshold"></span>
          <span id="signal-hubs" class="signal-value">0</span>
          <span id="signal-hubs-status" class="signal-status pass">✓ PASS</span>
          <span id="signal-coverage-gaps" class="signal-value">0</span>
          <span id="signal-coverage-gaps-status" class="signal-status pass">✓ PASS</span>
          <span id="signal-coverage-gaps-threshold" class="signal-threshold"></span>
          <span id="signal-multi-axis-conflicts" class="signal-value">0</span>
          <span id="signal-multi-axis-conflicts-status" class="signal-status pass">✓ PASS</span>
        </div>
        <div class="pca-summary">
          <span id="residual-variance" class="metric-value">--</span>
          <span id="significant-component-count" class="metric-value">--</span>
          <span id="expected-component-count" class="metric-value">--</span>
          <span id="significant-beyond-expected" class="metric-value">--</span>
          <span id="components-for-80" class="metric-value">--</span>
          <span id="components-for-90" class="metric-value">--</span>
          <div id="pca-dimensions-list" class="dimensions-list"></div>
          <div id="pca-top-loading" class="top-loading-list"></div>
          <ul id="poorly-fitting-list" class="poorly-fitting-list"></ul>
        </div>
        <ul id="hub-list" class="prototype-list"></ul>
        <ul id="coverage-gap-list" class="gap-list"></ul>
        <ul id="conflict-list" class="conflict-list"></ul>
        <ul id="sign-tension-list" class="sign-tension-list"></ul>
        <ul id="axis-recommendations-list" class="axis-recommendations-list"></ul>
        <ul id="candidate-axis-list"></ul>
        <div id="prototype-cards-container" class="prototype-cards-container"></div>
      </section>
    `;
  }

  /**
   * Create a minimal valid analysis result for rendering.
   *
   * @returns {object} A minimal analysis result object.
   */
  function createMinimalAnalysisResult() {
    return {
      pairs: [],
      executionTimeMs: 100,
      prototypeCount: 10,
      metadata: {
        prototypeFamily: 'emotion',
        totalPrototypes: 10,
        candidatePairsFound: 0,
        candidatePairsEvaluated: 0,
        redundantPairsFound: 0,
        sampleCountPerPair: 8000,
      },
      axisGapAnalysis: {
        summary: {
          totalPrototypesAnalyzed: 10,
          recommendationCount: 0,
          signalBreakdown: {
            pcaSignal: 0,
            hubPrototypes: 0,
            coverageGaps: 0,
            multiAxisConflicts: 0,
          },
          confidence: 'Medium',
        },
        pcaAnalysis: {
          residualVariance: 0.12,
          significantComponentCount: 4,
          expectedComponentCount: 4,
          significantBeyondExpected: 0,
          componentsFor80: 3,
          componentsFor90: 4,
          explainedVarianceRatio: [0.35, 0.25, 0.15, 0.13],
          topLoadings: [],
          cumulativeVariance: [0.35, 0.6, 0.75, 0.88],
          excludedAxes: [],
          dimensionCount: 12,
        },
        hubPrototypes: [],
        coverageGaps: [],
        multiAxisConflicts: [],
        signTensions: [],
        recommendations: [],
        candidateAxes: [],
        decision: {
          verdict: 'NO',
          rationale: 'No significant gaps detected.',
          signalsSummary: {},
        },
        prototypeWeightSummaries: [],
      },
    };
  }

  beforeEach(() => {
    setupDom();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockAnalyzer = {
      analyze: jest.fn(),
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('integrity panel DOM binding', () => {
    it('should bind integrity panel elements on initialize', async () => {
      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });
      await controller.initialize();

      // Elements should exist in DOM
      expect(
        document.getElementById('integrity-axis-registry-status')
      ).not.toBeNull();
      expect(document.getElementById('integrity-schema-status')).not.toBeNull();
      expect(
        document.getElementById('integrity-weight-range-status')
      ).not.toBeNull();
      expect(
        document.getElementById('integrity-no-duplicates-status')
      ).not.toBeNull();
      expect(document.getElementById('integrity-summary')).not.toBeNull();
    });

    it('should start with pending status indicators', async () => {
      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });
      await controller.initialize();

      const axisRegistryStatus = document.getElementById(
        'integrity-axis-registry-status'
      );
      expect(axisRegistryStatus.classList.contains('pending')).toBe(true);
      expect(axisRegistryStatus.textContent).toBe('⏳');
    });
  });

  describe('integrity display update', () => {
    it('should show all checks as passed when analysis renders', async () => {
      let resolveAnalysis;
      mockAnalyzer.analyze.mockImplementation(() => {
        return new Promise((resolve) => {
          resolveAnalysis = resolve;
        });
      });

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });
      await controller.initialize();

      // Trigger analysis
      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Complete the analysis with results that include axisGapAnalysis
      resolveAnalysis(createMinimalAnalysisResult());

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Check that all status indicators show pass
      const axisRegistryStatus = document.getElementById(
        'integrity-axis-registry-status'
      );
      const schemaStatus = document.getElementById('integrity-schema-status');
      const weightRangeStatus = document.getElementById(
        'integrity-weight-range-status'
      );
      const noDuplicatesStatus = document.getElementById(
        'integrity-no-duplicates-status'
      );

      expect(axisRegistryStatus.classList.contains('pass')).toBe(true);
      expect(axisRegistryStatus.textContent).toBe('✓');

      expect(schemaStatus.classList.contains('pass')).toBe(true);
      expect(schemaStatus.textContent).toBe('✓');

      expect(weightRangeStatus.classList.contains('pass')).toBe(true);
      expect(weightRangeStatus.textContent).toBe('✓');

      expect(noDuplicatesStatus.classList.contains('pass')).toBe(true);
      expect(noDuplicatesStatus.textContent).toBe('✓');
    });

    it('should update summary message to show all passed', async () => {
      let resolveAnalysis;
      mockAnalyzer.analyze.mockImplementation(() => {
        return new Promise((resolve) => {
          resolveAnalysis = resolve;
        });
      });

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });
      await controller.initialize();

      // Trigger analysis
      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      resolveAnalysis(createMinimalAnalysisResult());

      await new Promise((resolve) => setTimeout(resolve, 0));

      const summary = document.getElementById('integrity-summary');
      expect(summary.textContent).toContain('All integrity checks passed');
      expect(summary.classList.contains('all-pass')).toBe(true);
    });

    it('should remove pending class when checks complete', async () => {
      let resolveAnalysis;
      mockAnalyzer.analyze.mockImplementation(() => {
        return new Promise((resolve) => {
          resolveAnalysis = resolve;
        });
      });

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });
      await controller.initialize();

      // Trigger analysis
      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      resolveAnalysis(createMinimalAnalysisResult());

      await new Promise((resolve) => setTimeout(resolve, 0));

      const axisRegistryStatus = document.getElementById(
        'integrity-axis-registry-status'
      );
      expect(axisRegistryStatus.classList.contains('pending')).toBe(false);
    });

    it('should log debug message when integrity display updates', async () => {
      let resolveAnalysis;
      mockAnalyzer.analyze.mockImplementation(() => {
        return new Promise((resolve) => {
          resolveAnalysis = resolve;
        });
      });

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });
      await controller.initialize();

      // Trigger analysis
      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      resolveAnalysis(createMinimalAnalysisResult());

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Integrity display updated')
      );
    });
  });

  describe('integration with axis gap panel', () => {
    it('should update integrity display when axis gap panel becomes visible', async () => {
      let resolveAnalysis;
      mockAnalyzer.analyze.mockImplementation(() => {
        return new Promise((resolve) => {
          resolveAnalysis = resolve;
        });
      });

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });
      await controller.initialize();

      // Initially panel is hidden
      const axisGapPanel = document.getElementById('axis-gap-panel');
      expect(axisGapPanel.hidden).toBe(true);

      // Run analysis to show panel
      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      resolveAnalysis(createMinimalAnalysisResult());

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Panel should now be visible
      expect(axisGapPanel.hidden).toBe(false);

      // Integrity checks should be displayed
      const summary = document.getElementById('integrity-summary');
      expect(summary.textContent).not.toBe('Waiting for analysis...');
    });
  });
});
