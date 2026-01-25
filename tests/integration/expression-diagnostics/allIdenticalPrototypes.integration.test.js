/**
 * @file Integration tests for edge case: all identical prototypes
 *
 * Documents expected behavior when all prototypes have identical constraint values.
 * This is a degenerate case (zero variance) that could cause issues if not handled.
 *
 * Research finding: All three axis-space-analysis services handle this correctly.
 * See Issue 9 in reports/axis-space-analysis.md section 10.3.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PCAAnalysisService } from '../../../src/expressionDiagnostics/services/axisGap/PCAAnalysisService.js';
import { HubPrototypeDetector } from '../../../src/expressionDiagnostics/services/axisGap/HubPrototypeDetector.js';
import { CoverageGapDetector } from '../../../src/expressionDiagnostics/services/axisGap/CoverageGapDetector.js';

describe('All Identical Prototypes Edge Case', () => {
  describe('PCAAnalysisService', () => {
    let service;

    beforeEach(() => {
      service = new PCAAnalysisService();
    });

    it('should return empty result when all prototypes have identical weights', () => {
      // Arrange: Create prototypes with exactly the same weights
      const identicalPrototypes = [
        { id: 'proto1', weights: { valence: 0.5, arousal: 0.3, dominance: 0.2 } },
        { id: 'proto2', weights: { valence: 0.5, arousal: 0.3, dominance: 0.2 } },
        { id: 'proto3', weights: { valence: 0.5, arousal: 0.3, dominance: 0.2 } },
        { id: 'proto4', weights: { valence: 0.5, arousal: 0.3, dominance: 0.2 } },
        { id: 'proto5', weights: { valence: 0.5, arousal: 0.3, dominance: 0.2 } },
      ];

      // Act
      const result = service.analyze(identicalPrototypes);

      // Assert: Zero variance means no significant components
      expect(result.residualVarianceRatio).toBe(0);
      expect(result.topLoadingPrototypes).toEqual([]);
      expect(result.dimensionsUsed).toEqual([]);
    });

    it('should return empty result when all prototypes have zero weights', () => {
      // Arrange: All prototypes at the neutral point
      const zeroPrototypes = [
        { id: 'proto1', weights: { valence: 0, arousal: 0, dominance: 0 } },
        { id: 'proto2', weights: { valence: 0, arousal: 0, dominance: 0 } },
        { id: 'proto3', weights: { valence: 0, arousal: 0, dominance: 0 } },
      ];

      // Act
      const result = service.analyze(zeroPrototypes);

      // Assert: Zero variance means no significant components
      expect(result.residualVarianceRatio).toBe(0);
      expect(result.topLoadingPrototypes).toEqual([]);
    });

    it('should handle near-identical prototypes with negligible differences', () => {
      // Arrange: Prototypes with differences below numerical precision threshold
      const nearIdenticalPrototypes = [
        { id: 'proto1', weights: { valence: 0.5, arousal: 0.3 } },
        { id: 'proto2', weights: { valence: 0.5 + 1e-15, arousal: 0.3 } },
        { id: 'proto3', weights: { valence: 0.5, arousal: 0.3 + 1e-15 } },
      ];

      // Act
      const result = service.analyze(nearIdenticalPrototypes);

      // Assert: Near-zero variance should be treated as zero
      expect(result.residualVarianceRatio).toBe(0);
    });
  });

  describe('CoverageGapDetector', () => {
    let detector;

    beforeEach(() => {
      detector = new CoverageGapDetector();
    });

    it('should return no gaps when all prototypes are identical', () => {
      // Arrange: All prototypes at the same point in weight space
      const profiles = new Map([
        ['proto1', { clusterId: 'cluster-1' }],
        ['proto2', { clusterId: 'cluster-1' }],
        ['proto3', { clusterId: 'cluster-1' }],
      ]);

      const identicalPrototypes = [
        { id: 'proto1', weights: { valence: 0.5, arousal: 0.3, dominance: 0.2 } },
        { id: 'proto2', weights: { valence: 0.5, arousal: 0.3, dominance: 0.2 } },
        { id: 'proto3', weights: { valence: 0.5, arousal: 0.3, dominance: 0.2 } },
      ];

      // Act
      const gaps = detector.detect(profiles, identicalPrototypes);

      // Assert: No gaps because all prototypes occupy the same point
      // Distance between any two points is 0, so no gap can be detected
      expect(gaps).toEqual([]);
    });

    it('should return no gaps when all prototypes are at origin', () => {
      // Arrange: All prototypes at the neutral point
      const profiles = new Map([
        ['proto1', { clusterId: 'cluster-1' }],
        ['proto2', { clusterId: 'cluster-1' }],
        ['proto3', { clusterId: 'cluster-1' }],
      ]);

      const zeroPrototypes = [
        { id: 'proto1', weights: { valence: 0, arousal: 0, dominance: 0 } },
        { id: 'proto2', weights: { valence: 0, arousal: 0, dominance: 0 } },
        { id: 'proto3', weights: { valence: 0, arousal: 0, dominance: 0 } },
      ];

      // Act
      const gaps = detector.detect(profiles, zeroPrototypes);

      // Assert: All at origin means no distances, no gaps
      expect(gaps).toEqual([]);
    });
  });

  describe('HubPrototypeDetector', () => {
    let detector;

    beforeEach(() => {
      detector = new HubPrototypeDetector();
    });

    it('should return no hubs when all prototypes are identical', () => {
      // Arrange: For HubPrototypeDetector, we need pair results
      // When all prototypes are identical, their overlap scores would be maximal
      // but there's no diversity or centrality structure
      const pairResults = [
        { prototypeAId: 'proto1', prototypeBId: 'proto2', overlapScore: 1.0 },
        { prototypeAId: 'proto1', prototypeBId: 'proto3', overlapScore: 1.0 },
        { prototypeAId: 'proto2', prototypeBId: 'proto3', overlapScore: 1.0 },
      ];

      // All same cluster = no neighborhood diversity
      const profiles = new Map([
        ['proto1', { clusterId: 'same-cluster' }],
        ['proto2', { clusterId: 'same-cluster' }],
        ['proto3', { clusterId: 'same-cluster' }],
      ]);

      // Act
      const result = detector.detect(pairResults, profiles);

      // Assert: No hubs because there's no diversity
      // HubPrototypeDetector filters out nodes without sufficient neighborhood diversity
      expect(result.hubs).toEqual([]);
    });

    it('should return no hubs when pair results show no meaningful connections', () => {
      // Arrange: Empty pair results (no edges in graph)
      const pairResults = [];
      const profiles = new Map([
        ['proto1', { clusterId: 'c1' }],
        ['proto2', { clusterId: 'c2' }],
      ]);

      // Act
      const result = detector.detect(pairResults, profiles);

      // Assert: No edges means no hubs
      expect(result.hubs).toEqual([]);
    });
  });

  describe('Cross-service consistency', () => {
    it('should have consistent behavior across all three services for identical inputs', () => {
      // Arrange: Create a consistent set of identical prototypes
      const identicalPrototypes = [
        { id: 'p1', weights: { x: 0.5, y: 0.5, z: 0.5 } },
        { id: 'p2', weights: { x: 0.5, y: 0.5, z: 0.5 } },
        { id: 'p3', weights: { x: 0.5, y: 0.5, z: 0.5 } },
        { id: 'p4', weights: { x: 0.5, y: 0.5, z: 0.5 } },
      ];

      const profiles = new Map([
        ['p1', { clusterId: 'same' }],
        ['p2', { clusterId: 'same' }],
        ['p3', { clusterId: 'same' }],
        ['p4', { clusterId: 'same' }],
      ]);

      // Act: All three services should handle this gracefully
      const pcaService = new PCAAnalysisService();
      const gapDetector = new CoverageGapDetector();
      const hubDetector = new HubPrototypeDetector();

      const pcaResult = pcaService.analyze(identicalPrototypes);
      const gapResult = gapDetector.detect(profiles, identicalPrototypes);
      const hubResult = hubDetector.detect([], profiles);

      // Assert: All services return empty/neutral results
      expect(pcaResult.residualVarianceRatio).toBe(0);
      expect(pcaResult.topLoadingPrototypes).toEqual([]);
      expect(gapResult).toEqual([]);
      expect(hubResult.hubs).toEqual([]);
    });
  });
});
