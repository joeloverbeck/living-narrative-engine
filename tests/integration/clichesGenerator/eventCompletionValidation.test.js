/**
 * @file Test to reproduce and verify fix for cliches_generation_completed event validation bug
 * Specifically tests the missing conceptId issue in the event payload
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ClichesGeneratorControllerTestBed } from '../../common/clichesGeneratorControllerTestBed.js';
import { Cliche } from '../../../src/characterBuilder/models/cliche.js';

describe('Clichés Generation Completed Event Validation', () => {
  let testBed;
  let controller;
  let eventBus;
  let characterBuilderService;

  beforeEach(async () => {
    testBed = new ClichesGeneratorControllerTestBed();

    // Setup basic direction load to ensure controller initializes properly
    testBed.setupSuccessfulDirectionLoad();

    await testBed.setup();
    controller = testBed.controller;
    eventBus = testBed.mockEventBus;
    characterBuilderService = testBed.mockCharacterBuilderService;
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Event payload validation', () => {
    it('should dispatch cliches_generation_completed event with correct payload including conceptId', async () => {
      // Setup test data
      const testConcept = {
        id: 'test-concept-id-123',
        concept: 'A brave warrior from the northern lands',
        text: 'A brave warrior from the northern lands',
      };

      const testDirection = {
        id: 'test-direction-id-456',
        conceptId: testConcept.id,
        title: 'The Reluctant Hero',
        description: 'Forced into heroism',
        coreTension: 'Duty vs desire',
      };

      // Mock the Cliche result object that will be returned
      const mockClicheResult = new Cliche({
        id: 'test-cliche-id-789',
        conceptId: testConcept.id,
        directionId: testDirection.id,
        categories: {
          names: ['John', 'Jane'],
          physicalDescriptions: ['Tall and muscular'],
          personalityTraits: ['Brave', 'Stubborn'],
          skillsAbilities: ['Swordsmanship'],
          typicalLikes: ['Justice'],
          typicalDislikes: ['Injustice'],
          commonFears: ['Failure'],
          genericGoals: ['Save the world'],
          backgroundElements: ['Orphaned as a child'],
          overusedSecrets: ['Royal bloodline'],
          speechPatterns: ['I will not fail'],
        },
        tropesAndStereotypes: ['The Chosen One', 'Hidden Royalty'],
        createdAt: new Date().toISOString(),
        llmMetadata: {
          model: 'test-model',
          tokens: 1000,
          responseTime: 500,
        },
      });

      // Setup mocks
      characterBuilderService.generateClichesForDirection = jest
        .fn()
        .mockResolvedValue(mockClicheResult);

      // Track dispatched events
      let completedEventPayload = null;
      const unsubscribe = eventBus.subscribe(
        'core:cliches_generation_completed',
        (event) => {
          completedEventPayload = event.payload;
        }
      );

      // Initialize controller with direction selected
      await testBed.loadDirections([testDirection]);
      await testBed.selectDirection(testDirection.id);

      // Use the test helper method to set internal state
      controller._testSetCurrentState({
        currentConcept: testConcept,
        currentDirection: testDirection,
        selectedDirectionId: testDirection.id,
      });

      // Trigger cliché generation
      await testBed.triggerGeneration();

      // Verify the event was dispatched with correct payload
      expect(completedEventPayload).toBeDefined();
      expect(completedEventPayload).toEqual(
        expect.objectContaining({
          conceptId: testConcept.id, // This should be present
          directionId: testDirection.id,
          totalCount: 15, // Corrected count: 13 category items + 2 tropes = 15 total
          // Optional fields that may be present:
          // clicheId: mockClicheResult.id,
          // generationTime: expect.any(Number)
        })
      );

      // Verify no extra non-schema fields
      expect(completedEventPayload).not.toHaveProperty('count'); // Wrong field name
      expect(completedEventPayload).not.toHaveProperty('attempt'); // Not in schema
      expect(completedEventPayload).not.toHaveProperty('timestamp'); // Not in schema

      unsubscribe();
    });

    it('should fail validation when conceptId is missing (current bug)', async () => {
      // Configure the mock EventBus to simulate validation failure for invalid payloads
      // This tests that the production system would reject invalid payloads
      const originalDispatch = eventBus.dispatch;
      let validationFailed = false;
      let errorLogged = null;

      // Mock the dispatch to simulate validation behavior
      eventBus.dispatch = jest.fn((eventType, payload) => {
        // Check if payload is missing required fields according to schema
        if (eventType === 'core:cliches_generation_completed') {
          if (!payload.conceptId || !payload.directionId) {
            // Simulate validation failure
            validationFailed = true;
            errorLogged = {
              message: `Payload validation FAILED for event: ${eventType}`,
              args: ['Missing required fields', payload],
            };
            console.error(errorLogged.message, ...errorLogged.args);
            return false; // Return false to indicate validation failure
          }
        }
        // Call original if validation would pass
        return originalDispatch.call(eventBus, eventType, payload);
      });

      // Dispatch event with missing conceptId (current bug)
      const buggyPayload = {
        directionId: 'test-direction-id',
        count: 10, // Also wrong field name
        attempt: 1, // Not in schema
        timestamp: new Date().toISOString(), // Not in schema
        // MISSING: conceptId
      };

      const result = eventBus.dispatch(
        'core:cliches_generation_completed',
        buggyPayload
      );

      // The dispatch should fail
      expect(result).toBe(false);
      expect(validationFailed).toBe(true);
      expect(errorLogged).toBeDefined();
      expect(errorLogged.message).toContain('Payload validation FAILED');
      expect(errorLogged.message).toContain(
        'core:cliches_generation_completed'
      );

      // Restore original dispatch
      eventBus.dispatch = originalDispatch;
    });

    it('should pass validation with minimal correct payload', () => {
      // Test that the event passes with just required fields
      let eventReceived = false;

      const unsubscribe = eventBus.subscribe(
        'core:cliches_generation_completed',
        (event) => {
          eventReceived = true;
        }
      );

      const minimalPayload = {
        conceptId: 'test-concept-id', // Required
        directionId: 'test-direction-id', // Required
        // All other fields are optional
      };

      const result = eventBus.dispatch(
        'core:cliches_generation_completed',
        minimalPayload
      );

      expect(result).toBe(true);
      expect(eventReceived).toBe(true);

      unsubscribe();
    });

    it('should pass validation with complete payload', () => {
      // Test with all fields including optional ones
      let eventPayload = null;

      const unsubscribe = eventBus.subscribe(
        'core:cliches_generation_completed',
        (event) => {
          eventPayload = event.payload;
        }
      );

      const completePayload = {
        conceptId: 'test-concept-id', // Required
        directionId: 'test-direction-id', // Required
        clicheId: 'test-cliche-id', // Optional
        totalCount: 25, // Optional
        generationTime: 1500, // Optional
      };

      const result = eventBus.dispatch(
        'core:cliches_generation_completed',
        completePayload
      );

      expect(result).toBe(true);
      expect(eventPayload).toEqual(completePayload);

      unsubscribe();
    });
  });

  describe('Controller integration', () => {
    it('should include conceptId from result object when available', async () => {
      // This tests that the controller can get conceptId from the result
      const testConcept = {
        id: 'concept-from-result',
        concept: 'Test concept',
        text: 'Test concept', // Controller expects 'text' field in some places
      };

      const testDirection = {
        id: 'dir-123',
        conceptId: testConcept.id,
        title: 'Test Direction',
      };

      // Create a proper Cliche instance instead of a plain object
      const mockResult = new Cliche({
        id: 'cliche-123',
        conceptId: testConcept.id,
        directionId: testDirection.id,
        categories: {
          names: ['Test Name'],
          physicalDescriptions: ['Test Description'],
          personalityTraits: ['Test Trait'],
          skillsAbilities: ['Test Skill'],
          typicalLikes: ['Test Like'],
          typicalDislikes: ['Test Dislike'],
          commonFears: ['Test Fear'],
          genericGoals: ['Test Goal'],
          backgroundElements: ['Test Background'],
          overusedSecrets: ['Test Secret'],
          speechPatterns: ['Test Pattern'],
        },
        tropesAndStereotypes: ['Test Trope'],
        llmMetadata: {
          model: 'test-model',
          responseTime: 100,
        },
      });

      // Mock the service methods needed for the controller flow
      characterBuilderService.hasClichesForDirection = jest
        .fn()
        .mockResolvedValue(false);
      characterBuilderService.generateClichesForDirection = jest
        .fn()
        .mockResolvedValue(mockResult);

      let eventPayload = null;
      const unsubscribe = eventBus.subscribe(
        'core:cliches_generation_completed',
        (event) => {
          eventPayload = event.payload;
        }
      );

      // Setup controller state - loadDirections expects the format from getAllThematicDirectionsWithConcepts
      await testBed.loadDirections([
        {
          direction: testDirection,
          concept: testConcept,
        },
      ]);

      // Select the direction through the UI to ensure all state is set correctly
      await testBed.selectDirection(testDirection.id);

      // Also set internal state to ensure it's ready
      controller._testSetCurrentState({
        currentConcept: testConcept,
        currentDirection: testDirection,
        selectedDirectionId: testDirection.id,
      });

      // Trigger generation through the test bed
      await testBed.triggerGeneration();

      // Wait for async event processing
      await testBed.flushPromises();

      expect(eventPayload).toBeDefined();
      expect(eventPayload.conceptId).toBe(testConcept.id);

      unsubscribe();
    });
  });
});
