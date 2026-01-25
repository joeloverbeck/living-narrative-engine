/**
 * @file Candidate axis extraction for axis gap analysis.
 * @description Extracts candidate axis directions from analysis signals.
 */

import {
  normalizeVector,
  collectAxes,
  buildPrototypeLookup,
} from '../../utils/vectorMathUtils.js';

/**
 * @typedef {object} ExtractedCandidate
 * @property {string} candidateId - Unique identifier for this candidate.
 * @property {'pca_residual'|'coverage_gap'|'hub_derived'} source - Origin of candidate.
 * @property {Record<string, number>} direction - Normalized direction vector.
 * @property {number} confidence - Extraction confidence [0, 1].
 * @property {string[]} sourcePrototypes - Prototype IDs that contributed to this candidate.
 * @property {object} metadata - Source-specific metadata.
 */

/**
 * @typedef {import('./PCAAnalysisService.js').PCAResult} PCAResult
 * @typedef {import('./CoverageGapDetector.js').CoverageGapResult} CoverageGapResult
 * @typedef {import('./HubPrototypeDetector.js').HubResult} HubResult
 */

/**
 * Service for extracting candidate axis directions from analysis signals.
 */
export class CandidateAxisExtractor {
  #config;
  #logger;

  /**
   * Create a CandidateAxisExtractor.
   *
   * @param {object} [config] - Configuration options.
   * @param {number} [config.candidateAxisMaxCandidates] - Maximum candidates to extract (default: 10).
   * @param {number} [config.candidateAxisMinExtractionConfidence] - Minimum confidence threshold (default: 0.3).
   * @param {object} [logger] - Optional logger.
   */
  constructor(config = {}, logger = null) {
    this.#config = {
      candidateAxisMaxCandidates: config.candidateAxisMaxCandidates ?? 10,
      candidateAxisMinExtractionConfidence:
        config.candidateAxisMinExtractionConfidence ?? 0.3,
    };
    this.#logger = logger;
  }

  /**
   * Extract candidate axis directions from analysis results.
   *
   * @param {PCAResult} pcaResult - PCA analysis result.
   * @param {CoverageGapResult[]} coverageGaps - Coverage gap results.
   * @param {HubResult[]} hubs - Hub prototype results.
   * @param {Array<{id?: string, prototypeId?: string, weights?: Record<string, number>}>} prototypes - Prototype objects.
   * @returns {ExtractedCandidate[]} Array of extracted candidates, sorted by confidence.
   */
  extract(pcaResult, coverageGaps, hubs, prototypes) {
    const candidates = [];
    const axes = collectAxes(prototypes);

    if (axes.length === 0) {
      return [];
    }

    // Source 1: PCA residual - first eigenvector beyond expected count
    const pcaCandidates = this.#extractFromPCA(pcaResult, axes);
    candidates.push(...pcaCandidates);

    // Source 2: Coverage gaps - suggestedAxisDirection from each gap
    const gapCandidates = this.#extractFromCoverageGaps(coverageGaps);
    candidates.push(...gapCandidates);

    // Source 3: Hub derived - average direction of hub neighborhood centroids
    const hubCandidates = this.#extractFromHubs(hubs, prototypes, axes);
    candidates.push(...hubCandidates);

    // Filter by minimum confidence
    const minConfidence = this.#config.candidateAxisMinExtractionConfidence;
    const filtered = candidates.filter((c) => c.confidence >= minConfidence);

    // Deduplicate similar directions
    const deduplicated = this.#deduplicateCandidates(filtered);

    // Sort by confidence descending and limit
    const sorted = deduplicated.sort((a, b) => b.confidence - a.confidence);
    const maxCandidates = this.#config.candidateAxisMaxCandidates;

    return sorted.slice(0, maxCandidates);
  }

  /**
   * Extract candidate from PCA residual eigenvector.
   *
   * @param {PCAResult} pcaResult - PCA analysis result.
   * @param {string[]} _axes - Available axes (unused - preserved for API consistency).
   * @returns {ExtractedCandidate[]} Extracted PCA candidates.
   */
  #extractFromPCA(pcaResult, _axes) {
    if (!pcaResult) {
      return [];
    }

    const significantBeyondExpected = pcaResult.significantBeyondExpected ?? 0;
    const explainedVariance = pcaResult.explainedVariance ?? [];
    const residualVarianceRatio = pcaResult.residualVarianceRatio ?? 0;

    // Only extract if Broken-Stick analysis indicates significant components beyond expected
    // High residual variance with no significant components indicates diffuse noise, not a missing axis
    if (significantBeyondExpected <= 0) {
      this.#logger?.debug(
        'CandidateAxisExtractor: PCA residual is diffuse (no significant components beyond K), skipping extraction. ' +
          `residualVarianceRatio=${residualVarianceRatio.toFixed(3)}`
      );
      return [];
    }

    // Extract direction from top loading prototypes on residual component
    const topLoadingPrototypes = pcaResult.topLoadingPrototypes ?? [];
    if (topLoadingPrototypes.length === 0) {
      return [];
    }

    // Compute confidence based on residual variance and component count
    const varianceConfidence = Math.min(1, residualVarianceRatio * 2);
    const componentConfidence = Math.min(1, significantBeyondExpected * 0.3);
    const confidence = Math.max(varianceConfidence, componentConfidence);

    const sourcePrototypes = topLoadingPrototypes.map((p) => p.prototypeId);

    // Use the residual eigenvector directly from PCA result (preferred)
    let direction = pcaResult.residualEigenvector;

    // If no eigenvector available, this is an error state - log and skip
    if (!direction || typeof direction !== 'object') {
      this.#logger?.debug(
        'CandidateAxisExtractor: No residual eigenvector available from PCA result, skipping PCA candidate'
      );
      return [];
    }

    // Normalize the direction vector
    const normalized = normalizeVector(direction);

    // Check if direction has meaningful magnitude (not near-zero)
    if (!normalized) {
      this.#logger?.debug(
        'CandidateAxisExtractor: PCA residual eigenvector has near-zero magnitude, skipping candidate'
      );
      return [];
    }

    const candidate = {
      candidateId: 'pca_residual_0',
      source: /** @type {const} */ ('pca_residual'),
      direction: normalized,
      confidence,
      sourcePrototypes,
      metadata: {
        residualVarianceRatio,
        significantBeyondExpected,
        topLoadingCount: topLoadingPrototypes.length,
        residualEigenvectorIndex: pcaResult.residualEigenvectorIndex ?? -1,
        explainedVarianceByResidual:
          explainedVariance.length > pcaResult.expectedComponentCount
            ? explainedVariance.slice(pcaResult.expectedComponentCount)
            : [],
      },
    };

    return [candidate];
  }

  /**
   * Extract candidates from coverage gaps.
   *
   * @param {CoverageGapResult[]} coverageGaps - Coverage gap results.
   * @returns {ExtractedCandidate[]} Extracted coverage gap candidates.
   */
  #extractFromCoverageGaps(coverageGaps) {
    if (!Array.isArray(coverageGaps) || coverageGaps.length === 0) {
      return [];
    }

    const candidates = [];

    for (let i = 0; i < coverageGaps.length; i += 1) {
      const gap = coverageGaps[i];
      const direction = gap.suggestedAxisDirection;

      if (!direction || typeof direction !== 'object') {
        continue;
      }

      // Normalize the direction
      const normalized = normalizeVector(direction);
      if (!normalized) {
        continue;
      }

      // Compute confidence based on distance and cluster properties
      const distanceToNearestAxis = gap.distanceToNearestAxis ?? 0;
      const clusterSize = gap.clusterSize ?? gap.centroidPrototypes?.length ?? 1;
      const gapScore = gap.gapScore ?? distanceToNearestAxis;

      // Higher distance = more confidence this is a truly missing axis
      const distanceConfidence = Math.min(1, distanceToNearestAxis);
      // Larger clusters = more evidence
      const sizeConfidence = Math.min(1, clusterSize / 10);
      const confidence = 0.6 * distanceConfidence + 0.4 * sizeConfidence;

      candidates.push({
        candidateId: `coverage_gap_${i}`,
        source: /** @type {const} */ ('coverage_gap'),
        direction: normalized,
        confidence,
        sourcePrototypes: gap.centroidPrototypes ?? [],
        metadata: {
          clusterId: gap.clusterId,
          distanceToNearestAxis,
          clusterSize,
          gapScore,
          clusterMagnitude: gap.clusterMagnitude,
        },
      });
    }

    return candidates;
  }

  /**
   * Extract candidates from hub prototypes.
   *
   * @param {HubResult[]} hubs - Hub prototype results.
   * @param {Array<{id?: string, prototypeId?: string, weights?: Record<string, number>}>} prototypes - Prototype objects.
   * @param {string[]} axes - Available axes.
   * @returns {ExtractedCandidate[]} Extracted hub candidates.
   */
  #extractFromHubs(hubs, prototypes, axes) {
    if (!Array.isArray(hubs) || hubs.length === 0) {
      return [];
    }

    const prototypeLookup = buildPrototypeLookup(prototypes);
    const candidates = [];

    for (let i = 0; i < hubs.length; i += 1) {
      const hub = hubs[i];
      const neighborIds = hub.overlappingPrototypes ?? [];

      if (neighborIds.length < 2) {
        continue;
      }

      // Compute average direction of hub neighborhood centroids
      const direction = this.#computeNeighborhoodCentroid(
        neighborIds,
        prototypeLookup,
        axes
      );

      if (!direction) {
        continue;
      }

      const normalized = normalizeVector(direction);
      if (!normalized) {
        continue;
      }

      // Compute confidence based on hub properties
      const hubScore = hub.hubScore ?? 0;
      const neighborhoodDiversity = hub.neighborhoodDiversity ?? 1;
      const betweennessCentrality = hub.betweennessCentrality ?? 0;

      // Higher hub score and diversity = more confidence
      const hubConfidence = Math.min(1, hubScore / 10);
      const diversityConfidence = Math.min(1, neighborhoodDiversity / 4);
      const betweennessConfidence = betweennessCentrality;
      const confidence =
        0.4 * hubConfidence + 0.3 * diversityConfidence + 0.3 * betweennessConfidence;

      candidates.push({
        candidateId: `hub_derived_${i}`,
        source: /** @type {const} */ ('hub_derived'),
        direction: normalized,
        confidence,
        sourcePrototypes: [hub.prototypeId, ...neighborIds],
        metadata: {
          hubPrototypeId: hub.prototypeId,
          hubScore,
          neighborhoodDiversity,
          betweennessCentrality,
          suggestedAxisConcept: hub.suggestedAxisConcept,
          neighborCount: neighborIds.length,
        },
      });
    }

    return candidates;
  }

  /**
   * Compute centroid of hub neighborhood.
   *
   * @param {string[]} neighborIds - Neighbor prototype IDs.
   * @param {Map<string, object>} prototypeLookup - Prototype lookup map.
   * @param {string[]} axes - Available axes.
   * @returns {Record<string, number>|null} Centroid vector or null.
   */
  #computeNeighborhoodCentroid(neighborIds, prototypeLookup, axes) {
    if (!Array.isArray(neighborIds) || neighborIds.length === 0) {
      return null;
    }

    const totals = {};
    for (const axis of axes) {
      totals[axis] = 0;
    }

    let count = 0;
    for (const neighborId of neighborIds) {
      const prototype = prototypeLookup.get(neighborId);
      const weights = prototype?.weights ?? {};

      count += 1;
      for (const axis of axes) {
        const value = weights[axis];
        if (Number.isFinite(value)) {
          totals[axis] += value;
        }
      }
    }

    if (count === 0) {
      return null;
    }

    const centroid = {};
    for (const axis of axes) {
      centroid[axis] = totals[axis] / count;
    }

    return centroid;
  }

  /**
   * Deduplicate candidates with similar directions.
   *
   * @param {ExtractedCandidate[]} candidates - Candidates to deduplicate.
   * @returns {ExtractedCandidate[]} Deduplicated candidates.
   */
  #deduplicateCandidates(candidates) {
    if (candidates.length <= 1) {
      return candidates;
    }

    const result = [];
    const used = new Set();

    // Sort by confidence first so we keep the best of similar candidates
    const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence);

    for (const candidate of sorted) {
      if (used.has(candidate.candidateId)) {
        continue;
      }

      // Check similarity with already-kept candidates
      let isDuplicate = false;
      for (const kept of result) {
        const similarity = this.#computeDirectionSimilarity(
          candidate.direction,
          kept.direction
        );
        if (similarity > 0.9) {
          isDuplicate = true;
          this.#logger?.debug(
            `CandidateAxisExtractor: Deduplicating ${candidate.candidateId} (similar to ${kept.candidateId})`
          );
          break;
        }
      }

      if (!isDuplicate) {
        result.push(candidate);
        used.add(candidate.candidateId);
      }
    }

    return result;
  }

  /**
   * Compute similarity between two direction vectors.
   *
   * @param {Record<string, number>} dirA - First direction.
   * @param {Record<string, number>} dirB - Second direction.
   * @returns {number} Similarity score [0, 1] (cosine similarity).
   */
  #computeDirectionSimilarity(dirA, dirB) {
    if (!dirA || !dirB) {
      return 0;
    }

    const keysA = Object.keys(dirA);
    const keysB = Object.keys(dirB);
    const allKeys = new Set([...keysA, ...keysB]);

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (const key of allKeys) {
      const a = dirA[key] ?? 0;
      const b = dirB[key] ?? 0;
      dotProduct += a * b;
      magnitudeA += a * a;
      magnitudeB += b * b;
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    // Cosine similarity, mapped to [0, 1]
    const cosineSim = dotProduct / (magnitudeA * magnitudeB);
    return Math.abs(cosineSim); // Absolute because opposite directions are also similar
  }
}
