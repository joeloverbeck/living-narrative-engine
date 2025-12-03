/**
 * @file Integration tests for positioning:crawl_to action with existing positioning features.
 * @description Tests full workflow integration and ensures no regressions with existing actions.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';

describe('positioning:crawl_to - Integration Tests', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:crawl_to',
      null,
      null,
      {
        supportingActions: [
          'positioning:kneel_before',
          'personal-space:get_close',
        ],
      }
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Full Workflow: Kneel Then Crawl', () => {
    it('should successfully complete kneel_before followed by crawl_to', async () => {
      const room = new ModEntityBuilder('throne_room')
        .asRoom('Throne Room')
        .build();

      const alice = new ModEntityBuilder('test:alice')
        .withName('Alice')
        .atLocation('throne_room')
        .asActor()
        .build();

      const bob = new ModEntityBuilder('test:bob')
        .withName('Bob')
        .atLocation('throne_room')
        .asActor()
        .build();

      // Alice is facing Bob (required for kneel_before)
      alice.components['core:facing'] = {
        facing: 'test:bob',
      };

      testFixture.reset([room, alice, bob]);

      // Step 1: Alice kneels before Bob
      await testFixture.executeActionManual(
        'test:alice',
        'positioning:kneel_before',
        'test:bob'
      );

      const aliceAfterKneel = testFixture.entityManager.getEntityInstance('test:alice');
      expect(
        aliceAfterKneel.components['positioning:kneeling_before']
      ).toBeDefined();
      expect(
        aliceAfterKneel.components['positioning:kneeling_before'].entityId
      ).toBe('test:bob');
      // Closeness was removed by kneel_before
      expect(
        aliceAfterKneel.components['positioning:closeness']
      ).toBeUndefined();

      // Step 2: Alice crawls to Bob
      await testFixture.executeAction('test:alice', 'test:bob');

      const aliceAfterCrawl = testFixture.entityManager.getEntityInstance('test:alice');
      const bobAfterCrawl = testFixture.entityManager.getEntityInstance('test:bob');

      // Both kneeling and closeness components present
      expect(
        aliceAfterCrawl.components['positioning:kneeling_before']
      ).toBeDefined();
      expect(aliceAfterCrawl.components['positioning:closeness']).toBeDefined();
      expect(
        aliceAfterCrawl.components['positioning:closeness'].partners
      ).toContain('test:bob');
      expect(bobAfterCrawl.components['positioning:closeness']).toBeDefined();
      expect(bobAfterCrawl.components['positioning:closeness'].partners).toContain(
        'test:alice'
      );
    });
  });

  describe('Existing Actions Unaffected', () => {
    it('should not interfere with existing get_close action', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const alice = new ModEntityBuilder('test:alice')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .build();

      const bob = new ModEntityBuilder('test:bob')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .build();

      testFixture.reset([room, alice, bob]);

      // Execute standard get_close action
      await testFixture.executeActionManual(
        'test:alice',
        'personal-space:get_close',
        'test:bob'
      );

      const aliceEntity = testFixture.entityManager.getEntityInstance('test:alice');
      const bobEntity = testFixture.entityManager.getEntityInstance('test:bob');

      expect(aliceEntity.components['positioning:closeness']).toBeDefined();
      expect(bobEntity.components['positioning:closeness']).toBeDefined();
      // No kneeling component added
      expect(
        aliceEntity.components['positioning:kneeling_before']
      ).toBeUndefined();
    });

    it('should not interfere with existing kneel_before action', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const alice = new ModEntityBuilder('test:alice')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .build();

      const bob = new ModEntityBuilder('test:bob')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .build();

      alice.components['core:facing'] = {
        facing: 'test:bob',
      };

      testFixture.reset([room, alice, bob]);

      // Execute standard kneel_before action
      await testFixture.executeActionManual(
        'test:alice',
        'positioning:kneel_before',
        'test:bob'
      );

      const aliceEntity = testFixture.entityManager.getEntityInstance('test:alice');

      expect(
        aliceEntity.components['positioning:kneeling_before']
      ).toBeDefined();
      expect(
        aliceEntity.components['positioning:kneeling_before'].entityId
      ).toBe('test:bob');
      // Closeness removed by kneel_before
      expect(
        aliceEntity.components['positioning:closeness']
      ).toBeUndefined();
    });
  });

  describe('Multi-Actor Independence', () => {
    it('should correctly isolate crawling actions between different actors', async () => {
      const room = new ModEntityBuilder('courtyard')
        .asRoom('Courtyard')
        .build();

      const alice = new ModEntityBuilder('test:alice')
        .withName('Alice')
        .atLocation('courtyard')
        .asActor()
        .build();

      const bob = new ModEntityBuilder('test:bob')
        .withName('Bob')
        .atLocation('courtyard')
        .asActor()
        .build();

      const carol = new ModEntityBuilder('test:carol')
        .withName('Carol')
        .atLocation('courtyard')
        .asActor()
        .build();

      const dave = new ModEntityBuilder('test:dave')
        .withName('Dave')
        .atLocation('courtyard')
        .asActor()
        .build();

      // Alice kneeling before Bob
      alice.components['positioning:kneeling_before'] = {
        entityId: 'test:bob',
      };

      // Carol kneeling before Dave
      carol.components['positioning:kneeling_before'] = {
        entityId: 'test:dave',
      };

      testFixture.reset([room, alice, bob, carol, dave]);

      // Alice crawls to Bob
      await testFixture.executeAction('test:alice', 'test:bob');

      // Verify Alice and Bob are now close
      const aliceEntity = testFixture.entityManager.getEntityInstance('test:alice');
      const bobEntity = testFixture.entityManager.getEntityInstance('test:bob');

      expect(aliceEntity.components['positioning:closeness']).toBeDefined();
      expect(bobEntity.components['positioning:closeness']).toBeDefined();

      // Verify Carol and Dave are NOT affected
      const carolEntity = testFixture.entityManager.getEntityInstance('test:carol');
      const daveEntity = testFixture.entityManager.getEntityInstance('test:dave');

      expect(carolEntity.components['positioning:closeness']).toBeUndefined();
      expect(daveEntity.components['positioning:closeness']).toBeUndefined();
    });
  });

  describe('Combined Forbidden Component Check', () => {
    it('should block action when actor has multiple forbidden components', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const alice = new ModEntityBuilder('test:alice')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .build();

      const bob = new ModEntityBuilder('test:bob')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .build();

      const chair = new ModEntityBuilder('test:chair')
        .withName('Chair')
        .atLocation('room1')
        .build();

      // Invalid state: kneeling, sitting, and being hugged
      alice.components['positioning:kneeling_before'] = {
        entityId: 'test:bob',
      };
      alice.components['positioning:sitting_on'] = {
        furniture_id: 'test:chair',
        spot_index: 0,
      };
      alice.components['positioning:being_hugged'] = {
        entityId: 'test:bob',
      };

      testFixture.reset([room, alice, bob, chair]);

      // Should throw validation error due to forbidden components
      await expect(
        testFixture.executeAction('test:alice', 'test:bob')
      ).rejects.toThrow(/forbidden component/);
    });

    it('should block action when any single forbidden component is present', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const alice = new ModEntityBuilder('test:alice')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .build();

      const bob = new ModEntityBuilder('test:bob')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .build();

      alice.components['positioning:kneeling_before'] = {
        entityId: 'test:bob',
      };

      const forbiddenComponents = [
        'positioning:sitting_on',
        'positioning:bending_over',
        'positioning:lying_down',
        'positioning:straddling_waist',
        'positioning:being_hugged',
        'positioning:hugging',
        'positioning:closeness',
      ];

      for (const componentId of forbiddenComponents) {
        // Add forbidden component
        alice.components[componentId] = {
          entityId: 'test:bob',
        };

        // Reset and test
        const currentTestFixture = await ModTestFixture.forAction(
          'positioning',
          'positioning:crawl_to'
        );
        currentTestFixture.reset([room, alice, bob]);

        await expect(
          currentTestFixture.executeAction('test:alice', 'test:bob')
        ).rejects.toThrow(/forbidden component/);

        // Clean up for next iteration
        currentTestFixture.cleanup();
        delete alice.components[componentId];
      }
    });
  });
});
