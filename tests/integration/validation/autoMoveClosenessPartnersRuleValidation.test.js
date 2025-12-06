/**
 * @file Direct test for closeness_auto_move.rule.json validation
 * @description Verifies that the rule file that was failing in production now validates correctly
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import { readFile } from 'fs/promises';

describe('closeness_auto_move.rule.json Validation', () => {
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

  it('should validate closeness_auto_move.rule.json successfully', async () => {
    // Arrange - Load the exact rule file that was failing in production
    const ruleDataContent = await readFile(
      'data/mods/positioning/rules/closeness_auto_move.rule.json',
      'utf8'
    );
    const ruleData = JSON.parse(ruleDataContent);

    // Act & Assert - Should not throw validation errors
    expect(() => {
      schemaValidator.validateAgainstSchema(
        ruleData,
        'schema://living-narrative-engine/rule.schema.json'
      );
    }).not.toThrow();
  });

  it('should validate AUTO_MOVE_CLOSENESS_PARTNERS operation structure', async () => {
    // Arrange - Test the exact operation from the rule
    const operationData = {
      type: 'AUTO_MOVE_CLOSENESS_PARTNERS',
      parameters: {
        actor_id: '{event.payload.entityId}',
        destination_id: '{event.payload.currentLocationId}',
        previous_location_id: '{event.payload.previousLocationId}',
      },
    };

    // Act & Assert - Validate against operation schema
    expect(() => {
      schemaValidator.validateAgainstSchema(
        operationData,
        'schema://living-narrative-engine/operation.schema.json'
      );
    }).not.toThrow();
  });
});
