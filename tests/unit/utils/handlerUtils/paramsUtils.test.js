import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

const MODULE_PATH = '../../../../src/utils/handlerUtils/paramsUtils.js';
const SAFE_DISPATCH_PATH = '../../../../src/utils/safeDispatchErrorUtils.js';

describe('handlerUtils/paramsUtils', () => {
  let safeDispatchErrorMock;

  const importModule = async () => {
    let moduleNamespace;
    await jest.isolateModulesAsync(async () => {
      jest.doMock(SAFE_DISPATCH_PATH, () => ({
        safeDispatchError: safeDispatchErrorMock,
      }));
      moduleNamespace = await import(MODULE_PATH);
    });
    return moduleNamespace;
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    safeDispatchErrorMock = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('assertParamsObject', () => {
    it('returns true for plain objects without logging', async () => {
      const { assertParamsObject } = await importModule();
      const logger = { warn: jest.fn() };

      const result = assertParamsObject({ key: 'value' }, logger, 'TestOp');

      expect(result).toBe(true);
      expect(logger.warn).not.toHaveBeenCalled();
      expect(safeDispatchErrorMock).not.toHaveBeenCalled();
    });

    it('logs a warning when params are invalid and logger has warn', async () => {
      const { assertParamsObject } = await importModule();
      const logger = { warn: jest.fn() };
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const result = assertParamsObject(null, logger, 'MissingParamsOp');

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        'MissingParamsOp: params missing or invalid.',
        {
          params: null,
        }
      );
      expect(safeDispatchErrorMock).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('dispatches an error when logger exposes dispatch but not warn', async () => {
      const { assertParamsObject } = await importModule();
      const dispatcher = { dispatch: jest.fn() };

      const result = assertParamsObject(undefined, dispatcher, 'DispatchOp');

      expect(result).toBe(false);
      expect(safeDispatchErrorMock).toHaveBeenCalledTimes(1);
      expect(safeDispatchErrorMock).toHaveBeenCalledWith(
        dispatcher,
        'DispatchOp: params missing or invalid.',
        { params: undefined },
        dispatcher
      );
    });

    it('falls back to console.warn when no logger is provided', async () => {
      const { assertParamsObject } = await importModule();
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const result = assertParamsObject(undefined, null, 'ConsoleOp');

      expect(result).toBe(false);
      expect(safeDispatchErrorMock).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        'ConsoleOp: params missing or invalid.',
        {
          params: undefined,
        }
      );

      warnSpy.mockRestore();
    });
  });

  describe('validateStringParam', () => {
    it('returns trimmed string when value is valid', async () => {
      const { validateStringParam } = await importModule();
      const logger = { warn: jest.fn() };
      const dispatcher = { dispatch: jest.fn() };

      const result = validateStringParam(
        '  Hello World  ',
        'greeting',
        logger,
        dispatcher
      );

      expect(result).toBe('Hello World');
      expect(safeDispatchErrorMock).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('dispatches error when invalid value and dispatcher available', async () => {
      const { validateStringParam } = await importModule();
      const logger = { warn: jest.fn() };
      const dispatcher = { dispatch: jest.fn() };

      const result = validateStringParam('   ', 'username', logger, dispatcher);

      expect(result).toBeNull();
      expect(safeDispatchErrorMock).toHaveBeenCalledTimes(1);
      expect(safeDispatchErrorMock).toHaveBeenCalledWith(
        dispatcher,
        'Invalid "username" parameter',
        { username: '   ' },
        logger
      );
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('logs warning when dispatcher missing and logger provided', async () => {
      const { validateStringParam } = await importModule();
      const logger = { warn: jest.fn() };

      const result = validateStringParam('', 'alias', logger, null);

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('Invalid "alias" parameter', {
        alias: '',
      });
      expect(safeDispatchErrorMock).not.toHaveBeenCalled();
    });

    it('silently returns null when no logger or dispatcher provided', async () => {
      const { validateStringParam } = await importModule();
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const result = validateStringParam(null, 'displayName', null, undefined);

      expect(result).toBeNull();
      expect(safeDispatchErrorMock).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });
});
