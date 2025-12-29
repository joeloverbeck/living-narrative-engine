/**
 * @file Integration tests for movement:go forbidden components.
 * @description Ensures the go action is blocked when the actor is sitting.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';

describe('movement:go forbidden components', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('movement', 'movement:go');
  });

  afterEach(() => {
    testFixture?.cleanup();
  });

  it('rejects the action when the actor is sitting', async () => {
    const origin = new ModEntityBuilder('test:origin').asRoom('Origin').build();
    const destination = new ModEntityBuilder('test:dest')
      .asRoom('Destination')
      .build();
    const actor = new ModEntityBuilder('test:actor')
      .withName('Ava')
      .asActor()
      .atLocation('test:origin')
      .build();

    actor.components['sitting-states:sitting_on'] = {
      furniture_id: 'test:bench',
      spot_index: 0,
    };

    testFixture.reset([origin, destination, actor]);

    await expect(
      testFixture.executeAction(actor.id, destination.id)
    ).rejects.toThrow(/forbidden component.*sitting-states:sitting_on/i);
  });
});
