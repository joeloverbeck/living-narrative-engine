/**
 * @file Unit tests for PrototypeAnalysisController
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import PrototypeAnalysisController from '../../../../src/domUI/prototype-analysis/PrototypeAnalysisController.js';

describe('PrototypeAnalysisController', () => {
  let mockLogger;
  let mockAnalyzer;

  /**
   * Set up the DOM structure required by the controller.
   */
  function setupDom() {
    document.body.innerHTML = `
      <section class="panel controls-panel">
        <div class="form-group">
          <label for="prototype-family">Prototype Family:</label>
          <select id="prototype-family" class="form-select">
            <option value="emotion">Emotions</option>
            <option value="sexual">Sexual States</option>
          </select>
        </div>
        <button id="run-analysis-btn" class="action-button" disabled>
          Run Analysis
        </button>
      </section>

      <section id="progress-panel" class="panel progress-panel" hidden>
        <h2>Analysis Progress</h2>
        <div class="progress-bar-container">
          <div id="progress-bar" class="progress-bar" role="progressbar"
               aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
          </div>
        </div>
        <p id="progress-status" class="progress-status">Initializing...</p>
      </section>

      <section id="results-panel" class="panel results-panel" hidden>
        <h2>Analysis Results</h2>
        <div id="results-metadata" class="results-metadata"></div>
        <div id="recommendations-container" class="recommendations-container">
        </div>
        <div id="empty-state" class="empty-state" hidden>
          <p>No overlapping prototypes detected. All prototypes are sufficiently distinct.</p>
        </div>
      </section>

      <section id="axis-gap-panel" class="panel axis-gap-panel" hidden>
        <h2>Axis Space Analysis</h2>
        <div class="axis-gap-summary">
          <div class="summary-item">
            <span class="summary-label">Prototypes Analyzed:</span>
            <span id="axis-gap-total-prototypes" class="summary-value">--</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Recommendations:</span>
            <span id="axis-gap-recommendations" class="summary-value">--</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Confidence:</span>
            <span id="axis-gap-confidence" class="summary-value confidence-badge">--</span>
          </div>
        </div>
        <div id="decision-panel" class="decision-panel">
          <div class="decision-header">
            <span class="decision-label">New Axis Recommended?</span>
            <span id="decision-verdict" class="decision-badge verdict-no">NO</span>
          </div>
          <p id="decision-rationale" class="decision-rationale">Analysis not yet run.</p>
          <div class="variance-summary">
            <span class="variance-label">Explained by top 4 PCs:</span>
            <span id="variance-top4" class="variance-value">--</span>
          </div>
        </div>
        <div class="signal-breakdown">
          <h4>Signal Sources</h4>
          <div class="signal-grid">
            <div class="signal-item" id="signal-pca-item">
              <span id="signal-pca-status" class="signal-status pass">✓ PASS</span>
              <span class="signal-label">PCA Analysis:</span>
              <span id="signal-pca" class="signal-value">0</span>
              <span id="signal-pca-threshold" class="signal-threshold">(residual ≤15%)</span>
            </div>
            <div class="signal-item" id="signal-hubs-item">
              <span id="signal-hubs-status" class="signal-status pass">✓ PASS</span>
              <span class="signal-label">Hub Prototypes:</span>
              <span id="signal-hubs" class="signal-value">0</span>
              <span id="signal-hubs-threshold" class="signal-threshold">(no connectors)</span>
            </div>
            <div class="signal-item" id="signal-coverage-gaps-item">
              <span id="signal-coverage-gaps-status" class="signal-status pass">✓ PASS</span>
              <span class="signal-label">Coverage Gaps:</span>
              <span id="signal-coverage-gaps" class="signal-value">0</span>
              <span id="signal-coverage-gaps-threshold" class="signal-threshold">(distance ≤0.6)</span>
            </div>
            <div class="signal-item" id="signal-multi-axis-conflicts-item">
              <span id="signal-multi-axis-conflicts-status" class="signal-status pass">✓ PASS</span>
              <span class="signal-label">Multi-Axis Conflicts:</span>
              <span id="signal-multi-axis-conflicts" class="signal-value">0</span>
              <span id="signal-multi-axis-conflicts-threshold" class="signal-threshold">(balanced usage)</span>
            </div>
          </div>
        </div>
        <div class="pca-summary">
          <h3>Dimensionality Analysis (PCA)</h3>
          <div class="metric-row">
            <span class="metric-label">Residual Variance:</span>
            <span id="residual-variance" class="metric-value">--</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Additional Components Suggested:</span>
            <span id="additional-components" class="metric-value">--</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Dimensions Used:</span>
            <span id="pca-dimensions-used" class="metric-value">--</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Components for 80% Variance:</span>
            <span id="components-for-80" class="metric-value">--</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Components for 90% Variance:</span>
            <span id="components-for-90" class="metric-value">--</span>
          </div>
          <div id="pca-dimensions-list" class="dimensions-list"></div>
          <div id="pca-top-loading" class="top-loading-list"></div>
          <div id="poorly-fitting-prototypes" class="poorly-fitting-section">
            <h4>Poorly Fitting Prototypes</h4>
            <ul id="poorly-fitting-list" class="poorly-fitting-list"></ul>
          </div>
        </div>
        <div class="hub-prototypes">
          <h3>Hub Prototypes</h3>
          <ul id="hub-list" class="prototype-list"></ul>
        </div>
        <div class="coverage-gaps">
          <h3>Coverage Gaps</h3>
          <ul id="coverage-gap-list" class="gap-list"></ul>
        </div>
        <div class="multi-axis-conflicts">
          <h3>Multi-Axis Conflicts</h3>
          <ul id="conflict-list" class="conflict-list"></ul>
        </div>
        <div class="axis-recommendations">
          <h3>Axis Recommendations</h3>
          <ul id="axis-recommendations-list" class="axis-recommendations-list"></ul>
        </div>
        <div class="prototype-weight-cards">
          <h3>Flagged Prototypes Analysis</h3>
          <div id="prototype-cards-container" class="prototype-cards-container"></div>
        </div>
      </section>
    `;
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

  describe('constructor', () => {
    it('should validate logger dependency', () => {
      expect(
        () =>
          new PrototypeAnalysisController({
            logger: null,
            prototypeOverlapAnalyzer: mockAnalyzer,
          })
      ).toThrow();
    });

    it('should validate prototypeOverlapAnalyzer dependency', () => {
      expect(
        () =>
          new PrototypeAnalysisController({
            logger: mockLogger,
            prototypeOverlapAnalyzer: null,
          })
      ).toThrow();
    });

    it('should validate prototypeOverlapAnalyzer has analyze method', () => {
      expect(
        () =>
          new PrototypeAnalysisController({
            logger: mockLogger,
            prototypeOverlapAnalyzer: {},
          })
      ).toThrow();
    });

    it('should construct successfully with valid dependencies', () => {
      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      expect(controller).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should bind to DOM elements on initialize', async () => {
      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[PrototypeAnalysisController] Initialized'
      );
    });

    it('should enable controls after initialization', async () => {
      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      expect(runBtn.disabled).toBe(false);

      const familySelect = document.getElementById('prototype-family');
      expect(familySelect.disabled).toBe(false);
    });

    it('should warn when run button is not found', async () => {
      document.getElementById('run-analysis-btn').remove();

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[PrototypeAnalysisController] Run analysis button not found'
      );
    });
  });

  describe('analysis execution', () => {
    it('should disable controls during analysis', async () => {
      mockAnalyzer.analyze.mockImplementation(() => {
        return new Promise((resolve) => {
          // Check controls are disabled
          const runBtn = document.getElementById('run-analysis-btn');
          const familySelect = document.getElementById('prototype-family');

          expect(runBtn.disabled).toBe(true);
          expect(familySelect.disabled).toBe(true);

          resolve({
            recommendations: [],
            metadata: {
              prototypeFamily: 'emotion',
              totalPrototypes: 10,
              candidatePairsFound: 5,
              candidatePairsEvaluated: 5,
              redundantPairsFound: 0,
              sampleCountPerPair: 8000,
            },
          });
        });
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    it('should show progress panel during analysis', async () => {
      let resolveAnalysis;
      mockAnalyzer.analyze.mockImplementation(() => {
        return new Promise((resolve) => {
          resolveAnalysis = resolve;
        });
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      const progressPanel = document.getElementById('progress-panel');
      expect(progressPanel.hidden).toBe(false);

      // Complete the analysis
      resolveAnalysis({
        recommendations: [],
        metadata: {
          prototypeFamily: 'emotion',
          totalPrototypes: 10,
          candidatePairsFound: 5,
          candidatePairsEvaluated: 5,
          redundantPairsFound: 0,
          sampleCountPerPair: 8000,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    it('should update progress bar width during filtering stage', async () => {
      let progressCallback;
      mockAnalyzer.analyze.mockImplementation((options) => {
        progressCallback = options.onProgress;
        return Promise.resolve({
          recommendations: [],
          metadata: {
            prototypeFamily: 'emotion',
            totalPrototypes: 10,
            candidatePairsFound: 5,
            candidatePairsEvaluated: 5,
            redundantPairsFound: 0,
            sampleCountPerPair: 8000,
          },
        });
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Simulate progress callback - 1 of 2 complete (50% of filtering stage)
      progressCallback('filtering', { current: 1, total: 2 });

      const progressBar = document.getElementById('progress-bar');
      // Filtering is 0-5% of progress, so 1/2 complete = 2.5%
      expect(progressBar.style.width).toBe('2.5%');
    });

    it('should update progress bar width during evaluating stage', async () => {
      let progressCallback;
      mockAnalyzer.analyze.mockImplementation((options) => {
        progressCallback = options.onProgress;
        return Promise.resolve({
          recommendations: [],
          metadata: {
            prototypeFamily: 'emotion',
            totalPrototypes: 10,
            candidatePairsFound: 5,
            candidatePairsEvaluated: 5,
            redundantPairsFound: 0,
            sampleCountPerPair: 8000,
          },
        });
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Simulate progress callback - pair 5 of 10, sample 4000 of 8000
      progressCallback('evaluating', {
        pairIndex: 5,
        pairTotal: 10,
        sampleIndex: 4000,
        sampleTotal: 8000,
      });

      const progressBar = document.getElementById('progress-bar');
      // pairProgress = 5/10 = 0.5, sampleProgress = 4000/8000 = 0.5
      // combinedProgress = 0.5 + 0.5/10 = 0.55
      // percent = 5 + 0.55 * 80 = 49% (filtering=5%, evaluating=80%)
      const width = parseFloat(progressBar.style.width);
      expect(width).toBeCloseTo(49, 1);
    });

    it('should update progress bar width during classifying stage', async () => {
      let progressCallback;
      mockAnalyzer.analyze.mockImplementation((options) => {
        progressCallback = options.onProgress;
        return Promise.resolve({
          recommendations: [],
          metadata: {
            prototypeFamily: 'emotion',
            totalPrototypes: 10,
            candidatePairsFound: 5,
            candidatePairsEvaluated: 5,
            redundantPairsFound: 0,
            sampleCountPerPair: 8000,
          },
        });
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Simulate classifying stage - 5 of 10 pairs processed
      progressCallback('classifying', {
        pairIndex: 5,
        pairTotal: 10,
      });

      const progressBar = document.getElementById('progress-bar');
      // classifying: start=85, weight=10
      // stageProgress = 5/10 = 0.5
      // percent = 85 + 0.5 * 10 = 90%
      const width = parseFloat(progressBar.style.width);
      expect(width).toBeCloseTo(90, 1);
    });

    it('should update progress bar width during recommending stage', async () => {
      let progressCallback;
      mockAnalyzer.analyze.mockImplementation((options) => {
        progressCallback = options.onProgress;
        return Promise.resolve({
          recommendations: [],
          metadata: {
            prototypeFamily: 'emotion',
            totalPrototypes: 10,
            candidatePairsFound: 5,
            candidatePairsEvaluated: 5,
            redundantPairsFound: 0,
            sampleCountPerPair: 8000,
          },
        });
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Simulate recommending stage - 8 of 10 pairs processed
      progressCallback('recommending', {
        pairIndex: 8,
        pairTotal: 10,
      });

      const progressBar = document.getElementById('progress-bar');
      // recommending: start=95, weight=5
      // stageProgress = 8/10 = 0.8
      // percent = 95 + 0.8 * 5 = 99%
      const width = parseFloat(progressBar.style.width);
      expect(width).toBeCloseTo(99, 1);
    });

    it('should update status text for stages', async () => {
      let progressCallback;
      mockAnalyzer.analyze.mockImplementation((options) => {
        progressCallback = options.onProgress;
        return Promise.resolve({
          recommendations: [],
          metadata: {
            prototypeFamily: 'emotion',
            totalPrototypes: 10,
            candidatePairsFound: 5,
            candidatePairsEvaluated: 5,
            redundantPairsFound: 0,
            sampleCountPerPair: 8000,
          },
        });
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      const progressStatus = document.getElementById('progress-status');

      // Check filtering stage status - now includes "Stage X/Y:" prefix
      progressCallback('filtering', { current: 3, total: 10, stageNumber: 1, totalStages: 4 });
      expect(progressStatus.textContent).toBe(
        'Stage 1/4: Filtering candidate pairs (3/10)...'
      );

      // Check filtering complete status
      progressCallback('filtering', { current: 10, total: 10, stageNumber: 1, totalStages: 4 });
      expect(progressStatus.textContent).toBe('Stage 1/4: Filtering complete');

      // Check evaluating stage status - pair 5 of 20, sample 4000 of 8000
      progressCallback('evaluating', {
        pairIndex: 4,
        pairTotal: 20,
        sampleIndex: 4000,
        sampleTotal: 8000,
        stageNumber: 2,
        totalStages: 4,
      });
      // Status shows: "Stage 2/4: Pair 5/20 (50%)..." (pairIndex+1 for 1-based display)
      expect(progressStatus.textContent).toBe('Stage 2/4: Pair 5/20 (50%)...');

      // Check evaluation complete status - all pairs complete
      progressCallback('evaluating', {
        pairIndex: 20,
        pairTotal: 20,
        sampleIndex: 8000,
        sampleTotal: 8000,
        stageNumber: 2,
        totalStages: 4,
      });
      // Status shows: "Stage 2/4: Pair 21/20 (100%)..." when complete
      expect(progressStatus.textContent).toBe('Stage 2/4: Pair 21/20 (100%)...');

      // Check classifying stage status
      progressCallback('classifying', {
        pairIndex: 5,
        pairTotal: 20,
        stageNumber: 3,
        totalStages: 4,
      });
      expect(progressStatus.textContent).toBe('Stage 3/4: Classifying overlap patterns (5/20)...');

      // Check recommending stage status
      progressCallback('recommending', {
        pairIndex: 10,
        pairTotal: 20,
        stageNumber: 4,
        totalStages: 4,
      });
      expect(progressStatus.textContent).toBe('Stage 4/4: Building recommendations (10/20)...');
    });

    it('should re-enable controls after analysis completes', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
        recommendations: [],
        metadata: {
          prototypeFamily: 'emotion',
          totalPrototypes: 10,
          candidatePairsFound: 5,
          candidatePairsEvaluated: 5,
          redundantPairsFound: 0,
          sampleCountPerPair: 8000,
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(runBtn.disabled).toBe(false);
      expect(document.getElementById('prototype-family').disabled).toBe(false);
    });

    it('should pass selected options to analyzer', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
        recommendations: [],
        metadata: {
          prototypeFamily: 'sexual',
          totalPrototypes: 5,
          candidatePairsFound: 2,
          candidatePairsEvaluated: 2,
          redundantPairsFound: 0,
          sampleCountPerPair: 50000,
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      // Change selection
      document.getElementById('prototype-family').value = 'sexual';

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockAnalyzer.analyze).toHaveBeenCalledWith(
        expect.objectContaining({
          prototypeFamily: 'sexual',
        })
      );
      // Verify sampleCount is NOT passed (V3 uses fixed pool size)
      expect(mockAnalyzer.analyze).not.toHaveBeenCalledWith(
        expect.objectContaining({
          sampleCount: expect.any(Number),
        })
      );
    });

    it('should update button text with percentage during analysis', async () => {
      let progressCallback;
      mockAnalyzer.analyze.mockImplementation((options) => {
        progressCallback = options.onProgress;
        return Promise.resolve({
          recommendations: [],
          metadata: {
            prototypeFamily: 'emotion',
            totalPrototypes: 10,
            candidatePairsFound: 5,
            candidatePairsEvaluated: 5,
            redundantPairsFound: 0,
            sampleCountPerPair: 8000,
          },
        });
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      const originalText = runBtn.textContent.trim();
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Simulate progress at 50% through evaluation
      progressCallback('evaluating', {
        pairIndex: 5,
        pairTotal: 10,
        sampleIndex: 0,
        sampleTotal: 8000,
      });

      // Button should show percentage
      expect(runBtn.textContent.trim()).toMatch(/\d+%/);
      expect(runBtn.textContent.trim()).not.toBe(originalText);
    });

    it('should restore original button text after completion', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
        recommendations: [],
        metadata: {
          prototypeFamily: 'emotion',
          totalPrototypes: 10,
          candidatePairsFound: 5,
          candidatePairsEvaluated: 5,
          redundantPairsFound: 0,
          sampleCountPerPair: 8000,
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      const originalText = runBtn.textContent.trim();
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Button text should be restored after completion
      expect(runBtn.textContent.trim()).toBe(originalText);
    });

    it('should restore original button text after error', async () => {
      mockAnalyzer.analyze.mockRejectedValue(new Error('Analysis failed'));

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      const originalText = runBtn.textContent.trim();
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Button text should be restored after error
      expect(runBtn.textContent.trim()).toBe(originalText);
    });
  });

  describe('setup stage progress (V3 mode)', () => {
    it('should handle setup stage progress updates', async () => {
      let progressCallback;
      mockAnalyzer.analyze.mockImplementation((options) => {
        progressCallback = options.onProgress;
        return Promise.resolve({
          recommendations: [],
          metadata: {
            prototypeFamily: 'emotion',
            totalPrototypes: 10,
            candidatePairsFound: 5,
            candidatePairsEvaluated: 5,
            redundantPairsFound: 0,
            sampleCountPerPair: 8000,
          },
        });
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Simulate V3 setup progress - pool phase at 50%
      progressCallback('setup', {
        phase: 'pool',
        poolCurrent: 25000,
        poolTotal: 50000,
        stageNumber: 1,
        totalStages: 5,
      });

      const progressBar = document.getElementById('progress-bar');
      // Setup is 0-15% of progress, pool is 70% of setup
      // 50% complete of pool = 0.5 * 0.7 * 15 = 5.25%
      const width = parseFloat(progressBar.style.width);
      expect(width).toBeCloseTo(5.25, 1);
    });

    it('should display pool generation progress text', async () => {
      let progressCallback;
      mockAnalyzer.analyze.mockImplementation((options) => {
        progressCallback = options.onProgress;
        return Promise.resolve({
          recommendations: [],
          metadata: {
            prototypeFamily: 'emotion',
            totalPrototypes: 10,
            candidatePairsFound: 5,
            candidatePairsEvaluated: 5,
            redundantPairsFound: 0,
            sampleCountPerPair: 8000,
          },
        });
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      const progressStatus = document.getElementById('progress-status');

      // Test pool phase status
      progressCallback('setup', {
        phase: 'pool',
        poolCurrent: 25000,
        poolTotal: 50000,
        stageNumber: 1,
        totalStages: 5,
      });
      expect(progressStatus.textContent).toBe(
        'Stage 1/5: Generating context pool (50%)...'
      );

      // Test vectors phase status with granular progress
      progressCallback('setup', {
        phase: 'vectors',
        vectorCurrent: 25,
        vectorTotal: 50,
        stageNumber: 1,
        totalStages: 5,
      });
      expect(progressStatus.textContent).toBe(
        'Stage 1/5: Evaluating prototype vectors (25/50 - 50%)...'
      );

      // Test profiles phase status
      progressCallback('setup', {
        phase: 'profiles',
        stageNumber: 1,
        totalStages: 5,
      });
      expect(progressStatus.textContent).toBe(
        'Stage 1/5: Computing prototype profiles...'
      );
    });

    it('should update progress bar width during vectors phase with granular progress', async () => {
      let progressCallback;
      mockAnalyzer.analyze.mockImplementation((options) => {
        progressCallback = options.onProgress;
        return Promise.resolve({
          recommendations: [],
          metadata: {
            prototypeFamily: 'emotion',
            totalPrototypes: 10,
            candidatePairsFound: 5,
            candidatePairsEvaluated: 5,
            redundantPairsFound: 0,
            sampleCountPerPair: 8000,
          },
        });
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Simulate V3 setup progress - vectors phase at 50% (15 of 30 prototypes)
      progressCallback('setup', {
        phase: 'vectors',
        vectorCurrent: 15,
        vectorTotal: 30,
        stageNumber: 1,
        totalStages: 5,
      });

      const progressBar = document.getElementById('progress-bar');
      // vectorProgress = 15/30 = 0.5
      // stageProgress = 0.7 + 0.5 * 0.2 = 0.8 (80% of setup phase)
      // 0.8 * 15% setup weight = 12%
      const width = parseFloat(progressBar.style.width);
      expect(width).toBeCloseTo(12, 1);

      const progressStatus = document.getElementById('progress-status');
      expect(progressStatus.textContent).toBe(
        'Stage 1/5: Evaluating prototype vectors (15/30 - 50%)...'
      );
    });

    it('should display initial vectors phase status when vectorCurrent is 0', async () => {
      let progressCallback;
      mockAnalyzer.analyze.mockImplementation((options) => {
        progressCallback = options.onProgress;
        return Promise.resolve({
          recommendations: [],
          metadata: {
            prototypeFamily: 'emotion',
            totalPrototypes: 10,
            candidatePairsFound: 5,
            candidatePairsEvaluated: 5,
            redundantPairsFound: 0,
            sampleCountPerPair: 8000,
          },
        });
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Simulate V3 setup progress - vectors phase at start (0 of 30 prototypes)
      progressCallback('setup', {
        phase: 'vectors',
        vectorCurrent: 0,
        vectorTotal: 30,
        stageNumber: 1,
        totalStages: 5,
      });

      const progressBar = document.getElementById('progress-bar');
      // vectorProgress = 0/30 = 0
      // stageProgress = 0.7 + 0 * 0.2 = 0.7 (70% of setup phase)
      // 0.7 * 15% setup weight = 10.5%
      const width = parseFloat(progressBar.style.width);
      expect(width).toBeCloseTo(10.5, 1);

      const progressStatus = document.getElementById('progress-status');
      expect(progressStatus.textContent).toBe(
        'Stage 1/5: Evaluating prototype vectors (0/30 - 0%)...'
      );
    });

    it('should update progress bar width during vectors phase without granular data (fallback)', async () => {
      let progressCallback;
      mockAnalyzer.analyze.mockImplementation((options) => {
        progressCallback = options.onProgress;
        return Promise.resolve({
          recommendations: [],
          metadata: {
            prototypeFamily: 'emotion',
            totalPrototypes: 10,
            candidatePairsFound: 5,
            candidatePairsEvaluated: 5,
            redundantPairsFound: 0,
            sampleCountPerPair: 8000,
          },
        });
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Simulate V3 setup progress - vectors phase without vectorCurrent/vectorTotal
      progressCallback('setup', {
        phase: 'vectors',
        stageNumber: 1,
        totalStages: 5,
      });

      const progressBar = document.getElementById('progress-bar');
      // Without granular data, falls back to 0 progress for vectors
      // stageProgress = 0.7 + 0 * 0.2 = 0.7 (70% of setup phase)
      // 0.7 * 15% setup weight = 10.5%
      const width = parseFloat(progressBar.style.width);
      expect(width).toBeCloseTo(10.5, 1);
    });

    it('should update progress bar width during profiles phase', async () => {
      let progressCallback;
      mockAnalyzer.analyze.mockImplementation((options) => {
        progressCallback = options.onProgress;
        return Promise.resolve({
          recommendations: [],
          metadata: {
            prototypeFamily: 'emotion',
            totalPrototypes: 10,
            candidatePairsFound: 5,
            candidatePairsEvaluated: 5,
            redundantPairsFound: 0,
            sampleCountPerPair: 8000,
          },
        });
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Simulate V3 setup progress - profiles phase
      progressCallback('setup', {
        phase: 'profiles',
        stageNumber: 1,
        totalStages: 5,
      });

      const progressBar = document.getElementById('progress-bar');
      // Profiles phase is at 90% of setup (0.9)
      // 0.9 * 15% setup weight = 13.5%
      const width = parseFloat(progressBar.style.width);
      expect(width).toBeCloseTo(13.5, 1);
    });

    it('should show initializing text when no phase is specified', async () => {
      let progressCallback;
      mockAnalyzer.analyze.mockImplementation((options) => {
        progressCallback = options.onProgress;
        return Promise.resolve({
          recommendations: [],
          metadata: {
            prototypeFamily: 'emotion',
            totalPrototypes: 10,
            candidatePairsFound: 5,
            candidatePairsEvaluated: 5,
            redundantPairsFound: 0,
            sampleCountPerPair: 8000,
          },
        });
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      const progressStatus = document.getElementById('progress-status');

      // Test initial setup call with no phase
      progressCallback('setup', {
        stageNumber: 1,
        totalStages: 5,
      });
      expect(progressStatus.textContent).toBe(
        'Stage 1/5: Initializing V3 analysis...'
      );
    });

    it('should use V3 stage weights when totalStages is 5', async () => {
      let progressCallback;
      mockAnalyzer.analyze.mockImplementation((options) => {
        progressCallback = options.onProgress;
        return Promise.resolve({
          recommendations: [],
          metadata: {
            prototypeFamily: 'emotion',
            totalPrototypes: 10,
            candidatePairsFound: 5,
            candidatePairsEvaluated: 5,
            redundantPairsFound: 0,
            sampleCountPerPair: 8000,
          },
        });
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      // In V3 mode, filtering starts at 15% (after setup)
      progressCallback('filtering', {
        current: 0,
        total: 10,
        stageNumber: 2,
        totalStages: 5,
      });

      const progressBar = document.getElementById('progress-bar');
      // Filtering at 0% progress, starts at 15%
      const width = parseFloat(progressBar.style.width);
      expect(width).toBeCloseTo(15, 1);
    });
  });

  describe('result rendering', () => {
    it('should render recommendation cards', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
        recommendations: [
          {
            prototypeA: 'joy',
            prototypeB: 'happiness',
            severity: 0.85,
            type: 'structurally_redundant',
            summary: 'These prototypes share significant structural overlap.',
            actionableInsight:
              'Consider merging or differentiating these prototypes.',
            divergenceExamples: [
              { intensityDifference: 0.05, contextSummary: 'Low mood context' },
            ],
          },
        ],
        metadata: {
          prototypeFamily: 'emotion',
          totalPrototypes: 50,
          candidatePairsFound: 100,
          candidatePairsEvaluated: 100,
          redundantPairsFound: 1,
          sampleCountPerPair: 8000,
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      const container = document.getElementById('recommendations-container');
      const cards = container.querySelectorAll('.recommendation-card');

      expect(cards.length).toBe(1);
      expect(cards[0].textContent).toContain('joy');
      expect(cards[0].textContent).toContain('happiness');
      expect(cards[0].textContent).toContain('0.85');
      expect(cards[0].textContent).toContain('Structurally Redundant');
    });

    it('should handle empty results with empty state', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
        recommendations: [],
        metadata: {
          prototypeFamily: 'emotion',
          totalPrototypes: 50,
          candidatePairsFound: 100,
          candidatePairsEvaluated: 100,
          redundantPairsFound: 0,
          sampleCountPerPair: 8000,
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      const emptyState = document.getElementById('empty-state');
      expect(emptyState.hidden).toBe(false);

      const container = document.getElementById('recommendations-container');
      expect(container.innerHTML).toBe('');
    });

    it('should render metadata summary', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
        recommendations: [],
        metadata: {
          prototypeFamily: 'emotion',
          totalPrototypes: 50,
          candidatePairsFound: 100,
          candidatePairsEvaluated: 95,
          redundantPairsFound: 3,
          sampleCountPerPair: 8000,
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      const metadata = document.getElementById('results-metadata');
      expect(metadata.textContent).toContain('emotion');
      expect(metadata.textContent).toContain('50');
      expect(metadata.textContent).toContain('100');
      expect(metadata.textContent).toContain('95');
      expect(metadata.textContent).toContain('3');
      expect(metadata.textContent).toContain('8000');
    });

    it('should show results panel after analysis', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
        recommendations: [],
        metadata: {
          prototypeFamily: 'emotion',
          totalPrototypes: 10,
          candidatePairsFound: 5,
          candidatePairsEvaluated: 5,
          redundantPairsFound: 0,
          sampleCountPerPair: 8000,
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      const resultsPanel = document.getElementById('results-panel');
      expect(resultsPanel.hidden).toBe(false);
    });

    it('should hide progress panel after analysis completes', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
        recommendations: [],
        metadata: {
          prototypeFamily: 'emotion',
          totalPrototypes: 10,
          candidatePairsFound: 5,
          candidatePairsEvaluated: 5,
          redundantPairsFound: 0,
          sampleCountPerPair: 8000,
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      const progressPanel = document.getElementById('progress-panel');
      expect(progressPanel.hidden).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle analysis errors gracefully', async () => {
      const testError = new Error('Analysis failed: timeout');
      mockAnalyzer.analyze.mockRejectedValue(testError);

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[PrototypeAnalysisController] Analysis failed',
        testError
      );

      const container = document.getElementById('recommendations-container');
      expect(container.textContent).toContain('Analysis Failed');
      expect(container.textContent).toContain('Analysis failed: timeout');
    });

    it('should re-enable controls after error', async () => {
      mockAnalyzer.analyze.mockRejectedValue(new Error('Test error'));

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(runBtn.disabled).toBe(false);
      expect(document.getElementById('prototype-family').disabled).toBe(false);
    });

    it('should hide progress panel after error', async () => {
      mockAnalyzer.analyze.mockRejectedValue(new Error('Test error'));

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      const progressPanel = document.getElementById('progress-panel');
      expect(progressPanel.hidden).toBe(true);
    });

    it('should prevent concurrent analysis runs', async () => {
      let resolveAnalysis;
      let analyzeCallCount = 0;
      mockAnalyzer.analyze.mockImplementation(() => {
        analyzeCallCount++;
        return new Promise((resolve) => {
          resolveAnalysis = resolve;
        });
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');

      // Start first analysis
      runBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // First analysis should have started
      expect(analyzeCallCount).toBe(1);

      // Button should be disabled during analysis, so clicking it
      // shouldn't trigger a second call (the warn message is only
      // logged if someone programmatically calls the run method)
      expect(runBtn.disabled).toBe(true);

      // Complete analysis
      resolveAnalysis({
        recommendations: [],
        metadata: {
          prototypeFamily: 'emotion',
          totalPrototypes: 10,
          candidatePairsFound: 5,
          candidatePairsEvaluated: 5,
          redundantPairsFound: 0,
          sampleCountPerPair: 8000,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Button should be re-enabled after completion
      expect(runBtn.disabled).toBe(false);

      // Now we can start another analysis
      runBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(analyzeCallCount).toBe(2);
    });
  });

  describe('severity classification', () => {
    it('should assign severity-high class for severity >= 0.8', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
        recommendations: [
          {
            prototypeA: 'a',
            prototypeB: 'b',
            severity: 0.9,
            type: 'structurally_redundant',
            summary: 'Test',
            actionableInsight: 'Test',
            divergenceExamples: [],
          },
        ],
        metadata: {
          prototypeFamily: 'emotion',
          totalPrototypes: 10,
          candidatePairsFound: 5,
          candidatePairsEvaluated: 5,
          redundantPairsFound: 1,
          sampleCountPerPair: 8000,
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const card = document.querySelector('.recommendation-card');
      expect(card.classList.contains('severity-high')).toBe(true);
    });

    it('should assign severity-medium class for severity >= 0.5', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
        recommendations: [
          {
            prototypeA: 'a',
            prototypeB: 'b',
            severity: 0.6,
            type: 'behaviorally_redundant',
            summary: 'Test',
            actionableInsight: 'Test',
            divergenceExamples: [],
          },
        ],
        metadata: {
          prototypeFamily: 'emotion',
          totalPrototypes: 10,
          candidatePairsFound: 5,
          candidatePairsEvaluated: 5,
          redundantPairsFound: 1,
          sampleCountPerPair: 8000,
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const card = document.querySelector('.recommendation-card');
      expect(card.classList.contains('severity-medium')).toBe(true);
    });

    it('should assign severity-low class for severity < 0.5', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
        recommendations: [
          {
            prototypeA: 'a',
            prototypeB: 'b',
            severity: 0.3,
            type: 'high_overlap',
            summary: 'Test',
            actionableInsight: 'Test',
            divergenceExamples: [],
          },
        ],
        metadata: {
          prototypeFamily: 'emotion',
          totalPrototypes: 10,
          candidatePairsFound: 5,
          candidatePairsEvaluated: 5,
          redundantPairsFound: 1,
          sampleCountPerPair: 8000,
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const card = document.querySelector('.recommendation-card');
      expect(card.classList.contains('severity-low')).toBe(true);
    });
  });

  describe('type label formatting', () => {
    const testCases = [
      {
        type: 'structurally_redundant',
        expected: 'Structurally Redundant',
      },
      {
        type: 'behaviorally_redundant',
        expected: 'Behaviorally Redundant',
      },
      { type: 'high_overlap', expected: 'High Overlap' },
      { type: 'not_redundant', expected: 'Not Redundant' },
      { type: 'unknown_type', expected: 'unknown_type' },
    ];

    testCases.forEach(({ type, expected }) => {
      it(`should format ${type} as "${expected}"`, async () => {
        mockAnalyzer.analyze.mockResolvedValue({
          recommendations: [
            {
              prototypeA: 'a',
              prototypeB: 'b',
              severity: 0.5,
              type,
              summary: 'Test',
              actionableInsight: 'Test',
              divergenceExamples: [],
            },
          ],
          metadata: {
            prototypeFamily: 'emotion',
            totalPrototypes: 10,
            candidatePairsFound: 5,
            candidatePairsEvaluated: 5,
            redundantPairsFound: 1,
            sampleCountPerPair: 8000,
          },
        });

        const controller = new PrototypeAnalysisController({
          logger: mockLogger,
          prototypeOverlapAnalyzer: mockAnalyzer,
        });

        await controller.initialize();

        document.getElementById('run-analysis-btn').click();
        await new Promise((resolve) => setTimeout(resolve, 0));

        const typeBadge = document.querySelector('.type-badge');
        expect(typeBadge.textContent).toBe(expected);
      });
    });
  });

  describe('XSS prevention', () => {
    it('should escape HTML in prototype names', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
        recommendations: [
          {
            prototypeA: '<script>alert("xss")</script>',
            prototypeB: 'normal',
            severity: 0.5,
            type: 'high_overlap',
            summary: 'Test',
            actionableInsight: 'Test',
            divergenceExamples: [],
          },
        ],
        metadata: {
          prototypeFamily: 'emotion',
          totalPrototypes: 10,
          candidatePairsFound: 5,
          candidatePairsEvaluated: 5,
          redundantPairsFound: 1,
          sampleCountPerPair: 8000,
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const card = document.querySelector('.recommendation-card');
      expect(card.innerHTML).not.toContain('<script>');
      expect(card.textContent).toContain('<script>alert("xss")</script>');
    });
  });

  describe('v2 recommendation format (OverlapRecommendationBuilder output)', () => {
    it('should render prototype names from nested prototypes object', async () => {
      // This is the actual format returned by OverlapRecommendationBuilder.build()
      mockAnalyzer.analyze.mockResolvedValue({
        recommendations: [
          {
            type: 'prototype_nested_siblings',
            prototypeFamily: 'emotion',
            prototypes: {
              a: 'joy_intense',
              b: 'happiness_mild',
            },
            severity: 0.75,
            confidence: 0.85,
            actions: [
              '"happiness_mild" appears to be a specialized version of "joy_intense"',
              'Consider making "happiness_mild" inherit from "joy_intense"',
            ],
            candidateMetrics: {
              activeAxisOverlap: 0.8,
              signAgreement: 0.9,
              weightCosineSimilarity: 0.85,
            },
            behaviorMetrics: {
              onEitherRate: 0.3,
              onBothRate: 0.25,
              pOnlyRate: 0.05,
              qOnlyRate: 0.0,
              pearsonCorrelation: 0.92,
              meanAbsDiff: 0.08,
              dominanceP: 0.85,
              dominanceQ: 0.15,
            },
            evidence: {
              sharedDrivers: [{ axis: 'valence', weightA: 0.8, weightB: 0.75 }],
              keyDifferentiators: [{ axis: 'arousal', reason: 'only_in_A' }],
              divergenceExamples: [
                { intensityDifference: 0.12, contextSummary: 'High energy context' },
              ],
            },
          },
        ],
        metadata: {
          prototypeFamily: 'emotion',
          totalPrototypes: 50,
          candidatePairsFound: 100,
          candidatePairsEvaluated: 100,
          redundantPairsFound: 1,
          sampleCountPerPair: 8000,
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const card = document.querySelector('.recommendation-card');
      expect(card).not.toBeNull();
      expect(card.textContent).toContain('joy_intense');
      expect(card.textContent).toContain('happiness_mild');
    });

    it('should render actions array as actionable insight', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
        recommendations: [
          {
            type: 'prototype_merge_suggestion',
            prototypeFamily: 'emotion',
            prototypes: { a: 'proto_a', b: 'proto_b' },
            severity: 0.85,
            confidence: 0.9,
            actions: [
              'Consider merging these prototypes',
              'Alias one to the other',
            ],
            candidateMetrics: {},
            behaviorMetrics: {},
            evidence: { divergenceExamples: [] },
          },
        ],
        metadata: {
          prototypeFamily: 'emotion',
          totalPrototypes: 10,
          candidatePairsFound: 5,
          candidatePairsEvaluated: 5,
          redundantPairsFound: 1,
          sampleCountPerPair: 8000,
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Details are always visible (no toggle button)
      const insightSection = document.querySelector('.rec-insight');
      expect(insightSection.textContent).toContain('Consider merging these prototypes');
      expect(insightSection.textContent).toContain('Alias one to the other');
    });

    it('should handle missing prototypes object gracefully', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
        recommendations: [
          {
            type: 'prototype_overlap_info',
            severity: 0.5,
            confidence: 0.7,
            actions: ['Some action'],
            evidence: { divergenceExamples: [] },
            // prototypes object is missing
          },
        ],
        metadata: {
          prototypeFamily: 'emotion',
          totalPrototypes: 10,
          candidatePairsFound: 5,
          candidatePairsEvaluated: 5,
          redundantPairsFound: 1,
          sampleCountPerPair: 8000,
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const card = document.querySelector('.recommendation-card');
      expect(card).not.toBeNull();
      // Should show fallback text without crashing
      expect(card.textContent).toContain('Unknown A');
      expect(card.textContent).toContain('Unknown B');
    });

    it('should handle empty actions array gracefully', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
        recommendations: [
          {
            type: 'prototype_distinct_info',
            prototypes: { a: 'alpha', b: 'beta' },
            severity: 0.2,
            confidence: 0.8,
            actions: [],
            evidence: { divergenceExamples: [] },
          },
        ],
        metadata: {
          prototypeFamily: 'emotion',
          totalPrototypes: 10,
          candidatePairsFound: 5,
          candidatePairsEvaluated: 5,
          redundantPairsFound: 1,
          sampleCountPerPair: 8000,
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Details are always visible (no toggle button)
      const insightSection = document.querySelector('.rec-insight');
      expect(insightSection.textContent).toContain('No specific actions recommended');
    });

    it('should extract divergenceExamples from evidence object', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
        recommendations: [
          {
            type: 'prototype_needs_separation',
            prototypes: { a: 'anger', b: 'frustration' },
            severity: 0.6,
            confidence: 0.8,
            actions: ['Tighten gate conditions'],
            evidence: {
              sharedDrivers: [],
              keyDifferentiators: [],
              divergenceExamples: [
                { intensityDifference: 0.25, contextSummary: 'Work stress context' },
                { intensityDifference: 0.18, contextSummary: 'Social conflict' },
              ],
            },
          },
        ],
        metadata: {
          prototypeFamily: 'emotion',
          totalPrototypes: 10,
          candidatePairsFound: 5,
          candidatePairsEvaluated: 5,
          redundantPairsFound: 1,
          sampleCountPerPair: 8000,
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Details are always visible (no toggle button)
      const divergenceSection = document.querySelector('.rec-divergence');
      expect(divergenceSection).not.toBeNull();
      expect(divergenceSection.textContent).toContain('Work stress context');
      expect(divergenceSection.textContent).toContain('Social conflict');
    });
  });

  describe('v2 classificationBreakdown rendering', () => {
    it('should render classification breakdown with correct v2 property names', async () => {
      // This test verifies the fix for the "Classification: undefined merge | undefined subsumed"
      // bug caused by property name mismatch between analyzer and UI
      mockAnalyzer.analyze.mockResolvedValue({
        recommendations: [],
        metadata: {
          prototypeFamily: 'emotion',
          totalPrototypes: 50,
          candidatePairsFound: 100,
          candidatePairsEvaluated: 100,
          redundantPairsFound: 5,
          sampleCountPerPair: 8000,
          // v2 property names from PrototypeOverlapAnalyzer
          classificationBreakdown: {
            mergeRecommended: 2,
            subsumedRecommended: 1,
            nestedSiblings: 1,
            needsSeparation: 0,
            convertToExpression: 1,
            keepDistinct: 0,
          },
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const metadata = document.getElementById('results-metadata');
      const metadataText = metadata.textContent;

      // Should display actual numbers, not "undefined"
      expect(metadataText).not.toContain('undefined');

      // Should contain v2 classification type counts
      expect(metadataText).toContain('2 merge');
      expect(metadataText).toContain('1 subsumed');
      expect(metadataText).toContain('1 nested');
      expect(metadataText).toContain('0 separation');
      expect(metadataText).toContain('1 expression');
      expect(metadataText).toContain('0 distinct');
    });

    it('should handle missing classificationBreakdown gracefully', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
        recommendations: [],
        metadata: {
          prototypeFamily: 'emotion',
          totalPrototypes: 50,
          candidatePairsFound: 100,
          candidatePairsEvaluated: 100,
          redundantPairsFound: 0,
          sampleCountPerPair: 8000,
          // No classificationBreakdown provided
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const metadata = document.getElementById('results-metadata');

      // Should not crash and should not show "undefined"
      expect(metadata.textContent).not.toContain('undefined');
      // Should not show classification section at all when breakdown is missing
      expect(metadata.innerHTML).not.toContain('classification-merge');
    });
  });

  describe('v2 type label formatting', () => {
    const v2TypeCases = [
      {
        type: 'prototype_merge_suggestion',
        expected: 'Merge Suggestion',
      },
      {
        type: 'prototype_subsumption_suggestion',
        expected: 'Subsumption Suggestion',
      },
      {
        type: 'prototype_overlap_info',
        expected: 'Overlap Info',
      },
      {
        type: 'prototype_nested_siblings',
        expected: 'Nested Siblings',
      },
      {
        type: 'prototype_needs_separation',
        expected: 'Needs Separation',
      },
      {
        type: 'prototype_distinct_info',
        expected: 'Distinct',
      },
      {
        type: 'prototype_expression_conversion',
        expected: 'Expression Conversion',
      },
    ];

    v2TypeCases.forEach(({ type, expected }) => {
      it(`should format v2 type ${type} as "${expected}"`, async () => {
        mockAnalyzer.analyze.mockResolvedValue({
          recommendations: [
            {
              prototypes: { a: 'x', b: 'y' },
              severity: 0.5,
              type,
              actions: ['Test action'],
              evidence: { divergenceExamples: [] },
            },
          ],
          metadata: {
            prototypeFamily: 'emotion',
            totalPrototypes: 10,
            candidatePairsFound: 5,
            candidatePairsEvaluated: 5,
            redundantPairsFound: 1,
            sampleCountPerPair: 8000,
          },
        });

        const controller = new PrototypeAnalysisController({
          logger: mockLogger,
          prototypeOverlapAnalyzer: mockAnalyzer,
        });

        await controller.initialize();

        document.getElementById('run-analysis-btn').click();
        await new Promise((resolve) => setTimeout(resolve, 0));

        const typeBadge = document.querySelector('.type-badge');
        expect(typeBadge.textContent).toBe(expected);
      });
    });
  });

  describe('multi-label evidence rendering', () => {
    it('renders additional evidence when secondary matches exist', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
        recommendations: [
          {
            prototypes: { a: 'x', b: 'y' },
            severity: 0.6,
            type: 'prototype_merge_suggestion',
            actions: ['Test action'],
            evidence: { divergenceExamples: [] },
            allMatchingClassifications: [
              {
                type: 'merge_recommended',
                confidence: 0.92,
                evidence: { gateOverlapRatio: 0.93 },
                isPrimary: true,
              },
              {
                type: 'needs_separation',
                confidence: 0.61,
                evidence: { gateOverlapRatio: 0.81 },
                isPrimary: false,
              },
            ],
          },
        ],
        metadata: {
          prototypeFamily: 'emotion',
          totalPrototypes: 10,
          candidatePairsFound: 5,
          candidatePairsEvaluated: 5,
          redundantPairsFound: 1,
          sampleCountPerPair: 8000,
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const evidenceSummary = document.querySelector('.rec-evidence summary');
      const evidencePill = document.querySelector('.evidence-pill');
      const evidenceList = document.querySelector('.evidence-list');

      expect(evidenceSummary).toBeDefined();
      expect(evidenceSummary.textContent).toBe('Additional Evidence');
      expect(evidencePill.textContent).toBe('Needs Separation');
      expect(evidenceList.textContent).toContain('gateOverlapRatio');
    });
  });

  describe('axis gap analysis rendering', () => {
    it('should bind axis gap panel DOM elements', async () => {
      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      // Verify DOM elements exist (if they didn't bind, they would be null)
      expect(document.getElementById('axis-gap-panel')).not.toBeNull();
      expect(document.getElementById('axis-gap-total-prototypes')).not.toBeNull();
      expect(document.getElementById('axis-gap-recommendations')).not.toBeNull();
      expect(document.getElementById('axis-gap-confidence')).not.toBeNull();
      expect(document.getElementById('residual-variance')).not.toBeNull();
      expect(document.getElementById('additional-components')).not.toBeNull();
      expect(document.getElementById('pca-dimensions-used')).not.toBeNull();
      expect(document.getElementById('pca-dimensions-list')).not.toBeNull();
      expect(document.getElementById('pca-top-loading')).not.toBeNull();
      expect(document.getElementById('hub-list')).not.toBeNull();
      expect(document.getElementById('coverage-gap-list')).not.toBeNull();
      expect(document.getElementById('conflict-list')).not.toBeNull();
      expect(document.getElementById('axis-recommendations-list')).not.toBeNull();
    });

    it('should hide axis gap panel when axisGapAnalysis is null', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
        recommendations: [],
        metadata: {
          prototypeFamily: 'emotion',
          totalPrototypes: 10,
          candidatePairsFound: 0,
          candidatePairsEvaluated: 0,
          redundantPairsFound: 0,
          sampleCountPerPair: 8000,
        },
        axisGapAnalysis: null,
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();
      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const axisGapPanel = document.getElementById('axis-gap-panel');
      expect(axisGapPanel.hidden).toBe(true);
    });

    it('should show axis gap panel when axisGapAnalysis is present', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
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
          summary: {
            totalPrototypesAnalyzed: 15,
            recommendationCount: 3,
            signalBreakdown: {
              pcaSignals: 1,
              hubSignals: 0,
              coverageGapSignals: 1,
              multiAxisConflictSignals: 1,
            },
            confidence: 'high',
            potentialGapsDetected: 3,
          },
          pcaAnalysis: {
            residualVarianceRatio: 0.08,
            additionalSignificantComponents: 1,
            topLoadingPrototypes: [],
          },
          hubPrototypes: [],
          coverageGaps: [],
          multiAxisConflicts: [],
          recommendations: [],
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();
      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const axisGapPanel = document.getElementById('axis-gap-panel');
      expect(axisGapPanel.hidden).toBe(false);
    });

    it('should render PCA residual variance with correct formatting', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
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
          summary: {
            totalPrototypesAnalyzed: 15,
            recommendationCount: 3,
            signalBreakdown: {
              pcaSignals: 1,
              hubSignals: 1,
              coverageGapSignals: 1,
              multiAxisConflictSignals: 0,
            },
            confidence: 'medium',
            potentialGapsDetected: 3,
          },
          pcaAnalysis: {
            residualVarianceRatio: 0.0875,
            additionalSignificantComponents: 2,
            topLoadingPrototypes: [],
          },
          hubPrototypes: [],
          coverageGaps: [],
          multiAxisConflicts: [],
          recommendations: [],
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();
      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const residualVariance = document.getElementById('residual-variance');
      expect(residualVariance.textContent).toBe('8.8%');
    });

    it('should apply warning class when residual variance > 0.1', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
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
          summary: {
            totalPrototypesAnalyzed: 15,
            recommendationCount: 3,
            signalBreakdown: {
              pcaSignals: 1,
              hubSignals: 1,
              coverageGapSignals: 1,
              multiAxisConflictSignals: 0,
            },
            confidence: 'medium',
            potentialGapsDetected: 3,
          },
          pcaAnalysis: {
            residualVarianceRatio: 0.12,
            additionalSignificantComponents: 2,
            topLoadingPrototypes: [],
          },
          hubPrototypes: [],
          coverageGaps: [],
          multiAxisConflicts: [],
          recommendations: [],
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();
      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const residualVariance = document.getElementById('residual-variance');
      expect(residualVariance.classList.contains('warning')).toBe(true);
    });

    it('should apply alert class when residual variance > 0.15', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
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
          summary: {
            totalPrototypesAnalyzed: 15,
            recommendationCount: 3,
            signalBreakdown: {
              pcaSignals: 0,
              hubSignals: 0,
              coverageGapSignals: 1,
              multiAxisConflictSignals: 0,
            },
            confidence: 'low',
            potentialGapsDetected: 3,
          },
          pcaAnalysis: {
            residualVarianceRatio: 0.18,
            additionalSignificantComponents: 3,
            topLoadingPrototypes: [],
          },
          hubPrototypes: [],
          coverageGaps: [],
          multiAxisConflicts: [],
          recommendations: [],
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();
      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const residualVariance = document.getElementById('residual-variance');
      expect(residualVariance.classList.contains('alert')).toBe(true);
    });

    it('should render dimensions count and list with tags', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
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
          summary: {
            totalPrototypesAnalyzed: 15,
            recommendationCount: 3,
            signalBreakdown: {
              pcaSignals: 1,
              hubSignals: 0,
              coverageGapSignals: 1,
              multiAxisConflictSignals: 1,
            },
            confidence: 'high',
            potentialGapsDetected: 3,
          },
          pcaAnalysis: {
            residualVarianceRatio: 0.05,
            additionalSignificantComponents: 0,
            topLoadingPrototypes: [],
            dimensionsUsed: ['valence', 'arousal', 'dominance'],
          },
          hubPrototypes: [],
          coverageGaps: [],
          multiAxisConflicts: [],
          recommendations: [],
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();
      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const dimensionsUsed = document.getElementById('pca-dimensions-used');
      expect(dimensionsUsed.textContent).toBe('3');

      const dimensionsList = document.getElementById('pca-dimensions-list');
      expect(dimensionsList.children.length).toBe(3);
      expect(dimensionsList.innerHTML).toContain('valence');
      expect(dimensionsList.innerHTML).toContain('arousal');
      expect(dimensionsList.innerHTML).toContain('dominance');
      expect(dimensionsList.innerHTML).toContain('dimension-tag');
    });

    it('should handle missing dimensionsUsed gracefully', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
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
          summary: {
            totalPrototypesAnalyzed: 15,
            recommendationCount: 3,
            signalBreakdown: {
              pcaSignals: 1,
              hubSignals: 0,
              coverageGapSignals: 1,
              multiAxisConflictSignals: 1,
            },
            confidence: 'high',
            potentialGapsDetected: 3,
          },
          pcaAnalysis: {
            residualVarianceRatio: 0.05,
            additionalSignificantComponents: 0,
            topLoadingPrototypes: [],
            // dimensionsUsed intentionally missing
          },
          hubPrototypes: [],
          coverageGaps: [],
          multiAxisConflicts: [],
          recommendations: [],
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();
      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const dimensionsUsed = document.getElementById('pca-dimensions-used');
      expect(dimensionsUsed.textContent).toBe('--');

      const dimensionsList = document.getElementById('pca-dimensions-list');
      expect(dimensionsList.innerHTML).toBe('');
    });

    it('should render hub prototypes list', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
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
          summary: {
            totalPrototypesAnalyzed: 15,
            recommendationCount: 3,
            signalBreakdown: {
              pcaSignals: 1,
              hubSignals: 0,
              coverageGapSignals: 1,
              multiAxisConflictSignals: 1,
            },
            confidence: 'high',
            potentialGapsDetected: 3,
          },
          pcaAnalysis: {
            residualVarianceRatio: 0.05,
            additionalSignificantComponents: 0,
            topLoadingPrototypes: [],
          },
          hubPrototypes: [
            { prototypeId: 'hub_proto_1', hubScore: 0.85, connectedClusters: 3 },
            { prototypeId: 'hub_proto_2', hubScore: 0.72, connectedClusters: 2 },
          ],
          coverageGaps: [],
          multiAxisConflicts: [],
          recommendations: [],
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();
      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const hubList = document.getElementById('hub-list');
      expect(hubList.children.length).toBe(2);
      expect(hubList.textContent).toContain('hub_proto_1');
      expect(hubList.textContent).toContain('hub_proto_2');
    });

    it('should render coverage gaps list', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
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
          summary: {
            totalPrototypesAnalyzed: 15,
            recommendationCount: 3,
            signalBreakdown: {
              pcaSignals: 1,
              hubSignals: 0,
              coverageGapSignals: 1,
              multiAxisConflictSignals: 1,
            },
            confidence: 'high',
            potentialGapsDetected: 3,
          },
          pcaAnalysis: {
            residualVarianceRatio: 0.05,
            additionalSignificantComponents: 0,
            topLoadingPrototypes: [],
          },
          hubPrototypes: [],
          coverageGaps: [
            { clusterLabel: 'Gap A', distanceFromAxes: 0.45, prototypeCount: 3 },
          ],
          multiAxisConflicts: [],
          recommendations: [],
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();
      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const gapList = document.getElementById('coverage-gap-list');
      expect(gapList.children.length).toBe(1);
      expect(gapList.textContent).toContain('Gap A');
    });

    it('should render multi-axis conflicts list', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
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
          summary: {
            totalPrototypesAnalyzed: 15,
            recommendationCount: 3,
            signalBreakdown: {
              pcaSignals: 1,
              hubSignals: 0,
              coverageGapSignals: 1,
              multiAxisConflictSignals: 1,
            },
            confidence: 'high',
            potentialGapsDetected: 3,
          },
          pcaAnalysis: {
            residualVarianceRatio: 0.05,
            additionalSignificantComponents: 0,
            topLoadingPrototypes: [],
          },
          hubPrototypes: [],
          coverageGaps: [],
          multiAxisConflicts: [
            { prototypeId: 'conflict_proto', conflictingAxes: ['arousal', 'valence', 'dominance'] },
          ],
          recommendations: [],
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();
      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const conflictList = document.getElementById('conflict-list');
      expect(conflictList.children.length).toBe(1);
      expect(conflictList.textContent).toContain('conflict_proto');
      expect(conflictList.textContent).toContain('arousal');
    });

    it('should render recommendations sorted by priority', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
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
          summary: {
            totalPrototypesAnalyzed: 15,
            recommendationCount: 3,
            signalBreakdown: {
              pcaSignals: 1,
              hubSignals: 0,
              coverageGapSignals: 1,
              multiAxisConflictSignals: 1,
            },
            confidence: 'high',
            potentialGapsDetected: 3,
          },
          pcaAnalysis: {
            residualVarianceRatio: 0.05,
            additionalSignificantComponents: 0,
            topLoadingPrototypes: [],
          },
          hubPrototypes: [],
          coverageGaps: [],
          multiAxisConflicts: [],
          recommendations: [
            { priority: 'low', type: 'add_axis', description: 'Low priority rec' },
            { priority: 'high', type: 'split_axis', description: 'High priority rec' },
            { priority: 'medium', type: 'refine_axis', description: 'Medium priority rec' },
          ],
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();
      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const recList = document.getElementById('axis-recommendations-list');
      const items = recList.querySelectorAll('.axis-recommendation');
      expect(items.length).toBe(3);
      // First should be high priority
      expect(items[0].classList.contains('priority-high')).toBe(true);
      // Second should be medium priority
      expect(items[1].classList.contains('priority-medium')).toBe(true);
      // Third should be low priority
      expect(items[2].classList.contains('priority-low')).toBe(true);
    });

    it('should escape HTML in prototype IDs and descriptions', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
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
          summary: {
            totalPrototypesAnalyzed: 15,
            recommendationCount: 3,
            signalBreakdown: {
              pcaSignals: 1,
              hubSignals: 0,
              coverageGapSignals: 1,
              multiAxisConflictSignals: 1,
            },
            confidence: 'high',
            potentialGapsDetected: 3,
          },
          pcaAnalysis: {
            residualVarianceRatio: 0.05,
            additionalSignificantComponents: 0,
            topLoadingPrototypes: [],
          },
          hubPrototypes: [
            { prototypeId: '<script>alert("xss")</script>', hubScore: 0.85 },
          ],
          coverageGaps: [],
          multiAxisConflicts: [],
          recommendations: [
            { priority: 'high', type: 'test', description: '<img onerror="alert(1)" src="x">' },
          ],
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();
      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const hubList = document.getElementById('hub-list');
      const recList = document.getElementById('axis-recommendations-list');

      // Verify HTML is escaped - no actual script tags
      expect(hubList.innerHTML).not.toContain('<script>');
      expect(hubList.innerHTML).toContain('&lt;script&gt;');
      expect(recList.innerHTML).not.toContain('<img');
      expect(recList.innerHTML).toContain('&lt;img');
    });

    it('should update progress for axis_gap_analysis stage', async () => {
      let progressCallback;
      mockAnalyzer.analyze.mockImplementation(async ({ onProgress }) => {
        progressCallback = onProgress;
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
          axisGapAnalysis: null,
        };
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();
      const runPromise = document.getElementById('run-analysis-btn').click();

      // Wait for analyze to be called
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Simulate progress callback for axis_gap_analysis stage
      progressCallback('axis_gap_analysis', { stageNumber: 5, totalStages: 5 });

      const progressStatus = document.getElementById('progress-status');
      expect(progressStatus.textContent).toContain('Analyzing axis gaps');

      await runPromise;
    });
  });

  describe('decision panel rendering', () => {
    const createAxisGapAnalysis = (overrides = {}) => ({
      summary: {
        totalPrototypesAnalyzed: 15,
        recommendationCount: 3,
        signalBreakdown: {
          pcaSignals: 0,
          hubSignals: 0,
          coverageGapSignals: 0,
          multiAxisConflictSignals: 0,
        },
        confidence: 'low',
        potentialGapsDetected: 0,
        ...overrides.summary,
      },
      pcaAnalysis: {
        residualVarianceRatio: 0.08,
        additionalSignificantComponents: 0,
        topLoadingPrototypes: [],
        explainedVarianceTop4: 0.85,
        ...overrides.pcaAnalysis,
      },
      hubPrototypes: overrides.hubPrototypes ?? [],
      coverageGaps: overrides.coverageGaps ?? [],
      multiAxisConflicts: overrides.multiAxisConflicts ?? [],
      recommendations: overrides.recommendations ?? [],
      prototypeWeightSummaries: overrides.prototypeWeightSummaries ?? [],
    });

    it('should render NO verdict when residual is below threshold and no signals', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
        recommendations: [],
        metadata: {
          prototypeFamily: 'emotion',
          totalPrototypes: 10,
          candidatePairsFound: 0,
          candidatePairsEvaluated: 0,
          redundantPairsFound: 0,
          sampleCountPerPair: 8000,
        },
        axisGapAnalysis: createAxisGapAnalysis({
          pcaAnalysis: { residualVarianceRatio: 0.08 },
          summary: {
            signalBreakdown: {
              pcaSignals: 0,
              hubSignals: 0,
              coverageGapSignals: 0,
              multiAxisConflictSignals: 0,
            },
          },
        }),
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();
      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const verdict = document.getElementById('decision-verdict');
      expect(verdict.textContent).toBe('NO');
      expect(verdict.classList.contains('verdict-no')).toBe(true);
    });

    it('should render YES verdict when highResidual AND coverageGaps', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
        recommendations: [],
        metadata: {
          prototypeFamily: 'emotion',
          totalPrototypes: 10,
          candidatePairsFound: 0,
          candidatePairsEvaluated: 0,
          redundantPairsFound: 0,
          sampleCountPerPair: 8000,
        },
        axisGapAnalysis: createAxisGapAnalysis({
          pcaAnalysis: { residualVariance: 0.20 },
          summary: {
            signalBreakdown: {
              pcaSignals: 1,
              hubSignals: 0,
              coverageGapSignals: 1,
              multiAxisConflictSignals: 0,
            },
          },
          coverageGaps: [{ clusterLabel: 'gap-1', distanceFromAxes: 0.7 }],
        }),
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();
      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const verdict = document.getElementById('decision-verdict');
      expect(verdict.textContent).toBe('YES');
      expect(verdict.classList.contains('verdict-yes')).toBe(true);
    });

    it('should render MAYBE verdict when highResidual only', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
        recommendations: [],
        metadata: {
          prototypeFamily: 'emotion',
          totalPrototypes: 10,
          candidatePairsFound: 0,
          candidatePairsEvaluated: 0,
          redundantPairsFound: 0,
          sampleCountPerPair: 8000,
        },
        axisGapAnalysis: createAxisGapAnalysis({
          pcaAnalysis: { residualVariance: 0.18 },
          summary: {
            signalBreakdown: {
              pcaSignals: 1,
              hubSignals: 0,
              coverageGapSignals: 0,
              multiAxisConflictSignals: 0,
            },
          },
        }),
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();
      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const verdict = document.getElementById('decision-verdict');
      expect(verdict.textContent).toBe('MAYBE');
      expect(verdict.classList.contains('verdict-maybe')).toBe(true);
    });

    it('should render variance summary with explained variance from top 4 PCs', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
        recommendations: [],
        metadata: {
          prototypeFamily: 'emotion',
          totalPrototypes: 10,
          candidatePairsFound: 0,
          candidatePairsEvaluated: 0,
          redundantPairsFound: 0,
          sampleCountPerPair: 8000,
        },
        axisGapAnalysis: createAxisGapAnalysis({
          pcaAnalysis: { explainedVariance: [0.30, 0.20, 0.10, 0.06] },
        }),
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();
      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const varianceTop4 = document.getElementById('variance-top4');
      expect(varianceTop4.textContent).toBe('66.0%');
    });

    it('should render rationale text matching verdict', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
        recommendations: [],
        metadata: {
          prototypeFamily: 'emotion',
          totalPrototypes: 10,
          candidatePairsFound: 0,
          candidatePairsEvaluated: 0,
          redundantPairsFound: 0,
          sampleCountPerPair: 8000,
        },
        axisGapAnalysis: createAxisGapAnalysis({
          pcaAnalysis: { residualVarianceRatio: 0.08 },
        }),
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();
      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const rationale = document.getElementById('decision-rationale');
      expect(rationale.textContent.length).toBeGreaterThan(0);
    });
  });

  describe('signal PASS/FAIL rendering', () => {
    it('should render PASS when signal count is 0', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
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
          summary: {
            totalPrototypesAnalyzed: 15,
            recommendationCount: 0,
            signalBreakdown: {
              pcaSignals: 0,
              hubSignals: 0,
              coverageGapSignals: 0,
              multiAxisConflictSignals: 0,
            },
            confidence: 'low',
            potentialGapsDetected: 0,
          },
          pcaAnalysis: {
            residualVarianceRatio: 0.08,
            additionalSignificantComponents: 0,
            topLoadingPrototypes: [],
          },
          hubPrototypes: [],
          coverageGaps: [],
          multiAxisConflicts: [],
          recommendations: [],
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();
      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const pcaStatus = document.getElementById('signal-pca-status');
      expect(pcaStatus.textContent).toContain('PASS');
      expect(pcaStatus.classList.contains('pass')).toBe(true);
    });

    it('should render FAIL when signal count is greater than 0', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
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
          summary: {
            totalPrototypesAnalyzed: 15,
            recommendationCount: 1,
            signalBreakdown: {
              pcaSignals: 1,
              hubSignals: 0,
              coverageGapSignals: 0,
              multiAxisConflictSignals: 0,
            },
            confidence: 'medium',
            potentialGapsDetected: 1,
          },
          pcaAnalysis: {
            residualVarianceRatio: 0.20,
            additionalSignificantComponents: 1,
            topLoadingPrototypes: [],
          },
          hubPrototypes: [],
          coverageGaps: [],
          multiAxisConflicts: [],
          recommendations: [],
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();
      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const pcaStatus = document.getElementById('signal-pca-status');
      expect(pcaStatus.textContent).toContain('FAIL');
      expect(pcaStatus.classList.contains('fail')).toBe(true);
    });
  });

  describe('prototype weight cards rendering', () => {
    it('should render prototype weight cards when prototypeWeightSummaries is present', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
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
          summary: {
            totalPrototypesAnalyzed: 15,
            recommendationCount: 0,
            signalBreakdown: {
              pcaSignals: 0,
              hubSignals: 0,
              coverageGapSignals: 0,
              multiAxisConflictSignals: 0,
            },
            confidence: 'low',
            potentialGapsDetected: 0,
          },
          pcaAnalysis: {
            residualVarianceRatio: 0.08,
            additionalSignificantComponents: 0,
            topLoadingPrototypes: [],
          },
          hubPrototypes: [],
          coverageGaps: [],
          multiAxisConflicts: [],
          recommendations: [],
          prototypeWeightSummaries: [
            {
              prototypeId: 'proto-1',
              topAxes: [
                { axis: 'valence', weight: 0.85 },
                { axis: 'arousal', weight: -0.42 },
              ],
              reason: 'high_reconstruction_error',
              metrics: { reconstructionError: 0.523 },
            },
          ],
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();
      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const container = document.getElementById('prototype-cards-container');
      expect(container.children.length).toBe(1);

      const card = container.querySelector('.prototype-card');
      expect(card).not.toBeNull();
      expect(card.textContent).toContain('proto-1');
    });

    it('should display top axes with correct formatting', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
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
          summary: {
            totalPrototypesAnalyzed: 15,
            recommendationCount: 0,
            signalBreakdown: {
              pcaSignals: 0,
              hubSignals: 0,
              coverageGapSignals: 0,
              multiAxisConflictSignals: 0,
            },
            confidence: 'low',
            potentialGapsDetected: 0,
          },
          pcaAnalysis: {
            residualVarianceRatio: 0.08,
            additionalSignificantComponents: 0,
            topLoadingPrototypes: [],
          },
          hubPrototypes: [],
          coverageGaps: [],
          multiAxisConflicts: [],
          recommendations: [],
          prototypeWeightSummaries: [
            {
              prototypeId: 'proto-1',
              topAxes: [
                { axis: 'valence', weight: 0.85 },
                { axis: 'arousal', weight: -0.42 },
              ],
              reason: 'high_reconstruction_error',
              metrics: { reconstructionError: 0.523 },
            },
          ],
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();
      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const container = document.getElementById('prototype-cards-container');
      const positiveWeight = container.querySelector('.weight-value.positive');
      const negativeWeight = container.querySelector('.weight-value.negative');

      expect(positiveWeight.textContent).toContain('+0.85');
      expect(negativeWeight.textContent).toContain('-0.42');
    });

    it('should render empty state when no prototypes flagged', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
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
          summary: {
            totalPrototypesAnalyzed: 15,
            recommendationCount: 0,
            signalBreakdown: {
              pcaSignals: 0,
              hubSignals: 0,
              coverageGapSignals: 0,
              multiAxisConflictSignals: 0,
            },
            confidence: 'low',
            potentialGapsDetected: 0,
          },
          pcaAnalysis: {
            residualVarianceRatio: 0.08,
            additionalSignificantComponents: 0,
            topLoadingPrototypes: [],
          },
          hubPrototypes: [],
          coverageGaps: [],
          multiAxisConflicts: [],
          recommendations: [],
          prototypeWeightSummaries: [],
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();
      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const container = document.getElementById('prototype-cards-container');
      expect(container.textContent).toContain('No prototypes flagged by detection methods.');
    });

    it('should display reason badge with correct text', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
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
          summary: {
            totalPrototypesAnalyzed: 15,
            recommendationCount: 0,
            signalBreakdown: {
              pcaSignals: 0,
              hubSignals: 0,
              coverageGapSignals: 0,
              multiAxisConflictSignals: 0,
            },
            confidence: 'low',
            potentialGapsDetected: 0,
          },
          pcaAnalysis: {
            residualVarianceRatio: 0.08,
            additionalSignificantComponents: 0,
            topLoadingPrototypes: [],
          },
          hubPrototypes: [],
          coverageGaps: [],
          multiAxisConflicts: [],
          recommendations: [],
          prototypeWeightSummaries: [
            {
              prototypeId: 'proto-1',
              topAxes: [{ axis: 'valence', weight: 0.85 }],
              reason: 'hub',
              metrics: { hubScore: 4.5 },
            },
          ],
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();
      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const container = document.getElementById('prototype-cards-container');
      const badge = container.querySelector('.prototype-reason-badge');

      expect(badge).not.toBeNull();
      expect(badge.textContent).toContain('Hub Prototype');
    });
  });

  describe('enhanced contextual explanations', () => {
    it('should include contextual explanations for hub prototypes', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
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
          summary: {
            totalPrototypesAnalyzed: 15,
            recommendationCount: 1,
            signalBreakdown: {
              pcaSignals: 0,
              hubSignals: 1,
              coverageGapSignals: 0,
              multiAxisConflictSignals: 0,
            },
            confidence: 'medium',
            potentialGapsDetected: 1,
          },
          pcaAnalysis: {
            residualVarianceRatio: 0.08,
            additionalSignificantComponents: 0,
            topLoadingPrototypes: [],
          },
          hubPrototypes: [
            {
              prototypeId: 'hub-proto',
              hubScore: 4.5,
              connectedClusters: 3,
              spanningAxes: 5,
            },
          ],
          coverageGaps: [],
          multiAxisConflicts: [],
          recommendations: [],
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();
      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const hubList = document.getElementById('hub-list');
      expect(hubList.textContent).toContain('Hub score');
      expect(hubList.textContent).toContain('connects');
    });

    it('should include contextual explanations for coverage gaps', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
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
          summary: {
            totalPrototypesAnalyzed: 15,
            recommendationCount: 1,
            signalBreakdown: {
              pcaSignals: 0,
              hubSignals: 0,
              coverageGapSignals: 1,
              multiAxisConflictSignals: 0,
            },
            confidence: 'medium',
            potentialGapsDetected: 1,
          },
          pcaAnalysis: {
            residualVarianceRatio: 0.08,
            additionalSignificantComponents: 0,
            topLoadingPrototypes: [],
          },
          hubPrototypes: [],
          coverageGaps: [
            {
              clusterLabel: 'gap-cluster',
              distanceFromAxes: 0.75,
              prototypeCount: 4,
            },
          ],
          multiAxisConflicts: [],
          recommendations: [],
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();
      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const gapList = document.getElementById('coverage-gap-list');
      expect(gapList.textContent).toContain('Distance');
      expect(gapList.textContent).toContain('uncovered region');
    });

    it('should include contextual explanations for multi-axis conflicts', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
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
          summary: {
            totalPrototypesAnalyzed: 15,
            recommendationCount: 1,
            signalBreakdown: {
              pcaSignals: 0,
              hubSignals: 0,
              coverageGapSignals: 0,
              multiAxisConflictSignals: 1,
            },
            confidence: 'medium',
            potentialGapsDetected: 1,
          },
          pcaAnalysis: {
            residualVarianceRatio: 0.08,
            additionalSignificantComponents: 0,
            topLoadingPrototypes: [],
          },
          hubPrototypes: [],
          coverageGaps: [],
          multiAxisConflicts: [
            {
              prototypeId: 'conflict-proto',
              axisCount: 6,
              signBalance: 45,
              conflictingAxes: ['axis1', 'axis2'],
            },
          ],
          recommendations: [],
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();
      document.getElementById('run-analysis-btn').click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const conflictList = document.getElementById('conflict-list');
      expect(conflictList.textContent).toContain('Uses');
      expect(conflictList.textContent).toContain('sign balance');
    });
  });
});
