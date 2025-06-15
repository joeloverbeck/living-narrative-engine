import { ensureCriticalDOMElementsStage } from '../../src/bootstrapper/stages.js';
import { UIBootstrapper } from '../../src/bootstrapper/UIBootstrapper.js';
import { describe, it, expect, jest, afterEach } from '@jest/globals';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ensureCriticalDOMElementsStage', () => {
  it('returns elements from UIBootstrapper', async () => {
    const mockElements = { root: document.body };
    const uiBoot = new UIBootstrapper();
    jest.spyOn(uiBoot, 'gatherEssentialElements').mockReturnValue(mockElements);
    const result = await ensureCriticalDOMElementsStage(document, uiBoot);
    expect(result).toBe(mockElements);
  });

  it('wraps errors with phase', async () => {
    const error = new Error('fail');
    const uiBoot = new UIBootstrapper();
    jest.spyOn(uiBoot, 'gatherEssentialElements').mockImplementation(() => {
      throw error;
    });
    await expect(
      ensureCriticalDOMElementsStage(document, uiBoot)
    ).rejects.toMatchObject({ phase: 'UI Element Validation' });
  });
});
