# DEABRADET-009: MonteCarloReportGenerator Integration

## Description

Integrate DeadBranchDetector and DeadBranchSectionGenerator into the MonteCarloReportGenerator pipeline, following the existing lazy initialization pattern.

## Files to Modify

- `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`:
  - Add optional constructor parameters for detector and section generator
  - Add lazy initialization getters
  - Call detector after blocker analysis stage
  - Add section generation to sections array

## Files to Create

None - this ticket only modifies existing files.

## Out of Scope

- RecommendationEngine `dead_branch` type (DEABRADET-010)
- Integration test snapshot (DEABRADET-010)
- New models or services

## Implementation Details

### MonteCarloReportGenerator Changes

1. **Add private fields**:
```javascript
#deadBranchDetector;
#deadBranchSectionGenerator;
```

2. **Add constructor parameters** (optional with null defaults):
```javascript
constructor({
  // ... existing params
  deadBranchDetector = null,
  deadBranchSectionGenerator = null,
}) {
  // ... existing initialization
  this.#deadBranchDetector = deadBranchDetector;
  this.#deadBranchSectionGenerator = deadBranchSectionGenerator;
}
```

3. **Add lazy initialization getters**:
```javascript
#getOrCreateDeadBranchDetector() {
  if (!this.#deadBranchDetector) {
    this.#deadBranchDetector = new DeadBranchDetector({
      logger: this.#logger,
      structuralImpossibilityAnalyzer: new StructuralImpossibilityAnalyzer({ logger: this.#logger }),
      limitingConstraintExtractor: new LimitingConstraintExtractor({ logger: this.#logger }),
      alternativeIdGenerator: new AlternativeIdGenerator({ logger: this.#logger }),
    });
  }
  return this.#deadBranchDetector;
}

#getOrCreateDeadBranchSectionGenerator() {
  if (!this.#deadBranchSectionGenerator) {
    this.#deadBranchSectionGenerator = new DeadBranchSectionGenerator({
      formattingService: this.#formattingService,
      logger: this.#logger,
    });
  }
  return this.#deadBranchSectionGenerator;
}
```

4. **Add detection call in generate() method** (after blocker analysis):
```javascript
// After blocker analysis, before recommendations
const deadBranchFindings = this.#detectDeadBranches(simulationResult, blockers);
```

5. **Add helper method**:
```javascript
#detectDeadBranches(simulationResult, blockers) {
  if (!simulationResult?.hierarchicalTree?.root) {
    return null;
  }

  const orBlockNodes = this.#extractOrBlockNodes(simulationResult.hierarchicalTree.root);
  if (!orBlockNodes.length) {
    return null;
  }

  const detector = this.#getOrCreateDeadBranchDetector();
  return detector.detect({
    orBlockNodes,
    prototypeMathByEmotion: simulationResult.prototypeMath ?? {},
    regimeConstraints: simulationResult.regimeConstraints ?? {},
    population: 'mood-regime',
  });
}

#extractOrBlockNodes(node, results = []) {
  // Recursively find OR nodes in tree
  if (node.type === 'OR' && node.alternatives) {
    results.push(node);
  }
  for (const child of node.children ?? []) {
    this.#extractOrBlockNodes(child, results);
  }
  return results;
}
```

6. **Add section to sections array**:
```javascript
// In generate() method, after blocker section
if (deadBranchFindings?.orBlocks?.length) {
  sections.push(
    this.#getOrCreateDeadBranchSectionGenerator().generate({
      findings: deadBranchFindings,
      expressionId: simulationResult.expressionId,
    })
  );
}
```

### Section Positioning

Insert the Dead Branch Analysis section after Blocker Analysis and before Recommendations:
```
8. Blocker Analysis
9. Dead Branch Analysis  <-- NEW
10. Recommendations
```

## Acceptance Criteria

### Tests That Must Pass

1. **Backwards compatibility**:
   - Generator still works without detector parameters (lazy init)
   - All existing MonteCarloReportGenerator tests pass unchanged
   - Existing snapshots remain unchanged (no dead branches in existing fixtures)

2. **Lazy initialization**:
   - `#getOrCreateDeadBranchDetector()` creates detector on first call
   - `#getOrCreateDeadBranchDetector()` returns same instance on subsequent calls
   - Same for section generator

3. **Integration with detector**:
   - When simulationResult has OR blocks with dead branches, section appears in report
   - When simulationResult has no OR blocks, no dead branch section
   - When simulationResult has OR blocks but no dead branches, no section

4. **Section positioning**:
   - Dead branch section appears after blocker analysis
   - Dead branch section appears before recommendations

### Invariants That Must Remain True

1. **Backwards compatible**: No breaking changes to existing API
2. **Lazy initialization**: Prevents startup cost when feature not used
3. All existing tests pass without modification
4. No snapshot changes to existing test fixtures
5. `npm run typecheck` passes
6. `npx eslint src/expressionDiagnostics/services/MonteCarloReportGenerator.js` passes

## Dependencies

- DEABRADET-007 (DeadBranchDetector service)
- DEABRADET-008 (DeadBranchSectionGenerator)

## Estimated Diff Size

~100 lines of modifications to MonteCarloReportGenerator.js
