# Dead Branch Detection Specification

## Overview

Dead Branch Detection identifies OR block alternatives that can structurally never fire within a given population (mood-regime) due to impossibilities. This provides explainability for why certain expression paths never trigger, distinguishing between "rare but possible" and "structurally impossible."

## Problem Statement

When analyzing expression prerequisites with OR blocks, some alternatives may show 0% pass rate. However, this could mean:

1. **UNOBSERVED** - The alternative is possible but wasn't sampled (rare tail)
2. **DEAD_BRANCH** - The alternative is structurally impossible due to regime constraints

Currently, the Monte Carlo diagnostics cannot distinguish these cases. This specification defines a detection algorithm and reporting mechanism to identify and explain dead branches.

---

## Data Models

### Alternative

Represents a single alternative within an OR block.

```typescript
interface Alternative {
  id: string;                        // Stable hash-based ID (order-invariant)
  kind: 'leaf' | 'and_group';        // Type of alternative
  clauseRefs: string[];              // Leaf clause references (sorted)
  passCount: number;                 // Pass count within population
  passRate: number;                  // Pass rate (0-1)
  support: number;                   // N samples evaluated
  status: AlternativeStatus;         // Computed status
  deadEvidence: DeadEvidence[];      // Evidence when DEAD_BRANCH
  limitingConstraints: LimitingConstraint[]; // Constraints causing dead branch
}

type AlternativeStatus = 'ACTIVE' | 'RARE' | 'DEAD_BRANCH' | 'UNOBSERVED';
```

### DeadEvidence

Proof of structural impossibility.

```typescript
interface DeadEvidence {
  type: 'CEILING' | 'FLOOR' | 'CLAMP_IMPOSSIBLE';
  clauseRef: string;        // Reference to the leaf clause
  threshold: number;        // The threshold value from the clause
  observedBound: number;    // maxObserved (CEILING) or minObserved (FLOOR)
  gap: number;              // Numeric gap between threshold and bound
  gatePassRate?: number;    // Gate pass rate (for CLAMP_IMPOSSIBLE)
}
```

### LimitingConstraint

Human-readable explanation of why a branch is dead.

```typescript
interface LimitingConstraint {
  constraintClauseRef: string;  // e.g., "moodAxes.arousal <= 45"
  axis: string;                 // The mood axis name
  prototypeWeight: number;      // Weight from prototype definition
  regimeBound: number;          // Bound value from regime constraint
  bindingType: 'positive_weight_low_max' | 'negative_weight_high_min';
  explanation: string;          // Human-readable one-liner
}
```

### OrBlock

Formalized OR block with alternatives and analysis.

```typescript
interface OrBlock {
  id: string;                       // Stable path/node ID
  population: 'mood-regime' | 'global' | 'stored-mood-regime';
  support: number;                  // N samples evaluated
  alternatives: Alternative[];      // List of alternatives
  effectiveAlternativeCount: number; // Count where status != DEAD_BRANCH
}
```

### DeadBranchFindings

Aggregates all findings across OR blocks.

```typescript
interface DeadBranchFindings {
  orBlocks: OrBlock[];
  totalDeadBranches: number;
  collapsedOrBlocks: number;  // Count where effectiveAlternativeCount == 1
}
```

---

## Detection Algorithm

### DEAD_BRANCH Trigger Condition

For a given OR block alternative in population = mood-regime:

An alternative is **DEAD_BRANCH** if and only if:

1. `passCount == 0` in this population, **AND**
2. There exists at least one **structural impossibility** inside that alternative

This avoids false positives where the region merely wasn't sampled.

### Structural Impossibility Types

#### CEILING (for >= or > operators)

```
maxObserved(population, var) < threshold - ε
```

Example: `emotions.rage >= 0.45` with `maxObserved = 0.26` → CEILING (gap = 0.19)

#### FLOOR (for <= or < operators)

```
minObserved(population, var) > threshold + ε
```

Example: `moodAxes.threat <= 10` with `minObserved = 30` → FLOOR (gap = 20)

#### CLAMP_IMPOSSIBLE (for emotion clauses)

```
gatePassRate == 0 AND threshold > 0
```

When the emotion's gate never passes, final intensity is always clamped to 0, making any positive threshold impossible.

### Epsilon Values

- Normalized floats [0,1]: `ε = 1e-6` (float safety only)
- Integer-effective mood axes: `ε = 0` (already collapsed to integers)

---

## Limiting Constraint Extraction

When marking DEAD_BRANCH, extract explanation of **why** it's dead.

### For Emotion-Driven Dead Branches

1. Identify the dead leaf clause (e.g., `emotions.rage >= 0.45`)
2. Extract from prototype math analysis:
   - `maxFinalInRegime`
   - `threshold`
   - `gap = threshold - maxFinalInRegime`
   - Binding axes (e.g., `arousal` is `positive_weight_low_max`)
3. Map each binding axis to regime constraint:
   - `positive_weight_low_max` on `arousal` → find `moodAxes.arousal <= X`
   - `negative_weight_high_min` on `inhibitory_control` → find `moodAxes.inhibitory_control >= Y`

#### Output Format

```
moodAxes.arousal <= 45 + rage weight +0.95 ⇒ capped arousal prevents rage reaching 0.45 (max=0.26)
```

### For Non-Emotion Clauses

Simpler extraction:
- Identify leaf clause with CEILING/FLOOR
- Show min/max observed, threshold, gap

---

## Report Output

### Alternative Liveness Table

Added to each OR block section:

| Alternative | Pass (mood) | Status | Why |
|-------------|-------------|--------|-----|
| emotions.moral_outrage >= 0.6 | 1.33% (6/452) | 🟡 RARE | gate clamp 89% + threshold tail |
| (emotions.rage >= 0.45 AND moodAxes.affiliation >= 10) | 0.00% (0/452) | ❌ DEAD_BRANCH | rage max=0.26 < 0.45 due to moodAxes.arousal<=45 |

### Expandable Dead Branch Evidence Block

```markdown
#### Dead Branch Evidence: emotions.rage >= 0.45

**Proof**: CEILING - maxObserved < threshold
- maxFinalInRegime = 0.26
- threshold = 0.45
- gap = 0.19

**Limiting Constraints**:
- moodAxes.arousal <= 45 + rage weight +0.95 ⇒ capped arousal prevents rage reaching 0.45 (max=0.26)
- moodAxes.inhibitory_control >= 20 + rage weight -0.75 ⇒ forced min reduces rage contribution
```

### Recommendation Type

```typescript
{
  type: 'dead_branch',
  severity: 'low' | 'high',  // high if OR collapses to single path
  message: 'Alternative "emotions.rage >= 0.45 AND moodAxes.affiliation >= 10" is structurally dead in mood-regime',
  evidence: DeadEvidence[],
  limitingConstraints: LimitingConstraint[],
  suggestedActions: [
    'Remove dead alternative (simplify logic)',
    'Change regime constraints to enable alternative',
    'Swap to a prototype with feasible range for regime',
    'Lower threshold to match observed maximum'
  ]
}
```

### Effective OR Complexity Annotation

When `effectiveAlternativeCount == 1`:

```
> ⚠️ **OR collapses to single path in this regime**
```

---

## Invariants

### Correctness Invariants

1. **Order-invariance**: Reordering OR alternatives must not change detection or explanation. Alternative IDs must be hash-based on sorted clause refs, not array position.

2. **Population correctness**: DEAD_BRANCH is evaluated per population. A branch may be alive globally but dead in mood-regime; that's valid.

3. **No dead without structural proof**: If `passCount == 0` but no CEILING/FLOOR/clamp-impossibility exists → label "UNOBSERVED" (not dead).

4. **No dead if passed once**: If `passCount > 0` → status cannot be DEAD_BRANCH.

5. **Emotion clamp rule**: If `gatePassRate == 0` and clause is `emotions.X >= t` with `t > 0`, it is structurally impossible.

6. **Explainability completeness**: Every DEAD_BRANCH must include:
   - The leaf clause(s) proving impossibility
   - The numeric gap evidence
   - At least one limiting constraint pointer (if emotion-driven with known regime constraints)

### Safety/UX Invariants

1. **No spam**: Only flag dead branches inside OR blocks (not whole-expression), and only when it changes understanding.

2. **Stable wording**: Explanations generated deterministically from evidence fields.

---

## Test Requirements

### Unit Tests

#### 3.1 Rage Path is DEAD_BRANCH in Mood-Regime

**Given**:
- OR block alternative = AND(emotions.rage >= 0.45, moodAxes.affiliation >= 10)
- mood-regime population support N=452
- alternative passCount=0
- prototype math for rage in mood-regime: maxFinal = 0.26
- threshold=0.45

**Expect**:
- alternative status = DEAD_BRANCH
- deadEvidence contains CEILING for emotions.rage >= 0.45 with gap ≈ 0.19
- limitingConstraints includes moodAxes.arousal <= 45 with prototype weight +0.95

#### 3.2 Moral_Outrage Path is NOT Dead (Even if Rare)

**Given**:
- alternative = emotions.moral_outrage >= 0.6
- passCount in mood-regime = 6
- maxFinal in mood-regime = 0.60

**Expect**:
- status != DEAD_BRANCH (likely "RARE" or "ACTIVE")
- no deadEvidence

#### 3.3 passCount=0 but maxObserved >= threshold → UNOBSERVED

**Given**:
- alternative passCount=0
- leaf maxObserved in mood-regime = 0.90
- threshold = 0.85

**Expect**:
- status = "UNOBSERVED"
- deadEvidence empty

This prevents "dead" from becoming "we didn't sample it".

#### 3.4 Clamp-Impossible Emotion Clause Becomes DEAD_BRANCH

**Given**:
- alternative = emotions.X >= 0.3
- gatePassRate in mood-regime = 0
- passCount=0

**Expect**:
- status = DEAD_BRANCH
- deadEvidence includes CLAMP_IMPOSSIBLE with gatePassRate=0

#### 3.5 <= Floor-Impossible Becomes DEAD_BRANCH

**Given**:
- alternative = moodAxes.threat <= 10
- minObserved in mood-regime = 30
- passCount=0

**Expect**:
- DEAD_BRANCH with FLOOR evidence (minObserved > threshold)

#### 3.6 (Integration) Report Rendering Includes Label + Explanation

Snapshot test the rendered markdown contains:
- OR Block section shows alternative marked DEAD_BRANCH
- Explanation includes numeric evidence + constraint pointer(s)

#### 3.7 Order Invariance Test

Same OR block alternatives in different order produce identical DEAD_BRANCH outputs (ids, evidence, constraints), except for display ordering if you sort.

### Test Files to Create

```
tests/unit/expressionDiagnostics/models/Alternative.test.js
tests/unit/expressionDiagnostics/models/OrBlock.test.js
tests/unit/expressionDiagnostics/models/DeadBranchFindings.test.js
tests/unit/expressionDiagnostics/services/AlternativeIdGenerator.test.js
tests/unit/expressionDiagnostics/services/StructuralImpossibilityAnalyzer.test.js
tests/unit/expressionDiagnostics/services/LimitingConstraintExtractor.test.js
tests/unit/expressionDiagnostics/services/DeadBranchDetector.test.js
tests/unit/expressionDiagnostics/services/sectionGenerators/DeadBranchSectionGenerator.test.js
tests/integration/expression-diagnostics/deadBranchReport.integration.test.js
```

---

## Integration Points

### Where This Plugs In

The system already has:
- Tree evaluator with per-node pass/fail counters
- Report renderer (MonteCarloReportGenerator)
- RecommendationEngine

Add one analysis stage **after blocker analysis**:

```javascript
const deadBranchFindings = deadBranchDetector.detect({
  orBlockNodes: extractOrBlockNodes(treeRoot),
  prototypeMathByEmotion: simulationResult.prototypeMath,
  regimeConstraints: simulationResult.regimeConstraints,
  population: 'mood-regime'
});
```

Then:
1. Pass findings to DeadBranchSectionGenerator for report
2. Emit dead_branch recommendation items

### Existing Data Reused

| Data | Source | Already Computed |
|------|--------|------------------|
| Alternative pass rates | HierarchicalClauseNode.orPassInRegimeCount | ✅ Yes |
| maxObserved/minObserved | HierarchicalClauseNode.inRegimeMaxObservedValue | ✅ Yes |
| Gate pass rates | PrototypeMath.gatePassRateInRegime | ✅ Yes |
| Binding axes | PrototypeMath.bindingAxes | ✅ Yes |
| Regime constraints | SimulationResult.regimeConstraints | ✅ Yes |

---

## Services Architecture

### DeadBranchDetector

Main entry point coordinating detection across OR blocks.

**Dependencies**:
- `IStructuralImpossibilityAnalyzer`
- `ILimitingConstraintExtractor`
- `IAlternativeIdGenerator`
- `ILogger`

**Method**:
```javascript
detect({ orBlockNodes, prototypeMathByEmotion, regimeConstraints, population }) → DeadBranchFindings
```

### StructuralImpossibilityAnalyzer

Analyzes individual clauses for CEILING/FLOOR/CLAMP impossibilities.

**Method**:
```javascript
analyze({ clauseRef, operator, threshold, maxObserved, minObserved, gatePassRate, isEmotionClause }) → DeadEvidence | null
```

### LimitingConstraintExtractor

Maps binding axes to regime constraints for explanations.

**Methods**:
```javascript
extractForEmotion({ emotionId, prototypeMath, regimeConstraints, deadEvidence }) → LimitingConstraint[]
extractForNonEmotion({ deadEvidence }) → LimitingConstraint[]
```

### AlternativeIdGenerator

Generates stable, order-invariant IDs.

**Method**:
```javascript
generate(clauseRefs: string[]) → string  // Returns "alt_" + 12-char SHA256 hash
```

### DeadBranchSectionGenerator

Renders findings to markdown.

**Method**:
```javascript
generate({ findings, expressionId }) → string
```

---

## DI Tokens

Add to `src/dependencyInjection/tokens/tokens-diagnostics.js`:

```javascript
IDeadBranchDetector: 'IDeadBranchDetector',
IStructuralImpossibilityAnalyzer: 'IStructuralImpossibilityAnalyzer',
ILimitingConstraintExtractor: 'ILimitingConstraintExtractor',
IAlternativeIdGenerator: 'IAlternativeIdGenerator',
IDeadBranchSectionGenerator: 'IDeadBranchSectionGenerator',
```

---

## Implementation Files

### New Files

| Path | Type |
|------|------|
| `src/expressionDiagnostics/models/Alternative.js` | Model |
| `src/expressionDiagnostics/models/OrBlock.js` | Model |
| `src/expressionDiagnostics/models/DeadBranchFindings.js` | Model |
| `src/expressionDiagnostics/services/AlternativeIdGenerator.js` | Service |
| `src/expressionDiagnostics/services/StructuralImpossibilityAnalyzer.js` | Service |
| `src/expressionDiagnostics/services/LimitingConstraintExtractor.js` | Service |
| `src/expressionDiagnostics/services/DeadBranchDetector.js` | Service |
| `src/expressionDiagnostics/services/sectionGenerators/DeadBranchSectionGenerator.js` | Section Generator |

### Modified Files

| Path | Change |
|------|--------|
| `src/expressionDiagnostics/models/index.js` | Add exports |
| `src/expressionDiagnostics/services/sectionGenerators/index.js` | Add export |
| `src/dependencyInjection/tokens/tokens-diagnostics.js` | Add 5 tokens |
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | Add 5 registrations |
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | Add detector call + section |
| `src/expressionDiagnostics/services/RecommendationEngine.js` | Add dead_branch type |

---

## Acceptance Criteria

1. All unit tests (3.1-3.5, 3.7) pass
2. Integration test (3.6) passes with correct snapshot
3. Order invariance verified
4. No false positives (UNOBSERVED vs DEAD_BRANCH distinction works)
5. Limiting constraints extracted for emotion-driven dead branches
6. Report output matches specified format
7. All existing tests continue to pass
8. No TypeScript/lint errors
