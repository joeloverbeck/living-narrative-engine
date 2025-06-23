/* eslint-disable jsdoc/check-tag-names */
/**
 * @jest-environment node
 */
/* eslint-enable jsdoc/check-tag-names */
import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { DomainContextCompatibilityChecker } from '../../../src/validation/domainContextCompatibilityChecker.js'; // Adjust path as needed
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js'; // Adjust path as needed

// --- Mock ILogger ---
// Create a fully functional mock logger implementing the ILogger interface
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// --- Helper to create Mock ActionDefinition objects ---
/**
 * Creates a minimal action definition object for testing.
 *
 * @param {string} id - The action identifier.
 * @param {string | undefined | null} targetDomain - The domain to test.
 */
const createActionDef = (id, targetDomain) => ({
  id: id,
  commandVerb: id.split(':')[1] || 'test',
  target_domain: targetDomain,
  template: 'test template',
});

// --- Test Suite ---
describe('DomainContextCompatibilityChecker', () => {
  /** @type {DomainContextCompatibilityChecker} */
  let checker;

  // Reset mocks and create a fresh checker before each test
  beforeEach(() => {
    jest.clearAllMocks();
    checker = new DomainContextCompatibilityChecker({ logger: mockLogger });
    // Clear the initial debug log call from the constructor to simplify assertions in tests
    mockLogger.debug.mockClear();
  });

  // --- Constructor Tests ---
  describe('Constructor', () => {
    test('should initialize successfully with a valid logger', () => {
      // This is implicitly tested by the beforeEach block, but we can be explicit.
      expect(checker).toBeInstanceOf(DomainContextCompatibilityChecker);
    });

    test('should throw error if logger dependency is missing', () => {
      expect(() => new DomainContextCompatibilityChecker({})).toThrow(
        'DomainContextCompatibilityChecker requires a valid ILogger instance.'
      );
      expect(
        () => new DomainContextCompatibilityChecker({ logger: null })
      ).toThrow(
        'DomainContextCompatibilityChecker requires a valid ILogger instance.'
      );
    });

    test('should throw error if logger dependency is invalid (missing methods)', () => {
      const invalidLoggerPartial = { info: jest.fn() }; // Missing error, debug
      expect(
        () =>
          new DomainContextCompatibilityChecker({
            logger: invalidLoggerPartial,
          })
      ).toThrow(
        'DomainContextCompatibilityChecker requires a valid ILogger instance.'
      );
    });
  });

  // --- Check Method Tests ---
  describe('check method', () => {
    // Mock Contexts using static factories
    const noCtx = ActionTargetContext.noTarget();
    const entityCtx = ActionTargetContext.forEntity('target-dummy-id');

    // --- Valid Combinations ---
    describe('Valid Combinations', () => {
      test("should return true for 'none' domain and 'none' context", () => {
        const actionDef = createActionDef('test:wait', 'none');
        const result = checker.check(actionDef, noCtx);
        expect(result).toBe(true);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            "Domain/Context Check Passed: Action 'test:wait' (domain 'none') is compatible with context type 'none'."
          )
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test("should return true for any non-'none' domain and 'entity' context", () => {
        const actionDef = createActionDef('test:attack', 'monster');
        const result = checker.check(actionDef, entityCtx);
        expect(result).toBe(true);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            "Domain/Context Check Passed: Action 'test:attack' (domain 'monster') is compatible with context type 'entity'."
          )
        );
      });

      test("should return true for 'self' domain and 'entity' context", () => {
        const actionDef = createActionDef('test:inventory', 'self');
        const result = checker.check(actionDef, entityCtx);
        expect(result).toBe(true);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            "Domain/Context Check Passed: Action 'test:inventory' (domain 'self') is compatible with context type 'entity'."
          )
        );
      });

      test("should return true for undefined target_domain and 'none' context (defaults to 'none')", () => {
        const actionDef = createActionDef('test:default_none', undefined);
        const result = checker.check(actionDef, noCtx);
        expect(result).toBe(true);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            "Domain/Context Check Passed: Action 'test:default_none' (domain 'none') is compatible with context type 'none'."
          )
        );
      });

      test("should return true for null target_domain and 'none' context (defaults to 'none')", () => {
        const actionDef = createActionDef('test:default_null', null);
        const result = checker.check(actionDef, noCtx);
        expect(result).toBe(true);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            "Domain/Context Check Passed: Action 'test:default_null' (domain 'none') is compatible with context type 'none'."
          )
        );
      });
    });

    // --- Invalid Combinations ---
    describe('Invalid Combinations & Logging', () => {
      test("should return false for 'none' domain and 'entity' context", () => {
        const actionDef = createActionDef('test:wait_fail', 'none');
        const result = checker.check(actionDef, entityCtx);
        expect(result).toBe(false);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            "Validation failed (Domain/Context): Action 'test:wait_fail' (domain 'none') expects no target, but context type is 'entity'."
          )
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test("should return false for entity domain ('monster') and 'none' context", () => {
        const actionDef = createActionDef('test:attack_fail', 'monster');
        const result = checker.check(actionDef, noCtx);
        expect(result).toBe(false);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            "Validation failed (Domain/Context): Action 'test:attack_fail' (domain 'monster') requires an entity target, but context type is 'none'."
          )
        );
      });

      test("should return false for 'self' domain and 'none' context", () => {
        const actionDef = createActionDef('test:self_fail', 'self');
        const result = checker.check(actionDef, noCtx);
        expect(result).toBe(false);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            "Validation failed (Domain/Context): Action 'test:self_fail' (domain 'self') requires an entity target, but context type is 'none'."
          )
        );
      });

      test("should return false for undefined target_domain (default 'none') and 'entity' context", () => {
        const actionDef = createActionDef(
          'test:default_fail_entity',
          undefined
        );
        const result = checker.check(actionDef, entityCtx);
        expect(result).toBe(false);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            "Validation failed (Domain/Context): Action 'test:default_fail_entity' (domain 'none') expects no target, but context type is 'entity'."
          )
        );
      });
    });

    // --- Invalid Inputs to Check ---
    describe('Invalid Inputs to check method', () => {
      test('should return false and log error if actionDefinition is null', () => {
        const result = checker.check(null, entityCtx);
        expect(result).toBe(false);
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'DomainContextCompatibilityChecker.check: Called with invalid actionDefinition or targetContext.'
        );
      });

      test('should return false and log error if targetContext is undefined', () => {
        const actionDef = createActionDef('test:valid', 'none');
        const result = checker.check(actionDef, undefined);
        expect(result).toBe(false);
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'DomainContextCompatibilityChecker.check: Called with invalid actionDefinition or targetContext.'
        );
      });

      test('should use UNKNOWN_ACTION ID in logs if actionDefinition.id is missing', () => {
        const actionDefNoId = {
          commandVerb: 'test',
          target_domain: 'monster', // Requires entity context
          template: 'template',
        };
        const result = checker.check(actionDefNoId, noCtx); // Mismatched context
        expect(result).toBe(false);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            "Validation failed (Domain/Context): Action 'UNKNOWN_ACTION' (domain 'monster') requires an entity target, but context type is 'none'."
          )
        );
      });
    });
  });
});
