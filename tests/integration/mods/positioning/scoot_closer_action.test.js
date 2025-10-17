import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import handleScootCloserRule from '../../../../data/mods/positioning/rules/handle_scoot_closer.rule.json' assert { type: 'json' };
import eventIsActionScootCloser from '../../../../data/mods/positioning/conditions/event-is-action-scoot-closer.condition.json' assert { type: 'json' };

describe('scoot_closer action execution - Integration Tests', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:scoot_closer',
      handleScootCloserRule,
      eventIsActionScootCloser
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Successful Execution', () => {
    it('should successfully move actor one spot to the left', async () => {
      // Setup: Furniture with [occupant1, null, actor]
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const furniture = new ModEntityBuilder('furniture1')
        .withName('bench')
        .atLocation('room1')
        .withComponent('positioning:allows_sitting', {
          spots: ['occupant1', null, 'actor1'],
        })
        .build();

      const occupant1 = new ModEntityBuilder('occupant1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 0,
        })
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 2,
        })
        .build();

      testFixture.reset([room, furniture, occupant1, actor]);

      // Act
      await testFixture.executeAction('actor1', 'furniture1', {
        additionalPayload: { secondaryId: 'occupant1' },
      });

      // Assert - Actor moved to spot 1
      const actorSitting = testFixture.entityManager.getComponentData(
        'actor1',
        'positioning:sitting_on'
      );
      expect(actorSitting.spot_index).toBe(1);
      expect(actorSitting.furniture_id).toBe('furniture1');

      // Assert - Furniture spots updated
      const furnitureSpots = testFixture.entityManager.getComponentData(
        'furniture1',
        'positioning:allows_sitting'
      );
      expect(furnitureSpots.spots).toEqual(['occupant1', 'actor1', null]);

      // Assert - Occupant unchanged
      const occupant1Sitting = testFixture.entityManager.getComponentData(
        'occupant1',
        'positioning:sitting_on'
      );
      expect(occupant1Sitting.spot_index).toBe(0);
      expect(occupant1Sitting.furniture_id).toBe('furniture1');
    });

    it('should handle multiple empty spots correctly', async () => {
      // Setup: Furniture with [occupant1, null, null, actor]
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const furniture = new ModEntityBuilder('furniture1')
        .withName('bench')
        .atLocation('room1')
        .withComponent('positioning:allows_sitting', {
          spots: ['occupant1', null, null, 'actor1'],
        })
        .build();

      const occupant1 = new ModEntityBuilder('occupant1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 0,
        })
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 3,
        })
        .build();

      testFixture.reset([room, furniture, occupant1, actor]);

      // Act
      await testFixture.executeAction('actor1', 'furniture1', {
        additionalPayload: { secondaryId: 'occupant1' },
      });

      // Assert - Actor moved to spot 2 (one spot to the left)
      const actorSitting = testFixture.entityManager.getComponentData(
        'actor1',
        'positioning:sitting_on'
      );
      expect(actorSitting.spot_index).toBe(2);
      expect(actorSitting.furniture_id).toBe('furniture1');

      // Assert - Furniture spots updated correctly
      const furnitureSpots = testFixture.entityManager.getComponentData(
        'furniture1',
        'positioning:allows_sitting'
      );
      expect(furnitureSpots.spots).toEqual(['occupant1', null, 'actor1', null]);
    });
  });

  describe('Component State Validation', () => {
    it('should maintain furniture_id reference after scooting', async () => {
      // Setup
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const furniture = new ModEntityBuilder('furniture1')
        .withName('bench')
        .atLocation('room1')
        .withComponent('positioning:allows_sitting', {
          spots: ['occupant1', null, 'actor1'],
        })
        .build();

      const occupant1 = new ModEntityBuilder('occupant1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 0,
        })
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 2,
        })
        .build();

      testFixture.reset([room, furniture, occupant1, actor]);

      // Act
      await testFixture.executeAction('actor1', 'furniture1', {
        additionalPayload: { secondaryId: 'occupant1' },
      });

      // Assert - furniture_id unchanged
      const actorSitting = testFixture.entityManager.getComponentData(
        'actor1',
        'positioning:sitting_on'
      );
      expect(actorSitting.furniture_id).toBe('furniture1');
    });

    it('should update furniture spots array atomically', async () => {
      // Setup
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const furniture = new ModEntityBuilder('furniture1')
        .withName('bench')
        .atLocation('room1')
        .withComponent('positioning:allows_sitting', {
          spots: ['occupant1', null, 'actor1'],
        })
        .build();

      const occupant1 = new ModEntityBuilder('occupant1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 0,
        })
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 2,
        })
        .build();

      testFixture.reset([room, furniture, occupant1, actor]);

      const originalSpots = testFixture.entityManager.getComponentData(
        'furniture1',
        'positioning:allows_sitting'
      ).spots;

      // Act
      await testFixture.executeAction('actor1', 'furniture1', {
        additionalPayload: { secondaryId: 'occupant1' },
      });

      // Assert - Spots array updated correctly
      const newSpots = testFixture.entityManager.getComponentData(
        'furniture1',
        'positioning:allows_sitting'
      ).spots;
      expect(newSpots).not.toEqual(originalSpots);
      expect(newSpots).toEqual(['occupant1', 'actor1', null]);
      expect(newSpots.length).toBe(originalSpots.length);
    });
  });

  describe('Multi-Occupant Scenarios', () => {
    it('should correctly handle scooting with three occupants', async () => {
      // Setup: Furniture with [occupant1, occupant2, null, actor]
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const furniture = new ModEntityBuilder('furniture1')
        .withName('bench')
        .atLocation('room1')
        .withComponent('positioning:allows_sitting', {
          spots: ['occupant1', 'occupant2', null, 'actor1'],
        })
        .build();

      const occupant1 = new ModEntityBuilder('occupant1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 0,
        })
        .build();

      const occupant2 = new ModEntityBuilder('occupant2')
        .withName('Charlie')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 1,
        })
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 3,
        })
        .build();

      testFixture.reset([room, furniture, occupant1, occupant2, actor]);

      // Act
      await testFixture.executeAction('actor1', 'furniture1', {
        additionalPayload: { secondaryId: 'occupant1' },
      });

      // Assert - Actor moved to spot 2
      const actorSitting = testFixture.entityManager.getComponentData(
        'actor1',
        'positioning:sitting_on'
      );
      expect(actorSitting.spot_index).toBe(2);

      // Assert - Other occupants unchanged
      const occupant1Sitting = testFixture.entityManager.getComponentData(
        'occupant1',
        'positioning:sitting_on'
      );
      expect(occupant1Sitting.spot_index).toBe(0);

      const occupant2Sitting = testFixture.entityManager.getComponentData(
        'occupant2',
        'positioning:sitting_on'
      );
      expect(occupant2Sitting.spot_index).toBe(1);

      // Assert - Furniture spots updated
      const furnitureSpots = testFixture.entityManager.getComponentData(
        'furniture1',
        'positioning:allows_sitting'
      );
      expect(furnitureSpots.spots).toEqual([
        'occupant1',
        'occupant2',
        'actor1',
        null,
      ]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle immediate neighbor scenario', async () => {
      // Setup: Furniture with [occupant1, null, actor] but they're already next to each other
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const furniture = new ModEntityBuilder('furniture1')
        .withName('bench')
        .atLocation('room1')
        .withComponent('positioning:allows_sitting', {
          spots: ['occupant1', null, 'actor1'],
        })
        .build();

      const occupant1 = new ModEntityBuilder('occupant1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 0,
        })
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 2,
        })
        .build();

      testFixture.reset([room, furniture, occupant1, actor]);

      // Act - should still execute successfully
      await testFixture.executeAction('actor1', 'furniture1');

      // Assert
      const actorSitting = testFixture.entityManager.getComponentData(
        'actor1',
        'positioning:sitting_on'
      );
      expect(actorSitting.spot_index).toBe(1);
    });

    it('should preserve spot_index type as number after execution', async () => {
      // Setup
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const furniture = new ModEntityBuilder('furniture1')
        .withName('bench')
        .atLocation('room1')
        .withComponent('positioning:allows_sitting', {
          spots: ['occupant1', null, 'actor1'],
        })
        .build();

      const occupant1 = new ModEntityBuilder('occupant1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 0,
        })
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 2,
        })
        .build();

      testFixture.reset([room, furniture, occupant1, actor]);

      // Act
      await testFixture.executeAction('actor1', 'furniture1', {
        additionalPayload: { secondaryId: 'occupant1' },
      });

      // Assert - spot_index is number, not string
      const actorSitting = testFixture.entityManager.getComponentData(
        'actor1',
        'positioning:sitting_on'
      );
      expect(typeof actorSitting.spot_index).toBe('number');
      expect(actorSitting.spot_index).toBe(1);
    });
  });
});
