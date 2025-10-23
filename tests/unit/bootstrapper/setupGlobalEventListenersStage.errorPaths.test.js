import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('../../../src/utils/bootstrapperHelpers.js', () => ({
  attachBeforeUnload: jest.fn(),
  shouldStopEngine: jest.fn(),
  stageFailure: jest.fn(),
  stageSuccess: jest.fn(),
}));

import {
  attachBeforeUnload,
  shouldStopEngine,
  stageFailure,
  stageSuccess,
} from '../../../src/utils/bootstrapperHelpers.js';

const createLogger = () => ({
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('setupGlobalEventListenersStage error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a stage failure when attaching the beforeunload listener throws', async () => {
    const failure = new Error('listener registration failed');
    attachBeforeUnload.mockImplementation(() => {
      throw failure;
    });
    const failureResult = { success: false, reason: 'listener-error' };
    stageFailure.mockReturnValue(failureResult);
    stageSuccess.mockReturnValue({ success: true });

    const { setupGlobalEventListenersStage } = await import(
      '../../../src/bootstrapper/stages/eventStages.js'
    );

    const logger = createLogger();
    const result = await setupGlobalEventListenersStage(
      { stop: jest.fn() },
      logger,
      {}
    );

    expect(result).toBe(failureResult);
    expect(stageFailure).toHaveBeenCalledWith(
      'Global Event Listeners Setup',
      expect.stringContaining(
        "Unexpected error during Global Event Listeners Setup for 'beforeunload': listener registration failed",
      ),
      failure,
    );
    expect(logger.error).toHaveBeenCalledWith(
      "Bootstrap Stage: Global Event Listeners Setup encountered an unexpected error during 'beforeunload' listener setup.",
      failure,
    );
    expect(stageSuccess).not.toHaveBeenCalled();
  });

  it('logs and skips stopping when the engine should not be stopped', async () => {
    const successResult = { success: true, stage: 'complete' };
    stageSuccess.mockReturnValue(successResult);
    stageFailure.mockReturnValue({ success: false });
    shouldStopEngine.mockReturnValue(false);
    attachBeforeUnload.mockImplementation((_windowRef, handler) => {
      handler();
    });

    const { setupGlobalEventListenersStage } = await import(
      '../../../src/bootstrapper/stages/eventStages.js'
    );

    const logger = createLogger();
    const gameEngine = { stop: jest.fn() };
    const windowRef = { marker: true };

    const result = await setupGlobalEventListenersStage(
      gameEngine,
      logger,
      windowRef,
    );

    expect(attachBeforeUnload).toHaveBeenCalledWith(
      windowRef,
      expect.any(Function),
    );
    expect(shouldStopEngine).toHaveBeenCalledWith(gameEngine);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('No action taken to stop.'),
    );
    expect(gameEngine.stop).not.toHaveBeenCalled();
    expect(stageFailure).not.toHaveBeenCalled();
    expect(stageSuccess).toHaveBeenCalledTimes(1);
    expect(result).toBe(successResult);
  });
});
