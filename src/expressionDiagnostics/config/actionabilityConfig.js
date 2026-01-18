/**
 * @file Configuration for Monte Carlo actionability improvements
 * @see specs/monte-carlo-actionability-improvements.md
 */

// ============================================================
// TYPE DEFINITIONS (JSDoc)
// ============================================================

/**
 * @typedef {object} BlockerInfo
 * @property {string} clauseId - Unique clause identifier
 * @property {string} clauseDescription - Human-readable description
 * @property {number} lastMileRate - Failure rate when all others pass
 * @property {number} impactScore - Estimated Δ trigger rate if removed
 * @property {number} compositeScore - Weighted combination score
 * @property {number} inRegimePassRate - Pass rate within mood regime
 * @property {'core'|'non-core'} classification - Blocker classification
 */

/**
 * @typedef {object} DominantCoreResult
 * @property {BlockerInfo[]} coreBlockers - Top 1-3 blockers
 * @property {BlockerInfo[]} nonCoreConstraints - High-pass-rate clauses
 * @property {Map<string, number>} compositeScores - All clause scores
 */

/**
 * @typedef {object} WitnessSearchResult
 * @property {boolean} found - Whether a reasonable candidate was found
 * @property {object|null} bestCandidateState - The state that came closest
 * @property {number} andBlockScore - Fraction of clauses passing
 * @property {BlockingClauseInfo[]} blockingClauses - Clauses still failing
 * @property {ThresholdAdjustment[]} minimalAdjustments - Suggested changes
 * @property {SearchStatistics} searchStats - Performance metrics
 */

/**
 * @typedef {object} BlockingClauseInfo
 * @property {string} clauseId - Unique clause identifier
 * @property {string} clauseDescription - Human-readable description
 * @property {number} observedValue - Value observed during search
 * @property {number} threshold - Threshold value required
 * @property {number} gap - Difference: threshold - observedValue
 */

/**
 * @typedef {object} ThresholdAdjustment
 * @property {string} clauseId - Clause being adjusted
 * @property {number} currentThreshold - Current threshold value
 * @property {number} suggestedThreshold - Suggested new threshold
 * @property {number} delta - Change amount (suggestedThreshold - currentThreshold)
 * @property {'high'|'medium'|'low'} confidence - Confidence in suggestion
 */

/**
 * @typedef {object} SearchStatistics
 * @property {number} samplesEvaluated - Number of samples evaluated
 * @property {number} hillClimbIterations - Number of hill climb iterations
 * @property {number} timeMs - Time elapsed in milliseconds
 */

/**
 * @typedef {object} OrBlockAnalysis
 * @property {string} blockId - Unique OR block identifier
 * @property {string} blockDescription - Human-readable description
 * @property {OrAlternativeAnalysis[]} alternatives - Analysis of each alternative
 * @property {number} deadWeightCount - Number of dead-weight alternatives
 * @property {RestructureRecommendation[]} recommendations - Restructure suggestions
 * @property {string} impactSummary - Summary of impact if recommendations applied
 */

/**
 * @typedef {object} OrAlternativeAnalysis
 * @property {number} alternativeIndex - Index of the alternative in OR block
 * @property {string} clauseDescription - Human-readable clause description
 * @property {number} exclusiveCoverage - Pass rate when ONLY this alt passes
 * @property {number} marginalContribution - Δ OR pass rate if removed
 * @property {number} overlapRatio - Fraction covered by others too
 * @property {'meaningful'|'weak'|'dead-weight'} classification - Alternative classification
 */

/**
 * @typedef {object} RestructureRecommendation
 * @property {'delete'|'lower-threshold'|'replace'} action - Recommended action
 * @property {number} targetAlternative - Index of target alternative
 * @property {number} [suggestedValue] - Suggested threshold value (for lower-threshold)
 * @property {string} [suggestedReplacement] - Suggested replacement clause
 * @property {string} rationale - Explanation of recommendation
 * @property {string} predictedImpact - Expected outcome if applied
 */

/**
 * @typedef {object} RecommendedEditSet
 * @property {[number, number]} targetBand - Target rate band [minRate, maxRate]
 * @property {EditProposal|null} primaryRecommendation - Top recommendation
 * @property {EditProposal[]} alternativeEdits - Alternative edit proposals
 * @property {string[]} notRecommended - Edits that are not recommended with reasons
 */

/**
 * @typedef {object} EditProposal
 * @property {SingleEdit[]} edits - List of edits in this proposal
 * @property {number} predictedTriggerRate - Predicted trigger rate after edits
 * @property {[number, number]} confidenceInterval - Confidence interval for prediction
 * @property {'high'|'medium'|'low'} confidence - Confidence level
 * @property {'importance-sampling'|'extrapolation'} validationMethod - How rate was estimated
 * @property {number} score - Ranking score for this proposal
 */

/**
 * @typedef {object} SingleEdit
 * @property {string} clauseId - Clause being edited
 * @property {'threshold'|'structure'} editType - Type of edit
 * @property {string|number} before - Value before edit
 * @property {string|number} after - Value after edit
 * @property {number} [delta] - Change amount (for threshold edits)
 */

/**
 * @typedef {object} ValidationResult
 * @property {number} estimatedRate - Estimated trigger rate
 * @property {[number, number]} confidenceInterval - Confidence interval bounds
 * @property {'high'|'medium'|'low'} confidence - Confidence assessment
 * @property {number} sampleCount - Number of samples used
 * @property {number} effectiveSampleSize - Effective sample size after weighting
 */

// ============================================================
// CONFIG TYPE DEFINITIONS
// ============================================================

/**
 * @typedef {object} MinimalBlockerSetConfig
 * @property {boolean} enabled - Enable/disable minimal blocker set analysis
 * @property {number} maxCoreBlockers - Maximum core blockers to identify (1-3)
 * @property {number} nonCorePassRateThreshold - Pass rate threshold for non-core (0.95)
 * @property {number} impactWeight - Weight for impact score (0.6)
 * @property {number} lastMileWeight - Weight for last-mile rate (0.4)
 * @property {number} minMarginalExplanation - Min marginal explanatory power (0.05)
 */

/**
 * @typedef {object} ThresholdSuggestionsConfig
 * @property {boolean} enabled - Enable/disable threshold suggestions
 * @property {number[]} targetPassRates - Target pass rates for suggestions
 * @property {boolean} includeInNonZeroHitCases - Include for non-zero hit cases
 * @property {boolean} showAbsoluteCeiling - Show absolute ceiling in output
 */

/**
 * @typedef {object} WitnessSearchConfig
 * @property {boolean} enabled - Enable/disable witness search
 * @property {number} maxSamples - Maximum samples to evaluate
 * @property {number} hillClimbSeeds - Number of hill climb seeds
 * @property {number} hillClimbIterations - Iterations per hill climb
 * @property {number} perturbationDelta - Perturbation delta for hill climb
 * @property {number} timeoutMs - Timeout in milliseconds
 * @property {number} minAndBlockScore - Minimum AND block score for found
 */

/**
 * @typedef {object} OrBlockAnalysisConfig
 * @property {boolean} enabled - Enable/disable OR block analysis
 * @property {number} deadWeightThreshold - Threshold for dead-weight classification
 * @property {number} weakContributorThreshold - Threshold for weak classification
 * @property {number} targetExclusiveCoverage - Target exclusive coverage for threshold lowering
 * @property {boolean} enableReplacementSuggestions - Enable replacement suggestions
 */

/**
 * @typedef {object} ImportanceSamplingConfig
 * @property {boolean} enabled - Enable/disable importance sampling
 * @property {number} confidenceLevel - Confidence level for intervals
 */

/**
 * @typedef {object} EditSetGenerationConfig
 * @property {boolean} enabled - Enable/disable edit set generation
 * @property {[number, number]} defaultTargetBand - Default target rarity band
 * @property {number[]} targetPassRates - Target pass rates for candidate generation
 * @property {number} maxCandidatesToValidate - Max candidates to validate
 * @property {number} maxEditProposals - Max edit proposals to return
 * @property {ImportanceSamplingConfig} importanceSampling - Importance sampling config
 */

/**
 * @typedef {object} ActionabilityConfig
 * @property {MinimalBlockerSetConfig} minimalBlockerSet - Minimal blocker set config
 * @property {ThresholdSuggestionsConfig} thresholdSuggestions - Threshold suggestions config
 * @property {WitnessSearchConfig} witnessSearch - Witness search config
 * @property {OrBlockAnalysisConfig} orBlockAnalysis - OR block analysis config
 * @property {EditSetGenerationConfig} editSetGeneration - Edit set generation config
 */

// ============================================================
// CONFIGURATION
// ============================================================

/**
 * Configuration for Monte Carlo actionability improvements.
 * Structure matches advancedMetricsConfig.js pattern.
 *
 * @type {ActionabilityConfig}
 */
export const actionabilityConfig = {
  // A. Minimal Blocker Set
  minimalBlockerSet: {
    enabled: true,
    maxCoreBlockers: 3,
    nonCorePassRateThreshold: 0.95,
    impactWeight: 0.6,
    lastMileWeight: 0.4,
    minMarginalExplanation: 0.05,
  },

  // B. Threshold Suggestions
  thresholdSuggestions: {
    enabled: true,
    targetPassRates: [0.01, 0.05, 0.1, 0.25],
    includeInNonZeroHitCases: true,
    showAbsoluteCeiling: true,
  },

  // C. Constructive Witness Search
  witnessSearch: {
    enabled: true,
    maxSamples: 5000,
    hillClimbSeeds: 10,
    hillClimbIterations: 100,
    perturbationDelta: 0.01,
    timeoutMs: 5000,
    minAndBlockScore: 0.5,
  },

  // D. OR Block Analysis
  orBlockAnalysis: {
    enabled: true,
    deadWeightThreshold: 0.01,
    weakContributorThreshold: 0.05,
    targetExclusiveCoverage: 0.08,
    enableReplacementSuggestions: false,
  },

  // E. Edit Set Generation
  editSetGeneration: {
    enabled: true,
    defaultTargetBand: [0.0001, 0.001],
    targetPassRates: [0.01, 0.05, 0.1],
    maxCandidatesToValidate: 10,
    maxEditProposals: 5,
    importanceSampling: {
      enabled: true,
      confidenceLevel: 0.95,
    },
  },
};

export default actionabilityConfig;
