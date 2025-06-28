import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { initSpeechBubbleRenderer } from '../../../../../src/bootstrapper/stages/auxiliary/initSpeechBubbleRenderer.js';
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

const tokens = { SpeechBubbleRenderer: 'SpeechBubbleRenderer' };

describe('initSpeechBubbleRenderer', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns success when renderer resolves', () => {
    const logger = createLogger();
    const container = { resolve: jest.fn(() => ({ stub: true })) };
    const result = initSpeechBubbleRenderer({ container, logger, tokens });
    expect(container.resolve).toHaveBeenCalledWith(tokens.SpeechBubbleRenderer);
    expect(stageSuccess).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(logger.debug).toHaveBeenCalledWith(
      'SpeechBubbleRenderer Init: Resolving SpeechBubbleRenderer...'
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'SpeechBubbleRenderer Init: Resolved successfully.'
    );
  });

  it('returns failure when renderer is missing', () => {
    const logger = createLogger();
    const container = { resolve: jest.fn(() => null) };
    const result = initSpeechBubbleRenderer({ container, logger, tokens });
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(StageError);
    expect(stageFailure).toHaveBeenCalledWith(
      'SpeechBubbleRenderer Init',
      'SpeechBubbleRenderer could not be resolved.'
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'SpeechBubbleRenderer Init: SpeechBubbleRenderer could not be resolved.'
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
    const result = initSpeechBubbleRenderer({ container, logger, tokens });
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(StageError);
    expect(stageFailure).toHaveBeenCalledWith(
      'SpeechBubbleRenderer Init',
      error.message,
      error
    );
    expect(logger.error).toHaveBeenCalledWith(
      'SpeechBubbleRenderer Init: Error during resolution.',
      error
    );
  });
});
