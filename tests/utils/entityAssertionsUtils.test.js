import { describe, test, expect, jest } from '@jest/globals';
import { assertValidEntity } from '../../src/utils/entityAssertionsUtils.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../src/constants/eventIds.js';

describe('assertValidEntity', () => {
  test('dispatches error and throws when actor invalid', () => {
    const dispatcher = { dispatch: jest.fn() };
    const logger = {
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    const badActor = { id: '' };
    expect(() =>
      assertValidEntity(badActor, logger, 'TestCtx', dispatcher)
    ).toThrow('TestCtx: entity is required and must have a valid id.');
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.any(String),
        details: expect.objectContaining({ contextName: 'TestCtx' }),
      })
    );
  });

  test('falls back to logger.warn when dispatcher missing', () => {
    const logger = {
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    expect(() => assertValidEntity(null, logger, 'Ctx')).toThrow();
    expect(logger.warn).toHaveBeenCalled();
  });

  test('does nothing when actor valid', () => {
    const dispatcher = { dispatch: jest.fn() };
    const logger = {
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    const actor = { id: 'a1' };
    expect(() =>
      assertValidEntity(actor, logger, 'Ctx', dispatcher)
    ).not.toThrow();
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
