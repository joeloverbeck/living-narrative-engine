import { describe, it, expect, beforeEach } from '@jest/globals';
import { ModCorruptionError } from '../../../src/errors/modCorruptionError.js';
import { ModValidationError } from '../../../src/errors/modValidationError.js';

describe('ModCorruptionError', () => {
  /** @type {ModCorruptionError} */
  let error;

  beforeEach(() => {
    error = new ModCorruptionError('Malformed JSON payload', 'mods/test.json', {
      detail: 'unexpected token',
      partialData: { preserved: true },
    });
  });

  it('enhances error context with corruption metadata and file path', () => {
    expect(error).toBeInstanceOf(ModCorruptionError);
    expect(error).toBeInstanceOf(ModValidationError);
    expect(error.name).toBe('ModCorruptionError');
    expect(error.filePath).toBe('mods/test.json');

    const context = error.context;
    expect(context).toMatchObject({
      detail: 'unexpected token',
      filePath: 'mods/test.json',
      corruptionType: 'MALFORMED_JSON',
      canPartiallyRecover: true,
    });
  });

  it.each([
    {
      message: 'Invalid UTF encoding character',
      context: {},
      expectedType: 'ENCODING_ERROR',
      recoverable: false,
    },
    {
      message: 'File truncated before EOF',
      context: { parseError: 'trailing comma encountered' },
      expectedType: 'TRUNCATED_FILE',
      recoverable: true,
    },
    {
      message: 'Parser reported issue',
      context: { parseError: 'missing closing brace' },
      expectedType: 'PARSE_ERROR',
      recoverable: false,
    },
    {
      message: 'Unknown corruption signature',
      context: {},
      expectedType: 'UNKNOWN_CORRUPTION',
      recoverable: false,
    },
  ])(
    'detects $expectedType corruption type',
    ({ message, context, expectedType, recoverable }) => {
      const corruptionError = new ModCorruptionError(
        message,
        'mods/sample.json',
        context
      );
      expect(corruptionError.context.corruptionType).toBe(expectedType);
      expect(corruptionError.context.canPartiallyRecover).toBe(recoverable);
    }
  );

  it('provides targeted suggested actions in the corruption report', () => {
    const cases = [
      {
        message: 'Unexpected token in JSON',
        expected: [
          'Validate JSON syntax',
          'Check for trailing commas',
          'Verify proper quote usage',
        ],
      },
      {
        message: 'Encoding failure detected',
        expected: [
          'Check file encoding (should be UTF-8)',
          'Remove special characters',
        ],
      },
      {
        message: 'File truncated unexpectedly',
        expected: [
          'Verify file was fully written',
          'Check disk space',
          'Re-download or restore from backup',
        ],
      },
      {
        message: 'Unidentified corruption mode',
        expected: ['Restore file from backup', 'Re-create file from template'],
      },
    ];

    for (const { message, expected } of cases) {
      const corruptionError = new ModCorruptionError(
        message,
        'mods/sample.json',
        {}
      );
      const report = corruptionError.generateCorruptionReport();
      expect(report).toMatchObject({
        filePath: 'mods/sample.json',
        message,
        corruptionType: corruptionError.context.corruptionType,
      });
      expect(report.timestamp).toBeTruthy();
      expect(report.suggestedActions).toEqual(expected);
    }
  });

  it('appends partial recovery suggestion when recovery is possible', () => {
    const corruptionError = new ModCorruptionError(
      'Malformed JSON',
      'mods/test.json',
      {
        partialData: { kept: true },
      }
    );

    const report = corruptionError.generateCorruptionReport();
    expect(report.suggestedActions).toContain('Attempt partial data recovery');
  });

  it('falls back to base context when enhanced context is unavailable', () => {
    const originalContext = { hint: 'base' };
    const corruptionError = new ModCorruptionError(
      'Malformed JSON',
      'mods/test.json',
      originalContext
    );

    // Simulate scenario where enhanced context is missing
    corruptionError._enhancedContext = undefined;

    expect(corruptionError.context).toBe(originalContext);
  });

  it('reports severity and recoverability for corruption errors', () => {
    expect(error.getSeverity()).toBe('critical');
    expect(error.isRecoverable()).toBe(false);
  });
});
