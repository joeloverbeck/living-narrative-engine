/**
 * @file Integration tests verifying forbidden states for the personal-space:step_back action.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';

describe('personal-space:step_back action forbidden state enforcement', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('personal-space', 'step_back');
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
      .withComponent('personal-space-states:closeness', { partners: ['partner1'] })
      .withComponent('hugging-states:being_hugged', {
        hugging_entity_id: 'partner1',
      })
      .build();

    const partner = new ModEntityBuilder('partner1')
      .withName('Bob')
      .atLocation('room1')
      .asActor()
      .withComponent('personal-space-states:closeness', { partners: ['actor1'] })
      .build();

    testFixture.reset([room, actor, partner]);

    await expect(testFixture.executeAction(actor.id, null)).rejects.toThrow(
      /forbidden component.*hugging-states:being_hugged/i
    );
  });

  it('rejects stepping back while hugging someone else', async () => {
    const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

    const actor = new ModEntityBuilder('actor1')
      .withName('Alice')
      .atLocation('room1')
      .asActor()
      .withComponent('personal-space-states:closeness', { partners: ['partner1'] })
      .withComponent('hugging-states:hugging', {
        embraced_entity_id: 'partner1',
        initiated: true,
      })
      .build();

    const partner = new ModEntityBuilder('partner1')
      .withName('Bob')
      .atLocation('room1')
      .asActor()
      .withComponent('personal-space-states:closeness', { partners: ['actor1'] })
      .build();

    testFixture.reset([room, actor, partner]);

    await expect(testFixture.executeAction(actor.id, null)).rejects.toThrow(
      /forbidden component.*hugging-states:hugging/i
    );
  });
});
