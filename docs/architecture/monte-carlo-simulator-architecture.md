# Monte Carlo Simulator Architecture

## Overview

The Monte Carlo Simulator subsystem provides probability estimation for JSON Logic expressions by running statistical simulations across random mood/emotion/sexual state configurations. It is a core component of the expression diagnostics system used to analyze and validate game expressions.

## Module Structure

The system follows a **Facade + Module** pattern with clear separation of concerns:

```
src/expressionDiagnostics/services/
├── MonteCarloSimulator.js              # Orchestration facade (1,362 lines)
├── SensitivityAnalyzer.js              # Separate service (271 lines)
└── simulatorCore/                       # Core modules (6 files, 2,645 lines)
    ├── ContextBuilder.js               # Random context generation (388 lines)
    ├── ExpressionEvaluator.js          # JSON Logic evaluation (852 lines)
    ├── GateEvaluator.js                # Gate constraint checking (546 lines)
    ├── PrototypeEvaluator.js           # Prototype evaluation (356 lines)
    ├── ViolationEstimator.js           # Failure diagnosis (252 lines)
    └── VariablePathValidator.js        # Path validation (251 lines)
```

**Total**: 4,278 lines across 8 files

## Architecture Decisions

### Why This Structure

1. **MonteCarloSimulator as Facade (1,362 lines)**
   - Orchestrates the simulation loop and result assembly
   - Contains essential logic that coordinates module interactions
   - The original 3,607-line God Class was split, but ~1,100-1,400 lines of orchestration logic must remain in the facade
   - Per MONCARSIMARCREF-013: ~150-200 lines was unrealistic; current size is appropriate

2. **SensitivityAnalyzer as Separate Service (271 lines)**
   - Provides threshold and expression sensitivity analysis
   - NOT injected into MonteCarloSimulator
   - Can be used independently for sensitivity calculations
   - Registered separately in DI container

3. **simulatorCore Modules (6 modules, 2,645 lines total)**
   - Each module has a single responsibility
   - All injected into MonteCarloSimulator via DI
   - Can be unit tested in isolation
   - Enable parallel development

## Public API

The MonteCarloSimulator exposes exactly **3 public methods**:

### `async simulate(expression, config)`

Runs Monte Carlo simulation and returns probability estimates.

**Parameters**:
- `expression` - JSON Logic expression to evaluate
- `config` - Simulation configuration (samples, seed, etc.)

**Returns**: Simulation results with probability, confidence intervals, histograms

### `computeThresholdSensitivity(expression, clauseTarget, config)`

Analyzes how probability changes as a threshold varies.

**Parameters**:
- `expression` - JSON Logic expression
- `clauseTarget` - Target clause for threshold analysis
- `config` - Sensitivity configuration

**Returns**: Sensitivity curve data points

### `computeExpressionSensitivity(expression, config)`

Analyzes sensitivity to all variables in expression.

**Parameters**:
- `expression` - JSON Logic expression
- `config` - Sensitivity configuration

**Returns**: Per-variable sensitivity metrics

## Module Responsibilities

| Module | Responsibility | Key Methods |
|--------|----------------|-------------|
| **MonteCarloSimulator** | Orchestration, simulation loop, result assembly | `simulate`, `computeThresholdSensitivity`, `computeExpressionSensitivity` |
| **ContextBuilder** | Random state generation, normalization, histogram tracking | `buildContext`, `buildKnownContextKeys`, `initializeHistograms` |
| **ExpressionEvaluator** | JSON Logic evaluation with clause tracking | `evaluateWithTracking`, `buildHierarchicalTree`, `finalizeClauseResults` |
| **GateEvaluator** | Gate constraint evaluation and compatibility checking | `checkGates`, `buildGateClampRegimePlan`, `computeGateCompatibility` |
| **PrototypeEvaluator** | Emotion/sexual prototype evaluation and stats | `evaluatePrototypeSample`, `preparePrototypeEvaluationTargets` |
| **ViolationEstimator** | Failure diagnosis and violation estimation | `estimateViolation`, `collectFailedLeaves`, `getFailedLeavesSummary` |
| **VariablePathValidator** | Path validation and coverage resolution | `validateExpressionVarPaths`, `collectSamplingCoverageVariables` |
| **SensitivityAnalyzer** | Threshold and expression sensitivity analysis | `analyzeThresholdSensitivity`, `analyzeExpressionSensitivity` |

## Dependency Injection

All modules are registered in `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js`.

### Tokens (tokens-diagnostics.js)

```javascript
// simulatorCore modules
ContextBuilder: 'ContextBuilder',
ExpressionEvaluator: 'ExpressionEvaluator',
GateEvaluator: 'GateEvaluator',
PrototypeEvaluator: 'PrototypeEvaluator',
ViolationEstimator: 'ViolationEstimator',
VariablePathValidator: 'VariablePathValidator',

// Main facade
MonteCarloSimulator: 'MonteCarloSimulator',

// Separate service
SensitivityAnalyzer: 'SensitivityAnalyzer',
```

### Injection Hierarchy

```
MonteCarloSimulator
├── logger: ILogger
├── dataRegistry: IDataRegistry
├── emotionCalculatorAdapter: IEmotionCalculatorAdapter
├── randomStateGenerator: IRandomStateGenerator
├── contextBuilder: ContextBuilder
│     └── logger, dataRegistry, randomStateGenerator
├── expressionEvaluator: ExpressionEvaluator
│     └── logger, jsonLogicEvaluator
├── gateEvaluator: GateEvaluator
│     └── logger
├── prototypeEvaluator: PrototypeEvaluator
│     └── logger, dataRegistry
├── violationEstimator: ViolationEstimator
│     └── logger
└── variablePathValidator: VariablePathValidator
      └── logger

SensitivityAnalyzer (separate)
└── logger: ILogger
```

## Extension Points

### Adding New Analysis Types

1. Create new module in `simulatorCore/` with single responsibility
2. Define DI token in `tokens-diagnostics.js`
3. Register factory in `expressionDiagnosticsRegistrations.js`
4. Inject into MonteCarloSimulator constructor
5. Call from appropriate public method

### Extending Evaluation Logic

Modify the specific evaluator module:
- Expression evaluation: `ExpressionEvaluator.js`
- Gate constraints: `GateEvaluator.js`
- Prototypes: `PrototypeEvaluator.js`

### Adding New Context Sources

Extend `ContextBuilder.js`:
- Add new state generation methods
- Update `buildContext()` to include new sources
- Ensure histogram tracking is updated

## Testing Strategy

### Integration Tests (11 files)

Located in `tests/integration/expression-diagnostics/`:

| Test File | Focus Area |
|-----------|------------|
| `monteCarloContextBuilding.integration.test.js` | Context structure and normalization |
| `monteCarloExpressionEvaluation.integration.test.js` | Evaluation results and tracking |
| `monteCarloGateEvaluation.integration.test.js` | Gate constraint behavior |
| `monteCarloPrototypeEvaluation.integration.test.js` | Prototype stats and evaluation |
| `monteCarloViolationAnalysis.integration.test.js` | Violation estimates and failures |
| `monteCarloReport.integration.test.js` | End-to-end report generation |
| `monteCarloReportSnapshot.integration.test.js` | Report snapshot consistency |
| `monteCarloReportRecommendations.integration.test.js` | Recommendation generation |
| `monteCarloReportWorker.integration.test.js` | Web Worker integration |
| `monteCarloStoredTrace.integration.test.js` | Stored trace integrity |
| `monteCarloNewAxis.integration.test.js` | New axis handling |

### Unit Tests

Located in `tests/unit/expressionDiagnostics/`:

- **Facade tests**: `services/monteCarloSimulator*.test.js` (15+ files)
- **Module tests**: `services/simulatorCore/*.test.js`

### Coverage Targets

| Component | Branch | Line |
|-----------|--------|------|
| MonteCarloSimulator | ≥76% | ≥85% |
| simulatorCore modules | ≥85% | ≥90% |
| SensitivityAnalyzer | ≥90% | ≥95% |

## Performance Characteristics

- **Simulation samples**: Configurable (default: 1,000-10,000)
- **Async yielding**: Yields to event loop every 100ms
- **Memory efficiency**: Streaming histogram updates
- **No circular dependencies**: Clean dependency graph

## Refactoring History

This architecture resulted from the **MONCARSIMARCREF** refactoring initiative (14 tickets):

| Phase | Tickets | Focus |
|-------|---------|-------|
| Phase 1 | 001-005 | Integration test creation |
| Phase 2 | 006-012 | Module extraction |
| Phase 3 | 013-014 | Facade cleanup and documentation |

**Before**: 3,607-line God Class with 80+ methods
**After**: 4,278 lines across 8 focused modules

## Related Documentation

- **Refactoring Report**: `reports/monte-carlo-simulator-architecture-refactoring.md`
- **Module Diagram**: `docs/architecture/diagrams/monte-carlo-module-graph.md`
- **Expression Diagnostics**: `docs/expression-diagnostics/`
