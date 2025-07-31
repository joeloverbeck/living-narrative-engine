/**
 * @file Test event definitions for integration tests
 */

export const testEventDefinitions = {
  'core:character_concept_created': {
    id: 'core:character_concept_created',
    description: 'Dispatched when a new character concept is created.',
    payloadSchema: {
      type: 'object',
      properties: {
        conceptId: {
          description: 'Unique identifier of the created concept',
          type: 'string',
        },
        concept: {
          description: 'The character concept text',
          type: 'string',
        },
        autoSaved: {
          description: 'Whether the concept was automatically saved',
          type: 'boolean',
        },
      },
      required: ['conceptId', 'concept'],
      additionalProperties: true,
    },
  },
  'core:character_concept_deleted': {
    id: 'core:character_concept_deleted',
    description: 'Dispatched when a character concept is deleted.',
    payloadSchema: {
      type: 'object',
      properties: {
        conceptId: {
          description: 'Unique identifier of the deleted concept',
          type: 'string',
        },
      },
      required: ['conceptId'],
      additionalProperties: true,
    },
  },
};
