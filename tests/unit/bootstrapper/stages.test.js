import { ensureCriticalDOMElementsStage } from '../../../src/bootstrapper/stages';
import StageError from '../../../src/bootstrapper/StageError.js';
import { UIBootstrapper } from '../../../src/bootstrapper/UIBootstrapper.js';
import { describe, it, expect, jest, afterEach } from '@jest/globals';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ensureCriticalDOMElementsStage', () => {
  it('returns elements from UIBootstrapper', async () => {
    const mockElements = { root: document.body };
    const uiBoot = new UIBootstrapper();
    jest.spyOn(uiBoot, 'gatherEssentialElements').mockReturnValue(mockElements);
    const result = await ensureCriticalDOMElementsStage(document, {
      createUIBootstrapper: () => uiBoot,
    });
    expect(result.success).toBe(true);
    expect(result.payload).toBe(mockElements);
  });

  it('uses factory function when provided', async () => {
    const mockElements = { root: document.body };
    const inst = new UIBootstrapper();
    const gatherSpy = jest
      .spyOn(inst, 'gatherEssentialElements')
      .mockReturnValue(mockElements);
    const factory = jest.fn(() => inst);

    const result = await ensureCriticalDOMElementsStage(document, {
      createUIBootstrapper: factory,
    });

    expect(factory).toHaveBeenCalled();
    expect(gatherSpy).toHaveBeenCalledWith(document);
    expect(result.success).toBe(true);
    expect(result.payload).toBe(mockElements);
  });

  it('uses provided createUIBootstrapper to instantiate', async () => {
    const mockElements = { root: document.body };
    const gatherSpy = jest
      .spyOn(UIBootstrapper.prototype, 'gatherEssentialElements')
      .mockReturnValue(mockElements);

    const result = await ensureCriticalDOMElementsStage(document, {
      createUIBootstrapper: () => new UIBootstrapper(),
    });

    expect(gatherSpy).toHaveBeenCalledWith(document);
    expect(result.success).toBe(true);
    expect(result.payload).toBe(mockElements);
  });

  it('wraps errors with phase', async () => {
    const error = new Error('fail');
    const uiBoot = new UIBootstrapper();
    jest.spyOn(uiBoot, 'gatherEssentialElements').mockImplementation(() => {
      throw error;
    });
    const result = await ensureCriticalDOMElementsStage(document, {
      createUIBootstrapper: () => uiBoot,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(StageError);
    expect(result.error.message).toContain('fail');
    expect(result.error.phase).toBe('UI Element Validation');
  });
});
