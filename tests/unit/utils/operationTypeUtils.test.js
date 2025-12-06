import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { getNormalizedOperationType } from '../../../src/utils/operationTypeUtils.js';

describe('getNormalizedOperationType', () => {
  /** @type {{ error: jest.Mock }} */
  let mockLogger;
  const label = 'OperationRegistry';

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
    };
  });

  it('returns the trimmed operation type when provided a valid string', () => {
    const result = getNormalizedOperationType(
      '  resolve-target  ',
      mockLogger,
      label
    );

    expect(result).toBe('resolve-target');
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('logs an error and returns null when the value is not a string', () => {
    const result = getNormalizedOperationType(42, mockLogger, label);

    expect(result).toBeNull();
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      `${label}: operationType must be a non-empty string.`
    );
  });

  it('logs an error and returns null when the trimmed string is empty', () => {
    const result = getNormalizedOperationType('\t\n  ', mockLogger, label);

    expect(result).toBeNull();
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      `${label}: operationType must be a non-empty string.`
    );
  });

  it('returns the original string when it is already normalized', () => {
    const result = getNormalizedOperationType(
      'action-dispatch',
      mockLogger,
      label
    );

    expect(result).toBe('action-dispatch');
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});
