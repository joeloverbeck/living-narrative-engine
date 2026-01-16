# Monte Carlo Module Dependency Graph

## Module Structure Overview

```
src/expressionDiagnostics/services/
├── MonteCarloSimulator.js     ─── 1,362 lines (Orchestration Facade)
├── SensitivityAnalyzer.js     ─── 271 lines   (Separate Service)
└── simulatorCore/             ─── 2,645 lines (6 Modules)
    ├── ContextBuilder.js      ─── 388 lines
    ├── ExpressionEvaluator.js ─── 852 lines
    ├── GateEvaluator.js       ─── 546 lines
    ├── PrototypeEvaluator.js  ─── 356 lines
    ├── ViolationEstimator.js  ─── 252 lines
    └── VariablePathValidator.js ─ 251 lines

Total: 4,278 lines across 8 files
```

## Dependency Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MonteCarloSimulator                                 │
│                        (Orchestration Facade)                                │
│                           1,362 lines                                        │
│                                                                              │
│  Public API:                                                                 │
│    • async simulate(expression, config)                                      │
│    • computeThresholdSensitivity(expression, clauseTarget, config)          │
│    • computeExpressionSensitivity(expression, config)                       │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   │ Injects 6 modules
                                   │
        ┌────────────┬─────────────┼─────────────┬─────────────┬──────────────┐
        │            │             │             │             │              │
        ▼            ▼             ▼             ▼             ▼              ▼
┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
│ Context   │ │Expression │ │   Gate    │ │ Prototype │ │ Violation │ │ Variable  │
│ Builder   │ │ Evaluator │ │ Evaluator │ │ Evaluator │ │ Estimator │ │   Path    │
│           │ │           │ │           │ │           │ │           │ │ Validator │
│ 388 lines │ │ 852 lines │ │ 546 lines │ │ 356 lines │ │ 252 lines │ │ 251 lines │
└─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘
      │             │             │             │             │             │
      │             │             │             │             │             │
      └─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘
                                        │
                                        ▼
                              ┌─────────────────┐
                              │    ILogger      │
                              │  (all modules)  │
                              └─────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                         SensitivityAnalyzer                                  │
│                         (Separate Service)                                   │
│                            271 lines                                         │
│                                                                              │
│  NOTE: NOT injected into MonteCarloSimulator                                │
│  Registered independently in DI container                                   │
│                                                                              │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼
                              ┌─────────────────┐
                              │    ILogger      │
                              └─────────────────┘
```

## Detailed Injection Hierarchy

```
MonteCarloSimulator (1,362 lines)
│
├─► logger: ILogger
├─► dataRegistry: IDataRegistry
├─► emotionCalculatorAdapter: IEmotionCalculatorAdapter
├─► randomStateGenerator: IRandomStateGenerator
│
├─► contextBuilder: ContextBuilder (388 lines)
│   ├─► logger: ILogger
│   ├─► dataRegistry: IDataRegistry
│   └─► randomStateGenerator: IRandomStateGenerator
│
├─► expressionEvaluator: ExpressionEvaluator (852 lines)
│   ├─► logger: ILogger
│   └─► jsonLogicEvaluator: IJsonLogicEvaluator
│
├─► gateEvaluator: GateEvaluator (546 lines)
│   └─► logger: ILogger
│
├─► prototypeEvaluator: PrototypeEvaluator (356 lines)
│   ├─► logger: ILogger
│   └─► dataRegistry: IDataRegistry
│
├─► violationEstimator: ViolationEstimator (252 lines)
│   └─► logger: ILogger
│
└─► variablePathValidator: VariablePathValidator (251 lines)
    └─► logger: ILogger


SensitivityAnalyzer (271 lines) [SEPARATE SERVICE]
└─► logger: ILogger
```

## Cross-Module Dependencies

The modules within `simulatorCore/` do not depend on each other directly. All coordination happens through the facade:

```
                MonteCarloSimulator
                       │
      ┌────────────────┼────────────────┐
      │                │                │
      ▼                ▼                ▼
ContextBuilder   GateEvaluator    ExpressionEvaluator
      │                │                │
      │                │                │
      └────────────────┼────────────────┘
                       │
                       │ (No cross-dependencies)
                       │
      ┌────────────────┼────────────────┐
      │                │                │
      ▼                ▼                ▼
PrototypeEvaluator  ViolationEstimator  VariablePathValidator
```

## No Circular Dependencies

**Verification**: All dependencies flow downward from the facade to the modules. No module depends on `MonteCarloSimulator` or on any sibling module.

```bash
# Verify with madge (if available)
npx madge --circular src/expressionDiagnostics/services/
# Expected output: "No circular dependency found!"
```

## DI Registration Order

In `expressionDiagnosticsRegistrations.js`:

1. **Core modules first** (no inter-module dependencies):
   - ContextBuilder
   - ExpressionEvaluator
   - GateEvaluator
   - PrototypeEvaluator
   - ViolationEstimator
   - VariablePathValidator

2. **Facade second** (depends on all core modules):
   - MonteCarloSimulator

3. **Separate services** (independent):
   - SensitivityAnalyzer

## Module Communication Flow

During simulation execution:

```
1. MonteCarloSimulator.simulate() called
   │
   ├──► ContextBuilder.buildContext()
   │    └──► Returns: random context object
   │
   ├──► ExpressionEvaluator.evaluateWithTracking()
   │    └──► Returns: evaluation results with tracking
   │
   ├──► GateEvaluator.checkGates()
   │    └──► Returns: gate pass/fail status
   │
   ├──► PrototypeEvaluator.evaluatePrototypeSample()
   │    └──► Returns: prototype evaluation stats
   │
   ├──► ViolationEstimator.estimateViolation() [on failure]
   │    └──► Returns: violation estimates
   │
   └──► VariablePathValidator.validateExpressionVarPaths()
        └──► Returns: path validation results
```

## Key Architectural Properties

| Property | Status | Notes |
|----------|--------|-------|
| Single Responsibility | ✅ | Each module has one focused job |
| No Circular Dependencies | ✅ | Clean downward dependency flow |
| DI-based Construction | ✅ | All dependencies injected |
| Testable in Isolation | ✅ | Modules can be unit tested separately |
| Facade Pattern | ✅ | MonteCarloSimulator orchestrates modules |
| Extension Points | ✅ | New modules can be added without changing existing ones |
