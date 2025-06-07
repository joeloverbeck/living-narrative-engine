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
