import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { setupMenuButtonListenersStage } from '../../src/bootstrapper/stages.js';

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
      <button id="open-save-game-button"></button>
      <button id="open-load-game-button"></button>
    `);
    const logger = createLogger();
    const showSaveGameUI = jest.fn();
    const showLoadGameUI = jest.fn();
    const gameEngine = { showSaveGameUI, showLoadGameUI };

    await setupMenuButtonListenersStage(gameEngine, logger, document);

    document.getElementById('open-save-game-button').click();
    document.getElementById('open-load-game-button').click();

    expect(showSaveGameUI).toHaveBeenCalledTimes(1);
    expect(showLoadGameUI).toHaveBeenCalledTimes(1);
  });

  it('logs warnings when buttons or gameEngine are missing', async () => {
    setDom('');
    const logger = createLogger();

    await setupMenuButtonListenersStage(null, logger, document);

    // four warnings: two for missing buttons, two for missing gameEngine
    expect(logger.warn).toHaveBeenCalledTimes(4);
  });

  it('wraps unexpected errors with phase', async () => {
    const logger = createLogger();
    const fakeDoc = {
      getElementById: jest.fn(() => {
        throw new Error('boom');
      }),
    };

    await expect(
      setupMenuButtonListenersStage({}, logger, fakeDoc)
    ).rejects.toMatchObject({ phase: 'Menu Button Listeners Setup' });
    expect(logger.error).toHaveBeenCalled();
  });
});
