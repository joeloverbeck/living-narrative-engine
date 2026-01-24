# PROANAOVEV3-012: GateImplicationEvaluator AST Integration

## Summary

Update `GateImplicationEvaluator` to use `GateASTNormalizer` for canonical gate representation and reliable implication checking.

## Motivation

Current gate parsing is inconsistent and falls back to Monte Carlo when deterministic nesting is unreliable. Using canonical AST representation ensures consistent parsing and reliable implication detection.

## Files to Modify

### Service
- `src/expressionDiagnostics/services/prototypeOverlap/GateImplicationEvaluator.js`

### Unit Tests
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/gateImplicationEvaluator.test.js` (update existing)

## Implementation Details

### Interface Changes

```javascript
class GateImplicationEvaluator {
  /**
   * @param {object} options
   * @param {object} options.gateASTNormalizer - AST normalizer instance
   * @param {object} options.logger
   */
  constructor(options)

  /**
   * Check if gateA implies gateB using AST-based analysis.
   * @param {object} gateA - Gate definition (any supported format)
   * @param {object} gateB - Gate definition (any supported format)
   * @returns {ImplicationResult}
   */
  checkImplication(gateA, gateB)

  /**
   * Get human-readable description of gate.
   * @param {object} gate - Gate definition
   * @returns {string}
   */
  describeGate(gate)
}

/**
 * @typedef {object} ImplicationResult
 * @property {boolean} implies - Whether A → B
 * @property {boolean} isVacuous - Whether implication is vacuously true
 * @property {boolean} parseComplete - Whether both gates fully parsed
 * @property {string} confidence - 'deterministic' | 'probabilistic' | 'unknown'
 * @property {Array<string>} parseErrors - Any parsing errors encountered
 */
```

### AST-Based Evaluation

```javascript
checkImplication(gateA, gateB) {
  // Parse both gates to AST
  const parsedA = this.#gateASTNormalizer.parse(gateA);
  const parsedB = this.#gateASTNormalizer.parse(gateB);

  // If parsing incomplete, return with probabilistic confidence
  if (!parsedA.parseComplete || !parsedB.parseComplete) {
    return {
      implies: false,
      isVacuous: false,
      parseComplete: false,
      confidence: 'unknown',
      parseErrors: [...parsedA.errors, ...parsedB.errors],
    };
  }

  // Use AST normalizer's implication check
  const result = this.#gateASTNormalizer.checkImplication(parsedA.ast, parsedB.ast);

  return {
    implies: result.implies,
    isVacuous: result.isVacuous,
    parseComplete: true,
    confidence: 'deterministic',
    parseErrors: [],
  };
}

describeGate(gate) {
  const parsed = this.#gateASTNormalizer.parse(gate);
  if (!parsed.parseComplete) {
    return `[Unparseable gate: ${parsed.errors.join(', ')}]`;
  }
  return this.#gateASTNormalizer.toString(parsed.ast);
}
```

### V2 Code Removal

The following v2 code paths will be removed:
- Legacy gate parsing logic (non-AST)
- String-based gate representation fallbacks
- Old implication checking without AST

## Out of Scope

- Creating `GateASTNormalizer` (ticket 006)
- Integration with `PrototypeOverlapAnalyzer` (ticket 013)

## Acceptance Criteria

- [ ] `checkImplication` uses AST-based analysis
- [ ] Parse errors captured and reported
- [ ] Confidence level reflects parse completeness
- [ ] Vacuous implications detected
- [ ] `describeGate` generates readable strings via AST
- [ ] Legacy gate parsing code removed
- [ ] Unit tests cover:
  - AST-based implication checking
  - Parse error handling
  - Confidence level determination
  - Vacuous implication detection
  - Gate description generation
- [ ] 80%+ branch coverage on new code
- [ ] `npm run typecheck` passes
- [ ] `npx eslint src/expressionDiagnostics/services/prototypeOverlap/GateImplicationEvaluator.js` passes

## Dependencies

- PROANAOVEV3-006 (GateASTNormalizer) - provides AST parsing

## Estimated Complexity

Medium - integrating AST normalizer and removing legacy parsing code.
