# Axis Gap Detection Feature Specification

**Version**: 1.0
**Date**: 2026-01-23
**Status**: Proposed
**Related Research**: `research/detecting-axis-gaps-research.md`

---

## 1. Overview

### 1.1 Problem Statement

The prototype analysis system currently focuses on identifying redundant, overlapping, or subsumable prototypes within the existing mood axis space. However, it lacks the capability to detect when the **axis space itself is inadequate**—when prototypes are "overfitting" combinations of existing axes to express concepts that deserve their own dimension.

### 1.2 Solution Summary

Add an `AxisGapAnalyzer` service that detects axis space inadequacy through four complementary detection approaches:

1. **PCA Analysis** - Detect latent dimensions via eigenvalue analysis
2. **Hub Prototype Detection** - Find prototypes with many moderate overlaps
3. **Coverage Gap Detection** - Identify clusters distant from any existing axis
4. **Multi-Axis Conflict Detection** - Flag prototypes using many axes with conflicting signs

The feature integrates as a post-Stage C analysis pass in the V3 pipeline, producing actionable recommendations for axis augmentation.

### 1.3 Success Criteria

- Correctly identifies known historical case: confusion, perplexity, doubt, curiosity should be flagged as related prototypes requiring a shared "uncertainty" dimension
- No false positives for well-differentiated prototypes in current axis space
- Performance impact < 15% on overall V3 pipeline execution time
- All detection methods have > 80% test coverage

---

## 2. Architecture

### 2.1 Integration Point

The V3 pipeline currently operates in 5 stages:
1. **Setup** - Shared context pool generation, vector evaluation
2. **Stage A** - Candidate pair filtering
3. **Stage B** - Behavioral evaluation
4. **Stage C** - Classification
5. **Stage D** - Recommendation building

Axis Gap Detection will be inserted as **Stage C.5** (post-classification, pre-recommendation).

### 2.2 Data Flow

```
Stage C Output                    AxisGapAnalyzer                   Stage D Input
─────────────────────────────────────────────────────────────────────────────────
classifiedResults ────────┐
                          │
outputVectors ────────────┼───▶ AxisGapAnalyzer.analyze() ───▶ AxisGapReport
                          │           │
profiles ─────────────────┤           ├── #runPCAAnalysis()
                          │           ├── #identifyHubPrototypes()
prototypes ───────────────┘           ├── #detectCoverageGaps()
                                      ├── #detectMultiAxisConflicts()
                                      └── #synthesizeReport()
```

### 2.3 New Service: AxisGapAnalyzer

**File**: `src/expressionDiagnostics/services/AxisGapAnalyzer.js`

**Note**: This is a NEW service, distinct from the existing `PrototypeGapAnalyzer.js` which handles coverage gaps within the current axis space (detecting gaps in prototype coverage and synthesizing new prototypes). `AxisGapAnalyzer` detects when the axis space itself needs new dimensions.

---

## 3. Detailed Design

### 3.1 AxisGapAnalyzer Service

#### 3.1.1 Constructor

```javascript
/**
 * @param {Object} deps
 * @param {Object} deps.prototypeProfileCalculator - For clustering access
 * @param {Object} deps.config - PROTOTYPE_OVERLAP_CONFIG with axis gap thresholds
 * @param {Object} deps.logger - ILogger instance
 */
constructor({ prototypeProfileCalculator, config, logger })
```

#### 3.1.2 Public Methods

```javascript
/**
 * Analyze all prototypes for axis gap indicators.
 *
 * @param {Array<Object>} prototypes - All prototypes with weights
 * @param {Map<string, Object>} outputVectors - Pre-computed vectors from V3 setup
 * @param {Map<string, Object>} profiles - Pre-computed profiles from V3 setup
 * @param {Array<Object>} pairResults - Classification results from Stage C
 * @param {Function} [onProgress] - Progress callback
 * @returns {AxisGapReport} Analysis report
 */
analyze(prototypes, outputVectors, profiles, pairResults, onProgress)
```

#### 3.1.3 Detection Methods

**PCA Analysis** (`#runPCAAnalysis`)
- Build weight matrix W[prototype, axis]
- Standardize columns to zero mean, unit variance
- Compute eigenvalues of covariance matrix
- Calculate residual variance ratio
- Flag if residual > threshold AND eigenvalue[n+1] > Kaiser threshold

**Hub Detection** (`#identifyHubPrototypes`)
- Build overlap graph from pair results
- Compute hub score: `degree × (1 - variance(edge_weights))`
- Compute neighborhood diversity using clustering
- Flag if degree >= threshold AND diversity >= threshold AND no near-duplicate edges

**Coverage Gap Detection** (`#detectCoverageGaps`)
- Use clustering from PrototypeProfileCalculator
- Compute cosine distance from cluster centroids to axis unit vectors
- Flag clusters with distance >= threshold AND size >= min cluster size

**Multi-Axis Conflict Detection** (`#detectMultiAxisConflicts`)
- Count active axes per prototype (|weight| >= epsilon)
- Compute sign balance: |positive - negative| / total
- Flag if axis count > median + IQR × threshold AND sign balance < threshold

### 3.2 Output Format

```typescript
interface AxisGapReport {
  summary: {
    totalPrototypesAnalyzed: number;
    potentialGapsDetected: number;
    confidence: 'low' | 'medium' | 'high';
  };

  pcaAnalysis: {
    residualVarianceRatio: number;
    additionalSignificantComponents: number;
    topLoadingPrototypes: Array<{
      prototypeId: string;
      loading: number;
    }>;
  };

  hubPrototypes: Array<{
    prototypeId: string;
    hubScore: number;
    overlappingPrototypes: string[];
    neighborhoodDiversity: number;
    suggestedAxisConcept: string;
  }>;

  coverageGaps: Array<{
    clusterId: number;
    centroidPrototypes: string[];
    distanceToNearestAxis: number;
    suggestedAxisDirection: Record<string, number>;
  }>;

  multiAxisConflicts: Array<{
    prototypeId: string;
    activeAxisCount: number;
    signBalance: number;
    positiveAxes: string[];
    negativeAxes: string[];
  }>;

  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    type: 'NEW_AXIS' | 'INVESTIGATE' | 'REFINE_EXISTING';
    description: string;
    affectedPrototypes: string[];
    evidence: string[];
  }>;
}
```

### 3.3 Configuration Properties

Add to `src/expressionDiagnostics/config/prototypeOverlapConfig.js`:

```javascript
// === Axis Gap Detection Configuration ===

/** Enable axis gap detection in the analysis pipeline */
enableAxisGapDetection: true,

/** PCA Analysis Thresholds */
pcaResidualVarianceThreshold: 0.15,  // Flag if >15% unexplained variance
pcaKaiserThreshold: 1.0,              // Eigenvalue threshold for significance

/** Hub Prototype Detection */
hubMinDegree: 4,                      // Minimum overlap connections
hubMaxEdgeWeight: 0.9,                // Maximum edge weight (exclude near-duplicates)
hubMinNeighborhoodDiversity: 2,       // Minimum distinct clusters in neighborhood

/** Coverage Gap Detection */
coverageGapAxisDistanceThreshold: 0.6,  // Min distance from any axis
coverageGapMinClusterSize: 3,           // Min prototypes in cluster

/** Multi-Axis Conflict Detection */
multiAxisUsageThreshold: 1.5,         // IQR multiplier for "many axes"
multiAxisSignBalanceThreshold: 0.4,   // Max sign balance for "conflicting"
```

### 3.4 DI Registration

**Token**: `IAxisGapAnalyzer` (already exists in `tokens-diagnostics.js` at line 48)

**Registration** in `prototypeOverlapRegistrations.js`:

```javascript
import AxisGapAnalyzer from '../../expressionDiagnostics/services/AxisGapAnalyzer.js';

registrar.singletonFactory(
  diagnosticsTokens.IAxisGapAnalyzer,
  (c) =>
    new AxisGapAnalyzer({
      prototypeProfileCalculator: c.resolve(
        diagnosticsTokens.IPrototypeProfileCalculator
      ),
      config: PROTOTYPE_OVERLAP_CONFIG,
      logger: c.resolve(tokens.ILogger),
    })
);
```

### 3.5 Pipeline Integration

Modify `PrototypeOverlapAnalyzer.js`:

1. Add optional `axisGapAnalyzer` dependency to constructor
2. After Stage C classification loop, add Stage C.5:
   ```javascript
   if (this.#config.enableAxisGapDetection && this.#axisGapAnalyzer && isV3Mode) {
     onProgress?.('analyzing_axis_gaps', { phase: 'start' });
     axisGapAnalysis = this.#axisGapAnalyzer.analyze(
       prototypes, outputVectors, profiles, classifiedResults, onProgress
     );
   }
   ```
3. Include `axisGapAnalysis` in return object

---

## 4. UI Integration

### 4.1 HTML Section

Add to `prototype-analysis.html` after results panel:

```html
<section id="axis-gap-panel" class="panel axis-gap-panel" hidden>
  <h2>Axis Space Analysis</h2>

  <div class="pca-summary">
    <h3>Dimensionality Analysis (PCA)</h3>
    <div class="metric-row">
      <span class="metric-label">Residual Variance:</span>
      <span id="residual-variance" class="metric-value">--</span>
    </div>
    <div class="metric-row">
      <span class="metric-label">Additional Components Suggested:</span>
      <span id="additional-components" class="metric-value">--</span>
    </div>
    <div id="pca-top-loading" class="top-loading-list"></div>
  </div>

  <div class="hub-prototypes">
    <h3>Hub Prototypes</h3>
    <ul id="hub-list" class="prototype-list"></ul>
  </div>

  <div class="coverage-gaps">
    <h3>Coverage Gaps</h3>
    <ul id="coverage-gap-list" class="gap-list"></ul>
  </div>

  <div class="axis-recommendations">
    <h3>Axis Recommendations</h3>
    <ul id="axis-recommendations-list" class="recommendations-list"></ul>
  </div>
</section>
```

### 4.2 CSS Styles

Add to `css/prototype-analysis.css`:

```css
.axis-gap-panel {
  margin-top: 1rem;
  border-left: 4px solid var(--accent-secondary, #8b5cf6);
}

.recommendation-priority.high { background: var(--error-bg); color: var(--error); }
.recommendation-priority.medium { background: var(--warning-bg); color: var(--warning); }
.recommendation-priority.low { background: var(--info-bg); color: var(--info); }

.metric-value.warning { color: var(--warning); }
.metric-value.alert { color: var(--error); }
```

### 4.3 Controller Updates

Modify `PrototypeAnalysisController.js`:

1. Add DOM element references for axis gap panel
2. Add `#renderAxisGapAnalysis(axisGapAnalysis)` method
3. Call render method from `#renderResults()` when `axisGapAnalysis` present
4. Add progress handler case for `'analyzing_axis_gaps'`

---

## 5. Testing Requirements

### 5.1 Unit Tests

**File**: `tests/unit/expressionDiagnostics/services/axisGapAnalyzer.test.js`

| Test Suite | Test Cases | Coverage Target |
|------------|------------|-----------------|
| PCA Analysis | High residual variance detection, top loading prototypes identification, edge cases (single prototype, zero weights) | 90% |
| Hub Detection | Many moderate overlaps flagging, near-duplicate exclusion, neighborhood diversity calculation | 90% |
| Coverage Gap Detection | Clusters distant from axes, aligned cluster non-flagging | 85% |
| Multi-Axis Conflict | Balanced sign detection, single dominant axis non-flagging | 85% |
| Report Synthesis | Recommendation generation, priority sorting, confidence level calculation | 80% |

**Test Pattern to Follow**:

```javascript
describe('AxisGapAnalyzer', () => {
  let analyzer;
  let mockLogger;
  let mockProfileCalculator;
  let mockConfig;

  beforeEach(() => {
    mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
    mockProfileCalculator = { /* mock methods */ };
    mockConfig = { /* test config values */ };
    analyzer = new AxisGapAnalyzer({
      logger: mockLogger,
      prototypeProfileCalculator: mockProfileCalculator,
      config: mockConfig,
    });
  });

  describe('PCA Analysis', () => {
    it('should detect high residual variance when axis is missing', () => {
      // Arrange: Create prototypes clustering on latent dimension
      const prototypes = createPrototypesWithLatentDimension();

      // Act
      const result = analyzer.analyze(prototypes, outputVectors, profiles, []);

      // Assert
      expect(result.pcaAnalysis.residualVarianceRatio).toBeGreaterThan(0.15);
      expect(result.pcaAnalysis.additionalSignificantComponents).toBeGreaterThanOrEqual(1);
    });

    it('should identify prototypes loading on missing dimension', () => {
      const prototypes = createConfusionLikePrototypes();
      const result = analyzer.analyze(prototypes, outputVectors, profiles, []);

      expect(result.pcaAnalysis.topLoadingPrototypes).toContainEqual(
        expect.objectContaining({ prototypeId: 'confusion' })
      );
    });

    it('should handle single prototype gracefully', () => { /* ... */ });
    it('should handle all-zero weights gracefully', () => { /* ... */ });
  });

  describe('Hub Detection', () => {
    it('should flag prototypes with many moderate overlaps', () => { /* ... */ });
    it('should not flag prototypes with single high overlap', () => { /* ... */ });
    it('should compute neighborhood diversity correctly', () => { /* ... */ });
  });

  // Additional test suites...
});
```

### 5.2 Integration Tests

**File**: `tests/integration/expressionDiagnostics/axisGapDetection.integration.test.js`

| Test Case | Description | Validation |
|-----------|-------------|------------|
| Historical validation | Pre-uncertainty prototypes should flag confusion cluster | Recommendations include NEW_AXIS for confusion, perplexity, doubt |
| No false positives | Well-differentiated current prototypes | Residual variance < 0.15 |
| Pipeline integration | Full V3 pipeline with axis gap detection | axisGapAnalysis present in results |
| Progress reporting | All phases report progress correctly | onProgress called with correct stages |

**Test Pattern to Follow**:

```javascript
describe('Axis Gap Detection Integration', () => {
  let dom;
  let container;
  let analyzer;

  beforeAll(async () => {
    dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
      url: 'http://localhost',
      pretendToBeVisual: true,
    });
    global.window = dom.window;
    global.document = dom.window.document;

    const bootstrapper = new CommonBootstrapper();
    const result = await bootstrapper.bootstrap({
      containerConfigType: 'minimal',
      worldName: 'default',
      skipModLoading: true,
      postInitHook: async (services, c) => {
        registerExpressionServices(c);
        registerExpressionDiagnosticsServices(c);
        analyzer = c.resolve(diagnosticsTokens.IPrototypeOverlapAnalyzer);
      },
    });
    container = result.container;
  });

  afterAll(async () => {
    dom.window.close();
  });

  it('should detect missing uncertainty axis in pre-uncertainty prototypes', async () => {
    // Setup: Register historical prototypes without uncertainty axis
    const dataRegistry = container.resolve(tokens.IDataRegistry);
    dataRegistry.store('lookups', 'core:emotion_prototypes', createHistoricalPrototypes());

    const result = await analyzer.analyze({
      prototypeFamily: 'emotion',
      sampleCount: 4000,
    });

    expect(result.axisGapAnalysis).toBeDefined();
    expect(result.axisGapAnalysis.recommendations).toContainEqual(
      expect.objectContaining({
        type: 'NEW_AXIS',
        affectedPrototypes: expect.arrayContaining(['confusion', 'perplexity', 'doubt']),
      })
    );
  });

  it('should not flag false positives for well-differentiated prototypes', async () => {
    // Use current well-tuned prototypes
    const result = await analyzer.analyze({ prototypeFamily: 'emotion' });

    expect(result.axisGapAnalysis.pcaAnalysis.residualVarianceRatio).toBeLessThan(0.15);
  });
});
```

### 5.3 Performance Tests

**File**: `tests/performance/expressionDiagnostics/axisGapAnalysisPerformance.performance.test.js`

| Test Case | Constraint | Measurement |
|-----------|------------|-------------|
| PCA analysis | < 100ms for 100 prototypes | Execution time |
| Hub detection | < 200ms for 5000 pairs | Execution time |
| Full pipeline impact | < 15% increase over baseline | Percentage change |

### 5.4 Tests to Update

When implementing axis gap detection, the following existing tests may require updates:

| File | Reason |
|------|--------|
| `tests/unit/expressionDiagnostics/services/prototypeOverlapAnalyzer.test.js` | New `axisGapAnalyzer` dependency, new return field |
| `tests/unit/expressionDiagnostics/config/prototypeOverlapConfig.test.js` | New config properties |
| `tests/unit/dependencyInjection/registrations/prototypeOverlapRegistrations.test.js` | New service registration |
| `tests/unit/domUI/prototype-analysis/prototypeAnalysisController.test.js` | New DOM elements, new render methods |
| `tests/integration/expressionDiagnostics/prototypeOverlap/prototypeOverlapAnalyzer.integration.test.js` | New result field, V3 mode changes |

---

## 6. Implementation Phases

### Phase 1: Core Service (Days 1-3)

**Tasks:**
1. Create `AxisGapAnalyzer.js` with constructor and DI validation
2. Implement `#runPCAAnalysis()` method
3. Implement `#identifyHubPrototypes()` method
4. Implement basic `analyze()` orchestration
5. Add config properties to `prototypeOverlapConfig.js`
6. Add registration to `prototypeOverlapRegistrations.js`
7. Create unit tests for PCA and hub detection

**Deliverables:**
- `src/expressionDiagnostics/services/AxisGapAnalyzer.js`
- Updated `src/expressionDiagnostics/config/prototypeOverlapConfig.js`
- Updated `src/dependencyInjection/registrations/prototypeOverlapRegistrations.js`
- `tests/unit/expressionDiagnostics/services/axisGapAnalyzer.test.js` (partial)

### Phase 2: Extended Detection (Days 4-5)

**Tasks:**
1. Implement `#detectCoverageGaps()` method
2. Implement `#detectMultiAxisConflicts()` method
3. Implement `#synthesizeReport()` for recommendations
4. Complete unit tests for all detection methods

**Deliverables:**
- Complete `AxisGapAnalyzer.js` implementation
- Complete `axisGapAnalyzer.test.js`

### Phase 3: Pipeline Integration (Days 6-7)

**Tasks:**
1. Modify `PrototypeOverlapAnalyzer.js` to add `axisGapAnalyzer` dependency
2. Add Stage C.5 execution with progress reporting
3. Update DI registration with new dependency
4. Create integration tests
5. Update existing tests affected by changes

**Deliverables:**
- Updated `src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js`
- Updated registration with injection
- `tests/integration/expressionDiagnostics/axisGapDetection.integration.test.js`
- Updated existing test files

### Phase 4: UI Integration (Day 8)

**Tasks:**
1. Add HTML section to `prototype-analysis.html`
2. Add CSS styles to `prototype-analysis.css`
3. Modify `PrototypeAnalysisController.js` with new render methods
4. Manual UI testing

**Deliverables:**
- Updated `prototype-analysis.html`
- Updated `css/prototype-analysis.css`
- Updated `src/domUI/prototype-analysis/PrototypeAnalysisController.js`

### Phase 5: Validation and Polish (Day 9)

**Tasks:**
1. Run full test suite (`npm run test:ci`)
2. Performance testing
3. Test against known case (confusion → uncertainty)
4. Tune thresholds based on results
5. Code review and documentation

**Deliverables:**
- `tests/performance/expressionDiagnostics/axisGapAnalysisPerformance.performance.test.js`
- Tuned configuration values
- Final code review approval

---

## 7. Files to Modify/Create

### New Files

| File | Description |
|------|-------------|
| `src/expressionDiagnostics/services/AxisGapAnalyzer.js` | Core service implementation |
| `tests/unit/expressionDiagnostics/services/axisGapAnalyzer.test.js` | Unit tests |
| `tests/integration/expressionDiagnostics/axisGapDetection.integration.test.js` | Integration tests |
| `tests/performance/expressionDiagnostics/axisGapAnalysisPerformance.performance.test.js` | Performance tests |

### Modified Files

| File | Changes |
|------|---------|
| `src/expressionDiagnostics/config/prototypeOverlapConfig.js` | Add axis gap detection thresholds |
| `src/dependencyInjection/registrations/prototypeOverlapRegistrations.js` | Register AxisGapAnalyzer |
| `src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js` | Add Stage C.5, new dependency |
| `prototype-analysis.html` | Add axis gap analysis section |
| `css/prototype-analysis.css` | Add axis gap panel styles |
| `src/domUI/prototype-analysis/PrototypeAnalysisController.js` | Add render methods |

### Tests to Update

| File | Reason |
|------|--------|
| `tests/unit/expressionDiagnostics/services/prototypeOverlapAnalyzer.test.js` | New dependency, new return field |
| `tests/unit/expressionDiagnostics/config/prototypeOverlapConfig.test.js` | New config properties |
| `tests/unit/dependencyInjection/registrations/prototypeOverlapRegistrations.test.js` | New registration |
| `tests/unit/domUI/prototype-analysis/prototypeAnalysisController.test.js` | New DOM elements |
| `tests/integration/expressionDiagnostics/prototypeOverlap/prototypeOverlapAnalyzer.integration.test.js` | New result field |

---

## 8. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| PCA computation slow for large sets | Medium | Medium | Implement sampling or incremental approach |
| False positives for central emotions | Medium | High | Add exclusion list for known "hub-like" prototypes (e.g., neutral) |
| Config threshold tuning required | High | Low | Provide sensible defaults, document tuning process |
| Breaking changes to existing tests | Medium | Medium | Phase tests carefully, maintain backward compatibility |

---

## 9. Acceptance Criteria

1. **Functional**
   - [ ] PCA analysis correctly detects >15% residual variance for synthetic test cases
   - [ ] Hub detection flags prototypes with 4+ moderate overlaps across 2+ clusters
   - [ ] Coverage gap detection identifies clusters distant from all axes
   - [ ] Multi-axis conflict detection flags prototypes with balanced positive/negative weights
   - [ ] Recommendations are generated with appropriate priority levels

2. **Validation**
   - [ ] Historical confusion case is correctly identified as needing new axis
   - [ ] Current well-tuned prototypes do not generate false positives
   - [ ] All recommendations include affected prototypes and evidence

3. **Performance**
   - [ ] Full analysis completes in < 2 seconds for typical prototype sets
   - [ ] Pipeline overhead < 15% increase over baseline

4. **Testing**
   - [ ] Unit test coverage > 80% for AxisGapAnalyzer
   - [ ] Integration tests pass for all detection scenarios
   - [ ] All existing tests continue to pass

5. **UI**
   - [ ] Axis gap panel displays when analysis produces results
   - [ ] Recommendations are sorted by priority
   - [ ] Progress indicator shows axis gap analysis phase

---

## 10. References

- Research Document: `research/detecting-axis-gaps-research.md`
- Existing Gap Analyzer: `src/expressionDiagnostics/services/PrototypeGapAnalyzer.js`
- V3 Pipeline: `src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js`
- Configuration: `src/expressionDiagnostics/config/prototypeOverlapConfig.js`
- DI Tokens: `src/dependencyInjection/tokens/tokens-diagnostics.js`
