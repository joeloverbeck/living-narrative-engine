/**
 * @jest-environment node
 */
/**
 * @file Tests specifically for target_description routing in AddPerceptionLogEntryHandler
 * @description Verifies that target entities receive their custom target_description
 * instead of filtered observer text when sense filtering is enabled.
 *
 * Bug being fixed: When sense filtering is active, the target_description was being
 * overwritten by the filtered observer text because filtered.descriptionText was
 * always populated, causing the nullish coalescing operator to never trigger.
 */

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';

import AddPerceptionLogEntryHandler from '../../../../src/logic/operationHandlers/addPerceptionLogEntryHandler.js';

// ─── Test Doubles ─────────────────────────────────────────────────────────────
/** @type {jest.Mocked<any>} */ let log;
/** @type {jest.Mocked<any>} */ let em;
/** @type {{ dispatch: jest.Mock }} */ let dispatcher;
/** @type {{ filterEventForRecipients: jest.Mock }} */ let mockPerceptionFilterService;

const LOC = 'loc:test_room';
const ACTOR_ID = 'npc:pitch';
const TARGET_ID = 'npc:cress';
const OBSERVER_ID = 'npc:observer';

/**
 * Create a minimally-valid log entry for testing.
 */
const makeEntry = (id = '1') => ({
  descriptionText: `Event-${id}`,
  timestamp: new Date().toISOString(),
  perceptionType: 'physical.target_action',
  actorId: ACTOR_ID,
  targetId: TARGET_ID,
  involvedEntities: [],
  eventId: `ut_${Date.now()}_${id}`,
});

beforeEach(() => {
  log = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  em = {
    getEntitiesInLocation: jest.fn(),
    hasComponent: jest.fn().mockReturnValue(true),
    getComponentData: jest.fn().mockReturnValue({ maxEntries: 10, logEntries: [] }),
    addComponent: jest.fn().mockResolvedValue(true),
    getEntityInstance: jest.fn(),
    createEntityInstance: jest.fn(),
    getEntitiesWithComponent: jest.fn(),
    removeComponent: jest.fn(),
  };

  dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };

  mockPerceptionFilterService = {
    filterEventForRecipients: jest.fn(),
  };
});

afterEach(() => jest.clearAllMocks());

describe('AddPerceptionLogEntryHandler - target_description routing', () => {
  describe('target receives target_description with sense filtering enabled', () => {
    it('should deliver target_description to target instead of filtered observer text', async () => {
      // This test reproduces the bug: target should see "Pitch removes my river-sole work shoes."
      // but was seeing "Pitch removes Cress Siltwell's river-sole work shoes."
      const entry = makeEntry('clothing_removal');
      entry.descriptionText = "Pitch removes Cress Siltwell's river-sole work shoes."; // Observer text

      em.getEntitiesInLocation.mockReturnValue(
        new Set([ACTOR_ID, TARGET_ID, OBSERVER_ID])
      );

      // Filter service returns visual perception for all entities
      mockPerceptionFilterService.filterEventForRecipients.mockReturnValue([
        {
          entityId: ACTOR_ID,
          descriptionText: "Pitch removes Cress Siltwell's river-sole work shoes.",
          sense: 'visual',
          canPerceive: true,
        },
        {
          entityId: TARGET_ID,
          descriptionText: "Pitch removes Cress Siltwell's river-sole work shoes.", // Bug: This overwrote target_description
          sense: 'visual',
          canPerceive: true,
        },
        {
          entityId: OBSERVER_ID,
          descriptionText: "Pitch removes Cress Siltwell's river-sole work shoes.",
          sense: 'visual',
          canPerceive: true,
        },
      ]);

      const h = new AddPerceptionLogEntryHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
        perceptionFilterService: mockPerceptionFilterService,
      });

      await h.execute({
        location_id: LOC,
        entry,
        actor_description: "I remove Cress Siltwell's river-sole work shoes.",
        target_description: 'Pitch removes my river-sole work shoes.', // Expected for target
        target_id: TARGET_ID,
        originating_actor_id: ACTOR_ID,
      });

      expect(em.addComponent).toHaveBeenCalledTimes(3);

      // Target should receive target_description, NOT filtered observer text
      const targetCall = em.addComponent.mock.calls.find(
        (call) => call[0] === TARGET_ID
      );
      expect(targetCall[2].logEntries[0].descriptionText).toBe(
        'Pitch removes my river-sole work shoes.'
      );
      // Without alternate_descriptions, no sense filtering occurs, so no perceivedVia
      expect(targetCall[2].logEntries[0].perceivedVia).toBeUndefined();

      // Actor should receive actor_description
      const actorCall = em.addComponent.mock.calls.find(
        (call) => call[0] === ACTOR_ID
      );
      expect(actorCall[2].logEntries[0].descriptionText).toBe(
        "I remove Cress Siltwell's river-sole work shoes."
      );
      expect(actorCall[2].logEntries[0].perceivedVia).toBe('self');

      // Observer should receive observer text (description_text)
      const observerCall = em.addComponent.mock.calls.find(
        (call) => call[0] === OBSERVER_ID
      );
      expect(observerCall[2].logEntries[0].descriptionText).toBe(
        "Pitch removes Cress Siltwell's river-sole work shoes."
      );
      // Without alternate_descriptions, no sense filtering occurs
      expect(observerCall[2].logEntries[0].perceivedVia).toBeUndefined();
    });

    it('should deliver target_description even when target uses alternate sense', async () => {
      // Target perceives via tactile but should still get target_description
      const entry = makeEntry('tactile_target');
      entry.descriptionText = 'Observer sees Pitch caress Cress\'s cheek.';

      em.getEntitiesInLocation.mockReturnValue(
        new Set([ACTOR_ID, TARGET_ID, OBSERVER_ID])
      );

      // Filter service returns tactile for target (e.g., they're blind)
      mockPerceptionFilterService.filterEventForRecipients.mockReturnValue([
        {
          entityId: ACTOR_ID,
          descriptionText: 'Observer sees Pitch caress Cress\'s cheek.',
          sense: 'visual',
          canPerceive: true,
        },
        {
          entityId: TARGET_ID,
          descriptionText: 'I feel a touch on my cheek.', // Filtered tactile fallback
          sense: 'tactile',
          canPerceive: true,
        },
        {
          entityId: OBSERVER_ID,
          descriptionText: 'Observer sees Pitch caress Cress\'s cheek.',
          sense: 'visual',
          canPerceive: true,
        },
      ]);

      const h = new AddPerceptionLogEntryHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
        perceptionFilterService: mockPerceptionFilterService,
      });

      await h.execute({
        location_id: LOC,
        entry,
        actor_description: 'I caress Cress\'s cheek gently.',
        target_description: 'Pitch caresses my cheek gently.',
        target_id: TARGET_ID,
        originating_actor_id: ACTOR_ID,
        alternate_descriptions: { tactile: 'I feel a touch on my cheek.' },
      });

      expect(em.addComponent).toHaveBeenCalledTimes(3);

      // Target should receive target_description, preserving perceivedVia sense
      const targetCall = em.addComponent.mock.calls.find(
        (call) => call[0] === TARGET_ID
      );
      expect(targetCall[2].logEntries[0].descriptionText).toBe(
        'Pitch caresses my cheek gently.'
      );
      // Still shows perceived via tactile (from filter service)
      expect(targetCall[2].logEntries[0].perceivedVia).toBe('tactile');
    });

    it('should use filtered text for observers while target gets target_description', async () => {
      // Observer uses auditory fallback, target gets custom text
      const entry = makeEntry('mixed_senses');
      entry.descriptionText = 'Pitch removes clothing.';

      em.getEntitiesInLocation.mockReturnValue(
        new Set([ACTOR_ID, TARGET_ID, OBSERVER_ID])
      );

      mockPerceptionFilterService.filterEventForRecipients.mockReturnValue([
        {
          entityId: ACTOR_ID,
          descriptionText: 'Pitch removes clothing.',
          sense: 'visual',
          canPerceive: true,
        },
        {
          entityId: TARGET_ID,
          descriptionText: 'Pitch removes clothing.',
          sense: 'visual',
          canPerceive: true,
        },
        {
          entityId: OBSERVER_ID,
          descriptionText: 'I hear rustling fabric.', // Auditory fallback for observer
          sense: 'auditory',
          canPerceive: true,
        },
      ]);

      const h = new AddPerceptionLogEntryHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
        perceptionFilterService: mockPerceptionFilterService,
      });

      await h.execute({
        location_id: LOC,
        entry,
        actor_description: 'I remove my shoes.',
        target_description: 'Pitch removes my shoes.',
        target_id: TARGET_ID,
        originating_actor_id: ACTOR_ID,
        alternate_descriptions: { auditory: 'I hear rustling fabric.' },
      });

      expect(em.addComponent).toHaveBeenCalledTimes(3);

      // Target gets target_description
      const targetCall = em.addComponent.mock.calls.find(
        (call) => call[0] === TARGET_ID
      );
      expect(targetCall[2].logEntries[0].descriptionText).toBe(
        'Pitch removes my shoes.'
      );

      // Observer gets filtered text (auditory fallback)
      const observerCall = em.addComponent.mock.calls.find(
        (call) => call[0] === OBSERVER_ID
      );
      expect(observerCall[2].logEntries[0].descriptionText).toBe(
        'I hear rustling fabric.'
      );
      expect(observerCall[2].logEntries[0].perceivedVia).toBe('auditory');
    });

    it('should fall back to filtered observer text when target_description is not provided', async () => {
      // Without target_description, target should get filtered observer text
      const entry = makeEntry('no_target_desc');
      entry.descriptionText = 'Someone does something.';

      em.getEntitiesInLocation.mockReturnValue(
        new Set([ACTOR_ID, TARGET_ID])
      );

      mockPerceptionFilterService.filterEventForRecipients.mockReturnValue([
        {
          entityId: ACTOR_ID,
          descriptionText: 'Someone does something.',
          sense: 'visual',
          canPerceive: true,
        },
        {
          entityId: TARGET_ID,
          descriptionText: 'I hear something happening.',
          sense: 'auditory',
          canPerceive: true,
        },
      ]);

      const h = new AddPerceptionLogEntryHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
        perceptionFilterService: mockPerceptionFilterService,
      });

      await h.execute({
        location_id: LOC,
        entry,
        actor_description: 'I do something.',
        // No target_description provided
        target_id: TARGET_ID,
        originating_actor_id: ACTOR_ID,
        alternate_descriptions: { auditory: 'I hear something happening.' },
      });

      expect(em.addComponent).toHaveBeenCalledTimes(2);

      // Target should receive filtered text since no target_description
      const targetCall = em.addComponent.mock.calls.find(
        (call) => call[0] === TARGET_ID
      );
      expect(targetCall[2].logEntries[0].descriptionText).toBe(
        'I hear something happening.'
      );
      expect(targetCall[2].logEntries[0].perceivedVia).toBe('auditory');
    });
  });
});
