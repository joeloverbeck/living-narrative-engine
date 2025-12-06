import { describe, it, expect, afterEach, jest } from '@jest/globals';

import errorModule, {
  CharacterBuilderError,
  ClicheGenerationError,
  ClicheStorageError,
} from '../../../../src/characterBuilder/errors/characterBuilderError.js';

const ORIGINAL_CAPTURE_STACK_TRACE = Error.captureStackTrace;

afterEach(() => {
  if (ORIGINAL_CAPTURE_STACK_TRACE) {
    Error.captureStackTrace = ORIGINAL_CAPTURE_STACK_TRACE;
  } else {
    delete Error.captureStackTrace;
  }
  jest.useRealTimers();
});

describe('CharacterBuilderError', () => {
  it('records context, cause, timestamp and stack when captureStackTrace is available', () => {
    const captureSpy = jest.fn();
    Error.captureStackTrace = captureSpy;

    jest.useFakeTimers();
    const fixedDate = new Date('2024-05-06T07:08:09.123Z');
    jest.setSystemTime(fixedDate);

    const context = { stage: 'initialization', attempt: 2 };
    const cause = new Error('low level failure');

    const error = new CharacterBuilderError(
      'Something went wrong',
      context,
      cause
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('CharacterBuilderError');
    expect(error.context).toBe(context);
    expect(error.cause).toBe(cause);
    expect(error.timestamp).toBe(fixedDate.toISOString());
    expect(captureSpy).toHaveBeenCalledWith(error, CharacterBuilderError);

    const json = error.toJSON();
    expect(json).toEqual(
      expect.objectContaining({
        name: 'CharacterBuilderError',
        message: 'Something went wrong',
        context,
        cause: 'low level failure',
        timestamp: fixedDate.toISOString(),
      })
    );
    expect(typeof json.stack).toBe('string');
  });

  it('handles missing captureStackTrace and omits cause in JSON output', () => {
    Error.captureStackTrace = undefined;

    const error = new CharacterBuilderError('No capture available');

    expect(error.context).toEqual({});
    expect(error.cause).toBeNull();

    const json = error.toJSON();
    expect(json.cause).toBeNull();
    expect(json.context).toEqual({});
    expect(json.name).toBe('CharacterBuilderError');
  });
});

describe('Specialized CharacterBuilder errors', () => {
  it('ClicheGenerationError extends the base error and preserves context and cause', () => {
    const context = { directionId: 'dir-1', conceptId: 'concept-42' };
    const cause = new Error('generation failed');

    const error = new ClicheGenerationError(
      'Unable to generate',
      context,
      cause
    );

    expect(error).toBeInstanceOf(CharacterBuilderError);
    expect(error.name).toBe('ClicheGenerationError');
    expect(error.context).toEqual(context);
    expect(error.cause).toBe(cause);
    expect(error.toJSON().cause).toBe('generation failed');
  });

  it('ClicheGenerationError uses sensible defaults when optional arguments are omitted', () => {
    const error = new ClicheGenerationError('Defaults only');

    expect(error.context).toEqual({});
    expect(error.cause).toBeNull();
  });

  it('ClicheStorageError augments context with the failing operation', () => {
    const cause = new Error('disk full');
    const context = { storage: 'local' };

    const error = new ClicheStorageError(
      'Unable to persist',
      'save',
      context,
      cause
    );

    expect(error).toBeInstanceOf(CharacterBuilderError);
    expect(error.name).toBe('ClicheStorageError');
    expect(error.operation).toBe('save');
    expect(error.context).toEqual({ storage: 'local', operation: 'save' });
    expect(error.cause).toBe(cause);
  });

  it('ClicheStorageError populates defaults when context and cause are omitted', () => {
    const error = new ClicheStorageError('Defaults', 'delete');

    expect(error.context).toEqual({ operation: 'delete' });
    expect(error.operation).toBe('delete');
    expect(error.cause).toBeNull();
  });
});

describe('module exports', () => {
  it('exposes all error classes via the default export for backwards compatibility', () => {
    expect(errorModule).toEqual({
      CharacterBuilderError,
      ClicheGenerationError,
      ClicheStorageError,
    });
  });
});
