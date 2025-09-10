/**
 * @file Tests to reproduce the exact game loading schema validation issue
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';

describe('Game Loading Schema Validation', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  it('should demonstrate the issue: AjvSchemaValidator without game schemas cannot validate rules', async () => {
    // Create AjvSchemaValidator as it would be initialized in the DI container (with only character builder schemas)
    const validator = new AjvSchemaValidator({
      logger: testBed.mockLogger,
      preloadSchemas: [
        // Only character builder schemas, no game schemas
        {
          schema: {
            $schema: 'http://json-schema.org/draft-07/schema#',
            $id: 'schema://living-narrative-engine/thematic-direction.schema.json',
            title: 'Thematic Direction Schema',
            type: 'object',
            properties: {
              id: { type: 'string' },
            },
          },
          id: 'schema://living-narrative-engine/thematic-direction.schema.json',
        },
      ],
    });

    // Test data - the actual rule structure from entity_thought.rule.json
    const entityThoughtRule = {
      $schema: 'schema://living-narrative-engine/rule.schema.json',
      rule_id: 'entity_thought',
      event_type: 'core:entity_thought',
      actions: [
        {
          type: 'QUERY_COMPONENTS',
          parameters: {
            entity_ref: 'actor',
            pairs: [
              {
                component_type: 'core:name',
                result_variable: 'thinkerNameComponent',
              },
            ],
          },
        },
        {
          type: 'IF',
          parameters: {
            condition: {
              var: 'context.thinkerNameComponent',
            },
            then_actions: [
              {
                type: 'DISPATCH_THOUGHT',
                parameters: {
                  entity_id: '{event.payload.entityId}',
                  thoughts: '{event.payload.thoughts}',
                  notes: '{event.payload.notes}',
                },
              },
            ],
          },
        },
      ],
    };

    console.log(
      'Loaded schemas before validation:',
      validator.getLoadedSchemaIds()
    );

    // This should fail because rule.schema.json is not loaded
    const result = validator.validate(
      'schema://living-narrative-engine/rule.schema.json',
      entityThoughtRule
    );

    console.log('Validation result:', result.isValid);
    console.log(
      'Is rule schema loaded?',
      validator.isSchemaLoaded(
        'schema://living-narrative-engine/rule.schema.json'
      )
    );

    if (!result.isValid) {
      // Show first few errors to understand the failure
      console.log('First error:', result.errors[0]);
    }

    // The validation should fail because the schema is not loaded
    expect(result.isValid).toBe(false);
    expect(result.errors[0].keyword).toBe('schemaNotFound');
  });

  it('should demonstrate the solution: manually loading game schemas makes validation work', async () => {
    // Create AjvSchemaValidator with minimal setup
    const validator = new AjvSchemaValidator({
      logger: testBed.mockLogger,
    });

    // Manually load the required schemas (simulating what SchemaPhase should do)
    const ruleSchema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'schema://living-narrative-engine/rule.schema.json',
      title: 'Rule Schema',
      type: 'object',
      properties: {
        rule_id: { type: 'string' },
        event_type: { type: 'string' },
        actions: {
          type: 'array',
          items: {
            $ref: 'schema://living-narrative-engine/operation.schema.json',
          },
        },
      },
      required: ['rule_id', 'event_type', 'actions'],
    };

    const operationSchema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'schema://living-narrative-engine/operation.schema.json',
      title: 'Operation Schema',
      anyOf: [
        {
          $ref: '#/$defs/QueryComponentsOperation',
        },
        {
          $ref: '#/$defs/IfOperation',
        },
        {
          $ref: '#/$defs/DispatchThoughtOperation',
        },
      ],
      $defs: {
        QueryComponentsOperation: {
          type: 'object',
          properties: {
            type: { const: 'QUERY_COMPONENTS' },
            parameters: {
              type: 'object',
              properties: {
                entity_ref: { type: 'string' },
                pairs: { type: 'array' },
              },
              required: ['entity_ref', 'pairs'],
            },
          },
          required: ['type', 'parameters'],
        },
        IfOperation: {
          type: 'object',
          properties: {
            type: { const: 'IF' },
            parameters: {
              type: 'object',
              properties: {
                condition: { type: 'object' },
                then_actions: { type: 'array' },
              },
              required: ['condition', 'then_actions'],
            },
          },
          required: ['type', 'parameters'],
        },
        DispatchThoughtOperation: {
          type: 'object',
          properties: {
            type: { const: 'DISPATCH_THOUGHT' },
            parameters: {
              type: 'object',
              properties: {
                entity_id: { type: 'string' },
                thoughts: { type: 'string' },
                notes: { type: 'string' },
              },
              required: ['entity_id', 'thoughts'],
            },
          },
          required: ['type', 'parameters'],
        },
      },
    };

    // Load the schemas
    await validator.addSchema(
      operationSchema,
      'schema://living-narrative-engine/operation.schema.json'
    );
    await validator.addSchema(
      ruleSchema,
      'schema://living-narrative-engine/rule.schema.json'
    );

    // Test data
    const entityThoughtRule = {
      rule_id: 'entity_thought',
      event_type: 'core:entity_thought',
      actions: [
        {
          type: 'QUERY_COMPONENTS',
          parameters: {
            entity_ref: 'actor',
            pairs: [
              {
                component_type: 'core:name',
                result_variable: 'thinkerNameComponent',
              },
            ],
          },
        },
        {
          type: 'IF',
          parameters: {
            condition: {
              var: 'context.thinkerNameComponent',
            },
            then_actions: [
              {
                type: 'DISPATCH_THOUGHT',
                parameters: {
                  entity_id: '{event.payload.entityId}',
                  thoughts: '{event.payload.thoughts}',
                  notes: '{event.payload.notes}',
                },
              },
            ],
          },
        },
      ],
    };

    console.log(
      'Loaded schemas after manual loading:',
      validator.getLoadedSchemaIds()
    );

    // Now validation should work
    const result = validator.validate(
      'schema://living-narrative-engine/rule.schema.json',
      entityThoughtRule
    );

    console.log(
      'Validation result after manual schema loading:',
      result.isValid
    );

    if (!result.isValid) {
      console.log('Errors:', result.errors.slice(0, 3));
    }

    expect(result.isValid).toBe(true);
  });
});
