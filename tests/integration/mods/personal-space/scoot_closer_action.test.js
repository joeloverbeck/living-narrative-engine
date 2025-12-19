import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import handleScootCloserRule from '../../../../data/mods/personal-space/rules/handle_scoot_closer.rule.json' assert { type: 'json' };
import eventIsActionScootCloser from '../../../../data/mods/personal-space/conditions/event-is-action-scoot-closer.condition.json' assert { type: 'json' };

describe('scoot_closer action execution - Integration Tests', () => {
  let testFixture;
  const createScootScenario = (options = {}) =>
    testFixture.createSittingPair({
      locationId: 'room1',
      roomId: 'room1',
      roomName: 'Test Room',
      furnitureId: 'furniture1',
      furnitureName: 'bench',
      seatedActors: [
        { id: 'occupant1', name: 'Bob', spotIndex: 0 },
        { id: 'actor1', name: 'Alice', spotIndex: 2 },
      ],
      ...options,
    });
  const getSuccessEvent = () =>
    testFixture.events.find(
      (event) => event.eventType === 'core:display_successful_action_result'
    );

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'personal-space',
      'personal-space:scoot_closer',
      handleScootCloserRule,
      eventIsActionScootCloser
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Successful Execution', () => {
    it('should successfully move actor one spot to the left', async () => {
      const scenario = createScootScenario();
      const actor = scenario.seatedActors.find(
        (entity) => entity.id === 'actor1'
      );
      const occupant = scenario.seatedActors.find(
        (entity) => entity.id === 'occupant1'
      );

      // Act
      await testFixture.executeAction(actor.id, scenario.furniture.id, {
        additionalPayload: { secondaryId: occupant.id },
      });

      // Assert - Actor moved to spot 1
      const actorEntity = testFixture.entityManager.getEntityInstance(actor.id);
      expect(actorEntity).toHaveComponentData('positioning:sitting_on', {
        furniture_id: scenario.furniture.id,
        spot_index: 1,
      });
      expect(testFixture.events).toDispatchEvent(
        'core:display_successful_action_result'
      );
      const successEvent = getSuccessEvent();
      expect(successEvent).toBeDefined();
      expect(successEvent.payload.message).toBe(
        'Alice scoots closer to Bob on bench.'
      );

      // Assert - Furniture spots updated
      const furniture = testFixture.entityManager.getEntityInstance(
        scenario.furniture.id
      );
      expect(furniture).toHaveComponentData('sitting:allows_sitting', {
        spots: ['occupant1', 'actor1', null],
      });

      // Assert - Occupant unchanged
      const occupantEntity = testFixture.entityManager.getEntityInstance(
        occupant.id
      );
      expect(occupantEntity).toHaveComponentData('positioning:sitting_on', {
        furniture_id: scenario.furniture.id,
        spot_index: 0,
      });
    });

    it('should handle multiple empty spots correctly', async () => {
      const scenario = createScootScenario({
        seatedActors: [
          { id: 'occupant1', name: 'Bob', spotIndex: 0 },
          { id: 'actor1', name: 'Alice', spotIndex: 3 },
        ],
      });
      const actor = scenario.seatedActors.find(
        (entity) => entity.id === 'actor1'
      );
      const occupant = scenario.seatedActors.find(
        (entity) => entity.id === 'occupant1'
      );

      // Act
      await testFixture.executeAction(actor.id, scenario.furniture.id, {
        additionalPayload: { secondaryId: occupant.id },
      });

      // Assert - Actor moved to spot 2 (one spot to the left)
      const actorEntity = testFixture.entityManager.getEntityInstance(actor.id);
      expect(actorEntity).toHaveComponentData('positioning:sitting_on', {
        furniture_id: scenario.furniture.id,
        spot_index: 2,
      });
      expect(testFixture.events).toDispatchEvent(
        'core:display_successful_action_result'
      );
      const successEvent = getSuccessEvent();
      expect(successEvent).toBeDefined();
      expect(successEvent.payload.message).toBe(
        'Alice scoots closer to Bob on bench.'
      );

      // Assert - Furniture spots updated correctly
      const furniture = testFixture.entityManager.getEntityInstance(
        scenario.furniture.id
      );
      expect(furniture).toHaveComponentData('sitting:allows_sitting', {
        spots: ['occupant1', null, 'actor1', null],
      });
    });
  });

  describe('Component State Validation', () => {
    it('should maintain furniture_id reference after scooting', async () => {
      const scenario = createScootScenario();
      const actor = scenario.seatedActors.find(
        (entity) => entity.id === 'actor1'
      );
      const occupant = scenario.seatedActors.find(
        (entity) => entity.id === 'occupant1'
      );

      // Act
      await testFixture.executeAction(actor.id, scenario.furniture.id, {
        additionalPayload: { secondaryId: occupant.id },
      });

      // Assert - furniture_id unchanged
      const actorEntity = testFixture.entityManager.getEntityInstance(actor.id);
      expect(actorEntity).toHaveComponentData('positioning:sitting_on', {
        furniture_id: scenario.furniture.id,
        spot_index: 1,
      });
    });

    it('should update furniture spots array atomically', async () => {
      const scenario = createScootScenario();
      const actor = scenario.seatedActors.find(
        (entity) => entity.id === 'actor1'
      );
      const occupant = scenario.seatedActors.find(
        (entity) => entity.id === 'occupant1'
      );

      const furnitureBefore = testFixture.entityManager.getEntityInstance(
        scenario.furniture.id
      );
      const originalSpots = [
        ...furnitureBefore.components['sitting:allows_sitting'].spots,
      ];

      // Act
      await testFixture.executeAction(actor.id, scenario.furniture.id, {
        additionalPayload: { secondaryId: occupant.id },
      });

      // Assert - Spots array updated correctly
      const updatedFurniture = testFixture.entityManager.getEntityInstance(
        scenario.furniture.id
      );
      const newSpots =
        updatedFurniture.components['sitting:allows_sitting'].spots;
      expect(newSpots).not.toEqual(originalSpots);
      expect(newSpots).toEqual(['occupant1', 'actor1', null]);
      expect(newSpots.length).toBe(originalSpots.length);
    });
  });

  describe('Multi-Occupant Scenarios', () => {
    it('should correctly handle scooting with three occupants', async () => {
      const scenario = createScootScenario({
        seatedActors: [
          { id: 'occupant1', name: 'Bob', spotIndex: 0 },
          { id: 'occupant2', name: 'Charlie', spotIndex: 1 },
          { id: 'actor1', name: 'Alice', spotIndex: 3 },
        ],
      });
      const actor = scenario.seatedActors.find(
        (entity) => entity.id === 'actor1'
      );
      const occupant = scenario.seatedActors.find(
        (entity) => entity.id === 'occupant1'
      );
      const occupantTwo = scenario.seatedActors.find(
        (entity) => entity.id === 'occupant2'
      );

      // Act
      await testFixture.executeAction(actor.id, scenario.furniture.id, {
        additionalPayload: { secondaryId: occupant.id },
      });

      // Assert - Actor moved to spot 2
      const actorEntity = testFixture.entityManager.getEntityInstance(actor.id);
      expect(actorEntity).toHaveComponentData('positioning:sitting_on', {
        furniture_id: scenario.furniture.id,
        spot_index: 2,
      });
      expect(testFixture.events).toDispatchEvent(
        'core:display_successful_action_result'
      );
      const successEvent = getSuccessEvent();
      expect(successEvent).toBeDefined();
      expect(successEvent.payload.message).toBe(
        'Alice scoots closer to Bob on bench.'
      );

      // Assert - Other occupants unchanged
      const occupantOneEntity = testFixture.entityManager.getEntityInstance(
        occupant.id
      );
      expect(occupantOneEntity).toHaveComponentData('positioning:sitting_on', {
        furniture_id: scenario.furniture.id,
        spot_index: 0,
      });

      const occupantTwoEntity = testFixture.entityManager.getEntityInstance(
        occupantTwo.id
      );
      expect(occupantTwoEntity).toHaveComponentData('positioning:sitting_on', {
        furniture_id: scenario.furniture.id,
        spot_index: 1,
      });

      // Assert - Furniture spots updated
      const furniture = testFixture.entityManager.getEntityInstance(
        scenario.furniture.id
      );
      expect(furniture).toHaveComponentData('sitting:allows_sitting', {
        spots: ['occupant1', 'occupant2', 'actor1', null],
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle immediate neighbor scenario', async () => {
      const scenario = createScootScenario();
      const actor = scenario.seatedActors.find(
        (entity) => entity.id === 'actor1'
      );

      // Act - should still execute successfully
      await testFixture.executeAction(actor.id, scenario.furniture.id);

      // Assert
      const actorEntity = testFixture.entityManager.getEntityInstance(actor.id);
      expect(actorEntity).toHaveComponentData('positioning:sitting_on', {
        furniture_id: scenario.furniture.id,
        spot_index: 1,
      });
      expect(testFixture.events).toDispatchEvent(
        'core:display_successful_action_result'
      );
      const successEvent = getSuccessEvent();
      expect(successEvent).toBeDefined();
      expect(successEvent.payload.message).toContain('Alice scoots closer to');
    });

    it('should preserve spot_index type as number after execution', async () => {
      const scenario = createScootScenario();
      const actor = scenario.seatedActors.find(
        (entity) => entity.id === 'actor1'
      );
      const occupant = scenario.seatedActors.find(
        (entity) => entity.id === 'occupant1'
      );

      // Act
      await testFixture.executeAction(actor.id, scenario.furniture.id, {
        additionalPayload: { secondaryId: occupant.id },
      });

      // Assert - spot_index is number, not string
      const actorEntity = testFixture.entityManager.getEntityInstance(actor.id);
      const sittingData = actorEntity.components['positioning:sitting_on'];
      expect(typeof sittingData.spot_index).toBe('number');
      expect(sittingData.spot_index).toBe(1);
    });
  });
});
