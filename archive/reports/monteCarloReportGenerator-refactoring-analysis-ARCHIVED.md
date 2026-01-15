# MonteCarloReportGenerator.js Architectural Analysis & Refactoring Plan

**Date**: 2026-01-15
**Module**: `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`
**Status**: Analysis Complete - Ready for Prioritized Refactoring

---

## Executive Summary

`MonteCarloReportGenerator.js` is a **6,394-line module** that violates the project's 500-line limit by **12.8x**. The file contains **140+ private methods** organized into clear functional categories. Despite its size, the module has **extensive test coverage** (14 unit test files + 5 integration test files totaling ~8,000 lines of tests).

This analysis identifies **8 extractable modules** that can be safely refactored in a prioritized order, reducing the main file to ~400 lines while maintaining 100% backwards compatibility.

---

## Current State Analysis

### Module Statistics

| Metric | Value |
|--------|-------|
| **File Size** | 214 KB |
| **Lines of Code** | 6,394 |
| **Private Methods** | 140+ |
| **Public Methods** | 2 (`generate()`, `collectReportIntegrityWarnings()`) |
| **Private Fields** | 4 |
| **Direct Dependencies** | 12 modules |
| **Unit Test Files** | 14 (~217 KB) |
| **Integration Test Files** | 5 (~88 KB) |

### Method Category Distribution

The 140+ private methods fall into these functional groups:

| Category | Pattern | Count | Example Methods |
|----------|---------|-------|-----------------|
| **Section Generators** | `#generate*Section`, `#generate*` | ~40 | `#generateHeader`, `#generateBlockerAnalysis`, `#generatePrototypeFitSection` |
| **Formatting Utilities** | `#format*` | ~30 | `#formatPercentage`, `#formatPopulationHeader`, `#formatRecommendationCard` |
| **Data Analysis** | `#compute*`, `#calculate*` | ~12 | `#computeDistributionStats`, `#calculateWilsonInterval` |
| **Data Extraction** | `#extract*`, `#resolve*` | ~20 | `#extractAxisConstraints`, `#resolvePopulationSummary` |
| **Validation/Integrity** | `#collect*Warnings`, `#check*` | ~15 | `#collectReportIntegrityWarnings`, `#checkMcConfirmation` |
| **Building/Assembly** | `#build*` | ~15 | `#buildStoredContextPopulations`, `#buildSweepWarningContext` |
| **Helpers/Utilities** | various | ~15 | `#contextMatchesConstraints`, `#isAndOnlyBlockers` |

### Direct Dependencies (12 Modules)

```
src/expressionDiagnostics/
├── config/advancedMetricsConfig.js (284 lines) - getTunableVariableInfo()
├── models/GateConstraint.js - Constraint representation
├── services/RecommendationFactsBuilder.js (1,181 lines) - Recommendation facts
├── services/RecommendationEngine.js (1,600 lines) - Recommendation generation
├── services/samplingCoverageConclusions.js (380 lines) - Coverage analysis
└── utils/
    ├── moodRegimeUtils.js (181 lines) - Mood constraint handling
    ├── axisNormalizationUtils.js (170 lines) - Axis normalization
    ├── intensitySignalUtils.js (110 lines) - Signal computation
    ├── populationHashUtils.js (41 lines) - Population hashing
    ├── reportIntegrityUtils.js (32 lines) - Report validation
    └── sweepIntegrityUtils.js (113 lines) - Sweep monotonicity

src/utils/
└── dependencyUtils.js - validateDependency()
```

### Injected Dependencies (DI Pattern)

```javascript
constructor({
  logger,                        // Required - ILogger interface
  prototypeConstraintAnalyzer,   // Optional - axis constraint extraction
  prototypeFitRankingService,    // Optional - prototype fit analysis
  prototypeSynthesisService,     // Optional - prototype synthesis
})
```

---

## Test Coverage Analysis

### Unit Tests (14 Files, ~4,500 Lines)

| Test File | Lines | Coverage Area | Safety Level |
|-----------|-------|---------------|--------------|
| `monteCarloReportGenerator.test.js` | 4,333 | Core functionality | HIGH |
| `.prototypeFit.test.js` | 432 | Prototype analysis | HIGH |
| `.populationLabels.test.js` | 277 | Population formatting | HIGH |
| `.warnings.test.js` | 249 | Integrity warnings | HIGH |
| `.gateNormalization.test.js` | 230 | Gate processing | MEDIUM |
| `.clampTrivial.test.js` | 152 | Clamp logic | HIGH |
| `.probabilityFunnel.test.js` | 146 | Funnel generation | HIGH |
| `.recommendations.test.js` | 134 | Recommendations | HIGH |
| `.signals.test.js` | 127 | Signal processing | HIGH |
| `.labels.test.js` | 116 | Label formatting | HIGH |
| `.orOverlap.test.js` | 117 | OR logic | HIGH |
| `.orUnion.test.js` | 100 | OR union calculations | HIGH |
| `.populationMeta.test.js` | 73 | Population metadata | MEDIUM |
| `.constraintUnits.test.js` | 64 | Constraint units | MEDIUM |

### Integration Tests (5 Files, ~2,000 Lines)

| Test File | Lines | Coverage Area |
|-----------|-------|---------------|
| `monteCarloReport.integration.test.js` | 703 | DI resolution, report generation, modal display |
| `monteCarloReportRecommendations.integration.test.js` | 768 | Recommendation rendering, gate-clamp regime |
| `monteCarloStoredTrace.integration.test.js` | 100 | Gate traces with runtime normalization |
| `monteCarloNewAxis.integration.test.js` | 335 | Mood axes, affect traits, normalization |
| `monteCarloStoredContextIntegrity.test.js` | ~100 | Context integrity with gate traces |

### Coverage Gaps Identified

**Well Covered ✅:**
- Report section generation (all major sections)
- Formatting utilities (labels, percentages, population headers)
- Warning collection and integrity analysis
- OR/AND tree traversal logic
- Prototype fit analysis
- Recommendation generation

**Gaps Requiring Tests Before Refactoring ⚠️:**
- Error scenarios (malformed data handling)
- Edge cases in gate normalization
- Performance with large sample sets (>100k samples)
- Worker thread integration (only basic tests exist)

---

## Architectural Characteristics

### Strengths

✅ **Pure Data Transformation** - No UI dependencies, no event bus usage
✅ **Comprehensive Test Coverage** - 14 unit test files + 5 integration tests
✅ **Clear Method Naming** - Consistent patterns (`#generate*`, `#format*`, `#compute*`)
✅ **Dependency Injection** - Proper DI pattern with validated dependencies
✅ **Worker Thread Support** - Can run off main thread via `MonteCarloReportWorker.js`

### Problems

❌ **Massive File Size** - 6,394 lines (12.8x over 500-line limit)
❌ **God Object Anti-Pattern** - Too many responsibilities in one class
❌ **High Cognitive Load** - 140+ methods difficult to navigate
❌ **Testing Friction** - Large test file (4,333 lines) mirrors large source
❌ **Hidden Dependencies** - Internal services created inline (RecommendationEngine)

---

## Refactoring Plan: 8 Extractable Modules

### Phase 1: ReportFormattingService (LOWEST RISK)

**Target Size**: ~200 lines
**Test Coverage**: HIGH (labels.test.js, populationLabels.test.js)
**Dependencies**: None (pure functions)

**Methods to Extract**:
```
#formatPercentage(value, decimals)
#formatNumber(value)
#formatCount(value)
#formatFailRate(rate, count)
#formatRateWithCounts(rate, count, total)
#formatThresholdValue(value, isInteger)
#formatEffectiveThreshold(threshold, operator)
#formatSignedNumber(value)
#formatSignedPercentagePoints(delta)
#formatPopulationHeader(population)
#formatStoredContextPopulationLabel(summary, population)
#formatPopulationEvidenceLabel(population)
#formatEvidenceCount(count, label)
#formatEvidenceValue(value, label)
#formatOrMoodConstraintWarning()
#formatSweepWarningsInline(warnings)
#formatFunnelClauseLabel(leaf)
#formatClampTrivialLabel(inRegimeValue, globalValue)
#formatTuningDirection(direction)
#formatBooleanValue(value)
```

**Rationale**: Pure functions with zero state dependencies. No access to `#logger` or private fields. Well-tested through existing label tests.

**Integration Tests Required**: None - unit tests sufficient for pure functions.

---

### Phase 2: WitnessFormatter (LOW RISK)

**Target Size**: ~150 lines
**Test Coverage**: HIGH (main test.js - witness sections)
**Dependencies**: ReportFormattingService

**Methods to Extract**:
```
#formatWitness(witness, index)
#formatMoodState(mood, label)
#formatSexualState(sexual, label)
#formatAffectTraits(traits)
#formatComputedEmotions(emotions, label)
#formatBindingAxes(bindingAxes)
```

**Rationale**: Cohesive group formatting witness/context state data. Clear domain boundary.

**Integration Tests Required**: None - covered by existing witness section tests.

---

### Phase 3: StatisticalComputationService (LOW RISK)

**Target Size**: ~250 lines
**Test Coverage**: HIGH (main test.js - distribution tests)
**Dependencies**: None (pure statistical functions)

**Methods to Extract**:
```
#computeDistributionStats(values)
#computeAxisContributions(contexts, weights)
#calculateWilsonInterval(successes, total, z)
#computeGateFailureRates(gates, storedContexts)
#computeGatePassRate(gates, storedContexts)
#computePrototypeRegimeStats(contexts, varPath, gates, weights)
#computeConditionalPassRates(filteredContexts, emotionConditions)
#aggregateLeafViolationStats(leaves)
```

**Rationale**: Mathematical functions with clear inputs/outputs. Reusable across report generators.

**Integration Tests Required**: None - pure statistical computations.

---

### Phase 4: ReportDataExtractor (MEDIUM RISK)

**Target Size**: ~200 lines
**Test Coverage**: HIGH (signals.test.js, constraints.test.js)
**Dependencies**: None

**Methods to Extract**:
```
#extractAxisConstraints(prerequisites)
#extractBaselineTriggerRate(globalSensitivityData)
#extractEmotionConditions(blocker)
#extractEmotionConditionsFromPrereqs(prerequisites)
#extractEmotionConditionsFromLogic(logic, conditions)
#extractWorstCeilingFromLeaves(hb)
#getNestedValue(obj, path)
#getPrototypeContextPath(type, prototypeId)
#getPrototypeWeights(type, prototypeId)
#getGateTraceSignals(context, type, prototypeId)
#getLowestCoverageVariables(samplingCoverage, n)
```

**Rationale**: Data extraction is a distinct concern. Methods share common purpose.

**Integration Tests Required**: Create `reportDataExtractor.integration.test.js` to verify extraction from real simulation data.

---

### Phase 5: BlockerTreeTraversal (MEDIUM RISK)

**Target Size**: ~200 lines
**Test Coverage**: HIGH (orOverlap.test.js, orUnion.test.js)
**Dependencies**: StatisticalComputationService

**Methods to Extract**:
```
#flattenLeaves(node, leaves)
#collectOrBlocks(blockers)
#collectFunnelLeaves({ blockers, clauseFailures })
#buildStructuredTree(node)
#calculateOrPassRate(orNode)
#calculateOrInRegimeFailureRate(orNode)
#resolveOrUnionCount(orNode)
#resolveOrUnionInRegimeCount(orNode)
#isAndOnlyBlockers(blockers)
#isAndOnlyBreakdown(node)
#isEmotionThresholdLeaf(leaf)
#findDominantSuppressor(orNode)
#findMostTunableLeaf(leaves)
#findWorstLastMileLeaf(leaves)
```

**Rationale**: All methods operate on hierarchical blocker trees. Well-tested through OR-related test files.

**Integration Tests Required**: Existing orOverlap and orUnion tests cover this. May need minor updates for imports.

---

### Phase 6: ReportIntegrityAnalyzer (MEDIUM RISK)

**Target Size**: ~300 lines
**Test Coverage**: HIGH (warnings.test.js)
**Dependencies**: ReportFormattingService, existing utils

**Methods to Extract**:
```
#collectReportIntegrityWarnings(params)
#collectSweepIntegrityWarnings(params)
#buildSweepWarningContext({ blockers, globalSensitivityData })
#buildSweepWarningsForResult(result, context)
#mergeReportIntegrityWarnings(existing, incoming)
#checkMcConfirmation(condition, storedContexts, moodConstraints)
#checkEmotionMcConfirmation(condition, contexts, moodConstraints)
#analyzeEmotionCondition(condition, axisConstraints)
#resolveGateTraceTarget(context, type, prototypeId)
#normalizeContextAxes(context)
#normalizeAxisValue(value, domain)
#contextMatchesConstraints(context, moodConstraints)
```

**Rationale**: Cohesive responsibility for integrity analysis. Dedicated test file exists.

**Integration Tests Required**: Existing warnings.test.js covers most cases. Add integration test for full warning collection flow.

---

### Phase 7: Section Generators (HIGHER RISK)

Split into 4 domain-focused generators:

#### 7a. PrototypeSectionGenerator (~400 lines)

**Methods**:
```
#generatePrototypeFitSection()
#generateImpliedPrototypeSection()
#generateGapDetectionSection()
#generatePrototypeMathSection()
#generatePrototypeRecommendations()
#performPrototypeFitAnalysis()
#formatPrototypeAnalysis()
#formatPrototypeRegimeStats()
#formatPrototypeRegimeRows()
```

**Dependencies**: ReportFormattingService, injected prototype services

**Integration Tests Required**: Existing prototypeFit.test.js covers this. Add `prototypeSectionGenerator.integration.test.js` for full section output.

#### 7b. SensitivitySectionGenerator (~350 lines)

**Methods**:
```
#generateGlobalSensitivitySection()
#generateSensitivityAnalysis()
#formatGlobalSensitivityResult()
#formatSensitivityResult()
#getSensitivityKindMetadata()
#selectKeyThresholdClauses()
```

**Dependencies**: ReportFormattingService, ReportDataExtractor

**Integration Tests Required**: Create `sensitivitySectionGenerator.integration.test.js` with sweep data fixtures.

#### 7c. BlockerSectionGenerator (~450 lines)

**Methods**:
```
#generateBlockerAnalysis()
#generateBlockerSection()
#generateProbabilityFunnel()
#generateLeafBreakdown()
#generateStructuredBreakdown()
#generateConditionGroup()
#generateOrContributionBreakdown()
#generateOrOverlapBreakdown()
#generateWorstOffenderAnalysis()
#generateLeafRow()
#buildFeasibilitySummary()
#buildClauseAnchorId()
```

**Dependencies**: ReportFormattingService, BlockerTreeTraversal, StatisticalComputationService

**Integration Tests Required**: Existing probabilityFunnel.test.js and main tests cover this. Add `blockerSectionGenerator.integration.test.js`.

#### 7d. CoreSectionGenerator (~350 lines)

**Methods**:
```
#generateHeader()
#generatePopulationSummary()
#generateIntegritySummarySection()
#generateSignalLineageSection()
#generateExecutiveSummary()
#generateSamplingCoverageSection()
#generateWitnessSection()
#generateNearestMissSection()
#generateReportIntegrityWarningsSection()
#generateStaticCrossReference()
#generateLegend()
#generateFlags()
#generateDistributionAnalysis()
#generateCeilingAnalysis()
#generateNearMissAnalysis()
#generateLastMileAnalysis()
#generateRecommendation()
#buildStoredContextPopulations()
#resolvePopulationSummary()
#getRarityCategory()
```

**Dependencies**: ReportFormattingService, WitnessFormatter, existing utils

**Integration Tests Required**: Covered by main integration tests. Add `coreSectionGenerator.integration.test.js`.

---

### Phase 8: Final Orchestrator Refactor

**Target Size**: ~400 lines

After all extractions, `MonteCarloReportGenerator.js` becomes a slim orchestrator:

```javascript
class MonteCarloReportGenerator {
  #logger;
  #prototypeConstraintAnalyzer;
  #prototypeFitRankingService;
  #prototypeSynthesisService;

  // Composed services (created internally or injected)
  #formattingService;
  #witnessFormatter;
  #statisticsService;
  #dataExtractor;
  #treeTraversal;
  #integrityAnalyzer;
  #prototypeSectionGenerator;
  #sensitivitySectionGenerator;
  #blockerSectionGenerator;
  #coreSectionGenerator;

  constructor(deps) {
    // Validate and set injected deps
    // Create internal services if not provided
  }

  generate(params) {
    // Orchestrate section generation
    const sections = [
      this.#coreSectionGenerator.generateHeader(...),
      this.#coreSectionGenerator.generatePopulationSummary(...),
      this.#integrityAnalyzer.generateIntegritySummary(...),
      // ... remaining sections
    ];
    return sections.filter(Boolean).join('\n');
  }

  collectReportIntegrityWarnings(params) {
    return this.#integrityAnalyzer.collect(params);
  }
}
```

---

## Extraction Priority Order

| Priority | Module | Lines | Risk | Test Safety | Blocking |
|----------|--------|-------|------|-------------|----------|
| 1 | ReportFormattingService | ~200 | LOWEST | HIGH | None |
| 2 | WitnessFormatter | ~150 | LOW | HIGH | Phase 1 |
| 3 | StatisticalComputationService | ~250 | LOW | HIGH | None |
| 4 | ReportDataExtractor | ~200 | MEDIUM | HIGH | None |
| 5 | BlockerTreeTraversal | ~200 | MEDIUM | HIGH | Phase 3 |
| 6 | ReportIntegrityAnalyzer | ~300 | MEDIUM | HIGH | Phase 1 |
| 7a | PrototypeSectionGenerator | ~400 | HIGHER | HIGH | Phase 1 |
| 7b | SensitivitySectionGenerator | ~350 | HIGHER | MEDIUM | Phase 1, 4 |
| 7c | BlockerSectionGenerator | ~450 | HIGHER | HIGH | Phase 1, 3, 5 |
| 7d | CoreSectionGenerator | ~350 | HIGHER | HIGH | Phase 1, 2 |
| 8 | Orchestrator Refactor | ~400 | LOW | HIGH | All above |

---

## Integration Tests Required Before Each Phase

### Pre-Refactoring Baseline Tests

Before starting any refactoring, create:

1. **Snapshot Test**: `monteCarloReportSnapshot.integration.test.js`
   - Generate reports with known fixtures
   - Snapshot the complete markdown output
   - Verify no output changes during refactoring

2. **Worker Thread Test**: `monteCarloReportWorker.integration.test.js`
   - Test report generation via worker thread
   - Verify factory pattern works correctly

### Per-Phase Integration Tests

| Phase | New Integration Test | Purpose |
|-------|---------------------|---------|
| 4 | `reportDataExtractor.integration.test.js` | Verify extraction from real simulation data |
| 6 | `reportIntegrityAnalyzer.integration.test.js` | Full warning collection flow |
| 7a | `prototypeSectionGenerator.integration.test.js` | Prototype section output |
| 7b | `sensitivitySectionGenerator.integration.test.js` | Sensitivity section with sweep data |
| 7c | `blockerSectionGenerator.integration.test.js` | Blocker analysis section |
| 7d | `coreSectionGenerator.integration.test.js` | Core sections (header, summary, etc.) |

---

## File Structure After Refactoring

```
src/expressionDiagnostics/
├── services/
│   ├── MonteCarloReportGenerator.js        (~400 lines - orchestrator)
│   ├── ReportFormattingService.js          (~200 lines)
│   ├── WitnessFormatter.js                 (~150 lines)
│   ├── StatisticalComputationService.js    (~250 lines)
│   ├── ReportDataExtractor.js              (~200 lines)
│   ├── BlockerTreeTraversal.js             (~200 lines)
│   ├── ReportIntegrityAnalyzer.js          (~300 lines)
│   ├── reportGeneratorFactory.js           (~50 lines - for worker thread)
│   └── sectionGenerators/
│       ├── PrototypeSectionGenerator.js    (~400 lines)
│       ├── SensitivitySectionGenerator.js  (~350 lines)
│       ├── BlockerSectionGenerator.js      (~450 lines)
│       └── CoreSectionGenerator.js         (~350 lines)
│
tests/integration/expression-diagnostics/
├── monteCarloReport.integration.test.js              (existing)
├── monteCarloReportRecommendations.integration.test.js (existing)
├── monteCarloReportSnapshot.integration.test.js      (NEW - baseline)
├── monteCarloReportWorker.integration.test.js        (NEW - worker)
├── reportDataExtractor.integration.test.js           (NEW - Phase 4)
├── reportIntegrityAnalyzer.integration.test.js       (NEW - Phase 6)
├── prototypeSectionGenerator.integration.test.js     (NEW - Phase 7a)
├── sensitivitySectionGenerator.integration.test.js   (NEW - Phase 7b)
├── blockerSectionGenerator.integration.test.js       (NEW - Phase 7c)
└── coreSectionGenerator.integration.test.js          (NEW - Phase 7d)
```

---

## Backwards Compatibility Guarantee

### Public API (MUST remain unchanged)

```javascript
// Method signatures - NO changes allowed
generate({
  expressionName,
  simulationResult,
  blockers,
  summary,
  prerequisites = null,
  sensitivityData = [],
  globalSensitivityData = [],
  staticAnalysis = null,
}) → string

collectReportIntegrityWarnings({
  simulationResult,
  blockers,
  prerequisites = null,
  sensitivityData = [],
  globalSensitivityData = [],
}) → Array<object>
```

### Constructor (Extended, backwards compatible)

```javascript
// Old usage still works:
new MonteCarloReportGenerator({
  logger,
  prototypeConstraintAnalyzer,    // optional
  prototypeFitRankingService,     // optional
  prototypeSynthesisService,      // optional
})

// New usage (optional service injection):
new MonteCarloReportGenerator({
  logger,
  prototypeConstraintAnalyzer,
  prototypeFitRankingService,
  prototypeSynthesisService,
  // Optional - created internally if not provided
  formattingService,
  witnessFormatter,
  statisticsService,
  dataExtractor,
  treeTraversal,
  integrityAnalyzer,
  prototypeSectionGenerator,
  sensitivitySectionGenerator,
  blockerSectionGenerator,
  coreSectionGenerator,
})
```

### Output Format (MUST be identical)

- Report markdown structure unchanged
- Section ordering unchanged
- Formatting patterns unchanged
- Use snapshot testing to verify

---

## Worker Thread Considerations

`MonteCarloReportWorker.js` creates `MonteCarloReportGenerator` directly without DI container:

```javascript
// Current pattern in worker
const reportGenerator = new MonteCarloReportGenerator({
  logger: workerLogger,
  prototypeConstraintAnalyzer,
  prototypeFitRankingService,
});
```

**Solution**: Create factory function:

```javascript
// src/expressionDiagnostics/services/reportGeneratorFactory.js
export function createReportGenerator({
  logger,
  prototypeConstraintAnalyzer = null,
  prototypeFitRankingService = null,
  prototypeSynthesisService = null,
}) {
  const formattingService = new ReportFormattingService();
  const witnessFormatter = new WitnessFormatter({ formattingService });
  const statisticsService = new StatisticalComputationService();
  const dataExtractor = new ReportDataExtractor();
  const treeTraversal = new BlockerTreeTraversal({ statisticsService });
  const integrityAnalyzer = new ReportIntegrityAnalyzer({
    formattingService,
    logger,
  });

  // ... create section generators

  return new MonteCarloReportGenerator({
    logger,
    prototypeConstraintAnalyzer,
    prototypeFitRankingService,
    prototypeSynthesisService,
    formattingService,
    witnessFormatter,
    statisticsService,
    dataExtractor,
    treeTraversal,
    integrityAnalyzer,
    prototypeSectionGenerator,
    sensitivitySectionGenerator,
    blockerSectionGenerator,
    coreSectionGenerator,
  });
}
```

---

## Risk Assessment & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Circular dependencies | LOW | HIGH | Careful dependency ordering; lint rules |
| Test fixture duplication | MEDIUM | LOW | Create shared fixture module |
| Worker thread breakage | MEDIUM | MEDIUM | Factory function pattern; integration tests |
| Performance regression | LOW | MEDIUM | Benchmark before/after each phase |
| Output format changes | LOW | HIGH | Snapshot tests before starting |

### Rollback Strategy

Each phase is a separate PR:
1. Each extraction is self-contained
2. Original test assertions validate behavior
3. Integration tests catch regressions
4. Snapshot tests detect output changes

---

## Recommended Implementation Timeline

| Phase | Estimated Effort | Blocking Tests |
|-------|-----------------|----------------|
| Baseline Tests | 2-3 hours | None |
| Phase 1 (Formatting) | 2-3 hours | Snapshot test |
| Phase 2 (Witness) | 1-2 hours | Phase 1 complete |
| Phase 3 (Statistics) | 2-3 hours | Snapshot test |
| Phase 4 (Extractor) | 2-3 hours | New integration test |
| Phase 5 (Tree) | 2-3 hours | Phase 3 complete |
| Phase 6 (Integrity) | 3-4 hours | New integration test |
| Phase 7a-d (Sections) | 8-12 hours | New integration tests per section |
| Phase 8 (Orchestrator) | 2-3 hours | All above complete |

**Total Estimated Effort**: 25-35 hours

---

## Conclusion

MonteCarloReportGenerator.js is a well-tested but oversized module that can be safely refactored into 11 smaller, focused modules. The refactoring should:

1. **Start with baseline tests** to ensure no output changes
2. **Extract stateless utilities first** (Phases 1-3) for lowest risk
3. **Add integration tests** before extracting data-dependent modules (Phases 4-6)
4. **Extract section generators** with comprehensive integration tests (Phase 7)
5. **Finalize the orchestrator** once all components are extracted (Phase 8)

The extensive existing test coverage (8,000+ lines) provides a strong safety net for this refactoring.
