/**
 * @file Recommendation builder for axis gap analysis.
 * @description Generates actionable recommendations based on analysis results.
 */

/**
 * Flag reasons that are metadata-only and should not trigger recommendations.
 * Sign tension is excluded because mixed positive/negative weights are NORMAL
 * for emotional prototypes (64% were incorrectly flagged before this fix).
 *
 * @type {Set<string>}
 */
const METADATA_ONLY_FLAG_REASONS = new Set(['sign_tension']);

/**
 * Configuration for relationship detection between recommendations.
 *
 * @type {Readonly<{HIGH_OVERLAP_THRESHOLD: number, MODERATE_OVERLAP_THRESHOLD: number}>}
 */
const RELATIONSHIP_CONFIG = Object.freeze({
  /** Jaccard similarity threshold for high overlap (potentially redundant) */
  HIGH_OVERLAP_THRESHOLD: 0.7,
  /** Jaccard similarity threshold for moderate overlap (related/complementary) */
  MODERATE_OVERLAP_THRESHOLD: 0.3,
});

/**
 * @typedef {object} RecommendationRelationshipEntry
 * @property {string} id - Related recommendation ID.
 * @property {number} similarity - Jaccard similarity score (0-1).
 * @property {string[]} sharedPrototypes - Prototypes shared between recommendations.
 */

/**
 * @typedef {object} RecommendationRelationships
 * @property {RecommendationRelationshipEntry[]} [overlapping] - Same type, moderate overlap (30-70%).
 * @property {RecommendationRelationshipEntry[]} [complementary] - Different types, moderate overlap (≥30%).
 * @property {RecommendationRelationshipEntry[]} [potentiallyRedundant] - Same type, high overlap (≥70%).
 */

/**
 * @typedef {object} Recommendation
 * @property {string} id - Unique deterministic identifier.
 * @property {'high'|'medium'|'low'} priority - Priority level.
 * @property {'NEW_AXIS'|'INVESTIGATE'|'REFINE_EXISTING'} type - Recommendation type.
 * @property {string} description - Human-readable description.
 * @property {string[]} affectedPrototypes - List of affected prototype IDs.
 * @property {string[]} evidence - Supporting evidence items.
 * @property {RecommendationRelationships} [relationships] - Relationships to other recommendations.
 */

/**
 * @typedef {object} PCAResult
 * @property {number} residualVarianceRatio - Residual variance ratio.
 * @property {number} additionalSignificantComponents - Count of additional components.
 * @property {Array<{prototypeId: string, loading: number}>} topLoadingPrototypes - Top loading prototypes.
 */

/**
 * @typedef {object} HubResult
 * @property {string} prototypeId - Hub prototype ID.
 * @property {number} hubScore - Hub score.
 * @property {string[]} overlappingPrototypes - Neighbor prototype IDs.
 * @property {number} neighborhoodDiversity - Cluster diversity count.
 * @property {string} suggestedAxisConcept - Suggested axis name.
 */

/**
 * @typedef {object} CoverageGapResult
 * @property {string} clusterId - Cluster identifier.
 * @property {string[]} centroidPrototypes - Prototype IDs in cluster.
 * @property {number} distanceToNearestAxis - Distance to nearest axis.
 */

/**
 * @typedef {object} ConflictResult
 * @property {string} prototypeId - Prototype identifier.
 * @property {number} activeAxisCount - Number of active axes.
 * @property {number} signBalance - Sign balance ratio.
 * @property {string[]} positiveAxes - Positive weight axes.
 * @property {string[]} negativeAxes - Negative weight axes.
 * @property {string} [flagReason] - Reason for flagging.
 */

/**
 * @typedef {object} CandidateAxisValidationResult
 * @property {string} candidateId - Unique identifier for this candidate.
 * @property {'pca_residual'|'coverage_gap'|'hub_derived'} source - Origin of candidate.
 * @property {Record<string, number>} direction - Normalized direction vector.
 * @property {object} improvement - Improvement metrics.
 * @property {number} improvement.rmseReduction - RMSE reduction ratio.
 * @property {number} improvement.strongAxisReduction - Strong axis count reduction.
 * @property {number} improvement.coUsageReduction - Co-usage reduction ratio.
 * @property {boolean} isRecommended - Whether the candidate is recommended.
 * @property {'add_axis'|'refine_prototypes'|'insufficient_data'} recommendation - Recommendation type.
 * @property {string[]} affectedPrototypes - IDs of affected prototypes.
 * @property {object} [metadata] - Source-specific metadata.
 */

/**
 * Service for generating recommendations from axis gap analysis results.
 */
export class AxisGapRecommendationBuilder {
  #config;

  /**
   * Create an AxisGapRecommendationBuilder.
   *
   * @param {object} [config] - Configuration options.
   * @param {number} [config.pcaResidualVarianceThreshold] - PCA threshold (default: 0.15).
   */
  constructor(config = {}) {
    this.#config = {
      pcaResidualVarianceThreshold: config.pcaResidualVarianceThreshold ?? 0.15,
      pcaRequireCorroboration: config.pcaRequireCorroboration ?? true,
    };
  }

  /**
   * Generate recommendations based on analysis results.
   *
   * @param {PCAResult} pcaResult - PCA analysis result.
   * @param {HubResult[]} hubs - Hub prototype results.
   * @param {CoverageGapResult[]} gaps - Coverage gap results.
   * @param {ConflictResult[]} conflicts - Multi-axis conflict results.
   * @param {CandidateAxisValidationResult[]|null} [candidateAxisValidation] - Optional candidate axis validation results.
   * @returns {Recommendation[]} Array of recommendations.
   */
  generate(pcaResult, hubs, gaps, conflicts, candidateAxisValidation = null) {
    const recommendations = [];
    const pcaThreshold = Number.isFinite(this.#config.pcaResidualVarianceThreshold)
      ? this.#config.pcaResidualVarianceThreshold
      : 0.15;

    // Generate recommendations from validated candidate axes first (highest priority)
    if (Array.isArray(candidateAxisValidation) && candidateAxisValidation.length > 0) {
      const validatedRecommendations = this.#generateFromCandidateValidation(
        candidateAxisValidation
      );
      recommendations.push(...validatedRecommendations);
    }

    // Filter out metadata-only conflicts (e.g., sign_tension) - these should not trigger recommendations
    const actionableConflicts = Array.isArray(conflicts)
      ? conflicts.filter(
          (conflict) => !METADATA_ONLY_FLAG_REASONS.has(conflict.flagReason)
        )
      : [];

    // Compute signal flags
    const hasSignificantComponents = pcaResult.additionalSignificantComponents > 0;
    const hasHighResidual = pcaResult.residualVarianceRatio >= pcaThreshold;
    const hasHubs = Array.isArray(hubs) && hubs.length > 0;
    const hasGaps = Array.isArray(gaps) && gaps.length > 0;
    const hasConflicts = actionableConflicts.length > 0;
    const hasOtherSignals = hasHubs || hasGaps || hasConflicts;

    // Apply corroboration logic when enabled
    // When true, PCA triggers ONLY if:
    // 1. additionalSignificantComponents > 0, OR
    // 2. residualVariance is high AND at least one other signal is present
    let pcaTriggered;
    if (this.#config.pcaRequireCorroboration) {
      pcaTriggered = hasSignificantComponents || (hasHighResidual && hasOtherSignals);
    } else {
      pcaTriggered = hasHighResidual || hasSignificantComponents;
    }

    // HIGH priority: PCA + coverage gap indicates strong evidence for new axis
    if (pcaTriggered && hasGaps) {
      const affectedPrototypes = this.#mergeUniquePrototypes(
        pcaResult.topLoadingPrototypes.map((entry) => entry.prototypeId),
        ...gaps.map((gap) => gap.centroidPrototypes)
      );

      recommendations.push(
        this.buildRecommendation({
          priority: 'high',
          type: 'NEW_AXIS',
          description:
            'PCA analysis and coverage gap detection both indicate a potential missing axis. Consider adding a new emotional dimension.',
          affectedPrototypes,
          evidence: [
            `PCA residual variance ratio: ${(pcaResult.residualVarianceRatio * 100).toFixed(1)}%`,
            `Additional significant components: ${pcaResult.additionalSignificantComponents}`,
            `Coverage gaps found: ${gaps.length}`,
          ],
        })
      );
    }

    // HIGH priority: Hub + coverage gap indicates strong evidence for new axis
    if (hasHubs && hasGaps) {
      for (const hub of hubs) {
        const relatedGap = this.#findRelatedGap(hub, gaps);
        if (relatedGap) {
          const affectedPrototypes = this.#mergeUniquePrototypes(
            [hub.prototypeId],
            hub.overlappingPrototypes,
            relatedGap.centroidPrototypes
          );

          recommendations.push(
            this.buildRecommendation({
              priority: 'high',
              type: 'NEW_AXIS',
              description: `Hub prototype "${hub.prototypeId}" connects multiple clusters that form a coverage gap. Consider adding axis: "${hub.suggestedAxisConcept}".`,
              affectedPrototypes,
              evidence: [
                `Hub score: ${hub.hubScore.toFixed(2)}`,
                `Overlapping prototypes: ${hub.overlappingPrototypes.length}`,
                `Neighborhood diversity: ${hub.neighborhoodDiversity}`,
                `Distance to nearest axis: ${relatedGap.distanceToNearestAxis.toFixed(2)}`,
              ],
            })
          );
        }
      }
    }

    // MEDIUM priority: Single signal - PCA alone
    if (pcaTriggered && !hasGaps && !hasHubs) {
      const affectedPrototypes = pcaResult.topLoadingPrototypes.map(
        (entry) => entry.prototypeId
      );

      recommendations.push(
        this.buildRecommendation({
          priority: 'medium',
          type: 'INVESTIGATE',
          description:
            'PCA analysis suggests unexplained variance. Investigate the top-loading prototypes for potential axis candidates.',
          affectedPrototypes,
          evidence: [
            `PCA residual variance ratio: ${(pcaResult.residualVarianceRatio * 100).toFixed(1)}%`,
            `Additional significant components: ${pcaResult.additionalSignificantComponents}`,
            `Top loading prototypes: ${affectedPrototypes.slice(0, 5).join(', ')}`,
          ],
        })
      );
    }

    // LOW priority: High residual variance without corroboration
    // When pcaRequireCorroboration is true, PCA triggers ONLY if corroborated.
    // This case captures high residual that broken-stick found no concentrated dimensions for,
    // and no other signals corroborate - suggesting diffuse noise rather than a hidden axis.
    const hasHighResidualWithoutCorroboration =
      this.#config.pcaRequireCorroboration &&
      hasHighResidual &&
      !hasSignificantComponents &&
      !hasOtherSignals;

    if (hasHighResidualWithoutCorroboration) {
      // Use reconstructionErrors (actual property from PCAAnalysisService)
      const reconstructionErrors = pcaResult.reconstructionErrors ?? [];
      const worstFitting = reconstructionErrors
        .map((e) => (typeof e === 'string' ? e : e.prototypeId ?? ''))
        .filter((id) => id.length > 0);

      // Extract top axes from residualEigenvector (sorted by absolute weight)
      const residualEigenvector = pcaResult.residualEigenvector ?? {};
      const residualTopAxes = Object.entries(residualEigenvector)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .slice(0, 5)
        .map(([axis]) => axis);

      // Build evidence array
      const evidence = [
        `Residual variance: ${(pcaResult.residualVarianceRatio * 100).toFixed(1)}%`,
        `Threshold: ${(this.#config.pcaResidualVarianceThreshold * 100).toFixed(1)}%`,
        `Additional significant components (broken-stick): ${pcaResult.additionalSignificantComponents}`,
        worstFitting.length > 0
          ? `Worst-fitting prototypes: ${worstFitting.slice(0, 5).join(', ')}`
          : 'No worst-fitting prototypes identified',
        residualTopAxes.length > 0
          ? `Residual eigenvector top axes: ${residualTopAxes.slice(0, 5).join(', ')}`
          : 'No residual eigenvector data available',
      ];

      // Add excluded-axis reliance warnings for prototypes that rely heavily on sparse axes
      const prototypesRelyingOnExcluded = reconstructionErrors.filter(
        (e) => e && typeof e === 'object' && e.reliesOnExcludedAxes === true
      );
      for (const entry of prototypesRelyingOnExcluded) {
        const reliancePct = ((entry.excludedAxisReliance ?? 0) * 100).toFixed(0);
        evidence.push(
          `⚠️ ${entry.prototypeId} relies ${reliancePct}% on excluded sparse axes (consider adjusting pcaMinAxisUsageRatio)`
        );
      }

      evidence.push(
        'Suggestion: Review worst-fitting prototypes for potential refinement. Consider whether these represent legitimate outliers or candidates for axis adjustment.'
      );

      recommendations.push(
        this.buildRecommendation({
          priority: 'low',
          type: 'INVESTIGATE',
          description:
            'Residual variance exceeds threshold but broken-stick analysis found no concentrated unexplained dimensions. This suggests variance is diffuse (noise or idiosyncratic differences) rather than a discoverable hidden axis.',
          affectedPrototypes: worstFitting.slice(0, 5),
          evidence,
        })
      );
    }

    // MEDIUM priority: Single signal - Hub alone
    if (hasHubs && !hasGaps && !pcaTriggered) {
      for (const hub of hubs) {
        const affectedPrototypes = this.#mergeUniquePrototypes(
          [hub.prototypeId],
          hub.overlappingPrototypes
        );

        recommendations.push(
          this.buildRecommendation({
            priority: 'medium',
            type: 'INVESTIGATE',
            description: `Hub prototype "${hub.prototypeId}" has moderate overlaps with prototypes from ${hub.neighborhoodDiversity} different clusters. Suggested axis concept: "${hub.suggestedAxisConcept}".`,
            affectedPrototypes,
            evidence: [
              `Hub score: ${hub.hubScore.toFixed(2)}`,
              `Overlapping prototypes: ${hub.overlappingPrototypes.length}`,
              `Neighborhood diversity: ${hub.neighborhoodDiversity}`,
            ],
          })
        );
      }
    }

    // MEDIUM priority: Single signal - Coverage gap alone
    if (hasGaps && !hasHubs && !pcaTriggered) {
      for (const gap of gaps) {
        recommendations.push(
          this.buildRecommendation({
            priority: 'medium',
            type: 'INVESTIGATE',
            description: `Cluster "${gap.clusterId}" is distant from all existing axes. Consider if these prototypes share a common theme.`,
            affectedPrototypes: gap.centroidPrototypes,
            evidence: [
              `Distance to nearest axis: ${gap.distanceToNearestAxis.toFixed(2)}`,
              `Cluster members: ${gap.centroidPrototypes.length}`,
            ],
          })
        );
      }
    }

    // LOW priority: Multi-axis conflicts only (excludes metadata-only like sign_tension)
    if (hasConflicts && !pcaTriggered && !hasHubs && !hasGaps) {
      for (const conflict of actionableConflicts) {
        recommendations.push(
          this.buildRecommendation({
            priority: 'low',
            type: 'REFINE_EXISTING',
            description: `Prototype "${conflict.prototypeId}" uses many axes with balanced positive/negative weights. Consider whether it needs refinement or represents a valid complex state.`,
            affectedPrototypes: [conflict.prototypeId],
            evidence: [
              `Active axes: ${conflict.activeAxisCount}`,
              `Sign balance: ${conflict.signBalance.toFixed(2)}`,
              `Positive axes: ${(conflict.positiveAxes ?? []).join(', ')}`,
              `Negative axes: ${(conflict.negativeAxes ?? []).join(', ')}`,
            ],
          })
        );
      }
    }

    // If we have actionable conflicts alongside other signals, add them with lower priority
    if (hasConflicts && (pcaTriggered || hasHubs || hasGaps)) {
      for (const conflict of actionableConflicts) {
        recommendations.push(
          this.buildRecommendation({
            priority: 'low',
            type: 'REFINE_EXISTING',
            description: `Prototype "${conflict.prototypeId}" shows multi-axis conflict patterns that may be related to the axis gap.`,
            affectedPrototypes: [conflict.prototypeId],
            evidence: [
              `Active axes: ${conflict.activeAxisCount}`,
              `Sign balance: ${conflict.signBalance.toFixed(2)}`,
            ],
          })
        );
      }
    }

    // Detect and annotate relationships between recommendations
    this.#detectRelationships(recommendations);

    return recommendations;
  }

  /**
   * Build a recommendation object.
   *
   * @param {object} params - Recommendation parameters.
   * @param {'high'|'medium'|'low'} params.priority - Priority level.
   * @param {'NEW_AXIS'|'INVESTIGATE'|'REFINE_EXISTING'} params.type - Recommendation type.
   * @param {string} params.description - Human-readable description.
   * @param {string[]} params.affectedPrototypes - Affected prototype IDs.
   * @param {string[]} params.evidence - Supporting evidence items.
   * @returns {Recommendation} Built recommendation.
   */
  buildRecommendation({ priority, type, description, affectedPrototypes, evidence }) {
    const sortedPrototypes = [...new Set(affectedPrototypes)].sort();
    return {
      id: this.#generateRecommendationId(type, sortedPrototypes),
      priority,
      type,
      description,
      affectedPrototypes: sortedPrototypes,
      evidence: evidence.length > 0 ? evidence : ['Signal detected'],
    };
  }

  /**
   * Sort recommendations by priority (high → medium → low).
   *
   * @param {Recommendation[]} recommendations - Array of recommendations to sort in-place.
   */
  sortByPriority(recommendations) {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    recommendations.sort((a, b) => {
      const orderA = priorityOrder[a.priority] ?? 3;
      const orderB = priorityOrder[b.priority] ?? 3;
      return orderA - orderB;
    });
  }

  /**
   * Find a coverage gap related to a hub prototype.
   *
   * @param {HubResult} hub - Hub prototype result.
   * @param {CoverageGapResult[]} gaps - Coverage gap results.
   * @returns {CoverageGapResult|null} Related gap or null.
   */
  #findRelatedGap(hub, gaps) {
    const hubNeighbors = new Set(hub.overlappingPrototypes);

    for (const gap of gaps) {
      const overlap = gap.centroidPrototypes.filter((prototypeId) =>
        hubNeighbors.has(prototypeId)
      );
      if (overlap.length > 0) {
        return gap;
      }
    }

    return null;
  }

  /**
   * Merge multiple prototype ID arrays into a unique, sorted list.
   *
   * @param {...(string[]|string)} arrays - Arrays of prototype IDs or single IDs.
   * @returns {string[]} Sorted unique prototype IDs.
   */
  #mergeUniquePrototypes(...arrays) {
    const merged = new Set();
    for (const arr of arrays) {
      if (Array.isArray(arr)) {
        for (const id of arr) {
          if (typeof id === 'string' && id.length > 0) {
            merged.add(id);
          }
        }
      }
    }
    return Array.from(merged).sort();
  }

  /**
   * Generate recommendations from candidate axis validation results.
   *
   * @param {CandidateAxisValidationResult[]} validationResults - Validation results.
   * @returns {Recommendation[]} Generated recommendations.
   */
  #generateFromCandidateValidation(validationResults) {
    const recommendations = [];

    for (const result of validationResults) {
      if (result.isRecommended && result.recommendation === 'add_axis') {
        // HIGH priority: Validated candidate axis worth adding
        recommendations.push(
          this.buildRecommendation({
            priority: 'high',
            type: 'NEW_AXIS',
            description: this.#buildValidatedAxisDescription(result),
            affectedPrototypes: result.affectedPrototypes ?? [],
            evidence: this.#buildValidatedAxisEvidence(result),
          })
        );
      } else if (result.recommendation === 'refine_prototypes') {
        // LOW priority: Candidate indicates prototype refinement needed
        recommendations.push(
          this.buildRecommendation({
            priority: 'low',
            type: 'REFINE_EXISTING',
            description: `Candidate "${result.candidateId}" (from ${result.source}) shows improvement, but refining existing prototypes is preferred over adding a new axis.`,
            affectedPrototypes: result.affectedPrototypes ?? [],
            evidence: this.#buildRefinementEvidence(result),
          })
        );
      }
      // Skip 'insufficient_data' recommendations - no action needed
    }

    return recommendations;
  }

  /**
   * Build description for a validated axis recommendation.
   *
   * @param {CandidateAxisValidationResult} result - Validation result.
   * @returns {string} Human-readable description.
   */
  #buildValidatedAxisDescription(result) {
    const sourceDescriptions = {
      pca_residual: 'PCA residual variance',
      coverage_gap: 'coverage gap analysis',
      hub_derived: 'hub prototype neighborhood',
    };

    const sourceDesc = sourceDescriptions[result.source] ?? result.source;
    const rmseImprovement = (result.improvement?.rmseReduction ?? 0) * 100;

    return `Validated candidate axis from ${sourceDesc} would reduce RMSE by ${rmseImprovement.toFixed(1)}%. Adding this axis is recommended.`;
  }

  /**
   * Build evidence array for a validated axis recommendation.
   *
   * @param {CandidateAxisValidationResult} result - Validation result.
   * @returns {string[]} Evidence items.
   */
  #buildValidatedAxisEvidence(result) {
    const evidence = [];
    const improvement = result.improvement ?? {};

    if (improvement.rmseReduction !== undefined) {
      evidence.push(`RMSE reduction: ${(improvement.rmseReduction * 100).toFixed(1)}%`);
    }
    if (improvement.strongAxisReduction !== undefined) {
      evidence.push(`Strong axis count reduced by: ${improvement.strongAxisReduction}`);
    }
    if (improvement.coUsageReduction !== undefined) {
      evidence.push(`Co-usage reduction: ${(improvement.coUsageReduction * 100).toFixed(1)}%`);
    }
    if (result.affectedPrototypes?.length) {
      evidence.push(`Affects ${result.affectedPrototypes.length} prototypes`);
    }

    return evidence.length > 0 ? evidence : ['Validated through metric improvement analysis'];
  }

  /**
   * Build evidence array for a refinement recommendation.
   *
   * @param {CandidateAxisValidationResult} result - Validation result.
   * @returns {string[]} Evidence items.
   */
  #buildRefinementEvidence(result) {
    const evidence = [];
    const improvement = result.improvement ?? {};

    evidence.push(`Source: ${result.source}`);

    if (improvement.rmseReduction !== undefined) {
      evidence.push(`RMSE improvement: ${(improvement.rmseReduction * 100).toFixed(1)}%`);
    }
    if (result.affectedPrototypes?.length) {
      evidence.push(`Would affect ${result.affectedPrototypes.length} prototypes`);
    }

    evidence.push('Improvement below threshold for new axis recommendation');

    return evidence;
  }

  /**
   * Generate a deterministic ID for a recommendation based on type and affected prototypes.
   *
   * @param {'NEW_AXIS'|'INVESTIGATE'|'REFINE_EXISTING'} type - Recommendation type.
   * @param {string[]} affectedPrototypes - Sorted array of affected prototype IDs.
   * @returns {string} Deterministic recommendation ID.
   */
  #generateRecommendationId(type, affectedPrototypes) {
    // Create a simple hash from the concatenated string
    const content = `${type}:${affectedPrototypes.join(',')}`;
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0; // Convert to 32-bit integer
    }
    // Convert to base36 for compact representation and take absolute value
    const hashStr = Math.abs(hash).toString(36);
    return `rec_${type.toLowerCase()}_${hashStr}`;
  }

  /**
   * Calculate Jaccard similarity between two sets of prototype IDs.
   *
   * @param {string[]} setA - First array of prototype IDs.
   * @param {string[]} setB - Second array of prototype IDs.
   * @returns {number} Jaccard similarity (0-1).
   */
  #calculateJaccardSimilarity(setA, setB) {
    if (setA.length === 0 && setB.length === 0) {
      return 0;
    }

    const a = new Set(setA);
    const b = new Set(setB);

    let intersectionSize = 0;
    for (const item of a) {
      if (b.has(item)) {
        intersectionSize++;
      }
    }

    const unionSize = a.size + b.size - intersectionSize;
    return unionSize === 0 ? 0 : intersectionSize / unionSize;
  }

  /**
   * Classify the relationship between two recommendations based on similarity.
   *
   * @param {Recommendation} recA - First recommendation.
   * @param {Recommendation} recB - Second recommendation.
   * @param {number} similarity - Jaccard similarity between recommendations.
   * @returns {'potentiallyRedundant'|'complementary'|'overlapping'|null} Relationship type or null.
   */
  #classifyRelationship(recA, recB, similarity) {
    const { HIGH_OVERLAP_THRESHOLD, MODERATE_OVERLAP_THRESHOLD } = RELATIONSHIP_CONFIG;

    if (similarity < MODERATE_OVERLAP_THRESHOLD) {
      return null; // Independent recommendations
    }

    const sameType = recA.type === recB.type;

    if (similarity >= HIGH_OVERLAP_THRESHOLD && sameType) {
      return 'potentiallyRedundant';
    }

    if (!sameType) {
      return 'complementary';
    }

    // Same type with moderate overlap (30-70%)
    return 'overlapping';
  }

  /**
   * Detect and annotate relationships between recommendations.
   * Mutates recommendations in-place to add relationships field when applicable.
   *
   * @param {Recommendation[]} recommendations - Array of recommendations to analyze.
   */
  #detectRelationships(recommendations) {
    if (recommendations.length < 2) {
      return;
    }

    // Build relationship map for each recommendation
    /** @type {Map<string, RecommendationRelationships>} */
    const relationshipMap = new Map();

    // Compare all pairs
    for (let i = 0; i < recommendations.length; i++) {
      for (let j = i + 1; j < recommendations.length; j++) {
        const recA = recommendations[i];
        const recB = recommendations[j];

        const similarity = this.#calculateJaccardSimilarity(
          recA.affectedPrototypes,
          recB.affectedPrototypes
        );

        const relationshipType = this.#classifyRelationship(recA, recB, similarity);

        if (relationshipType) {
          // Calculate shared prototypes
          const sharedPrototypes = recA.affectedPrototypes.filter((p) =>
            recB.affectedPrototypes.includes(p)
          );

          // Add relationship from A to B
          this.#addRelationship(relationshipMap, recA.id, relationshipType, {
            id: recB.id,
            similarity,
            sharedPrototypes,
          });

          // Add relationship from B to A
          this.#addRelationship(relationshipMap, recB.id, relationshipType, {
            id: recA.id,
            similarity,
            sharedPrototypes,
          });
        }
      }
    }

    // Apply relationships to recommendations
    for (const rec of recommendations) {
      const relationships = relationshipMap.get(rec.id);
      if (relationships && Object.keys(relationships).length > 0) {
        rec.relationships = relationships;
      }
    }
  }

  /**
   * Add a relationship entry to the relationship map.
   *
   * @param {Map<string, RecommendationRelationships>} relationshipMap - Map to update.
   * @param {string} recId - Recommendation ID to add relationship to.
   * @param {'potentiallyRedundant'|'complementary'|'overlapping'} relationshipType - Type of relationship.
   * @param {RecommendationRelationshipEntry} entry - Relationship entry to add.
   */
  #addRelationship(relationshipMap, recId, relationshipType, entry) {
    if (!relationshipMap.has(recId)) {
      relationshipMap.set(recId, {});
    }

    const relationships = relationshipMap.get(recId);
    if (!relationships[relationshipType]) {
      relationships[relationshipType] = [];
    }

    relationships[relationshipType].push(entry);
  }
}
