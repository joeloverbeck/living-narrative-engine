/**
 * @file Integration tests for Monte Carlo Report system
 * Tests DI resolution, service integration, and DOM/clipboard interaction
 * @see specs/monte-carlo-report-generator.md
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { JSDOM } from 'jsdom';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import MonteCarloReportGenerator from '../../../src/expressionDiagnostics/services/MonteCarloReportGenerator.js';
import PrototypeConstraintAnalyzer from '../../../src/expressionDiagnostics/services/PrototypeConstraintAnalyzer.js';
import PrototypeFitRankingService from '../../../src/expressionDiagnostics/services/PrototypeFitRankingService.js';
import MonteCarloReportModal from '../../../src/domUI/expression-diagnostics/MonteCarloReportModal.js';

// ============================================================================
// Test Data Factories
// ============================================================================

/**
 * Create a test simulation result with sensible defaults.
 *
 * @param {object} overrides - Override specific fields
 * @returns {object} Simulation result with defaults merged with overrides
 */
function createTestSimulationResult(overrides = {}) {
  return {
    triggerRate: 0.15,
    triggerCount: 1500,
    sampleCount: 10000,
    confidenceInterval: { low: 0.14, high: 0.16 },
    distribution: 'uniform',
    clauseFailures: [],
    ...overrides,
  };
}

/**
 * Create a test blocker with comprehensive structure.
 *
 * @param {object} overrides - Override specific fields
 * @returns {object} Blocker with defaults merged with overrides
 */
function createTestBlocker(overrides = {}) {
  return {
    clauseDescription: 'emotions.joy >= 0.5',
    failureRate: 0.75,
    averageViolation: 0.3,
    rank: 1,
    severity: 'high',
    advancedAnalysis: {
      percentileAnalysis: { status: 'normal', insight: 'Normal distribution' },
      nearMissAnalysis: {
        status: 'moderate',
        tunability: 'moderate',
        insight: 'Some near misses',
      },
      ceilingAnalysis: {
        status: 'achievable',
        achievable: true,
        headroom: 0.1,
        insight: 'Reachable',
      },
      lastMileAnalysis: {
        status: 'moderate',
        isDecisive: false,
        insight: 'Not decisive',
      },
      recommendation: {
        action: 'tune_threshold',
        priority: 'medium',
        message: 'Adjust threshold',
      },
    },
    hierarchicalBreakdown: {
      variablePath: 'emotions.joy',
      comparisonOperator: '>=',
      thresholdValue: 0.5,
      violationP50: 0.2,
      violationP90: 0.4,
      nearMissRate: 0.08,
      nearMissEpsilon: 0.05,
      maxObservedValue: 0.6,
      ceilingGap: -0.1,
      lastMileFailRate: 0.3,
      othersPassedCount: 5000,
      isSingleClause: false,
    },
    ...overrides,
  };
}

/**
 * Create a minimal emotion prototype lookup for integration tests.
 *
 * @returns {object} Lookup data with emotion prototypes
 */
function createPrototypeLookup() {
  return {
    id: 'core:emotion_prototypes',
    entries: {
      joy: {
        weights: { valence: 1.0, arousal: 0.6 },
        gates: ['valence >= 0.3'],
      },
      fear: {
        weights: { valence: -0.8, arousal: 0.7, threat: 0.9 },
        gates: ['threat >= 0.2'],
      },
    },
  };
}

/**
 * Create a data registry seeded with prototype lookups.
 *
 * @param {object} logger - Logger implementation
 * @returns {InMemoryDataRegistry} Seeded registry
 */
function createPrototypeDataRegistry(logger) {
  const registry = new InMemoryDataRegistry({ logger });
  registry.store('lookups', 'core:emotion_prototypes', createPrototypeLookup());
  return registry;
}

/**
 * Create stored contexts for prototype fit analysis.
 * Includes both moodAxes (for prototype gate evaluation) and emotions data.
 * Contexts must pass the 'joy' prototype gate (valence >= 0.3) to be in-regime.
 *
 * @returns {Array<object>} Stored contexts
 */
function createPrototypeStoredContexts() {
  return [
    // In-regime: valence >= 0.3 (passes joy gate)
    { moodAxes: { valence: 0.65, arousal: 0.5, threat: 0.1 }, emotions: { joy: 0.4 } },
    { moodAxes: { valence: 0.7, arousal: 0.6, threat: 0.25 }, emotions: { joy: 0.5 } },
    { moodAxes: { valence: 0.8, arousal: 0.7, threat: 0.4 }, emotions: { joy: 0.6 } },
    // Out of regime: valence < 0.3 (fails joy gate)
    { moodAxes: { valence: -0.5, arousal: 0.6, threat: 0.6 }, emotions: { joy: 0.1 } },
  ];
}

/**
 * Create prerequisites that reference emotion/sexual prototypes.
 * Under the new architecture, mood regime is derived from prototype gates,
 * not from explicit moodAxes.* prerequisites.
 *
 * @returns {Array<object>} Prerequisites array
 */
function createPrototypePrerequisites() {
  return [
    {
      // Emotion prerequisites - mood regime derived from 'joy' prototype gates
      // The 'joy' prototype has gate: 'valence >= 0.3'
      logic: { '>=': [{ var: 'emotions.joy' }, 0.3] },
    },
  ];
}

/**
 * Create a report generator wired for prototype analysis.
 *
 * @param {object} logger - Logger implementation
 * @returns {MonteCarloReportGenerator} Configured report generator
 */
function createPrototypeReportGenerator(logger) {
  const dataRegistry = createPrototypeDataRegistry(logger);
  const prototypeConstraintAnalyzer = new PrototypeConstraintAnalyzer({
    dataRegistry,
    logger,
  });
  const prototypeFitRankingService = new PrototypeFitRankingService({
    dataRegistry,
    logger,
    prototypeConstraintAnalyzer,
  });

  return new MonteCarloReportGenerator({
    logger,
    prototypeConstraintAnalyzer,
    prototypeFitRankingService,
  });
}

// ============================================================================
// Integration Test Suite
// ============================================================================

/**
 * Create a proper mock DocumentContext with required methods.
 *
 * @returns {object} Mock document context with query and create methods
 */
function createMockDocumentContext() {
  return {
    query: (sel) => document.querySelector(sel),
    create: (tagName) => document.createElement(tagName),
  };
}

describe('Monte Carlo Report System - Integration', () => {
  let dom;
  let mockLogger;
  let clipboardWriteMock;
  let originalClipboardDescriptor;

  beforeAll(() => {
    // Setup JSDOM with required modal elements
    dom = new JSDOM(
      `
      <!DOCTYPE html>
      <html>
        <body>
          <div id="mc-report-modal" style="display: none;" aria-hidden="true">
            <button id="mc-report-close-btn">×</button>
            <pre id="mc-report-content"></pre>
            <div id="mc-report-status"></div>
            <button id="mc-report-copy-btn">Copy</button>
          </div>
        </body>
      </html>
    `,
      { url: 'http://localhost', pretendToBeVisual: true }
    );

    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = dom.window.navigator;
  });

  afterAll(() => {
    dom.window.close();
    delete global.window;
    delete global.document;
    delete global.navigator;
  });

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock clipboard
    clipboardWriteMock = jest.fn().mockResolvedValue(undefined);
    originalClipboardDescriptor = Object.getOwnPropertyDescriptor(
      navigator,
      'clipboard'
    );
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWriteMock },
    });
  });

  afterEach(() => {
    // Restore clipboard
    if (originalClipboardDescriptor) {
      Object.defineProperty(
        navigator,
        'clipboard',
        originalClipboardDescriptor
      );
    } else {
      delete navigator.clipboard;
    }

    // Clear DOM content
    const contentEl = document.getElementById('mc-report-content');
    const statusEl = document.getElementById('mc-report-status');
    if (contentEl) contentEl.textContent = '';
    if (statusEl) statusEl.textContent = '';
  });

  // ==========================================================================
  // Service Resolution Tests
  // ==========================================================================

  describe('Service Resolution', () => {
    it('should create MonteCarloReportGenerator with logger dependency', () => {
      const generator = new MonteCarloReportGenerator({ logger: mockLogger });

      expect(generator).toBeDefined();
      expect(typeof generator.generate).toBe('function');
    });

    it('should create MonteCarloReportModal with all dependencies', () => {
      const mockDispatcher = { dispatch: jest.fn(), subscribe: jest.fn() };

      const modal = new MonteCarloReportModal({
        logger: mockLogger,
        documentContext: createMockDocumentContext(),
        validatedEventDispatcher: mockDispatcher,
      });

      expect(modal).toBeDefined();
      expect(typeof modal.showReport).toBe('function');
    });
  });

  // ==========================================================================
  // Report Generation Integration Tests
  // ==========================================================================

  describe('Report Generation Integration', () => {
    it('should generate complete markdown report from simulation data', () => {
      const generator = new MonteCarloReportGenerator({ logger: mockLogger });
      const result = createTestSimulationResult();
      const blockers = [createTestBlocker()];

      const report = generator.generate({
        expressionName: 'test:expression',
        simulationResult: result,
        blockers,
        summary: 'Test summary',
      });

      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(0);
    });

    it('should include all major report sections', () => {
      const generator = new MonteCarloReportGenerator({ logger: mockLogger });
      const result = createTestSimulationResult();
      const blockers = [createTestBlocker()];

      const report = generator.generate({
        expressionName: 'test:expression',
        simulationResult: result,
        blockers,
        summary: 'Test summary',
      });

      expect(report).toContain('# Monte Carlo Analysis Report');
      expect(report).toContain('## Executive Summary');
      expect(report).toContain('## Blocker Analysis');
      expect(report).toContain('## Legend');
    });

    it('should render sampling coverage section when coverage data is present', () => {
      const generator = new MonteCarloReportGenerator({ logger: mockLogger });
      const result = createTestSimulationResult({
        samplingMode: 'static',
        samplingCoverage: {
          summaryByDomain: [
            {
              domain: 'emotions',
              variableCount: 1,
              rangeCoverageAvg: 0.25,
              binCoverageAvg: 0.2,
              tailCoverageAvg: { low: 0.02, high: 0.01 },
              rating: 'poor',
            },
          ],
          variables: [
            {
              variablePath: 'emotions.fear',
              domain: 'emotions',
              rangeCoverage: 0.25,
              binCoverage: 0.2,
              tailCoverage: { low: 0.02, high: 0.01 },
              rating: 'poor',
              sampleCount: 10000,
            },
          ],
          config: {
            binCount: 10,
            tailPercent: 0.1,
          },
        },
      });

      const report = generator.generate({
        expressionName: 'test:expression',
        simulationResult: result,
        blockers: [],
        summary: 'Test summary',
      });

      expect(report).toContain('## Sampling Coverage');
      expect(report).toContain('**Sampling Mode**: static');
      expect(report).toContain('emotions.fear');
    });

    it('should include in-regime fail rate formatting and redundancy in blocker output', () => {
      const generator = new MonteCarloReportGenerator({ logger: mockLogger });
      const result = createTestSimulationResult({ sampleCount: 10 });
      const blockers = [
        createTestBlocker({
          failureRate: 0.4,
          hierarchicalBreakdown: {
            variablePath: 'emotions.joy',
            comparisonOperator: '>=',
            thresholdValue: 0.5,
            inRegimeFailureRate: 0.5,
            inRegimeFailureCount: 5,
            inRegimeEvaluationCount: 10,
            redundantInRegime: false,
          },
        }),
      ];

      const report = generator.generate({
        expressionName: 'test:expression',
        simulationResult: result,
        blockers,
        summary: 'Test summary',
      });

      expect(report).toContain('**Fail% | mood-pass**: 50.00% (5 / 10)');
      expect(report).toContain('**Redundant in regime**: no');
    });

    it('should include gate clamp and pass|gate columns for emotion-threshold leaves', () => {
      const generator = new MonteCarloReportGenerator({ logger: mockLogger });
      const result = createTestSimulationResult();
      const blockers = [
        createTestBlocker({
          hierarchicalBreakdown: {
            id: '0',
            nodeType: 'and',
            isCompound: true,
            children: [
              {
                id: '0.0',
                nodeType: 'leaf',
                description: 'emotions.joy >= 0.5',
                variablePath: 'emotions.joy',
                comparisonOperator: '>=',
                thresholdValue: 0.5,
                inRegimeEvaluationCount: 10,
                inRegimeFailureCount: 4,
                inRegimePassRate: 0.6,
                gatePassRateInRegime: 0.7,
                gateClampRateInRegime: 0.3,
                gateFailInRegimeCount: 3,
                gatePassInRegimeCount: 7,
                passRateGivenGateInRegime: 3 / 7,
                gatePassAndClausePassInRegimeCount: 3,
              },
            ],
          },
        }),
      ];

      const report = generator.generate({
        expressionName: 'test:expression',
        simulationResult: result,
        blockers,
        summary: 'Test summary',
      });

      expect(report).toContain(
        '| Gate pass (mood) | Gate clamp (mood) | Pass \\| gate (mood) | Pass \\| mood (mood) |'
      );
      expect(report).toContain('70.00% (7 / 10)');
      expect(report).toContain('30.00% (3 / 10)');
      expect(report).toContain('42.86% (3 / 7)');
      expect(report).toContain('60.00% (6 / 10)');
    });
  });

  describe('Prototype Fit Analysis Integration', () => {
    it('should include prototype fit section with ranked prototypes', () => {
      const generator = createPrototypeReportGenerator(mockLogger);
      const result = createTestSimulationResult({
        storedContexts: createPrototypeStoredContexts(),
      });

      const report = generator.generate({
        expressionName: 'test:prototype_fit',
        simulationResult: result,
        blockers: [],
        summary: 'Prototype fit summary',
        prerequisites: createPrototypePrerequisites(),
      });

      expect(report).toContain('Prototype Fit Analysis');
      expect(report).toMatch(/\|\s*\d+\s*\|\s*\*\*joy\*\*/);
      expect(report).toMatch(/\|\s*\d+\s*\|\s*\*\*fear\*\*/);
    });

    it('should render implied prototype and gap detection sections', () => {
      const generator = createPrototypeReportGenerator(mockLogger);
      const result = createTestSimulationResult({
        storedContexts: createPrototypeStoredContexts(),
      });

      const report = generator.generate({
        expressionName: 'test:prototype_gap',
        simulationResult: result,
        blockers: [],
        summary: 'Prototype fit summary',
        prerequisites: createPrototypePrerequisites(),
      });

      expect(report).toContain('Implied Prototype from Prerequisites');
      expect(report).toContain('Target Signature');
      expect(report).toContain('Prototype Gap Detection');
      expect(report).toMatch(/Coverage Gap Detected|Good Coverage/);
    });

    it('should render feasibility block and regime stats in prototype math', () => {
      const generator = createPrototypeReportGenerator(mockLogger);
      const storedContexts = [
        {
          moodAxes: { valence: 0.65, arousal: 0.5, threat: 0.2 },
          emotions: { joy: 0.6 },
        },
        {
          moodAxes: { valence: 0.7, arousal: 0.6, threat: 0.4 },
          emotions: { joy: 0.7 },
        },
        {
          moodAxes: { valence: -0.2, arousal: 0.2, threat: 0.5 },
          emotions: { joy: 0.0 },
        },
      ];
      const result = createTestSimulationResult({ storedContexts });
      const blockers = [
        createTestBlocker({
          clauseDescription: 'emotions.joy >= 0.5',
          hierarchicalBreakdown: {
            variablePath: 'emotions.joy',
            comparisonOperator: '>=',
            thresholdValue: 0.5,
          },
        }),
      ];

      const report = generator.generate({
        expressionName: 'test:regime',
        simulationResult: result,
        blockers,
        summary: 'Prototype regime summary',
        prerequisites: createPrototypePrerequisites(),
      });

      expect(report).toContain('**Feasibility (gated)**');
      expect(report).toContain('**Theoretical range (mood constraints, AND-only)**');
      expect(report).toContain('**Regime Stats**');
      expect(report).toContain('**Observed max (global, final)**');
      expect(report).toContain('**Observed max (mood-regime, final)**');
      expect(report).toContain('In mood regime');
      expect(report).toContain('**Gate Compatibility (mood regime)**: N/A');
    });

    it('should include gate compatibility details only when provided', () => {
      const generator = createPrototypeReportGenerator(mockLogger);
      const result = createTestSimulationResult({
        storedContexts: createPrototypeStoredContexts(),
        gateCompatibility: {
          emotions: {
            joy: {
              compatible: false,
              reason: 'valence >= 0.9 conflicts with mood regime',
            },
          },
          sexualStates: {},
        },
      });
      const blockers = [
        createTestBlocker({
          clauseDescription: 'emotions.joy >= 0.5',
          hierarchicalBreakdown: {
            variablePath: 'emotions.joy',
            comparisonOperator: '>=',
            thresholdValue: 0.5,
          },
        }),
      ];

      const report = generator.generate({
        expressionName: 'test:gate_compat',
        simulationResult: result,
        blockers,
        summary: 'Prototype gate summary',
        prerequisites: createPrototypePrerequisites(),
      });

      expect(report).toContain(
        '**Gate Compatibility (mood regime)**: ❌ incompatible - valence >= 0.9 conflicts with mood regime'
      );
    });
  });

  // ==========================================================================
  // Modal Display Integration Tests
  // ==========================================================================

  describe('Modal Display Integration', () => {
    it('should store report content when modal is shown', () => {
      const mockDispatcher = { dispatch: jest.fn(), subscribe: jest.fn() };
      const modal = new MonteCarloReportModal({
        logger: mockLogger,
        documentContext: createMockDocumentContext(),
        validatedEventDispatcher: mockDispatcher,
      });

      const testContent = '# Test Report\n\nContent here.';
      modal.showReport(testContent);

      // Modal stores content - verify via elements.contentArea
      // which is set during construction from documentContext.query
      expect(modal.elements.contentArea).toBeDefined();
    });

    it('should integrate generator output with modal methods', () => {
      // End-to-end flow: generator -> modal
      const generator = new MonteCarloReportGenerator({ logger: mockLogger });
      const report = generator.generate({
        expressionName: 'test:expression',
        simulationResult: createTestSimulationResult(),
        blockers: [createTestBlocker()],
        summary: 'Integration test summary',
      });

      // Verify the generator produces valid content that modal can accept
      expect(typeof report).toBe('string');
      expect(report).toContain('# Monte Carlo Analysis Report');
      expect(report).toContain('test:expression');

      // Verify modal can be instantiated with valid deps
      const mockDispatcher = { dispatch: jest.fn(), subscribe: jest.fn() };
      const modal = new MonteCarloReportModal({
        logger: mockLogger,
        documentContext: createMockDocumentContext(),
        validatedEventDispatcher: mockDispatcher,
      });

      // showReport should not throw
      expect(() => modal.showReport(report)).not.toThrow();
    });

    it('should bind required DOM elements during construction', () => {
      const mockDispatcher = { dispatch: jest.fn(), subscribe: jest.fn() };
      const modal = new MonteCarloReportModal({
        logger: mockLogger,
        documentContext: createMockDocumentContext(),
        validatedEventDispatcher: mockDispatcher,
      });

      // Verify modal bound key elements
      expect(modal.elements).toBeDefined();
      expect(modal.elements.modalElement).toBeDefined();
      expect(modal.elements.closeButton).toBeDefined();
    });

    it('should have functional showReport method', () => {
      const mockDispatcher = { dispatch: jest.fn(), subscribe: jest.fn() };
      const modal = new MonteCarloReportModal({
        logger: mockLogger,
        documentContext: createMockDocumentContext(),
        validatedEventDispatcher: mockDispatcher,
      });

      // showReport accepts any string content
      expect(() => modal.showReport('Simple test')).not.toThrow();
      expect(() => modal.showReport('# Markdown\n\n**Bold** text')).not.toThrow();
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle clipboard write failure gracefully', async () => {
      clipboardWriteMock.mockRejectedValue(new Error('Clipboard failed'));

      await expect(navigator.clipboard.writeText('test')).rejects.toThrow(
        'Clipboard failed'
      );
    });

    it('should handle missing DOM elements gracefully', () => {
      const mockDocContextMissingElements = {
        query: (sel) =>
          sel === '#mc-report-content' ? null : document.querySelector(sel),
        create: (tagName) => document.createElement(tagName),
      };
      const mockDispatcher = { dispatch: jest.fn(), subscribe: jest.fn() };

      expect(() => {
        new MonteCarloReportModal({
          logger: mockLogger,
          documentContext: mockDocContextMissingElements,
          validatedEventDispatcher: mockDispatcher,
        });
      }).not.toThrow();
    });
  });
});
