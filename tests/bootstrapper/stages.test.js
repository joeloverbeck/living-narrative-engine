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
    expect(result.success).toBe(true);
    expect(result.payload).toBe(mockElements);
  });

  it('wraps errors with phase', async () => {
    const error = new Error('fail');
    const uiBoot = new UIBootstrapper();
    jest.spyOn(uiBoot, 'gatherEssentialElements').mockImplementation(() => {
      throw error;
    });
    const result = await ensureCriticalDOMElementsStage(document, uiBoot);
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toContain('fail');
    expect(result.error.phase).toBe('UI Element Validation');
  });
});
