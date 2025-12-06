/**
 * @file Tests for DamageEventMessageRenderer handling of composed damage events.
 *
 * Note: The original merging logic was removed when the architecture changed
 * from handling individual low-level events (damage_applied, dismembered, etc.)
 * to handling pre-composed `core:perceptible_event` events with
 * `perceptionType: 'damage_received'`.
 *
 * These tests now verify correct handling of composed damage events.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DamageEventMessageRenderer } from '../../../src/domUI/damageEventMessageRenderer.js';

describe('DamageEventMessageRenderer Composed Event Handling', () => {
  // eslint-disable-next-line no-unused-vars
  let renderer;
  let mockLogger;
  let mockDispatcher;
  let mockDomElementFactory;
  let mockListContainer;
  let eventListeners;

  beforeEach(() => {
    eventListeners = {};

    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn((eventName, handler) => {
        eventListeners[eventName] = handler;
        return () => {
          delete eventListeners[eventName];
        };
      }),
    };

    mockListContainer = {
      appendChild: jest.fn(),
      classList: { add: jest.fn() },
    };

    mockDomElementFactory = {
      create: jest.fn(),
      li: jest.fn().mockReturnValue({
        classList: { add: jest.fn() },
        textContent: '',
      }),
    };

    const mockDocumentContext = {
      create: jest.fn(),
      query: jest.fn((selector) => {
        if (selector === '#message-list') return mockListContainer;
        if (selector === '#outputDiv') return {};
        return null;
      }),
    };

    renderer = new DamageEventMessageRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      safeEventDispatcher: mockDispatcher,
      domElementFactory: mockDomElementFactory,
    });
  });

  it('should render a composed damage event with effects included in the description', async () => {
    const handler = eventListeners['core:perceptible_event'];

    // Simulate a composed damage event that already includes dismemberment info
    handler({
      payload: {
        perceptionType: 'damage_received',
        descriptionText:
          'Hero takes 25 slashing damage to their arm. The arm is severed!',
        totalDamage: 25,
      },
    });

    await Promise.resolve();

    // Verify the composed message was rendered
    expect(mockDomElementFactory.li).toHaveBeenCalledTimes(1);
    const liElement = mockDomElementFactory.li.mock.results[0].value;
    expect(liElement.textContent).toBe(
      'Hero takes 25 slashing damage to their arm. The arm is severed!'
    );
  });

  it('should handle multiple composed damage events in sequence', async () => {
    const handler = eventListeners['core:perceptible_event'];

    // First damage event
    handler({
      payload: {
        perceptionType: 'damage_received',
        descriptionText: 'Hero takes 10 damage to their arm.',
        totalDamage: 10,
      },
    });

    // Second damage event (different part)
    handler({
      payload: {
        perceptionType: 'damage_received',
        descriptionText: 'Hero takes 15 damage to their leg.',
        totalDamage: 15,
      },
    });

    await Promise.resolve();

    // Both events should render separately since they're pre-composed
    expect(mockDomElementFactory.li).toHaveBeenCalledTimes(2);
  });

  it('should only render damage_received events, ignoring other perception types', async () => {
    const handler = eventListeners['core:perceptible_event'];

    // Non-damage perceptible event
    handler({
      payload: {
        perceptionType: 'speech',
        descriptionText: 'Someone speaks nearby.',
      },
    });

    // Damage perceptible event
    handler({
      payload: {
        perceptionType: 'damage_received',
        descriptionText: 'You are hit!',
        totalDamage: 5,
      },
    });

    await Promise.resolve();

    // Only the damage event should render
    expect(mockDomElementFactory.li).toHaveBeenCalledTimes(1);
    const liElement = mockDomElementFactory.li.mock.results[0].value;
    expect(liElement.textContent).toBe('You are hit!');
  });
});
