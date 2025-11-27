/**
 * @jest-environment node
 */
import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import EndTurnHandler, {
  EndTurnOperationError,
} from '../../../../src/logic/operationHandlers/endTurnHandler.js';
import { TURN_ENDED_ID } from '../../../../src/constants/eventIds.js';

const makeLogger = () => ({
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
});

const makeSafeDispatcher = () => ({ dispatch: jest.fn() });

describe('EndTurnHandler', () => {
  let logger;
  let dispatcher;
  let handler;

  beforeEach(() => {
    logger = makeLogger();
    dispatcher = makeSafeDispatcher();
    handler = new EndTurnHandler({ safeEventDispatcher: dispatcher, logger });
  });

  describe('constructor validation', () => {
    test('throws with missing safeEventDispatcher', () => {
      expect(() => new EndTurnHandler({ logger })).toThrow();
    });

    test('throws with missing logger', () => {
      expect(
        () => new EndTurnHandler({ safeEventDispatcher: dispatcher })
      ).toThrow();
    });
  });

  describe('successful execution', () => {
    test('dispatches core:turn_ended with provided payload', async () => {
      const params = { entityId: 'e1', success: true };
      await handler.execute(params, {});
      expect(dispatcher.dispatch).toHaveBeenCalledWith(TURN_ENDED_ID, params);
    });

    test('includes optional error field when provided', async () => {
      const params = { entityId: 'e2', success: false, error: { msg: 'oops' } };
      await handler.execute(params, {});
      expect(dispatcher.dispatch).toHaveBeenCalledWith(TURN_ENDED_ID, params);
    });

    test('trims whitespace from entityId', async () => {
      const params = { entityId: '  e3  ', success: true };
      await handler.execute(params, {});
      expect(dispatcher.dispatch).toHaveBeenCalledWith(TURN_ENDED_ID, {
        entityId: 'e3',
        success: true,
      });
    });
  });

  describe('fail-fast behavior - null/undefined params', () => {
    test('throws EndTurnOperationError when params is null', async () => {
      await expect(handler.execute(null, {})).rejects.toThrow(
        EndTurnOperationError
      );
      await expect(handler.execute(null, {})).rejects.toThrow(
        'params must be a non-null object'
      );
    });

    test('throws EndTurnOperationError when params is undefined', async () => {
      await expect(handler.execute(undefined, {})).rejects.toThrow(
        EndTurnOperationError
      );
    });

    test('includes diagnostic details for null params', async () => {
      const error = await handler.execute(null, {}).catch((e) => e);
      expect(error).toBeInstanceOf(EndTurnOperationError);
      expect(error.details.receivedParams).toBeNull();
      expect(error.details.paramsType).toBe('object');
    });

    test('logs error before throwing for null params', async () => {
      await expect(handler.execute(null, {})).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('params must be a non-null object'),
        expect.any(Object)
      );
    });
  });

  describe('fail-fast behavior - invalid entityId', () => {
    test('throws EndTurnOperationError when entityId is missing', async () => {
      await expect(handler.execute({ success: true }, {})).rejects.toThrow(
        EndTurnOperationError
      );
      await expect(handler.execute({ success: true }, {})).rejects.toThrow(
        'Invalid or missing "entityId"'
      );
    });

    test('throws EndTurnOperationError when entityId is empty string', async () => {
      await expect(
        handler.execute({ entityId: '', success: true }, {})
      ).rejects.toThrow(EndTurnOperationError);
    });

    test('throws EndTurnOperationError when entityId is whitespace only', async () => {
      await expect(
        handler.execute({ entityId: '   ', success: true }, {})
      ).rejects.toThrow(EndTurnOperationError);
    });

    test('throws EndTurnOperationError when entityId is not a string', async () => {
      await expect(
        handler.execute({ entityId: 123, success: true }, {})
      ).rejects.toThrow(EndTurnOperationError);
    });

    test('includes diagnostic details for invalid entityId', async () => {
      const mockContext = {
        evaluationContext: {
          event: {
            type: 'core:attempt_action',
            payload: { actorId: 'actor-123', actionId: 'test-action' },
          },
        },
      };

      const err = await handler
        .execute({ entityId: 123, success: true }, mockContext)
        .catch((e) => e);

      expect(err).toBeInstanceOf(EndTurnOperationError);
      expect(err.details.receivedEntityId).toBe(123);
      expect(err.details.entityIdType).toBe('number');
      expect(err.details.allParams).toEqual({ entityId: 123, success: true });
      expect(err.details.hasExecutionContext).toBe(true);
      expect(err.details.hasEvent).toBe(true);
      expect(err.details.eventPayload).toEqual({
        actorId: 'actor-123',
        actionId: 'test-action',
      });
    });

    test('includes helpful message about placeholder resolution', async () => {
      await expect(
        handler.execute({ entityId: undefined, success: true }, {})
      ).rejects.toThrow('placeholder resolution failed');
    });

    test('logs error before throwing for invalid entityId', async () => {
      await expect(
        handler.execute({ entityId: '', success: true }, {})
      ).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid or missing "entityId"'),
        expect.any(Object)
      );
    });

    test('does not dispatch turn_ended when entityId is invalid', async () => {
      await expect(
        handler.execute({ entityId: '', success: true }, {})
      ).rejects.toThrow();
      expect(dispatcher.dispatch).not.toHaveBeenCalledWith(
        TURN_ENDED_ID,
        expect.anything()
      );
    });
  });

  describe('EndTurnOperationError class', () => {
    test('has correct name property', () => {
      const error = new EndTurnOperationError('test message');
      expect(error.name).toBe('EndTurnOperationError');
    });

    test('stores details object', () => {
      const details = { foo: 'bar', baz: 123 };
      const error = new EndTurnOperationError('test message', details);
      expect(error.details).toEqual(details);
    });

    test('defaults details to empty object', () => {
      const error = new EndTurnOperationError('test message');
      expect(error.details).toEqual({});
    });

    test('extends Error', () => {
      const error = new EndTurnOperationError('test message');
      expect(error).toBeInstanceOf(Error);
    });
  });
});
