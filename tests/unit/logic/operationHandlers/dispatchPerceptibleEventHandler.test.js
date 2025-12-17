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
      perception_type: 'movement.arrival',
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
      perception_type: 'movement.departure',
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

  test('includes contextualData.recipientIds as an empty array when omitted', () => {
    handler.execute(
      {
        location_id: 'loc:2',
        description_text: 'Observations occur.',
        perception_type: 'state.observable_change',
        actor_id: 'npc:b',
      },
      {}
    );

    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'core:perceptible_event',
      expect.objectContaining({
        contextualData: {
          recipientIds: [],
          excludedActorIds: [],
          skipRuleLogging: false,
        },
      })
    );
  });

  test('preserves provided contextualData.recipientIds', () => {
    handler.execute(
      {
        location_id: 'loc:3',
        description_text: 'Only observers should hear.',
        perception_type: 'communication.speech',
        actor_id: 'npc:c',
        contextual_data: { recipientIds: ['observer-1'] },
      },
      {}
    );

    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'core:perceptible_event',
      expect.objectContaining({
        contextualData: {
          recipientIds: ['observer-1'],
          excludedActorIds: [],
          skipRuleLogging: false,
        },
      })
    );
  });

  test('errors when location_id is missing', () => {
    handler.execute(
      {
        location_id: '',
        description_text: 'desc',
        perception_type: 'physical.target_action',
        actor_id: 'actor',
      },
      {}
    );
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('location_id is required'),
      })
    );
    expect(logHandler.execute).not.toHaveBeenCalled();
  });

  test('errors when description_text is missing', () => {
    handler.execute(
      {
        location_id: 'loc',
        description_text: '',
        perception_type: 'physical.target_action',
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
        perception_type: 'physical.target_action',
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

  describe('Actor Exclusion', () => {
    test('should accept excludedActorIds in contextual_data', () => {
      handler.execute(
        {
          location_id: 'loc:test',
          description_text: 'Brief observation.',
          perception_type: 'item.examine',
          actor_id: 'npc:a',
          contextual_data: { excludedActorIds: ['npc:a'] },
        },
        {}
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:perceptible_event',
        expect.objectContaining({
          contextualData: {
            recipientIds: [],
            excludedActorIds: ['npc:a'],
            skipRuleLogging: false,
          },
        })
      );
    });

    test('should normalize empty/missing excludedActorIds to empty array', () => {
      handler.execute(
        {
          location_id: 'loc:test',
          description_text: 'Test event.',
          perception_type: 'physical.target_action',
          actor_id: 'npc:b',
          contextual_data: {},
        },
        {}
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:perceptible_event',
        expect.objectContaining({
          contextualData: {
            recipientIds: [],
            excludedActorIds: [],
            skipRuleLogging: false,
          },
        })
      );
    });

    test('should dispatch error when both recipientIds and excludedActorIds provided', () => {
      handler.execute(
        {
          location_id: 'loc:test',
          description_text: 'Test event.',
          perception_type: 'physical.target_action',
          actor_id: 'npc:c',
          contextual_data: {
            recipientIds: ['npc:observer'],
            excludedActorIds: ['npc:c'],
          },
        },
        {}
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining(
            'recipientIds and excludedActorIds are mutually exclusive'
          ),
          details: expect.objectContaining({
            recipientIds: ['npc:observer'],
            excludedActorIds: ['npc:c'],
          }),
        })
      );

      // Should not dispatch the event
      expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    });

    test('should pass excludedActorIds to AddPerceptionLogEntryHandler when log_entry is true', () => {
      handler.execute(
        {
          location_id: 'loc:test',
          description_text: 'Brief observation.',
          perception_type: 'item.examine',
          actor_id: 'npc:a',
          contextual_data: { excludedActorIds: ['npc:a'] },
          log_entry: true,
        },
        {}
      );

      expect(logHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          location_id: 'loc:test',
          recipient_ids: [],
          excluded_actor_ids: ['npc:a'],
        })
      );
    });

    test('should prioritize recipientIds over excludedActorIds when both provided but error dispatched', () => {
      handler.execute(
        {
          location_id: 'loc:test',
          description_text: 'Test.',
          perception_type: 'physical.target_action',
          actor_id: 'npc:a',
          contextual_data: {
            recipientIds: ['npc:b'],
            excludedActorIds: ['npc:c'],
          },
          log_entry: true,
        },
        {}
      );

      // Error should be dispatched
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('mutually exclusive'),
        })
      );

      // LogHandler should not be called
      expect(logHandler.execute).not.toHaveBeenCalled();
    });
  });

  describe('Sense-aware filtering parameters', () => {
    test('should pass alternate_descriptions to log handler when log_entry is true', () => {
      const alternateDescriptions = {
        auditory: 'You hear footsteps approaching.',
        olfactory: 'A familiar scent reaches you.',
      };

      handler.execute(
        {
          location_id: 'loc:test',
          description_text: 'A figure approaches.',
          perception_type: 'movement.arrival',
          actor_id: 'npc:walker',
          log_entry: true,
          alternate_descriptions: alternateDescriptions,
        },
        {}
      );

      expect(logHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          alternate_descriptions: alternateDescriptions,
        })
      );
    });

    test('should pass sense_aware to log handler when log_entry is true', () => {
      handler.execute(
        {
          location_id: 'loc:test',
          description_text: 'A figure appears.',
          perception_type: 'state.observable_change',
          actor_id: 'npc:observer',
          log_entry: true,
          sense_aware: false,
        },
        {}
      );

      expect(logHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          sense_aware: false,
        })
      );
    });

    test('should default sense_aware to true when not provided', () => {
      handler.execute(
        {
          location_id: 'loc:test',
          description_text: 'Something happens.',
          perception_type: 'state.observable_change',
          actor_id: 'npc:actor',
          log_entry: true,
        },
        {}
      );

      expect(logHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          sense_aware: true,
        })
      );
    });

    test('should pass undefined alternate_descriptions when not provided', () => {
      handler.execute(
        {
          location_id: 'loc:test',
          description_text: 'Plain event.',
          perception_type: 'physical.target_action',
          actor_id: 'npc:actor',
          log_entry: true,
        },
        {}
      );

      expect(logHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          alternate_descriptions: undefined,
        })
      );
    });

    test('should pass both alternate_descriptions and sense_aware together', () => {
      const alternateDescriptions = {
        auditory: 'A loud crash echoes.',
        tactile: 'The floor shakes briefly.',
      };

      handler.execute(
        {
          location_id: 'loc:test',
          description_text: 'The wall collapses.',
          perception_type: 'physical.target_action',
          actor_id: 'npc:destructor',
          log_entry: true,
          alternate_descriptions: alternateDescriptions,
          sense_aware: true,
        },
        {}
      );

      expect(logHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          alternate_descriptions: alternateDescriptions,
          sense_aware: true,
        })
      );
    });

    test('should not pass sense-aware params to log handler when log_entry is false', () => {
      handler.execute(
        {
          location_id: 'loc:test',
          description_text: 'Event without logging.',
          perception_type: 'movement.arrival',
          actor_id: 'npc:actor',
          log_entry: false,
          alternate_descriptions: { auditory: 'Sound' },
          sense_aware: true,
        },
        {}
      );

      // Event should still be dispatched
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:perceptible_event',
        expect.any(Object)
      );

      // But log handler should not be called
      expect(logHandler.execute).not.toHaveBeenCalled();
    });

    test('should pass sense-aware params along with other log entry params', () => {
      const alternateDescriptions = {
        auditory: 'You hear a whisper.',
        proprioceptive: 'You sense your own words.',
      };

      handler.execute(
        {
          location_id: 'loc:room',
          description_text: 'You whisper something.',
          perception_type: 'communication.speech',
          actor_id: 'npc:whisperer',
          target_id: 'npc:listener',
          involved_entities: ['item:scroll'],
          contextual_data: { recipientIds: ['npc:listener'] },
          log_entry: true,
          alternate_descriptions: alternateDescriptions,
          sense_aware: true,
        },
        {}
      );

      expect(logHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          location_id: 'loc:room',
          entry: expect.objectContaining({
            descriptionText: 'You whisper something.',
            perceptionType: 'communication.speech',
            actorId: 'npc:whisperer',
            targetId: 'npc:listener',
            involvedEntities: ['item:scroll'],
          }),
          originating_actor_id: 'npc:whisperer',
          recipient_ids: ['npc:listener'],
          excluded_actor_ids: [],
          alternate_descriptions: alternateDescriptions,
          sense_aware: true,
          // New parameters are also passed through
          actor_description: undefined,
          target_description: undefined,
          target_id: 'npc:listener',
        })
      );
    });

    test('should pass explicitly false sense_aware to log handler', () => {
      handler.execute(
        {
          location_id: 'loc:test',
          description_text: 'Omniscient event.',
          perception_type: 'error.system_error',
          actor_id: 'system',
          log_entry: true,
          sense_aware: false,
        },
        {}
      );

      expect(logHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          sense_aware: false,
        })
      );
    });
  });

  describe('Actor/target description pass-through', () => {
    test('should pass actor_description to log handler when provided', async () => {
      await handler.execute(
        {
          location_id: 'loc:test',
          description_text: 'Alice waves.',
          perception_type: 'physical.self_action',
          actor_id: 'actor1',
          actor_description: 'I wave enthusiastically.',
          log_entry: true,
        },
        {}
      );

      expect(logHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_description: 'I wave enthusiastically.',
        })
      );
    });

    test('should pass target_description and target_id to log handler when provided', async () => {
      await handler.execute(
        {
          location_id: 'loc:test',
          description_text: 'Alice touches Bob.',
          perception_type: 'physical.target_action',
          actor_id: 'actor1',
          target_id: 'target1',
          target_description: 'Someone touches my shoulder.',
          log_entry: true,
        },
        {}
      );

      expect(logHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          target_description: 'Someone touches my shoulder.',
          target_id: 'target1',
        })
      );
    });

    test('should pass both actor_description and target_description together', async () => {
      await handler.execute(
        {
          location_id: 'loc:test',
          description_text: 'Alice hugs Bob.',
          perception_type: 'physical.target_action',
          actor_id: 'actor1',
          target_id: 'target1',
          actor_description: 'I embrace Bob warmly.',
          target_description: 'Alice embraces me warmly.',
          log_entry: true,
        },
        {}
      );

      expect(logHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_description: 'I embrace Bob warmly.',
          target_description: 'Alice embraces me warmly.',
          target_id: 'target1',
        })
      );
    });

    test('should pass undefined actor_description/target_description when not provided (backward compatibility)', async () => {
      await handler.execute(
        {
          location_id: 'loc:test',
          description_text: 'Something happens.',
          perception_type: 'state.observable_change',
          actor_id: 'actor1',
          log_entry: true,
        },
        {}
      );

      expect(logHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_description: undefined,
          target_description: undefined,
        })
      );
    });

    test('should not pass parameters to log handler when log_entry is false', async () => {
      await handler.execute(
        {
          location_id: 'loc:test',
          description_text: 'Event without logging.',
          perception_type: 'movement.arrival',
          actor_id: 'actor1',
          actor_description: 'I arrive.',
          log_entry: false,
        },
        {}
      );

      expect(logHandler.execute).not.toHaveBeenCalled();
    });

    test('should pass target_id even when target_description is not provided', async () => {
      await handler.execute(
        {
          location_id: 'loc:test',
          description_text: 'Alice looks at Bob.',
          perception_type: 'physical.target_action',
          actor_id: 'actor1',
          target_id: 'target1',
          log_entry: true,
        },
        {}
      );

      expect(logHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          target_id: 'target1',
          target_description: undefined,
        })
      );
    });
  });
});
