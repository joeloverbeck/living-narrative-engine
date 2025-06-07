import {
  ensureCriticalDOMElementsStage,
  setupGlobalEventListenersStage,
  startGameStage,
} from '../../src/bootstrapper/stages.js';
import { UIBootstrapper } from '../../src/bootstrapper/UIBootstrapper.js';
import { describe, it, expect, jest, afterEach } from '@jest/globals';

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ensureCriticalDOMElementsStage', () => {
  it('returns elements from UIBootstrapper', async () => {
    const mockElements = { root: document.body };
    jest
      .spyOn(UIBootstrapper.prototype, 'gatherEssentialElements')
      .mockReturnValue(mockElements);
    const result = await ensureCriticalDOMElementsStage(document);
    expect(result).toBe(mockElements);
  });

  it('wraps errors with phase', async () => {
    const error = new Error('fail');
    jest
      .spyOn(UIBootstrapper.prototype, 'gatherEssentialElements')
      .mockImplementation(() => {
        throw error;
      });
    await expect(
      ensureCriticalDOMElementsStage(document)
    ).rejects.toMatchObject({ phase: 'UI Element Validation' });
  });
});

describe('setupGlobalEventListenersStage', () => {
  it('attaches beforeunload listener and stops running game', async () => {
    let listener;
    const windowRef = {
      addEventListener: jest.fn((evt, cb) => {
        listener = cb;
      }),
    };
    const stop = jest.fn().mockResolvedValue();
    const gameEngine = {
      getEngineStatus: () => ({ isLoopRunning: true }),
      stop,
    };
    const logger = createLogger();

    await setupGlobalEventListenersStage(gameEngine, logger, windowRef);
    expect(windowRef.addEventListener).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function)
    );
    await listener();
    expect(stop).toHaveBeenCalled();
  });

  it('throws when windowRef missing', async () => {
    const logger = createLogger();
    await expect(
      setupGlobalEventListenersStage({}, logger, null)
    ).rejects.toMatchObject({ phase: 'Global Event Listeners Setup' });
  });
});

describe('startGameStage', () => {
  it('calls startNewGame with world name', async () => {
    const startNewGame = jest.fn().mockResolvedValue();
    const logger = createLogger();
    await startGameStage({ startNewGame }, 'Earth', logger);
    expect(startNewGame).toHaveBeenCalledWith('Earth');
  });

  it('throws when gameEngine missing', async () => {
    const logger = createLogger();
    await expect(startGameStage(null, 'Earth', logger)).rejects.toMatchObject({
      phase: 'Start Game',
    });
  });
});
