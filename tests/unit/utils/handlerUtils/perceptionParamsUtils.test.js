/**
 * @file Unit tests for perceptionParamsUtils
 * @see src/utils/handlerUtils/perceptionParamsUtils.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  validateLocationId,
  normalizeEntityIds,
  validateRecipientExclusionExclusivity,
  buildLogEntry,
} from '../../../../src/utils/handlerUtils/perceptionParamsUtils.js';

describe('perceptionParamsUtils', () => {
  let mockDispatcher;
  let mockLogger;

  beforeEach(() => {
    mockDispatcher = {
      dispatch: jest.fn(),
    };
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  describe('validateLocationId', () => {
    it('should return trimmed location_id for valid input', () => {
      const result = validateLocationId(
        '  location:tavern  ',
        'TEST_OPERATION',
        mockDispatcher,
        mockLogger
      );

      expect(result).toBe('location:tavern');
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should return null and dispatch error for empty string', () => {
      const result = validateLocationId(
        '',
        'TEST_OPERATION',
        mockDispatcher,
        mockLogger
      );

      expect(result).toBeNull();
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: 'TEST_OPERATION: location_id is required',
        })
      );
    });

    it('should return null and dispatch error for whitespace-only string', () => {
      const result = validateLocationId(
        '   ',
        'TEST_OPERATION',
        mockDispatcher,
        mockLogger
      );

      expect(result).toBeNull();
      expect(mockDispatcher.dispatch).toHaveBeenCalled();
    });

    it('should return null and dispatch error for null', () => {
      const result = validateLocationId(
        null,
        'TEST_OPERATION',
        mockDispatcher,
        mockLogger
      );

      expect(result).toBeNull();
      expect(mockDispatcher.dispatch).toHaveBeenCalled();
    });

    it('should return null and dispatch error for undefined', () => {
      const result = validateLocationId(
        undefined,
        'TEST_OPERATION',
        mockDispatcher,
        mockLogger
      );

      expect(result).toBeNull();
      expect(mockDispatcher.dispatch).toHaveBeenCalled();
    });

    it('should return null and dispatch error for non-string type', () => {
      const result = validateLocationId(
        123,
        'TEST_OPERATION',
        mockDispatcher,
        mockLogger
      );

      expect(result).toBeNull();
      expect(mockDispatcher.dispatch).toHaveBeenCalled();
    });
  });

  describe('normalizeEntityIds', () => {
    it('should return empty array for undefined', () => {
      expect(normalizeEntityIds(undefined)).toEqual([]);
    });

    it('should return empty array for null', () => {
      expect(normalizeEntityIds(null)).toEqual([]);
    });

    it('should return empty array for empty array', () => {
      expect(normalizeEntityIds([])).toEqual([]);
    });

    it('should filter out non-string elements', () => {
      const result = normalizeEntityIds(['actor:1', 123, 'actor:2', null, undefined]);
      expect(result).toEqual(['actor:1', 'actor:2']);
    });

    it('should trim whitespace from string elements', () => {
      const result = normalizeEntityIds(['  actor:1  ', 'actor:2  ']);
      expect(result).toEqual(['actor:1', 'actor:2']);
    });

    it('should filter out empty/whitespace-only strings', () => {
      const result = normalizeEntityIds(['actor:1', '', '   ', 'actor:2']);
      expect(result).toEqual(['actor:1', 'actor:2']);
    });

    it('should convert single string to array', () => {
      const result = normalizeEntityIds('actor:1');
      expect(result).toEqual(['actor:1']);
    });

    it('should trim single string input', () => {
      const result = normalizeEntityIds('  actor:1  ');
      expect(result).toEqual(['actor:1']);
    });

    it('should return empty array for empty string', () => {
      const result = normalizeEntityIds('');
      expect(result).toEqual([]);
    });

    it('should return empty array for whitespace-only string', () => {
      const result = normalizeEntityIds('   ');
      expect(result).toEqual([]);
    });

    it('should return empty array for non-array non-string input', () => {
      expect(normalizeEntityIds(123)).toEqual([]);
      expect(normalizeEntityIds({})).toEqual([]);
      expect(normalizeEntityIds(true)).toEqual([]);
    });
  });

  describe('validateRecipientExclusionExclusivity', () => {
    describe('when no conflict exists', () => {
      it('should return true when only recipients provided', () => {
        const result = validateRecipientExclusionExclusivity(
          ['actor:1', 'actor:2'],
          [],
          'TEST_OPERATION',
          mockDispatcher,
          mockLogger,
          'error'
        );

        expect(result).toBe(true);
        expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
      });

      it('should return true when only exclusions provided', () => {
        const result = validateRecipientExclusionExclusivity(
          [],
          ['actor:1', 'actor:2'],
          'TEST_OPERATION',
          mockDispatcher,
          mockLogger,
          'error'
        );

        expect(result).toBe(true);
        expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
      });

      it('should return true when both arrays are empty', () => {
        const result = validateRecipientExclusionExclusivity(
          [],
          [],
          'TEST_OPERATION',
          mockDispatcher,
          mockLogger,
          'error'
        );

        expect(result).toBe(true);
        expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
      });
    });

    describe('when conflict exists with error behavior', () => {
      it('should return false and dispatch error', () => {
        const result = validateRecipientExclusionExclusivity(
          ['actor:1'],
          ['actor:2'],
          'TEST_OPERATION',
          mockDispatcher,
          mockLogger,
          'error'
        );

        expect(result).toBe(false);
        expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
          'core:system_error_occurred',
          expect.objectContaining({
            message: 'TEST_OPERATION: recipientIds and excludedActorIds are mutually exclusive',
          })
        );
        expect(mockLogger.warn).not.toHaveBeenCalled();
      });
    });

    describe('when conflict exists with warn behavior', () => {
      it('should return true and log warning', () => {
        const result = validateRecipientExclusionExclusivity(
          ['actor:1'],
          ['actor:2'],
          'TEST_OPERATION',
          mockDispatcher,
          mockLogger,
          'warn'
        );

        expect(result).toBe(true);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'TEST_OPERATION: recipientIds and excludedActorIds both provided; using recipientIds only'
        );
        expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
      });
    });

    describe('default behavior', () => {
      it('should default to error behavior when behavior not specified', () => {
        const result = validateRecipientExclusionExclusivity(
          ['actor:1'],
          ['actor:2'],
          'TEST_OPERATION',
          mockDispatcher,
          mockLogger
        );

        expect(result).toBe(false);
        expect(mockDispatcher.dispatch).toHaveBeenCalled();
      });
    });
  });

  describe('buildLogEntry', () => {
    it('should build complete log entry with all fields', () => {
      const result = buildLogEntry({
        descriptionText: 'Alice speaks to Bob',
        timestamp: '2024-01-01T12:00:00Z',
        perceptionType: 'communication.speech',
        actorId: 'actor:alice',
        targetId: 'actor:bob',
        involvedEntities: ['item:microphone'],
      });

      expect(result).toEqual({
        descriptionText: 'Alice speaks to Bob',
        timestamp: '2024-01-01T12:00:00Z',
        perceptionType: 'communication.speech',
        actorId: 'actor:alice',
        targetId: 'actor:bob',
        involvedEntities: ['item:microphone'],
      });
    });

    it('should default targetId to null when not provided', () => {
      const result = buildLogEntry({
        descriptionText: 'Alice speaks',
        timestamp: '2024-01-01T12:00:00Z',
        perceptionType: 'communication.speech',
        actorId: 'actor:alice',
      });

      expect(result.targetId).toBeNull();
    });

    it('should default involvedEntities to empty array when not provided', () => {
      const result = buildLogEntry({
        descriptionText: 'Alice speaks',
        timestamp: '2024-01-01T12:00:00Z',
        perceptionType: 'communication.speech',
        actorId: 'actor:alice',
      });

      expect(result.involvedEntities).toEqual([]);
    });

    it('should normalize targetId null-ish values to null', () => {
      const result = buildLogEntry({
        descriptionText: 'Alice speaks',
        timestamp: '2024-01-01T12:00:00Z',
        perceptionType: 'communication.speech',
        actorId: 'actor:alice',
        targetId: undefined,
      });

      expect(result.targetId).toBeNull();
    });

    it('should normalize non-array involvedEntities to empty array', () => {
      const result = buildLogEntry({
        descriptionText: 'Alice speaks',
        timestamp: '2024-01-01T12:00:00Z',
        perceptionType: 'communication.speech',
        actorId: 'actor:alice',
        involvedEntities: 'not-an-array',
      });

      expect(result.involvedEntities).toEqual([]);
    });
  });
});
