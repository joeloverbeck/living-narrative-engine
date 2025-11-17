/**
 * @file Integration test to reproduce event dispatch errors
 * @description Tests that reproduce the specific errors seen in error_logs2.txt
 * when initializing the Core Motivations Generator page
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CoreMotivationsGeneratorControllerTestBed } from '../../common/coreMotivationsGeneratorControllerTestBed.js';

describe('CoreMotivationsGenerator - Event Dispatch Errors', () => {
  let testBed;
  let mockEventBus;
  let mockCharacterBuilderService;
  let eventDispatchCalls;
  let consoleErrors;
  let consoleWarnings;

  beforeEach(async () => {
    testBed = new CoreMotivationsGeneratorControllerTestBed();

    // Set up basic DOM elements that the controller expects
    document.body.innerHTML = `
      <div id="direction-selector"></div>
      <div id="no-directions-message" style="display: none;"></div>
      <div id="motivations-container"></div>
      <div id="empty-state"></div>
      <div id="loading-indicator" style="display: none;"></div>
      <div id="generate-btn"></div>
      <div id="clear-all-btn"></div>
      <div id="export-btn"></div>
      <div id="motivation-count">0 motivations generated</div>
    `;

    // Capture console output
    consoleErrors = [];
    consoleWarnings = [];
    jest.spyOn(console, 'error').mockImplementation((message) => {
      consoleErrors.push(message);
    });
    jest.spyOn(console, 'warn').mockImplementation((message) => {
      consoleWarnings.push(message);
    });

    // Track all event dispatch calls
    eventDispatchCalls = [];
    mockEventBus = testBed.mockEventBus;

    // Override the dispatch to track calls - fix the parameter signature
    const originalDispatch = mockEventBus.dispatch;
    mockEventBus.dispatch = jest
      .fn()
      .mockImplementation((eventName, payload, options) => {
        // Track the call with correct parameters
        eventDispatchCalls.push({
          type: eventName,
          payload: payload,
        });

        // Simulate validation - events should have proper namespace format
        if (typeof eventName !== 'string' || !eventName.includes(':')) {
          // This simulates validation errors for improperly formatted event names
          console.warn(
            `GameDataRepository: getEventDefinition called with invalid ID: ${eventName}`
          );
          console.warn(
            `VED: EventDefinition not found for '${eventName}'. Cannot validate payload. Proceeding with dispatch.`
          );
          console.error(`EventBus: Invalid event name provided. ${eventName}`);
        }

        return originalDispatch(eventName, payload, options);
      });

    // Use testBed's mock service with specific test data
    mockCharacterBuilderService = testBed.mockCharacterBuilderService;
    mockCharacterBuilderService.getAllCharacterConcepts.mockResolvedValue([
      { id: 'da045af5-1f3d-4277-99d0-12226db836c7', concept: 'Test concept' },
    ]);
    mockCharacterBuilderService.getThematicDirectionsByConceptId.mockResolvedValue(
      []
    );
    mockCharacterBuilderService.hasClichesForDirection.mockResolvedValue(false);
  });

  afterEach(() => {
    testBed.cleanup();
    jest.restoreAllMocks();
  });

  it('should verify that event dispatch errors from error_logs2.txt are now fixed', async () => {
    // Given: Create controller with mocked dependencies (similar to actual initialization)
    const controller = testBed.createController({
      eventBus: mockEventBus,
      characterBuilderService: mockCharacterBuilderService,
    });

    // When: Initialize the controller (this should trigger the problematic event dispatch)
    await controller.initialize();

    // Then: Verify the errors are now FIXED - no more console errors
    expect(consoleWarnings).toEqual([]);
    expect(consoleErrors).toEqual([]);

    // Verify the event dispatch is now using correct format
    // Now we dispatch 2 events: one for no eligible directions and one for initialization
    expect(eventDispatchCalls).toHaveLength(2);

    // First event should be for no eligible directions
    expect(eventDispatchCalls[0]).toEqual({
      type: 'core:no_eligible_directions',
      payload: {},
    });

    // Second event should be the initialization event
    expect(eventDispatchCalls[1]).toEqual({
      type: 'core:core_motivations_ui_initialized', // Fixed format
      payload: {
        conceptId: '', // Controller initializes as empty string for event validation
        eligibleDirectionsCount: 0,
      },
    });
  });

  it('should verify that all event types now use correct format', async () => {
    // Given: Mock more complete scenario to trigger other event dispatches
    mockCharacterBuilderService.getThematicDirectionsByConceptId.mockResolvedValue(
      [{ id: 'direction-1', title: 'Test Direction', theme: 'Test Theme' }]
    );
    mockCharacterBuilderService.hasClichesForDirection.mockResolvedValue(true);
    mockCharacterBuilderService.getCoreMotivationsByDirectionId.mockResolvedValue(
      []
    );

    const controller = testBed.createController({
      eventBus: mockEventBus,
      characterBuilderService: mockCharacterBuilderService,
    });

    // When: Initialize and trigger a direction selection (more events)
    await controller.initialize();

    // Wait for any async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    // The selectDirection method is private, so we'll need to trigger it indirectly
    // by simulating a DOM click event on a direction element

    // First, let's setup a direction element in the DOM like the controller would create
    const directionSelector = document.getElementById('direction-selector');
    const directionDiv = document.createElement('div');
    directionDiv.className = 'direction-item';
    directionDiv.dataset.directionId = 'direction-1';
    directionSelector.appendChild(directionDiv);

    // Now simulate clicking it (this will trigger the selectDirection method)
    directionDiv.click();

    // Wait for the async direction selection to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Then: Verify ALL event types now use correct format
    const allEventTypes = eventDispatchCalls.map((call) => call.type);

    // All event types should now be correctly formatted
    allEventTypes.forEach((eventType) => {
      expect(eventType).toMatch(/^core:[a-z_]+$/); // Correct format: core:lowercase_with_underscores
      expect(eventType).not.toMatch(/[A-Z]/); // No uppercase letters
      expect(eventType).toContain(':'); // Has namespace
    });

    // Should have multiple events with correct format
    expect(allEventTypes.length).toBeGreaterThan(0);

    // Should specifically include the fixed UI initialized event
    expect(allEventTypes).toContain('core:core_motivations_ui_initialized');
  });

  it('should demonstrate what the correct event format should be', () => {
    // This test documents the expected format for future reference
    const incorrectEventTypes = [
      'CORE_MOTIVATIONS_UI_INITIALIZED',
      'CORE_MOTIVATIONS_DIRECTION_SELECTED',
      'CORE_MOTIVATIONS_RETRIEVED',
      'CORE_MOTIVATIONS_GENERATION_STARTED',
      'CORE_MOTIVATIONS_GENERATION_COMPLETED',
      'CORE_MOTIVATIONS_GENERATION_FAILED',
      'CORE_MOTIVATIONS_DELETED',
    ];

    const correctEventTypes = [
      'core:core_motivations_ui_initialized',
      'core:core_motivations_direction_selected',
      'core:core_motivations_retrieved',
      'core:core_motivations_generation_started',
      'core:core_motivations_generation_completed',
      'core:core_motivations_generation_failed',
      'core:core_motivations_deleted',
    ];

    // Verify the transformation is correct
    incorrectEventTypes.forEach((incorrect, index) => {
      const correct = correctEventTypes[index];

      // Should have namespace prefix
      expect(correct).toMatch(/^core:/);

      // Should be lowercase with underscores
      expect(correct).toMatch(/^[a-z:_]+$/);

      // Should not be the same as incorrect version
      expect(incorrect).not.toBe(correct);
    });
  });
});
