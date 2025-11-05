/**
 * @file Integration test for music mod condition files schema validation.
 * @description Verifies that all condition files in the music mod validate against the condition schema.
 * This test reproduces the console errors seen when loading the game.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { join } from 'path';
import { readFile } from 'fs/promises';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Use process.cwd() for project root in tests
const projectRoot = process.cwd();

// All music mod condition files that should exist
const MUSIC_CONDITION_FILES = [
  'event-is-action-set-aggressive-mood-on-instrument.condition.json',
  'event-is-action-set-cheerful-mood-on-instrument.condition.json',
  'event-is-action-set-eerie-mood-on-instrument.condition.json',
  'event-is-action-set-meditative-mood-on-instrument.condition.json',
  'event-is-action-set-mournful-mood-on-instrument.condition.json',
  'event-is-action-set-playful-mood-on-instrument.condition.json',
  'event-is-action-set-solemn-mood-on-instrument.condition.json',
  'event-is-action-set-tender-mood-on-instrument.condition.json',
  'event-is-action-set-tense-mood-on-instrument.condition.json',
  'event-is-action-set-triumphant-mood-on-instrument.condition.json',
];

describe('Music mod condition files validation', () => {
  let ajv;
  let conditionSchema;

  beforeAll(async () => {
    // Load the condition schema
    const schemaPath = join(projectRoot, 'data/schemas/condition.schema.json');
    const schemaContent = await readFile(schemaPath, 'utf-8');
    conditionSchema = JSON.parse(schemaContent);

    // Set up AJV validator
    ajv = new Ajv({
      strict: true,
      allErrors: true,
      verbose: true,
    });
    addFormats(ajv);

    // Add the condition schema
    ajv.addSchema(conditionSchema, conditionSchema.$id);
  });

  describe('Schema validation', () => {
    MUSIC_CONDITION_FILES.forEach((filename) => {
      it(`should validate ${filename} against condition schema`, async () => {
        const filePath = join(
          projectRoot,
          'data/mods/music/conditions',
          filename
        );

        const fileContent = await readFile(filePath, 'utf-8');
        const conditionData = JSON.parse(fileContent);

        // Validate against schema
        const validate = ajv.getSchema(conditionSchema.$id);
        const valid = validate(conditionData);

        if (!valid) {
          const errors = validate.errors.map((err) => {
            let message = `${err.instancePath || 'root'}: `;
            if (err.keyword === 'required') {
              message += `Missing required property '${err.params.missingProperty}'`;
            } else if (err.keyword === 'additionalProperties') {
              message += `Unexpected property '${err.params.additionalProperty}'`;
            } else {
              message += err.message;
            }
            return message;
          });

          throw new Error(
            `Condition file ${filename} failed schema validation:\n${errors.join('\n')}`
          );
        }

        expect(valid).toBe(true);
      });

      it(`should have 'logic' property (not 'condition') in ${filename}`, async () => {
        const filePath = join(
          projectRoot,
          'data/mods/music/conditions',
          filename
        );

        const fileContent = await readFile(filePath, 'utf-8');
        const conditionData = JSON.parse(fileContent);

        // Should have 'logic' property
        expect(conditionData).toHaveProperty('logic');

        // Should NOT have 'condition' property
        expect(conditionData).not.toHaveProperty('condition');
      });
    });
  });

  describe('Required properties', () => {
    MUSIC_CONDITION_FILES.forEach((filename) => {
      it(`should have all required properties in ${filename}`, async () => {
        const filePath = join(
          projectRoot,
          'data/mods/music/conditions',
          filename
        );

        const fileContent = await readFile(filePath, 'utf-8');
        const conditionData = JSON.parse(fileContent);

        // Check required properties
        expect(conditionData).toHaveProperty('id');
        expect(conditionData).toHaveProperty('description');
        expect(conditionData).toHaveProperty('logic');

        // Verify types
        expect(typeof conditionData.id).toBe('string');
        expect(typeof conditionData.description).toBe('string');
        expect(typeof conditionData.logic).toBe('object');
      });
    });
  });

  describe('Logic structure', () => {
    MUSIC_CONDITION_FILES.forEach((filename) => {
      it(`should have valid JSON-Logic in ${filename}`, async () => {
        const filePath = join(
          projectRoot,
          'data/mods/music/conditions',
          filename
        );

        const fileContent = await readFile(filePath, 'utf-8');
        const conditionData = JSON.parse(fileContent);

        // The logic should be a JSON-Logic object
        expect(conditionData.logic).toBeTruthy();
        expect(typeof conditionData.logic).toBe('object');

        // For event-is-action conditions, should have == operator
        expect(conditionData.logic).toHaveProperty('==');
        expect(Array.isArray(conditionData.logic['=='])).toBe(true);
        expect(conditionData.logic['=='].length).toBe(2);
      });
    });
  });

  describe('Condition IDs', () => {
    it('should have correct music: namespace for all condition IDs', async () => {
      for (const filename of MUSIC_CONDITION_FILES) {
        const filePath = join(
          projectRoot,
          'data/mods/music/conditions',
          filename
        );

        const fileContent = await readFile(filePath, 'utf-8');
        const conditionData = JSON.parse(fileContent);

        expect(conditionData.id).toMatch(/^music:/);
      }
    });
  });
});
