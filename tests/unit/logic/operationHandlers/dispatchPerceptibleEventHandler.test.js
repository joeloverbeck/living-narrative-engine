/**
 * @jest-environment node
 */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import DispatchPerceptibleEventHandler from '../../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/eventIds.js';

const makeLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const makeDispatcher = () => ({ dispatch: jest.fn() });

describe('DispatchPerceptibleEventHandler', () => {
  let logger;
  let dispatcher;
  let logHandler;
  let handler;

  beforeEach(() => {
    logger = makeLogger();
    dispatcher = makeDispatcher();
    logHandler = { execute: jest.fn() };
    handler = new DispatchPerceptibleEventHandler({
      dispatcher,
      logger,
      addPerceptionLogEntryHandler: logHandler,
    });
    jest.clearAllMocks();
  });

  test('dispatches event with auto timestamp and logs when requested', () => {
    const params = {
      location_id: 'loc:1',
      description_text: 'A arrives.',
      perception_type: 'character_enter',
      actor_id: 'npc:a',
      log_entry: true,
    };

    const before = Date.now();
    handler.execute(params, {});
    const after = Date.now();

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    const [eventType, payload] = dispatcher.dispatch.mock.calls[0];
    expect(eventType).toBe('core:perceptible_event');
    expect(payload.locationId).toBe(params.location_id);
    expect(payload.descriptionText).toBe(params.description_text);
    expect(payload.perceptionType).toBe(params.perception_type);
    expect(payload.actorId).toBe(params.actor_id);
    expect(new Date(payload.timestamp).getTime()).toBeGreaterThanOrEqual(
      before
    );
    expect(new Date(payload.timestamp).getTime()).toBeLessThanOrEqual(after);

    expect(logHandler.execute).toHaveBeenCalledTimes(1);
    expect(logHandler.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        location_id: params.location_id,
        entry: expect.objectContaining({
          descriptionText: params.description_text,
          perceptionType: params.perception_type,
          actorId: params.actor_id,
        }),
        originating_actor_id: params.actor_id,
      })
    );
  });

  test('dispatches error when params missing', () => {
    handler.execute(null, {});
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('params missing'),
      })
    );
  });

  test('does not log when log_entry is false', () => {
    const params = {
      location_id: 'loc:2',
      description_text: 'B leaves.',
      perception_type: 'character_exit',
      actor_id: 'npc:b',
      log_entry: false,
    };

    handler.execute(params, {});

    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'core:perceptible_event',
      expect.objectContaining({ actorId: 'npc:b' })
    );
    expect(logHandler.execute).not.toHaveBeenCalled();
  });

  test('errors when location_id is missing', () => {
    handler.execute(
      {
        location_id: '',
        description_text: 'desc',
        perception_type: 'type',
        actor_id: 'actor',
      },
      {}
    );
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('location_id required'),
      })
    );
    expect(logHandler.execute).not.toHaveBeenCalled();
  });

  test('errors when description_text is missing', () => {
    handler.execute(
      {
        location_id: 'loc',
        description_text: '',
        perception_type: 'type',
        actor_id: 'actor',
      },
      {}
    );
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('description_text required'),
      })
    );
  });

  test('errors when perception_type is missing', () => {
    handler.execute(
      {
        location_id: 'loc',
        description_text: 'desc',
        perception_type: '',
        actor_id: 'actor',
      },
      {}
    );
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('perception_type required'),
      })
    );
  });

  test('errors when actor_id is missing', () => {
    handler.execute(
      {
        location_id: 'loc',
        description_text: 'desc',
        perception_type: 'type',
        actor_id: '',
      },
      {}
    );
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('actor_id required'),
      })
    );
  });

  test('constructor dependency checks', () => {
    expect(
      () =>
        new DispatchPerceptibleEventHandler({
          dispatcher: {},
          logger,
          addPerceptionLogEntryHandler: logHandler,
        })
    ).toThrow('ISafeEventDispatcher');

    expect(
      () =>
        new DispatchPerceptibleEventHandler({
          dispatcher,
          logger: {},
          addPerceptionLogEntryHandler: logHandler,
        })
    ).toThrow('ILogger');

    expect(
      () =>
        new DispatchPerceptibleEventHandler({
          dispatcher,
          logger,
          addPerceptionLogEntryHandler: {},
        })
    ).toThrow('AddPerceptionLogEntryHandler');
  });
});
