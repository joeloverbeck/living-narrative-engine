/**
 * @file Focused unit test for character limit validation in CharacterConcept model
 * @description Tests the character limit validation logic in isolation
 * @see ../../../../src/characterBuilder/models/characterConcept.js
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  createCharacterConcept,
  updateCharacterConcept,
  CHARACTER_CONCEPT_STATUS,
} from '../../../../src/characterBuilder/models/characterConcept.js';

describe('CharacterConcept - Character Limit Validation', () => {
  describe('createCharacterConcept', () => {
    describe('minimum character limit (10 characters)', () => {
      it('should accept exactly 10 characters', () => {
        const concept = '1234567890'; // Exactly 10 characters
        const result = createCharacterConcept(concept);

        expect(result).toBeDefined();
        expect(result.concept).toBe(concept);
        expect(result.id).toBeDefined();
        expect(result.status).toBe(CHARACTER_CONCEPT_STATUS.DRAFT);
      });

      it('should reject 9 characters', () => {
        const concept = '123456789'; // Only 9 characters

        expect(() => createCharacterConcept(concept)).toThrow(
          'CharacterConcept: concept must be at least 10 characters long'
        );
      });

      it('should reject empty string', () => {
        expect(() => createCharacterConcept('')).toThrow(
          'CharacterConcept: concept must be a non-empty string'
        );
      });

      it('should reject whitespace-only string', () => {
        expect(() => createCharacterConcept('   ')).toThrow(
          'CharacterConcept: concept must be a non-empty string'
        );
      });
    });

    describe('maximum character limit (3000 characters)', () => {
      it('should accept exactly 1000 characters', () => {
        const concept = 'a'.repeat(1000); // Exactly 1000 characters
        const result = createCharacterConcept(concept);

        expect(result).toBeDefined();
        expect(result.concept).toBe(concept);
        expect(result.concept.length).toBe(1000);
      });

      it('should accept 1001 characters', () => {
        const concept = 'a'.repeat(1001); // 1001 characters
        const result = createCharacterConcept(concept);

        expect(result).toBeDefined();
        expect(result.concept).toBe(concept);
        expect(result.concept.length).toBe(1001);
      });

      it('should accept 1157 characters (from error log)', () => {
        const concept = 'a'.repeat(1157); // Length from the actual error
        const result = createCharacterConcept(concept);

        expect(result).toBeDefined();
        expect(result.concept).toBe(concept);
        expect(result.concept.length).toBe(1157);
      });

      it('should accept exactly 3000 characters (frontend max)', () => {
        const concept = 'a'.repeat(3000); // Frontend allows this
        const result = createCharacterConcept(concept);

        expect(result).toBeDefined();
        expect(result.concept).toBe(concept);
        expect(result.concept.length).toBe(3000);
      });

      it('should reject 3001 characters', () => {
        const concept = 'a'.repeat(3001); // Over the limit

        expect(() => createCharacterConcept(concept)).toThrow(
          'CharacterConcept: concept must be no more than 3000 characters long'
        );
      });
    });

    describe('character limit with various content', () => {
      it('should count unicode characters correctly', () => {
        const concept = '🎮'.repeat(10); // 10 emoji characters
        const result = createCharacterConcept(concept);

        expect(result).toBeDefined();
        expect(result.concept).toBe(concept);
        expect(result.concept.length).toBe(20); // Each emoji is 2 UTF-16 code units
      });

      it('should count multi-line text correctly', () => {
        const concept = 'Line 1\nLine 2\nLine 3\nEnd'; // Multiple lines
        const result = createCharacterConcept(concept);

        expect(result).toBeDefined();
        expect(result.concept).toBe(concept);
        expect(result.concept.length).toBe(concept.length); // Verify actual length
        expect(result.concept.length).toBe(24); // Including newlines
      });

      it('should trim whitespace before validation', () => {
        const concept = '  ' + 'a'.repeat(10) + '  '; // 10 chars with surrounding spaces
        const result = createCharacterConcept(concept);

        expect(result).toBeDefined();
        expect(result.concept).toBe('a'.repeat(10)); // Trimmed
        expect(result.concept.length).toBe(10);
      });
    });
  });

  describe('updateCharacterConcept', () => {
    let existingConcept;

    beforeEach(() => {
      existingConcept = createCharacterConcept('Original concept text');
    });

    describe('character limit validation on update', () => {
      it('should accept update with exactly 10 characters', () => {
        const updates = { concept: '1234567890' };
        const result = updateCharacterConcept(existingConcept, updates);

        expect(result.concept).toBe('1234567890');
      });

      it('should accept update with exactly 3000 characters', () => {
        const updates = { concept: 'a'.repeat(3000) };
        const result = updateCharacterConcept(existingConcept, updates);

        expect(result.concept).toBe('a'.repeat(3000));
        expect(result.concept.length).toBe(3000);
      });

      it('should reject update with 9 characters', () => {
        const updates = { concept: '123456789' };

        expect(() => updateCharacterConcept(existingConcept, updates)).toThrow(
          'CharacterConcept: concept must be between 10 and 3000 characters'
        );
      });

      it('should reject update with 3001 characters', () => {
        const updates = { concept: 'a'.repeat(3001) };

        expect(() => updateCharacterConcept(existingConcept, updates)).toThrow(
          'CharacterConcept: concept must be between 10 and 3000 characters'
        );
      });

      it('should reject update with empty string', () => {
        const updates = { concept: '' };

        expect(() => updateCharacterConcept(existingConcept, updates)).toThrow(
          'CharacterConcept: concept must be a non-empty string'
        );
      });

      it('should trim concept before validation on update', () => {
        const updates = { concept: '  ' + 'a'.repeat(10) + '  ' };
        const result = updateCharacterConcept(existingConcept, updates);

        expect(result.concept).toBe('a'.repeat(10));
        expect(result.concept.length).toBe(10);
      });
    });
  });

  describe('Character limit fixed', () => {
    it('accepts valid frontend input up to 3000 characters', () => {
      // Frontend allows 3000 and backend now also allows 3000
      const validFrontendConcept = 'a'.repeat(1500); // Valid in frontend (< 3000)
      const result = createCharacterConcept(validFrontendConcept);

      expect(result).toBeDefined();
      expect(result.concept).toBe(validFrontendConcept);
      expect(result.concept.length).toBe(1500);
    });

    it('accepts exactly 3000 character concepts', () => {
      // Frontend and backend both allow 3000
      const maxFrontendConcept = 'a'.repeat(3000);
      const result = createCharacterConcept(maxFrontendConcept);

      expect(result).toBeDefined();
      expect(result.concept).toBe(maxFrontendConcept);
      expect(result.concept.length).toBe(3000);
    });

    it('rejects concepts over 3000 characters', () => {
      const tooLongConcept = 'a'.repeat(3001);

      expect(() => createCharacterConcept(tooLongConcept)).toThrow(
        'CharacterConcept: concept must be no more than 3000 characters long'
      );
    });
  });
});
