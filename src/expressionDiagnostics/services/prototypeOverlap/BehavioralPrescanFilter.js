/**
 * @file BehavioralPrescanFilter - Route C cheap behavioral prescan for candidate selection
 * @description Performs lightweight Monte Carlo sampling to identify pairs with behavioral
 * overlap that were missed by Route A (weight-based) and Route B (gate-structure-based)
 * filtering. Uses fewer samples than full analysis for efficiency.
 * @see specs/prototype-redundancy-analyzer-v2.md
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * @typedef {object} PrescanResult
 * @property {boolean} passes - Whether the pair passes Route C filtering
 * @property {number} gateOverlapRatio - onBothCount / onEitherCount ratio [0, 1]
 * @property {number} sampleCount - Number of samples used
 * @property {number} onBothCount - Samples where both gates passed
 * @property {number} onEitherCount - Samples where at least one gate passed
 */

/**
 * Filters prototype pairs via cheap behavioral prescan (Route C).
 *
 * Route C complements Routes A and B by performing lightweight Monte Carlo sampling
 * to discover pairs with behavioral overlap despite:
 * - Different weight vectors (missed by Route A)
 * - Non-implicating gate structures (missed by Route B)
 *
 * Uses significantly fewer samples than full behavioral analysis for efficiency.
 */
class BehavioralPrescanFilter {
  #config;
  #logger;
  #randomStateGenerator;
  #contextBuilder;
  #prototypeGateChecker;

  /**
   * Constructs a new BehavioralPrescanFilter instance.
   *
   * @param {object} deps - Dependencies
   * @param {object} deps.config - Configuration with Route C thresholds
   * @param {import('../../../interfaces/coreServices.js').ILogger} deps.logger - Logger instance
   * @param {object} deps.randomStateGenerator - RandomStateGenerator service
   * @param {object} deps.contextBuilder - MonteCarloContextBuilder service
   * @param {object} deps.prototypeGateChecker - PrototypeGateChecker service
   */
  constructor({
    config,
    logger,
    randomStateGenerator,
    contextBuilder,
    prototypeGateChecker,
  }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });

    if (!config || typeof config !== 'object') {
      logger.error('BehavioralPrescanFilter: Missing or invalid config');
      throw new Error('BehavioralPrescanFilter requires a valid config object');
    }

    validateDependency(randomStateGenerator, 'IRandomStateGenerator', logger, {
      requiredMethods: ['generate'],
    });

    validateDependency(contextBuilder, 'IMonteCarloContextBuilder', logger, {
      requiredMethods: ['buildContext'],
    });

    validateDependency(prototypeGateChecker, 'IPrototypeGateChecker', logger, {
      requiredMethods: ['checkAllGatesPass'],
    });

    this.#validateConfigRequirements(config, logger);

    this.#config = config;
    this.#logger = logger;
    this.#randomStateGenerator = randomStateGenerator;
    this.#contextBuilder = contextBuilder;
    this.#prototypeGateChecker = prototypeGateChecker;
  }

  /**
   * Perform behavioral prescan on a prototype pair.
   *
   * @param {object} prototypeA - First prototype with gates property
   * @param {object} prototypeB - Second prototype with gates property
   * @returns {PrescanResult} Result indicating if pair passes and gate overlap metrics
   */
  prescan(prototypeA, prototypeB) {
    const sampleCount = this.#config.prescanSampleCount;
    const minGateOverlap = this.#config.prescanMinGateOverlap;

    const gatesA = prototypeA?.gates || [];
    const gatesB = prototypeB?.gates || [];

    let onEitherCount = 0;
    let onBothCount = 0;

    for (let i = 0; i < sampleCount; i++) {
      // Generate random state
      const state = this.#randomStateGenerator.generate('uniform', 'static');

      // Build context for gate evaluation
      const context = this.#contextBuilder.buildContext(
        state.current,
        state.previous,
        state.affectTraits,
        null,
        false
      );

      // Check gates for both prototypes
      const passA = this.#prototypeGateChecker.checkAllGatesPass(
        gatesA,
        context
      );
      const passB = this.#prototypeGateChecker.checkAllGatesPass(
        gatesB,
        context
      );

      if (passA || passB) {
        onEitherCount++;
      }
      if (passA && passB) {
        onBothCount++;
      }
    }

    // Compute gate overlap ratio (Jaccard-like for gate regions)
    const gateOverlapRatio =
      onEitherCount > 0 ? onBothCount / onEitherCount : 0;

    const passes = gateOverlapRatio >= minGateOverlap;

    return {
      passes,
      gateOverlapRatio,
      sampleCount,
      onBothCount,
      onEitherCount,
    };
  }

  /**
   * Filter a list of pairs through Route C behavioral prescan.
   *
   * @param {Array<{prototypeA: object, prototypeB: object}>} pairs - Pairs rejected by Routes A and B
   * @returns {{candidates: Array<object>, stats: object}} Candidates that pass Route C with stats
   */
  filterPairs(pairs) {
    if (!Array.isArray(pairs)) {
      this.#logger.warn(
        'BehavioralPrescanFilter.filterPairs: Invalid input, expected array'
      );
      return {
        candidates: [],
        stats: { passed: 0, rejected: 0, skipped: 0 },
      };
    }

    const maxPrescanPairs = this.#config.maxPrescanPairs;
    const candidates = [];
    let skipped = 0;

    // Apply safety limit on pairs to prescan
    const pairsToScan = pairs.slice(0, maxPrescanPairs);
    skipped = pairs.length - pairsToScan.length;

    for (const pair of pairsToScan) {
      const result = this.prescan(pair.prototypeA, pair.prototypeB);

      if (result.passes) {
        candidates.push({
          prototypeA: pair.prototypeA,
          prototypeB: pair.prototypeB,
          candidateMetrics: pair.candidateMetrics || {},
          selectedBy: 'routeC',
          routeMetrics: {
            gateOverlapRatio: result.gateOverlapRatio,
            sampleCount: result.sampleCount,
            onBothCount: result.onBothCount,
            onEitherCount: result.onEitherCount,
          },
        });
      }
    }

    this.#logger.debug(
      `BehavioralPrescanFilter: ${candidates.length}/${pairsToScan.length} pairs passed ` +
        `(skipped ${skipped} due to maxPrescanPairs limit)`
    );

    return {
      candidates,
      stats: {
        passed: candidates.length,
        rejected: pairsToScan.length - candidates.length,
        skipped,
      },
    };
  }

  /**
   * Validate required config properties.
   *
   * @param {object} config - Configuration object
   * @param {object} logger - Logger for error messages
   */
  #validateConfigRequirements(config, logger) {
    const requiredKeys = [
      'prescanSampleCount',
      'prescanMinGateOverlap',
      'maxPrescanPairs',
    ];

    for (const key of requiredKeys) {
      if (typeof config[key] !== 'number') {
        logger.error(
          `BehavioralPrescanFilter: Missing or invalid config.${key}`
        );
        throw new Error(
          `BehavioralPrescanFilter config requires numeric ${key}`
        );
      }
    }
  }
}

export default BehavioralPrescanFilter;
