/**
 * @file Property-based tests for error normalization utility.
 * Tests the invariant: All caught non-Error values produce valid Error instances.
 */

import { describe, it, expect } from '@jest/globals';
import fc from 'fast-check';
import {
  normalizeError,
  safeAugmentError,
} from '../../../src/utils/errorNormalization.js';

describe('Error Normalization Property Tests', () => {
  describe('normalizeError()', () => {
    it('Property: always returns an Error instance for any input', () => {
      fc.assert(
        fc.property(fc.anything(), (value) => {
          const result = normalizeError(value);
          expect(result).toBeInstanceOf(Error);
          expect(result.message).toBeDefined();
        })
      );
    });

    it('Property: Error instances pass through unchanged', () => {
      fc.assert(
        fc.property(fc.string(), (message) => {
          const original = new Error(message);
          const result = normalizeError(original);
          expect(result).toBe(original); // Same reference
        })
      );
    });

    it('Property: non-Error values have String(value) as message', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.float(),
            fc.boolean(),
            fc.constant(null),
            fc.constant(undefined)
          ),
          (value) => {
            const result = normalizeError(value);
            expect(result.message).toBe(String(value));
          }
        )
      );
    });

    it('Property: context is attached when provided for non-Error values', () => {
      // Use a generator that excludes Error instances to avoid conditional logic
      const nonErrorArb = fc.oneof(
        fc.string(),
        fc.integer(),
        fc.float(),
        fc.boolean(),
        fc.constant(null),
        fc.constant(undefined),
        fc.object()
      );

      fc.assert(
        fc.property(
          nonErrorArb,
          fc.string({ minLength: 1 }), // Non-empty context strings
          (value, context) => {
            const result = normalizeError(value, context);
            expect(result.context).toBe(context);
          }
        )
      );
    });

    it('Property: normalization is idempotent for Errors', () => {
      fc.assert(
        fc.property(fc.string(), (message) => {
          const error = new Error(message);
          const once = normalizeError(error);
          const twice = normalizeError(once);
          expect(twice).toBe(once);
          expect(twice).toBe(error);
        })
      );
    });

    it('Property: never throws for any input', () => {
      fc.assert(
        fc.property(fc.anything(), (value) => {
          expect(() => normalizeError(value)).not.toThrow();
        })
      );
    });

    it('Property: message is always a string (never undefined or null)', () => {
      fc.assert(
        fc.property(fc.anything(), (value) => {
          const result = normalizeError(value);
          expect(typeof result.message).toBe('string');
        })
      );
    });
  });

  describe('Error Accumulation Property Tests', () => {
    /**
     * Accumulates multiple errors onto a primary error.
     * Mirrors the pattern from gameEngine.js attachCleanupError() (lines 601-620).
     *
     * @param {Error[]} errors - Array of errors to accumulate
     * @returns {{ primary: Error | null, cleanupErrors: Error[] }} Accumulated result
     */
    function accumulateErrors(errors) {
      if (errors.length === 0) {
        return { primary: null, cleanupErrors: [] };
      }

      const primaryError = errors[0];
      const cleanupErrors = errors.slice(1);

      if (cleanupErrors.length > 0) {
        if (!safeAugmentError(primaryError, 'cleanupErrors', cleanupErrors)) {
          // Fallback if augmentation fails
          return { primary: primaryError, cleanupErrors };
        }
      }

      return {
        primary: primaryError,
        cleanupErrors: primaryError.cleanupErrors || [],
      };
    }

    it('Property: cascading failures preserve all error information', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string(), { minLength: 1, maxLength: 20 }),
          (errorMessages) => {
            const errors = errorMessages.map((m) => new Error(m));
            const result = accumulateErrors(errors);

            expect(result.primary).toBe(errors[0]);
            expect(result.cleanupErrors).toHaveLength(errors.length - 1);

            // Verify all cleanup errors are preserved
            for (let i = 1; i < errors.length; i++) {
              expect(result.cleanupErrors).toContain(errors[i]);
            }
          }
        )
      );
    });

    it('Property: single error has no cleanupErrors', () => {
      fc.assert(
        fc.property(fc.string(), (message) => {
          const errors = [new Error(message)];
          const result = accumulateErrors(errors);

          expect(result.primary).toBe(errors[0]);
          expect(result.cleanupErrors).toHaveLength(0);
        })
      );
    });

    it('Property: error order is preserved in cleanupErrors', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string(), { minLength: 2, maxLength: 10 }),
          (errorMessages) => {
            const errors = errorMessages.map((m) => new Error(m));
            const result = accumulateErrors(errors);

            // Verify order matches
            for (let i = 1; i < errors.length; i++) {
              expect(result.cleanupErrors[i - 1]).toBe(errors[i]);
            }
          }
        )
      );
    });

    it('Property: error messages are preserved', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string(), { minLength: 1, maxLength: 10 }),
          (errorMessages) => {
            const errors = errorMessages.map((m) => new Error(m));
            const result = accumulateErrors(errors);

            expect(result.primary.message).toBe(errorMessages[0]);

            for (let i = 1; i < errorMessages.length; i++) {
              expect(result.cleanupErrors[i - 1].message).toBe(errorMessages[i]);
            }
          }
        )
      );
    });

    it('Property: empty array returns null primary with empty cleanupErrors', () => {
      const result = accumulateErrors([]);
      expect(result.primary).toBeNull();
      expect(result.cleanupErrors).toHaveLength(0);
    });

    it('Property: accumulation never throws', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string(), { minLength: 0, maxLength: 20 }),
          (errorMessages) => {
            const errors = errorMessages.map((m) => new Error(m));
            expect(() => accumulateErrors(errors)).not.toThrow();
          }
        )
      );
    });
  });

  describe('safeAugmentError() Property Tests', () => {
    it('Property: error augmentation never throws', () => {
      fc.assert(
        fc.property(fc.anything(), (value) => {
          expect(() =>
            safeAugmentError(new Error('test'), 'prop', value)
          ).not.toThrow();
        })
      );
    });

    it('Property: always returns a boolean', () => {
      fc.assert(
        fc.property(fc.anything(), (value) => {
          const result = safeAugmentError(new Error('test'), 'prop', value);
          expect(typeof result).toBe('boolean');
        })
      );
    });

    it('Property: when true, property is actually set', () => {
      fc.assert(
        fc.property(fc.string(), fc.anything(), (propName, value) => {
          // Skip reserved property names that might conflict
          fc.pre(!['message', 'stack', 'name', 'cause'].includes(propName));

          const error = new Error('test');
          const result = safeAugmentError(error, propName, value);

          // If result is false, skip this property iteration
          fc.pre(result === true);

          // Now we know result is true, so property must be set
          expect(error[propName]).toBe(value);
        })
      );
    });

    it('Property: frozen objects return false', () => {
      fc.assert(
        fc.property(fc.string(), fc.anything(), (propName, value) => {
          const error = Object.freeze(new Error('frozen'));
          const result = safeAugmentError(error, propName, value);
          expect(result).toBe(false);
        })
      );
    });

    it('Property: sealed objects return false for new properties', () => {
      fc.assert(
        fc.property(fc.anything(), (value) => {
          const error = Object.seal(new Error('sealed'));
          // 'newProp' doesn't exist on the sealed object
          const result = safeAugmentError(error, 'newProp', value);
          expect(result).toBe(false);
        })
      );
    });

    it('Property: non-writable properties return false', () => {
      fc.assert(
        fc.property(fc.anything(), (value) => {
          const error = new Error('test');
          Object.defineProperty(error, 'readonly', {
            value: 'original',
            writable: false,
            configurable: false,
          });
          const result = safeAugmentError(error, 'readonly', value);
          expect(result).toBe(false);
        })
      );
    });

    it('Property: augmentation never modifies Error message', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.string(),
          fc.anything(),
          (message, propName, value) => {
            // Skip 'message' property itself
            fc.pre(propName !== 'message');

            const error = new Error(message);
            safeAugmentError(error, propName, value);
            expect(error.message).toBe(message);
          }
        )
      );
    });
  });
});
