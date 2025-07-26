/**
 * @file Unit test for schema registration in thematic direction app
 * Ensures event schemas are registered with correct IDs
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';
import { CHARACTER_BUILDER_EVENTS } from '../../../src/characterBuilder/services/characterBuilderService.js';

describe('Thematic Direction - Schema Registration', () => {
  let mockLogger;
  let schemaValidator;
  let addSchemaSpy;

  beforeEach(() => {
    mockLogger = createMockLogger();
    schemaValidator = new AjvSchemaValidator({ logger: mockLogger });

    // Spy on methods to verify correct usage
    addSchemaSpy = jest.spyOn(schemaValidator, 'addSchema');
  });

  it('should verify CHARACTER_BUILDER_EVENTS constants match expected schema IDs', () => {
    // The ValidatedEventDispatcher expects schema IDs to be {eventName}#payload
    // So if the event name is 'thematic:character_concept_created',
    // the schema ID should be 'thematic:character_concept_created#payload'

    expect(CHARACTER_BUILDER_EVENTS.CONCEPT_CREATED).toBe(
      'thematic:character_concept_created'
    );
    expect(CHARACTER_BUILDER_EVENTS.DIRECTIONS_GENERATED).toBe(
      'thematic:thematic_directions_generated'
    );

    // Verify the pattern works correctly
    const conceptSchemaId = `${CHARACTER_BUILDER_EVENTS.CONCEPT_CREATED}#payload`;
    expect(conceptSchemaId).toBe('thematic:character_concept_created#payload');

    const directionsSchemaId = `${CHARACTER_BUILDER_EVENTS.DIRECTIONS_GENERATED}#payload`;
    expect(directionsSchemaId).toBe(
      'thematic:thematic_directions_generated#payload'
    );
  });

  it('should simulate proper schema registration pattern', async () => {
    // This simulates what should happen in thematic-direction-main.js

    // Define the event schemas (matching the structure in thematic-direction-main.js)
    const characterConceptCreatedSchema = {
      description:
        'Defines the structure for the CHARACTER_CONCEPT_CREATED event payload.',
      type: 'object',
      required: ['conceptId', 'concept', 'autoSaved'],
      properties: {
        conceptId: {
          type: 'string',
          description: 'The unique ID of the created character concept.',
        },
        concept: {
          type: 'string',
          description: 'The character concept text (truncated for events).',
        },
        autoSaved: {
          type: 'boolean',
          description: 'Whether the concept was automatically saved.',
        },
      },
      additionalProperties: false,
    };

    const thematicDirectionsGeneratedSchema = {
      description:
        'Defines the structure for the THEMATIC_DIRECTIONS_GENERATED event payload.',
      type: 'object',
      required: ['conceptId', 'directionCount', 'autoSaved'],
      properties: {
        conceptId: {
          type: 'string',
          description: 'The unique ID of the character concept.',
        },
        directionCount: {
          type: 'integer',
          minimum: 0,
          description: 'The number of thematic directions generated.',
        },
        autoSaved: {
          type: 'boolean',
          description: 'Whether the directions were automatically saved.',
        },
      },
      additionalProperties: false,
    };

    // Register schemas with correct IDs
    await schemaValidator.addSchema(
      characterConceptCreatedSchema,
      'thematic:character_concept_created#payload'
    );

    await schemaValidator.addSchema(
      thematicDirectionsGeneratedSchema,
      'thematic:thematic_directions_generated#payload'
    );

    // Verify schemas were registered with correct IDs
    expect(addSchemaSpy).toHaveBeenCalledWith(
      characterConceptCreatedSchema,
      'thematic:character_concept_created#payload'
    );

    expect(addSchemaSpy).toHaveBeenCalledWith(
      thematicDirectionsGeneratedSchema,
      'thematic:thematic_directions_generated#payload'
    );

    // Verify schemas are loaded and can be validated
    expect(
      schemaValidator.isSchemaLoaded(
        'thematic:character_concept_created#payload'
      )
    ).toBe(true);
    expect(
      schemaValidator.isSchemaLoaded(
        'thematic:thematic_directions_generated#payload'
      )
    ).toBe(true);
  });

  it('should validate payloads against registered schemas', async () => {
    // Register test schemas
    await schemaValidator.addSchema(
      {
        type: 'object',
        required: ['conceptId', 'concept', 'autoSaved'],
        properties: {
          conceptId: { type: 'string' },
          concept: { type: 'string' },
          autoSaved: { type: 'boolean' },
        },
        additionalProperties: false,
      },
      'thematic:character_concept_created#payload'
    );

    await schemaValidator.addSchema(
      {
        type: 'object',
        required: ['conceptId', 'directionCount', 'autoSaved'],
        properties: {
          conceptId: { type: 'string' },
          directionCount: { type: 'integer', minimum: 0 },
          autoSaved: { type: 'boolean' },
        },
        additionalProperties: false,
      },
      'thematic:thematic_directions_generated#payload'
    );

    // Test valid payloads
    const validConceptPayload = {
      conceptId: 'test-123',
      concept: 'A brave warrior',
      autoSaved: true,
    };

    const conceptResult = schemaValidator.validate(
      'thematic:character_concept_created#payload',
      validConceptPayload
    );
    expect(conceptResult.isValid).toBe(true);

    const validDirectionsPayload = {
      conceptId: 'test-123',
      directionCount: 5,
      autoSaved: true,
    };

    const directionsResult = schemaValidator.validate(
      'thematic:thematic_directions_generated#payload',
      validDirectionsPayload
    );
    expect(directionsResult.isValid).toBe(true);
  });

  it('should follow the same pattern as other events in the system', () => {
    // Other events in the system use namespaced format like:
    // 'ui:show_message', 'core:entity_created', 'system:error_occurred'

    // Our events should follow the same pattern
    const eventNames = Object.values(CHARACTER_BUILDER_EVENTS);

    eventNames.forEach((eventName) => {
      // Should have namespace:event_name format
      expect(eventName).toMatch(/^[a-z]+:[a-z_]+$/);

      // Should start with 'thematic:' namespace
      expect(eventName.startsWith('thematic:')).toBe(true);

      // The part after ':' should be lowercase with underscores
      const [namespace, name] = eventName.split(':');
      expect(namespace).toBe('thematic');
      expect(name).toMatch(/^[a-z_]+$/);
    });
  });
});
