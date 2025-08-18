/**
 * @file Tests for cache helpers (CacheKeys, CacheInvalidation, CacheWarming)
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  CacheKeys,
  CacheInvalidation,
  CacheWarming,
} from '../../../../src/characterBuilder/cache/cacheHelpers.js';
import { createMockLogger } from '../../../common/mockFactories/index.js';

describe('CacheKeys', () => {
  describe('concept keys', () => {
    it('should generate concept key', () => {
      expect(CacheKeys.concept('concept-123')).toBe('concept_concept-123');
    });

    it('should generate all concepts key', () => {
      expect(CacheKeys.allConcepts()).toBe('all_concepts');
    });
  });

  describe('direction keys', () => {
    it('should generate direction key', () => {
      expect(CacheKeys.direction('dir-456')).toBe('direction_dir-456');
    });

    it('should generate directions for concept key', () => {
      expect(CacheKeys.directionsForConcept('concept-123')).toBe(
        'directions_concept_concept-123'
      );
    });
  });

  describe('cliché keys', () => {
    it('should generate clichés for direction key', () => {
      expect(CacheKeys.clichesForDirection('dir-456')).toBe('cliches_dir-456');
    });
  });

  describe('motivation keys', () => {
    it('should generate motivations for direction key', () => {
      expect(CacheKeys.motivationsForDirection('dir-456')).toBe(
        'motivations_dir-456'
      );
    });

    it('should generate motivations for concept key', () => {
      expect(CacheKeys.motivationsForConcept('concept-123')).toBe(
        'motivations_concept_concept-123'
      );
    });

    it('should generate motivation stats key', () => {
      expect(CacheKeys.motivationStats('concept-123')).toBe(
        'motivation_stats_concept-123'
      );
    });
  });

  describe('generation keys', () => {
    it('should generate generation in progress key', () => {
      expect(CacheKeys.generationInProgress('dir-456')).toBe(
        'generating_dir-456'
      );
    });

    it('should generate last generation key', () => {
      expect(CacheKeys.lastGeneration('dir-456')).toBe('last_gen_dir-456');
    });
  });
});

describe('CacheInvalidation', () => {
  let mockCache;

  beforeEach(() => {
    mockCache = {
      delete: jest.fn(),
      invalidatePattern: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('invalidateConcept', () => {
    it('should invalidate all concept-related caches', () => {
      CacheInvalidation.invalidateConcept(mockCache, 'concept-123');

      expect(mockCache.delete).toHaveBeenCalledWith('concept_concept-123');
      expect(mockCache.delete).toHaveBeenCalledWith('all_concepts');
      expect(mockCache.invalidatePattern).toHaveBeenCalledWith(
        expect.any(RegExp)
      );

      // Verify the regex pattern
      const regexCall = mockCache.invalidatePattern.mock.calls[0][0];
      expect(regexCall.test('concept_concept-123')).toBe(true);
      expect(regexCall.test('directions_concept_concept-123')).toBe(true);
      expect(regexCall.test('unrelated_key')).toBe(false);
    });
  });

  describe('invalidateDirection', () => {
    it('should invalidate all direction-related caches', () => {
      CacheInvalidation.invalidateDirection(mockCache, 'dir-456');

      expect(mockCache.delete).toHaveBeenCalledWith('direction_dir-456');
      expect(mockCache.delete).toHaveBeenCalledWith('cliches_dir-456');
      expect(mockCache.delete).toHaveBeenCalledWith('motivations_dir-456');
      expect(mockCache.invalidatePattern).toHaveBeenCalledWith(
        expect.any(RegExp)
      );

      // Verify the regex pattern
      const regexCall = mockCache.invalidatePattern.mock.calls[0][0];
      expect(regexCall.test('direction_dir-456')).toBe(true);
      expect(regexCall.test('last_gen_dir-456')).toBe(true);
      expect(regexCall.test('unrelated_key')).toBe(false);
    });
  });

  describe('invalidateMotivations', () => {
    it('should invalidate motivation caches with direction only', () => {
      CacheInvalidation.invalidateMotivations(mockCache, 'dir-456');

      expect(mockCache.delete).toHaveBeenCalledWith('motivations_dir-456');
      expect(mockCache.delete).toHaveBeenCalledTimes(1);
    });

    it('should invalidate motivation caches with direction and concept', () => {
      CacheInvalidation.invalidateMotivations(
        mockCache,
        'dir-456',
        'concept-123'
      );

      expect(mockCache.delete).toHaveBeenCalledWith('motivations_dir-456');
      expect(mockCache.delete).toHaveBeenCalledWith(
        'motivations_concept_concept-123'
      );
      expect(mockCache.delete).toHaveBeenCalledWith(
        'motivation_stats_concept-123'
      );
      expect(mockCache.delete).toHaveBeenCalledTimes(3);
    });
  });
});

describe('CacheWarming', () => {
  let mockCache;
  let mockService;
  let mockLogger;

  beforeEach(() => {
    mockCache = {
      set: jest.fn(),
    };

    mockService = {
      getAllCharacterConcepts: jest.fn(),
      getThematicDirectionsByConceptId: jest.fn(),
    };

    mockLogger = createMockLogger();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('warmCache', () => {
    it('should warm cache with all concepts and recent concept directions', async () => {
      const mockConcepts = [
        { id: 'concept-1', name: 'Concept 1' },
        { id: 'concept-2', name: 'Concept 2' },
        { id: 'concept-3', name: 'Recent Concept' },
      ];

      const mockDirections = [
        { id: 'dir-1', conceptId: 'concept-3', title: 'Direction 1' },
        { id: 'dir-2', conceptId: 'concept-3', title: 'Direction 2' },
      ];

      mockService.getAllCharacterConcepts.mockResolvedValue(mockConcepts);
      mockService.getThematicDirectionsByConceptId.mockResolvedValue(
        mockDirections
      );

      await CacheWarming.warmCache(mockCache, mockService, mockLogger);

      // Should cache all concepts
      expect(mockCache.set).toHaveBeenCalledWith(
        'all_concepts',
        mockConcepts,
        'concepts'
      );

      // Should cache directions for the most recent concept
      expect(mockService.getThematicDirectionsByConceptId).toHaveBeenCalledWith(
        'concept-3'
      );
      expect(mockCache.set).toHaveBeenCalledWith(
        'directions_concept_concept-3',
        mockDirections,
        'directions'
      );

      // Should log debug messages
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Cache warmed with all concepts'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Cache warmed with directions for concept concept-3'
      );
    });

    it('should handle empty concepts gracefully', async () => {
      mockService.getAllCharacterConcepts.mockResolvedValue([]);

      await CacheWarming.warmCache(mockCache, mockService, mockLogger);

      // Should cache empty concepts but not try to get directions
      expect(mockCache.set).toHaveBeenCalledWith(
        'all_concepts',
        [],
        'concepts'
      );
      expect(
        mockService.getThematicDirectionsByConceptId
      ).not.toHaveBeenCalled();
    });

    it('should handle null concepts gracefully', async () => {
      mockService.getAllCharacterConcepts.mockResolvedValue(null);

      await CacheWarming.warmCache(mockCache, mockService, mockLogger);

      // Should not cache anything
      expect(mockCache.set).not.toHaveBeenCalled();
      expect(
        mockService.getThematicDirectionsByConceptId
      ).not.toHaveBeenCalled();
    });

    it('should cache concepts but skip directions if getThematicDirectionsByConceptId fails', async () => {
      const mockConcepts = [{ id: 'concept-1', name: 'Concept 1' }];

      mockService.getAllCharacterConcepts.mockResolvedValue(mockConcepts);
      mockService.getThematicDirectionsByConceptId.mockResolvedValue(null);

      await CacheWarming.warmCache(mockCache, mockService, mockLogger);

      // Should cache concepts
      expect(mockCache.set).toHaveBeenCalledWith(
        'all_concepts',
        mockConcepts,
        'concepts'
      );

      // Should try to get directions but not cache them
      expect(mockService.getThematicDirectionsByConceptId).toHaveBeenCalledWith(
        'concept-1'
      );
      expect(mockCache.set).toHaveBeenCalledTimes(1); // Only concepts cached
    });

    it('should handle service errors gracefully without throwing', async () => {
      const error = new Error('Service error');
      mockService.getAllCharacterConcepts.mockRejectedValue(error);

      await expect(
        CacheWarming.warmCache(mockCache, mockService, mockLogger)
      ).resolves.not.toThrow();

      // Should log the error
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Cache warming failed:',
        error
      );

      // Should not cache anything
      expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('should handle partial errors gracefully', async () => {
      const mockConcepts = [{ id: 'concept-1', name: 'Concept 1' }];

      mockService.getAllCharacterConcepts.mockResolvedValue(mockConcepts);
      mockService.getThematicDirectionsByConceptId.mockRejectedValue(
        new Error('Directions error')
      );

      await expect(
        CacheWarming.warmCache(mockCache, mockService, mockLogger)
      ).resolves.not.toThrow();

      // Should cache concepts
      expect(mockCache.set).toHaveBeenCalledWith(
        'all_concepts',
        mockConcepts,
        'concepts'
      );

      // Should log the error
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Cache warming failed:',
        expect.any(Error)
      );
    });

    it('should not warm directions if concepts is empty array', async () => {
      mockService.getAllCharacterConcepts.mockResolvedValue([]);

      await CacheWarming.warmCache(mockCache, mockService, mockLogger);

      expect(
        mockService.getThematicDirectionsByConceptId
      ).not.toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalledWith(
        'all_concepts',
        [],
        'concepts'
      );
    });
  });
});
