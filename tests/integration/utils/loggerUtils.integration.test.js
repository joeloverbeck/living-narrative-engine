import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';
import {
  ensureValidLogger,
  createPrefixedLogger,
  getPrefixedLogger,
  setupPrefixedLogger,
  getModuleLogger,
  initLogger,
  logPreview,
  logStart,
  logEnd,
  logError,
} from '../../../src/utils/loggerUtils.js';

/**
 * Integration coverage for logger utilities using the real ConsoleLogger implementation.
 */
describe('loggerUtils integration coverage', () => {
  let infoSpy;
  let warnSpy;
  let errorSpy;
  let debugSpy;

  beforeEach(() => {
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('validates loggers and emits fallback warnings when necessary', () => {
    const realLogger = new ConsoleLogger(LogLevel.DEBUG);
    infoSpy.mockClear();
    warnSpy.mockClear();
    errorSpy.mockClear();
    debugSpy.mockClear();

    const validated = ensureValidLogger(realLogger, 'IgnoredPrefix');
    expect(validated).toBe(realLogger);

    const fallback = ensureValidLogger(null, 'Fallback');
    fallback.info('Booting sequence');
    expect(infoSpy).toHaveBeenCalledWith('Fallback: ', 'Booting sequence');

    infoSpy.mockClear();
    errorSpy.mockClear();
    const defaultFallback = ensureValidLogger(undefined);
    defaultFallback.error('Using defaults');
    expect(errorSpy).toHaveBeenCalledWith('FallbackLogger: ', 'Using defaults');

    errorSpy.mockClear();
    const fallbackNoPrefix = ensureValidLogger(null, '');
    fallbackNoPrefix.warn('Bare prefix');
    expect(warnSpy).toHaveBeenCalledWith('', 'Bare prefix');

    warnSpy.mockClear();
    const invalidLogger = { info() {}, warn() {}, error() {} };
    const warnedFallback = ensureValidLogger(invalidLogger, 'Invalid');
    warnedFallback.debug('Converted to fallback');
    expect(warnSpy).toHaveBeenCalledWith(
      'Invalid: ',
      'An invalid logger instance was provided. Falling back to console logging with prefix "Invalid".'
    );
    expect(debugSpy).toHaveBeenCalledWith('Invalid: ', 'Converted to fallback');
  });

  it('initLogger enforces logger contracts but supports optional fallbacks', () => {
    const baseLogger = new ConsoleLogger(LogLevel.DEBUG);
    infoSpy.mockClear();
    warnSpy.mockClear();
    errorSpy.mockClear();
    debugSpy.mockClear();

    expect(() => initLogger('CriticalService', null)).toThrow(
      new Error('Missing required dependency: logger.')
    );
    expect(errorSpy).toHaveBeenCalledWith(
      'Missing required dependency: logger.'
    );

    errorSpy.mockClear();
    expect(() =>
      initLogger('BrokenService', {
        info() {},
        warn() {},
        error() {},
      })
    ).toThrow(
      new Error("Invalid or missing method 'debug' on dependency 'logger'.")
    );
    expect(errorSpy).toHaveBeenCalledWith(
      "Invalid or missing method 'debug' on dependency 'logger'."
    );

    errorSpy.mockClear();
    const optionalLogger = initLogger('OptionalService', null, {
      optional: true,
    });
    optionalLogger.debug('Optional branch executed');
    expect(debugSpy).toHaveBeenCalledWith(
      'OptionalService: ',
      'Optional branch executed'
    );

    debugSpy.mockClear();
    const validatedLogger = initLogger('StableService', baseLogger);
    expect(validatedLogger).toBe(baseLogger);

    debugSpy.mockClear();
    infoSpy.mockClear();
    const optionalProvidedLogger = initLogger('OptionalProvided', baseLogger, {
      optional: true,
    });
    optionalProvidedLogger.info('Optional logger supplied');
    expect(infoSpy).toHaveBeenCalledWith('Optional logger supplied');
  });

  it('prefixed helpers compose with ConsoleLogger to tag output', () => {
    const baseLogger = new ConsoleLogger(LogLevel.DEBUG);
    infoSpy.mockClear();
    warnSpy.mockClear();
    errorSpy.mockClear();
    debugSpy.mockClear();

    const serviceLogger = setupPrefixedLogger(baseLogger, 'Service:: ');
    serviceLogger.info('Processing payload');
    expect(infoSpy).toHaveBeenCalledWith('Service:: Processing payload');

    infoSpy.mockClear();
    const moduleLogger = getModuleLogger('WorldBootstrap', baseLogger);
    moduleLogger.debug('Ready');
    expect(debugSpy).toHaveBeenCalledWith('[WorldBootstrap] Ready');

    debugSpy.mockClear();
    const directLogger = createPrefixedLogger(baseLogger, 'Direct: ');
    directLogger.warn('Heads up');
    expect(warnSpy).toHaveBeenCalledWith('Direct: Heads up');

    warnSpy.mockClear();
    const defaultSetupLogger = setupPrefixedLogger(baseLogger);
    defaultSetupLogger.debug('Default setup prefix');
    expect(debugSpy).toHaveBeenCalledWith('Default setup prefix');

    debugSpy.mockClear();
    const barePrefixLogger = createPrefixedLogger(baseLogger);
    barePrefixLogger.debug('No prefix message');
    expect(debugSpy).toHaveBeenCalledWith('No prefix message');

    debugSpy.mockClear();
    const emptyPrefixLogger = getPrefixedLogger(baseLogger, '');
    emptyPrefixLogger.info('Plain info');
    expect(infoSpy).toHaveBeenCalledWith('Plain info');

    infoSpy.mockClear();
    const fallbackPrefixed = getPrefixedLogger(null, 'MissingFlow: ');
    fallbackPrefixed.error('Issue detected', { code: 500 });
    expect(errorSpy).toHaveBeenCalledWith(
      'MissingFlow: : ',
      'MissingFlow: Issue detected',
      { code: 500 }
    );
  });

  it('logging helpers emit formatted output for real loggers', () => {
    const baseLogger = new ConsoleLogger(LogLevel.DEBUG);
    infoSpy.mockClear();
    warnSpy.mockClear();
    errorSpy.mockClear();
    debugSpy.mockClear();

    logPreview(baseLogger, 'Payload -> ', { deep: true });
    expect(debugSpy).toHaveBeenCalledWith('Payload -> {"deep":true}');

    debugSpy.mockClear();
    logPreview(baseLogger, 'Short -> ', '1234567890', 5);
    expect(debugSpy).toHaveBeenCalledWith('Short -> 12345...');

    debugSpy.mockClear();
    logStart(baseLogger, 'Initializing engine');
    expect(debugSpy).toHaveBeenCalledWith('▶️  Initializing engine');

    debugSpy.mockClear();
    logEnd(baseLogger, 'Finalizing engine');
    expect(debugSpy).toHaveBeenCalledWith('✅ Finalizing engine');

    logError(baseLogger, 'Failure to bootstrap', new Error('boom'));
    expect(errorSpy).toHaveBeenCalledWith(
      '❌ Failure to bootstrap: boom',
      expect.any(Error)
    );
  });
});
