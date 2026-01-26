/**
 * @file Integration tests for PrototypeAnalysisController
 * @description Tests the full integration of PrototypeAnalysisController with its
 * dependencies, focusing on the complete analysis workflow, rendering pipeline,
 * and interaction between all monster methods.
 *
 * Phase 1 of the refactoring plan requires these integration tests to be in place
 * BEFORE any extraction work begins to ensure no regressions are introduced.
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
import { flushPromises, waitForIndexedDB } from '../../../common/testWaitUtils.js';

/**
 * Helper to flush all pending async operations for the controller.
 * Uses multiple flush cycles to ensure promise chains complete.
 * @returns {Promise<void>}
 */
async function flushControllerAsync() {
  await flushPromises();
  await flushPromises();
  await flushPromises();
}

/**
 * Waits for an element's hidden property to change to expected value.
 * Uses polling to handle async rendering completion.
 * @param {HTMLElement} element - Element to observe
 * @param {boolean} expectedHidden - Expected hidden state
 * @param {number} timeout - Maximum wait time in ms
 * @returns {Promise<void>}
 */
async function waitForElementHidden(element, expectedHidden, timeout = 500) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const check = () => {
      if (element.hidden === expectedHidden) {
        resolve();
        return;
      }
      if (Date.now() - startTime > timeout) {
        reject(
          new Error(
            `Timeout waiting for element.hidden to be ${expectedHidden}. Current: ${element.hidden}`
          )
        );
        return;
      }
      setTimeout(check, 10);
    };
    check();
  });
}

describe('PrototypeAnalysisController - Integration', () => {
  let mockLogger;
  let mockAnalyzer;
  let controller;

  /**
   * Creates a complete DOM structure matching the prototype-analysis.html template.
   * This includes all elements bound by #bindDomElements (113 lines).
   */
  function setupFullDom() {
    document.body.innerHTML = `
      <section class="panel controls-panel">
        <div class="form-group">
          <label for="prototype-family">Prototype Family:</label>
          <select id="prototype-family" class="form-select">
            <option value="emotion">Emotions</option>
            <option value="sexual">Sexual States</option>
            <option value="both">Both (Combined)</option>
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
        <div id="recommendations-container" class="recommendations-container"></div>
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
          <div class="variance-summary-container">
            <div class="variance-summary">
              <span class="variance-label">Explained by top 4 PCs:</span>
              <span id="variance-top4" class="variance-value">--</span>
            </div>
            <div class="variance-summary variance-dynamic">
              <span class="variance-label">Expected axis count (K):</span>
              <span id="variance-axis-count" class="variance-value">--</span>
            </div>
            <div class="variance-summary variance-dynamic">
              <span class="variance-label">Explained by top K PCs:</span>
              <span id="variance-topk" class="variance-value">--</span>
            </div>
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
              <span id="signal-multi-axis-conflicts-threshold" class="signal-threshold">(high axis count)</span>
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
            <span class="metric-label">Significant Components (Broken-Stick):</span>
            <span id="significant-component-count" class="metric-value">--</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Expected Components (K):</span>
            <span id="expected-component-count" class="metric-value">--</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Significant Beyond K:</span>
            <span id="significant-beyond-expected" class="metric-value">--</span>
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
          <div id="pca-excluded-axes-list" class="excluded-axes-list"></div>
          <div id="pca-unused-axes-list" class="unused-axes-list"></div>
          <div id="pca-unused-in-gates-list" class="unused-in-gates-list"></div>
          <div id="pca-methodology-note" class="methodology-note"></div>
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

        <div class="sign-tensions">
          <h3>Sign Tensions</h3>
          <ul id="sign-tension-list" class="tension-list"></ul>
        </div>

        <div class="polarity-analysis">
          <h3>Polarity Analysis</h3>
          <ul id="polarity-analysis-list" class="polarity-list"></ul>
        </div>

        <div class="complexity-analysis">
          <h3>Complexity Analysis</h3>
          <div id="complexity-analysis-container" class="complexity-container"></div>
        </div>

        <div class="axis-recommendations">
          <h3>Axis Recommendations</h3>
          <ul id="axis-recommendations-list" class="axis-recommendations-list"></ul>
        </div>

        <div class="candidate-axis-validation">
          <h3>Candidate Axis Validation</h3>
          <ul id="candidate-axis-list" class="candidate-axis-list"></ul>
        </div>

        <div class="prototype-weight-cards">
          <h3>Flagged Prototypes Analysis</h3>
          <div id="prototype-cards-container" class="prototype-cards-container"></div>
        </div>

        <div class="integrity-panel">
          <h3>Data Integrity Checks</h3>
          <div class="integrity-item">
            <span id="integrity-axis-registry-status" class="integrity-status">--</span>
            <span class="integrity-label">Axis Registry</span>
          </div>
          <div class="integrity-item">
            <span id="integrity-schema-status" class="integrity-status">--</span>
            <span class="integrity-label">Schema Validation</span>
          </div>
          <div class="integrity-item">
            <span id="integrity-weight-range-status" class="integrity-status">--</span>
            <span class="integrity-label">Weight Range</span>
          </div>
          <div class="integrity-item">
            <span id="integrity-no-duplicates-status" class="integrity-status">--</span>
            <span class="integrity-label">No Duplicates</span>
          </div>
          <div id="integrity-summary" class="integrity-summary"></div>
        </div>
      </section>
    `;
  }

  /**
   * Creates a minimal analysis result for testing basic flow.
   * @returns {object} Minimal analysis result
   */
  function createMinimalAnalysisResult() {
    return {
      recommendations: [],
      nearMisses: [],
      metadata: {
        prototypeFamily: 'emotion',
        totalPrototypes: 10,
        candidatePairsFound: 5,
        candidatePairsEvaluated: 5,
        redundantPairsFound: 0,
        sampleCountPerPair: 8000,
        analysisMode: 'V3',
      },
      axisGapAnalysis: null,
    };
  }

  /**
   * Creates a comprehensive analysis result with all sections populated.
   * This exercises the full rendering pipeline including all monster methods.
   * @returns {object} Full analysis result
   */
  function createFullAnalysisResult() {
    return {
      recommendations: [
        {
          prototypeA: 'emotion:joy',
          prototypeB: 'emotion:happiness',
          behavioralSimilarity: 0.85,
          severity: 0.85,
          overlapType: 'high',
          type: 'MERGE',
          recommendation: 'MERGE',
          confidence: 0.92,
          summary: 'High behavioral similarity suggests redundancy',
          actionableInsight: 'Consider merging these prototypes',
          evidence: {
            sharedContexts: 12,
            divergentContexts: 3,
            contextOverlapRatio: 0.8,
            divergenceExamples: [
              { context: 'celebration', protoA: 'strong', protoB: 'moderate' },
            ],
          },
        },
        {
          prototypeA: 'emotion:fear',
          prototypeB: 'emotion:anxiety',
          behavioralSimilarity: 0.78,
          severity: 0.78,
          overlapType: 'moderate',
          type: 'DIFFERENTIATE',
          recommendation: 'DIFFERENTIATE',
          confidence: 0.75,
          summary: 'Moderate overlap with distinct characteristics',
          actionableInsight: 'Add differentiation criteria',
          evidence: {
            sharedContexts: 8,
            divergentContexts: 6,
            contextOverlapRatio: 0.57,
            divergenceExamples: [
              { context: 'future_threat', protoA: 'specific', protoB: 'general' },
            ],
          },
        },
      ],
      nearMisses: [
        {
          prototypeA: 'emotion:sadness',
          prototypeB: 'emotion:melancholy',
          behavioralSimilarity: 0.62,
          confidence: 0.65,
          reason: 'Borderline behavioral overlap',
        },
      ],
      metadata: {
        prototypeFamily: 'emotion',
        totalPrototypes: 25,
        candidatePairsFound: 300,
        candidatePairsEvaluated: 150,
        redundantPairsFound: 2,
        sampleCountPerPair: 50000,
        analysisMode: 'V3',
        poolSize: 50000,
        evaluationTime: 45000,
      },
      axisGapAnalysis: {
        // Summary section expected by #renderAxisGapSummary
        summary: {
          totalPrototypesAnalyzed: 25,
          recommendationCount: 2,
          potentialGapsDetected: 1,
          confidence: 'HIGH',
          signalBreakdown: {
            // Flat signal counts expected by controller's #renderSignalBreakdown
            pcaSignals: 1,
            hubSignals: 2,
            coverageGapSignals: 1,
            multiAxisConflictSignals: 0,
            // Keep detailed breakdown for reference
            pca: {
              residualVariance: 0.18,
              threshold: 0.15,
              passed: false,
            },
            hubs: {
              count: 2,
              passed: false,
            },
            coverageGaps: {
              count: 1,
              maxDistance: 0.72,
              threshold: 0.6,
              passed: false,
            },
            multiAxisConflicts: {
              count: 0,
              passed: true,
            },
          },
        },
        shouldAddAxis: true,
        decisionSummary: {
          verdict: 'YES',
          rationale: 'PCA analysis indicates significant unexplained variance.',
          varianceExplainedTop4: 0.72,
          varianceExplainedTopK: 0.82,
          expectedAxisCount: 4,
        },
        // pcaAnalysis (not pcaSummary) with correct field names
        pcaAnalysis: {
          residualVarianceRatio: 0.18,
          significantComponentCount: 5,
          expectedComponentCount: 4,
          significantBeyondExpected: 1,
          dimensionsUsed: ['valence', 'arousal', 'dominance', 'potency'],
          componentsFor80Pct: 3,
          componentsFor90Pct: 4,
          // Variance summary fields expected by #renderDecisionSummary
          explainedVariance: [0.35, 0.25, 0.12, 0.08, 0.05, 0.03],
          axisCount: 4,
          topLoadingPrototypes: [
            {
              prototypeId: 'emotion:extreme_joy',
              score: 0.85,
            },
            {
              prototypeId: 'emotion:deep_sadness',
              score: 0.78,
            },
          ],
          excludedSparseAxes: ['obscure_axis_1'],
          unusedDefinedAxes: ['defined_but_unused'],
          unusedInGates: ['gate_unused_axis'],
          reconstructionErrors: [
            {
              prototypeId: 'emotion:confusion',
              error: 0.55,
            },
          ],
        },
        hubPrototypes: [
          {
            prototypeId: 'emotion:neutral',
            hubScore: 0.82,
            connectedClusters: 4,
            spanningAxes: 3,
            explanation: 'Central hub connecting multiple emotion clusters',
          },
          {
            prototypeId: 'emotion:calm',
            hubScore: 0.65,
            connectedClusters: 2,
            spanningAxes: 2,
            explanation: 'Bridge between positive and negative valence',
          },
        ],
        coverageGaps: [
          {
            clusterLabel: 'High-Arousal Negative Cluster',
            distanceFromAxes: 0.72,
            prototypeCount: 3,
            explanation: 'No prototype covers extreme negative arousal states',
          },
        ],
        multiAxisConflicts: [],
        signTensions: [
          {
            axis: 'valence',
            prototype: 'emotion:bittersweet',
            tension: 'Mixed positive/negative signals',
            severity: 'moderate',
          },
        ],
        polarityAnalysis: [
          {
            axis: 'arousal',
            positiveCount: 12,
            negativeCount: 8,
            neutralCount: 5,
            balance: 0.6,
          },
        ],
        complexityAnalysis: {
          averageAxisCount: 2.8,
          maxAxisCount: 5,
          minAxisCount: 1,
          histogram: [
            { binStart: 1, binEnd: 2, count: 5 },
            { binStart: 2, binEnd: 3, count: 12 },
            { binStart: 3, binEnd: 4, count: 6 },
            { binStart: 4, binEnd: 5, count: 2 },
          ],
        },
        // Controller expects 'recommendations', not 'axisRecommendations'
        recommendations: [
          {
            type: 'ADD',
            axis: 'temporal_duration',
            rationale: 'Emotions differ in expected duration',
            confidence: 0.78,
          },
          {
            type: 'REFINE',
            axis: 'valence',
            rationale: 'Consider splitting into hedonic vs evaluative',
            confidence: 0.65,
          },
        ],
        candidateAxisValidation: [
          {
            axis: 'intensity',
            status: 'VALID',
            coverage: 0.92,
            issues: [],
          },
          {
            axis: 'social_context',
            status: 'PARTIAL',
            coverage: 0.45,
            issues: ['Low coverage in negative emotions'],
          },
        ],
        prototypeWeightCards: [
          {
            prototype: 'emotion:joy',
            flags: ['hub', 'high_connectivity'],
            weights: { valence: 0.9, arousal: 0.7, dominance: 0.6 },
            whyFlagged: 'Serves as cluster center for positive emotions',
          },
        ],
        integrityChecks: {
          axisRegistry: { passed: true, message: 'All axes registered' },
          schemaValidation: { passed: true, message: 'Schema valid' },
          weightRange: { passed: true, message: 'Weights in valid range' },
          noDuplicates: { passed: true, message: 'No duplicate prototypes' },
          summary: 'All integrity checks passed',
        },
      },
    };
  }

  beforeEach(() => {
    setupFullDom();

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
    controller = null;
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('Full Analysis Workflow Integration', () => {
    it('should execute complete analysis workflow from initialization to results', async () => {
      const fullResult = createFullAnalysisResult();

      // Use mockResolvedValue - simpler and proven to work in debug test
      mockAnalyzer.analyze.mockResolvedValue(fullResult);

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      // Verify initialization completed
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[PrototypeAnalysisController] Initialized'
      );

      // Trigger analysis
      const runBtn = document.getElementById('run-analysis-btn');
      expect(runBtn.disabled).toBe(false);
      runBtn.click();

      // Wait for async operations (match debug test pattern)
      await new Promise((resolve) => setTimeout(resolve, 100));
      await flushPromises();

      // Verify analyzer was called and returned data
      expect(mockAnalyzer.analyze).toHaveBeenCalledWith(
        expect.objectContaining({
          prototypeFamily: 'emotion',
          onProgress: expect.any(Function),
        })
      );
      expect(fullResult.axisGapAnalysis).toBeDefined();

      // Verify results panel is shown
      const resultsPanel = document.getElementById('results-panel');
      expect(resultsPanel.hidden).toBe(false);

      // Verify recommendations were rendered
      const recommendationsContainer = document.getElementById(
        'recommendations-container'
      );
      expect(recommendationsContainer.innerHTML).not.toBe('');

      // Verify axis gap panel is shown with data
      const axisGapPanel = document.getElementById('axis-gap-panel');
      expect(axisGapPanel.hidden).toBe(false);

      // Verify completion log
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Analysis complete')
      );
    });

    it('should handle empty results gracefully', async () => {
      mockAnalyzer.analyze.mockResolvedValue(createMinimalAnalysisResult());

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await flushControllerAsync();

      // Empty state should be shown when no recommendations
      const emptyState = document.getElementById('empty-state');
      expect(emptyState.hidden).toBe(false);

      // Results panel should still be visible
      const resultsPanel = document.getElementById('results-panel');
      expect(resultsPanel.hidden).toBe(false);
    });

    it('should handle analysis errors and display error message', async () => {
      const testError = new Error('Network timeout during prototype fetch');
      mockAnalyzer.analyze.mockRejectedValue(testError);

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await flushControllerAsync();

      // Error should be logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[PrototypeAnalysisController] Analysis failed',
        testError
      );

      // Controls should be re-enabled after error
      expect(runBtn.disabled).toBe(false);
    });

    it('should prevent concurrent analysis executions', async () => {
      let resolveFirst;
      mockAnalyzer.analyze.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      );

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');

      // Start first analysis
      runBtn.click();
      await flushControllerAsync();

      // Button should be disabled while analysis is in progress
      // This is the primary protection against concurrent execution
      expect(runBtn.disabled).toBe(true);

      // Only one analysis call should have been made
      expect(mockAnalyzer.analyze).toHaveBeenCalledTimes(1);

      // Complete first analysis
      resolveFirst(createMinimalAnalysisResult());
      await flushControllerAsync();

      // Button should be re-enabled after analysis completes
      expect(runBtn.disabled).toBe(false);
    });
  });

  describe('Progress Tracking Integration (monster method: #handleProgress)', () => {
    it('should track progress through all V2 stages', async () => {
      let progressCallback;
      mockAnalyzer.analyze.mockImplementation((options) => {
        progressCallback = options.onProgress;
        return Promise.resolve(createMinimalAnalysisResult());
      });

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await flushControllerAsync();

      const progressBar = document.getElementById('progress-bar');
      const progressStatus = document.getElementById('progress-status');

      // V2 mode has 4 stages (no setup)
      const stages = ['filtering', 'evaluating', 'classifying', 'recommending'];

      // Test filtering stage
      progressCallback('filtering', {
        current: 5,
        total: 10,
        stageNumber: 1,
        totalStages: 4,
      });
      expect(progressStatus.textContent).toContain('Filtering');
      expect(parseFloat(progressBar.style.width)).toBeGreaterThan(0);

      // Test evaluating stage
      progressCallback('evaluating', {
        pairIndex: 5,
        pairTotal: 10,
        sampleIndex: 4000,
        sampleTotal: 8000,
        stageNumber: 2,
        totalStages: 4,
      });
      expect(progressStatus.textContent).toContain('Pair');

      // Test classifying stage
      progressCallback('classifying', {
        pairIndex: 3,
        pairTotal: 10,
        stageNumber: 3,
        totalStages: 4,
      });
      expect(progressStatus.textContent).toContain('Classifying');

      // Test recommending stage
      progressCallback('recommending', {
        pairIndex: 7,
        pairTotal: 10,
        stageNumber: 4,
        totalStages: 4,
      });
      expect(progressStatus.textContent).toContain('Building recommendations');
    });

    it('should track progress through all V3 stages including setup', async () => {
      let progressCallback;
      mockAnalyzer.analyze.mockImplementation((options) => {
        progressCallback = options.onProgress;
        return Promise.resolve(createMinimalAnalysisResult());
      });

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await flushControllerAsync();

      const progressStatus = document.getElementById('progress-status');

      // V3 mode: test setup phase with sub-phases
      progressCallback('setup', {
        phase: 'pool',
        poolCurrent: 25000,
        poolTotal: 50000,
        stageNumber: 1,
        totalStages: 5,
      });
      expect(progressStatus.textContent).toContain('context pool');

      progressCallback('setup', {
        phase: 'vectors',
        vectorCurrent: 10,
        vectorTotal: 25,
        stageNumber: 1,
        totalStages: 5,
      });
      expect(progressStatus.textContent).toContain('vectors');

      progressCallback('setup', {
        phase: 'profiles',
        stageNumber: 1,
        totalStages: 5,
      });
      expect(progressStatus.textContent).toContain('profiles');

      // Test axis_gap_analysis stage (V3 specific)
      progressCallback('axis_gap_analysis', {
        stageNumber: 5,
        totalStages: 5,
      });
      expect(progressStatus.textContent).toContain('Analyzing axis gaps');
    });

    it('should update button text with percentage during progress', async () => {
      let progressCallback;
      mockAnalyzer.analyze.mockImplementation((options) => {
        progressCallback = options.onProgress;
        return Promise.resolve(createMinimalAnalysisResult());
      });

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      const originalText = runBtn.textContent.trim();

      runBtn.click();
      await flushControllerAsync();

      // Simulate 50% progress
      progressCallback('evaluating', {
        pairIndex: 5,
        pairTotal: 10,
        sampleIndex: 0,
        sampleTotal: 8000,
        stageNumber: 2,
        totalStages: 4,
      });

      // Button should show percentage
      expect(runBtn.textContent).toMatch(/\d+%/);
      expect(runBtn.textContent).not.toBe(originalText);
    });
  });

  describe('PCA Rendering Integration (monster method: #renderPCASummary)', () => {
    it('should render complete PCA summary with all metrics', async () => {
      const fullResult = createFullAnalysisResult();
      mockAnalyzer.analyze.mockResolvedValue(fullResult);

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await flushControllerAsync();

      // Verify PCA metrics are populated
      const residualVariance = document.getElementById('residual-variance');
      expect(residualVariance.textContent).not.toBe('--');

      const significantCount = document.getElementById(
        'significant-component-count'
      );
      expect(significantCount.textContent).not.toBe('--');

      const expectedCount = document.getElementById('expected-component-count');
      expect(expectedCount.textContent).not.toBe('--');

      const beyondExpected = document.getElementById(
        'significant-beyond-expected'
      );
      expect(beyondExpected.textContent).not.toBe('--');

      const componentsFor80 = document.getElementById('components-for-80');
      expect(componentsFor80.textContent).not.toBe('--');

      const componentsFor90 = document.getElementById('components-for-90');
      expect(componentsFor90.textContent).not.toBe('--');
    });

    it('should render principal components list', async () => {
      const fullResult = createFullAnalysisResult();
      mockAnalyzer.analyze.mockResolvedValue(fullResult);

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await flushControllerAsync();

      const dimensionsList = document.getElementById('pca-dimensions-list');
      expect(dimensionsList.innerHTML).not.toBe('');
    });

    it('should render top loadings', async () => {
      const fullResult = createFullAnalysisResult();
      mockAnalyzer.analyze.mockResolvedValue(fullResult);

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await flushControllerAsync();

      const topLoading = document.getElementById('pca-top-loading');
      expect(topLoading.innerHTML).not.toBe('');
    });

    it('should render poorly fitting prototypes', async () => {
      const fullResult = createFullAnalysisResult();
      mockAnalyzer.analyze.mockResolvedValue(fullResult);

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await flushControllerAsync();

      const poorlyFittingList = document.getElementById('poorly-fitting-list');
      expect(poorlyFittingList.children.length).toBeGreaterThan(0);
    });
  });

  describe('Axis Gap Rendering Integration', () => {
    it('should render axis gap summary metrics', async () => {
      const fullResult = createFullAnalysisResult();
      mockAnalyzer.analyze.mockResolvedValue(fullResult);

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await flushControllerAsync();

      const totalPrototypes = document.getElementById(
        'axis-gap-total-prototypes'
      );
      expect(totalPrototypes.textContent).toBe('25');

      const confidence = document.getElementById('axis-gap-confidence');
      expect(confidence.textContent).not.toBe('--');
    });

    it('should render hub prototypes list', async () => {
      const fullResult = createFullAnalysisResult();
      mockAnalyzer.analyze.mockResolvedValue(fullResult);

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await flushControllerAsync();

      const hubList = document.getElementById('hub-list');
      expect(hubList.children.length).toBe(2);
    });

    it('should render coverage gaps', async () => {
      const fullResult = createFullAnalysisResult();
      mockAnalyzer.analyze.mockResolvedValue(fullResult);

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await flushControllerAsync();

      const coverageGapList = document.getElementById('coverage-gap-list');
      expect(coverageGapList.children.length).toBe(1);
    });

    it('should render sign tensions', async () => {
      const fullResult = createFullAnalysisResult();
      mockAnalyzer.analyze.mockResolvedValue(fullResult);

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await flushControllerAsync();

      const signTensionList = document.getElementById('sign-tension-list');
      expect(signTensionList.children.length).toBe(1);
    });

    it('should render axis recommendations', async () => {
      const fullResult = createFullAnalysisResult();
      mockAnalyzer.analyze.mockResolvedValue(fullResult);

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await flushControllerAsync();

      const axisRecommendationsList = document.getElementById(
        'axis-recommendations-list'
      );
      expect(axisRecommendationsList.children.length).toBe(2);
    });
  });

  describe('Decision Summary Rendering (monster method: #renderDecisionSummary)', () => {
    it('should render YES verdict with appropriate styling', async () => {
      const fullResult = createFullAnalysisResult();
      mockAnalyzer.analyze.mockResolvedValue(fullResult);

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await flushControllerAsync();

      const decisionVerdict = document.getElementById('decision-verdict');
      expect(decisionVerdict.textContent).toBe('YES');
      expect(decisionVerdict.classList.contains('verdict-yes')).toBe(true);

      const decisionRationale = document.getElementById('decision-rationale');
      // Controller computes rationale based on: high residual + coverage gaps
      expect(decisionRationale.textContent).toContain('residual variance');
    });

    it('should render NO verdict when axis not recommended', async () => {
      const resultWithNoAxis = createFullAnalysisResult();
      resultWithNoAxis.axisGapAnalysis.shouldAddAxis = false;
      resultWithNoAxis.axisGapAnalysis.decisionSummary.verdict = 'NO';
      resultWithNoAxis.axisGapAnalysis.decisionSummary.rationale =
        'Current axis coverage is sufficient.';
      // Controller computes verdict from signals, not from decisionSummary.verdict
      // For NO verdict: residualVariance < 15% AND no signals
      resultWithNoAxis.axisGapAnalysis.pcaAnalysis.residualVarianceRatio = 0.1;
      resultWithNoAxis.axisGapAnalysis.summary.signalBreakdown.pcaSignals = 0;
      resultWithNoAxis.axisGapAnalysis.summary.signalBreakdown.hubSignals = 0;
      resultWithNoAxis.axisGapAnalysis.summary.signalBreakdown.coverageGapSignals = 0;
      resultWithNoAxis.axisGapAnalysis.summary.signalBreakdown.multiAxisConflictSignals = 0;

      mockAnalyzer.analyze.mockResolvedValue(resultWithNoAxis);

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await flushControllerAsync();

      const decisionVerdict = document.getElementById('decision-verdict');
      expect(decisionVerdict.textContent).toBe('NO');
      expect(decisionVerdict.classList.contains('verdict-no')).toBe(true);
    });

    it('should render variance summary metrics', async () => {
      const fullResult = createFullAnalysisResult();
      mockAnalyzer.analyze.mockResolvedValue(fullResult);

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await flushControllerAsync();

      const varianceTop4 = document.getElementById('variance-top4');
      expect(varianceTop4.textContent).not.toBe('--');

      const varianceAxisCount = document.getElementById('variance-axis-count');
      expect(varianceAxisCount.textContent).not.toBe('--');

      const varianceTopK = document.getElementById('variance-topk');
      expect(varianceTopK.textContent).not.toBe('--');
    });
  });

  describe('Signal Breakdown Rendering', () => {
    it('should render signal status badges correctly', async () => {
      const fullResult = createFullAnalysisResult();
      mockAnalyzer.analyze.mockResolvedValue(fullResult);

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await flushControllerAsync();

      // PCA should fail (residual > threshold)
      const signalPcaStatus = document.getElementById('signal-pca-status');
      expect(
        signalPcaStatus.classList.contains('fail') ||
          signalPcaStatus.textContent.includes('FAIL')
      ).toBe(true);

      // Multi-axis conflicts should pass (0 conflicts)
      const signalConflictsStatus = document.getElementById(
        'signal-multi-axis-conflicts-status'
      );
      expect(
        signalConflictsStatus.classList.contains('pass') ||
          signalConflictsStatus.textContent.includes('PASS')
      ).toBe(true);
    });

    it('should update signal values', async () => {
      const fullResult = createFullAnalysisResult();
      mockAnalyzer.analyze.mockResolvedValue(fullResult);

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await flushControllerAsync();

      const signalPca = document.getElementById('signal-pca');
      expect(signalPca.textContent).toBe('1');

      const signalHubs = document.getElementById('signal-hubs');
      expect(signalHubs.textContent).toBe('2');

      const signalCoverageGaps = document.getElementById('signal-coverage-gaps');
      expect(signalCoverageGaps.textContent).toBe('1');

      const signalConflicts = document.getElementById(
        'signal-multi-axis-conflicts'
      );
      expect(signalConflicts.textContent).toBe('0');
    });
  });

  describe('Complexity Analysis Rendering (monster method: #renderComplexityAnalysis)', () => {
    it('should render complexity histogram', async () => {
      const fullResult = createFullAnalysisResult();
      mockAnalyzer.analyze.mockResolvedValue(fullResult);

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await flushControllerAsync();

      const complexityContainer = document.getElementById(
        'complexity-analysis-container'
      );
      expect(complexityContainer.innerHTML).not.toBe('');
    });
  });

  describe('Metadata Rendering (monster method: #renderMetadata)', () => {
    it('should render all metadata fields', async () => {
      const fullResult = createFullAnalysisResult();
      mockAnalyzer.analyze.mockResolvedValue(fullResult);

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await flushControllerAsync();

      const resultsMetadata = document.getElementById('results-metadata');
      expect(resultsMetadata.innerHTML).not.toBe('');

      // Check that key metadata values are present
      expect(resultsMetadata.textContent).toContain('25'); // totalPrototypes
      expect(resultsMetadata.textContent).toContain('emotion'); // prototypeFamily
    });
  });

  describe('Prototype Weight Cards Rendering', () => {
    it('should render prototype weight cards', async () => {
      const fullResult = createFullAnalysisResult();
      mockAnalyzer.analyze.mockResolvedValue(fullResult);

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await flushControllerAsync();

      const cardsContainer = document.getElementById(
        'prototype-cards-container'
      );
      expect(cardsContainer.children.length).toBeGreaterThan(0);
    });
  });

  describe('Integrity Display Rendering', () => {
    it('should render integrity check statuses', async () => {
      const fullResult = createFullAnalysisResult();
      mockAnalyzer.analyze.mockResolvedValue(fullResult);

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await flushControllerAsync();

      const axisRegistryStatus = document.getElementById(
        'integrity-axis-registry-status'
      );
      expect(axisRegistryStatus.textContent).not.toBe('--');

      const schemaStatus = document.getElementById('integrity-schema-status');
      expect(schemaStatus.textContent).not.toBe('--');

      const weightRangeStatus = document.getElementById(
        'integrity-weight-range-status'
      );
      expect(weightRangeStatus.textContent).not.toBe('--');

      const noDuplicatesStatus = document.getElementById(
        'integrity-no-duplicates-status'
      );
      expect(noDuplicatesStatus.textContent).not.toBe('--');

      const integritySummary = document.getElementById('integrity-summary');
      expect(integritySummary.textContent).toContain('passed');
    });
  });

  describe('Near-Misses Rendering', () => {
    it('should render near-miss section when data is present', async () => {
      const fullResult = createFullAnalysisResult();
      mockAnalyzer.analyze.mockResolvedValue(fullResult);

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await flushControllerAsync();

      const recommendationsContainer = document.getElementById(
        'recommendations-container'
      );
      // Near misses section should be rendered after recommendations
      expect(recommendationsContainer.innerHTML).toContain('near-miss');
    });
  });

  describe('Recommendation Cards Rendering', () => {
    it('should render recommendation cards with all details', async () => {
      const fullResult = createFullAnalysisResult();
      mockAnalyzer.analyze.mockResolvedValue(fullResult);

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();

      await flushControllerAsync();

      const recommendationsContainer = document.getElementById(
        'recommendations-container'
      );

      // Should have 2 recommendation cards
      const cards = recommendationsContainer.querySelectorAll(
        '.recommendation-card, [class*="recommendation"]'
      );
      expect(cards.length).toBeGreaterThanOrEqual(2);

      // Check that key data is rendered
      expect(recommendationsContainer.textContent).toContain('joy');
      expect(recommendationsContainer.textContent).toContain('happiness');
    });
  });

  describe('State Management', () => {
    it('should reset UI state between consecutive analyses', async () => {
      mockAnalyzer.analyze
        .mockResolvedValueOnce(createFullAnalysisResult())
        .mockResolvedValueOnce(createMinimalAnalysisResult());

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');

      // First analysis
      runBtn.click();
      await flushControllerAsync();

      // Verify full results rendered
      const hubList = document.getElementById('hub-list');
      expect(hubList.children.length).toBe(2);

      // Second analysis (minimal results with axisGapAnalysis: null)
      runBtn.click();
      await flushControllerAsync();

      // Controller hides the axis gap panel when axisGapAnalysis is null
      // (doesn't clear the list contents, but hides the panel)
      const axisGapPanel = document.getElementById('axis-gap-panel');
      expect(axisGapPanel.hidden).toBe(true);
    });

    it('should restore button text after analysis completion', async () => {
      mockAnalyzer.analyze.mockResolvedValue(createMinimalAnalysisResult());

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      const originalText = runBtn.textContent.trim();

      runBtn.click();
      await flushControllerAsync();

      expect(runBtn.textContent.trim()).toBe(originalText);
    });

    it('should restore button text after analysis error', async () => {
      mockAnalyzer.analyze.mockRejectedValue(new Error('Test error'));

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      const originalText = runBtn.textContent.trim();

      runBtn.click();
      await flushControllerAsync();

      expect(runBtn.textContent.trim()).toBe(originalText);
      expect(runBtn.disabled).toBe(false);
    });
  });

  describe('DOM Element Binding Validation', () => {
    it('should handle missing non-critical DOM elements gracefully', async () => {
      // Remove some optional elements
      document.getElementById('polarity-analysis-list')?.remove();
      document.getElementById('complexity-analysis-container')?.remove();

      mockAnalyzer.analyze.mockResolvedValue(createFullAnalysisResult());

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      // Should not throw during initialization
      await controller.initialize();

      // Should not throw during analysis
      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();
      await flushControllerAsync();

      // Analysis should complete without errors
      expect(mockLogger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('Cannot read properties of null')
      );
    });

    it('should warn when run button is missing', async () => {
      document.getElementById('run-analysis-btn')?.remove();

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[PrototypeAnalysisController] Run analysis button not found'
      );
    });
  });

  describe('HTML Escaping and Security', () => {
    it('should escape HTML in prototype names to prevent XSS', async () => {
      const maliciousResult = createMinimalAnalysisResult();
      maliciousResult.recommendations = [
        {
          prototypeA: '<script>alert("xss")</script>',
          prototypeB: 'emotion:normal',
          behavioralSimilarity: 0.85,
          severity: 0.85,
          overlapType: 'high',
          type: 'MERGE',
          recommendation: 'MERGE',
          confidence: 0.92,
          summary: 'Test XSS escaping',
          actionableInsight: 'Verify proper escaping',
          evidence: {
            sharedContexts: 12,
            divergentContexts: 3,
            contextOverlapRatio: 0.8,
            divergenceExamples: [{ context: 'test', protoA: 'a', protoB: 'b' }],
          },
        },
      ];

      mockAnalyzer.analyze.mockResolvedValue(maliciousResult);

      controller = new PrototypeAnalysisController({
        logger: mockLogger,
        prototypeOverlapAnalyzer: mockAnalyzer,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-analysis-btn');
      runBtn.click();
      await flushControllerAsync();

      const recommendationsContainer = document.getElementById(
        'recommendations-container'
      );

      // Script tags should be escaped, not executed
      expect(recommendationsContainer.innerHTML).not.toContain(
        '<script>alert("xss")</script>'
      );
      expect(
        recommendationsContainer.innerHTML.includes('&lt;script&gt;') ||
          recommendationsContainer.textContent.includes('<script>')
      ).toBe(true);
    });
  });
});
