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

const makeRoutingPolicyService = () => ({
  validateAndHandle: jest.fn().mockReturnValue(true),
});

const makeRecipientSetBuilder = () => ({
  build: jest.fn(),
});

describe('DispatchPerceptibleEventHandler', () => {
  let logger;
  let dispatcher;
  let routingPolicyService;
  let recipientSetBuilder;
  let handler;

  beforeEach(() => {
    logger = makeLogger();
    dispatcher = makeDispatcher();
    routingPolicyService = makeRoutingPolicyService();
    recipientSetBuilder = makeRecipientSetBuilder();
    handler = new DispatchPerceptibleEventHandler({
      dispatcher,
      logger,
      routingPolicyService,
      recipientSetBuilder,
    });
    jest.clearAllMocks();
  });

  test('dispatches event with auto timestamp', () => {
    const params = {
      location_id: 'loc:1',
      description_text: 'A arrives.',
      perception_type: 'movement.arrival',
      actor_id: 'npc:a',
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
          routingPolicyService,
        })
    ).toThrow('ISafeEventDispatcher');

    expect(
      () =>
        new DispatchPerceptibleEventHandler({
          dispatcher,
          logger: {},
          routingPolicyService,
        })
    ).toThrow('ILogger');

    expect(
      () =>
        new DispatchPerceptibleEventHandler({
          dispatcher,
          logger,
          routingPolicyService: {},
        })
    ).toThrow('IRecipientRoutingPolicyService');

    expect(
      () =>
        new DispatchPerceptibleEventHandler({
          dispatcher,
          logger,
          routingPolicyService,
          recipientSetBuilder: {},
        })
    ).toThrow('IRecipientSetBuilder');
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
          },
        })
      );
    });

    test('should abort when both recipientIds and excludedActorIds provided', () => {
      // Configure the mock to return false (indicating validation failure/abort)
      routingPolicyService.validateAndHandle.mockReturnValue(false);

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

      // Verify the routing policy service was called to validate
      expect(routingPolicyService.validateAndHandle).toHaveBeenCalledWith(
        ['npc:observer'],
        ['npc:c'],
        'DISPATCH_PERCEPTIBLE_EVENT'
      );

      // Should not dispatch any event (routing policy service handles the error dispatch)
      expect(dispatcher.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('Sense-aware filtering parameters', () => {
    test('should include alternate_descriptions in dispatched event', () => {
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
          alternate_descriptions: alternateDescriptions,
        },
        {}
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:perceptible_event',
        expect.objectContaining({
          alternateDescriptions: alternateDescriptions,
        })
      );
    });

    test('should include sense_aware in dispatched event', () => {
      handler.execute(
        {
          location_id: 'loc:test',
          description_text: 'A figure appears.',
          perception_type: 'state.observable_change',
          actor_id: 'npc:observer',
          sense_aware: false,
        },
        {}
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:perceptible_event',
        expect.objectContaining({
          senseAware: false,
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
        },
        {}
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:perceptible_event',
        expect.objectContaining({
          senseAware: true,
        })
      );
    });

    test('should include null alternate_descriptions when not provided', () => {
      handler.execute(
        {
          location_id: 'loc:test',
          description_text: 'Plain event.',
          perception_type: 'physical.target_action',
          actor_id: 'npc:actor',
        },
        {}
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:perceptible_event',
        expect.objectContaining({
          alternateDescriptions: null,
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
          alternate_descriptions: alternateDescriptions,
          sense_aware: true,
        },
        {}
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:perceptible_event',
        expect.objectContaining({
          alternateDescriptions: alternateDescriptions,
          senseAware: true,
        })
      );
    });
  });

  describe('Actor/target description pass-through', () => {
    test('should include actor_description in dispatched event', async () => {
      await handler.execute(
        {
          location_id: 'loc:test',
          description_text: 'Alice waves.',
          perception_type: 'physical.self_action',
          actor_id: 'actor1',
          actor_description: 'I wave enthusiastically.',
        },
        {}
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:perceptible_event',
        expect.objectContaining({
          actorDescription: 'I wave enthusiastically.',
        })
      );
    });

    test('should include target_description in dispatched event', async () => {
      await handler.execute(
        {
          location_id: 'loc:test',
          description_text: 'Alice touches Bob.',
          perception_type: 'physical.target_action',
          actor_id: 'actor1',
          target_id: 'target1',
          target_description: 'Someone touches my shoulder.',
        },
        {}
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:perceptible_event',
        expect.objectContaining({
          targetDescription: 'Someone touches my shoulder.',
          targetId: 'target1',
        })
      );
    });

    test('should include both actor_description and target_description together', async () => {
      await handler.execute(
        {
          location_id: 'loc:test',
          description_text: 'Alice hugs Bob.',
          perception_type: 'physical.target_action',
          actor_id: 'actor1',
          target_id: 'target1',
          actor_description: 'I embrace Bob warmly.',
          target_description: 'Alice embraces me warmly.',
        },
        {}
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:perceptible_event',
        expect.objectContaining({
          actorDescription: 'I embrace Bob warmly.',
          targetDescription: 'Alice embraces me warmly.',
          targetId: 'target1',
        })
      );
    });

    test('should include null actor_description/target_description when not provided', async () => {
      await handler.execute(
        {
          location_id: 'loc:test',
          description_text: 'Something happens.',
          perception_type: 'state.observable_change',
          actor_id: 'actor1',
        },
        {}
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:perceptible_event',
        expect.objectContaining({
          actorDescription: null,
          targetDescription: null,
        })
      );
    });
  });
});
