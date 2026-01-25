/**
 * @file Unit tests for ExpressionDiagnosticsController witness state section formatting
 * @description Tests that numeric values are formatted correctly in witness displays:
 * - Float sections (Computed Emotions, Previous Computed Emotions): 2 decimal places
 * - Integer sections (Mood, Sexual, Affect Traits): 0 decimal places
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import ExpressionDiagnosticsController from '../../../../src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js';

describe('ExpressionDiagnosticsController - witness state section formatting', () => {
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
  let controller;

  beforeEach(() => {
    // Set up minimal DOM structure required for controller initialization
    document.body.innerHTML = `
      <label id="expression-select-label" for="expression-select">Select Expression:</label>
      <div id="expression-select-container" class="status-select-container"></div>
      <p id="expression-description"></p>
      <section class="panel status-summary-centered">
        <div id="status-indicator" class="status-indicator status-unknown">
          <span class="status-circle-large status-circle status-unknown"></span>
          <span class="status-label">Unknown</span>
        </div>
        <p id="status-message"></p>
      </section>
      <section class="panel static-analysis-panel">
        <div class="section-action-button">
          <button id="run-static-btn" class="action-button" disabled>Run Static Analysis</button>
        </div>
        <div id="static-results">
          <p class="placeholder-text">Run static analysis to see results.</p>
        </div>
      </section>
      <section id="gate-conflicts-section" hidden>
        <table id="gate-conflicts-table">
          <thead><tr><th>Axis</th></tr></thead>
          <tbody></tbody>
        </table>
      </section>
      <section id="thresholds-section" hidden>
        <table id="thresholds-table">
          <thead><tr><th>Prototype</th></tr></thead>
          <tbody></tbody>
        </table>
      </section>
      <section class="panel problematic-expressions-panel">
        <div id="problematic-pills-container" class="pills-container">
          <p class="placeholder-text">Loading...</p>
        </div>
      </section>
      <section id="monte-carlo-section">
        <select id="sample-count">
          <option value="10000" selected>10,000</option>
        </select>
        <select id="distribution">
          <option value="uniform" selected>Uniform</option>
        </select>
        <button id="run-mc-btn" disabled>Run Simulation</button>
        <div id="mc-results" hidden>
          <div id="mc-rarity-indicator" class="rarity-indicator">
            <span class="rarity-circle status-circle"></span>
            <span class="rarity-label"></span>
          </div>
          <span id="mc-trigger-rate">--</span>
          <span id="mc-confidence-interval">(-- - --)</span>
          <p id="mc-summary"></p>
          <table id="blockers-table">
            <tbody id="blockers-tbody"></tbody>
          </table>
          <div class="mc-results-actions">
            <button id="generate-report-btn" class="action-button action-button--secondary">
              Generate Report
            </button>
          </div>
        </div>
        <div id="mc-witnesses" class="mc-witnesses-container" hidden>
          <h3>Ground-Truth Witnesses</h3>
          <div id="mc-witnesses-list" class="mc-witnesses-list"></div>
        </div>
      </section>
      <label class="toggle-switch" id="show-all-branches-toggle">
        <input type="checkbox" id="show-all-branches">
        <span class="toggle-slider"></span>
        <span class="toggle-label">Show All</span>
      </label>
      <section id="path-sensitive-results" hidden>
        <div id="path-sensitive-summary">
          <span id="ps-status-indicator"></span>
          <span id="ps-summary-message"></span>
        </div>
        <span id="branch-count">0</span>
        <span id="reachable-count">0</span>
        <div id="branch-cards-container"></div>
        <details id="knife-edge-summary" hidden>
          <span id="ke-count">0</span>
          <table><tbody id="knife-edge-tbody"></tbody></table>
        </details>
      </section>
      <template id="branch-card-template">
        <div class="branch-card" data-status="pending">
          <span class="branch-status-icon"></span>
          <span class="branch-title"></span>
          <span class="prototype-list"></span>
          <div class="branch-thresholds" hidden>
            <table><tbody class="threshold-tbody"></tbody></table>
          </div>
          <div class="branch-knife-edges" hidden>
            <span class="ke-message"></span>
          </div>
        </div>
      </template>
    `;

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockExpressionRegistry = {
      getAllExpressions: jest.fn().mockReturnValue([
        { id: 'expr:test1', description: 'Test expression 1' },
      ]),
      getExpression: jest.fn().mockReturnValue({
        id: 'expr:test1',
        description: 'Test expression 1',
        prerequisites: { conditions: { and: [] } },
      }),
    };

    mockGateAnalyzer = {
      analyze: jest.fn().mockReturnValue({
        hasConflict: false,
        conflicts: [],
        axisIntervals: {},
      }),
    };

    mockBoundsCalculator = {
      analyzeExpression: jest.fn().mockReturnValue([]),
    };

    mockMonteCarloSimulator = {
      simulate: jest.fn(),
    };

    mockFailureExplainer = {
      analyzeHierarchicalBlockers: jest.fn().mockReturnValue([]),
      generateSummary: jest
        .fn()
        .mockReturnValue('Expression triggers at healthy rate.'),
    };

    mockExpressionStatusService = {
      scanAllStatuses: jest.fn().mockResolvedValue({
        success: true,
        expressions: [],
      }),
      updateStatus: jest.fn().mockResolvedValue({ success: true }),
      getProblematicExpressions: jest.fn().mockReturnValue([]),
    };

    mockPathSensitiveAnalyzer = {
      analyze: jest.fn().mockResolvedValue({
        expressionId: 'expr:test1',
        branches: [],
        branchCount: 0,
        feasibleBranchCount: 0,
        reachabilityByBranch: [],
        hasFullyReachableBranch: false,
        fullyReachableBranchIds: [],
        allKnifeEdges: [],
        feasibilityVolume: null,
        overallStatus: 'unreachable',
        statusEmoji: '🔴',
        getSummaryMessage: jest.fn().mockReturnValue('No branches analyzed'),
        getReachabilityForBranch: jest.fn().mockReturnValue([]),
      }),
    };

    mockReportGenerator = {
      generate: jest.fn().mockReturnValue('# Mock Report'),
      collectReportIntegrityWarnings: jest.fn().mockReturnValue([]),
    };

    mockReportModal = {
      showReport: jest.fn(),
    };

    mockSensitivityAnalyzer = {
      computeSensitivityData: jest.fn().mockReturnValue([]),
      computeGlobalSensitivityData: jest.fn().mockReturnValue([]),
    };

    mockDataRegistry = {
      get: jest.fn().mockReturnValue(null),
      getLookupData: jest.fn().mockReturnValue(null),
    };

    controller = new ExpressionDiagnosticsController({
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
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  /**
   * Helper to select an expression in the dropdown.
   * @param {string} value - Expression ID
   */
  function selectExpression(value) {
    const container = document.getElementById('expression-select-container');
    const options = Array.from(container.querySelectorAll('[role="option"]'));
    const option = options.find((opt) => opt.dataset.value === value);
    if (option) option.click();
  }

  /**
   * Helper to trigger MC simulation with custom result.
   * @param {object} witnessAnalysis - The witness analysis result
   */
  async function runSimulationWithWitnesses(witnessAnalysis) {
    mockMonteCarloSimulator.simulate.mockResolvedValue({
      triggerRate: 0.1,
      triggerCount: 100,
      sampleCount: 1000,
      confidenceInterval: { low: 0.08, high: 0.12 },
      clauseFailures: [],
      distribution: 'uniform',
      witnessAnalysis,
    });

    // Initialize controller first
    await controller.initialize();

    // Select expression to enable MC button
    selectExpression('expr:test1');

    const runMcBtn = document.getElementById('run-mc-btn');
    runMcBtn.click();

    // Wait for async simulation
    await mockMonteCarloSimulator.simulate.mock.results[0]?.value;
    // Allow DOM updates
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  describe('Computed Emotions formatting (float values)', () => {
    it('should display decimal values with 2 decimal places for Computed Emotions', async () => {
      // Arrange: Create witness with float emotion values
      const witnessAnalysis = {
        witnesses: [
          {
            current: {
              mood: { valence: 50, arousal: 0 },
              sexual: { sex_excitation: 30, sex_inhibition: 20, baseline_libido: 0 },
            },
            computedEmotions: {
              courage: 0.753,
              fear: 0.125,
              joy: 0.999,
              sadness: 0.001,
            },
          },
        ],
        nearestMiss: null,
      };

      // Act
      await runSimulationWithWitnesses(witnessAnalysis);

      // Assert
      const witnessList = document.getElementById('mc-witnesses-list');
      const html = witnessList.innerHTML;

      // Decimal values should be preserved with 2 decimal places
      expect(html).toContain('0.75'); // courage rounded to 2 decimals
      expect(html).toContain('0.13'); // fear rounded to 2 decimals (0.125 -> 0.13)
      expect(html).toContain('1.00'); // joy (0.999 -> 1.00)
      expect(html).toContain('0.00'); // sadness (0.001 -> 0.00)
    });

    it('should display decimal values with 2 decimal places for Previous Computed Emotions', async () => {
      // Arrange
      const witnessAnalysis = {
        witnesses: [
          {
            current: {
              mood: { valence: 50, arousal: 0 },
              sexual: { sex_excitation: 30, sex_inhibition: 20, baseline_libido: 0 },
            },
            previous: {
              mood: { valence: 40, arousal: -10 },
              sexual: { sex_excitation: 20, sex_inhibition: 25, baseline_libido: 0 },
            },
            computedEmotions: {},
            previousComputedEmotions: {
              terror: 0.876,
              calm: 0.234,
            },
          },
        ],
        nearestMiss: null,
      };

      // Act
      await runSimulationWithWitnesses(witnessAnalysis);

      // Assert
      const witnessList = document.getElementById('mc-witnesses-list');
      const html = witnessList.innerHTML;

      expect(html).toContain('0.88'); // terror rounded to 2 decimals
      expect(html).toContain('0.23'); // calm rounded to 2 decimals
    });
  });

  describe('Integer sections formatting', () => {
    it('should display integer values without decimals for Current Mood', async () => {
      // Arrange
      const witnessAnalysis = {
        witnesses: [
          {
            current: {
              mood: {
                valence: 75,
                arousal: -50,
                threat: 0,
                agency_control: 25,
              },
              sexual: { sex_excitation: 30, sex_inhibition: 20, baseline_libido: 0 },
            },
          },
        ],
        nearestMiss: null,
      };

      // Act
      await runSimulationWithWitnesses(witnessAnalysis);

      // Assert
      const witnessList = document.getElementById('mc-witnesses-list');
      const html = witnessList.innerHTML;

      // Integer values should appear without unnecessary decimals
      expect(html).toContain('>75<');
      expect(html).toContain('>-50<');
      expect(html).toContain('>0<');
      expect(html).toContain('>25<');
    });

    it('should display integer values without decimals for Affect Traits', async () => {
      // Arrange
      const witnessAnalysis = {
        witnesses: [
          {
            current: {
              mood: { valence: 50, arousal: 0 },
              sexual: { sex_excitation: 30, sex_inhibition: 20, baseline_libido: 0 },
            },
            affectTraits: {
              affective_empathy: 85,
              cognitive_empathy: 60,
              harm_aversion: 40,
            },
          },
        ],
        nearestMiss: null,
      };

      // Act
      await runSimulationWithWitnesses(witnessAnalysis);

      // Assert
      const witnessList = document.getElementById('mc-witnesses-list');
      const html = witnessList.innerHTML;

      expect(html).toContain('>85<');
      expect(html).toContain('>60<');
      expect(html).toContain('>40<');
    });
  });

  describe('Edge cases for float sections', () => {
    it('should handle emotion value of exactly 0', async () => {
      // Arrange
      const witnessAnalysis = {
        witnesses: [
          {
            current: {
              mood: { valence: 50, arousal: 0 },
              sexual: { sex_excitation: 30, sex_inhibition: 20, baseline_libido: 0 },
            },
            computedEmotions: {
              fear: 0,
            },
          },
        ],
        nearestMiss: null,
      };

      // Act
      await runSimulationWithWitnesses(witnessAnalysis);

      // Assert
      const witnessList = document.getElementById('mc-witnesses-list');
      const html = witnessList.innerHTML;

      // 0 should display as "0.00" for float sections (Computed Emotions)
      expect(html).toContain('0.00');
    });

    it('should handle emotion value of exactly 1', async () => {
      // Arrange
      const witnessAnalysis = {
        witnesses: [
          {
            current: {
              mood: { valence: 50, arousal: 0 },
              sexual: { sex_excitation: 30, sex_inhibition: 20, baseline_libido: 0 },
            },
            computedEmotions: {
              joy: 1,
            },
          },
        ],
        nearestMiss: null,
      };

      // Act
      await runSimulationWithWitnesses(witnessAnalysis);

      // Assert
      const witnessList = document.getElementById('mc-witnesses-list');
      const html = witnessList.innerHTML;

      // 1 should display as "1.00" for float sections
      expect(html).toContain('1.00');
    });

    it('should handle very small decimal values', async () => {
      // Arrange
      const witnessAnalysis = {
        witnesses: [
          {
            current: {
              mood: { valence: 50, arousal: 0 },
              sexual: { sex_excitation: 30, sex_inhibition: 20, baseline_libido: 0 },
            },
            computedEmotions: {
              subtle: 0.007,
            },
          },
        ],
        nearestMiss: null,
      };

      // Act
      await runSimulationWithWitnesses(witnessAnalysis);

      // Assert
      const witnessList = document.getElementById('mc-witnesses-list');
      const html = witnessList.innerHTML;

      // 0.007 should display as "0.01" (rounded to 2 decimals)
      expect(html).toContain('0.01');
    });
  });

  describe('Regression: previously rounded values should now preserve decimals', () => {
    it('should NOT round 0.753 to 1 (the original bug)', async () => {
      // Arrange: This was the original bug - 0.753 was displayed as "1"
      const witnessAnalysis = {
        witnesses: [
          {
            current: {
              mood: { valence: 50, arousal: 0 },
              sexual: { sex_excitation: 30, sex_inhibition: 20, baseline_libido: 0 },
            },
            computedEmotions: {
              courage: 0.753,
            },
          },
        ],
        nearestMiss: null,
      };

      // Act
      await runSimulationWithWitnesses(witnessAnalysis);

      // Assert
      const witnessList = document.getElementById('mc-witnesses-list');
      const html = witnessList.innerHTML;

      // Should show "0.75", NOT "1"
      expect(html).toContain('0.75');
      expect(html).not.toMatch(/courage.*<\/span>\s*<span[^>]*>1</);
    });

    it('should NOT round 0.125 to 0 (the original bug)', async () => {
      // Arrange
      const witnessAnalysis = {
        witnesses: [
          {
            current: {
              mood: { valence: 50, arousal: 0 },
              sexual: { sex_excitation: 30, sex_inhibition: 20, baseline_libido: 0 },
            },
            computedEmotions: {
              fear: 0.125,
            },
          },
        ],
        nearestMiss: null,
      };

      // Act
      await runSimulationWithWitnesses(witnessAnalysis);

      // Assert
      const witnessList = document.getElementById('mc-witnesses-list');
      const html = witnessList.innerHTML;

      // Should show "0.13" (or "0.12"), NOT "0"
      expect(html).toMatch(/0\.1[23]/);
    });
  });
});
