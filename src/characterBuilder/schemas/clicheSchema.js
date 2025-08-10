/**
 * JSON Schema for Cliche model validation
 * Used with AJV for runtime validation
 */

export const clicheSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['directionId', 'conceptId', 'categories'],
  properties: {
    id: {
      type: 'string',
      pattern:
        '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
      description: 'UUID v4',
    },
    directionId: {
      type: 'string',
      minLength: 1,
      description: 'Reference to ThematicDirection',
    },
    conceptId: {
      type: 'string',
      minLength: 1,
      description: 'Reference to CharacterConcept',
    },
    categories: {
      type: 'object',
      required: [
        'names',
        'physicalDescriptions',
        'personalityTraits',
        'skillsAbilities',
        'typicalLikes',
        'typicalDislikes',
        'commonFears',
        'genericGoals',
        'backgroundElements',
        'overusedSecrets',
        'speechPatterns',
      ],
      properties: {
        names: { $ref: '#/definitions/stringArray' },
        physicalDescriptions: { $ref: '#/definitions/stringArray' },
        personalityTraits: { $ref: '#/definitions/stringArray' },
        skillsAbilities: { $ref: '#/definitions/stringArray' },
        typicalLikes: { $ref: '#/definitions/stringArray' },
        typicalDislikes: { $ref: '#/definitions/stringArray' },
        commonFears: { $ref: '#/definitions/stringArray' },
        genericGoals: { $ref: '#/definitions/stringArray' },
        backgroundElements: { $ref: '#/definitions/stringArray' },
        overusedSecrets: { $ref: '#/definitions/stringArray' },
        speechPatterns: { $ref: '#/definitions/stringArray' },
      },
      additionalProperties: false,
    },
    tropesAndStereotypes: {
      type: 'array',
      items: { type: 'string' },
      description: 'Overall narrative patterns to avoid',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
      description: 'ISO 8601 timestamp',
    },
    llmMetadata: {
      type: 'object',
      properties: {
        model: { type: 'string' },
        temperature: { type: 'number', minimum: 0, maximum: 2 },
        tokens: { type: 'integer', minimum: 0 },
        responseTime: { type: 'number', minimum: 0 },
        promptVersion: { type: 'string' },
      },
      additionalProperties: true,
    },
  },
  definitions: {
    stringArray: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 1,
      },
    },
  },
  additionalProperties: false,
};

export default clicheSchema;
