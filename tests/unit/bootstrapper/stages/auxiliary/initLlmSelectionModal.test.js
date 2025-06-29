import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { initLlmSelectionModal } from '../../../../../src/bootstrapper/stages/auxiliary/initLlmSelectionModal.js';
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
 * Create a basic logger mock.
 *
 * @returns {{debug: jest.Mock, warn: jest.Mock, error: jest.Mock}} Logger mock
 */
function createLogger() {
  return { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

const tokens = { LlmSelectionModal: 'LlmSelectionModal' };

describe('initLlmSelectionModal', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns success when modal resolves', () => {
    const logger = createLogger();
    const container = { resolve: jest.fn(() => ({ stub: true })) };
    const result = initLlmSelectionModal({ container, logger, tokens });
    expect(container.resolve).toHaveBeenCalledWith(tokens.LlmSelectionModal);
    expect(stageSuccess).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(logger.debug).toHaveBeenCalledWith(
      'LlmSelectionModal Init: Resolving LlmSelectionModal...'
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'LlmSelectionModal Init: Resolved successfully.'
    );
  });

  it('returns failure when modal is missing', () => {
    const logger = createLogger();
    const container = { resolve: jest.fn(() => null) };
    const result = initLlmSelectionModal({ container, logger, tokens });
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(StageError);
    expect(stageFailure).toHaveBeenCalledWith(
      'LlmSelectionModal Init',
      'LlmSelectionModal could not be resolved.'
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'LlmSelectionModal Init: LlmSelectionModal could not be resolved.'
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
    const result = initLlmSelectionModal({ container, logger, tokens });
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(StageError);
    expect(stageFailure).toHaveBeenCalledWith(
      'LlmSelectionModal Init',
      error.message,
      error
    );
    expect(logger.error).toHaveBeenCalledWith(
      'LlmSelectionModal Init: Error during resolution.',
      error
    );
  });
});
