/**
 * @file Integration tests verifying forbidden states for the positioning:sit_down action.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';

describe('positioning:sit_down action forbidden state enforcement', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('positioning', 'sit_down');
  });

  afterEach(() => {
    testFixture?.cleanup();
  });

  it('rejects sitting down while being hugged', async () => {
    const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

    const chair = new ModEntityBuilder('chair1')
      .withName('Comfy Chair')
      .atLocation('room1')
      .withComponent('positioning:allows_sitting', { spots: [{ occupied: false }] })
      .build();

    const actor = new ModEntityBuilder('actor1')
      .withName('Alice')
      .atLocation('room1')
      .asActor()
      .withComponent('positioning:being_hugged', {
        hugging_entity_id: 'hugger1',
      })
      .build();

    const hugger = new ModEntityBuilder('hugger1')
      .withName('Bob')
      .atLocation('room1')
      .asActor()
      .build();

    testFixture.reset([room, actor, hugger, chair]);

    await expect(
      testFixture.executeAction(actor.id, chair.id)
    ).rejects.toThrow(/forbidden component.*positioning:being_hugged/i);
  });
});
