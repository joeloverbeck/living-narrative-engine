import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { initCurrentTurnActorRenderer } from '../../../../../src/bootstrapper/stages/auxiliary/initCurrentTurnActorRenderer.js';
import StageError from '../../../../../src/bootstrapper/StageError.js';
import {
  stageSuccess,
  stageFailure,
} from '../../../../../src/bootstrapper/helpers.js';

jest.mock('../../../../../src/bootstrapper/helpers.js', () => ({
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
 * Create a basic logger mock.
 *
 * @returns {{debug: jest.Mock, warn: jest.Mock, error: jest.Mock}} Logger mock
 */
function createLogger() {
  return { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

const tokens = { CurrentTurnActorRenderer: 'CurrentTurnActorRenderer' };

describe('initCurrentTurnActorRenderer', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns success when renderer resolves', () => {
    const logger = createLogger();
    const container = { resolve: jest.fn(() => ({ stub: true })) };
    const result = initCurrentTurnActorRenderer({ container, logger, tokens });
    expect(container.resolve).toHaveBeenCalledWith(
      tokens.CurrentTurnActorRenderer
    );
    expect(stageSuccess).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(logger.debug).toHaveBeenCalledWith(
      'CurrentTurnActorRenderer Init: Resolving CurrentTurnActorRenderer...'
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'CurrentTurnActorRenderer Init: Resolved successfully.'
    );
  });

  it('returns failure when renderer is missing', () => {
    const logger = createLogger();
    const container = { resolve: jest.fn(() => null) };
    const result = initCurrentTurnActorRenderer({ container, logger, tokens });
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(StageError);
    expect(stageFailure).toHaveBeenCalledWith(
      'CurrentTurnActorRenderer Init',
      'CurrentTurnActorRenderer could not be resolved.'
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'CurrentTurnActorRenderer Init: CurrentTurnActorRenderer could not be resolved.'
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
    const result = initCurrentTurnActorRenderer({ container, logger, tokens });
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(StageError);
    expect(stageFailure).toHaveBeenCalledWith(
      'CurrentTurnActorRenderer Init',
      error.message,
      error
    );
    expect(logger.error).toHaveBeenCalledWith(
      'CurrentTurnActorRenderer Init: Error during resolution.',
      error
    );
  });
});
