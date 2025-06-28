import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import WindowUserPrompt, {
  WindowUserPrompt as NamedExport,
} from '../../../src/domUI/windowUserPrompt.js';

describe('WindowUserPrompt', () => {
  let originalWindow;

  beforeEach(() => {
    originalWindow = global.window;
  });

  afterEach(() => {
    global.window = originalWindow;
    jest.restoreAllMocks();
  });

  it('exports the class as default and named', () => {
    expect(NamedExport).toBe(WindowUserPrompt);
  });

  it('calls window.confirm when window is available', () => {
    const confirmMock = jest.fn(() => true);
    global.window.confirm = confirmMock;
    const prompt = new WindowUserPrompt();
    const result = prompt.confirm('proceed?');
    expect(confirmMock).toHaveBeenCalledWith('proceed?');
    expect(result).toBe(true);
  });

  it('returns false when window is undefined', () => {
    // Simulate non-browser environment by redefining global window
    Object.defineProperty(global, 'window', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    const prompt = new WindowUserPrompt();
    const result = prompt.confirm('ignored');
    expect(result).toBe(false);
  });
});
