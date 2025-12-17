import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { setupMenuButtonListenersStage } from '../../../src/bootstrapper/stages';
import StageError from '../../../src/bootstrapper/StageError.js';

/**
 *
 */
function createLogger() {
  return {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 *
 * @param html
 */
function setDom(html) {
  document.body.innerHTML = html;
}

afterEach(() => {
  document.body.innerHTML = '';
  jest.restoreAllMocks();
});

describe('setupMenuButtonListenersStage', () => {
  it('attaches listeners when buttons and engine are available', async () => {
    setDom(`
      <button id="llm-prompt-debug-button"></button>
    `);
    const logger = createLogger();
    const previewLlmPromptForCurrentActor = jest.fn().mockResolvedValue(null);
    const gameEngine = { previewLlmPromptForCurrentActor };

    const result = await setupMenuButtonListenersStage(
      gameEngine,
      logger,
      document
    );

    document.getElementById('llm-prompt-debug-button').click();

    expect(previewLlmPromptForCurrentActor).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
  });

  it('logs warnings when buttons or gameEngine are missing', async () => {
    setDom('');
    const logger = createLogger();

    const result = await setupMenuButtonListenersStage(null, logger, document);

    // two warnings: missing button + missing game engine handler
    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
  });

  it('wraps unexpected errors with phase', async () => {
    const logger = createLogger();
    const fakeDoc = {
      getElementById: jest.fn(() => {
        throw new Error('boom');
      }),
    };

    const result = await setupMenuButtonListenersStage({}, logger, fakeDoc);
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(StageError);
    expect(result.error.phase).toBe('Menu Button Listeners Setup');
    expect(logger.error).toHaveBeenCalled();
  });
});
