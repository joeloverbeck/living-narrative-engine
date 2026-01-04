/**
 * @file Unit tests for strict testEnv proxy behavior
 * @see tests/common/engine/systemLogicTestEnv.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createBaseRuleEnvironment } from '../../../common/engine/systemLogicTestEnv.js';
import {
  TestEnvPropertyError,
  COMMON_CONFUSIONS,
} from '../../../common/errors/testEnvPropertyError.js';

describe('strict testEnv proxy', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = createBaseRuleEnvironment({
      createHandlers: () => ({}),
    });
  });

  afterEach(() => {
    if (testEnv && typeof testEnv.cleanup === 'function') {
      testEnv.cleanup();
    }
  });

  describe('fail-fast property access', () => {
    it('should throw TestEnvPropertyError for undefined properties', () => {
      expect(() => testEnv.nonExistentProperty).toThrow(TestEnvPropertyError);
    });

    it('should suggest similar property names for close typos', () => {
      try {
        // eventbus is within Levenshtein distance 1 of eventBus
        // eslint-disable-next-line no-unused-vars
        const _ = testEnv.eventbus;
        // Should not reach here
        expect.fail('Expected TestEnvPropertyError to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(TestEnvPropertyError);
        expect(err.suggestions).toContain('eventBus');
      }
    });

    it('should allow Jest internal properties (toJSON, $$typeof)', () => {
      // These should not throw - they return undefined silently
      expect(() => testEnv.toJSON).not.toThrow();
      expect(() => testEnv.$$typeof).not.toThrow();
      expect(() => testEnv.asymmetricMatch).not.toThrow();
      expect(() => testEnv.nodeType).not.toThrow();
      expect(() => testEnv.then).not.toThrow();
      expect(() => testEnv.constructor).not.toThrow();
    });

    it('should return correct values for existing properties', () => {
      expect(testEnv.eventBus).toBeDefined();
      expect(testEnv.unifiedScopeResolver).toBeDefined();
      expect(testEnv.entityManager).toBeDefined();
      expect(testEnv.logger).toBeDefined();
      expect(testEnv.jsonLogic).toBeDefined();
      expect(testEnv.dataRegistry).toBeDefined();
    });

    it('should allow symbol property access', () => {
      const testSymbol = Symbol('testSymbol');
      // Accessing a symbol property should not throw
      expect(() => testEnv[testSymbol]).not.toThrow();
    });

    it('should include available properties in error', () => {
      try {
        // eslint-disable-next-line no-unused-vars
        const _ = testEnv.unknownProperty;
        expect.fail('Expected TestEnvPropertyError to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(TestEnvPropertyError);
        expect(err.availableProperties).toContain('eventBus');
        expect(err.availableProperties).toContain('unifiedScopeResolver');
        expect(err.availableProperties).toContain('entityManager');
      }
    });

    it('should include common confusion hints in error for known typos', () => {
      // Test each common confusion mapping
      for (const [typo, correct] of Object.entries(COMMON_CONFUSIONS)) {
        try {
          // eslint-disable-next-line no-unused-vars
          const _ = testEnv[typo];
          expect.fail(
            `Expected TestEnvPropertyError to be thrown for ${typo}`
          );
        } catch (err) {
          expect(err).toBeInstanceOf(TestEnvPropertyError);
          expect(err.hints.length).toBeGreaterThan(0);
          expect(err.hints[0]).toContain(typo);
          expect(err.hints[0]).toContain(correct);
        }
      }
    });

    it('should allow accessing methods that exist on testEnv', () => {
      expect(typeof testEnv.cleanup).toBe('function');
      expect(typeof testEnv.hasValidation).toBe('function');
    });

    it('should work with Object.keys()', () => {
      const keys = Object.keys(testEnv);
      expect(keys).toContain('eventBus');
      expect(keys).toContain('unifiedScopeResolver');
    });

    it('should work with "in" operator for existing properties', () => {
      expect('eventBus' in testEnv).toBe(true);
      expect('unifiedScopeResolver' in testEnv).toBe(true);
    });

    it('should allow underscore-prefixed properties for internal/dynamic use', () => {
      // Reading undefined underscore-prefixed property should not throw
      expect(() => testEnv._originalResolveSync).not.toThrow();
      expect(testEnv._originalResolveSync).toBeUndefined();

      // Should allow setting underscore-prefixed properties
      testEnv._customInternalProperty = 'test value';
      expect(testEnv._customInternalProperty).toBe('test value');
    });
  });

  describe('error message formatting', () => {
    it('should format error message with property name', () => {
      try {
        // eslint-disable-next-line no-unused-vars
        const _ = testEnv.badProperty;
        expect.fail('Expected TestEnvPropertyError to be thrown');
      } catch (err) {
        expect(err.message).toContain("Property 'badProperty' does not exist");
        expect(err.message).toContain('Available properties:');
      }
    });

    it('should include "Did you mean" suggestion for close matches', () => {
      try {
        // eslint-disable-next-line no-unused-vars
        const _ = testEnv.eventbus; // lowercase typo
        expect.fail('Expected TestEnvPropertyError to be thrown');
      } catch (err) {
        expect(err.message).toContain('Did you mean');
        expect(err.suggestions).toContain('eventBus');
      }
    });
  });
});
