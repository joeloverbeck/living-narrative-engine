/**
 * @file Integration test for sit_down_at_distance action with secondary target resolution
 * Tests that the action correctly references event.payload.secondaryId (not secondaryTargetId)
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import handleSitDownAtDistanceRule from '../../../../data/mods/personal-space/rules/handle_sit_down_at_distance.rule.json' assert { type: 'json' };
import eventIsActionSitDownAtDistance from '../../../../data/mods/personal-space/conditions/event-is-action-sit-down-at-distance.condition.json' assert { type: 'json' };

describe('sit_down_at_distance - Secondary Target Resolution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'personal-space',
      'personal-space:sit_down_at_distance',
      handleSitDownAtDistanceRule,
      eventIsActionSitDownAtDistance
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should correctly query secondary target using event.payload.secondaryId', async () => {
    // Arrange: Create test scenario with furniture, actor, and occupant
    const room = new ModEntityBuilder('test:bar').asRoom('Test Bar').build();

    const actor = new ModEntityBuilder('test:actor')
      .withName('Actor')
      .atLocation('test:bar')
      .asActor()
      .withComponent('core:movement', { locked: false })
      .build();

    const occupant = new ModEntityBuilder('test:occupant')
      .withName('Occupant')
      .atLocation('test:bar')
      .asActor()
      .withComponent('core:movement', { locked: false })
      .withComponent('positioning:sitting_on', {
        furniture_id: 'test:bar_stools',
        spot_index: 1,
      })
      .build();

    const furniture = new ModEntityBuilder('test:bar_stools')
      .withName('Bar Stools')
      .atLocation('test:bar')
      .withComponent('sitting:allows_sitting', {
        spots: [null, 'test:occupant', null, null],
        requires_kneeling: false,
      })
      .build();

    testFixture.reset([room, actor, occupant, furniture]);

    // Track warnings to detect the bug
    const warnings = [];
    const originalConsoleWarn = console.warn;
    console.warn = (...args) => {
      warnings.push(args.join(' '));
    };

    try {
      // Act: Execute sit_down_at_distance action
      await testFixture.executeAction('test:actor', 'test:bar_stools', {
        additionalPayload: {
          secondaryId: 'test:occupant',
        },
      });

      // Assert: No warnings about missing entity_ref
      const entityRefWarnings = warnings.filter(
        (w) => w.includes('entity_ref') && w.includes('required')
      );
      expect(entityRefWarnings).toHaveLength(0);

      // Assert: Action should succeed
      const turnEndedEvent = testFixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);

      // Assert: Actor should be sitting at correct spot (index 3, two seats from occupant)
      const actorSittingData = testFixture.entityManager.getComponentData(
        'test:actor',
        'positioning:sitting_on'
      );
      expect(actorSittingData).toBeDefined();
      expect(actorSittingData.furniture_id).toBe('test:bar_stools');
      expect(actorSittingData.spot_index).toBe(3); // Occupant at 1 + 2 = 3

      // Assert: Furniture should have actor at spot 3
      const furnitureData = testFixture.entityManager.getComponentData(
        'test:bar_stools',
        'sitting:allows_sitting'
      );
      expect(furnitureData.spots[3]).toBe('test:actor');
    } finally {
      console.warn = originalConsoleWarn;
    }
  });

  it('should fail gracefully when secondary target is missing sitting_on component', async () => {
    // Arrange: Create scenario where secondary target is NOT sitting
    const room = new ModEntityBuilder('test:bar').asRoom('Test Bar').build();

    const actor = new ModEntityBuilder('test:actor')
      .withName('Actor')
      .atLocation('test:bar')
      .asActor()
      .withComponent('core:movement', { locked: false })
      .build();

    const nonSittingActor = new ModEntityBuilder('test:standing_actor')
      .withName('Standing Actor')
      .atLocation('test:bar')
      .asActor()
      .withComponent('core:movement', { locked: false })
      .build();

    const furniture = new ModEntityBuilder('test:bar_stools')
      .withName('Bar Stools')
      .atLocation('test:bar')
      .withComponent('sitting:allows_sitting', {
        spots: [null, null, null, null],
        requires_kneeling: false,
      })
      .build();

    testFixture.reset([room, actor, nonSittingActor, furniture]);

    const warnings = [];
    const originalConsoleWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));

    try {
      // Act: Try to sit at distance from someone who isn't sitting
      await testFixture.executeAction('test:actor', 'test:bar_stools', {
        additionalPayload: {
          secondaryId: 'test:standing_actor',
        },
      });

      // Assert: No entity_ref warnings (field name is correct)
      const entityRefWarnings = warnings.filter(
        (w) => w.includes('entity_ref') && w.includes('required')
      );
      expect(entityRefWarnings).toHaveLength(0);

      // Assert: Actor should NOT have sitting_on component (action didn't execute)
      const actorSittingData = testFixture.entityManager.getComponentData(
        'test:actor',
        'positioning:sitting_on'
      );
      expect(actorSittingData).toBeNull();
    } finally {
      console.warn = originalConsoleWarn;
    }
  });

  it('should successfully calculate correct spot with one-seat buffer', async () => {
    // Arrange: Complex scenario testing the distance calculation logic
    const room = new ModEntityBuilder('test:bar').asRoom('Test Bar').build();

    const actor = new ModEntityBuilder('test:actor')
      .withName('Actor')
      .atLocation('test:bar')
      .asActor()
      .withComponent('core:movement', { locked: false })
      .build();

    const occupant = new ModEntityBuilder('test:occupant')
      .withName('Occupant')
      .atLocation('test:bar')
      .asActor()
      .withComponent('core:movement', { locked: false })
      .withComponent('positioning:sitting_on', {
        furniture_id: 'test:long_bar',
        spot_index: 2,
      })
      .build();

    // Create long bar with many seats
    const spots = new Array(10).fill(null);
    spots[2] = 'test:occupant'; // Occupant at index 2

    const furniture = new ModEntityBuilder('test:long_bar')
      .withName('Long Bar')
      .atLocation('test:bar')
      .withComponent('sitting:allows_sitting', {
        spots,
        requires_kneeling: false,
      })
      .build();

    testFixture.reset([room, actor, occupant, furniture]);

    // Act
    await testFixture.executeAction('test:actor', 'test:long_bar', {
      additionalPayload: {
        secondaryId: 'test:occupant',
      },
    });

    // Assert: Actor should be at spot 4 (occupant at 2 + buffer at 3 + actor at 4)
    const actorSittingData = testFixture.entityManager.getComponentData(
      'test:actor',
      'positioning:sitting_on'
    );
    expect(actorSittingData).toBeDefined();
    expect(actorSittingData.spot_index).toBe(4);

    // Assert: Buffer spot (3) should remain empty
    const furnitureData = testFixture.entityManager.getComponentData(
      'test:long_bar',
      'sitting:allows_sitting'
    );
    expect(furnitureData.spots[3]).toBeNull();
    expect(furnitureData.spots[4]).toBe('test:actor');
  });
});
