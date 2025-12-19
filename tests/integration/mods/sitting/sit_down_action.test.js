/**
 * @file Integration tests verifying forbidden states for the sitting:sit_down action.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';

describe('sitting:sit_down action forbidden state enforcement', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('sitting', 'sit_down');
  });

  afterEach(() => {
    testFixture?.cleanup();
  });

  it('rejects sitting down while being hugged', async () => {
    const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

    const chair = new ModEntityBuilder('chair1')
      .withName('Comfy Chair')
      .atLocation('room1')
      .withComponent('sitting:allows_sitting', {
        spots: [{ occupied: false }],
      })
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

    await expect(testFixture.executeAction(actor.id, chair.id)).rejects.toThrow(
      /forbidden component.*positioning:being_hugged/i
    );
  });

  it('rejects sitting down while hugging someone else', async () => {
    const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

    const chair = new ModEntityBuilder('chair1')
      .withName('Comfy Chair')
      .atLocation('room1')
      .withComponent('sitting:allows_sitting', {
        spots: [{ occupied: false }],
      })
      .build();

    const actor = new ModEntityBuilder('actor1')
      .withName('Alice')
      .atLocation('room1')
      .asActor()
      .withComponent('positioning:hugging', {
        embraced_entity_id: 'huggee1',
        initiated: true,
      })
      .build();

    const huggee = new ModEntityBuilder('huggee1')
      .withName('Charlie')
      .atLocation('room1')
      .asActor()
      .build();

    testFixture.reset([room, actor, huggee, chair]);

    await expect(testFixture.executeAction(actor.id, chair.id)).rejects.toThrow(
      /forbidden component.*positioning:hugging/i
    );
  });
});
