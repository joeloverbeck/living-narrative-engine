import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { initCriticalLogNotifier } from '../../../../../src/bootstrapper/stages/auxiliary/initCriticalLogNotifier.js';
import StageError from '../../../../../src/bootstrapper/StageError.js';
import {
  stageSuccess,
  stageFailure,
} from '../../../../../src/utils/bootstrapperHelpers.js';

jest.mock('../../../../../src/utils/bootstrapperHelpers.js', () => ({
  __esModule: true,
  stageSuccess: jest.fn(() => ({ success: true })),
  stageFailure: jest.fn((phase, message, cause) => ({
    success: false,
    error:
      new (require('../../../../../src/bootstrapper/StageError.js').default)(
        phase,
        message,
        cause
      ),
  })),
}));

/**
 *
 */
function createLogger() {
  return { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

const tokens = { ICriticalLogNotifier: 'ICriticalLogNotifier' };

describe('initCriticalLogNotifier', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns success when notifier resolves', () => {
    const logger = createLogger();
    const container = { resolve: jest.fn(() => ({ notify: jest.fn() })) };

    const result = initCriticalLogNotifier({ container, logger, tokens });

    expect(container.resolve).toHaveBeenCalledWith(tokens.ICriticalLogNotifier);
    expect(stageSuccess).toHaveBeenCalledTimes(1);
    expect(stageFailure).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(logger.debug).toHaveBeenCalledWith(
      'CriticalLogNotifier Init: Resolving CriticalLogNotifier...'
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'CriticalLogNotifier Init: Resolved successfully.'
    );
  });

  it('returns failure when notifier is missing', () => {
    const logger = createLogger();
    const container = { resolve: jest.fn(() => null) };

    const result = initCriticalLogNotifier({ container, logger, tokens });

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(StageError);
    expect(stageFailure).toHaveBeenCalledWith(
      'CriticalLogNotifier Init',
      'CriticalLogNotifier could not be resolved.'
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'CriticalLogNotifier Init: CriticalLogNotifier could not be resolved.'
    );
  });

  it('returns failure when container.resolve throws', () => {
    const logger = createLogger();
    const error = new Error('boom');
    const container = {
      resolve: jest.fn(() => {
        throw error;
      }),
    };

    const result = initCriticalLogNotifier({ container, logger, tokens });

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(StageError);
    expect(stageFailure).toHaveBeenCalledWith(
      'CriticalLogNotifier Init',
      error.message,
      error
    );
    expect(logger.error).toHaveBeenCalledWith(
      'CriticalLogNotifier Init: Error during resolution.',
      error
    );
  });
});
