/**
 * @file Integration tests for wield_threateningly event validation
 * Tests that all dispatched events have valid payloads
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';
import wieldThreateninglyRule from '../../../../data/mods/weapons/rules/handle_wield_threateningly.rule.json' assert { type: 'json' };
import eventIsActionWieldThreateningly from '../../../../data/mods/weapons/conditions/event-is-action-wield-threateningly.condition.json' assert { type: 'json' };

const ACTION_ID = 'weapons:wield_threateningly';

describe('wield_threateningly event validation', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'weapons',
      ACTION_ID,
      wieldThreateninglyRule,
      eventIsActionWieldThreateningly
    );
  });

  afterEach(() => {
    if (fixture) {
      fixture.cleanup();
    }
  });

  it('should dispatch valid core:perceptible_event with all required fields', async () => {
    const actor = new ModEntityBuilder('test-actor')
      .withName('Test Actor')
      .asActor()
      .withComponent('core:position', { locationId: 'test-location' })
      .withComponent('items:inventory', {
        items: ['revolver'],
        capacity: { maxWeight: 10, maxItems: 5 },
      })
      .build();

    const weapon = new ModEntityBuilder('revolver')
      .withName('Revolver')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('weapons:weapon', {})
      .build();

    fixture.reset([actor, weapon]);

    await fixture.executeAction('test-actor', 'revolver');

    const perceptibleEvent = fixture.events.find(
      (event) => event.eventType === 'core:perceptible_event'
    );

    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload).toMatchObject({
      eventName: 'core:perceptible_event',
      actorId: 'test-actor',
    });

    // Check all required fields are present
    expect(perceptibleEvent.payload).toHaveProperty('eventName');
    expect(perceptibleEvent.payload).toHaveProperty('locationId');
    expect(perceptibleEvent.payload).toHaveProperty('descriptionText');
    expect(perceptibleEvent.payload).toHaveProperty('timestamp');
    expect(perceptibleEvent.payload).toHaveProperty('perceptionType');
    expect(perceptibleEvent.payload).toHaveProperty('actorId');

    // Validate field types
    expect(typeof perceptibleEvent.payload.eventName).toBe('string');
    expect(typeof perceptibleEvent.payload.locationId).toBe('string');
    expect(typeof perceptibleEvent.payload.descriptionText).toBe('string');
    expect(typeof perceptibleEvent.payload.timestamp).toBe('string');
    expect(typeof perceptibleEvent.payload.perceptionType).toBe('string');
    expect(typeof perceptibleEvent.payload.actorId).toBe('string');

    // Validate timestamp is ISO 8601
    expect(() => new Date(perceptibleEvent.payload.timestamp)).not.toThrow();
    expect(new Date(perceptibleEvent.payload.timestamp).toISOString()).toBe(
      perceptibleEvent.payload.timestamp
    );

    // Validate descriptionText is not empty
    expect(perceptibleEvent.payload.descriptionText.length).toBeGreaterThan(0);
  });

  it('should dispatch valid core:display_successful_action_result with message', async () => {
    const actor = new ModEntityBuilder('test-actor')
      .withName('Test Actor')
      .asActor()
      .withComponent('core:position', { locationId: 'test-location' })
      .withComponent('items:inventory', {
        items: ['revolver'],
        capacity: { maxWeight: 10, maxItems: 5 },
      })
      .build();

    const weapon = new ModEntityBuilder('revolver')
      .withName('Revolver')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('weapons:weapon', {})
      .build();

    fixture.reset([actor, weapon]);

    await fixture.executeAction('test-actor', 'revolver');

    const displayEvent = fixture.events.find(
      (event) => event.eventType === 'core:display_successful_action_result'
    );

    expect(displayEvent).toBeDefined();
    expect(displayEvent.payload).toHaveProperty('message');
    expect(typeof displayEvent.payload.message).toBe('string');
    expect(displayEvent.payload.message.length).toBeGreaterThan(0);
  });

  it('should not dispatch events with validation errors', async () => {
    const actor = new ModEntityBuilder('test-actor')
      .withName('Test Actor')
      .asActor()
      .withComponent('core:position', { locationId: 'test-location' })
      .withComponent('items:inventory', {
        items: ['revolver'],
        capacity: { maxWeight: 10, maxItems: 5 },
      })
      .build();

    const weapon = new ModEntityBuilder('revolver')
      .withName('Revolver')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('weapons:weapon', {})
      .build();

    fixture.reset([actor, weapon]);

    // Capture validation errors
    const validationErrors = [];
    const originalError = console.error;
    console.error = (...args) => {
      const message = args.join(' ');
      if (message.includes('VED: Payload validation FAILED')) {
        validationErrors.push(message);
      }
      originalError(...args);
    };

    try {
      await fixture.executeAction('test-actor', 'revolver');

      // Verify no validation errors occurred
      expect(validationErrors).toHaveLength(0);
    } finally {
      console.error = originalError;
    }
  });

  it('should format message with substituted entity names', async () => {
    const actor = new ModEntityBuilder('john')
      .withName('John Smith')
      .asActor()
      .withComponent('core:position', { locationId: 'test-location' })
      .withComponent('items:inventory', {
        items: ['silver-revolver'],
        capacity: { maxWeight: 10, maxItems: 5 },
      })
      .build();

    const weapon = new ModEntityBuilder('silver-revolver')
      .withName('Silver Revolver')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('weapons:weapon', {})
      .build();

    fixture.reset([actor, weapon]);

    await fixture.executeAction('john', 'silver-revolver');

    const displayEvent = fixture.events.find(
      (event) => event.eventType === 'core:display_successful_action_result'
    );

    expect(displayEvent).toBeDefined();
    expect(displayEvent.payload.message).toContain('John Smith');
    expect(displayEvent.payload.message).toContain('Silver Revolver');

    const perceptibleEvent = fixture.events.find(
      (event) => event.eventType === 'core:perceptible_event'
    );

    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toContain('John Smith');
    expect(perceptibleEvent.payload.descriptionText).toContain(
      'Silver Revolver'
    );
  });
});
