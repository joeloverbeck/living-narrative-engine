/**
 * @file Integration test for visual properties flow from action definitions to UI rendering
 * Tests that visual properties defined in action.json files are properly passed through
 * the discovery pipeline and made available to the UI renderer.
 */

import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { ActionIndexingService } from '../../../src/turns/services/actionIndexingService.js';

describe('Visual Properties Flow Integration', () => {
  let logger;
  let indexingService;

  beforeEach(() => {
    // Setup logger
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Setup indexing service
    indexingService = new ActionIndexingService({ logger });
  });

  it('preserves visual properties from discovery through indexing', () => {
    // Step 1: Simulate discovered actions with visual properties
    const discoveredActions = [
      {
        id: 'combat:attack',
        name: 'Attack',
        command: 'attack goblin',
        description: 'Attack the goblin',
        params: { targetId: 'goblin1' },
        visual: {
          backgroundColor: '#cc0000',
          textColor: '#ffffff',
          hoverBackgroundColor: '#990000',
          hoverTextColor: '#ffcccc',
        },
      },
      {
        id: 'core:wait',
        name: 'Wait',
        command: 'wait',
        description: 'Wait for a turn',
        params: {},
        visual: {
          backgroundColor: '#546e7a',
          textColor: '#ffffff',
        },
      },
      {
        id: 'core:talk',
        name: 'Talk',
        command: 'talk to merchant',
        description: 'Talk to the merchant',
        params: { targetId: 'merchant1' },
        // No visual property - should default to null
      },
    ];

    // Step 2: Index the actions
    const indexedActions = indexingService.indexActions(
      'player1',
      discoveredActions
    );

    // Verify indexing preserves visual properties
    expect(indexedActions).toHaveLength(3);
    expect(indexedActions[0].visual).toEqual({
      backgroundColor: '#cc0000',
      textColor: '#ffffff',
      hoverBackgroundColor: '#990000',
      hoverTextColor: '#ffcccc',
    });
    expect(indexedActions[1].visual).toEqual({
      backgroundColor: '#546e7a',
      textColor: '#ffffff',
    });
    expect(indexedActions[2].visual).toBeNull();

    // The indexed actions now have visual properties that can be consumed by the UI
    // The ActionButtonsRenderer._renderListItem() method will use these visual properties
    // to apply styles to the buttons when rendering
  });

  it('handles duplicate actions with visual properties correctly', () => {
    const discoveredActions = [
      {
        id: 'combat:attack',
        name: 'Attack',
        command: 'attack goblin',
        description: 'Attack the goblin',
        params: { targetId: 'goblin1' },
        visual: {
          backgroundColor: '#cc0000',
          textColor: '#ffffff',
        },
      },
      {
        id: 'combat:attack',
        name: 'Attack',
        command: 'attack goblin',
        description: 'Attack the goblin (duplicate)',
        params: { targetId: 'goblin1' },
        visual: {
          backgroundColor: '#dd0000', // Different color (should keep first)
          textColor: '#eeeeee',
        },
      },
      {
        id: 'combat:defend',
        name: 'Defend',
        command: 'defend',
        description: 'Defend yourself',
        params: {},
        visual: {
          backgroundColor: '#0000cc',
          textColor: '#ffffff',
        },
      },
    ];

    const indexedActions = indexingService.indexActions(
      'player1',
      discoveredActions
    );

    // Should deduplicate and keep first visual properties
    expect(indexedActions).toHaveLength(2);
    expect(indexedActions[0].visual).toEqual({
      backgroundColor: '#cc0000',
      textColor: '#ffffff',
    });
    expect(indexedActions[1].visual).toEqual({
      backgroundColor: '#0000cc',
      textColor: '#ffffff',
    });
  });
});
