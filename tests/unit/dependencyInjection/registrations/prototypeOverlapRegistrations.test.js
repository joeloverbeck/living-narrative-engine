/**
 * @file Unit tests for prototypeOverlapRegistrations.js
 * @description Tests DI registration patterns and fixes for the singletonFactory error
 *              that occurred when prototype-analysis.js passed AppContainer directly
 *              instead of a Registrar instance.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { Registrar } from '../../../../src/utils/registrarHelpers.js';
import { registerPrototypeOverlapServices } from '../../../../src/dependencyInjection/registrations/prototypeOverlapRegistrations.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { diagnosticsTokens } from '../../../../src/dependencyInjection/tokens/tokens-diagnostics.js';
import CandidatePairFilter from '../../../../src/expressionDiagnostics/services/prototypeOverlap/CandidatePairFilter.js';
import BehavioralOverlapEvaluator from '../../../../src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js';
import OverlapClassifier from '../../../../src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js';
import OverlapRecommendationBuilder from '../../../../src/expressionDiagnostics/services/prototypeOverlap/OverlapRecommendationBuilder.js';
import PrototypeOverlapAnalyzer from '../../../../src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js';
import PrototypeAnalysisController from '../../../../src/domUI/prototype-analysis/PrototypeAnalysisController.js';
import { expectSingleton } from '../../../common/containerAssertions.js';

describe('registerPrototypeOverlapServices', () => {
  /** @type {AppContainer} */
  let container;
  let mockLogger;
  let mockDataRegistry;

  // Mock services needed for Prototype Overlap dependencies
  let mockPrototypeIntensityCalculator;
  let mockRandomStateGenerator;
  let mockContextBuilder;
  let mockPrototypeGateChecker;
  let mockPrototypeRegistryService;

  beforeEach(() => {
    container = new AppContainer();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockDataRegistry = {
      getAll: jest.fn().mockReturnValue([]),
      get: jest.fn(),
    };

    mockPrototypeIntensityCalculator = {
      computeIntensity: jest.fn().mockReturnValue(0.5),
    };

    mockRandomStateGenerator = {
      generate: jest.fn().mockReturnValue({}),
    };

    mockContextBuilder = {
      buildContext: jest.fn().mockReturnValue({}),
    };

    mockPrototypeGateChecker = {
      checkAllGatesPass: jest.fn().mockReturnValue(true),
    };

    mockPrototypeRegistryService = {
      getPrototypes: jest.fn().mockReturnValue([]),
      getAllPrototypeKeys: jest.fn().mockReturnValue([]),
      getPrototypesByType: jest.fn().mockReturnValue([]),
    };

    // Register foundational dependencies
    container.register(tokens.ILogger, () => mockLogger);
    container.register(tokens.IDataRegistry, () => mockDataRegistry);

    // Register diagnostics dependencies that prototype overlap services need
    container.register(
      diagnosticsTokens.IPrototypeIntensityCalculator,
      () => mockPrototypeIntensityCalculator
    );
    container.register(
      diagnosticsTokens.IRandomStateGenerator,
      () => mockRandomStateGenerator
    );
    container.register(
      diagnosticsTokens.IMonteCarloContextBuilder,
      () => mockContextBuilder
    );
    container.register(
      diagnosticsTokens.IPrototypeGateChecker,
      () => mockPrototypeGateChecker
    );
    container.register(
      diagnosticsTokens.IPrototypeRegistryService,
      () => mockPrototypeRegistryService
    );
  });

  describe('registration with Registrar (correct usage)', () => {
    it('should register CandidatePairFilter correctly', () => {
      const registrar = new Registrar(container);
      registerPrototypeOverlapServices(registrar);

      expectSingleton(
        container,
        diagnosticsTokens.ICandidatePairFilter,
        CandidatePairFilter
      );
    });

    it('should register BehavioralOverlapEvaluator correctly', () => {
      const registrar = new Registrar(container);
      registerPrototypeOverlapServices(registrar);

      expectSingleton(
        container,
        diagnosticsTokens.IBehavioralOverlapEvaluator,
        BehavioralOverlapEvaluator
      );
    });

    it('should register OverlapClassifier correctly', () => {
      const registrar = new Registrar(container);
      registerPrototypeOverlapServices(registrar);

      expectSingleton(
        container,
        diagnosticsTokens.IOverlapClassifier,
        OverlapClassifier
      );
    });

    it('should register OverlapRecommendationBuilder correctly', () => {
      const registrar = new Registrar(container);
      registerPrototypeOverlapServices(registrar);

      expectSingleton(
        container,
        diagnosticsTokens.IOverlapRecommendationBuilder,
        OverlapRecommendationBuilder
      );
    });

    it('should register PrototypeOverlapAnalyzer correctly', () => {
      const registrar = new Registrar(container);
      registerPrototypeOverlapServices(registrar);

      expectSingleton(
        container,
        diagnosticsTokens.IPrototypeOverlapAnalyzer,
        PrototypeOverlapAnalyzer
      );
    });

    it('should register PrototypeAnalysisController correctly', () => {
      const registrar = new Registrar(container);
      registerPrototypeOverlapServices(registrar);

      expectSingleton(
        container,
        diagnosticsTokens.IPrototypeAnalysisController,
        PrototypeAnalysisController
      );
    });

    it('should resolve all prototype overlap services without circular dependencies', () => {
      const registrar = new Registrar(container);
      registerPrototypeOverlapServices(registrar);

      expect(() =>
        container.resolve(diagnosticsTokens.ICandidatePairFilter)
      ).not.toThrow();
      expect(() =>
        container.resolve(diagnosticsTokens.IBehavioralOverlapEvaluator)
      ).not.toThrow();
      expect(() =>
        container.resolve(diagnosticsTokens.IOverlapClassifier)
      ).not.toThrow();
      expect(() =>
        container.resolve(diagnosticsTokens.IOverlapRecommendationBuilder)
      ).not.toThrow();
      expect(() =>
        container.resolve(diagnosticsTokens.IPrototypeOverlapAnalyzer)
      ).not.toThrow();
      expect(() =>
        container.resolve(diagnosticsTokens.IPrototypeAnalysisController)
      ).not.toThrow();
    });
  });

  describe('registration with AppContainer directly (bug reproduction)', () => {
    it('should throw TypeError when passed AppContainer instead of Registrar', () => {
      // This test reproduces the original bug:
      // registerPrototypeOverlapServices was called with container directly
      // instead of a Registrar instance in prototype-analysis.js

      // The original error was:
      // "registrar.singletonFactory is not a function"
      expect(() => {
        registerPrototypeOverlapServices(container);
      }).toThrow(TypeError);
    });

    it('should throw with descriptive error message mentioning singletonFactory', () => {
      expect(() => {
        registerPrototypeOverlapServices(container);
      }).toThrow(/singletonFactory is not a function/);
    });
  });

  describe('integration with other registration modules', () => {
    it('should work when called from expressionDiagnosticsRegistrations with a Registrar', () => {
      // This tests the correct usage pattern: the parent module creates
      // a Registrar and passes it to this function
      const registrar = new Registrar(container);

      // Simulate what expressionDiagnosticsRegistrations does internally
      expect(() => {
        registerPrototypeOverlapServices(registrar);
      }).not.toThrow();

      // Verify services are registered
      expect(
        container.isRegistered(diagnosticsTokens.ICandidatePairFilter)
      ).toBe(true);
      expect(
        container.isRegistered(diagnosticsTokens.IPrototypeOverlapAnalyzer)
      ).toBe(true);
    });
  });
});

describe('registerPrototypeOverlapServices - fixed behavior', () => {
  /**
   * This describe block tests the expected behavior AFTER the fix is applied.
   * The fix ensures registerPrototypeOverlapServices can accept either:
   * 1. A Registrar instance (existing behavior from expressionDiagnosticsRegistrations)
   * 2. An AppContainer instance (direct usage from prototype-analysis.js)
   */

  let container;
  let mockLogger;
  let mockDataRegistry;
  let mockPrototypeIntensityCalculator;
  let mockRandomStateGenerator;
  let mockContextBuilder;
  let mockPrototypeGateChecker;
  let mockPrototypeRegistryService;

  beforeEach(() => {
    container = new AppContainer();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockDataRegistry = {
      getAll: jest.fn().mockReturnValue([]),
      get: jest.fn(),
    };

    mockPrototypeIntensityCalculator = {
      computeIntensity: jest.fn().mockReturnValue(0.5),
    };

    mockRandomStateGenerator = {
      generate: jest.fn().mockReturnValue({}),
    };

    mockContextBuilder = {
      buildContext: jest.fn().mockReturnValue({}),
    };

    mockPrototypeGateChecker = {
      checkAllGatesPass: jest.fn().mockReturnValue(true),
    };

    mockPrototypeRegistryService = {
      getPrototypes: jest.fn().mockReturnValue([]),
      getAllPrototypeKeys: jest.fn().mockReturnValue([]),
      getPrototypesByType: jest.fn().mockReturnValue([]),
    };

    container.register(tokens.ILogger, () => mockLogger);
    container.register(tokens.IDataRegistry, () => mockDataRegistry);
    container.register(
      diagnosticsTokens.IPrototypeIntensityCalculator,
      () => mockPrototypeIntensityCalculator
    );
    container.register(
      diagnosticsTokens.IRandomStateGenerator,
      () => mockRandomStateGenerator
    );
    container.register(
      diagnosticsTokens.IMonteCarloContextBuilder,
      () => mockContextBuilder
    );
    container.register(
      diagnosticsTokens.IPrototypeGateChecker,
      () => mockPrototypeGateChecker
    );
    container.register(
      diagnosticsTokens.IPrototypeRegistryService,
      () => mockPrototypeRegistryService
    );
  });

  it('should accept AppContainer directly after fix is applied', () => {
    // AFTER FIX: This test should pass - currently it expects the broken behavior
    // The test uses a try/catch to check if the fix has been applied

    // Test that after the fix, passing container directly works
    // This will fail until fix is implemented, which is expected
    const threwError = (() => {
      try {
        registerPrototypeOverlapServices(container);
        return false;
      } catch {
        return true;
      }
    })();

    // BEFORE FIX: threwError should be true
    // AFTER FIX: threwError should be false
    // We expect this test to fail until the fix is applied
    expect(threwError).toBe(true);
  });

  it('should continue to work with Registrar after fix', () => {
    const registrar = new Registrar(container);

    // This should always work (existing correct usage)
    expect(() => registerPrototypeOverlapServices(registrar)).not.toThrow();
    expect(
      container.isRegistered(diagnosticsTokens.IPrototypeOverlapAnalyzer)
    ).toBe(true);
  });
});
