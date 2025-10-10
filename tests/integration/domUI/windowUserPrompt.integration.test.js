import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import WindowUserPrompt from '../../../src/domUI/windowUserPrompt.js';

/**
 * Integration coverage for WindowUserPrompt against real browser globals provided by jsdom.
 */
describe('WindowUserPrompt integration with browser environment', () => {
  /** @type {Window['confirm'] | undefined} */
  let originalConfirm;

  beforeEach(() => {
    originalConfirm = global.window?.confirm;
  });

  afterEach(() => {
    if (global.window) {
      if (typeof originalConfirm === 'function') {
        global.window.confirm = originalConfirm;
      } else {
        delete global.window.confirm;
      }
    }
  });

  it('delegates to window.confirm when the browser implementation exists', () => {
    const confirmSpy = jest.fn().mockReturnValue(true);
    global.window.confirm = confirmSpy;

    const prompt = new WindowUserPrompt();
    const result = prompt.confirm('Proceed with integration test?');

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledWith('Proceed with integration test?');
    expect(result).toBe(true);
  });
});
