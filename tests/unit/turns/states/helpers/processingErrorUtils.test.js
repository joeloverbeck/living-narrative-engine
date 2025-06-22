import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import {
  resetProcessingFlags,
  resolveLogger,
  dispatchSystemError,
  finishProcessing,
} from '../../../../../src/turns/states/helpers/processingErrorUtils.js';
import { ProcessingGuard } from '../../../../../src/turns/states/helpers/processingGuard.js';
import { safeDispatchError } from '../../../../../src/utils/safeDispatchErrorUtils.js';

jest.mock('../../../../../src/utils/safeDispatchErrorUtils.js');

describe('processingErrorUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('resetProcessingFlags uses guard when present', () => {
    const owner = { _isProcessing: true };
    owner._processingGuard = new ProcessingGuard(owner);
    const spy = jest.spyOn(owner._processingGuard, 'finish');
    const was = resetProcessingFlags(owner);
    expect(was).toBe(true);
    expect(spy).toHaveBeenCalled();
    expect(owner._isProcessing).toBe(false);
  });

  test('resetProcessingFlags toggles flag directly when guard missing', () => {
    const owner = { _isProcessing: true };
    const was = resetProcessingFlags(owner);
    expect(was).toBe(true);
    expect(owner._isProcessing).toBe(false);
  });

  test('finishProcessing uses guard when present', () => {
    const owner = { _isProcessing: true };
    owner._processingGuard = new ProcessingGuard(owner);
    const spy = jest.spyOn(owner._processingGuard, 'finish');
    finishProcessing(owner);
    expect(spy).toHaveBeenCalled();
    expect(owner._isProcessing).toBe(false);
  });

  test('finishProcessing toggles flag directly when guard missing', () => {
    const owner = { _isProcessing: true };
    finishProcessing(owner);
    expect(owner._isProcessing).toBe(false);
  });

  test('ProcessingGuard.start and finishProcessing sequence toggles flag', () => {
    const owner = { _isProcessing: false };
    owner._processingGuard = new ProcessingGuard(owner);
    owner._processingGuard.start();
    expect(owner._isProcessing).toBe(true);
    finishProcessing(owner);
    expect(owner._isProcessing).toBe(false);
  });

  test('resolveLogger uses context logger when available', () => {
    const logger = { debug: jest.fn() };
    const turnCtx = { getLogger: () => logger, getActor: () => ({ id: 'a1' }) };
    const result = resolveLogger(
      { getStateName: () => 'State' },
      turnCtx,
      'fallback'
    );
    expect(result.logger).toBe(logger);
    expect(result.actorId).toBe('a1');
  });

  test('resolveLogger falls back to console and logs error', () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const result = resolveLogger(
      { getStateName: () => 'State' },
      null,
      'fallback'
    );
    expect(result.logger).toBe(console);
    expect(result.actorId).toBe('fallback');
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('dispatchSystemError dispatches via safeDispatchError', () => {
    const dispatcher = { dispatch: jest.fn() };
    const logger = { error: jest.fn(), warn: jest.fn() };
    dispatchSystemError(
      dispatcher,
      logger,
      'State',
      'actorX',
      new Error('boom')
    );
    expect(safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      expect.stringContaining('System error in State'),
      expect.any(Object),
      logger
    );
  });

  test('dispatchSystemError logs warn when dispatcher missing', () => {
    const logger = { warn: jest.fn(), error: jest.fn() };
    dispatchSystemError(null, logger, 'State', 'actorX', new Error('boom'));
    expect(logger.warn).toHaveBeenCalled();
  });
});
