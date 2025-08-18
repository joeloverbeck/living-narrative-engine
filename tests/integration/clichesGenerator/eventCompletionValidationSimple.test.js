/**
 * @file Simple test to reproduce the cliches_generation_completed event validation bug
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

describe('Clichés Generation Completed Event - Validation Bug', () => {
  let testBed;
  let eventBus;

  beforeEach(async () => {
    testBed = new IntegrationTestBed();
    await testBed.initialize();
    eventBus = testBed.container.resolve(tokens.IValidatedEventDispatcher);
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should fail validation when conceptId is missing (current bug reproduction)', async () => {
    // This is the exact payload being dispatched in ClichesGeneratorController line 699-704
    const buggyPayload = {
      directionId: 'test-direction-id',
      count: 10, // Wrong field name - should be 'totalCount'
      attempt: 1, // Not in schema
      timestamp: new Date().toISOString(), // Not in schema
      // MISSING: conceptId (required field)
    };

    // Try to dispatch the event
    const result = await eventBus.dispatch(
      'core:cliches_generation_completed',
      buggyPayload
    );

    // The dispatch should fail due to validation error
    expect(result).toBe(false);
  });

  it('should pass validation with correct payload structure', async () => {
    // Correct payload per the event schema
    const correctPayload = {
      conceptId: 'test-concept-id', // Required
      directionId: 'test-direction-id', // Required
      totalCount: 10, // Optional (correct field name)
      clicheId: 'test-cliche-id', // Optional
      generationTime: 500, // Optional
    };

    // Try to dispatch the event
    const result = await eventBus.dispatch(
      'core:cliches_generation_completed',
      correctPayload
    );

    // The dispatch should succeed
    expect(result).toBe(true);
  });

  it('should pass validation with minimal required fields', async () => {
    // Minimal payload with just required fields
    const minimalPayload = {
      conceptId: 'test-concept-id', // Required
      directionId: 'test-direction-id', // Required
    };

    // Try to dispatch the event
    const result = await eventBus.dispatch(
      'core:cliches_generation_completed',
      minimalPayload
    );

    // The dispatch should succeed
    expect(result).toBe(true);
  });
});
