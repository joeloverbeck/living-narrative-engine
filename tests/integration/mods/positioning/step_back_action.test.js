/**
 * @file Integration tests verifying forbidden states for the positioning:step_back action.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';

describe('positioning:step_back action forbidden state enforcement', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('positioning', 'step_back');
  });

  afterEach(() => {
    testFixture?.cleanup();
  });

  it('rejects stepping back while being hugged', async () => {
    const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

    const actor = new ModEntityBuilder('actor1')
      .withName('Alice')
      .atLocation('room1')
      .asActor()
      .withComponent('positioning:closeness', { partners: ['partner1'] })
      .withComponent('positioning:being_hugged', {
        hugging_entity_id: 'partner1',
      })
      .build();

    const partner = new ModEntityBuilder('partner1')
      .withName('Bob')
      .atLocation('room1')
      .asActor()
      .withComponent('positioning:closeness', { partners: ['actor1'] })
      .build();

    testFixture.reset([room, actor, partner]);

    await expect(
      testFixture.executeAction(actor.id, null)
    ).rejects.toThrow(/forbidden component.*positioning:being_hugged/i);
  });
});
