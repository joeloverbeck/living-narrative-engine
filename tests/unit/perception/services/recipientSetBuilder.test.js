/**
 * @file Unit tests for RecipientSetBuilder
 * @see src/perception/services/recipientSetBuilder.js
 * @see specs/perception_event_logging_refactor.md - R3: Recipient Set Building Extraction
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import RecipientSetBuilder from '../../../../src/perception/services/recipientSetBuilder.js';

describe('RecipientSetBuilder', () => {
  let mockLogger;
  let mockEntityManager;
  let builder;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      getEntitiesInLocation: jest.fn(),
    };

    builder = new RecipientSetBuilder({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  describe('constructor', () => {
    it('should create service with valid dependencies', () => {
      expect(builder).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'RecipientSetBuilder initialized'
      );
    });

    it('should throw when entityManager is missing getEntitiesInLocation', () => {
      expect(() => {
        new RecipientSetBuilder({
          entityManager: {},
          logger: mockLogger,
        });
      }).toThrow();
    });
  });

  describe('build', () => {
    it('returns explicit recipients when provided', () => {
      mockEntityManager.getEntitiesInLocation.mockReturnValue(
        new Set(['unused'])
      );

      const result = builder.build({
        locationId: 'loc-1',
        explicitRecipients: ['b', 'a', 'b'],
        excludedActors: ['c'],
      });

      expect(result.mode).toBe('explicit');
      expect(result.entityIds).toEqual(new Set(['b', 'a']));
      expect(mockEntityManager.getEntitiesInLocation).not.toHaveBeenCalled();
    });

    it('excludes specified actors from broadcast', () => {
      mockEntityManager.getEntitiesInLocation.mockReturnValue(
        new Set(['a', 'b', 'c'])
      );

      const result = builder.build({
        locationId: 'loc-2',
        explicitRecipients: [],
        excludedActors: ['b'],
      });

      expect(result.mode).toBe('exclusion');
      expect(result.entityIds).toEqual(new Set(['a', 'c']));
      expect(mockEntityManager.getEntitiesInLocation).toHaveBeenCalledWith(
        'loc-2'
      );
    });

    it('returns all in location for broadcast mode', () => {
      const allInLocation = new Set(['a']);
      mockEntityManager.getEntitiesInLocation.mockReturnValue(allInLocation);

      const result = builder.build({
        locationId: 'loc-3',
      });

      expect(result.mode).toBe('broadcast');
      expect(result.entityIds).toBe(allInLocation);
    });

    it('returns empty set for empty location', () => {
      mockEntityManager.getEntitiesInLocation.mockReturnValue(new Set());

      const result = builder.build({
        locationId: 'loc-4',
        explicitRecipients: [],
        excludedActors: [],
      });

      expect(result.mode).toBe('broadcast');
      expect(result.entityIds).toEqual(new Set());
    });

    it('handles null/undefined parameters gracefully', () => {
      mockEntityManager.getEntitiesInLocation.mockReturnValue(
        new Set(['a', 'b'])
      );

      const result = builder.build({
        locationId: 'loc-5',
        explicitRecipients: null,
        excludedActors: undefined,
      });

      expect(result.mode).toBe('broadcast');
      expect(result.entityIds).toEqual(new Set(['a', 'b']));
    });

    it('returns sorted array when deterministic is true', () => {
      const result = builder.build({
        locationId: 'loc-6',
        explicitRecipients: ['b', 'a', 'b'],
        deterministic: true,
      });

      expect(result.mode).toBe('explicit');
      expect(result.entityIds).toEqual(['a', 'b']);
    });
  });
});
