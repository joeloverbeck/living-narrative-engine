/**
 * @file Unit tests for ExpressionDiagnosticsController recommendations UI.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import ExpressionDiagnosticsController from '../../../../src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js';

function getDropdownContainer() {
  return document.getElementById('expression-select-container');
}

function getDropdownOptions() {
  const container = getDropdownContainer();
  if (!container) return [];
  return Array.from(container.querySelectorAll('[role="option"]'));
}

function selectDropdownValue(value) {
  const options = getDropdownOptions();
  const option = options.find((opt) => opt.dataset.value === value);
  if (option) {
    option.click();
  }
}

function buildLeafBreakdown({
  clauseId,
  description,
  variablePath,
  thresholdValue,
  comparisonOperator,
  gatePassInRegimeCount,
  gatePassAndClausePassInRegimeCount,
  rawPassInRegimeCount,
  lostPassInRegimeCount,
  lostPassRateInRegime,
} = {}) {
  return {
    nodeType: 'leaf',
    clauseId,
    clauseType: 'threshold',
    description,
    variablePath,
    thresholdValue,
    comparisonOperator,
    failureRate: 0.4,
    averageViolation: 0.2,
    isCompound: false,
    inRegimeFailureRate: 0.4,
    children: [],
    gatePassInRegimeCount,
    gatePassAndClausePassInRegimeCount,
    rawPassInRegimeCount,
    lostPassInRegimeCount,
    lostPassRateInRegime,
  };
}

describe('ExpressionDiagnosticsController recommendations UI', () => {
  let mockLogger;
  let mockExpressionRegistry;
  let mockGateAnalyzer;
  let mockBoundsCalculator;
  let mockMonteCarloSimulator;
  let mockFailureExplainer;
  let mockExpressionStatusService;
  let mockPathSensitiveAnalyzer;
  let mockReportGenerator;
  let mockReportModal;
  let mockSensitivityAnalyzer;
  let mockDataRegistry;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="expression-select-container"></div>
      <p id="expression-description"></p>
      <button id="run-static-btn"></button>
      <section class="panel status-summary-centered">
        <div id="status-indicator" class="status-indicator status-unknown">
          <span class="status-circle-large status-circle status-unknown"></span>
          <span class="status-label">Unknown</span>
        </div>
        <p id="status-message"></p>
      </section>
      <div id="static-results"></div>
      <section id="gate-conflicts-section" hidden>
        <table id="gate-conflicts-table"><tbody></tbody></table>
      </section>
      <section id="thresholds-section" hidden>
        <table id="thresholds-table"><tbody></tbody></table>
      </section>
      <select id="sample-count"><option value="1000">1000</option></select>
      <select id="distribution"><option value="uniform">uniform</option></select>
      <button id="run-mc-btn"></button>
      <div id="mc-results" hidden>
        <div id="mc-rarity-indicator"></div>
        <span id="mc-trigger-rate"></span>
        <span id="mc-confidence-interval"></span>
        <p id="mc-summary"></p>
      </div>
      <table><tbody id="blockers-tbody"></tbody></table>
      <div id="mc-recommendations" hidden>
        <div id="mc-recommendations-warning" hidden>
          <span class="warning-text"></span>
        </div>
        <div id="mc-recommendations-list"></div>
      </div>
    `;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockExpressionRegistry = {
      getAllExpressions: jest.fn().mockReturnValue([
        { id: 'expr:test', description: 'Test expression', prerequisites: [] },
      ]),
      getExpression: jest.fn().mockReturnValue({
        id: 'expr:test',
        description: 'Test expression',
        prerequisites: [],
      }),
    };

    mockGateAnalyzer = { analyze: jest.fn().mockResolvedValue({ conflicts: [] }) };
    mockBoundsCalculator = { analyzeExpression: jest.fn().mockResolvedValue([]) };
    mockMonteCarloSimulator = { simulate: jest.fn() };
    mockFailureExplainer = {
      analyzeHierarchicalBlockers: jest.fn(),
      generateSummary: jest.fn().mockReturnValue('Summary'),
    };
    mockExpressionStatusService = {
      scanAllStatuses: jest.fn().mockResolvedValue([]),
      updateStatus: jest.fn().mockResolvedValue(true),
      getProblematicExpressions: jest.fn().mockResolvedValue([]),
    };
    mockPathSensitiveAnalyzer = { analyze: jest.fn().mockResolvedValue(null) };
    mockReportGenerator = {
      generate: jest.fn().mockReturnValue('report'),
      collectReportIntegrityWarnings: jest.fn().mockReturnValue([]),
    };
    mockReportModal = { showReport: jest.fn() };
    mockSensitivityAnalyzer = {
      computeSensitivityData: jest.fn().mockReturnValue([]),
      computeGlobalSensitivityData: jest.fn().mockReturnValue([]),
    };
    mockDataRegistry = { getLookupData: jest.fn().mockReturnValue({}) };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders recommendation cards with low-confidence warning and choke rank', async () => {
    mockMonteCarloSimulator.simulate.mockResolvedValue({
      triggerRate: 0.05,
      triggerCount: 50,
      sampleCount: 1000,
      inRegimeSampleCount: 150,
      confidenceInterval: { low: 0.04, high: 0.06 },
      clauseFailures: [
        {
          clauseDescription: 'emotions.joy >= 0.5',
          inRegimeFailureRate: 0.4,
          averageViolation: 0.2,
          hierarchicalBreakdown: buildLeafBreakdown({
            clauseId: 'clause-joy',
            description: 'emotions.joy >= 0.5',
            variablePath: 'emotions.joy',
            thresholdValue: 0.5,
            comparisonOperator: '>=',
            gatePassInRegimeCount: 60,
            gatePassAndClausePassInRegimeCount: 30,
            rawPassInRegimeCount: 40,
            lostPassInRegimeCount: 12,
            lostPassRateInRegime: 0.3,
          }),
        },
      ],
      distribution: 'uniform',
      witnessAnalysis: { witnesses: [], nearestMiss: null },
      prototypeEvaluationSummary: {
        emotions: {
          joy: {
            moodSampleCount: 150,
            gatePassCount: 60,
            gateFailCount: 90,
            valueSumGivenGate: 20,
            failedGateCounts: { gateA: 60, gateB: 30 },
          },
        },
        sexualStates: {},
      },
      gateCompatibility: {
        emotions: { joy: { compatible: true } },
        sexualStates: {},
      },
      ablationImpact: {
        clauseImpacts: [
          { clauseId: 'clause-joy', impact: 0.25, chokeRank: 1 },
        ],
        topLevelImpacts: [],
      },
      storedContexts: [],
      populationSummary: { sampleCount: 1000 },
    });

    mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
      {
        rank: 1,
        clauseDescription: 'emotions.joy >= 0.5',
        failureRate: 0.6,
        averageViolation: 0.2,
        explanation: { severity: 'high' },
        hasHierarchy: false,
      },
    ]);

    const controller = new ExpressionDiagnosticsController({
      logger: mockLogger,
      expressionRegistry: mockExpressionRegistry,
      gateAnalyzer: mockGateAnalyzer,
      boundsCalculator: mockBoundsCalculator,
      monteCarloSimulator: mockMonteCarloSimulator,
      failureExplainer: mockFailureExplainer,
      expressionStatusService: mockExpressionStatusService,
      pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
      reportGenerator: mockReportGenerator,
      reportModal: mockReportModal,
      sensitivityAnalyzer: mockSensitivityAnalyzer,
      dataRegistry: mockDataRegistry,
    });

    await controller.initialize();
    selectDropdownValue('expr:test');

    document.getElementById('run-mc-btn').click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const warning = document.getElementById('mc-recommendations-warning');
    expect(warning.hidden).toBe(false);
    expect(warning.textContent).toContain('Low confidence');

    const card = document.querySelector('.recommendation-card');
    expect(card).not.toBeNull();
    expect(card.textContent).toContain('Prototype structurally mismatched');
    expect(card.textContent).toContain('Confidence: low');
    expect(card.textContent).toContain('Impact (full sample): +25.00 pp');

    const chokeRankCell = document.querySelector('.choke-rank');
    expect(chokeRankCell).not.toBeNull();
    expect(chokeRankCell.textContent).toBe('1');

    const evidenceItems = Array.from(
      document.querySelectorAll('.recommendation-evidence li')
    );
    expect(evidenceItems.length).toBeGreaterThan(0);
    const evidenceText = evidenceItems.map((item) => item.textContent).join(' ');
    expect(evidenceText).toContain('Population: mood-regime (N=150.00)');
    expect(evidenceText).toContain('Population: gate-pass (mood-regime) (N=60.00)');
  });

  it('shows invariant warning and suppresses recommendations when invariants fail', async () => {
    mockMonteCarloSimulator.simulate.mockResolvedValue({
      triggerRate: 0.05,
      triggerCount: 50,
      sampleCount: 1000,
      inRegimeSampleCount: 300,
      confidenceInterval: { low: 0.04, high: 0.06 },
      clauseFailures: [
        {
          clauseDescription: 'emotions.joy >= 0.5',
          inRegimeFailureRate: 0.4,
          averageViolation: 0.2,
          hierarchicalBreakdown: buildLeafBreakdown({
            clauseId: 'clause-joy',
            description: 'emotions.joy >= 0.5',
            variablePath: 'emotions.joy',
            thresholdValue: 0.5,
            comparisonOperator: '>=',
            gatePassInRegimeCount: 5,
            gatePassAndClausePassInRegimeCount: 10,
          }),
        },
      ],
      distribution: 'uniform',
      witnessAnalysis: { witnesses: [], nearestMiss: null },
      prototypeEvaluationSummary: {
        emotions: {
          joy: {
            moodSampleCount: 300,
            gatePassCount: 5,
            gateFailCount: 295,
            valueSumGivenGate: 2,
            failedGateCounts: { gateA: 295 },
          },
        },
        sexualStates: {},
      },
      gateCompatibility: {
        emotions: { joy: { compatible: true } },
        sexualStates: {},
      },
      ablationImpact: {
        clauseImpacts: [
          { clauseId: 'clause-joy', impact: 0.25, chokeRank: 1 },
        ],
        topLevelImpacts: [],
      },
      storedContexts: [],
      populationSummary: { sampleCount: 1000 },
    });

    mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
      {
        rank: 1,
        clauseDescription: 'emotions.joy >= 0.5',
        failureRate: 0.6,
        averageViolation: 0.2,
        explanation: { severity: 'high' },
        hasHierarchy: false,
      },
    ]);

    const controller = new ExpressionDiagnosticsController({
      logger: mockLogger,
      expressionRegistry: mockExpressionRegistry,
      gateAnalyzer: mockGateAnalyzer,
      boundsCalculator: mockBoundsCalculator,
      monteCarloSimulator: mockMonteCarloSimulator,
      failureExplainer: mockFailureExplainer,
      expressionStatusService: mockExpressionStatusService,
      pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
      reportGenerator: mockReportGenerator,
      reportModal: mockReportModal,
      sensitivityAnalyzer: mockSensitivityAnalyzer,
      dataRegistry: mockDataRegistry,
    });

    await controller.initialize();
    selectDropdownValue('expr:test');

    document.getElementById('run-mc-btn').click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const warning = document.getElementById('mc-recommendations-warning');
    expect(warning.hidden).toBe(false);
    expect(warning.textContent).toContain('Recommendations suppressed');

    const card = document.querySelector('.recommendation-card');
    expect(card).toBeNull();
  });
});
