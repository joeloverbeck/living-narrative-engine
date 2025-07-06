import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { ensureValidLogger } from '../../src/utils/loggerUtils.js';

describe('ensureValidLogger additional branch coverage', () => {
  let consoleSpies;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpies = {
      info: jest.spyOn(console, 'info').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
      debug: jest.spyOn(console, 'debug').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    Object.values(consoleSpies).forEach((spy) => spy.mockRestore());
  });

  test('handles empty prefix without prepending colon', () => {
    const fallback = ensureValidLogger(null, '');
    fallback.info('test');
    expect(consoleSpies.info).toHaveBeenCalledWith('', 'test');
  });
});
