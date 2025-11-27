/**
 * @file Integration tests for startup handler completeness validation.
 * Verifies that startup validation compares KNOWN_OPERATION_TYPES against
 * OperationRegistry and reports mismatches as warnings (not errors).
 * @see tickets/ROBOPEHANVAL-006-startup-validation.md
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { HandlerCompletenessValidator } from '../../../src/validation/handlerCompletenessValidator.js';
import OperationRegistry from '../../../src/logic/operationRegistry.js';
import { KNOWN_OPERATION_TYPES } from '../../../src/utils/preValidationUtils.js';

describe('Startup Handler Validation Integration', () => {
  let mockLogger;
  let operationRegistry;
  let handlerValidator;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    operationRegistry = new OperationRegistry({ logger: mockLogger });
    handlerValidator = new HandlerCompletenessValidator({ logger: mockLogger });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Validation with Complete Registry', () => {
    it('should report isComplete=true when all whitelist types have handlers', () => {
      // Arrange - Register handlers for all known types
      const knownTypes = ['LOG', 'SET_COMPONENT_VALUE', 'DISPATCH_EVENT'];
      knownTypes.forEach((type) => {
        operationRegistry.register(type, () => {});
      });

      // Act
      const report = handlerValidator.validateHandlerRegistryCompleteness(
        knownTypes,
        operationRegistry
      );

      // Assert
      expect(report.isComplete).toBe(true);
      expect(report.missingHandlers).toHaveLength(0);
      expect(report.orphanedHandlers).toHaveLength(0);
    });

    it('should work with actual KNOWN_OPERATION_TYPES array', () => {
      // Arrange - Register handlers for ALL known operation types
      KNOWN_OPERATION_TYPES.forEach((type) => {
        operationRegistry.register(type, () => {});
      });

      // Act
      const report = handlerValidator.validateHandlerRegistryCompleteness(
        KNOWN_OPERATION_TYPES,
        operationRegistry
      );

      // Assert
      expect(report.isComplete).toBe(true);
      expect(report.missingHandlers).toHaveLength(0);
      expect(report.orphanedHandlers).toHaveLength(0);
    });
  });

  describe('Validation with Missing Handlers', () => {
    it('should detect operations in whitelist without registered handlers', () => {
      // Arrange - Register only LOG, not SET_COMPONENT_VALUE
      const knownTypes = ['LOG', 'SET_COMPONENT_VALUE', 'DISPATCH_EVENT'];
      operationRegistry.register('LOG', () => {});

      // Act
      const report = handlerValidator.validateHandlerRegistryCompleteness(
        knownTypes,
        operationRegistry
      );

      // Assert
      expect(report.isComplete).toBe(false);
      expect(report.missingHandlers).toContain('SET_COMPONENT_VALUE');
      expect(report.missingHandlers).toContain('DISPATCH_EVENT');
      expect(report.missingHandlers).not.toContain('LOG');
    });

    it('should return missing handlers in sorted order', () => {
      // Arrange
      const knownTypes = ['ZETA_OP', 'ALPHA_OP', 'BETA_OP'];
      // Register none

      // Act
      const report = handlerValidator.validateHandlerRegistryCompleteness(
        knownTypes,
        operationRegistry
      );

      // Assert
      expect(report.missingHandlers).toEqual(['ALPHA_OP', 'BETA_OP', 'ZETA_OP']);
    });

    it('should not throw when handlers are missing (warnings only)', () => {
      // Arrange - No handlers registered for any types
      const knownTypes = ['MISSING_OP_A', 'MISSING_OP_B'];

      // Act & Assert - Should not throw
      expect(() => {
        handlerValidator.validateHandlerRegistryCompleteness(
          knownTypes,
          operationRegistry
        );
      }).not.toThrow();
    });
  });

  describe('Validation with Orphaned Handlers', () => {
    it('should detect handlers registered but not in whitelist', () => {
      // Arrange - Register handlers not in whitelist
      const knownTypes = ['LOG'];
      operationRegistry.register('LOG', () => {});
      operationRegistry.register('ORPHAN_OP', () => {}); // Not in whitelist

      // Act
      const report = handlerValidator.validateHandlerRegistryCompleteness(
        knownTypes,
        operationRegistry
      );

      // Assert
      expect(report.isComplete).toBe(false);
      expect(report.orphanedHandlers).toContain('ORPHAN_OP');
      expect(report.orphanedHandlers).not.toContain('LOG');
    });

    it('should return orphaned handlers in sorted order', () => {
      // Arrange
      const knownTypes = [];
      operationRegistry.register('ZETA_ORPHAN', () => {});
      operationRegistry.register('ALPHA_ORPHAN', () => {});

      // Act
      const report = handlerValidator.validateHandlerRegistryCompleteness(
        knownTypes,
        operationRegistry
      );

      // Assert
      expect(report.orphanedHandlers).toEqual(['ALPHA_ORPHAN', 'ZETA_ORPHAN']);
    });

    it('should not throw when handlers are orphaned (warnings only)', () => {
      // Arrange - Register handler not in whitelist
      const knownTypes = [];
      operationRegistry.register('ORPHAN_OP', () => {});

      // Act & Assert - Should not throw
      expect(() => {
        handlerValidator.validateHandlerRegistryCompleteness(
          knownTypes,
          operationRegistry
        );
      }).not.toThrow();
    });
  });

  describe('Combined Missing and Orphaned', () => {
    it('should detect both missing and orphaned handlers simultaneously', () => {
      // Arrange
      const knownTypes = ['EXPECTED_A', 'EXPECTED_B'];
      operationRegistry.register('EXPECTED_A', () => {}); // In whitelist
      operationRegistry.register('ORPHAN_C', () => {}); // Not in whitelist
      // EXPECTED_B is missing from registry

      // Act
      const report = handlerValidator.validateHandlerRegistryCompleteness(
        knownTypes,
        operationRegistry
      );

      // Assert
      expect(report.isComplete).toBe(false);
      expect(report.missingHandlers).toContain('EXPECTED_B');
      expect(report.orphanedHandlers).toContain('ORPHAN_C');
    });
  });

  describe('Startup Flow Simulation', () => {
    it('should simulate startup validation logging for complete registry', () => {
      // Arrange
      const knownTypes = ['LOG', 'IF'];
      knownTypes.forEach((type) => {
        operationRegistry.register(type, () => {});
      });

      // Act - Simulate the startup validation flow from main.js
      const report = handlerValidator.validateHandlerRegistryCompleteness(
        knownTypes,
        operationRegistry
      );

      if (!report.isComplete) {
        if (report.missingHandlers.length > 0) {
          mockLogger.warn('Missing handlers', {
            missingHandlers: report.missingHandlers,
          });
        }
        if (report.orphanedHandlers.length > 0) {
          mockLogger.warn('Orphaned handlers', {
            orphanedHandlers: report.orphanedHandlers,
          });
        }
      } else {
        mockLogger.debug('Handler completeness check passed');
      }

      // Assert - Should log debug (success), not warn
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Handler completeness check passed'
      );
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should simulate startup validation logging for incomplete registry', () => {
      // Arrange - Missing handler
      const knownTypes = ['LOG', 'MISSING_OP'];
      operationRegistry.register('LOG', () => {});

      // Clear logger after registration (registry logs during registration)
      mockLogger.debug.mockClear();
      mockLogger.warn.mockClear();

      // Act - Simulate the startup validation flow from main.js
      const report = handlerValidator.validateHandlerRegistryCompleteness(
        knownTypes,
        operationRegistry
      );

      if (!report.isComplete) {
        if (report.missingHandlers.length > 0) {
          mockLogger.warn('Missing handlers', {
            missingHandlers: report.missingHandlers,
          });
        }
        if (report.orphanedHandlers.length > 0) {
          mockLogger.warn('Orphaned handlers', {
            orphanedHandlers: report.orphanedHandlers,
          });
        }
      } else {
        mockLogger.debug('Handler completeness check passed');
      }

      // Assert - Should log warning for missing handlers
      expect(mockLogger.warn).toHaveBeenCalledWith('Missing handlers', {
        missingHandlers: ['MISSING_OP'],
      });
      // debug should not have been called for the "completeness check passed" message
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        'Handler completeness check passed'
      );
    });

    it('should not block startup even when validation finds issues', () => {
      // Arrange - Both missing and orphaned
      const knownTypes = ['EXPECTED_OP'];
      operationRegistry.register('ORPHAN_OP', () => {});

      // Act - Simulate startup validation with try-catch like main.js
      let startupBlocked = false;
      try {
        const report = handlerValidator.validateHandlerRegistryCompleteness(
          knownTypes,
          operationRegistry
        );

        // Log warnings but don't throw
        if (!report.isComplete) {
          if (report.missingHandlers.length > 0) {
            mockLogger.warn('Missing handlers', report.missingHandlers);
          }
          if (report.orphanedHandlers.length > 0) {
            mockLogger.warn('Orphaned handlers', report.orphanedHandlers);
          }
        }
        // Startup continues...
      } catch (err) {
        startupBlocked = true;
      }

      // Assert - Startup should NOT be blocked
      expect(startupBlocked).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled(); // Warnings were logged
    });
  });

  describe('Error Handling', () => {
    it('should handle registry errors gracefully', () => {
      // Arrange - Create a mock registry that throws
      const brokenRegistry = {
        getRegisteredTypes: () => {
          throw new Error('Registry unavailable');
        },
      };

      // Act - Simulate try-catch from main.js
      let validationError = null;
      try {
        handlerValidator.validateHandlerRegistryCompleteness(
          ['LOG'],
          brokenRegistry
        );
      } catch (err) {
        validationError = err;
        // In main.js, this would be caught and logged as warning
        mockLogger.warn('Validation failed (non-blocking)', err);
      }

      // Assert
      expect(validationError).not.toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Validation failed (non-blocking)',
        expect.any(Error)
      );
    });
  });
});
