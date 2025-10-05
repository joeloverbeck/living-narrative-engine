import { describe, expect, it } from '@jest/globals';
import { InvalidActionDefinitionError as ReExportedError } from '../../../../src/actions/builders/builderExceptions.js';
import { InvalidActionDefinitionError as BaseError } from '../../../../src/errors/invalidActionDefinitionError.js';

describe('builderExceptions re-exports', () => {
  it('exposes InvalidActionDefinitionError from the centralized error module', () => {
    const error = new ReExportedError('boom');

    expect(error).toBeInstanceOf(BaseError);
    expect(error.message).toBe('boom');
    expect(ReExportedError).toBe(BaseError);
  });
});
