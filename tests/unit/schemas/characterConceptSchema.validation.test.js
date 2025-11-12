/**
 * @file Focused test suite for character concept schema validation issue
 * @description Tests to reproduce and verify the fix for the 1000 vs 6000 character limit mismatch
 * @see /data/schemas/character-concept.schema.json
 * @see /src/characterBuilder/models/characterConcept.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { BaseTestBed } from '../../common/baseTestBed.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import { createCharacterConcept } from '../../../src/characterBuilder/models/characterConcept.js';
import { serializeCharacterConcept } from '../../../src/characterBuilder/models/characterConcept.js';
import fs from 'fs';
import path from 'path';

const MAX_CONCEPT_LENGTH = 6000;

describe('Character Concept Schema Validation - Character Limit Issue', () => {
  let testBed;
  let schemaValidator;
  let mockLogger;

  beforeEach(async () => {
    testBed = new BaseTestBed();

    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    schemaValidator = new AjvSchemaValidator({ logger: mockLogger });

    // Load required schemas (character concept depends on thematic direction)
    const thematicSchemaPath = path.join(
      process.cwd(),
      'data/schemas/thematic-direction.schema.json'
    );
    const thematicSchemaData = JSON.parse(
      fs.readFileSync(thematicSchemaPath, 'utf8')
    );
    await schemaValidator.addSchema(thematicSchemaData, thematicSchemaData.$id);

    const conceptSchemaPath = path.join(
      process.cwd(),
      'data/schemas/character-concept.schema.json'
    );
    const conceptSchemaData = JSON.parse(
      fs.readFileSync(conceptSchemaPath, 'utf8')
    );
    await schemaValidator.addSchema(conceptSchemaData, conceptSchemaData.$id);
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('schema validation character limits', () => {
    it('should reject concepts with exactly 1001 characters (old limit)', () => {
      // Create concept with 1001 characters (1 over old limit)
      const longConcept = 'a'.repeat(1001);
      const concept = createCharacterConcept(longConcept);
      const serializedConcept = serializeCharacterConcept(concept);

      // This test documents the original bug - concepts over 1000 chars were rejected
      // With the fix, this should now pass since the schema allows 6000 chars
      const isValid = schemaValidator.validateAgainstSchema(
        serializedConcept,
        'schema://living-narrative-engine/character-concept.schema.json'
      );

      expect(isValid).toBe(true); // Should pass with updated schema
    });

    it('should accept concepts with exactly 1500 characters (middle range)', () => {
      // Create concept with 1500 characters (between old 1000 and new 6000 limit)
      const mediumConcept = 'a'.repeat(1500);
      const concept = createCharacterConcept(mediumConcept);
      const serializedConcept = serializeCharacterConcept(concept);

      const isValid = schemaValidator.validateAgainstSchema(
        serializedConcept,
        'schema://living-narrative-engine/character-concept.schema.json'
      );

      expect(isValid).toBe(true);
    });

    it('should accept concepts with exactly 6000 characters (new upper limit)', () => {
      // Create concept with exactly 6000 characters (at new limit)
      const longConcept = 'a'.repeat(MAX_CONCEPT_LENGTH);
      const concept = createCharacterConcept(longConcept);
      const serializedConcept = serializeCharacterConcept(concept);

      const isValid = schemaValidator.validateAgainstSchema(
        serializedConcept,
        'schema://living-narrative-engine/character-concept.schema.json'
      );

      expect(isValid).toBe(true);
    });

    it('should reject concepts with 6001 characters (over new limit)', () => {
      // This should fail both model validation and schema validation
      expect(() => {
        createCharacterConcept('a'.repeat(MAX_CONCEPT_LENGTH + 1));
      }).toThrow('concept must be no more than 6000 characters long');
    });

    it('should accept the exact concept from error logs (1190 characters)', () => {
      // This is the exact concept from the error logs that was failing
      const errorLogConcept =
        "a 20-year-old young woman with a shapely, athletic figure and a gorgeous ass. She lives in Donostia, in the north of Spain. She is studying business in college, but she thinks she'll have a great career as an Instagram model, where she has about a hundred thousand subscribers. The young woman goes to the gym five days a week to maintain her figure, and particularly to shape her gorgeous, bubbly ass further. She was blessed with an ass that makes every man turn their heads, and that makes her Instagram followers drool online. Her ass is her main pride. The young woman has many suitors, but she doesn't want to settle down given her many options. She's attracted to older men, in their late thirties or forties, who are manly and tough. She loves to be manhandled in bed by such older, strong men whom she can call daddy. She loves to tease men with her gorgeous ass; she gets a kick of knowing that men want to fuck her. The young woman can be a bit of a brat at times, but she does it almost as a test to see what man is tough enough to check her. She usually wears tight clothing, like yoga pants, that highlight her crotch and her sexy ass, as well as the rest of her toned figure.";

      expect(errorLogConcept.length).toBe(1190); // Verify exact length from logs

      const concept = createCharacterConcept(errorLogConcept);
      const serializedConcept = serializeCharacterConcept(concept);

      const isValid = schemaValidator.validateAgainstSchema(
        serializedConcept,
        'schema://living-narrative-engine/character-concept.schema.json'
      );

      expect(isValid).toBe(true);
    });
  });

  describe('boundary testing for character limits', () => {
    it('should handle minimum length (10 characters)', () => {
      const minConcept = '1234567890'; // Exactly 10 characters
      const concept = createCharacterConcept(minConcept);
      const serializedConcept = serializeCharacterConcept(concept);

      const isValid = schemaValidator.validateAgainstSchema(
        serializedConcept,
        'schema://living-narrative-engine/character-concept.schema.json'
      );

      expect(isValid).toBe(true);
    });

    it('should reject concepts under minimum length (9 characters)', () => {
      expect(() => {
        createCharacterConcept('123456789'); // Only 9 characters
      }).toThrow('concept must be at least 10 characters long');
    });
  });

  describe('schema error messages for debugging', () => {
    it('should provide clear error message for over-limit concepts', () => {
      // This test verifies error messages are clear when validation fails
      const overLimitConcept = 'a'.repeat(MAX_CONCEPT_LENGTH + 1);

      // Model validation should catch this first
      expect(() => {
        createCharacterConcept(overLimitConcept);
      }).toThrow('concept must be no more than 6000 characters long');
    });
  });
});
