/**
 * @file DI registrations for Prototype Overlap Analysis services (PROOVEANA series)
 * @see specs/prototype-overlap-analyzer.md
 */

import { Registrar } from '../../utils/registrarHelpers.js';
import { tokens } from '../tokens.js';
import { diagnosticsTokens } from '../tokens/tokens-diagnostics.js';
import { PROTOTYPE_OVERLAP_CONFIG } from '../../expressionDiagnostics/config/prototypeOverlapConfig.js';

// Service imports
import CandidatePairFilter from '../../expressionDiagnostics/services/prototypeOverlap/CandidatePairFilter.js';
import BehavioralOverlapEvaluator from '../../expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js';
import OverlapClassifier from '../../expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js';
import OverlapRecommendationBuilder from '../../expressionDiagnostics/services/prototypeOverlap/OverlapRecommendationBuilder.js';
import PrototypeOverlapAnalyzer from '../../expressionDiagnostics/services/PrototypeOverlapAnalyzer.js';
import PrototypeAnalysisController from '../../domUI/prototype-analysis/PrototypeAnalysisController.js';
import GateConstraintExtractor from '../../expressionDiagnostics/services/prototypeOverlap/GateConstraintExtractor.js';
import GateImplicationEvaluator from '../../expressionDiagnostics/services/prototypeOverlap/GateImplicationEvaluator.js';
import GateBandingSuggestionBuilder from '../../expressionDiagnostics/services/prototypeOverlap/GateBandingSuggestionBuilder.js';
import GateSimilarityFilter from '../../expressionDiagnostics/services/prototypeOverlap/GateSimilarityFilter.js';
import BehavioralPrescanFilter from '../../expressionDiagnostics/services/prototypeOverlap/BehavioralPrescanFilter.js';

/**
 * Register Prototype Overlap Analysis services.
 *
 * Dependencies are registered in order to satisfy their requirements:
 * 1. CandidatePairFilter - Stage A candidate filtering (no service dependencies)
 * 2. BehavioralOverlapEvaluator - Stage B behavioral sampling (depends on intensity/gate services)
 * 3. OverlapClassifier - Stage C classification (no service dependencies)
 * 4. OverlapRecommendationBuilder - Stage D recommendation building (no service dependencies)
 * 5. PrototypeOverlapAnalyzer - Orchestrator (depends on all above)
 *
 * @param {Registrar} registrar - The DI registrar instance
 */
export function registerPrototypeOverlapServices(registrar) {
  // Gate Analysis Services (PROREDANAV2 series - dependencies for Stage B)
  registrar.singletonFactory(
    diagnosticsTokens.IGateConstraintExtractor,
    (c) =>
      new GateConstraintExtractor({
        config: PROTOTYPE_OVERLAP_CONFIG,
        logger: c.resolve(tokens.ILogger),
      })
  );

  registrar.singletonFactory(
    diagnosticsTokens.IGateImplicationEvaluator,
    (c) =>
      new GateImplicationEvaluator({
        logger: c.resolve(tokens.ILogger),
      })
  );

  registrar.singletonFactory(
    diagnosticsTokens.IGateBandingSuggestionBuilder,
    (c) =>
      new GateBandingSuggestionBuilder({
        config: PROTOTYPE_OVERLAP_CONFIG,
        logger: c.resolve(tokens.ILogger),
      })
  );

  // Multi-Route Candidate Filtering Services (PROREDANAV2.1 series)
  registrar.singletonFactory(
    diagnosticsTokens.IGateSimilarityFilter,
    (c) =>
      new GateSimilarityFilter({
        config: PROTOTYPE_OVERLAP_CONFIG,
        logger: c.resolve(tokens.ILogger),
        gateConstraintExtractor: c.resolve(
          diagnosticsTokens.IGateConstraintExtractor
        ),
        gateImplicationEvaluator: c.resolve(
          diagnosticsTokens.IGateImplicationEvaluator
        ),
      })
  );

  registrar.singletonFactory(
    diagnosticsTokens.IBehavioralPrescanFilter,
    (c) =>
      new BehavioralPrescanFilter({
        config: PROTOTYPE_OVERLAP_CONFIG,
        logger: c.resolve(tokens.ILogger),
        randomStateGenerator: c.resolve(diagnosticsTokens.IRandomStateGenerator),
        contextBuilder: c.resolve(diagnosticsTokens.IMonteCarloContextBuilder),
        prototypeGateChecker: c.resolve(diagnosticsTokens.IPrototypeGateChecker),
      })
  );

  // Stage A: Candidate filtering (with optional multi-route dependencies)
  registrar.singletonFactory(
    diagnosticsTokens.ICandidatePairFilter,
    (c) =>
      new CandidatePairFilter({
        config: PROTOTYPE_OVERLAP_CONFIG,
        logger: c.resolve(tokens.ILogger),
        gateSimilarityFilter: c.resolve(diagnosticsTokens.IGateSimilarityFilter),
        behavioralPrescanFilter: c.resolve(
          diagnosticsTokens.IBehavioralPrescanFilter
        ),
      })
  );

  // Stage B: Behavioral overlap evaluation
  registrar.singletonFactory(
    diagnosticsTokens.IBehavioralOverlapEvaluator,
    (c) =>
      new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: c.resolve(
          diagnosticsTokens.IPrototypeIntensityCalculator
        ),
        randomStateGenerator: c.resolve(diagnosticsTokens.IRandomStateGenerator),
        contextBuilder: c.resolve(diagnosticsTokens.IMonteCarloContextBuilder),
        prototypeGateChecker: c.resolve(diagnosticsTokens.IPrototypeGateChecker),
        gateConstraintExtractor: c.resolve(
          diagnosticsTokens.IGateConstraintExtractor
        ),
        gateImplicationEvaluator: c.resolve(
          diagnosticsTokens.IGateImplicationEvaluator
        ),
        config: PROTOTYPE_OVERLAP_CONFIG,
        logger: c.resolve(tokens.ILogger),
      })
  );

  // Stage C: Classification
  registrar.singletonFactory(
    diagnosticsTokens.IOverlapClassifier,
    (c) =>
      new OverlapClassifier({
        config: PROTOTYPE_OVERLAP_CONFIG,
        logger: c.resolve(tokens.ILogger),
      })
  );

  // Stage D: Recommendation building
  registrar.singletonFactory(
    diagnosticsTokens.IOverlapRecommendationBuilder,
    (c) =>
      new OverlapRecommendationBuilder({
        config: PROTOTYPE_OVERLAP_CONFIG,
        logger: c.resolve(tokens.ILogger),
      })
  );

  // Orchestrator: PrototypeOverlapAnalyzer
  registrar.singletonFactory(
    diagnosticsTokens.IPrototypeOverlapAnalyzer,
    (c) =>
      new PrototypeOverlapAnalyzer({
        prototypeRegistryService: c.resolve(
          diagnosticsTokens.IPrototypeRegistryService
        ),
        candidatePairFilter: c.resolve(diagnosticsTokens.ICandidatePairFilter),
        behavioralOverlapEvaluator: c.resolve(
          diagnosticsTokens.IBehavioralOverlapEvaluator
        ),
        overlapClassifier: c.resolve(diagnosticsTokens.IOverlapClassifier),
        overlapRecommendationBuilder: c.resolve(
          diagnosticsTokens.IOverlapRecommendationBuilder
        ),
        gateBandingSuggestionBuilder: c.resolve(
          diagnosticsTokens.IGateBandingSuggestionBuilder
        ),
        config: PROTOTYPE_OVERLAP_CONFIG,
        logger: c.resolve(tokens.ILogger),
      })
  );

  // UI Controller: PrototypeAnalysisController
  registrar.singletonFactory(
    diagnosticsTokens.IPrototypeAnalysisController,
    (c) =>
      new PrototypeAnalysisController({
        logger: c.resolve(tokens.ILogger),
        prototypeOverlapAnalyzer: c.resolve(
          diagnosticsTokens.IPrototypeOverlapAnalyzer
        ),
      })
  );
}

export default registerPrototypeOverlapServices;
