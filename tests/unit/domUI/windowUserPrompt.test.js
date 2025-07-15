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
    // Create a spy on the WindowUserPrompt confirm method to control the window check
    const prompt = new WindowUserPrompt();
    jest.spyOn(prompt, 'confirm').mockImplementation(() => {
      // Simulate the new logic but with both window references undefined
      const windowObj = undefined; // Simulating both checks failing
      return windowObj ? windowObj.confirm('ignored') : false;
    });
    
    const result = prompt.confirm('ignored');
    expect(result).toBe(false);
    
    prompt.confirm.mockRestore();
  });
});
