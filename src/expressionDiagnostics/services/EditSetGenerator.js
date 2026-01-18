/**
 * @file EditSetGenerator - Synthesizes insights to generate ranked edit proposals
 * @see specs/monte-carlo-actionability-improvements.md
 * @see tickets/MONCARACTIMP-010-edit-set-generator.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { actionabilityConfig } from '../config/actionabilityConfig.js';

/** @typedef {import('../config/actionabilityConfig.js').RecommendedEditSet} RecommendedEditSet */
/** @typedef {import('../config/actionabilityConfig.js').EditProposal} EditProposal */
/** @typedef {import('../config/actionabilityConfig.js').SingleEdit} SingleEdit */
/** @typedef {import('../config/actionabilityConfig.js').BlockerInfo} BlockerInfo */
/** @typedef {import('../config/actionabilityConfig.js').OrBlockAnalysis} OrBlockAnalysis */
/** @typedef {import('../config/actionabilityConfig.js').RestructureRecommendation} RestructureRecommendation */
/** @typedef {import('../config/actionabilityConfig.js').ValidationResult} ValidationResult */
/** @typedef {import('../config/actionabilityConfig.js').EditSetGenerationConfig} EditSetGenerationConfig */

/**
 * Generates ranked edit proposals that target specific trigger rate bands.
 *
 * Synthesizes insights from:
 * - MinimalBlockerSetCalculator (core blockers)
 * - OrBlockAnalyzer (dead-weight alternatives)
 * - ImportanceSamplingValidator (proposal validation)
 *
 * Returns edit proposals ranked by proximity to target rate band and validation confidence.
 */
class EditSetGenerator {
  #logger;
  #blockerCalculator;
  #orBlockAnalyzer;
  #validator;
  #config;

  /**
   * Create a new EditSetGenerator instance.
   *
   * @param {object} deps - Dependencies
   * @param {object} deps.logger - Logger implementing ILogger
   * @param {object} deps.blockerCalculator - MinimalBlockerSetCalculator instance
   * @param {object} deps.orBlockAnalyzer - OrBlockAnalyzer instance
   * @param {object} deps.validator - ImportanceSamplingValidator instance
   * @param {EditSetGenerationConfig} [deps.config] - Optional config override
   */
  constructor({ logger, blockerCalculator, orBlockAnalyzer, validator, config = null }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    validateDependency(blockerCalculator, 'IMinimalBlockerSetCalculator', logger, {
      requiredMethods: ['calculate'],
    });
    validateDependency(orBlockAnalyzer, 'IOrBlockAnalyzer', logger, {
      requiredMethods: ['analyze', 'analyzeAll'],
    });
    validateDependency(validator, 'IImportanceSamplingValidator', logger, {
      requiredMethods: ['validate', 'validateBatch'],
    });

    this.#logger = logger;
    this.#blockerCalculator = blockerCalculator;
    this.#orBlockAnalyzer = orBlockAnalyzer;
    this.#validator = validator;
    this.#config = config ?? actionabilityConfig.editSetGeneration;
  }

  /**
   * Generate ranked edit proposals targeting a specific trigger rate band.
   *
   * @param {object} simulationResult - Full Monte Carlo simulation result
   * @param {[number, number]} [targetBand] - Target rate band [minRate, maxRate]
   * @returns {RecommendedEditSet} Ranked edit proposals
   */
  generate(simulationResult, targetBand = null) {
    const band = targetBand ?? this.#config.defaultTargetBand;

    if (!simulationResult) {
      this.#logger.debug('EditSetGenerator: No simulation result provided');
      return this.#createEmptyResult(band);
    }

    try {
      this.#logger.debug(
        `EditSetGenerator: Generating edits for target band [${band[0]}, ${band[1]}]`
      );

      // Step 1: Analyze core blockers
      const blockerResult = this.#analyzeBlockers(simulationResult);

      // Step 2: Analyze OR blocks
      const orAnalyses = this.#analyzeOrBlocks(simulationResult);

      // Step 3: Generate candidate edits from all sources
      const candidates = this.#generateCandidates(
        blockerResult,
        orAnalyses,
        simulationResult
      );

      if (candidates.length === 0) {
        this.#logger.debug('EditSetGenerator: No candidate edits generated');
        return this.#createEmptyResult(band);
      }

      // Step 4: Validate candidates with importance sampling
      const validatedCandidates = this.#validateCandidates(
        candidates,
        simulationResult
      );

      // Step 5: Score and rank by proximity to target band
      const scoredCandidates = this.#scoreAndRank(validatedCandidates, band);

      // Step 6: Build result
      return this.#buildResult(scoredCandidates, band);
    } catch (err) {
      this.#logger.error('EditSetGenerator: Generation error', err);
      return this.#createEmptyResult(band);
    }
  }

  /**
   * Analyze core blockers from simulation result.
   *
   * @param {object} simulationResult - Simulation result
   * @returns {object} Blocker analysis result
   */
  #analyzeBlockers(simulationResult) {
    const clauses = this.#extractClauses(simulationResult);
    if (clauses.length === 0) {
      return { coreBlockers: [], nonCoreConstraints: [], compositeScores: new Map() };
    }

    return this.#blockerCalculator.calculate(clauses, simulationResult);
  }

  /**
   * Extract clauses from simulation result.
   *
   * @param {object} simulationResult - Simulation result
   * @returns {object[]} Clause tracking data
   */
  #extractClauses(simulationResult) {
    // Check various locations for clause data
    if (Array.isArray(simulationResult.clauses)) {
      return simulationResult.clauses;
    }
    if (Array.isArray(simulationResult.clauseTracking)) {
      return simulationResult.clauseTracking;
    }
    if (simulationResult.metrics?.clauseTracking) {
      return simulationResult.metrics.clauseTracking;
    }
    return [];
  }

  /**
   * Analyze OR blocks from simulation result.
   *
   * @param {object} simulationResult - Simulation result
   * @returns {OrBlockAnalysis[]} OR block analyses
   */
  #analyzeOrBlocks(simulationResult) {
    const orBlocks = this.#extractOrBlocks(simulationResult);
    if (orBlocks.length === 0) {
      return [];
    }

    return this.#orBlockAnalyzer.analyzeAll(orBlocks, simulationResult);
  }

  /**
   * Extract OR blocks from simulation result.
   *
   * @param {object} simulationResult - Simulation result
   * @returns {object[]} OR block data
   */
  #extractOrBlocks(simulationResult) {
    if (Array.isArray(simulationResult.orBlocks)) {
      return simulationResult.orBlocks;
    }
    if (simulationResult.metrics?.orBlocks) {
      return simulationResult.metrics.orBlocks;
    }
    return [];
  }

  /**
   * Generate candidate edit proposals from all analysis sources.
   *
   * @param {object} blockerResult - Blocker analysis result
   * @param {OrBlockAnalysis[]} orAnalyses - OR block analyses
   * @param {object} simulationResult - Simulation result for context
   * @returns {EditProposal[]} Candidate proposals
   */
  #generateCandidates(blockerResult, orAnalyses, simulationResult) {
    const candidates = [];

    // A. Generate threshold edits from core blockers
    const thresholdEdits = this.#generateThresholdEdits(
      blockerResult.coreBlockers,
      simulationResult
    );
    candidates.push(...thresholdEdits);

    // B. Generate structure edits from OR block recommendations
    const structureEdits = this.#generateStructureEdits(orAnalyses);
    candidates.push(...structureEdits);

    // C. Generate combined edits (threshold + structure)
    const combinedEdits = this.#generateCombinedEdits(
      blockerResult.coreBlockers,
      orAnalyses,
      simulationResult
    );
    candidates.push(...combinedEdits);

    // Limit to maxCandidatesToValidate
    const maxCandidates = this.#config.maxCandidatesToValidate ?? 10;
    return candidates.slice(0, maxCandidates);
  }

  /**
   * Generate threshold edit proposals from core blockers.
   *
   * @param {BlockerInfo[]} coreBlockers - Core blocking constraints
   * @param {object} simulationResult - Simulation result for thresholds
   * @returns {EditProposal[]} Threshold edit proposals
   */
  #generateThresholdEdits(coreBlockers, simulationResult) {
    if (!Array.isArray(coreBlockers) || coreBlockers.length === 0) {
      return [];
    }

    const proposals = [];
    const targetPassRates = this.#config.targetPassRates ?? [0.01, 0.05, 0.1];

    for (const blocker of coreBlockers) {
      for (const targetRate of targetPassRates) {
        const edit = this.#createThresholdEdit(blocker, targetRate, simulationResult);
        if (edit) {
          proposals.push({
            edits: [edit],
            predictedTriggerRate: 0, // Will be updated by validation
            confidenceInterval: [0, 1],
            confidence: 'low',
            validationMethod: 'extrapolation',
            score: 0,
          });
        }
      }
    }

    return proposals;
  }

  /**
   * Create a threshold edit for a blocker targeting a pass rate.
   *
   * @param {BlockerInfo} blocker - Blocker to adjust
   * @param {number} targetRate - Target pass rate for the clause
   * @param {object} simulationResult - Simulation result for current thresholds
   * @returns {SingleEdit|null} Threshold edit or null
   */
  #createThresholdEdit(blocker, targetRate, simulationResult) {
    const clauseId = blocker.clauseId;
    const currentThreshold = this.#findCurrentThreshold(clauseId, simulationResult);

    if (currentThreshold === null) {
      return null;
    }

    // Estimate new threshold based on pass rate change needed
    const currentPassRate = blocker.inRegimePassRate ?? 0.5;
    const passRateRatio = targetRate > 0 ? currentPassRate / targetRate : 1;

    // For lower pass rate, reduce threshold
    // This is a heuristic - actual change depends on value distribution
    const delta = currentThreshold * (1 - passRateRatio) * 0.1;
    const suggestedThreshold = Math.max(0, currentThreshold - Math.abs(delta));

    return {
      clauseId,
      editType: 'threshold',
      before: currentThreshold,
      after: suggestedThreshold,
      delta: suggestedThreshold - currentThreshold,
    };
  }

  /**
   * Find current threshold for a clause.
   *
   * @param {string} clauseId - Clause identifier
   * @param {object} simulationResult - Simulation result
   * @returns {number|null} Current threshold or null
   */
  #findCurrentThreshold(clauseId, simulationResult) {
    const clauses = this.#extractClauses(simulationResult);
    const clause = clauses.find((c) => (c.clauseId ?? c.id) === clauseId);

    if (clause && typeof clause.threshold === 'number') {
      return clause.threshold;
    }

    // Check expression context
    const context = simulationResult.expressionContext;
    if (context?.clauses) {
      const contextClause = context.clauses.find((c) => c.id === clauseId);
      if (contextClause && typeof contextClause.threshold === 'number') {
        return contextClause.threshold;
      }
    }

    return null;
  }

  /**
   * Generate structure edit proposals from OR block recommendations.
   *
   * @param {OrBlockAnalysis[]} orAnalyses - OR block analyses
   * @returns {EditProposal[]} Structure edit proposals
   */
  #generateStructureEdits(orAnalyses) {
    if (!Array.isArray(orAnalyses) || orAnalyses.length === 0) {
      return [];
    }

    const proposals = [];

    for (const analysis of orAnalyses) {
      if (!analysis.recommendations || analysis.recommendations.length === 0) {
        continue;
      }

      // Create proposal for each delete recommendation
      const deleteRecs = analysis.recommendations.filter((r) => r.action === 'delete');
      if (deleteRecs.length > 0) {
        const edits = deleteRecs.map((rec) => this.#createStructureEdit(analysis, rec));
        proposals.push({
          edits: edits.filter(Boolean),
          predictedTriggerRate: 0,
          confidenceInterval: [0, 1],
          confidence: 'low',
          validationMethod: 'extrapolation',
          score: 0,
        });
      }

      // Create proposal for lower-threshold recommendations
      const lowerRecs = analysis.recommendations.filter(
        (r) => r.action === 'lower-threshold'
      );
      for (const rec of lowerRecs) {
        const edit = this.#createLowerThresholdEdit(analysis, rec);
        if (edit) {
          proposals.push({
            edits: [edit],
            predictedTriggerRate: 0,
            confidenceInterval: [0, 1],
            confidence: 'low',
            validationMethod: 'extrapolation',
            score: 0,
          });
        }
      }
    }

    return proposals;
  }

  /**
   * Create structure edit from OR block recommendation.
   *
   * @param {OrBlockAnalysis} analysis - OR block analysis
   * @param {RestructureRecommendation} rec - Restructure recommendation
   * @returns {SingleEdit|null} Structure edit or null
   */
  #createStructureEdit(analysis, rec) {
    const alt = analysis.alternatives?.[rec.targetAlternative];
    if (!alt) {
      return null;
    }

    return {
      clauseId: `${analysis.blockId}[${rec.targetAlternative}]`,
      editType: 'structure',
      before: alt.clauseDescription ?? 'existing alternative',
      after: 'removed',
    };
  }

  /**
   * Create threshold edit from lower-threshold recommendation.
   *
   * @param {OrBlockAnalysis} analysis - OR block analysis
   * @param {RestructureRecommendation} rec - Restructure recommendation
   * @returns {SingleEdit|null} Threshold edit or null
   */
  #createLowerThresholdEdit(analysis, rec) {
    if (typeof rec.suggestedValue !== 'number') {
      return null;
    }

    const _alt = analysis.alternatives?.[rec.targetAlternative];
    const currentValue = 'current'; // Would need to extract from original data

    return {
      clauseId: `${analysis.blockId}[${rec.targetAlternative}]`,
      editType: 'threshold',
      before: currentValue,
      after: rec.suggestedValue,
      delta: typeof currentValue === 'number' ? rec.suggestedValue - currentValue : undefined,
    };
  }

  /**
   * Generate combined edit proposals (threshold + structure).
   *
   * @param {BlockerInfo[]} coreBlockers - Core blockers
   * @param {OrBlockAnalysis[]} orAnalyses - OR block analyses
   * @param {object} simulationResult - Simulation result
   * @returns {EditProposal[]} Combined edit proposals
   */
  #generateCombinedEdits(coreBlockers, orAnalyses, simulationResult) {
    // Only generate combined if we have both types of edits
    if (
      (!Array.isArray(coreBlockers) || coreBlockers.length === 0) ||
      (!Array.isArray(orAnalyses) || orAnalyses.length === 0)
    ) {
      return [];
    }

    const proposals = [];

    // Combine top blocker threshold edit with structure edits
    const topBlocker = coreBlockers[0];
    const targetRates = this.#config.targetPassRates ?? [0.05];
    const thresholdEdit = this.#createThresholdEdit(
      topBlocker,
      targetRates[0],
      simulationResult
    );

    if (!thresholdEdit) {
      return [];
    }

    // Combine with each OR block's delete recommendations
    for (const analysis of orAnalyses) {
      const deleteRecs = analysis.recommendations?.filter((r) => r.action === 'delete') ?? [];
      if (deleteRecs.length === 0) {
        continue;
      }

      const structureEdits = deleteRecs
        .map((rec) => this.#createStructureEdit(analysis, rec))
        .filter(Boolean);

      if (structureEdits.length > 0) {
        proposals.push({
          edits: [thresholdEdit, ...structureEdits],
          predictedTriggerRate: 0,
          confidenceInterval: [0, 1],
          confidence: 'low',
          validationMethod: 'extrapolation',
          score: 0,
        });
      }
    }

    return proposals;
  }

  /**
   * Validate candidate proposals using importance sampling.
   *
   * @param {EditProposal[]} candidates - Candidate proposals
   * @param {object} simulationResult - Simulation result with samples
   * @returns {EditProposal[]} Validated proposals
   */
  #validateCandidates(candidates, simulationResult) {
    const samples = simulationResult.samples ?? [];
    const expressionContext = simulationResult.expressionContext ?? { clauses: [] };

    if (samples.length === 0) {
      this.#logger.debug('EditSetGenerator: No samples for validation, using extrapolation');
      return candidates;
    }

    const validationResults = this.#validator.validateBatch(
      candidates,
      samples,
      expressionContext
    );

    return candidates.map((proposal) => {
      const validation = validationResults.get(proposal);
      if (!validation) {
        return proposal;
      }

      return {
        ...proposal,
        predictedTriggerRate: validation.estimatedRate,
        confidenceInterval: validation.confidenceInterval,
        confidence: validation.confidence,
        validationMethod: 'importance-sampling',
      };
    });
  }

  /**
   * Score and rank proposals by proximity to target band.
   *
   * @param {EditProposal[]} proposals - Validated proposals
   * @param {[number, number]} targetBand - Target rate band
   * @returns {EditProposal[]} Scored and ranked proposals
   */
  #scoreAndRank(proposals, targetBand) {
    const [minTarget, maxTarget] = targetBand;
    const bandCenter = (minTarget + maxTarget) / 2;
    const bandWidth = maxTarget - minTarget;

    const scored = proposals.map((proposal) => {
      const rate = proposal.predictedTriggerRate;

      // Calculate proximity score (higher = closer to target band)
      let proximityScore;
      if (rate >= minTarget && rate <= maxTarget) {
        // Inside band - perfect score with bonus for being close to center
        const distanceFromCenter = Math.abs(rate - bandCenter);
        proximityScore = 1.0 - (distanceFromCenter / (bandWidth / 2)) * 0.1;
      } else if (rate < minTarget) {
        // Below band - penalize proportionally
        proximityScore = rate / minTarget;
      } else {
        // Above band - penalize proportionally
        proximityScore = maxTarget / rate;
      }

      // Confidence boost (0-0.2)
      const confidenceBoost =
        proposal.confidence === 'high' ? 0.2 :
        proposal.confidence === 'medium' ? 0.1 : 0;

      // Simplicity bonus (fewer edits = better)
      const simplicityBonus = 1 / (1 + proposal.edits.length * 0.1);

      // Combine scores
      const score =
        proximityScore * 0.6 +
        confidenceBoost +
        simplicityBonus * 0.2;

      return {
        ...proposal,
        score: Math.max(0, Math.min(1, score)),
      };
    });

    // Sort by score descending
    return scored.sort((a, b) => b.score - a.score);
  }

  /**
   * Build final result from scored proposals.
   *
   * @param {EditProposal[]} scoredProposals - Scored and ranked proposals
   * @param {[number, number]} targetBand - Target rate band
   * @returns {RecommendedEditSet} Final result
   */
  #buildResult(scoredProposals, targetBand) {
    const maxProposals = this.#config.maxEditProposals ?? 5;
    const [minTarget, maxTarget] = targetBand;

    // Filter out proposals that are clearly not helpful
    const viableProposals = scoredProposals.filter(
      (p) => p.score > 0.1 || p.edits.length > 0
    );

    // Separate primary from alternatives
    const primary = viableProposals.length > 0 ? viableProposals[0] : null;
    const alternatives = viableProposals.slice(1, maxProposals);

    // Build not-recommended list with reasons
    const notRecommended = scoredProposals
      .filter((p) => p.score <= 0.1)
      .slice(0, 3)
      .map((p) => {
        const rate = p.predictedTriggerRate;
        if (rate < minTarget) {
          return `Edit would result in rate ${(rate * 100).toFixed(2)}% (below target ${(minTarget * 100).toFixed(2)}%)`;
        }
        if (rate > maxTarget) {
          return `Edit would result in rate ${(rate * 100).toFixed(2)}% (above target ${(maxTarget * 100).toFixed(2)}%)`;
        }
        return `Edit has low confidence (${p.confidence})`;
      });

    this.#logger.debug(
      `EditSetGenerator: Generated ${viableProposals.length} viable proposals, ` +
      `primary score: ${primary?.score?.toFixed(3) ?? 'N/A'}`
    );

    return {
      targetBand,
      primaryRecommendation: primary,
      alternativeEdits: alternatives,
      notRecommended,
    };
  }

  /**
   * Create empty result structure.
   *
   * @param {[number, number]} targetBand - Target rate band
   * @returns {RecommendedEditSet} Empty result
   */
  #createEmptyResult(targetBand) {
    return {
      targetBand,
      primaryRecommendation: null,
      alternativeEdits: [],
      notRecommended: [],
    };
  }
}

export default EditSetGenerator;
