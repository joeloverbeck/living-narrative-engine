/**
 * Integration tests that reproduce the EventBus recursion warnings
 * Related to "Recursion depth warning" for core:component_added events during anatomy generation
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import EventBus from '../../../src/events/eventBus.js';

describe('EventBus - Recursion Warnings Integration', () => {
  let testBed;
  let eventBus;

  beforeEach(() => {
    testBed = createTestBed();
    
    // Spy on console.warn to capture EventBus warnings
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Create EventBus with logger only (maxRecursionDepth configured via setBatchMode)
    eventBus = new EventBus({
      logger: testBed.createMockLogger(),
    });
  });

  afterEach(() => {
    if (eventBus) {
      eventBus.destroy?.();
    }
    // Restore console.warn
    console.warn.mockRestore?.();
    testBed.cleanup();
  });

  it('should reproduce "Recursion depth warning - 50% of limit reached" for component_added events', () => {
    // Arrange
    const mockLogger = testBed.createMockLogger();
    eventBus = new EventBus({
      logger: mockLogger,
    });

    let recursionDepth = 0;

    // Set up event handler that triggers recursive component additions
    // This simulates the anatomy generation workflow that causes the recursion
    eventBus.subscribe('core:component_added', () => {
      recursionDepth++;
      
      // Simulate the pattern from anatomyGenerationWorkflow.js that causes recursion:
      // component_added → entity_created → anatomy_generation → more component_added events
      if (recursionDepth < 51) { // Stop after reaching 50% of 100
        eventBus.dispatch('core:component_added', {
          entityId: `test_entity_${recursionDepth}`,
          componentId: 'core:anatomy_slot',
          componentData: { slotType: 'test' },
          context: 'game-initialization', // Same batch mode context as in logs
        });
      }
    });

    // Act - Enable batch mode and trigger the recursive scenario
    eventBus.setBatchMode(true, { 
      context: 'game-initialization',
      maxRecursionDepth: 15 // This gets overridden to 100 for component_added in game-initialization
    });
    
    eventBus.dispatch('core:component_added', {
      entityId: 'initial_entity',
      componentId: 'core:anatomy_slot',
      componentData: { slotType: 'initial' },
      context: 'game-initialization',
    });

    // Assert - Should have logged the 50% warning (50/100)
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('EventBus: Recursion depth warning - 50% of limit reached for event "core:component_added" (50/100) (batch mode: game-initialization)')
    );
  });

  it('should reproduce "Recursion depth warning - 75% of limit reached" for component_added events', () => {
    // Arrange
    const mockLogger = testBed.createMockLogger();
    eventBus = new EventBus({
      logger: mockLogger,
    });

    let recursionDepth = 0;

    // Set up event handler for deeper recursion
    eventBus.subscribe('core:component_added', () => {
      recursionDepth++;
      
      // Go deeper to trigger 75% warning (75/100)
      if (recursionDepth < 76) {
        eventBus.dispatch('core:component_added', {
          entityId: `test_entity_${recursionDepth}`,
          componentId: 'core:anatomy_slot',
          componentData: { slotType: 'test' },
          context: 'game-initialization',
        });
      }
    });

    // Act
    eventBus.setBatchMode(true, { 
      context: 'game-initialization',
      maxRecursionDepth: 15 // This gets overridden to 100 for component_added in game-initialization
    });
    
    eventBus.dispatch('core:component_added', {
      entityId: 'initial_entity',
      componentId: 'core:anatomy_slot',
      componentData: { slotType: 'initial' },
      context: 'game-initialization',
    });

    // Assert - Should have both 50% and 75% warnings
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('EventBus: Recursion depth warning - 50% of limit reached')
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('EventBus: Recursion depth warning - 75% of limit reached for event "core:component_added" (75/100) (batch mode: game-initialization)')
    );
  });

  it('should reproduce "Recursion depth warning - 90% of limit reached" for component_added events', () => {
    // Arrange
    const mockLogger = testBed.createMockLogger();
    eventBus = new EventBus({
      logger: mockLogger,
    });

    let recursionDepth = 0;

    // Set up event handler for maximum safe recursion
    eventBus.subscribe('core:component_added', () => {
      recursionDepth++;
      
      // Go to 90% warning level (90/100)
      if (recursionDepth < 91) {
        eventBus.dispatch('core:component_added', {
          entityId: `test_entity_${recursionDepth}`,
          componentId: 'core:anatomy_slot',
          componentData: { slotType: 'test' },
          context: 'game-initialization',
        });
      }
    });

    // Act
    eventBus.setBatchMode(true, { 
      context: 'game-initialization',
      maxRecursionDepth: 15 // This gets overridden to 100 for component_added in game-initialization
    });
    
    eventBus.dispatch('core:component_added', {
      entityId: 'initial_entity',
      componentId: 'core:anatomy_slot',
      componentData: { slotType: 'initial' },
      context: 'game-initialization',
    });

    // Assert - Should have all three warnings
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('EventBus: Recursion depth warning - 50% of limit reached')
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('EventBus: Recursion depth warning - 75% of limit reached')
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('EventBus: Recursion depth warning - 90% of limit reached for event "core:component_added" (90/100) (batch mode: game-initialization)')
    );
  });

  it('should reproduce the exact recursion pattern from anatomy generation workflow', () => {
    // Arrange
    const mockLogger = testBed.createMockLogger();
    eventBus = new EventBus({
      logger: mockLogger,
    });

    // Simulate the exact call pattern from the logs:
    // entity_created → anatomy_generation → createBlueprintSlotEntities → component_added → entity_created...
    let entityCount = 0;

    eventBus.subscribe('core:entity_created', (event) => {
      if (entityCount < 51) { // Increased to trigger 50% warning at depth 50
        // Simulate anatomy generation adding components
        eventBus.dispatch('core:component_added', {
          entityId: event.payload.entityId,
          componentId: 'core:anatomy_slot',
          componentData: { slotType: 'generated' },
          context: 'game-initialization',
        });
      }
    });

    eventBus.subscribe('core:component_added', () => {
      if (entityCount < 51) { // Increased to trigger warnings
        entityCount++;
        // Simulate creation of blueprint slot entities which triggers more entity_created events
        eventBus.dispatch('core:entity_created', {
          entityId: `blueprint_slot_entity_${entityCount}`,
          blueprintId: 'core:anatomy_slot_entity',
          context: 'game-initialization',
        });
      }
    });

    // Act - Enable batch mode and start the cascade
    eventBus.setBatchMode(true, { 
      context: 'game-initialization',
      maxRecursionDepth: 15 // This gets overridden to 100 for component_added in game-initialization
    });
    
    eventBus.dispatch('core:entity_created', {
      entityId: 'initial_actor',
      blueprintId: 'core:actor',
      context: 'game-initialization',
    });

    // Assert - Should reproduce the recursion warnings seen in the logs
    const warnCalls = console.warn.mock.calls.filter(
      ([msg]) => msg && msg.includes('Recursion depth warning') && msg.includes('core:component_added')
    );
    
    expect(warnCalls.length).toBeGreaterThan(0);
    expect(warnCalls.some(([msg]) => msg.includes('50% of limit reached'))).toBe(true);
  });

  it('should reproduce batch mode timeout warning', async () => {
    // Arrange
    const mockLogger = testBed.createMockLogger();
    eventBus = new EventBus({
      logger: mockLogger,
    });

    // Act - Enable batch mode and let it timeout
    eventBus.setBatchMode(true, { 
      context: 'game-initialization',
      timeoutMs: 100
    });
    
    // Don't dispatch any completion event, let it timeout
    await new Promise(resolve => setTimeout(resolve, 150)); // Wait longer than timeout
    
    // Assert - Should have logged the timeout debug message
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('EventBus: Auto-disabling batch mode after 100ms timeout for context: game-initialization')
    );
  });
});