import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import PrototypeAnalysisController from '../../../../src/domUI/prototype-analysis/PrototypeAnalysisController.js';
import { flushPromises } from '../../../common/testWaitUtils.js';

describe('Debug test', () => {
  let mockLogger;
  let mockAnalyzer;

  function createFullAnalysisResult() {
    return {
      recommendations: [],
      nearMisses: [],
      metadata: {
        prototypeFamily: 'emotion',
        totalPrototypes: 25,
        candidatePairsFound: 300,
        candidatePairsEvaluated: 150,
        redundantPairsFound: 2,
        sampleCountPerPair: 50000,
        analysisMode: 'V3',
      },
      axisGapAnalysis: {
        summary: {
          totalPrototypesAnalyzed: 25,
          recommendationCount: 2,
          potentialGapsDetected: 1,
          confidence: 'HIGH',
          signalBreakdown: {
            pca: { signal: 1, residualVariance: 0.18, threshold: 0.15, passed: false },
            hubs: { signal: 2, count: 2, passed: false },
            coverageGaps: { signal: 1, count: 1, maxDistance: 0.72, threshold: 0.6, passed: false },
            multiAxisConflicts: { signal: 0, count: 0, passed: true },
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
        pcaAnalysis: {
          residualVarianceRatio: 0.18,
          significantComponentCount: 5,
          expectedComponentCount: 4,
          significantBeyondExpected: 1,
          dimensionsUsed: ['valence', 'arousal', 'dominance', 'potency'],
          componentsFor80Pct: 3,
          componentsFor90Pct: 4,
          topLoadingPrototypes: [
            { prototypeId: 'emotion:extreme_joy', score: 0.85 },
          ],
          excludedSparseAxes: [],
          unusedDefinedAxes: [],
          unusedInGates: [],
          reconstructionErrors: [{ prototypeId: 'emotion:confusion', error: 0.55 }],
        },
        hubPrototypes: [
          { prototypeId: 'emotion:neutral', hubScore: 0.82, connectedClusters: 4, spanningAxes: 3 },
        ],
        coverageGaps: [
          { clusterLabel: 'High-Arousal Negative Cluster', distanceFromAxes: 0.72, prototypeCount: 3 },
        ],
        multiAxisConflicts: [],
        signTensions: [],
        polarityAnalysis: [],
        complexityAnalysis: null,
        axisRecommendations: [],
        candidateAxisValidation: [],
        prototypeWeightCards: [],
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

  function setupFullDom() {
    document.body.innerHTML = `
      <section class="panel controls-panel">
        <div class="form-group">
          <label for="prototype-family">Prototype Family:</label>
          <select id="prototype-family" class="form-select">
            <option value="emotion">Emotions</option>
          </select>
        </div>
        <button id="run-analysis-btn" class="action-button" disabled>Run Analysis</button>
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
        <span id="axis-gap-total-prototypes" class="summary-value">--</span>
        <span id="axis-gap-recommendations" class="summary-value">--</span>
        <span id="axis-gap-confidence" class="summary-value confidence-badge">--</span>
        <div id="decision-panel" class="decision-panel">
          <span id="decision-verdict" class="decision-badge verdict-no">NO</span>
          <p id="decision-rationale" class="decision-rationale">Analysis not yet run.</p>
          <span id="variance-top4" class="variance-value">--</span>
          <span id="variance-axis-count" class="variance-value">--</span>
          <span id="variance-topk" class="variance-value">--</span>
        </div>
        <span id="signal-pca" class="signal-value">0</span>
        <span id="signal-pca-status" class="signal-status pass">✓ PASS</span>
        <span id="signal-pca-threshold" class="signal-threshold">(residual ≤15%)</span>
        <span id="signal-hubs" class="signal-value">0</span>
        <span id="signal-hubs-status" class="signal-status pass">✓ PASS</span>
        <span id="signal-coverage-gaps" class="signal-value">0</span>
        <span id="signal-coverage-gaps-status" class="signal-status pass">✓ PASS</span>
        <span id="signal-coverage-gaps-threshold" class="signal-threshold">(distance ≤0.6)</span>
        <span id="signal-multi-axis-conflicts" class="signal-value">0</span>
        <span id="signal-multi-axis-conflicts-status" class="signal-status pass">✓ PASS</span>
        <span id="residual-variance" class="metric-value">--</span>
        <span id="significant-component-count" class="metric-value">--</span>
        <span id="expected-component-count" class="metric-value">--</span>
        <span id="significant-beyond-expected" class="metric-value">--</span>
        <span id="pca-dimensions-used" class="metric-value">--</span>
        <span id="components-for-80" class="metric-value">--</span>
        <span id="components-for-90" class="metric-value">--</span>
        <div id="pca-dimensions-list" class="dimensions-list"></div>
        <div id="pca-top-loading" class="top-loading-list"></div>
        <div id="pca-excluded-axes-list" class="excluded-axes-list"></div>
        <div id="pca-unused-axes-list" class="unused-axes-list"></div>
        <div id="pca-unused-in-gates-list" class="unused-in-gates-list"></div>
        <div id="pca-methodology-note" class="methodology-note"></div>
        <ul id="poorly-fitting-list" class="poorly-fitting-list"></ul>
        <ul id="hub-list" class="prototype-list"></ul>
        <ul id="coverage-gap-list" class="gap-list"></ul>
        <ul id="conflict-list" class="conflict-list"></ul>
        <ul id="sign-tension-list" class="tension-list"></ul>
        <ul id="polarity-analysis-list" class="polarity-list"></ul>
        <div id="complexity-analysis-container" class="complexity-container"></div>
        <ul id="axis-recommendations-list" class="axis-recommendations-list"></ul>
        <ul id="candidate-axis-list" class="candidate-axis-list"></ul>
        <div id="prototype-cards-container" class="prototype-cards-container"></div>
        <span id="integrity-axis-registry-status" class="integrity-status">--</span>
        <span id="integrity-schema-status" class="integrity-status">--</span>
        <span id="integrity-weight-range-status" class="integrity-status">--</span>
        <span id="integrity-no-duplicates-status" class="integrity-status">--</span>
        <div id="integrity-summary" class="integrity-summary"></div>
      </section>
    `;
  }

  beforeEach(() => {
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

  it('should render axis gap panel with full result', async () => {
    setupFullDom();

    const fullResult = createFullAnalysisResult();
    mockAnalyzer.analyze.mockResolvedValue(fullResult);

    const controller = new PrototypeAnalysisController({
      logger: mockLogger,
      prototypeOverlapAnalyzer: mockAnalyzer,
    });

    await controller.initialize();

    const runBtn = document.getElementById('run-analysis-btn');
    runBtn.click();

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 100));
    await flushPromises();

    console.log('Analyze called:', mockAnalyzer.analyze.mock.calls.length);
    console.log('Logger errors:', mockLogger.error.mock.calls);

    const axisGapPanel = document.getElementById('axis-gap-panel');
    console.log('Axis gap panel hidden:', axisGapPanel.hidden);

    const resultsPanel = document.getElementById('results-panel');
    console.log('Results panel hidden:', resultsPanel.hidden);

    expect(mockAnalyzer.analyze).toHaveBeenCalled();
    expect(resultsPanel.hidden).toBe(false);
    expect(axisGapPanel.hidden).toBe(false);
  });
});
