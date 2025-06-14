import { describe, test, expect, jest } from '@jest/globals';
import { assertValidActor } from '../../src/utils/actorValidation.js';
import { DISPLAY_ERROR_ID } from '../../src/constants/eventIds.js';

describe('assertValidActor', () => {
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
      assertValidActor(badActor, logger, 'TestCtx', dispatcher)
    ).toThrow('TestCtx: actor is required and must have a valid id.');
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      DISPLAY_ERROR_ID,
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
    expect(() => assertValidActor(null, logger, 'Ctx')).toThrow();
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
      assertValidActor(actor, logger, 'Ctx', dispatcher)
    ).not.toThrow();
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
