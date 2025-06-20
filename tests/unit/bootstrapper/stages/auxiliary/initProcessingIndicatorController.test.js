import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { initProcessingIndicatorController } from '../../../../../src/bootstrapper/stages/auxiliary/initProcessingIndicatorController.js';
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

const tokens = {
  ProcessingIndicatorController: 'ProcessingIndicatorController',
};

describe('initProcessingIndicatorController', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns success when controller resolves', () => {
    const logger = createLogger();
    const container = { resolve: jest.fn(() => ({ stub: true })) };
    const result = initProcessingIndicatorController({
      container,
      logger,
      tokens,
    });
    expect(container.resolve).toHaveBeenCalledWith(
      tokens.ProcessingIndicatorController
    );
    expect(stageSuccess).toHaveBeenCalledWith();
    expect(result.success).toBe(true);
    expect(logger.debug).toHaveBeenCalledWith(
      'ProcessingIndicatorController Init: Resolving ProcessingIndicatorController...'
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'ProcessingIndicatorController Init: Resolved successfully.'
    );
  });

  it('returns failure when controller is missing', () => {
    const logger = createLogger();
    const container = { resolve: jest.fn(() => null) };
    const result = initProcessingIndicatorController({
      container,
      logger,
      tokens,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(StageError);
    expect(stageFailure).toHaveBeenCalledWith(
      'ProcessingIndicatorController Init',
      'ProcessingIndicatorController could not be resolved.'
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'ProcessingIndicatorController Init: ProcessingIndicatorController could not be resolved.'
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
    const result = initProcessingIndicatorController({
      container,
      logger,
      tokens,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(StageError);
    expect(stageFailure).toHaveBeenCalledWith(
      'ProcessingIndicatorController Init',
      error.message,
      error
    );
    expect(logger.error).toHaveBeenCalledWith(
      'ProcessingIndicatorController Init: Error during resolution.',
      error
    );
  });
});
