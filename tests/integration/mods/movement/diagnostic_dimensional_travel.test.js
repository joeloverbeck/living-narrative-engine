/**
 * @file Diagnostic test for dimensional travel action discovery
 * @description Minimal test to diagnose why travel_through_dimensions isn't being discovered
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import '../../../common/mods/domainMatchers.js';

describe('Diagnostic: Dimensional Travel Action Discovery', () => {
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

  it('should discover actions for an actor with required component', async () => {
    // Create a simple perimeter location
    const perimeterId = fixture.createEntity({
      id: 'diag-perimeter',
      name: 'perimeter location',
      components: [
        {
          componentId: 'core:location',
          data: {},
        },
      ],
    });

    // Create a destination
    const dimensionId = fixture.createEntity({
      id: 'diag-dimension',
      name: 'destination dimension',
      components: [
        {
          componentId: 'core:location',
          data: {},
        },
      ],
    });

    // Create blocker with dimensional portal component
    const blockerId = fixture.createEntity({
      id: 'diag-blocker',
      name: 'dimensional rift',
      components: [
        {
          componentId: 'movement:is_dimensional_portal',
          data: {},
        },
      ],
    });

    // Add exit with blocker
    await fixture.modifyComponent(perimeterId, 'movement:exits', [
      {
        direction: 'through the rift',
        target: dimensionId,
        blocker: blockerId,
      },
    ]);

    // Create observer with required component
    const observerId = fixture.createEntity({
      id: 'diag-observer',
      name: 'Test Observer',
      components: [
        {
          componentId: 'core:actor',
          data: {},
        },
        {
          componentId: 'core:position',
          data: { locationId: perimeterId },
        },
        {
          componentId: 'movement:can_travel_through_dimensions',
          data: {},
        },
      ],
    });

    console.log('=== DIAGNOSTIC INFO ===');
    console.log('Observer ID:', observerId);
    console.log('Perimeter ID:', perimeterId);
    console.log('Dimension ID:', dimensionId);
    console.log('Blocker ID:', blockerId);

    // Check if entities exist
    const observer = fixture.entityManager.getEntityInstance(observerId);
    console.log('Observer entity:', observer);
    console.log('Observer components:', observer.getAllComponents());

    const perimeter = fixture.entityManager.getEntityInstance(perimeterId);
    console.log('Perimeter entity:', perimeter);
    console.log('Perimeter components:', perimeter.getAllComponents());

    // Check if action index has actions
    console.log('Action Index candidates:', fixture.testEnv?.actionIndex);

    // Try to get all candidates from the actor
    if (fixture.testEnv?.actionIndex) {
      const actorEntity = { id: observerId };

      // Check what components the entity manager thinks the actor has
      const allComponents =
        fixture.entityManager.getAllComponentTypesForEntity(observerId);
      console.log('EntityManager reports actor has components:', allComponents);

      const candidates =
        fixture.testEnv.actionIndex.getCandidateActions(actorEntity);
      console.log('Candidates for observer:', candidates);
      console.log('Candidates length:', candidates.length);
    }

    // Enable diagnostics
    fixture.enableScopeTracing();

    const actions = await fixture.discoverActions(observerId);

    console.log('Discovered actions:', actions);
    console.log('Scope trace:', fixture.getScopeTrace());

    // This should discover the dimensional travel action
    expect(actions).toBeDefined();
    expect(Array.isArray(actions)).toBe(true);

    // Log all available action IDs
    const actionIds = actions.map((a) => a.id);
    console.log('Action IDs:', actionIds);

    // Check if our action is there
    expect(actions).toContainAction('movement:travel_through_dimensions');
  });
});
