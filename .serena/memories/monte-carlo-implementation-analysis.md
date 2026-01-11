# Monte Carlo Implementation Analysis - Living Narrative Engine

## Overview
The Monte Carlo implementation in the expression diagnostics system provides statistical trigger probability estimation and detailed failure analysis for expressions. It's a layered architecture with clear separation of concerns.

## 1. Component Architecture

### MonteCarloSimulator (src/expressionDiagnostics/services/MonteCarloSimulator.js)
**Purpose**: Runs statistical simulations to estimate expression trigger rates

**Key Responsibilities**:
- Samples random mood/sexual state combinations (10,000 samples by default)
- Evaluates expressions against each sample
- Tracks per-clause failures for diagnosis
- Supports two sampling modes:
  - `static`: Independent sampling (default) - tests logical feasibility without transition assumptions
  - `dynamic`/`coupled`: Coupled Gaussian sampling - tests fixed transition models for temporal expressions

**Data Output (SimulationResult)**:
- `triggerRate`: Probability of triggering [0, 1]
- `triggerCount`: Number of successful triggers
- `sampleCount`: Total samples evaluated
- `confidenceInterval`: {low, high} for 95% confidence
- `clauseFailures`: Array of per-clause failure data
- `distribution`: 'uniform' or 'gaussian'
- `unseededVarWarnings`: Path validation issues found
- `storedContexts`: Sample witness states (optional, for sensitivity analysis)
- `witnessAnalysis`: Ground-truth witnesses and nearest miss data

**Advanced Metrics in ClauseResult**:
```javascript
{
  clauseDescription: string,
  failureRate: number,
  averageViolation: number,
  violationP50: number|null,        // Median violation
  violationP90: number|null,        // 90th percentile
  nearMissRate: number|null,        // Proportion within epsilon
  nearMissEpsilon: number|null,     // Epsilon threshold used
  hierarchicalBreakdown: object|null, // Tree for compound clauses
  lastMileFailRate: number|null,    // Fail rate when others pass
  isSingleClause: boolean,
}
```

### FailureExplainer (src/expressionDiagnostics/services/FailureExplainer.js)
**Purpose**: Transforms raw statistical data into human-readable failure explanations

**Key Responsibilities**:
- Analyzes clause failures and generates explanations
- Calculates blocker priority scores using weighted heuristics
- Performs advanced metrics analysis:
  - **Percentile Analysis**: Detects heavy-tailed distributions and outliers
  - **Near-Miss Analysis**: Evaluates tunability of thresholds
  - **Ceiling Analysis**: Detects unreachable thresholds
  - **Last-Mile Analysis**: Identifies decisive blockers using relative ranking
- Generates actionable recommendations

**Data Output (BlockerAnalysis)**:
```javascript
{
  clauseDescription: string,
  failureRate: number,
  averageViolation: number,
  explanation: {summary, detail, severity, suggestions},
  rank: number,
  severity: 'critical'|'high'|'medium'|'low',
  advancedAnalysis: {
    percentileAnalysis,
    nearMissAnalysis,
    ceilingAnalysis,
    lastMileAnalysis,      // NEW: Relative ranking approach
    recommendation
  },
  priorityScore: number,
  hasHierarchy: boolean,
  hierarchicalBreakdown: object|null,
  worstOffenders: Array
}
```

**Priority Scoring Formula**:
- Last-mile rate: 40% (most important)
- Failure rate: 30%
- Near-miss tunability: 20%
- Ceiling penalty: -50% if unreachable

### MonteCarloReportGenerator (src/expressionDiagnostics/services/MonteCarloReportGenerator.js)
**Purpose**: Generates comprehensive markdown reports from simulation results

**Key Responsibilities**:
- Transforms raw statistics into readable markdown
- Organizes report into sections:
  1. Header (metadata, sampling mode, sample size)
  2. Executive Summary (rarity classification, key insights)
  3. Witness Section (ground-truth triggering states, nearest miss)
  4. Blocker Analysis (detailed table with advanced metrics)
  5. Global Sensitivity Analysis (tunable conditions across expression)
  6. Per-Condition Sensitivity (threshold curves)
  7. Static Cross-Reference (gate conflicts, unreachable thresholds)
  8. Legend (interpretation guide)
- Optionally includes PrototypeConstraintAnalyzer results for prototype math

**Data Flow**:
```
simulationResult + blockers + summary 
  → extractAxisConstraints() 
  → generateSections() 
  → markdown string
```

### MonteCarloReportModal (src/domUI/expression-diagnostics/MonteCarloReportModal.js)
**Purpose**: Displays and manages the report modal UI

**Key Responsibilities**:
- Extends BaseModalRenderer for standard modal behaviors
- Displays markdown report in formatted text area
- Provides copy-to-clipboard functionality
- Manages focus and lifecycle (show/hide events)

**DOM Elements**:
- `#mc-report-modal`: Modal container
- `#mc-report-close-btn`: Close button
- `#mc-report-content`: Report text area
- `#mc-report-copy-btn`: Copy button
- `#mc-report-status`: Status message area

### ExpressionDiagnosticsController (src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js)
**Purpose**: Orchestrates the entire diagnostics workflow

**Key Responsibilities**:
1. Manages UI state and event binding
2. Runs static analysis (gates, bounds)
3. Runs Monte Carlo simulations
4. Coordinates failure analysis
5. Displays results progressively
6. Generates and displays reports

**Data Flow in #runMonteCarloSimulation()**:
```
1. Get config from UI (#sampleCountSelect, #distributionSelect)
2. Call monteCarloSimulator.simulate(expression, config)
3. Store raw result (#rawSimulationResult) with storedContexts
4. Analyze blockers: failureExplainer.analyzeHierarchicalBlockers()
5. Generate summary: failureExplainer.generateSummary()
6. Store in DiagnosticResult model
7. Display results: #displayMonteCarloResults()
8. Update status and persist
```

**Report Generation in #handleGenerateReport()**:
```
1. Extract expression name and summary
2. Compute sensitivity data from storedContexts
3. Compute global sensitivity data
4. Collect static analysis for cross-reference
5. Call reportGenerator.generate() with all data
6. Show modal with generated markdown
```

## 2. Data Flow Patterns

### Main Simulation to Display Pipeline
```
ExpressionDiagnosticsController
  └─ #runMonteCarloSimulation()
      ├─ monteCarloSimulator.simulate()
      │   └─ Returns: SimulationResult
      │       ├─ triggerRate, confidenceInterval
      │       ├─ clauseFailures[]
      │       ├─ storedContexts[] (for sensitivity)
      │       └─ witnessAnalysis (ground-truth samples)
      │
      ├─ failureExplainer.analyzeHierarchicalBlockers()
      │   └─ Returns: BlockerAnalysis[]
      │       ├─ Sorted by priorityScore
      │       ├─ Include advanced metrics
      │       └─ Hierarchical breakdown for compound clauses
      │
      ├─ failureExplainer.generateSummary()
      │   └─ Returns: human-readable string
      │
      └─ #displayMonteCarloResults()
          ├─ Update rarity indicator
          ├─ Display trigger rate & CI
          ├─ Render blockers table
          └─ Display witnesses

### Report Generation Pipeline
```
#handleGenerateReport()
  ├─ Compute sensitivity data from storedContexts
  ├─ Compute global sensitivity
  ├─ Collect static analysis data
  │
  └─ reportGenerator.generate()
      ├─ generateHeader() - Sampling mode, metadata
      ├─ generateExecutiveSummary() - Rarity, key insights
      ├─ generateWitnessSection() - Ground-truth samples
      ├─ generateBlockerAnalysis() - Detailed analysis table
      ├─ generateGlobalSensitivitySection() - Top tunable conditions
      ├─ generateSensitivityAnalysis() - Per-condition curves
      ├─ generateStaticCrossReference() - Gate conflicts, unreachable
      └─ generateLegend() - Interpretation guide
          │
          └─ reportModal.showReport(markdown)
```

## 3. Temporal Scope Handling

### WitnessState Class (src/expressionDiagnostics/models/WitnessState.js)

**Non-Temporal States** (Basic expressions):
```javascript
{
  mood: {valence, arousal, agency_control, ...},
  sexual: {sex_excitation, sex_inhibition, baseline_libido},
  affectTraits: {affective_empathy, cognitive_empathy, harm_aversion}
}
```

**Temporal States** (Expressions comparing current vs previous):
```javascript
{
  current: {mood, sexual},
  previous: {mood, sexual},
  affectTraits: {...}
}
```

### Temporal Sampling in MonteCarloSimulator

**Bug History**: MonteCarloSimulator was setting previous states to zero, making temporal expressions mathematically impossible to trigger (e.g., lingering_guilt).

**Current Fix** (createRandomPair):
```javascript
// Generate correlated previous/current state pairs:
1. Random previous state: previousMood/previousSexual sampled uniformly
2. Gaussian delta: currentState = previousState + N(0, σ)
   - MOOD_DELTA_SIGMA ≈ 10
   - SEXUAL_DELTA_SIGMA ≈ 8-10
   - LIBIDO_DELTA_SIGMA ≈ 5
3. Derived emotions calculated from actual previous axes
```

**Sampling Modes**:
- `static` (default): Independent sampling - tests logical feasibility
- `dynamic`: Coupled Gaussian delta - tests fixed transition model

### Witness JSON Serialization
```javascript
// Non-temporal serialization (flat structure):
{
  mood: {...},
  sexual: {...},
  affectTraits: {...}
}

// Temporal serialization (nested structure):
{
  current: {mood: {...}, sexual: {...}},
  previous: {mood: {...}, sexual: {...}},
  affectTraits: {...}
}
```

Deserialization auto-detects and handles both formats.

## 4. Constraint Identification

### Three-Level Constraint Analysis

#### 1. Gate Constraints (GateConstraintAnalyzer)
Identifies gate conditions that restrict the searchable space:
```javascript
// Example: "emotions.joy >= 0.7" gate
// Restricts: valence must be in certain range
// Impact: May make downstream thresholds unreachable
```

#### 2. Prototype Constraints (PrototypeConstraintAnalyzer)
Analyzes prototype weights against axis constraints:

**Data Structure**:
```javascript
{
  prototypeId: 'anger',
  threshold: 0.75,
  maxAchievable: 0.68,
  isReachable: false,
  gap: 0.07,
  bindingAxes: [...],  // Axes that limit intensity
  explanation: "Threshold unreachable given constraints"
}
```

**Binding Axis Analysis**:
- Identifies which axes limit achievable intensity
- Marks conflicts: positive_weight_low_max, negative_weight_high_min
- Calculates contribution of each axis to raw sum

#### 3. Advanced Metrics Constraints (FailureExplainer)

**Ceiling Analysis**:
- Detects when maxObserved < threshold (unreachable)
- Reports gap and suggests redesign

**Last-Mile Analysis** (NEW - relative ranking):
- Compares against sibling last-mile failure rates
- Thresholds:
  - `NEAR_TOP_THRESHOLD`: 0.8 (80% of max is top)
  - `SIGNIFICANT_IMPACT_MIN`: 0.05 (5% absolute minimum)
  - `LOW_PRIORITY_THRESHOLD`: 0.5 (50% of max)
- Outputs: decisive_blocker, lower_priority, moderate, rarely_decisive

### Constraint Extraction for Reports
```javascript
reportGenerator.#extractAxisConstraints(prerequisites)
  ├─ Parses expression prerequisites
  └─ Returns Map<axisName, {min, max}>
      (Used by prototype analyzer for deep insight)
```

## 5. Main Output vs Report Modal

### Main Diagnostics Display (inline in page)
Shows in `#mcResults` section:
- Rarity indicator (green/yellow/red circle)
- Trigger rate percentage
- Confidence interval (low-high)
- Summary text from FailureExplainer
- Blockers table:
  - Rank, description, failure rate, severity
  - Inline hierarchical breakdown (collapsible)
  - Worst offenders extracted from tree
- Ground-truth witnesses (sampled states that triggered)
- MC captures witnesses from storedContexts

**Key Difference**: Main display shows **summary view** - top blockers only, key metrics, visualization-friendly

### Report Modal (separate window)
Shows comprehensive markdown:
- Sampling metadata and methodology
- Executive summary with all thresholds
- Complete witness list with JSON
- Exhaustive blocker analysis:
  - Full advanced metrics for each blocker
  - Hierarchical tree visualization
  - Prototype constraint analysis (if available)
- Sensitivity analysis grid tables
- Static analysis cross-reference
- Interpretation legend

**Key Difference**: Report shows **complete analysis** - detailed insights, numerical tables, publication-ready format

### Data Reuse Between Views
```javascript
// Both use same blockers array, same summary
#displayMonteCarloResults(result, blockers, summary)
  // Display main UI

#handleGenerateReport()
  // Use same #currentBlockers, #mcSummary
  // Plus enhanced data: sensitivity, static analysis
```

## 6. Advanced Features

### Hierarchical Clause Breakdown
For compound AND/OR blocks:
```javascript
hierarchicalBreakdown: {
  isCompound: true,
  nodeType: 'and'|'or',
  children: [
    {nodeType: 'leaf', description: '...', failureRate: ...},
    {nodeType: 'leaf', ...}
  ],
  failureRate: ...,
  lastMileFailRate: ...,
  ...
}
```

Rendered as tree in main UI, detailed breakdown in report.

### Sensitivity Analysis
**Per-Condition Sensitivity** (in report):
- Threshold curve: how trigger rate changes as threshold varies
- Uses storedContexts to build grid
- Shows tunability and ceiling effects

**Global Sensitivity** (in report):
- Ranks all conditions by last-mile impact
- Shows which tweaks help most

### Ground-Truth Witnesses
Captured during simulation:
```javascript
{
  states: [...],           // First N states that triggered
  nearest_miss: {...},     // Sample with fewest failing clauses
  othersPassedCount: number
}
```

Useful for understanding what actually makes expressions trigger.

## 7. Integration Points

### Dependencies
- `IDataRegistry`: Emotion/sexual prototype lookups
- `ILogger`: All components
- `IExpressionRegistry`: Expression lookup
- `IGateConstraintAnalyzer`: Static gate analysis
- `IIntensityBoundsCalculator`: Bounds calculation
- `IExpressionStatusService`: Status persistence
- `IPathSensitiveAnalyzer`: Reachability analysis

### Event Flow
```
UI Click: #runMcBtn
  → #runMonteCarloSimulation()
  → Monte Carlo + Analysis
  → DiagnosticResult updated
  → Status persisted
  → UI displayed
  → User clicks #generateReportBtn
  → #handleGenerateReport()
  → Report modal shown
```

## 8. Key Design Patterns

### Separation of Concerns
- **Simulator**: Pure stats (no domain logic)
- **FailureExplainer**: Analysis logic (no rendering)
- **ReportGenerator**: Formatting (no simulation)
- **ReportModal**: UI rendering (no generation)
- **Controller**: Orchestration (coordinates all)

### Immutability
- WitnessState is immutable (creates new instances)
- ClauseResult is read-only
- Blockers are generated fresh each time

### Lazy Initialization
- Reports generated on-demand
- Sensitivity analysis computed when report requested
- Static analysis cached in DiagnosticResult

### Caching
- `#currentResult`: DiagnosticResult model
- `#currentBlockers`: Blocker analysis
- `#rawSimulationResult`: Raw stats with storedContexts
- `#mcSummary`: Summary text

## 9. Testing Entry Points

Key test files:
- `tests/unit/expressionDiagnostics/services/monteCarloSimulator.test.js`
- `tests/unit/expressionDiagnostics/services/monteCarloSimulator.temporalState.test.js`
- `tests/unit/expressionDiagnostics/services/failureExplainer.test.js`
- `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js`
- `tests/integration/expression-diagnostics/monteCarloReport.integration.test.js`
