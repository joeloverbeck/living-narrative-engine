import { describe, it, expect } from '@jest/globals';
import BaseError from '../../../src/errors/baseError.js';
import { MissingHandlerError } from '../../../src/errors/missingHandlerError.js';

describe('MissingHandlerError', () => {
  describe('instantiation', () => {
    it('can be instantiated with just operation type', () => {
      const error = new MissingHandlerError('SET_VARIABLE');

      expect(error).toBeInstanceOf(MissingHandlerError);
      expect(error.operationType).toBe('SET_VARIABLE');
      expect(error.ruleId).toBeNull();
    });

    it('can be instantiated with operation type and rule ID', () => {
      const error = new MissingHandlerError('SET_VARIABLE', 'core:my_rule');

      expect(error.operationType).toBe('SET_VARIABLE');
      expect(error.ruleId).toBe('core:my_rule');
    });
  });

  describe('error message formatting', () => {
    it('includes operation type when no rule ID provided', () => {
      const error = new MissingHandlerError('CUSTOM_OP');

      expect(error.message).toBe(
        "Cannot execute operation 'CUSTOM_OP': handler not found"
      );
    });

    it('includes both operation type and rule ID when provided', () => {
      const error = new MissingHandlerError('CUSTOM_OP', 'mod:rule_123');

      expect(error.message).toBe(
        "Cannot execute operation 'CUSTOM_OP' in rule 'mod:rule_123': handler not found"
      );
    });
  });

  describe('instance properties', () => {
    it('operationType property is accessible', () => {
      const error = new MissingHandlerError('MY_OPERATION');

      expect(error.operationType).toBe('MY_OPERATION');
    });

    it('ruleId property is accessible and null when not provided', () => {
      const error = new MissingHandlerError('MY_OPERATION');

      expect(error.ruleId).toBeNull();
    });

    it('ruleId property is accessible when provided', () => {
      const error = new MissingHandlerError('MY_OPERATION', 'test:rule');

      expect(error.ruleId).toBe('test:rule');
    });
  });

  describe('severity and recoverability', () => {
    it('getSeverity() returns error', () => {
      const error = new MissingHandlerError('OP');

      expect(error.getSeverity()).toBe('error');
    });

    it('severity getter returns error', () => {
      const error = new MissingHandlerError('OP');

      expect(error.severity).toBe('error');
    });

    it('isRecoverable() returns false', () => {
      const error = new MissingHandlerError('OP');

      expect(error.isRecoverable()).toBe(false);
    });

    it('recoverable getter returns false', () => {
      const error = new MissingHandlerError('OP');

      expect(error.recoverable).toBe(false);
    });
  });

  describe('inheritance', () => {
    it('is instance of BaseError', () => {
      const error = new MissingHandlerError('OP');

      expect(error).toBeInstanceOf(BaseError);
    });

    it('is instance of Error', () => {
      const error = new MissingHandlerError('OP');

      expect(error).toBeInstanceOf(Error);
    });

    it('has correct name property', () => {
      const error = new MissingHandlerError('OP');

      expect(error.name).toBe('MissingHandlerError');
    });
  });

  describe('context and serialization', () => {
    it('exposes context through getContext()', () => {
      const error = new MissingHandlerError('SET_VAR', 'core:rule');

      expect(error.getContext()).toEqual({
        operationType: 'SET_VAR',
        ruleId: 'core:rule',
      });
    });

    it('exposes context with null ruleId when not provided', () => {
      const error = new MissingHandlerError('SET_VAR');

      expect(error.getContext()).toEqual({
        operationType: 'SET_VAR',
        ruleId: null,
      });
    });

    it('serializes correctly via toJSON()', () => {
      const error = new MissingHandlerError('OP_TYPE', 'rule:id');
      const json = error.toJSON();

      expect(json).toMatchObject({
        name: 'MissingHandlerError',
        message: "Cannot execute operation 'OP_TYPE' in rule 'rule:id': handler not found",
        code: 'MISSING_HANDLER',
        context: {
          operationType: 'OP_TYPE',
          ruleId: 'rule:id',
        },
        severity: 'error',
        recoverable: false,
      });
      expect(json.timestamp).toEqual(expect.any(String));
      expect(json.correlationId).toEqual(expect.any(String));
      expect(json.stack).toEqual(expect.any(String));
    });

    it('has correct error code', () => {
      const error = new MissingHandlerError('OP');

      expect(error.code).toBe('MISSING_HANDLER');
    });
  });

  describe('can be imported from index.js', () => {
    it('is exported from errors index', async () => {
      const { MissingHandlerError: ImportedError } = await import(
        '../../../src/errors/index.js'
      );

      expect(ImportedError).toBe(MissingHandlerError);

      const error = new ImportedError('TEST_OP');
      expect(error).toBeInstanceOf(MissingHandlerError);
    });
  });

  describe('can be caught and instanceof-checked', () => {
    it('can be caught in try-catch and identified', () => {
      let caughtError = null;

      try {
        throw new MissingHandlerError('UNKNOWN_OP', 'some:rule');
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(MissingHandlerError);
      expect(caughtError).toBeInstanceOf(BaseError);
      expect(caughtError).toBeInstanceOf(Error);
      expect(caughtError.operationType).toBe('UNKNOWN_OP');
      expect(caughtError.ruleId).toBe('some:rule');
    });
  });
});
