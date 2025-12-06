import { describe, it, expect } from '@jest/globals';
import SpeechPatternsGenerationError, {
  SpeechPatternsResponseProcessingError,
  SpeechPatternsValidationError,
} from '../../../../src/characterBuilder/errors/SpeechPatternsGenerationError.js';

describe('SpeechPatternsGenerationError hierarchy', () => {
  it('creates a generation error with name and cause', () => {
    const underlying = new Error('reason');
    const err = new SpeechPatternsGenerationError('failed', underlying);

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('SpeechPatternsGenerationError');
    expect(err.message).toBe('failed');
    expect(err.cause).toBe(underlying);
  });

  it('creates a response processing error with name and cause', () => {
    const cause = new Error('bad payload');
    const err = new SpeechPatternsResponseProcessingError(
      'cannot parse',
      cause
    );

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('SpeechPatternsResponseProcessingError');
    expect(err.message).toBe('cannot parse');
    expect(err.cause).toBe(cause);
  });

  describe('SpeechPatternsValidationError', () => {
    it('defaults validationErrors to empty array and stores cause', () => {
      const cause = new Error('AJV failure');
      const err = new SpeechPatternsValidationError(
        'invalid data',
        undefined,
        cause
      );

      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('SpeechPatternsValidationError');
      expect(err.message).toBe('invalid data');
      expect(err.validationErrors).toEqual([]);
      expect(err.cause).toBe(cause);
    });

    it('uses provided validation errors', () => {
      const validationErrors = [
        { keyword: 'type', instancePath: '/tone', message: 'should be string' },
        {
          keyword: 'minLength',
          instancePath: '/pattern',
          message: 'too short',
        },
      ];
      const err = new SpeechPatternsValidationError(
        'bad schema',
        validationErrors
      );

      expect(err.validationErrors).toBe(validationErrors);
      expect(err.cause).toBeUndefined();
    });
  });
});
