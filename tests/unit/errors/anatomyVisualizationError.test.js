import { describe, expect, it } from '@jest/globals';
import { AnatomyVisualizationError } from '../../../src/errors/anatomyVisualizationError.js';
import BaseError from '../../../src/errors/baseError.js';

/**
 * Helper to assert that two arrays contain the same members in the same order.
 * Using toStrictEqual directly makes intent clearer in coverage assertions.
 *
 * @param actual
 * @param expected
 */
const expectArrayEqual = (actual, expected) => {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((value, index) => {
    expect(actual[index]).toBe(value);
  });
};

describe('AnatomyVisualizationError', () => {
  it('applies defaults and exposes structured details', () => {
    const error = new AnatomyVisualizationError('Renderer failure');

    expect(error).toBeInstanceOf(AnatomyVisualizationError);
    expect(error).toBeInstanceOf(BaseError);
    expect(error.code).toBe('ANATOMY_VISUALIZATION_ERROR');
    expect(error.severity).toBe('MEDIUM');
    expect(error.getSeverity()).toBe('warning');
    expect(error.recoverable).toBe(true);
    expect(error.isRecoverable()).toBe(true);

    expect(error.userMessage).toBe(
      'A problem occurred with the anatomy visualization. You can try again.'
    );
    expectArrayEqual(error.suggestions, [
      'Try the operation again',
      'Wait a moment and try again',
    ]);

    const details = error.getErrorDetails();
    expect(details).toMatchObject({
      name: 'AnatomyVisualizationError',
      message: 'Renderer failure',
      code: 'ANATOMY_VISUALIZATION_ERROR',
      severity: 'MEDIUM',
      recoverable: true,
      userMessage: error.userMessage,
      suggestions: error.suggestions,
      metadata: {},
    });
    expect(details.cause).toBeNull();

    const userInfo = error.getUserInfo();
    expect(userInfo).toMatchObject({
      message: error.userMessage,
      severity: 'MEDIUM',
      recoverable: true,
      suggestions: error.suggestions,
    });
    expect(typeof userInfo.timestamp).toBe('string');

    expect(error.isAtLeastSeverity('LOW')).toBe(true);
    expect(error.isAtLeastSeverity('CRITICAL')).toBe(false);

    expect(error.toJSON()).toEqual(details);
  });

  it('supports custom metadata, severity mapping, and causes', () => {
    const cause = new TypeError('Underlying failure');
    const error = new AnatomyVisualizationError('Critical breakdown', {
      code: 'AVX-500',
      severity: 'CRITICAL',
      recoverable: false,
      context: { component: 'torso' },
      metadata: { attempt: 2 },
      userMessage: 'Please reload the anatomy blueprint.',
      suggestions: ['Inspect anatomy blueprint data'],
      cause,
    });

    expect(error.code).toBe('AVX-500');
    expect(error.severity).toBe('CRITICAL');
    expect(error.getSeverity()).toBe('critical');
    expect(error.recoverable).toBe(false);
    expect(error.userMessage).toBe('Please reload the anatomy blueprint.');
    expectArrayEqual(error.suggestions, ['Inspect anatomy blueprint data']);

    const details = error.getErrorDetails();
    expect(details).toMatchObject({
      code: 'AVX-500',
      severity: 'CRITICAL',
      recoverable: false,
      userMessage: 'Please reload the anatomy blueprint.',
      metadata: { attempt: 2 },
    });
    expect(details.cause).toEqual({
      name: cause.name,
      message: cause.message,
      stack: cause.stack,
    });

    const userInfo = error.getUserInfo();
    expect(userInfo).toEqual({
      message: 'Please reload the anatomy blueprint.',
      severity: 'CRITICAL',
      recoverable: false,
      suggestions: ['Inspect anatomy blueprint data'],
      timestamp: expect.any(String),
    });
  });

  it.each([
    [
      'CRITICAL',
      true,
      'A critical error occurred in the anatomy visualizer. Please refresh the page.',
      [
        'Try the operation again',
        'Refresh the page',
        'Contact support if the problem persists',
      ],
    ],
    [
      'HIGH',
      false,
      'An error occurred while processing anatomy data. Some features may not work correctly.',
      ['Check your network connection', 'Try selecting a different entity'],
    ],
    [
      'MEDIUM',
      true,
      'A problem occurred with the anatomy visualization. You can try again.',
      ['Try the operation again', 'Wait a moment and try again'],
    ],
    [
      'LOW',
      true,
      'A minor issue occurred with the anatomy visualizer.',
      ['Try the operation again', 'Wait a moment and try again'],
    ],
    [
      'UNKNOWN',
      true,
      'An error occurred in the anatomy visualizer.',
      ['Try the operation again'],
    ],
  ])(
    'provides defaults for %s severity',
    (severity, recoverable, expectedMessage, expectedSuggestions) => {
      const error = new AnatomyVisualizationError('Issue encountered', {
        severity,
        recoverable,
      });

      expect(error.severity).toBe(severity);
      expect(error.userMessage).toBe(expectedMessage);
      expectArrayEqual(error.suggestions, expectedSuggestions);
      expect(error.getSeverity()).toBe(
        severity === 'CRITICAL'
          ? 'critical'
          : severity === 'HIGH'
            ? 'error'
            : severity === 'LOW'
              ? 'info'
              : 'warning'
      );
    }
  );

  it('evaluates severity thresholds even for unknown levels', () => {
    const error = new AnatomyVisualizationError('Unmapped severity', {
      severity: 'OTHER',
    });

    expect(error.severity).toBe('OTHER');
    expect(error.isAtLeastSeverity('LOW')).toBe(true);
    expect(error.isAtLeastSeverity('MEDIUM')).toBe(true);
    expect(error.isAtLeastSeverity('HIGH')).toBe(false);
    expect(error.isAtLeastSeverity('CRITICAL')).toBe(false);
  });

  it('gracefully handles environments without captureStackTrace', () => {
    const originalCaptureStackTrace = Error.captureStackTrace;

    try {
      Error.captureStackTrace = undefined;
      const error = new AnatomyVisualizationError('Missing capture', {
        severity: 'LOW',
      });

      expect(typeof error.stack === 'string' || error.stack instanceof String).toBe(
        true
      );
    } finally {
      Error.captureStackTrace = originalCaptureStackTrace;
    }
  });
});
