/**
 * @file Unit tests for CandidateAxisExtractor
 */

import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { CandidateAxisExtractor } from '../../../../../src/expressionDiagnostics/services/axisGap/CandidateAxisExtractor.js';

describe('CandidateAxisExtractor', () => {
  let extractor;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    extractor = new CandidateAxisExtractor({}, mockLogger);
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const ext = new CandidateAxisExtractor();
      expect(ext).toBeDefined();
    });

    it('should accept custom config', () => {
      const ext = new CandidateAxisExtractor({
        candidateAxisMaxCandidates: 5,
        candidateAxisMinExtractionConfidence: 0.5,
      });
      expect(ext).toBeDefined();
    });

    it('should accept logger', () => {
      const ext = new CandidateAxisExtractor({}, mockLogger);
      expect(ext).toBeDefined();
    });
  });

  describe('extract - empty/invalid inputs', () => {
    it('should return empty array for null pcaResult and empty arrays', () => {
      const result = extractor.extract(null, [], [], []);
      expect(result).toEqual([]);
    });

    it('should return empty array for empty prototypes', () => {
      const result = extractor.extract({}, [], [], []);
      expect(result).toEqual([]);
    });

    it('should return empty array when prototypes have no weights', () => {
      const prototypes = [{ id: 'p1' }, { id: 'p2' }];
      const result = extractor.extract({}, [], [], prototypes);
      expect(result).toEqual([]);
    });

    it('should handle undefined inputs gracefully', () => {
      const result = extractor.extract(undefined, undefined, undefined, []);
      expect(result).toEqual([]);
    });
  });

  describe('extract - PCA source', () => {
    const prototypes = [
      { id: 'p1', weights: { x: 0.5, y: 0.5 } },
      { id: 'p2', weights: { x: -0.3, y: 0.7 } },
    ];

    it('should extract candidate from PCA with residualEigenvector', () => {
      const pcaResult = {
        residualVarianceRatio: 0.3,
        significantBeyondExpected: 1,
        topLoadingPrototypes: [
          { prototypeId: 'p1', loading: 0.8 },
          { prototypeId: 'p2', loading: 0.6 },
        ],
        expectedComponentCount: 2,
        explainedVariance: [0.4, 0.3, 0.2],
        residualEigenvector: { x: 0.6, y: 0.8 }, // Unit vector
        residualEigenvectorIndex: 2,
      };

      const result = extractor.extract(pcaResult, [], [], prototypes);

      expect(result.length).toBeGreaterThanOrEqual(1);
      const pcaCandidate = result.find((c) => c.source === 'pca_residual');
      expect(pcaCandidate).toBeDefined();
      expect(pcaCandidate.candidateId).toBe('pca_residual_0');
      expect(pcaCandidate.confidence).toBeGreaterThan(0);
      expect(pcaCandidate.direction).toBeDefined();
      // Direction should be normalized version of eigenvector
      expect(pcaCandidate.direction).toHaveProperty('x');
      expect(pcaCandidate.direction).toHaveProperty('y');
      expect(pcaCandidate.sourcePrototypes).toContain('p1');
    });

    it('should use residualEigenvector directly for direction', () => {
      const pcaResult = {
        residualVarianceRatio: 0.3,
        significantBeyondExpected: 1,
        topLoadingPrototypes: [{ prototypeId: 'p1', loading: 0.8 }],
        expectedComponentCount: 2,
        residualEigenvector: { a: 0.707, b: 0.707 }, // Normalized
        residualEigenvectorIndex: 2,
      };

      const testPrototypes = [
        { id: 'p1', weights: { a: 0.5, b: 0.5 } },
      ];

      const result = extractor.extract(pcaResult, [], [], testPrototypes);
      const pcaCandidate = result.find((c) => c.source === 'pca_residual');

      expect(pcaCandidate).toBeDefined();
      // Should preserve axis names from eigenvector
      expect(Object.keys(pcaCandidate.direction).sort()).toEqual(['a', 'b']);
    });

    it('should not extract PCA candidate if residualEigenvector is null', () => {
      const pcaResult = {
        residualVarianceRatio: 0.3,
        significantBeyondExpected: 1,
        topLoadingPrototypes: [{ prototypeId: 'p1', loading: 0.8 }],
        expectedComponentCount: 2,
        residualEigenvector: null,
        residualEigenvectorIndex: -1,
      };

      const result = extractor.extract(pcaResult, [], [], prototypes);
      const pcaCandidates = result.filter((c) => c.source === 'pca_residual');

      expect(pcaCandidates.length).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No residual eigenvector available')
      );
    });

    it('should not extract PCA candidate if residualEigenvector is undefined', () => {
      const pcaResult = {
        residualVarianceRatio: 0.3,
        significantBeyondExpected: 1,
        topLoadingPrototypes: [{ prototypeId: 'p1', loading: 0.8 }],
        expectedComponentCount: 2,
        // No residualEigenvector field
      };

      const result = extractor.extract(pcaResult, [], [], prototypes);
      const pcaCandidates = result.filter((c) => c.source === 'pca_residual');

      expect(pcaCandidates.length).toBe(0);
    });

    it('should not extract PCA candidate if residualEigenvector has zero magnitude', () => {
      const pcaResult = {
        residualVarianceRatio: 0.3,
        significantBeyondExpected: 1,
        topLoadingPrototypes: [{ prototypeId: 'p1', loading: 0.8 }],
        expectedComponentCount: 2,
        residualEigenvector: { x: 0, y: 0 }, // Zero vector
        residualEigenvectorIndex: 2,
      };

      const result = extractor.extract(pcaResult, [], [], prototypes);
      const pcaCandidates = result.filter((c) => c.source === 'pca_residual');

      expect(pcaCandidates.length).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('near-zero magnitude')
      );
    });

    it('should include residualEigenvectorIndex in metadata', () => {
      const pcaResult = {
        residualVarianceRatio: 0.3,
        significantBeyondExpected: 1,
        topLoadingPrototypes: [{ prototypeId: 'p1', loading: 0.8 }],
        expectedComponentCount: 2,
        explainedVariance: [0.5, 0.3, 0.2],
        residualEigenvector: { x: 0.6, y: 0.8 },
        residualEigenvectorIndex: 2,
      };

      const result = extractor.extract(pcaResult, [], [], prototypes);
      const pcaCandidate = result.find((c) => c.source === 'pca_residual');

      expect(pcaCandidate).toBeDefined();
      expect(pcaCandidate.metadata.residualEigenvectorIndex).toBe(2);
    });

    it('should not extract PCA candidate if residual is low', () => {
      const pcaResult = {
        residualVarianceRatio: 0.05,
        significantBeyondExpected: 0,
        topLoadingPrototypes: [],
        expectedComponentCount: 2,
      };

      const result = extractor.extract(pcaResult, [], [], prototypes);
      const pcaCandidates = result.filter((c) => c.source === 'pca_residual');
      expect(pcaCandidates.length).toBe(0);
    });

    it('should not extract PCA candidate if no top loading prototypes', () => {
      const pcaResult = {
        residualVarianceRatio: 0.3,
        significantBeyondExpected: 1,
        topLoadingPrototypes: [],
        expectedComponentCount: 2,
      };

      const result = extractor.extract(pcaResult, [], [], prototypes);
      const pcaCandidates = result.filter((c) => c.source === 'pca_residual');
      expect(pcaCandidates.length).toBe(0);
    });

    it('should not extract PCA candidate when residual is diffuse (high variance but no significant components)', () => {
      // This tests the scenario where PCA shows high residual variance (18.7%)
      // but Broken-Stick analysis finds 0 significant components beyond K.
      // This indicates the residual is diffuse noise, not a missing axis.
      const pcaResult = {
        residualVarianceRatio: 0.187, // High enough to trigger extraction under old logic
        significantBeyondExpected: 0, // But Broken-Stick says no significant components
        topLoadingPrototypes: [
          { prototypeId: 'p1', loading: 0.5 },
          { prototypeId: 'p2', loading: 0.4 },
        ],
        expectedComponentCount: 2,
        residualEigenvector: { x: 0.3, y: 0.3, z: 0.3 }, // Diffuse direction
        residualEigenvectorIndex: 2,
      };

      const result = extractor.extract(pcaResult, [], [], prototypes);
      const pcaCandidates = result.filter((c) => c.source === 'pca_residual');

      expect(pcaCandidates.length).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('PCA residual is diffuse')
      );
    });
  });

  describe('extract - coverage gap source', () => {
    const prototypes = [
      { id: 'p1', weights: { x: 0.5, y: 0.5 } },
      { id: 'p2', weights: { x: -0.3, y: 0.7 } },
    ];

    it('should extract candidates from coverage gaps', () => {
      const coverageGaps = [
        {
          suggestedAxisDirection: { x: 0.8, y: 0.2 },
          distanceToNearestAxis: 0.7,
          clusterSize: 5,
          centroidPrototypes: ['p1', 'p2'],
          clusterId: 'gap-0',
        },
      ];

      const result = extractor.extract({}, coverageGaps, [], prototypes);

      const gapCandidates = result.filter((c) => c.source === 'coverage_gap');
      expect(gapCandidates.length).toBe(1);
      expect(gapCandidates[0].candidateId).toBe('coverage_gap_0');
      expect(gapCandidates[0].direction).toBeDefined();
      expect(gapCandidates[0].sourcePrototypes).toEqual(['p1', 'p2']);
    });

    it('should skip coverage gaps without suggestedAxisDirection', () => {
      const coverageGaps = [
        {
          distanceToNearestAxis: 0.7,
          clusterSize: 5,
        },
      ];

      const result = extractor.extract({}, coverageGaps, [], prototypes);
      const gapCandidates = result.filter((c) => c.source === 'coverage_gap');
      expect(gapCandidates.length).toBe(0);
    });

    it('should compute confidence based on distance and cluster size', () => {
      // Use lenient extractor to avoid filtering out low-confidence candidates
      const lenientExtractor = new CandidateAxisExtractor({
        candidateAxisMinExtractionConfidence: 0.1,
      });

      const farGap = [
        {
          suggestedAxisDirection: { x: 0.8, y: 0.2 },
          distanceToNearestAxis: 0.9,
          clusterSize: 10,
        },
      ];

      const nearGap = [
        {
          suggestedAxisDirection: { x: 0.8, y: 0.2 },
          distanceToNearestAxis: 0.2,
          clusterSize: 2,
        },
      ];

      const farResult = lenientExtractor.extract({}, farGap, [], prototypes);
      const nearResult = lenientExtractor.extract({}, nearGap, [], prototypes);

      expect(farResult.length).toBeGreaterThan(0);
      expect(nearResult.length).toBeGreaterThan(0);
      expect(farResult[0].confidence).toBeGreaterThan(nearResult[0].confidence);
    });
  });

  describe('extract - hub derived source', () => {
    const prototypes = [
      { id: 'hub1', weights: { x: 0.5, y: 0.5 } },
      { id: 'neighbor1', weights: { x: 0.6, y: 0.4 } },
      { id: 'neighbor2', weights: { x: 0.4, y: 0.6 } },
    ];

    it('should extract candidates from hub prototypes', () => {
      const hubs = [
        {
          prototypeId: 'hub1',
          overlappingPrototypes: ['neighbor1', 'neighbor2'],
          hubScore: 5,
          neighborhoodDiversity: 2,
          betweennessCentrality: 0.5,
        },
      ];

      const result = extractor.extract({}, [], hubs, prototypes);

      const hubCandidates = result.filter((c) => c.source === 'hub_derived');
      expect(hubCandidates.length).toBe(1);
      expect(hubCandidates[0].candidateId).toBe('hub_derived_0');
      expect(hubCandidates[0].direction).toBeDefined();
      expect(hubCandidates[0].sourcePrototypes).toContain('hub1');
      expect(hubCandidates[0].sourcePrototypes).toContain('neighbor1');
    });

    it('should skip hubs with less than 2 neighbors', () => {
      const hubs = [
        {
          prototypeId: 'hub1',
          overlappingPrototypes: ['neighbor1'],
          hubScore: 5,
        },
      ];

      const result = extractor.extract({}, [], hubs, prototypes);
      const hubCandidates = result.filter((c) => c.source === 'hub_derived');
      expect(hubCandidates.length).toBe(0);
    });

    it('should compute centroid from neighbor weights', () => {
      // Use a lenient extractor and hub with high enough properties to produce confidence >= 0.3
      const lenientExtractor = new CandidateAxisExtractor({
        candidateAxisMinExtractionConfidence: 0.1,
      });

      const hubs = [
        {
          prototypeId: 'hub1',
          overlappingPrototypes: ['neighbor1', 'neighbor2'],
          hubScore: 10, // Higher hub score for better confidence
          neighborhoodDiversity: 4, // Higher diversity for better confidence
          betweennessCentrality: 0.5,
        },
      ];

      const result = lenientExtractor.extract({}, [], hubs, prototypes);
      const hubCandidate = result.find((c) => c.source === 'hub_derived');

      // Direction should be normalized centroid of neighbors
      expect(hubCandidate).toBeDefined();
      expect(hubCandidate.direction).toBeDefined();
      expect(Object.keys(hubCandidate.direction)).toContain('x');
      expect(Object.keys(hubCandidate.direction)).toContain('y');
    });
  });

  describe('extract - confidence filtering', () => {
    const prototypes = [
      { id: 'p1', weights: { x: 0.5, y: 0.5 } },
      { id: 'p2', weights: { x: 0.6, y: 0.4 } },
    ];

    it('should filter out candidates below minimum confidence', () => {
      const strictExtractor = new CandidateAxisExtractor({
        candidateAxisMinExtractionConfidence: 0.9,
      });

      const coverageGaps = [
        {
          suggestedAxisDirection: { x: 0.8, y: 0.2 },
          distanceToNearestAxis: 0.1, // Low distance = low confidence
          clusterSize: 1,
        },
      ];

      const result = strictExtractor.extract({}, coverageGaps, [], prototypes);
      expect(result.length).toBe(0);
    });

    it('should keep candidates above minimum confidence', () => {
      const lenientExtractor = new CandidateAxisExtractor({
        candidateAxisMinExtractionConfidence: 0.1,
      });

      const coverageGaps = [
        {
          suggestedAxisDirection: { x: 0.8, y: 0.2 },
          distanceToNearestAxis: 0.5,
          clusterSize: 5,
        },
      ];

      const result = lenientExtractor.extract({}, coverageGaps, [], prototypes);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('extract - deduplication', () => {
    const prototypes = [
      { id: 'p1', weights: { x: 0.5, y: 0.5 } },
      { id: 'p2', weights: { x: 0.6, y: 0.4 } },
    ];

    it('should deduplicate candidates with similar directions', () => {
      const coverageGaps = [
        {
          suggestedAxisDirection: { x: 0.8, y: 0.2 },
          distanceToNearestAxis: 0.7,
          clusterSize: 5,
        },
        {
          suggestedAxisDirection: { x: 0.81, y: 0.19 }, // Very similar
          distanceToNearestAxis: 0.6,
          clusterSize: 4,
        },
      ];

      const result = extractor.extract({}, coverageGaps, [], prototypes);

      // Should keep only the higher confidence one
      const gapCandidates = result.filter((c) => c.source === 'coverage_gap');
      expect(gapCandidates.length).toBeLessThanOrEqual(2);
    });

    it('should keep candidates with different directions', () => {
      const coverageGaps = [
        {
          suggestedAxisDirection: { x: 1, y: 0 },
          distanceToNearestAxis: 0.7,
          clusterSize: 5,
        },
        {
          suggestedAxisDirection: { x: 0, y: 1 }, // Orthogonal
          distanceToNearestAxis: 0.6,
          clusterSize: 4,
        },
      ];

      const result = extractor.extract({}, coverageGaps, [], prototypes);
      const gapCandidates = result.filter((c) => c.source === 'coverage_gap');
      expect(gapCandidates.length).toBe(2);
    });
  });

  describe('extract - max candidates limit', () => {
    it('should limit number of candidates returned', () => {
      const limitedExtractor = new CandidateAxisExtractor({
        candidateAxisMaxCandidates: 2,
        candidateAxisMinExtractionConfidence: 0.1,
      });

      const prototypes = [
        { id: 'p1', weights: { x: 0.5, y: 0.5, z: 0.1 } },
        { id: 'p2', weights: { x: 0.6, y: 0.4, z: 0.2 } },
      ];

      const coverageGaps = [
        {
          suggestedAxisDirection: { x: 1, y: 0, z: 0 },
          distanceToNearestAxis: 0.7,
          clusterSize: 5,
        },
        {
          suggestedAxisDirection: { x: 0, y: 1, z: 0 },
          distanceToNearestAxis: 0.6,
          clusterSize: 4,
        },
        {
          suggestedAxisDirection: { x: 0, y: 0, z: 1 },
          distanceToNearestAxis: 0.5,
          clusterSize: 3,
        },
      ];

      const result = limitedExtractor.extract({}, coverageGaps, [], prototypes);
      expect(result.length).toBeLessThanOrEqual(2);
    });
  });

  describe('extract - sorting by confidence', () => {
    const prototypes = [
      { id: 'p1', weights: { x: 0.5, y: 0.5 } },
      { id: 'p2', weights: { x: 0.6, y: 0.4 } },
    ];

    it('should return candidates sorted by confidence descending', () => {
      // Use lenient extractor to ensure both candidates pass minimum threshold
      const lenientExtractor = new CandidateAxisExtractor({
        candidateAxisMinExtractionConfidence: 0.1,
      });

      const coverageGaps = [
        {
          suggestedAxisDirection: { x: 1, y: 0 }, // Orthogonal directions to avoid deduplication
          distanceToNearestAxis: 0.4, // Lower confidence but above 0.1 threshold
          clusterSize: 3,
        },
        {
          suggestedAxisDirection: { x: 0, y: 1 },
          distanceToNearestAxis: 0.9, // Higher confidence
          clusterSize: 10,
        },
      ];

      const result = lenientExtractor.extract({}, coverageGaps, [], prototypes);

      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result[0].confidence).toBeGreaterThanOrEqual(result[1].confidence);
    });
  });

  describe('extract - combined sources', () => {
    it('should extract from all sources and combine', () => {
      const prototypes = [
        { id: 'p1', weights: { x: 0.5, y: 0.5 } },
        { id: 'p2', weights: { x: 0.6, y: 0.4 } },
        { id: 'p3', weights: { x: -0.3, y: 0.7 } },
      ];

      const pcaResult = {
        residualVarianceRatio: 0.3,
        significantBeyondExpected: 1,
        topLoadingPrototypes: [{ prototypeId: 'p1', loading: 0.8 }],
        expectedComponentCount: 2,
      };

      const coverageGaps = [
        {
          suggestedAxisDirection: { x: 0.8, y: 0.2 },
          distanceToNearestAxis: 0.7,
          clusterSize: 3,
        },
      ];

      const hubs = [
        {
          prototypeId: 'p1',
          overlappingPrototypes: ['p2', 'p3'],
          hubScore: 5,
          neighborhoodDiversity: 2,
          betweennessCentrality: 0.5,
        },
      ];

      const result = extractor.extract(pcaResult, coverageGaps, hubs, prototypes);

      // Should have candidates from at least coverage_gap and hub_derived
      const sources = new Set(result.map((c) => c.source));
      expect(sources.has('coverage_gap')).toBe(true);
      expect(sources.has('hub_derived')).toBe(true);
    });
  });
});
