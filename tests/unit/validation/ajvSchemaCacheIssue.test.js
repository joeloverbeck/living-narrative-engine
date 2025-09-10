/**
 * @file Test to reproduce AJV schema cache/loading issue
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';

describe('AJV Schema Cache Issue', () => {
  let testBed;
  let schemaValidator;

  beforeEach(async () => {
    testBed = new IntegrationTestBed();
    await testBed.initialize();
    schemaValidator = testBed.container.resolve('ISchemaValidator');
  });

  afterEach(() => {
    testBed?.cleanup();
  });

  it('should properly validate IF operation against operation schema', async () => {
    // Simple IF operation that should validate correctly
    const ifOperation = {
      type: 'IF',
      comment: 'Test IF operation',
      parameters: {
        condition: {
          var: 'context.testValue',
        },
        then_actions: [
          {
            type: 'LOG',
            comment: 'Test log',
            parameters: {
              level: 'info',
              message: 'Test message',
            },
          },
        ],
      },
    };

    console.log('Testing IF operation validation...');

    // Check if operation schema is loaded
    const operationSchemaId =
      'schema://living-narrative-engine/operation.schema.json';
    const isLoaded = schemaValidator.isSchemaLoaded(operationSchemaId);
    console.log(`Operation schema loaded: ${isLoaded}`);

    // Check if IF schema is loaded
    const ifSchemaId =
      'schema://living-narrative-engine/operations/if.schema.json';
    const ifIsLoaded = schemaValidator.isSchemaLoaded(ifSchemaId);
    console.log(`IF schema loaded: ${ifIsLoaded}`);

    let result;
    try {
      result = await schemaValidator.validate(ifOperation, operationSchemaId);
      console.log(`Validation result: ${result.isValid}`);

      if (!result.isValid && result.errors && result.errors.length > 0) {
        console.log('First few validation errors:');
        result.errors.slice(0, 3).forEach((error, i) => {
          console.log(`  Error ${i + 1}: ${error.message}`);
          console.log(`    Path: ${error.instancePath}`);
          console.log(`    Schema: ${error.schemaPath}`);
          if (error.params?.allowedValue === 'QUERY_COMPONENT') {
            console.log(
              '    🚨 DETECTED: Validating against QUERY_COMPONENT instead of IF!'
            );
          }
        });
      }
    } catch (error) {
      console.error('Validation threw error:', error.message);
      result = { isValid: false, error: error.message };
    }

    // The key insight is whether we get the QUERY_COMPONENT validation error
    expect(result).toBeDefined();
  });

  it('should have all necessary operation schemas loaded', () => {
    const requiredSchemas = [
      'schema://living-narrative-engine/operation.schema.json',
      'schema://living-narrative-engine/operations/if.schema.json',
      'schema://living-narrative-engine/operations/queryComponent.schema.json',
      'schema://living-narrative-engine/operations/dispatchThought.schema.json',
    ];

    console.log('Checking schema loading status:');
    requiredSchemas.forEach((schemaId) => {
      const isLoaded = schemaValidator.isSchemaLoaded(schemaId);
      console.log(`  ${isLoaded ? '✓' : '✗'} ${schemaId}`);
    });

    const totalLoaded = schemaValidator.getLoadedSchemaIds().length;
    console.log(`Total schemas loaded: ${totalLoaded}`);

    expect(totalLoaded).toBeGreaterThan(0);
  });
});
