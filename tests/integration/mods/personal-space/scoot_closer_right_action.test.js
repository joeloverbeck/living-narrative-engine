import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import handleScootCloserRightRule from '../../../../data/mods/personal-space/rules/handle_scoot_closer_right.rule.json' assert { type: 'json' };
import eventIsActionScootCloserRight from '../../../../data/mods/personal-space/conditions/event-is-action-scoot-closer-right.condition.json' assert { type: 'json' };

describe('scoot_closer_right action execution - Integration Tests', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'personal-space',
      'personal-space:scoot_closer_right',
      handleScootCloserRightRule,
      eventIsActionScootCloserRight
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Successful Execution', () => {
    it('should successfully move actor one spot to the right', async () => {
      // Setup: Furniture with [actor1, null, occupant1]
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const furniture = new ModEntityBuilder('furniture1')
        .withName('bench')
        .atLocation('room1')
        .withComponent('sitting:allows_sitting', {
          spots: ['actor1', null, 'occupant1'],
        })
        .build();

      const occupant1 = new ModEntityBuilder('occupant1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 2,
        })
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, furniture, occupant1, actor]);

      await testFixture.executeAction('actor1', 'furniture1', {
        additionalPayload: { secondaryId: 'occupant1' },
      });

      const actorSitting = testFixture.entityManager.getComponentData(
        'actor1',
        'sitting-states:sitting_on'
      );
      expect(actorSitting.spot_index).toBe(1);
      expect(actorSitting.furniture_id).toBe('furniture1');

      const furnitureSpots = testFixture.entityManager.getComponentData(
        'furniture1',
        'sitting:allows_sitting'
      );
      expect(furnitureSpots.spots).toEqual([null, 'actor1', 'occupant1']);

      const occupant1Sitting = testFixture.entityManager.getComponentData(
        'occupant1',
        'sitting-states:sitting_on'
      );
      expect(occupant1Sitting.spot_index).toBe(2);
      expect(occupant1Sitting.furniture_id).toBe('furniture1');
    });

    it('should handle multiple empty spots correctly', async () => {
      // Setup: Furniture with [actor1, null, null, occupant1]
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const furniture = new ModEntityBuilder('furniture1')
        .withName('bench')
        .atLocation('room1')
        .withComponent('sitting:allows_sitting', {
          spots: ['actor1', null, null, 'occupant1'],
        })
        .build();

      const occupant1 = new ModEntityBuilder('occupant1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 3,
        })
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, furniture, occupant1, actor]);

      await testFixture.executeAction('actor1', 'furniture1', {
        additionalPayload: { secondaryId: 'occupant1' },
      });

      const actorSitting = testFixture.entityManager.getComponentData(
        'actor1',
        'sitting-states:sitting_on'
      );
      expect(actorSitting.spot_index).toBe(1);

      const furnitureSpots = testFixture.entityManager.getComponentData(
        'furniture1',
        'sitting:allows_sitting'
      );
      expect(furnitureSpots.spots).toEqual([null, 'actor1', null, 'occupant1']);

      const occupant1Sitting = testFixture.entityManager.getComponentData(
        'occupant1',
        'sitting-states:sitting_on'
      );
      expect(occupant1Sitting.spot_index).toBe(3);
    });

    it('should handle scenarios with multiple occupants to the right', async () => {
      // Setup: Furniture with [actor1, null, occupant1, occupant2]
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const furniture = new ModEntityBuilder('furniture1')
        .withName('bench')
        .atLocation('room1')
        .withComponent('sitting:allows_sitting', {
          spots: ['actor1', null, 'occupant1', 'occupant2'],
        })
        .build();

      const occupant1 = new ModEntityBuilder('occupant1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 2,
        })
        .build();

      const occupant2 = new ModEntityBuilder('occupant2')
        .withName('Carol')
        .atLocation('room1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 3,
        })
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, furniture, occupant1, occupant2, actor]);

      await testFixture.executeAction('actor1', 'furniture1', {
        additionalPayload: { secondaryId: 'occupant1' },
      });

      const actorSitting = testFixture.entityManager.getComponentData(
        'actor1',
        'sitting-states:sitting_on'
      );
      expect(actorSitting.spot_index).toBe(1);

      const furnitureSpots = testFixture.entityManager.getComponentData(
        'furniture1',
        'sitting:allows_sitting'
      );
      expect(furnitureSpots.spots).toEqual([
        null,
        'actor1',
        'occupant1',
        'occupant2',
      ]);

      const occupant1Sitting = testFixture.entityManager.getComponentData(
        'occupant1',
        'sitting-states:sitting_on'
      );
      expect(occupant1Sitting.spot_index).toBe(2);
      const occupant2Sitting = testFixture.entityManager.getComponentData(
        'occupant2',
        'sitting-states:sitting_on'
      );
      expect(occupant2Sitting.spot_index).toBe(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle immediate neighbor scenario by resolving targets automatically', async () => {
      // Setup: Furniture with [actor1, null, occupant1]
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const furniture = new ModEntityBuilder('furniture1')
        .withName('bench')
        .atLocation('room1')
        .withComponent('sitting:allows_sitting', {
          spots: ['actor1', null, 'occupant1'],
        })
        .build();

      const occupant1 = new ModEntityBuilder('occupant1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 2,
        })
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, furniture, occupant1, actor]);

      await testFixture.executeAction('actor1', 'furniture1');

      const actorSitting = testFixture.entityManager.getComponentData(
        'actor1',
        'sitting-states:sitting_on'
      );
      expect(actorSitting.spot_index).toBe(1);
    });

    it('should preserve spot_index type as number after execution', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const furniture = new ModEntityBuilder('furniture1')
        .withName('bench')
        .atLocation('room1')
        .withComponent('sitting:allows_sitting', {
          spots: ['actor1', null, 'occupant1'],
        })
        .build();

      const occupant1 = new ModEntityBuilder('occupant1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 2,
        })
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, furniture, occupant1, actor]);

      await testFixture.executeAction('actor1', 'furniture1', {
        additionalPayload: { secondaryId: 'occupant1' },
      });

      const actorSitting = testFixture.entityManager.getComponentData(
        'actor1',
        'sitting-states:sitting_on'
      );
      expect(typeof actorSitting.spot_index).toBe('number');
      expect(actorSitting.spot_index).toBe(1);
    });
  });
});
