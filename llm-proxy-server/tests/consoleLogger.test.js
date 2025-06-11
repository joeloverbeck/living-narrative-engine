import { ConsoleLogger } from '../src/consoleLogger.js';

describe('ConsoleLogger', () => {
  let originalInfo;
  let originalWarn;
  let originalError;
  let originalDebug;

  beforeEach(() => {
    originalInfo = console.info;
    originalWarn = console.warn;
    originalError = console.error;
    originalDebug = console.debug;
    console.info = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
    console.debug = jest.fn();
  });

  afterEach(() => {
    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;
    console.debug = originalDebug;
  });

  test('info logs via console.info', () => {
    const logger = new ConsoleLogger();
    logger.info('hello', { a: 1 });
    expect(console.info).toHaveBeenCalledWith('hello', { a: 1 });
  });

  test('warn logs via console.warn', () => {
    const logger = new ConsoleLogger();
    logger.warn('be careful', 123);
    expect(console.warn).toHaveBeenCalledWith('be careful', 123);
  });

  test('error logs via console.error', () => {
    const logger = new ConsoleLogger();
    const err = new Error('boom');
    logger.error('failure', err);
    expect(console.error).toHaveBeenCalledWith('failure', err);
  });

  test('debug logs via console.debug', () => {
    const logger = new ConsoleLogger();
    logger.debug('details', 'extra');
    expect(console.debug).toHaveBeenCalledWith('details', 'extra');
  });
});
