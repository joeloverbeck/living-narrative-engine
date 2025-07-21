/**
 * @file Unit tests for CharacterConcept model
 */

import { jest, describe, beforeEach, test, expect } from '@jest/globals';
import { 
  createCharacterConcept, 
  validateCharacterConcept,
  CharacterConceptValidationError 
} from '../../../../src/characterBuilder/models/characterConcept.js';

describe('CharacterConcept Model', () => {
  describe('createCharacterConcept', () => {
    test('should create character concept with valid data', () => {
      const conceptData = {
        name: 'Test Hero',
        description: 'A brave adventurer with a mysterious past',
        background: 'Noble',
        personality: 'Courageous but impulsive',
      };

      const result = createCharacterConcept(conceptData);

      expect(result).toMatchObject({
        id: expect.any(String),
        name: 'Test Hero',
        description: 'A brave adventurer with a mysterious past',
        background: 'Noble',
        personality: 'Courageous but impulsive',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      // Verify timestamps are ISO strings
      expect(() => new Date(result.createdAt)).not.toThrow();
      expect(() => new Date(result.updatedAt)).not.toThrow();
      
      // Verify ID is a valid UUID format
      expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    test('should create concept with minimal required data', () => {
      const conceptData = {
        name: 'Minimal Hero',
        description: 'Simple description',
      };

      const result = createCharacterConcept(conceptData);

      expect(result).toMatchObject({
        id: expect.any(String),
        name: 'Minimal Hero',
        description: 'Simple description',
        background: '',
        personality: '',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    test('should throw error if name is missing', () => {
      const conceptData = {
        description: 'A brave adventurer',
      };

      expect(() => createCharacterConcept(conceptData)).toThrow(CharacterConceptValidationError);
      expect(() => createCharacterConcept(conceptData)).toThrow('name is required');
    });

    test('should throw error if name is empty', () => {
      const conceptData = {
        name: '',
        description: 'A brave adventurer',
      };

      expect(() => createCharacterConcept(conceptData)).toThrow(CharacterConceptValidationError);
      expect(() => createCharacterConcept(conceptData)).toThrow('name cannot be empty');
    });

    test('should throw error if description is missing', () => {
      const conceptData = {
        name: 'Test Hero',
      };

      expect(() => createCharacterConcept(conceptData)).toThrow(CharacterConceptValidationError);
      expect(() => createCharacterConcept(conceptData)).toThrow('description is required');
    });

    test('should throw error if description is empty', () => {
      const conceptData = {
        name: 'Test Hero',
        description: '',
      };

      expect(() => createCharacterConcept(conceptData)).toThrow(CharacterConceptValidationError);
      expect(() => createCharacterConcept(conceptData)).toThrow('description cannot be empty');
    });

    test('should throw error if name exceeds maximum length', () => {
      const conceptData = {
        name: 'a'.repeat(101), // Assuming max length is 100
        description: 'Valid description',
      };

      expect(() => createCharacterConcept(conceptData)).toThrow(CharacterConceptValidationError);
      expect(() => createCharacterConcept(conceptData)).toThrow('name exceeds maximum length');
    });

    test('should throw error if description exceeds maximum length', () => {
      const conceptData = {
        name: 'Valid Name',
        description: 'a'.repeat(1001), // Assuming max length is 1000
      };

      expect(() => createCharacterConcept(conceptData)).toThrow(CharacterConceptValidationError);
      expect(() => createCharacterConcept(conceptData)).toThrow('description exceeds maximum length');
    });

    test('should sanitize input data', () => {
      const conceptData = {
        name: '  Test Hero  ',
        description: '  A brave adventurer  ',
        background: '  Noble  ',
        personality: '  Courageous  ',
      };

      const result = createCharacterConcept(conceptData);

      expect(result.name).toBe('Test Hero');
      expect(result.description).toBe('A brave adventurer');
      expect(result.background).toBe('Noble');
      expect(result.personality).toBe('Courageous');
    });

    test('should generate unique IDs for different concepts', () => {
      const conceptData1 = { name: 'Hero One', description: 'First hero' };
      const conceptData2 = { name: 'Hero Two', description: 'Second hero' };

      const result1 = createCharacterConcept(conceptData1);
      const result2 = createCharacterConcept(conceptData2);

      expect(result1.id).not.toBe(result2.id);
    });

    test('should set createdAt and updatedAt to same value on creation', () => {
      const conceptData = {
        name: 'Test Hero',
        description: 'A brave adventurer',
      };

      const result = createCharacterConcept(conceptData);

      expect(result.createdAt).toBe(result.updatedAt);
    });
  });

  describe('validateCharacterConcept', () => {
    test('should return true for valid character concept', () => {
      const concept = {
        id: '12345678-1234-1234-1234-123456789abc',
        name: 'Test Hero',
        description: 'A brave adventurer',
        background: 'Noble',
        personality: 'Courageous',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(validateCharacterConcept(concept)).toBe(true);
    });

    test('should return false for concept missing required fields', () => {
      const concept = {
        name: 'Test Hero',
        // Missing description
      };

      expect(validateCharacterConcept(concept)).toBe(false);
    });

    test('should return false for concept with invalid ID format', () => {
      const concept = {
        id: 'invalid-id',
        name: 'Test Hero',
        description: 'A brave adventurer',
        background: 'Noble',
        personality: 'Courageous',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(validateCharacterConcept(concept)).toBe(false);
    });

    test('should return false for concept with invalid timestamps', () => {
      const concept = {
        id: '12345678-1234-1234-1234-123456789abc',
        name: 'Test Hero',
        description: 'A brave adventurer',
        background: 'Noble',
        personality: 'Courageous',
        createdAt: 'invalid-date',
        updatedAt: new Date().toISOString(),
      };

      expect(validateCharacterConcept(concept)).toBe(false);
    });

    test('should return false for null or undefined concept', () => {
      expect(validateCharacterConcept(null)).toBe(false);
      expect(validateCharacterConcept(undefined)).toBe(false);
    });

    test('should return false for concept with empty required fields', () => {
      const concept = {
        id: '12345678-1234-1234-1234-123456789abc',
        name: '',
        description: 'A brave adventurer',
        background: 'Noble',
        personality: 'Courageous',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(validateCharacterConcept(concept)).toBe(false);
    });

    test('should return false for concept with field length violations', () => {
      const concept = {
        id: '12345678-1234-1234-1234-123456789abc',
        name: 'a'.repeat(101), // Exceeds max length
        description: 'A brave adventurer',
        background: 'Noble',
        personality: 'Courageous',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(validateCharacterConcept(concept)).toBe(false);
    });
  });

  describe('CharacterConceptValidationError', () => {
    test('should create error with message', () => {
      const error = new CharacterConceptValidationError('Test validation error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CharacterConceptValidationError);
      expect(error.message).toBe('Test validation error');
      expect(error.name).toBe('CharacterConceptValidationError');
    });

    test('should create error with cause', () => {
      const cause = new Error('Root cause');
      const error = new CharacterConceptValidationError('Test validation error', cause);

      expect(error.message).toBe('Test validation error');
      expect(error.cause).toBe(cause);
    });
  });

  describe('edge cases', () => {
    test('should handle unicode characters in name and description', () => {
      const conceptData = {
        name: 'Héro Tëst 🧙‍♂️',
        description: 'A brave adventurer with émojis 🗡️⚔️',
        background: 'Nöble',
        personality: 'Courageous',
      };

      const result = createCharacterConcept(conceptData);

      expect(result.name).toBe('Héro Tëst 🧙‍♂️');
      expect(result.description).toBe('A brave adventurer with émojis 🗡️⚔️');
      expect(result.background).toBe('Nöble');
    });

    test('should handle concepts with only whitespace in optional fields', () => {
      const conceptData = {
        name: 'Test Hero',
        description: 'A brave adventurer',
        background: '   ',
        personality: '   ',
      };

      const result = createCharacterConcept(conceptData);

      expect(result.background).toBe('');
      expect(result.personality).toBe('');
    });

    test('should handle concepts with undefined optional fields', () => {
      const conceptData = {
        name: 'Test Hero',
        description: 'A brave adventurer',
        background: undefined,
        personality: undefined,
      };

      const result = createCharacterConcept(conceptData);

      expect(result.background).toBe('');
      expect(result.personality).toBe('');
    });
  });
});