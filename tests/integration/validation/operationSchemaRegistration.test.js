/**
 * @file Tests for operation schema registration issues that cause validation cascades
 * This test reproduces the AJV validation cascade errors caused by missing operation schema registrations
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import { readFile } from 'fs/promises';

describe('Operation Schema Registration Validation', () => {
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

  describe('Rule File Validation', () => {
    it('should validate entity_thought.rule.json without cascade errors', async () => {
      // Arrange
      const ruleDataContent = await readFile(
        'data/mods/core/rules/entity_thought.rule.json',
        'utf8'
      );
      const ruleData = JSON.parse(ruleDataContent);

      // Act & Assert
      expect(() => {
        schemaValidator.validateAgainstSchema(
          ruleData,
          'schema://living-narrative-engine/rule.schema.json'
        );
      }).not.toThrow();
    });

    it('should validate handle_sit_down.rule.json without cascade errors', async () => {
      // Arrange
      const ruleDataContent = await readFile(
        'data/mods/positioning/rules/handle_sit_down.rule.json',
        'utf8'
      );
      const ruleData = JSON.parse(ruleDataContent);

      // Act & Assert - This should FAIL initially due to missing ESTABLISH_SITTING_CLOSENESS registration
      expect(() => {
        schemaValidator.validateAgainstSchema(
          ruleData,
          'schema://living-narrative-engine/rule.schema.json'
        );
      }).not.toThrow();
    });
  });

  describe('Missing Operation Schema Detection', () => {
    it('should detect all operation schemas are registered in operation.schema.json', async () => {
      // Arrange
      const fs = await import('fs/promises');
      const path = await import('path');

      // Get all operation schema files
      const operationsDir = 'data/schemas/operations';
      const schemaFiles = await fs.readdir(operationsDir);
      const operationSchemas = schemaFiles
        .filter((file) => file.endsWith('.schema.json'))
        .map((file) => `operations/${file}`);

      // Get registered schemas from operation.schema.json
      const operationSchemaContent = await fs.readFile(
        'data/schemas/operation.schema.json',
        'utf8'
      );
      const registeredSchemas = [];
      const refMatches = operationSchemaContent.match(
        /"\.\/operations\/[^"]+\.schema\.json"/g
      );
      if (refMatches) {
        registeredSchemas.push(
          ...refMatches.map((match) => match.slice(3, -1))
        ); // Remove "./ prefix and quotes // Remove quotes
      }

      // Assert - Find missing registrations
      const missingSchemas = operationSchemas.filter(
        (schema) => !registeredSchemas.includes(schema)
      );

      expect(missingSchemas).toEqual([]);

      if (missingSchemas.length > 0) {
        console.log('Missing schema registrations:', missingSchemas);
      }
    });
  });

  describe('Specific Operation Schema Validation', () => {
    const operationsToTest = [
      'ESTABLISH_SITTING_CLOSENESS',
      'LOCK_MOUTH_ENGAGEMENT',
      'UNLOCK_MOUTH_ENGAGEMENT',
      'REMOVE_SITTING_CLOSENESS',
    ];

    operationsToTest.forEach((operation) => {
      it(`should validate ${operation} operation individually`, () => {
        // Arrange
        // schemaValidator is already initialized in beforeEach
        const mockOperation = {
          type: operation,
          parameters: {}, // Empty parameters for basic schema structure test
        };

        // Act & Assert - This will fail if the operation schema is not registered
        expect(() => {
          schemaValidator.validateAgainstSchema(
            mockOperation,
            'schema://living-narrative-engine/operation.schema.json'
          );
        }).not.toThrow();
      });
    });
  });
});
