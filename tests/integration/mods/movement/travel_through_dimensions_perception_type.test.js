/**
 * @file Integration test for travel_through_dimensions perceptionType validation
 * @description Verifies that dimensional travel uses valid perceptionType values per schema
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';

describe('travel_through_dimensions - perceptionType Validation', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'movement',
      'travel_through_dimensions'
    );
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('should successfully execute travel action without perceptionType validation errors', async () => {
    const scenario = createDimensionalScenario();
    fixture.reset(scenario.entities);

    // This test will fail if the rule uses invalid perceptionType values
    // (e.g., "dimensional_departure" or "dimensional_arrival")
    // because the ValidatedEventDispatcher will reject the event payload
    // with a validation error like:
    // "[/perceptionType]: must be equal to one of the allowed values"
    await expect(
      fixture.executeAction(scenario.observerId, scenario.dimensionId)
    ).resolves.not.toThrow();
  });
});

/**
 * Helper: Create basic dimensional travel scenario
 *
 * @returns {object} Scenario with locations and actors
 */
function createDimensionalScenario() {
  const perimeterId = 'perc-perimeter';
  const dimensionId = 'perc-dimension';
  const blockerId = 'perc-blocker';
  const observerId = 'perc-observer';

  const perimeter = new ModEntityBuilder(perimeterId)
    .withName('perimeter of rip in reality')
    .withComponent('core:location', {})
    .withComponent('locations:exits', [
      {
        direction: 'through the dimensional rift',
        target: dimensionId,
        blocker: blockerId,
      },
    ])
    .build();

  const dimension = new ModEntityBuilder(dimensionId)
    .withName('eldritch dimension')
    .withComponent('core:location', {})
    .build();

  const blocker = new ModEntityBuilder(blockerId)
    .withName('dimensional rift')
    .withComponent('blockers:is_dimensional_portal', {})
    .build();

  const observer = new ModEntityBuilder(observerId)
    .withName('Test Observer')
    .asActor()
    .atLocation(perimeterId)
    .withComponent('movement:can_travel_through_dimensions', {})
    .build();

  return {
    perimeterId,
    dimensionId,
    blockerId,
    observerId,
    entities: [perimeter, dimension, blocker, observer],
  };
}
