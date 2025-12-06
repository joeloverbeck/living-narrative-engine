import { describe, expect, it } from '@jest/globals';

import BaseError from '../../../src/errors/baseError.js';
import ModValidationError from '../../../src/errors/modValidationError.js';

describe('ModValidationError', () => {
  it('preserves explicit metadata and formatting helpers', () => {
    const context = { module: 'weather-pack', stage: 'schema-validation' };
    const error = new ModValidationError(
      'manifest.json is missing required fields',
      'FILE_CORRUPTION',
      context,
      false
    );

    expect(error).toBeInstanceOf(ModValidationError);
    expect(error).toBeInstanceOf(BaseError);
    expect(error.name).toBe('ModValidationError');
    expect(error.code).toBe('FILE_CORRUPTION');
    expect(error.getSeverity()).toBe('warning');
    expect(error.isRecoverable()).toBe(false);
    expect(error.recoverable).toBe(false);
    expect(error.context).toEqual(context);

    const json = error.toJSON();
    expect(json).toMatchObject({
      name: 'ModValidationError',
      message: 'manifest.json is missing required fields',
      code: 'FILE_CORRUPTION',
      context,
      recoverable: false,
    });
    expect(json.timestamp).toBe(error.timestamp);
    expect(json.stack).toBe(error.stack);

    expect(error.toString()).toBe(
      'ModValidationError [FILE_CORRUPTION]: manifest.json is missing required fields (non-recoverable)'
    );
  });

  it('falls back to default classification and recoverable state when omitted', () => {
    const error = new ModValidationError(
      'cross-reference validation failed unexpectedly'
    );

    expect(error.code).toBe('MOD_VALIDATION_ERROR');
    expect(error.isRecoverable()).toBe(true);
    expect(error.recoverable).toBe(true);

    error._recoverable = undefined;
    expect(error.recoverable).toBe(true);
    expect(error.context).toEqual({
      originalCode: undefined,
      originalRecoverable: true,
    });

    const json = error.toJSON();
    expect(json.code).toBe('MOD_VALIDATION_ERROR');
    expect(json.recoverable).toBe(true);
    expect(json.context).toEqual({
      originalCode: undefined,
      originalRecoverable: true,
    });

    expect(error.toString()).toBe(
      'ModValidationError [MOD_VALIDATION_ERROR]: cross-reference validation failed unexpectedly (recoverable)'
    );
  });

  it('falls back to generating a timestamp when the base timestamp is unavailable', () => {
    const error = new ModValidationError('intermittent failure', 'TEMP', {
      attempt: 1,
    });

    Object.defineProperty(error, 'timestamp', {
      value: undefined,
      configurable: true,
    });

    const json = error.toJSON();
    expect(json.timestamp).toEqual(expect.any(String));
    expect(new Date(json.timestamp).toString()).not.toBe('Invalid Date');
  });
});
