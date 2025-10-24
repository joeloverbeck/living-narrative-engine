import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  ErrorClassifier,
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
  RECOVERY_POTENTIAL,
} from '../../../../src/actions/tracing/errorClassification.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

describe('ErrorClassifier', () => {
  let classifier;
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    classifier = new ErrorClassifier({ logger: mockLogger });
  });

  describe('Constructor', () => {
    it('should create classifier with valid logger', () => {
      expect(classifier).toBeInstanceOf(ErrorClassifier);
    });

    it('should initialize with classification rules', () => {
      const error = new Error('validation failed');
      const classification = classifier.classifyError(error);

      expect(classification).toBeTruthy();
      expect(classification.category).toBeTruthy();
    });
  });

  describe('Error Categorization', () => {
    it('should classify validation errors correctly', () => {
      const error = new Error('Validation failed: missing required field');
      const classification = classifier.classifyError(error);

      expect(classification.category).toBe(ERROR_CATEGORIES.VALIDATION);
      expect(classification.severity).toBe(ERROR_SEVERITY.MEDIUM);
      expect(classification.isRetryable).toBe(true);
      expect(classification.recoveryPotential).toBe(
        RECOVERY_POTENTIAL.IMMEDIATE
      );
    });

    it('should classify authorization errors correctly', () => {
      const error = new Error('Unauthorized: insufficient permissions');
      const classification = classifier.classifyError(error);

      expect(classification.category).toBe(ERROR_CATEGORIES.AUTHORIZATION);
      expect(classification.severity).toBe(ERROR_SEVERITY.HIGH);
      expect(classification.recoveryPotential).toBe(RECOVERY_POTENTIAL.MANUAL);
      expect(classification.isRetryable).toBe(false);
    });

    it('should classify network errors correctly', () => {
      const error = new Error('Network timeout: connection failed');
      const classification = classifier.classifyError(error);

      expect(classification.category).toBe(ERROR_CATEGORIES.NETWORK);
      expect(classification.isTransient).toBe(true);
      expect(classification.recoveryPotential).toBe(RECOVERY_POTENTIAL.DELAYED);
      expect(classification.isRetryable).toBe(true);
    });

    it('should classify resource errors correctly', () => {
      const error = new Error('Resource not found: entity does not exist');
      const classification = classifier.classifyError(error);

      expect(classification.category).toBe(ERROR_CATEGORIES.RESOURCE);
      expect(classification.severity).toBe(ERROR_SEVERITY.MEDIUM);
      expect(classification.recoveryPotential).toBe(
        RECOVERY_POTENTIAL.CONDITIONAL
      );
    });

    it('should classify timeout errors correctly', () => {
      const error = new Error('Operation timeout: deadline exceeded');
      const classification = classifier.classifyError(error);

      expect(classification.category).toBe(ERROR_CATEGORIES.TIMEOUT);
      expect(classification.severity).toBe(ERROR_SEVERITY.MEDIUM);
      expect(classification.recoveryPotential).toBe(RECOVERY_POTENTIAL.DELAYED);
      expect(classification.isTransient).toBe(true);
    });

    it('should classify logic errors correctly', () => {
      const error = new Error('Logic error: assertion failed');
      const classification = classifier.classifyError(error);

      expect(classification.category).toBe(ERROR_CATEGORIES.LOGIC);
      expect(classification.severity).toBe(ERROR_SEVERITY.HIGH);
      expect(classification.recoveryPotential).toBe(
        RECOVERY_POTENTIAL.PERMANENT
      );
      expect(classification.isRetryable).toBe(false);
    });

    it('should classify system errors correctly', () => {
      const error = new Error('Critical system failure in core module');
      const classification = classifier.classifyError(error);

      expect(classification.category).toBe(ERROR_CATEGORIES.SYSTEM);
      expect(classification.severity).toBe(ERROR_SEVERITY.CRITICAL);
      expect(classification.recoveryPotential).toBe(RECOVERY_POTENTIAL.MANUAL);
    });

    it('should classify unknown errors correctly', () => {
      const error = new Error('Something went wrong');
      const classification = classifier.classifyError(error);

      expect(classification.category).toBe(ERROR_CATEGORIES.UNKNOWN);
      expect(classification.severity).toBe(ERROR_SEVERITY.LOW);
      expect(classification.confidence).toBe(1.0);
    });
  });

  describe('Error Type Classification', () => {
    it('should classify TypeError as logic error', () => {
      const error = new TypeError('Cannot read property of undefined');
      const classification = classifier.classifyError(error);

      expect(classification.category).toBe(ERROR_CATEGORIES.LOGIC);
      expect(classification.severity).toBe(ERROR_SEVERITY.HIGH);
    });

    it('should classify ReferenceError as logic error', () => {
      const error = new ReferenceError('variable is not defined');
      const classification = classifier.classifyError(error);

      expect(classification.category).toBe(ERROR_CATEGORIES.LOGIC);
      expect(classification.severity).toBe(ERROR_SEVERITY.HIGH);
    });

    it('should classify SyntaxError as logic error', () => {
      const error = new SyntaxError('Unexpected token');
      const classification = classifier.classifyError(error);

      expect(classification.category).toBe(ERROR_CATEGORIES.LOGIC);
      expect(classification.severity).toBe(ERROR_SEVERITY.HIGH);
    });

    it('should classify RangeError as validation error', () => {
      const error = new RangeError('Invalid array length');
      const classification = classifier.classifyError(error);

      expect(classification.category).toBe(ERROR_CATEGORIES.VALIDATION);
      expect(classification.severity).toBe(ERROR_SEVERITY.MEDIUM);
    });
  });

  describe('Context-Based Classification', () => {
    it('should adjust severity based on initialization phase', () => {
      const error = new Error('Operation failed');

      const initClassification = classifier.classifyError(error, {
        phase: 'initialization',
      });
      const normalClassification = classifier.classifyError(error, {
        phase: 'processing',
      });

      expect(initClassification.severity).toBe(ERROR_SEVERITY.CRITICAL);
      expect(normalClassification.severity).not.toBe(ERROR_SEVERITY.CRITICAL);
    });

    it('should increase severity for retry failures', () => {
      const error = new Error('Operation failed');

      const firstAttempt = classifier.classifyError(error, { isRetry: false });
      const retryAttempt = classifier.classifyError(error, { isRetry: true });

      expect(retryAttempt.severity).toBe(ERROR_SEVERITY.HIGH);
      expect(firstAttempt.severity).not.toBe(ERROR_SEVERITY.HIGH);
    });

    it('should consider retry count in recovery assessment', () => {
      const error = new Error('Temporary failure');

      const firstAttempt = classifier.classifyError(error, { retryCount: 0 });
      const manyRetries = classifier.classifyError(error, { retryCount: 5 });

      expect(firstAttempt.recoveryPotential).not.toBe(
        RECOVERY_POTENTIAL.MANUAL
      );
      expect(manyRetries.recoveryPotential).toBe(RECOVERY_POTENTIAL.MANUAL);
    });

    it('should detect critical and fatal error messages', () => {
      const criticalError = new Error('Critical system shutdown');
      const fatalError = new Error('Fatal exception occurred');

      const criticalClassification = classifier.classifyError(criticalError);
      const fatalClassification = classifier.classifyError(fatalError);

      expect(criticalClassification.severity).toBe(ERROR_SEVERITY.CRITICAL);
      expect(fatalClassification.severity).toBe(ERROR_SEVERITY.CRITICAL);
    });

    it('should use category severity fallback when no keywords present', () => {
      const error = new Error('System internal failure detected');

      const classification = classifier.classifyError(error);

      expect(classification.category).toBe(ERROR_CATEGORIES.SYSTEM);
      expect(classification.severity).toBe(ERROR_SEVERITY.CRITICAL);
    });

    it('should detect warning and deprecated messages', () => {
      const warningError = new Error('Warning: deprecated API usage');
      const deprecatedError = new Error('Deprecated function called');

      const warningClassification = classifier.classifyError(warningError);
      const deprecatedClassification =
        classifier.classifyError(deprecatedError);

      expect(warningClassification.severity).toBe(ERROR_SEVERITY.LOW);
      expect(deprecatedClassification.severity).toBe(ERROR_SEVERITY.LOW);
    });
  });

  describe('Transient Error Detection', () => {
    it('should identify transient errors', () => {
      const transientErrors = [
        new Error('Connection timeout'),
        new Error('Network error'),
        new Error('Temporary unavailable'),
        new Error('Service busy'),
        new Error('Request throttled'),
      ];

      transientErrors.forEach((error) => {
        const classification = classifier.classifyError(error);
        expect(classification.isTransient).toBe(true);
      });
    });

    it('should identify non-transient errors', () => {
      const permanentErrors = [
        new Error('Invalid configuration'),
        new Error('Logic error'),
        new Error('Syntax error'),
      ];

      permanentErrors.forEach((error) => {
        const classification = classifier.classifyError(error);
        expect(classification.isTransient).toBe(false);
      });
    });
  });

  describe('Error Analysis', () => {
    it('should provide comprehensive error analysis', () => {
      const error = new Error('Test error with stack trace');
      error.stack = 'Error: Test error\\n    at test.js:10:5';
      error.cause = new Error('Root cause');

      const classification = classifier.classifyError(error, {
        phase: 'validation',
        timing: { duration: 100 },
      });

      expect(classification.analysis).toBeTruthy();
      expect(classification.analysis.errorType).toBe('Error');
      expect(classification.analysis.hasStackTrace).toBe(true);
      expect(classification.analysis.hasCause).toBe(true);
      expect(classification.analysis.contextPhase).toBe('validation');
      expect(classification.analysis.contextTiming).toBeTruthy();
      expect(classification.analysis.potentialCauses).toBeInstanceOf(Array);
    });

    it('should detect async errors from stack trace', () => {
      const error = new Error('Async operation failed');
      error.stack = `Error: Async operation failed
    at async function (/test/async.js:10:5)
    at Promise.resolve (/test/promise.js:20:10)`;

      const classification = classifier.classifyError(error);

      expect(classification.analysis.isAsyncError).toBe(true);
    });

    it('should handle errors without stack traces', () => {
      const error = new Error('Simple error');
      delete error.stack;

      const classification = classifier.classifyError(error);

      expect(classification.analysis.hasStackTrace).toBe(false);
      expect(classification.analysis.stackDepth).toBe(0);
      expect(classification.analysis.isAsyncError).toBe(false);
    });
  });

  describe('Troubleshooting Generation', () => {
    it('should generate relevant troubleshooting steps for validation errors', () => {
      const error = new Error('Invalid input parameters');
      const classification = classifier.classifyError(error);

      expect(classification.troubleshooting).toBeInstanceOf(Array);
      expect(classification.troubleshooting.length).toBeGreaterThan(0);
      expect(
        classification.troubleshooting.some(
          (step) =>
            step.toLowerCase().includes('input') ||
            step.toLowerCase().includes('parameters') ||
            step.toLowerCase().includes('validation')
        )
      ).toBe(true);
    });

    it('should generate relevant troubleshooting steps for authorization errors', () => {
      const error = new Error('Access denied');
      const classification = classifier.classifyError(error);

      expect(classification.troubleshooting).toBeInstanceOf(Array);
      expect(
        classification.troubleshooting.some(
          (step) =>
            step.toLowerCase().includes('permission') ||
            step.toLowerCase().includes('authentication') ||
            step.toLowerCase().includes('access')
        )
      ).toBe(true);
    });

    it('should generate relevant troubleshooting steps for network errors', () => {
      const error = new Error('Connection refused');
      const classification = classifier.classifyError(error);

      expect(
        classification.troubleshooting.some(
          (step) =>
            step.toLowerCase().includes('network') ||
            step.toLowerCase().includes('connection') ||
            step.toLowerCase().includes('connectivity')
        )
      ).toBe(true);
    });

    it('should include retry guidance for retryable errors', () => {
      const error = new Error('Timeout occurred');
      const classification = classifier.classifyError(error);

      if (classification.isRetryable) {
        expect(
          classification.troubleshooting.some((step) =>
            step.toLowerCase().includes('retry')
          )
        ).toBe(true);
      }
    });

    it('should provide different retry guidance based on recovery potential', () => {
      const immediateError = new Error('Validation failed');
      const delayedError = new Error('Timeout occurred');
      const conditionalError = new Error('Resource not found');

      const immediateClassification = classifier.classifyError(immediateError);
      const delayedClassification = classifier.classifyError(delayedError);
      const conditionalClassification =
        classifier.classifyError(conditionalError);

      if (
        immediateClassification.recoveryPotential ===
        RECOVERY_POTENTIAL.IMMEDIATE
      ) {
        expect(
          immediateClassification.troubleshooting.some((step) =>
            step.toLowerCase().includes('immediately')
          )
        ).toBe(true);
      }

      if (
        delayedClassification.recoveryPotential === RECOVERY_POTENTIAL.DELAYED
      ) {
        expect(
          delayedClassification.troubleshooting.some((step) =>
            step.toLowerCase().includes('delay')
          )
        ).toBe(true);
      }

      if (
        conditionalClassification.recoveryPotential ===
        RECOVERY_POTENTIAL.CONDITIONAL
      ) {
        expect(
          conditionalClassification.troubleshooting.some((step) =>
            step.toLowerCase().includes('conditions')
          )
        ).toBe(true);
      }
    });
  });

  describe('Potential Cause Identification', () => {
    it('should identify null/undefined causes', () => {
      const error = new Error('Cannot read property of null');
      const classification = classifier.classifyError(error);

      expect(
        classification.analysis.potentialCauses.some((cause) =>
          cause.toLowerCase().includes('null')
        )
      ).toBe(true);
    });

    it('should identify permission causes', () => {
      const error = new Error('Access permission denied');
      const classification = classifier.classifyError(error);

      expect(
        classification.analysis.potentialCauses.some((cause) =>
          cause.toLowerCase().includes('permission')
        )
      ).toBe(true);
    });

    it('should identify timeout causes', () => {
      const error = new Error('Operation exceeded deadline');
      const classification = classifier.classifyError(error);

      expect(
        classification.analysis.potentialCauses.some((cause) =>
          cause.toLowerCase().includes('time')
        )
      ).toBe(true);
    });

    it('should identify network causes', () => {
      const error = new Error('Connection refused');
      const classification = classifier.classifyError(error);

      expect(
        classification.analysis.potentialCauses.some((cause) =>
          cause.toLowerCase().includes('network')
        )
      ).toBe(true);
    });

    it('should identify initialization phase causes', () => {
      const error = new Error('Service unavailable');
      const classification = classifier.classifyError(error, {
        phase: 'initialization',
      });

      expect(
        classification.analysis.potentialCauses.some((cause) =>
          cause.toLowerCase().includes('initialization')
        )
      ).toBe(true);
    });

    it('should identify retry-related causes', () => {
      const error = new Error('Operation failed');
      const classification = classifier.classifyError(error, {
        retryCount: 2,
      });

      expect(
        classification.analysis.potentialCauses.some((cause) =>
          cause.toLowerCase().includes('retry')
        )
      ).toBe(true);
    });

    it('should provide default cause when none identified', () => {
      const error = new Error('Unknown issue');
      const classification = classifier.classifyError(error);

      expect(classification.analysis.potentialCauses).toContain(
        'Unknown cause - requires investigation'
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle errors without messages', () => {
      const error = new Error();
      const classification = classifier.classifyError(error);

      expect(classification.category).toBeTruthy();
      expect(classification.severity).toBeTruthy();
      expect(classification.troubleshooting).toBeInstanceOf(Array);
    });

    it('should handle errors with empty messages', () => {
      const error = new Error('');
      const classification = classifier.classifyError(error);

      expect(classification.category).toBeTruthy();
      expect(classification.severity).toBeTruthy();
      expect(classification.troubleshooting).toBeInstanceOf(Array);
    });

    it('should handle errors with null context', () => {
      const error = new Error('Test error');
      const classification = classifier.classifyError(error, null);

      expect(classification.category).toBeTruthy();
      expect(classification.severity).toBeTruthy();
    });

    it('should handle errors with undefined context', () => {
      const error = new Error('Test error');
      const classification = classifier.classifyError(error, undefined);

      expect(classification.category).toBeTruthy();
      expect(classification.severity).toBeTruthy();
    });

    it('should handle null error inputs gracefully', () => {
      const classification = classifier.classifyError(null);

      expect(classification.category).toBe(ERROR_CATEGORIES.UNKNOWN);
      expect(classification.severity).toBe(ERROR_SEVERITY.LOW);
      expect(classification.isTransient).toBe(false);
      expect(classification.isRetryable).toBe(true);
    });
  });

  describe('Classification Consistency', () => {
    it('should provide consistent classifications for same error', () => {
      const error = new Error('Consistent test error');
      const context = { phase: 'processing', retryCount: 1 };

      const classification1 = classifier.classifyError(error, context);
      const classification2 = classifier.classifyError(error, context);

      expect(classification1.category).toBe(classification2.category);
      expect(classification1.severity).toBe(classification2.severity);
      expect(classification1.recoveryPotential).toBe(
        classification2.recoveryPotential
      );
      expect(classification1.isRetryable).toBe(classification2.isRetryable);
    });

    it('should include all required classification fields', () => {
      const error = new Error('Complete classification test');
      const classification = classifier.classifyError(error);

      expect(classification).toHaveProperty('category');
      expect(classification).toHaveProperty('severity');
      expect(classification).toHaveProperty('recoveryPotential');
      expect(classification).toHaveProperty('isTransient');
      expect(classification).toHaveProperty('isRetryable');
      expect(classification).toHaveProperty('confidence');
      expect(classification).toHaveProperty('analysis');
      expect(classification).toHaveProperty('troubleshooting');
    });
  });
});
