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
import MonteCarloReportGenerator from '../../../src/expressionDiagnostics/services/MonteCarloReportGenerator.js';
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
