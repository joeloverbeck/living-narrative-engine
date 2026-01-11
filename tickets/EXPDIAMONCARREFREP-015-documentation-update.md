# EXPDIAMONCARREFREP-015: Documentation Update and Cleanup

## Summary
Update architecture documentation to reflect the refactored expression diagnostics structure. Document the new service hierarchy, gate parsing consolidation, and emotion calculation delegation patterns.

## Files to Create

| File | Action | Description |
|------|--------|-------------|
| `docs/architecture/expression-diagnostics-services.md` | Create | New architecture documentation for expression diagnostics |

## Files to Modify

| File | Action | Changes |
|------|--------|---------|
| `docs/modding/expression-registry.md` | Modify | Update architecture section if it references old structure |

## Out of Scope

- **DO NOT** modify any source code
- **DO NOT** modify any test files
- **DO NOT** create API documentation (focus on architecture)
- **DO NOT** document implementation details (focus on patterns)

## Acceptance Criteria

### Documentation That Must Be Added

#### Service Architecture Overview
1. Document: Service hierarchy diagram (Controller → Orchestrators → Services)
2. Document: Dependency injection tokens for expression diagnostics
3. Document: Service responsibility descriptions

#### Gate Parsing Consolidation
1. Document: `GateConstraint.parse()` as single source of truth
2. Document: Services that use gate parsing (list all consumers)
3. Document: Gate syntax format and examples

#### Emotion Calculation Delegation
1. Document: `EmotionCalculatorAdapter` purpose and interface
2. Document: Flow from `MonteCarloSimulator` through adapter to `EmotionCalculatorService`
3. Document: Why delegation was chosen over direct coupling

#### Sampling Logic Consolidation
1. Document: `RandomStateGenerator` service and its responsibility
2. Document: Shared constants in `WitnessState`
3. Document: Sigma values and their meaning

#### Controller Split
1. Document: `SensitivityAnalyzer` service responsibility
2. Document: `ReportOrchestrator` service responsibility
3. Document: What remains in controller (UI concerns only)

### Invariants That Must Remain True
1. Documentation follows existing project doc conventions
2. Markdown is valid and renders correctly
3. No code examples that reference non-existent methods
4. Documentation matches actual implementation

## Implementation Notes

### Architecture Document Template
```markdown
# Expression Diagnostics Service Architecture

## Overview

The expression diagnostics module provides Monte Carlo simulation and analysis
for expression triggering behavior. After refactoring, the architecture follows
a layered service pattern:

```
┌─────────────────────────────────────────────────────┐
│            ExpressionDiagnosticsController          │
│                    (UI Layer)                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────┐  ┌──────────────────────────┐ │
│  │ReportOrchestrator│  │  SensitivityAnalyzer   │ │
│  │   (Workflow)    │  │    (Analysis)           │ │
│  └────────┬────────┘  └───────────┬─────────────┘ │
│           │                       │               │
├───────────┴───────────────────────┴───────────────┤
│                                                     │
│  ┌──────────────────┐  ┌───────────────────────┐  │
│  │MonteCarloSimulator│  │MonteCarloReportGen   │  │
│  │  (Simulation)    │  │   (Report Gen)        │  │
│  └────────┬─────────┘  └───────────────────────┘  │
│           │                                        │
├───────────┴────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────┐  ┌───────────────────────┐  │
│  │EmotionCalcAdapter │  │RandomStateGenerator  │  │
│  │   (Adapter)      │  │   (Sampling)          │  │
│  └────────┬─────────┘  └───────────────────────┘  │
│           │                                        │
├───────────┴────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────┐  ┌───────────────────────┐  │
│  │EmotionCalcService │  │   GateConstraint     │  │
│  │  (Core Emotion)  │  │   (Gate Parsing)      │  │
│  └──────────────────┘  └───────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## DI Tokens

| Token | Service | Responsibility |
|-------|---------|---------------|
| `IMonteCarloSimulator` | MonteCarloSimulator | Monte Carlo simulation |
| `IMonteCarloReportGenerator` | MonteCarloReportGenerator | Report markdown generation |
| `ISensitivityAnalyzer` | SensitivityAnalyzer | Sensitivity computation |
| `IReportOrchestrator` | ReportOrchestrator | Report workflow coordination |
| `IEmotionCalculatorAdapter` | EmotionCalculatorAdapter | Emotion service adapter |
| `IRandomStateGenerator` | RandomStateGenerator | Random state sampling |

## Gate Parsing

### Single Source of Truth

All gate parsing uses `GateConstraint.parse()`:

```javascript
import { GateConstraint } from '../models/GateConstraint.js';

const parsed = GateConstraint.parse('joy >= 0.5');
// Returns: { axis: 'joy', operator: '>=', value: 0.5 }
```

### Gate Syntax

Gates follow the pattern: `<axis> <operator> <value>`

- **Axis**: Any valid axis name (e.g., `joy`, `sex_excitation`, `valence`)
- **Operator**: One of `>=`, `<=`, `>`, `<`, `==`
- **Value**: Number (integer or decimal, can be negative)

### Consumers

Services that use gate parsing:
- `MonteCarloSimulator` - Gate checking during simulation
- `PrototypeConstraintAnalyzer` - Constraint analysis
- `PrototypeFitRankingService` - Prototype scoring
- `EmotionCalculatorService` - Runtime emotion calculation

## Emotion Calculation Delegation

The `MonteCarloSimulator` delegates emotion calculations to avoid duplicating
core emotion logic:

```
MonteCarloSimulator
       │
       ▼
EmotionCalculatorAdapter (normalizes [-100,100] → [-1,1])
       │
       ▼
EmotionCalculatorService (source of truth for emotion calculation)
```

### Why Delegation?

1. **Single Source of Truth**: Emotion calculation logic exists in one place
2. **Behavior Consistency**: Simulation matches runtime behavior exactly
3. **Maintainability**: Changes to emotion logic automatically apply to simulation
4. **Testability**: Each layer can be tested independently

## Sampling Constants

Gaussian sampling uses these standard deviations (defined in `WitnessState.js`):

| Constant | Value | Purpose |
|----------|-------|---------|
| `MOOD_DELTA_SIGMA` | 15 | Mood axis random walk step size |
| `SEXUAL_DELTA_SIGMA` | 12 | Sexual state random walk step size |
| `LIBIDO_DELTA_SIGMA` | 8 | Baseline libido random walk step size |

These constants are shared between `RandomStateGenerator` and `WitnessState`.

## Controller Responsibilities

After refactoring, the controller only handles:

- UI event binding and handling
- DOM manipulation and rendering
- Coordinating UI updates
- Delegating analysis to services

All computation, analysis, and orchestration logic is in services.
```

## Verification Commands
```bash
# Verify markdown renders correctly
npx markdownlint docs/architecture/expression-diagnostics-services.md

# Check for broken internal links (if tooling available)
npm run docs:validate
```

## Dependencies
- **Depends on**: All other tickets (documentation reflects final implementation)
- **Blocks**: None (final ticket in sequence)
