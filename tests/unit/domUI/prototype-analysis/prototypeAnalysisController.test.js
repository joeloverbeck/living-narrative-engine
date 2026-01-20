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
        <div class="form-group">
          <label for="sample-count">Sample Count:</label>
          <select id="sample-count" class="form-select">
            <option value="2000">2,000 (Fast)</option>
            <option value="8000" selected>8,000 (Standard)</option>
            <option value="20000">20,000 (Thorough)</option>
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

      const sampleSelect = document.getElementById('sample-count');
      expect(sampleSelect.disabled).toBe(false);
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
          const sampleSelect = document.getElementById('sample-count');

          expect(runBtn.disabled).toBe(true);
          expect(familySelect.disabled).toBe(true);
          expect(sampleSelect.disabled).toBe(true);

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
      // Filtering is 0-2% of progress, so 1/2 complete = 1%
      expect(progressBar.style.width).toBe('1%');
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
      // percent = 2 + 0.55 * 98 ≈ 55.9% (floating point may vary slightly)
      const width = parseFloat(progressBar.style.width);
      expect(width).toBeCloseTo(55.9, 1);
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

      // Check filtering stage status
      progressCallback('filtering', { current: 3, total: 10 });
      expect(progressStatus.textContent).toBe(
        'Filtering candidates (3/10)...'
      );

      // Check filtering complete status
      progressCallback('filtering', { current: 10, total: 10 });
      expect(progressStatus.textContent).toBe('Filtering complete');

      // Check evaluating stage status - pair 5 of 20, sample 4000 of 8000
      progressCallback('evaluating', {
        pairIndex: 4,
        pairTotal: 20,
        sampleIndex: 4000,
        sampleTotal: 8000,
      });
      // Status shows: "Pair 5/20 (50%)..." (pairIndex+1 for 1-based display)
      expect(progressStatus.textContent).toBe('Pair 5/20 (50%)...');

      // Check evaluation complete status - all pairs complete
      progressCallback('evaluating', {
        pairIndex: 20,
        pairTotal: 20,
        sampleIndex: 8000,
        sampleTotal: 8000,
      });
      // Status shows: "Pair 21/20 (100%)..." when complete
      expect(progressStatus.textContent).toBe('Pair 21/20 (100%)...');
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
      expect(document.getElementById('sample-count').disabled).toBe(false);
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
          sampleCountPerPair: 2000,
        },
      });

      const controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      // Change selection
      document.getElementById('prototype-family').value = 'sexual';
      document.getElementById('sample-count').value = '2000';

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockAnalyzer.analyze).toHaveBeenCalledWith(
        expect.objectContaining({
          prototypeFamily: 'sexual',
          sampleCount: 2000,
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

  describe('card expansion', () => {
    it('should bind card expander buttons', async () => {
      mockAnalyzer.analyze.mockResolvedValue({
        recommendations: [
          {
            prototypeA: 'joy',
            prototypeB: 'happiness',
            severity: 0.85,
            type: 'structurally_redundant',
            summary: 'Test summary',
            actionableInsight: 'Test insight',
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

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      const expander = document.querySelector('.rec-expander');
      const details = document.querySelector('.rec-details');

      expect(expander.getAttribute('aria-expanded')).toBe('false');
      expect(details.hidden).toBe(true);

      // Click to expand
      expander.click();

      expect(expander.getAttribute('aria-expanded')).toBe('true');
      expect(expander.textContent).toBe('Hide Details');
      expect(details.hidden).toBe(false);

      // Click to collapse
      expander.click();

      expect(expander.getAttribute('aria-expanded')).toBe('false');
      expect(expander.textContent).toBe('Show Details');
      expect(details.hidden).toBe(true);
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
      expect(document.getElementById('sample-count').disabled).toBe(false);
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
});
