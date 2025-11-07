import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import { ActionIndexValidationError } from '../../../src/errors/actionIndexValidationError.js';
import BaseError from '../../../src/errors/baseError.js';

describe('ActionIndexValidationError - LLM Data Preservation', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Constructor', () => {
    it('should create error with required parameters and no LLM data', () => {
      const error = new ActionIndexValidationError('Invalid index', {
        index: 5,
        actionsLength: 3,
      });

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(BaseError);
      expect(error).toBeInstanceOf(ActionIndexValidationError);
      expect(error.name).toBe('ActionIndexValidationError');
      expect(error.message).toBe('Invalid index');
      expect(error.code).toBe('ACTION_INDEX_VALIDATION_ERROR');
      expect(error.index).toBe(5);
      expect(error.actionsLength).toBe(3);
      expect(error.llmData).toEqual({
        speech: null,
        thoughts: null,
        notes: null,
      });
    });

    it('should create error with preserved speech', () => {
      const error = new ActionIndexValidationError('Invalid index', {
        index: 10,
        actionsLength: 5,
        speech: 'This is preserved speech from the LLM.',
      });

      expect(error.llmData.speech).toBe('This is preserved speech from the LLM.');
      expect(error.llmData.thoughts).toBeNull();
      expect(error.llmData.notes).toBeNull();
    });

    it('should create error with all preserved LLM data', () => {
      const speech = 'Character speech';
      const thoughts = 'Internal thoughts';
      const notes = [
        { key: 'memory', value: 'important event' },
        { key: 'emotion', value: 'curious' },
      ];

      const error = new ActionIndexValidationError('Invalid index', {
        index: 7,
        actionsLength: 4,
        speech,
        thoughts,
        notes,
      });

      expect(error.llmData.speech).toBe(speech);
      expect(error.llmData.thoughts).toBe(thoughts);
      expect(error.llmData.notes).toEqual(notes);
      expect(error.index).toBe(7);
      expect(error.actionsLength).toBe(4);
    });

    it('should handle partial LLM data preservation', () => {
      const error = new ActionIndexValidationError('Invalid index', {
        index: 3,
        actionsLength: 2,
        thoughts: 'Only thoughts preserved',
      });

      expect(error.llmData.speech).toBeNull();
      expect(error.llmData.thoughts).toBe('Only thoughts preserved');
      expect(error.llmData.notes).toBeNull();
    });
  });

  describe('hasPreservedData() Method', () => {
    it('should return true when speech is preserved', () => {
      const error = new ActionIndexValidationError('Test', {
        index: 1,
        actionsLength: 1,
        speech: 'Preserved speech',
      });

      expect(error.hasPreservedData()).toBe(true);
    });

    it('should return true when thoughts are preserved', () => {
      const error = new ActionIndexValidationError('Test', {
        index: 1,
        actionsLength: 1,
        thoughts: 'Preserved thoughts',
      });

      expect(error.hasPreservedData()).toBe(true);
    });

    it('should return true when notes are preserved', () => {
      const error = new ActionIndexValidationError('Test', {
        index: 1,
        actionsLength: 1,
        notes: [{ key: 'value' }],
      });

      expect(error.hasPreservedData()).toBe(true);
    });

    it('should return false when no data is preserved', () => {
      const error = new ActionIndexValidationError('Test', {
        index: 1,
        actionsLength: 1,
      });

      expect(error.hasPreservedData()).toBe(false);
    });

    it('should return false when all data is null', () => {
      const error = new ActionIndexValidationError('Test', {
        index: 1,
        actionsLength: 1,
        speech: null,
        thoughts: null,
        notes: null,
      });

      expect(error.hasPreservedData()).toBe(false);
    });
  });

  describe('Getter Methods', () => {
    it('should retrieve preserved speech', () => {
      const speech = 'Test speech';
      const error = new ActionIndexValidationError('Test', {
        index: 1,
        actionsLength: 1,
        speech,
      });

      expect(error.getPreservedSpeech()).toBe(speech);
    });

    it('should return null for missing speech', () => {
      const error = new ActionIndexValidationError('Test', {
        index: 1,
        actionsLength: 1,
      });

      expect(error.getPreservedSpeech()).toBeNull();
    });

    it('should retrieve preserved thoughts', () => {
      const thoughts = 'Test thoughts';
      const error = new ActionIndexValidationError('Test', {
        index: 1,
        actionsLength: 1,
        thoughts,
      });

      expect(error.getPreservedThoughts()).toBe(thoughts);
    });

    it('should return null for missing thoughts', () => {
      const error = new ActionIndexValidationError('Test', {
        index: 1,
        actionsLength: 1,
      });

      expect(error.getPreservedThoughts()).toBeNull();
    });

    it('should retrieve preserved notes', () => {
      const notes = [{ key: 'memory', value: 'test' }];
      const error = new ActionIndexValidationError('Test', {
        index: 1,
        actionsLength: 1,
        notes,
      });

      expect(error.getPreservedNotes()).toEqual(notes);
    });

    it('should return null for missing notes', () => {
      const error = new ActionIndexValidationError('Test', {
        index: 1,
        actionsLength: 1,
      });

      expect(error.getPreservedNotes()).toBeNull();
    });
  });

  describe('BaseError Integration', () => {
    it('should set severity to warning', () => {
      const error = new ActionIndexValidationError('Test', {
        index: 1,
        actionsLength: 1,
      });

      expect(error.severity).toBe('warning');
      expect(error.getSeverity()).toBe('warning');
    });

    it('should be recoverable', () => {
      const error = new ActionIndexValidationError('Test', {
        index: 1,
        actionsLength: 1,
      });

      expect(error.recoverable).toBe(true);
      expect(error.isRecoverable()).toBe(true);
    });

    it('should have proper error code', () => {
      const error = new ActionIndexValidationError('Test', {
        index: 1,
        actionsLength: 1,
      });

      expect(error.code).toBe('ACTION_INDEX_VALIDATION_ERROR');
    });

    it('should store context correctly', () => {
      const error = new ActionIndexValidationError('Test', {
        index: 5,
        actionsLength: 3,
      });

      expect(error.context).toEqual({
        index: 5,
        actionsLength: 3,
      });
    });

    it('should maintain BaseError features', () => {
      const error = new ActionIndexValidationError('Test', {
        index: 1,
        actionsLength: 1,
      });

      expect(error.correlationId).toBeDefined();
      expect(error.timestamp).toBeDefined();
      expect(error.stack).toBeDefined();
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON with all data', () => {
      const speech = 'Test speech';
      const thoughts = 'Test thoughts';
      const notes = [{ key: 'value' }];

      const error = new ActionIndexValidationError('Invalid index', {
        index: 5,
        actionsLength: 3,
        speech,
        thoughts,
        notes,
      });

      const json = error.toJSON();

      expect(json.name).toBe('ActionIndexValidationError');
      expect(json.message).toBe('Invalid index');
      expect(json.code).toBe('ACTION_INDEX_VALIDATION_ERROR');
      expect(json.context).toEqual({
        index: 5,
        actionsLength: 3,
      });
      expect(json.severity).toBe('warning');
      expect(json.recoverable).toBe(true);
    });

    it('should format toString correctly', () => {
      const error = new ActionIndexValidationError('Invalid index', {
        index: 5,
        actionsLength: 3,
      });

      const str = error.toString();

      expect(str).toContain('ActionIndexValidationError');
      expect(str).toContain('ACTION_INDEX_VALIDATION_ERROR');
      expect(str).toContain('Invalid index');
      expect(str).toContain('warning');
      expect(str).toContain('true');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string speech', () => {
      const error = new ActionIndexValidationError('Test', {
        index: 1,
        actionsLength: 1,
        speech: '',
      });

      expect(error.llmData.speech).toBe('');
      expect(error.hasPreservedData()).toBe(false); // Empty string is falsy
    });

    it('should handle empty array notes', () => {
      const error = new ActionIndexValidationError('Test', {
        index: 1,
        actionsLength: 1,
        notes: [],
      });

      expect(error.llmData.notes).toEqual([]);
      expect(error.hasPreservedData()).toBe(true); // Empty array is truthy in JavaScript
    });

    it('should handle zero index', () => {
      const error = new ActionIndexValidationError('Test', {
        index: 0,
        actionsLength: 5,
      });

      expect(error.index).toBe(0);
      expect(error.context.index).toBe(0);
    });

    it('should handle negative index', () => {
      const error = new ActionIndexValidationError('Test', {
        index: -1,
        actionsLength: 3,
      });

      expect(error.index).toBe(-1);
      expect(error.context.index).toBe(-1);
    });

    it('should maintain prototype chain', () => {
      const error = new ActionIndexValidationError('Test', {
        index: 1,
        actionsLength: 1,
      });

      expect(error instanceof ActionIndexValidationError).toBe(true);
      expect(error instanceof BaseError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('Use Case Scenarios', () => {
    it('should support fallback factory use case', () => {
      // Simulate LLM returning invalid index but valid speech
      const error = new ActionIndexValidationError(
        'Player chose an index that does not exist for this turn.',
        {
          index: 10,
          actionsLength: 5,
          speech: 'Perhaps I should reconsider my approach...',
          thoughts: 'The merchant seems trustworthy.',
          notes: [{ type: 'observation', content: 'merchant_suspicious' }],
        }
      );

      // Verify error can be used for fallback
      expect(error.hasPreservedData()).toBe(true);
      expect(error.getPreservedSpeech()).toBe(
        'Perhaps I should reconsider my approach...'
      );
      expect(error.isRecoverable()).toBe(true);

      // Verify context is available for logging
      expect(error.index).toBe(10);
      expect(error.actionsLength).toBe(5);
    });

    it('should handle LLM returning only invalid index', () => {
      // Simulate LLM returning invalid index with no other data
      const error = new ActionIndexValidationError(
        'Player chose an index that does not exist for this turn.',
        {
          index: 8,
          actionsLength: 3,
        }
      );

      // Verify fallback should generate generic message
      expect(error.hasPreservedData()).toBe(false);
      expect(error.getPreservedSpeech()).toBeNull();
      expect(error.isRecoverable()).toBe(true);
    });

    it('should preserve complex notes structure', () => {
      const complexNotes = [
        {
          type: 'memory',
          timestamp: '2025-01-01T00:00:00Z',
          content: 'Met the merchant',
        },
        { type: 'emotion', content: 'suspicious' },
        { type: 'relationship', npcId: 'npc_merchant', delta: -5 },
      ];

      const error = new ActionIndexValidationError('Test', {
        index: 1,
        actionsLength: 1,
        notes: complexNotes,
      });

      expect(error.getPreservedNotes()).toEqual(complexNotes);
      expect(error.hasPreservedData()).toBe(true);
    });
  });
});
