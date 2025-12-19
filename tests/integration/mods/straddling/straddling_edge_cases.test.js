import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';

describe('Straddling Waist System - Edge Cases', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'straddling',
      'straddling:straddle_waist_facing'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Mutual exclusivity with positioning states', () => {
    it('should prevent straddling when actor is sitting down', async () => {
      const room = new ModEntityBuilder('test:room').asRoom('Bedroom').build();

      const chair = new ModEntityBuilder('test:chair')
        .withName('Chair')
        .atLocation('test:room')
        .withComponent('furniture:seating', { seat_count: 2 })
        .build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('test:room')
        .withComponent('positioning:sitting_on', {
          furniture_id: 'test:chair',
          seat_index: 0,
        })
        .withComponent('personal-space-states:closeness', {
          partners: ['test:target'],
        })
        .asActor()
        .build();

      const target = new ModEntityBuilder('test:target')
        .withName('Bob')
        .atLocation('test:room')
        .withComponent('positioning:sitting_on', {
          furniture_id: 'test:chair',
          seat_index: 1,
        })
        .withComponent('personal-space-states:closeness', {
          partners: ['test:actor1'],
        })
        .asActor()
        .build();

      testFixture.reset([room, chair, actor, target]);

      const actions = testFixture.actions || [];
      const straddleFacing = actions.some(
        (a) => a.id === 'straddling:straddle_waist_facing'
      );
      const straddleAway = actions.some(
        (a) => a.id === 'straddling:straddle_waist_facing_away'
      );

      expect(straddleFacing).toBe(false);
      expect(straddleAway).toBe(false);
    });

    it('should prevent straddling when actor is kneeling', async () => {
      const room = new ModEntityBuilder('test:room').asRoom('Bedroom').build();

      const chair = new ModEntityBuilder('test:chair')
        .withName('Chair')
        .atLocation('test:room')
        .withComponent('furniture:seating', { seat_count: 1 })
        .build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('test:room')
        .withComponent('positioning:kneeling_before', {
          target_id: 'test:target',
        })
        .withComponent('personal-space-states:closeness', {
          partners: ['test:target'],
        })
        .asActor()
        .build();

      const target = new ModEntityBuilder('test:target')
        .withName('Bob')
        .atLocation('test:room')
        .withComponent('positioning:sitting_on', {
          furniture_id: 'test:chair',
          seat_index: 0,
        })
        .withComponent('personal-space-states:closeness', {
          partners: ['test:actor1'],
        })
        .asActor()
        .build();

      testFixture.reset([room, chair, actor, target]);

      const actions = testFixture.actions || [];
      const straddleFacing = actions.some(
        (a) => a.id === 'straddling:straddle_waist_facing'
      );
      const straddleAway = actions.some(
        (a) => a.id === 'straddling:straddle_waist_facing_away'
      );

      expect(straddleFacing).toBe(false);
      expect(straddleAway).toBe(false);
    });

    it('should prevent straddling when actor is bending over', async () => {
      const room = new ModEntityBuilder('test:room').asRoom('Bedroom').build();

      const chair = new ModEntityBuilder('test:chair')
        .withName('Chair')
        .atLocation('test:room')
        .withComponent('furniture:seating', { seat_count: 1 })
        .build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('test:room')
        .withComponent('bending-states:bending_over', {
          target_id: 'test:target',
        })
        .withComponent('personal-space-states:closeness', {
          partners: ['test:target'],
        })
        .asActor()
        .build();

      const target = new ModEntityBuilder('test:target')
        .withName('Bob')
        .atLocation('test:room')
        .withComponent('positioning:sitting_on', {
          furniture_id: 'test:chair',
          seat_index: 0,
        })
        .withComponent('personal-space-states:closeness', {
          partners: ['test:actor1'],
        })
        .asActor()
        .build();

      testFixture.reset([room, chair, actor, target]);

      const actions = testFixture.actions || [];
      const straddleFacing = actions.some(
        (a) => a.id === 'straddling:straddle_waist_facing'
      );
      const straddleAway = actions.some(
        (a) => a.id === 'straddling:straddle_waist_facing_away'
      );

      expect(straddleFacing).toBe(false);
      expect(straddleAway).toBe(false);
    });

    it('should prevent straddling when actor is lying down', async () => {
      const room = new ModEntityBuilder('test:room').asRoom('Bedroom').build();

      const bed = new ModEntityBuilder('test:bed')
        .withName('Bed')
        .atLocation('test:room')
        .build();

      const chair = new ModEntityBuilder('test:chair')
        .withName('Chair')
        .atLocation('test:room')
        .withComponent('furniture:seating', { seat_count: 1 })
        .build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('test:room')
        .withComponent('positioning:lying_down', {
          surface_id: 'test:bed',
        })
        .withComponent('personal-space-states:closeness', {
          partners: ['test:target'],
        })
        .asActor()
        .build();

      const target = new ModEntityBuilder('test:target')
        .withName('Bob')
        .atLocation('test:room')
        .withComponent('positioning:sitting_on', {
          furniture_id: 'test:chair',
          seat_index: 0,
        })
        .withComponent('personal-space-states:closeness', {
          partners: ['test:actor1'],
        })
        .asActor()
        .build();

      testFixture.reset([room, bed, chair, actor, target]);

      const actions = testFixture.actions || [];
      const straddleFacing = actions.some(
        (a) => a.id === 'straddling:straddle_waist_facing'
      );
      const straddleAway = actions.some(
        (a) => a.id === 'straddling:straddle_waist_facing_away'
      );

      expect(straddleFacing).toBe(false);
      expect(straddleAway).toBe(false);
    });

    it('should prevent sitting down when actor is straddling', async () => {
      const room = new ModEntityBuilder('test:room').asRoom('Bedroom').build();

      const chair1 = new ModEntityBuilder('test:chair1')
        .withName('Chair 1')
        .atLocation('test:room')
        .withComponent('furniture:seating', { seat_count: 1 })
        .build();

      const chair2 = new ModEntityBuilder('test:chair2')
        .withName('Chair 2')
        .atLocation('test:room')
        .withComponent('furniture:seating', { seat_count: 1 })
        .build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('test:room')
        .withComponent('positioning:straddling_waist', {
          target_id: 'test:target',
          facing_away: false,
        })
        .asActor()
        .build();

      const target = new ModEntityBuilder('test:target')
        .withName('Bob')
        .atLocation('test:room')
        .withComponent('positioning:sitting_on', {
          furniture_id: 'test:chair1',
          seat_index: 0,
        })
        .asActor()
        .build();

      testFixture.reset([room, chair1, chair2, actor, target]);

      const actions = testFixture.actions || [];
      const sitActions = actions.filter((a) => a.id === 'positioning:sit_down');

      expect(sitActions).toHaveLength(0);
    });

    it('should prevent kneeling when actor is straddling', async () => {
      const room = new ModEntityBuilder('test:room').asRoom('Bedroom').build();

      const chair = new ModEntityBuilder('test:chair')
        .withName('Chair')
        .atLocation('test:room')
        .withComponent('furniture:seating', { seat_count: 1 })
        .build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('test:room')
        .withComponent('positioning:straddling_waist', {
          target_id: 'test:target',
          facing_away: false,
        })
        .withComponent('personal-space-states:closeness', {
          partners: ['test:target', 'test:other'],
        })
        .asActor()
        .build();

      const target = new ModEntityBuilder('test:target')
        .withName('Bob')
        .atLocation('test:room')
        .withComponent('positioning:sitting_on', {
          furniture_id: 'test:chair',
          seat_index: 0,
        })
        .asActor()
        .build();

      const other = new ModEntityBuilder('test:other')
        .withName('Charlie')
        .atLocation('test:room')
        .withComponent('personal-space-states:closeness', {
          partners: ['test:actor1'],
        })
        .asActor()
        .build();

      testFixture.reset([room, chair, actor, target, other]);

      const actions = testFixture.actions || [];
      const kneelActions = actions.some(
        (a) => a.id === 'deference:kneel_before'
      );

      expect(kneelActions).toBe(false);
    });

    it('should prevent bending over when actor is straddling', async () => {
      const room = new ModEntityBuilder('test:room').asRoom('Bedroom').build();

      const chair = new ModEntityBuilder('test:chair')
        .withName('Chair')
        .atLocation('test:room')
        .withComponent('furniture:seating', { seat_count: 1 })
        .build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('test:room')
        .withComponent('positioning:straddling_waist', {
          target_id: 'test:target',
          facing_away: false,
        })
        .withComponent('personal-space-states:closeness', {
          partners: ['test:target'],
        })
        .asActor()
        .build();

      const target = new ModEntityBuilder('test:target')
        .withName('Bob')
        .atLocation('test:room')
        .withComponent('positioning:sitting_on', {
          furniture_id: 'test:chair',
          seat_index: 0,
        })
        .withComponent('personal-space-states:closeness', {
          partners: ['test:actor1'],
        })
        .asActor()
        .build();

      testFixture.reset([room, chair, actor, target]);

      const actions = testFixture.actions || [];
      const bendActions = actions.some((a) => a.id === 'bending:bend_over');

      expect(bendActions).toBe(false);
    });
  });

  describe('Cannot straddle scenarios', () => {
    it('should prevent straddling target who is not sitting', async () => {
      const room = new ModEntityBuilder('test:room').asRoom('Bedroom').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('test:room')
        .withComponent('personal-space-states:closeness', {
          partners: ['test:target'],
        })
        .asActor()
        .build();

      const target = new ModEntityBuilder('test:target')
        .withName('Bob')
        .atLocation('test:room')
        .withComponent('personal-space-states:closeness', {
          partners: ['test:actor1'],
        })
        .asActor()
        .build();

      testFixture.reset([room, actor, target]);

      const actions = testFixture.actions || [];
      const straddleFacing = actions.some(
        (a) => a.id === 'straddling:straddle_waist_facing'
      );
      const straddleAway = actions.some(
        (a) => a.id === 'straddling:straddle_waist_facing_away'
      );

      expect(straddleFacing).toBe(false);
      expect(straddleAway).toBe(false);
    });

    it('should prevent straddling without closeness', async () => {
      const room = new ModEntityBuilder('test:room').asRoom('Bedroom').build();

      const chair = new ModEntityBuilder('test:chair')
        .withName('Chair')
        .atLocation('test:room')
        .withComponent('furniture:seating', { seat_count: 1 })
        .build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('test:room')
        .asActor()
        .build();

      const target = new ModEntityBuilder('test:target')
        .withName('Bob')
        .atLocation('test:room')
        .withComponent('positioning:sitting_on', {
          furniture_id: 'test:chair',
          seat_index: 0,
        })
        .asActor()
        .build();

      testFixture.reset([room, chair, actor, target]);

      const actions = testFixture.actions || [];
      const straddleFacing = actions.some(
        (a) => a.id === 'straddling:straddle_waist_facing'
      );
      const straddleAway = actions.some(
        (a) => a.id === 'straddling:straddle_waist_facing_away'
      );

      expect(straddleFacing).toBe(false);
      expect(straddleAway).toBe(false);
    });

    it('should prevent straddling multiple actors simultaneously', async () => {
      const room = new ModEntityBuilder('test:room').asRoom('Bedroom').build();

      const chair1 = new ModEntityBuilder('test:chair1')
        .withName('Chair 1')
        .atLocation('test:room')
        .withComponent('furniture:seating', { seat_count: 1 })
        .build();

      const chair2 = new ModEntityBuilder('test:chair2')
        .withName('Chair 2')
        .atLocation('test:room')
        .withComponent('furniture:seating', { seat_count: 1 })
        .build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('test:room')
        .withComponent('positioning:straddling_waist', {
          target_id: 'test:target1',
          facing_away: false,
        })
        .withComponent('personal-space-states:closeness', {
          partners: ['test:target1', 'test:target2'],
        })
        .asActor()
        .build();

      const target1 = new ModEntityBuilder('test:target1')
        .withName('Bob')
        .atLocation('test:room')
        .withComponent('positioning:sitting_on', {
          furniture_id: 'test:chair1',
          seat_index: 0,
        })
        .asActor()
        .build();

      const target2 = new ModEntityBuilder('test:target2')
        .withName('Charlie')
        .atLocation('test:room')
        .withComponent('positioning:sitting_on', {
          furniture_id: 'test:chair2',
          seat_index: 0,
        })
        .withComponent('personal-space-states:closeness', {
          partners: ['test:actor1'],
        })
        .asActor()
        .build();

      testFixture.reset([room, chair1, chair2, actor, target1, target2]);

      const actions = testFixture.actions || [];
      const straddleFacing = actions.some(
        (a) => a.id === 'straddling:straddle_waist_facing'
      );
      const straddleAway = actions.some(
        (a) => a.id === 'straddling:straddle_waist_facing_away'
      );

      expect(straddleFacing).toBe(false);
      expect(straddleAway).toBe(false);
    });
  });
});
