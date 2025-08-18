/**
 * @file Test to reproduce event validation bug in cliches generator
 * Tests demonstrate the event payload mismatch issue
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

describe('Clichés Event Validation Bug', () => {
  let testBed;
  let eventBus;
  let mockLogger;

  beforeEach(async () => {
    testBed = new IntegrationTestBed();
    await testBed.initialize();
    eventBus = testBed.container.resolve(tokens.IValidatedEventDispatcher);
    mockLogger = testBed.mockLogger || console;
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('cliches_generation_started event', () => {
    it('should fail validation with incorrect payload (as in ClichesGeneratorController)', async () => {
      let eventDispatched = false;
      let validationError = null;

      // Subscribe to the event
      eventBus.subscribe('core:cliches_generation_started', () => {
        eventDispatched = true;
      });

      // Try to dispatch with the payload structure used in ClichesGeneratorController
      // This is incorrect - it's missing conceptId and has full objects instead
      const incorrectPayload = {
        directionId: 'test-direction-id',
        concept: {
          // WRONG: Should be conceptId string, not concept object
          id: 'test-concept-id',
          text: 'Test concept text',
        },
        direction: {
          // Extra field not in schema
          id: 'test-direction-id',
          title: 'Test Direction',
        },
        attempt: 1, // Extra field not in schema
      };

      const result = await eventBus.dispatch(
        'core:cliches_generation_started',
        incorrectPayload
      );

      // The dispatch should fail
      expect(result).toBe(false);
      expect(eventDispatched).toBe(false);

      // Check that validation error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Payload validation FAILED'),
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              message: "must have required property 'conceptId'",
            }),
          ]),
        })
      );
    });

    it('should pass validation with correct payload structure', async () => {
      let eventReceived = null;

      eventBus.subscribe('core:cliches_generation_started', (event) => {
        eventReceived = event;
      });

      // Correct payload per event schema
      const correctPayload = {
        conceptId: 'test-concept-id', // Required
        directionId: 'test-direction-id', // Required
        directionTitle: 'Test Direction', // Optional
      };

      const result = await eventBus.dispatch(
        'core:cliches_generation_started',
        correctPayload
      );

      expect(result).toBe(true);
      expect(eventReceived).toBeDefined();
      expect(eventReceived.payload).toEqual(correctPayload);
    });
  });

  describe('cliches_storage_failed event', () => {
    it('should fail validation with incorrect payload', async () => {
      let eventDispatched = false;

      eventBus.subscribe('core:cliches_storage_failed', () => {
        eventDispatched = true;
      });

      // This is what's being dispatched in characterBuilderService
      const incorrectPayload = {
        error: 'Test error message',
        directionId: 'test-direction-id',
        // Missing conceptId which is required
      };

      const result = await eventBus.dispatch(
        'core:cliches_storage_failed',
        incorrectPayload
      );

      expect(result).toBe(false);
      expect(eventDispatched).toBe(false);
    });
  });

  describe('cliches_generation_failed event', () => {
    it('should fail validation with incorrect payload', async () => {
      let eventDispatched = false;

      eventBus.subscribe('core:cliches_generation_failed', () => {
        eventDispatched = true;
      });

      // Payload from ClichesGeneratorController
      const incorrectPayload = {
        directionId: 'test-direction-id',
        error: 'Test error',
        attempt: 1,
        timestamp: new Date().toISOString(),
        // Missing conceptId
      };

      const result = await eventBus.dispatch(
        'core:cliches_generation_failed',
        incorrectPayload
      );

      expect(result).toBe(false);
      expect(eventDispatched).toBe(false);
    });
  });
});
