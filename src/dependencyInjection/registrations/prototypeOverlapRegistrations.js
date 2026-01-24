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
import AxisGapAnalyzer from '../../expressionDiagnostics/services/AxisGapAnalyzer.js';
import PrototypeAnalysisController from '../../domUI/prototype-analysis/PrototypeAnalysisController.js';
import GateConstraintExtractor from '../../expressionDiagnostics/services/prototypeOverlap/GateConstraintExtractor.js';
import GateImplicationEvaluator from '../../expressionDiagnostics/services/prototypeOverlap/GateImplicationEvaluator.js';
import GateBandingSuggestionBuilder from '../../expressionDiagnostics/services/prototypeOverlap/GateBandingSuggestionBuilder.js';
import GateSimilarityFilter from '../../expressionDiagnostics/services/prototypeOverlap/GateSimilarityFilter.js';
import BehavioralPrescanFilter from '../../expressionDiagnostics/services/prototypeOverlap/BehavioralPrescanFilter.js';

// V3 Service imports (PROANAOVEV3 series)
import SharedContextPoolGenerator from '../../expressionDiagnostics/services/prototypeOverlap/SharedContextPoolGenerator.js';
import PrototypeVectorEvaluator from '../../expressionDiagnostics/services/prototypeOverlap/PrototypeVectorEvaluator.js';
import { wilsonInterval } from '../../expressionDiagnostics/services/prototypeOverlap/WilsonInterval.js';
import AgreementMetricsCalculator from '../../expressionDiagnostics/services/prototypeOverlap/AgreementMetricsCalculator.js';
import PrototypeProfileCalculator from '../../expressionDiagnostics/services/prototypeOverlap/PrototypeProfileCalculator.js';
import GateASTNormalizer from '../../expressionDiagnostics/services/prototypeOverlap/GateASTNormalizer.js';
import ActionableSuggestionEngine from '../../expressionDiagnostics/services/prototypeOverlap/ActionableSuggestionEngine.js';

// Axis Gap Analysis Sub-Services (refactored)
import { PCAAnalysisService } from '../../expressionDiagnostics/services/axisGap/PCAAnalysisService.js';
import { HubPrototypeDetector } from '../../expressionDiagnostics/services/axisGap/HubPrototypeDetector.js';
import { CoverageGapDetector } from '../../expressionDiagnostics/services/axisGap/CoverageGapDetector.js';
import { MultiAxisConflictDetector } from '../../expressionDiagnostics/services/axisGap/MultiAxisConflictDetector.js';
import { AxisGapRecommendationBuilder } from '../../expressionDiagnostics/services/axisGap/AxisGapRecommendationBuilder.js';
import { AxisGapReportSynthesizer } from '../../expressionDiagnostics/services/axisGap/AxisGapReportSynthesizer.js';

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
        gateASTNormalizer: c.resolve(diagnosticsTokens.IGateASTNormalizer),
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
        // V3 dependency (PROANAOVEV3-011): optional for backward compatibility
        agreementMetricsCalculator: c.resolve(
          diagnosticsTokens.IAgreementMetricsCalculator
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
  // Note: actionableSuggestionEngine is registered in V3 section below but resolved lazily
  registrar.singletonFactory(
    diagnosticsTokens.IOverlapRecommendationBuilder,
    (c) =>
      new OverlapRecommendationBuilder({
        config: PROTOTYPE_OVERLAP_CONFIG,
        logger: c.resolve(tokens.ILogger),
        actionableSuggestionEngine: c.resolve(
          diagnosticsTokens.IActionableSuggestionEngine
        ),
      })
  );

  // Orchestrator: PrototypeOverlapAnalyzer
  // NOTE: V3 services are registered below and must exist before this factory is called.
  // The registration order ensures V3 services are available.
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
        // V3 services (PROANAOVEV3-013): Enable V3 analysis pipeline
        sharedContextPoolGenerator: c.resolve(
          diagnosticsTokens.ISharedContextPoolGenerator
        ),
        prototypeVectorEvaluator: c.resolve(
          diagnosticsTokens.IPrototypeVectorEvaluator
        ),
        prototypeProfileCalculator: c.resolve(
          diagnosticsTokens.IPrototypeProfileCalculator
        ),
        // V3 Stage C.5 (AXIGAPDETSPE-009): Axis gap detection
        axisGapAnalyzer: c.resolve(diagnosticsTokens.IAxisGapAnalyzer),
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

  // ========================================
  // V3 Services (PROANAOVEV3 series)
  // ========================================

  // SharedContextPoolGenerator: generates shared context pool for consistent prototype evaluation
  registrar.singletonFactory(
    diagnosticsTokens.ISharedContextPoolGenerator,
    (c) =>
      new SharedContextPoolGenerator({
        randomStateGenerator: c.resolve(diagnosticsTokens.IRandomStateGenerator),
        contextBuilder: c.resolve(diagnosticsTokens.IMonteCarloContextBuilder),
        logger: c.resolve(tokens.ILogger),
        poolSize: PROTOTYPE_OVERLAP_CONFIG.sharedPoolSize,
        stratified: PROTOTYPE_OVERLAP_CONFIG.enableStratifiedSampling,
        stratumCount: PROTOTYPE_OVERLAP_CONFIG.stratumCount,
        stratificationStrategy: PROTOTYPE_OVERLAP_CONFIG.stratificationStrategy,
        randomSeed: PROTOTYPE_OVERLAP_CONFIG.poolRandomSeed,
      })
  );

  // PrototypeVectorEvaluator: evaluates prototypes on shared context pool
  registrar.singletonFactory(
    diagnosticsTokens.IPrototypeVectorEvaluator,
    (c) =>
      new PrototypeVectorEvaluator({
        prototypeGateChecker: c.resolve(diagnosticsTokens.IPrototypeGateChecker),
        prototypeIntensityCalculator: c.resolve(
          diagnosticsTokens.IPrototypeIntensityCalculator
        ),
        contextAxisNormalizer: c.resolve(diagnosticsTokens.IContextAxisNormalizer),
        logger: c.resolve(tokens.ILogger),
      })
  );

  // WilsonInterval: pure function for confidence interval calculation
  registrar.singletonFactory(
    diagnosticsTokens.IWilsonInterval,
    () => wilsonInterval
  );

  // AgreementMetricsCalculator: computes MAE/RMSE/CI metrics
  registrar.singletonFactory(
    diagnosticsTokens.IAgreementMetricsCalculator,
    (c) =>
      new AgreementMetricsCalculator({
        wilsonInterval: c.resolve(diagnosticsTokens.IWilsonInterval),
        confidenceLevel: PROTOTYPE_OVERLAP_CONFIG.confidenceLevel,
        minSamplesForReliableCorrelation:
          PROTOTYPE_OVERLAP_CONFIG.minSamplesForReliableCorrelation,
        logger: c.resolve(tokens.ILogger),
      })
  );

  // PrototypeProfileCalculator: computes per-prototype profile signals
  registrar.singletonFactory(
    diagnosticsTokens.IPrototypeProfileCalculator,
    (c) =>
      new PrototypeProfileCalculator({
        config: {
          lowVolumeThreshold: PROTOTYPE_OVERLAP_CONFIG.lowVolumeThreshold,
          lowNoveltyThreshold: PROTOTYPE_OVERLAP_CONFIG.lowNoveltyThreshold,
          singleAxisFocusThreshold:
            PROTOTYPE_OVERLAP_CONFIG.singleAxisFocusThreshold,
          clusterCount: PROTOTYPE_OVERLAP_CONFIG.clusterCount,
          clusteringMethod: PROTOTYPE_OVERLAP_CONFIG.clusteringMethod,
        },
        logger: c.resolve(tokens.ILogger),
      })
  );

  // ========================================
  // Axis Gap Analysis Sub-Services (refactored)
  // ========================================

  // PCAAnalysisService: Principal Component Analysis for axis gap detection
  registrar.singletonFactory(
    diagnosticsTokens.IPCAAnalysisService,
    (c) =>
      new PCAAnalysisService({
        config: PROTOTYPE_OVERLAP_CONFIG,
        logger: c.resolve(tokens.ILogger),
      })
  );

  // HubPrototypeDetector: Hub detection via overlap graph analysis
  registrar.singletonFactory(
    diagnosticsTokens.IHubPrototypeDetector,
    (c) =>
      new HubPrototypeDetector({
        ...PROTOTYPE_OVERLAP_CONFIG,
      })
  );

  // CoverageGapDetector: Coverage gap identification via clustering
  registrar.singletonFactory(
    diagnosticsTokens.ICoverageGapDetector,
    (c) =>
      new CoverageGapDetector({
        ...PROTOTYPE_OVERLAP_CONFIG,
      })
  );

  // MultiAxisConflictDetector: High axis loadings and sign tension detection
  registrar.singletonFactory(
    diagnosticsTokens.IMultiAxisConflictDetector,
    (c) =>
      new MultiAxisConflictDetector({
        ...PROTOTYPE_OVERLAP_CONFIG,
      })
  );

  // AxisGapRecommendationBuilder: Recommendation generation from analysis results
  registrar.singletonFactory(
    diagnosticsTokens.IAxisGapRecommendationBuilder,
    (c) =>
      new AxisGapRecommendationBuilder({
        pcaResidualVarianceThreshold:
          PROTOTYPE_OVERLAP_CONFIG.pcaResidualVarianceThreshold,
      })
  );

  // AxisGapReportSynthesizer: Report synthesis from all analysis results
  registrar.singletonFactory(
    diagnosticsTokens.IAxisGapReportSynthesizer,
    (c) =>
      new AxisGapReportSynthesizer(
        {
          pcaResidualVarianceThreshold:
            PROTOTYPE_OVERLAP_CONFIG.pcaResidualVarianceThreshold,
          residualVarianceThreshold:
            PROTOTYPE_OVERLAP_CONFIG.residualVarianceThreshold,
          reconstructionErrorThreshold:
            PROTOTYPE_OVERLAP_CONFIG.reconstructionErrorThreshold,
        },
        c.resolve(diagnosticsTokens.IAxisGapRecommendationBuilder)
      )
  );

  // AxisGapAnalyzer: orchestrator for axis gap detection (uses sub-services)
  registrar.singletonFactory(
    diagnosticsTokens.IAxisGapAnalyzer,
    (c) =>
      new AxisGapAnalyzer({
        prototypeProfileCalculator: c.resolve(
          diagnosticsTokens.IPrototypeProfileCalculator
        ),
        pcaAnalysisService: c.resolve(diagnosticsTokens.IPCAAnalysisService),
        hubPrototypeDetector: c.resolve(
          diagnosticsTokens.IHubPrototypeDetector
        ),
        coverageGapDetector: c.resolve(diagnosticsTokens.ICoverageGapDetector),
        multiAxisConflictDetector: c.resolve(
          diagnosticsTokens.IMultiAxisConflictDetector
        ),
        reportSynthesizer: c.resolve(diagnosticsTokens.IAxisGapReportSynthesizer),
        config: PROTOTYPE_OVERLAP_CONFIG,
        logger: c.resolve(tokens.ILogger),
      })
  );

  // GateASTNormalizer: canonical AST representation for gates
  registrar.singletonFactory(
    diagnosticsTokens.IGateASTNormalizer,
    (c) =>
      new GateASTNormalizer({
        logger: c.resolve(tokens.ILogger),
      })
  );

  // ActionableSuggestionEngine: data-driven threshold suggestions
  registrar.singletonFactory(
    diagnosticsTokens.IActionableSuggestionEngine,
    (c) =>
      new ActionableSuggestionEngine({
        config: {
          minSamplesForStump: PROTOTYPE_OVERLAP_CONFIG.minSamplesForStump,
          minInfoGainForSuggestion:
            PROTOTYPE_OVERLAP_CONFIG.minInfoGainForSuggestion,
          divergenceThreshold: PROTOTYPE_OVERLAP_CONFIG.divergenceThreshold,
          maxSuggestionsPerPair: PROTOTYPE_OVERLAP_CONFIG.maxSuggestionsPerPair,
          minOverlapReductionForSuggestion:
            PROTOTYPE_OVERLAP_CONFIG.minOverlapReductionForSuggestion,
          minActivationRateAfterSuggestion:
            PROTOTYPE_OVERLAP_CONFIG.minActivationRateAfterSuggestion,
        },
        logger: c.resolve(tokens.ILogger),
        contextAxisNormalizer: c.resolve(
          diagnosticsTokens.IContextAxisNormalizer
        ),
      })
  );
}

export default registerPrototypeOverlapServices;
