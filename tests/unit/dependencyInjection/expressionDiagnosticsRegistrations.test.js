/**
 * @file Unit tests for Expression Diagnostics DI registrations
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { diagnosticsTokens } from '../../../src/dependencyInjection/tokens/tokens-diagnostics.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import {
  registerExpressionDiagnosticsServices,
  isDiagnosticsAvailable,
} from '../../../src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js';

describe('expressionDiagnosticsRegistrations', () => {
  let mockContainer;
  let mockLogger;
  let mockDataRegistry;
  let registeredFactories;

  beforeEach(() => {
    jest.clearAllMocks();
    registeredFactories = new Map();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // DataRegistry uses get(type, id) method
    mockDataRegistry = {
      get: jest.fn().mockReturnValue({ entries: {} }),
    };

    mockContainer = {
      register: jest.fn((token, factory, options) => {
        registeredFactories.set(token, { factory, options });
      }),
      resolve: jest.fn((token) => {
        if (token === tokens.ILogger) return mockLogger;
        if (token === tokens.IDataRegistry) return mockDataRegistry;
        if (registeredFactories.has(token)) {
          return registeredFactories.get(token).factory(mockContainer);
        }
        throw new Error(`Token not found: ${token}`);
      }),
    };
  });

  describe('registerExpressionDiagnosticsServices', () => {
    it('should register GateConstraintAnalyzer', () => {
      registerExpressionDiagnosticsServices(mockContainer);

      expect(mockContainer.register).toHaveBeenCalledWith(
        diagnosticsTokens.IGateConstraintAnalyzer,
        expect.any(Function),
        expect.any(Object)
      );
    });

    it('should register IntensityBoundsCalculator', () => {
      registerExpressionDiagnosticsServices(mockContainer);

      expect(mockContainer.register).toHaveBeenCalledWith(
        diagnosticsTokens.IIntensityBoundsCalculator,
        expect.any(Function),
        expect.any(Object)
      );
    });

    it('should register exactly 6 services (Phase 1 + Phase 2 + ExpressionStatusService + Phase 3)', () => {
      registerExpressionDiagnosticsServices(mockContainer);

      expect(mockContainer.register).toHaveBeenCalledTimes(6);
    });

    it('should register ExpressionStatusService', () => {
      registerExpressionDiagnosticsServices(mockContainer);

      expect(mockContainer.register).toHaveBeenCalledWith(
        diagnosticsTokens.IExpressionStatusService,
        expect.any(Function),
        expect.any(Object)
      );
    });

    it('should register WitnessStateFinder', () => {
      registerExpressionDiagnosticsServices(mockContainer);

      expect(mockContainer.register).toHaveBeenCalledWith(
        diagnosticsTokens.IWitnessStateFinder,
        expect.any(Function),
        expect.any(Object)
      );
    });

    it('should use singletonFactory lifecycle', () => {
      registerExpressionDiagnosticsServices(mockContainer);

      for (const [, { options }] of registeredFactories) {
        expect(options.lifecycle).toBe('singletonFactory');
      }
    });

    it('should log registration start and completion', () => {
      registerExpressionDiagnosticsServices(mockContainer);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('starting')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('completed')
      );
    });

    it('should allow resolving GateConstraintAnalyzer after registration', () => {
      registerExpressionDiagnosticsServices(mockContainer);

      const service = mockContainer.resolve(
        diagnosticsTokens.IGateConstraintAnalyzer
      );
      expect(service).toBeDefined();
      expect(typeof service.analyze).toBe('function');
    });

    it('should allow resolving IntensityBoundsCalculator after registration', () => {
      registerExpressionDiagnosticsServices(mockContainer);

      const service = mockContainer.resolve(
        diagnosticsTokens.IIntensityBoundsCalculator
      );
      expect(service).toBeDefined();
      expect(typeof service.calculateBounds).toBe('function');
    });

    it('should work without logger available', () => {
      const containerWithoutLogger = {
        register: jest.fn((token, factory, options) => {
          registeredFactories.set(token, { factory, options });
        }),
        resolve: jest.fn((token) => {
          if (token === tokens.ILogger) {
            throw new Error('Logger not registered');
          }
          if (token === tokens.IDataRegistry) return mockDataRegistry;
          if (registeredFactories.has(token)) {
            return registeredFactories.get(token).factory(containerWithoutLogger);
          }
          throw new Error(`Token not found: ${token}`);
        }),
      };

      // Should not throw
      expect(() => {
        registerExpressionDiagnosticsServices(containerWithoutLogger);
      }).not.toThrow();

      expect(containerWithoutLogger.register).toHaveBeenCalledTimes(6);
    });
  });

  describe('isDiagnosticsAvailable', () => {
    it('should return true when services are registered', () => {
      registerExpressionDiagnosticsServices(mockContainer);

      expect(isDiagnosticsAvailable(mockContainer)).toBe(true);
    });

    it('should return false when services are not registered', () => {
      const emptyContainer = {
        resolve: jest.fn(() => {
          throw new Error('Not found');
        }),
      };

      expect(isDiagnosticsAvailable(emptyContainer)).toBe(false);
    });

    it('should return false when only one service is registered', () => {
      // Register only GateConstraintAnalyzer
      mockContainer.register(
        diagnosticsTokens.IGateConstraintAnalyzer,
        () => ({ analyze: jest.fn() }),
        { lifecycle: 'singletonFactory' }
      );

      // Override resolve to only return the one service
      const partialContainer = {
        resolve: jest.fn((token) => {
          if (token === diagnosticsTokens.IGateConstraintAnalyzer) {
            return { analyze: jest.fn() };
          }
          throw new Error('Not found');
        }),
      };

      expect(isDiagnosticsAvailable(partialContainer)).toBe(false);
    });
  });

  describe('diagnosticsTokens', () => {
    it('should export IGateConstraintAnalyzer token', () => {
      expect(diagnosticsTokens.IGateConstraintAnalyzer).toBe(
        'IGateConstraintAnalyzer'
      );
    });

    it('should export IIntensityBoundsCalculator token', () => {
      expect(diagnosticsTokens.IIntensityBoundsCalculator).toBe(
        'IIntensityBoundsCalculator'
      );
    });

    it('should export IExpressionStatusService token', () => {
      expect(diagnosticsTokens.IExpressionStatusService).toBe(
        'IExpressionStatusService'
      );
    });

    it('should export IWitnessStateFinder token', () => {
      expect(diagnosticsTokens.IWitnessStateFinder).toBe('IWitnessStateFinder');
    });

    it('should be frozen', () => {
      expect(Object.isFrozen(diagnosticsTokens)).toBe(true);
    });

    it('should not allow modification', () => {
      expect(() => {
        diagnosticsTokens.newToken = 'test';
      }).toThrow();
    });
  });

  describe('tokens integration', () => {
    it('should export diagnosticsTokens from main tokens module', () => {
      // The spread means individual tokens are on tokens object
      expect(tokens.IGateConstraintAnalyzer).toBe('IGateConstraintAnalyzer');
      expect(tokens.IIntensityBoundsCalculator).toBe('IIntensityBoundsCalculator');
    });
  });
});
