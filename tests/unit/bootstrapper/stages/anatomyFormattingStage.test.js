import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { initializeAnatomyFormattingStage } from '../../../../src/bootstrapper/stages/anatomyFormattingStage.js';
import StageError from '../../../../src/bootstrapper/StageError.js';

const tokens = { AnatomyFormattingService: 'AnatomyFormattingService' };

/**
 * Create a basic logger mock.
 *
 * @returns {{info: jest.Mock, debug: jest.Mock, error: jest.Mock}}
 *   Mock logger implementing the expected methods.
 */
function createLogger() {
  return { info: jest.fn(), debug: jest.fn(), error: jest.fn() };
}

describe('initializeAnatomyFormattingStage', () => {
  /** @type {ReturnType<typeof createLogger>} */
  let logger;
  let container;

  beforeEach(() => {
    logger = createLogger();
    container = { resolve: jest.fn() };
  });

  it('initializes service when resolved successfully', async () => {
    const service = { initialize: jest.fn().mockResolvedValue() };
    container.resolve.mockReturnValue(service);

    const result = await initializeAnatomyFormattingStage(
      container,
      logger,
      tokens
    );

    expect(container.resolve).toHaveBeenCalledWith(
      tokens.AnatomyFormattingService
    );
    expect(service.initialize).toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      payload: { anatomyFormattingService: service },
    });
    expect(logger.info).toHaveBeenCalledWith(
      'Bootstrap Stage: Anatomy Formatting Service Initialization completed successfully.'
    );
  });

  it('returns failure when service cannot be resolved', async () => {
    container.resolve.mockReturnValue(null);

    const result = await initializeAnatomyFormattingStage(
      container,
      logger,
      tokens
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(StageError);
    expect(result.error.phase).toBe(
      'Anatomy Formatting Service Initialization'
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Bootstrap Stage: Anatomy Formatting Service Initialization failed.'
      ),
      expect.any(Error)
    );
  });

  it('returns failure when initialization throws', async () => {
    const serviceError = new Error('boom');
    const service = { initialize: jest.fn().mockRejectedValue(serviceError) };
    container.resolve.mockReturnValue(service);

    const result = await initializeAnatomyFormattingStage(
      container,
      logger,
      tokens
    );

    expect(service.initialize).toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(StageError);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Bootstrap Stage: Anatomy Formatting Service Initialization failed.'
      ),
      serviceError
    );
  });
});
