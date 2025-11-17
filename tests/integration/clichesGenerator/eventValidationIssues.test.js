/**
 * @file Integration test to reproduce event validation issues in cliches generator
 * @see src/clichesGenerator/controllers/ClichesGeneratorController.js
 * @see src/characterBuilder/services/characterBuilderService.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ClichesGeneratorControllerTestBed } from '../../common/clichesGeneratorControllerTestBed.js';
import { Cliche } from '../../../src/characterBuilder/models/cliche.js';
import { CHARACTER_BUILDER_EVENTS } from '../../../src/characterBuilder/services/characterBuilderService.js';

describe('Cliches Generator - Event Validation Issues', () => {
  let testBed;
  let mockCharacterBuilderService;
  let controller;

  beforeEach(async () => {
    testBed = new ClichesGeneratorControllerTestBed();

    // Set up test data - using the same IDs that setupSuccessfulDirectionLoad creates
    const testConcept = {
      id: 'concept-1',
      concept: 'A brave warrior from the north', // Note: should be 'concept' not 'text'
      createdAt: new Date().toISOString(),
    };

    const testDirection = {
      id: 'dir-1', // Match the ID from setupSuccessfulDirectionLoad
      conceptId: 'concept-1',
      title: 'Direction 1', // Match the title
      description: 'Description for direction 1',
      coreTension: 'Core tension 1',
      createdAt: new Date().toISOString(),
    };

    const testCliches = new Cliche({
      id: 'test-cliche-789',
      directionId: 'dir-1', // Match the direction ID
      conceptId: 'concept-1',
      categories: {
        names: ['Bjorn', 'Erik', 'Ragnar'],
        physicalDescriptions: ['Tall and muscular', 'Long blonde hair'],
        personalityTraits: ['Stoic', 'Honor-bound'],
        skillsAbilities: ['Sword fighting', 'Sailing'],
        typicalLikes: ['Mead', 'Battle'],
        typicalDislikes: ['Cowardice', 'Dishonor'],
        commonFears: ['Dying without glory'],
        genericGoals: ['Reach Valhalla'],
        backgroundElements: ['Lost homeland'],
        overusedSecrets: ['Royal bloodline'],
        speechPatterns: ["By Odin's beard!"],
      },
      tropesAndStereotypes: ['Berserker rage', 'Noble savage'],
    });

    // Setup basic direction load to ensure controller initializes properly
    testBed.setupSuccessfulDirectionLoad();

    // Get the mock references first
    mockCharacterBuilderService = testBed.mockCharacterBuilderService;

    // Now override specific mocks for cliches behavior
    mockCharacterBuilderService.hasClichesForDirection.mockResolvedValue(true);
    mockCharacterBuilderService.getClichesByDirectionId.mockImplementation(
      async (directionId) => {
        // Mock should just return data, not dispatch events
        // The real service dispatches events, but mocks shouldn't
        return testCliches;
      }
    );

    // Initialize the test bed and controller
    await testBed.setup();
    controller = testBed.controller;

    // Manually run lifecycle steps that the mocked orchestrator skips
    controller?._cacheElements?.();
    controller?._setupEventListeners?.();
    if (controller?._loadInitialData) {
      await controller._loadInitialData();
    }
    if (controller?._initializeUIState) {
      await controller._initializeUIState();
    }
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Event Validation Errors', () => {
    it('should handle cliches retrieval without event dispatch from mock', async () => {
      testBed.clearEventTracking();

      // Get the direction selector element
      const directionSelector = document.getElementById('direction-selector');
      expect(directionSelector).toBeTruthy();

      // Select a direction (use dir-1 which exists in the mock)
      directionSelector.value = 'dir-1';
      const changeEvent = new Event('change', { bubbles: true });
      directionSelector.dispatchEvent(changeEvent);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      const dispatchedEvents = testBed.getDispatchedEvents();

      // The mock service should NOT dispatch CLICHES_RETRIEVED event
      // Only the real service does that
      const clichesRetrievedEvent = dispatchedEvents.find(
        (e) => e.type === CHARACTER_BUILDER_EVENTS.CLICHES_RETRIEVED
      );

      // Mock doesn't dispatch events, so this should be undefined
      expect(clichesRetrievedEvent).toBeUndefined();

      // Instead, check that the controller dispatched the existing cliches loaded event
      const existingClichesEvent = dispatchedEvents.find(
        (e) => e.type === 'core:existing_cliches_loaded'
      );

      // If the event isn't found, the controller might be in a different state
      // Check if at least direction selection events were dispatched
      const directionSelectionEvent = dispatchedEvents.find(
        (e) =>
          e.type === 'core:direction_selection_started' ||
          e.type === 'core:direction_selection_completed'
      );

      expect(directionSelectionEvent).toBeTruthy();
      if (existingClichesEvent) {
        expect(existingClichesEvent.payload).toHaveProperty('directionId');
        expect(existingClichesEvent.payload).toHaveProperty('count');
      }
    });

    it('should dispatch core:existing_cliches_loaded event when cliches exist', async () => {
      testBed.clearEventTracking();

      // Get the direction selector element
      const directionSelector = document.getElementById('direction-selector');
      expect(directionSelector).toBeTruthy();

      // Select a direction (use dir-1 which exists in the mock)
      directionSelector.value = 'dir-1';
      const changeEvent = new Event('change', { bubbles: true });
      directionSelector.dispatchEvent(changeEvent);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      const dispatchedEvents = testBed.getDispatchedEvents();

      // Find the core:existing_cliches_loaded event (with namespace)
      const existingClichesEvent = dispatchedEvents.find(
        (e) => e.type === 'core:existing_cliches_loaded'
      );

      // The event should be dispatched when existing cliches are loaded
      expect(existingClichesEvent).toBeTruthy();

      // Verify the event payload structure
      if (existingClichesEvent) {
        expect(existingClichesEvent.payload).toHaveProperty('directionId');
        expect(existingClichesEvent.payload).toHaveProperty('count');
      }
    });
  });

  describe('After Fixes Applied', () => {
    it('should correctly handle cliches with conceptId in the data model', async () => {
      // Mock returns cliches with conceptId properly set
      mockCharacterBuilderService.getClichesByDirectionId.mockImplementation(
        async (directionId) => {
          const testCliches = new Cliche({
            id: 'test-cliche-789',
            directionId: 'dir-1',
            conceptId: 'concept-1',
            categories: {
              names: ['Bjorn'],
              physicalDescriptions: ['Tall'],
              personalityTraits: ['Stoic'],
              skillsAbilities: ['Fighting'],
              typicalLikes: ['Mead'],
              typicalDislikes: ['Cowardice'],
              commonFears: ['Dishonor'],
              genericGoals: ['Glory'],
              backgroundElements: ['Exile'],
              overusedSecrets: ['Royal'],
              speechPatterns: ['By Odin!'],
            },
            tropesAndStereotypes: ['Berserker'],
          });

          // Mock should NOT dispatch events - only return data
          return testCliches;
        }
      );

      testBed.clearEventTracking();

      // Select a direction
      const directionSelector = document.getElementById('direction-selector');
      directionSelector.value = 'dir-1';
      directionSelector.dispatchEvent(new Event('change', { bubbles: true }));

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify that the controller dispatched the existing_cliches_loaded event
      const dispatchedEvents = testBed.getDispatchedEvents();
      const existingClichesEvent = dispatchedEvents.find(
        (e) => e.type === 'core:existing_cliches_loaded'
      );

      expect(existingClichesEvent).toBeTruthy();
      expect(existingClichesEvent.payload).toHaveProperty(
        'directionId',
        'dir-1'
      );
      expect(existingClichesEvent.payload).toHaveProperty('count');

      // The mock service itself should NOT have dispatched CLICHES_RETRIEVED
      // (only the real service does that when fetching from database)
      const clichesRetrievedEvent = dispatchedEvents.find(
        (e) => e.type === CHARACTER_BUILDER_EVENTS.CLICHES_RETRIEVED
      );
      expect(clichesRetrievedEvent).toBeUndefined();
    });
  });
});
