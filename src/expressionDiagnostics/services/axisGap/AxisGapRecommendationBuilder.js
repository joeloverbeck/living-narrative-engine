/**
 * @file Recommendation builder for axis gap analysis.
 * @description Generates actionable recommendations based on analysis results.
 */

/**
 * Flag reasons that are metadata-only and should not trigger recommendations.
 * Sign tension is excluded because mixed positive/negative weights are NORMAL
 * for emotional prototypes (64% were incorrectly flagged before this fix).
 * @type {Set<string>}
 */
const METADATA_ONLY_FLAG_REASONS = new Set(['sign_tension']);

/**
 * @typedef {object} Recommendation
 * @property {'high'|'medium'|'low'} priority - Priority level.
 * @property {'NEW_AXIS'|'INVESTIGATE'|'REFINE_EXISTING'} type - Recommendation type.
 * @property {string} description - Human-readable description.
 * @property {string[]} affectedPrototypes - List of affected prototype IDs.
 * @property {string[]} evidence - Supporting evidence items.
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
    };
  }

  /**
   * Generate recommendations based on analysis results.
   *
   * @param {PCAResult} pcaResult - PCA analysis result.
   * @param {HubResult[]} hubs - Hub prototype results.
   * @param {CoverageGapResult[]} gaps - Coverage gap results.
   * @param {ConflictResult[]} conflicts - Multi-axis conflict results.
   * @returns {Recommendation[]} Array of recommendations.
   */
  generate(pcaResult, hubs, gaps, conflicts) {
    const recommendations = [];
    const pcaThreshold = Number.isFinite(this.#config.pcaResidualVarianceThreshold)
      ? this.#config.pcaResidualVarianceThreshold
      : 0.15;

    // Filter out metadata-only conflicts (e.g., sign_tension) - these should not trigger recommendations
    const actionableConflicts = Array.isArray(conflicts)
      ? conflicts.filter(
          (conflict) => !METADATA_ONLY_FLAG_REASONS.has(conflict.flagReason)
        )
      : [];

    const pcaTriggered =
      pcaResult.residualVarianceRatio >= pcaThreshold ||
      pcaResult.additionalSignificantComponents > 0;
    const hasHubs = Array.isArray(hubs) && hubs.length > 0;
    const hasGaps = Array.isArray(gaps) && gaps.length > 0;
    const hasConflicts = actionableConflicts.length > 0;

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
    return {
      priority,
      type,
      description,
      affectedPrototypes: [...new Set(affectedPrototypes)].sort(),
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
}
