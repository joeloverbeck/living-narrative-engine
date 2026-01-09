/**
 * @file Integration test for expression diagnostics bootstrap process
 * Tests the fix for IExpressionRegistry registration issue
 * @see src/expression-diagnostics.js
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { CommonBootstrapper } from '../../../src/bootstrapper/CommonBootstrapper.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { diagnosticsTokens } from '../../../src/dependencyInjection/tokens/tokens-diagnostics.js';
import { registerExpressionServices } from '../../../src/dependencyInjection/registrations/expressionsRegistrations.js';
import { registerExpressionDiagnosticsServices } from '../../../src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js';
import { JSDOM } from 'jsdom';

describe('Expression Diagnostics - Bootstrap Integration', () => {
  let dom;
  let sharedBootstrapper;
  let sharedContainer;

  beforeAll(async () => {
    // Setup minimal DOM environment for expression diagnostics
    dom = new JSDOM(
      `
      <!DOCTYPE html>
      <html>
        <body>
          <select id="expression-select">
            <option value="">-- Select --</option>
          </select>
          <p id="expression-description"></p>
          <button id="run-static-btn" disabled>Run Static Analysis</button>
          <div id="status-indicator" class="status-indicator status-unknown">
            <span class="status-emoji"></span>
            <span class="status-label">Not Analyzed</span>
          </div>
          <p id="status-message"></p>
          <div id="static-results"></div>
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
          <button id="back-button">Back</button>
        </body>
      </html>
    `,
      {
        url: 'http://localhost',
        pretendToBeVisual: true,
      }
    );

    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = dom.window.navigator;

    // Bootstrap with minimal configuration (same as expression-diagnostics.js)
    sharedBootstrapper = new CommonBootstrapper();
    const result = await sharedBootstrapper.bootstrap({
      containerConfigType: 'minimal',
      worldName: 'default',
      skipModLoading: true,
      postInitHook: async (services, container) => {
        // Register expression services (required for IExpressionRegistry)
        // This is the fix being tested
        registerExpressionServices(container);

        // Register diagnostics services
        registerExpressionDiagnosticsServices(container);
      },
    });

    if (!result?.container || !result?.services) {
      throw new Error(
        'Bootstrap failed: container or services not initialized'
      );
    }

    sharedContainer = result.container;
    // result.services is available but not needed for these tests
  });

  afterAll(() => {
    // Clean up shared resources
    if (sharedContainer?.cleanup) {
      sharedContainer.cleanup();
    }
    dom.window.close();
    delete global.window;
    delete global.document;
    delete global.navigator;
  });

  describe('Service Registration', () => {
    it('should successfully resolve IExpressionRegistry after registerExpressionServices', () => {
      // This test verifies the fix for the "No service registered for key IExpressionRegistry" error
      const expressionRegistry = sharedContainer.resolve(
        tokens.IExpressionRegistry
      );

      expect(expressionRegistry).toBeDefined();
      expect(expressionRegistry).not.toBeNull();
      expect(typeof expressionRegistry.getAllExpressions).toBe('function');
      expect(typeof expressionRegistry.getExpression).toBe('function');
    });

    it('should successfully resolve IGateConstraintAnalyzer', () => {
      const gateAnalyzer = sharedContainer.resolve(
        diagnosticsTokens.IGateConstraintAnalyzer
      );

      expect(gateAnalyzer).toBeDefined();
      expect(gateAnalyzer).not.toBeNull();
      expect(typeof gateAnalyzer.analyze).toBe('function');
    });

    it('should successfully resolve IIntensityBoundsCalculator', () => {
      const boundsCalculator = sharedContainer.resolve(
        diagnosticsTokens.IIntensityBoundsCalculator
      );

      expect(boundsCalculator).toBeDefined();
      expect(boundsCalculator).not.toBeNull();
      expect(typeof boundsCalculator.analyzeExpression).toBe('function');
    });

    it('should resolve ILogger for diagnostics', () => {
      const logger = sharedContainer.resolve(tokens.ILogger);

      expect(logger).toBeDefined();
      expect(logger).not.toBeNull();
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });
  });

  describe('Negative Cases', () => {
    it('should fail to resolve IExpressionRegistry without registerExpressionServices', async () => {
      // This test verifies the negative case - without the fix, it should fail
      const freshBootstrapper = new CommonBootstrapper();
      let errorThrown = null;

      const { container } = await freshBootstrapper.bootstrap({
        containerConfigType: 'minimal',
        worldName: 'default',
        skipModLoading: true,
        // Note: NOT calling registerExpressionServices
      });

      try {
        container.resolve(tokens.IExpressionRegistry);
      } catch (error) {
        errorThrown = error;
      }

      // Assert that the expected error was thrown
      expect(errorThrown).toBeDefined();
      expect(errorThrown.message).toContain(
        'No service registered for key "IExpressionRegistry"'
      );
    });
  });

  describe('Controller Instantiation', () => {
    it('should create ExpressionDiagnosticsController with resolved dependencies', async () => {
      const ExpressionDiagnosticsController = (
        await import(
          '../../../src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js'
        )
      ).default;

      // Resolve all dependencies
      const logger = sharedContainer.resolve(tokens.ILogger);
      const expressionRegistry = sharedContainer.resolve(
        tokens.IExpressionRegistry
      );
      const gateAnalyzer = sharedContainer.resolve(
        diagnosticsTokens.IGateConstraintAnalyzer
      );
      const boundsCalculator = sharedContainer.resolve(
        diagnosticsTokens.IIntensityBoundsCalculator
      );
      const monteCarloSimulator = sharedContainer.resolve(
        diagnosticsTokens.IMonteCarloSimulator
      );
      const failureExplainer = sharedContainer.resolve(
        diagnosticsTokens.IFailureExplainer
      );
      const expressionStatusService = sharedContainer.resolve(
        diagnosticsTokens.IExpressionStatusService
      );

      // Create controller instance (should not throw)
      const controller = new ExpressionDiagnosticsController({
        logger,
        expressionRegistry,
        gateAnalyzer,
        boundsCalculator,
        monteCarloSimulator,
        failureExplainer,
        expressionStatusService,
      });

      expect(controller).toBeDefined();
      expect(controller).not.toBeNull();

      // Initialize controller (should not throw)
      await controller.initialize();
    });
  });
});
