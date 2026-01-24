# PROANAOVEV3-006: GateASTNormalizer Service

## Summary

Create a service that parses gate definitions into a canonical AST representation, enabling reliable implication checking and consistent gate comparisons.

## Motivation

Current gate parsing is inconsistent and falls back to Monte Carlo inference when deterministic nesting is unreliable. A canonical AST representation ensures:
- Consistent parsing across gate formats (JSON-Logic, strings, arrays)
- Reliable implication checking (A → B)
- Human-readable string generation FROM the AST

## Files to Create

### Service
- `src/expressionDiagnostics/services/prototypeOverlap/GateASTNormalizer.js`

### Unit Tests
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/gateASTNormalizer.test.js`

## Implementation Details

### AST Schema

```javascript
/**
 * @typedef {object} GateAST
 * @property {'and' | 'or' | 'comparison' | 'not'} type
 * @property {Array<GateAST>} [children] - For 'and' | 'or'
 * @property {GateAST} [operand] - For 'not'
 * @property {string} [axis] - For 'comparison'
 * @property {'<' | '<=' | '>' | '>=' | '==' | '!='} [operator] - For 'comparison'
 * @property {number} [threshold] - For 'comparison'
 */

// Example: "valence > 0.5 AND (arousal >= 0.3 OR threat < 0.2)"
const exampleAST = {
  type: 'and',
  children: [
    { type: 'comparison', axis: 'valence', operator: '>', threshold: 0.5 },
    {
      type: 'or',
      children: [
        { type: 'comparison', axis: 'arousal', operator: '>=', threshold: 0.3 },
        { type: 'comparison', axis: 'threat', operator: '<', threshold: 0.2 },
      ],
    },
  ],
};
```

### Interface

```javascript
class GateASTNormalizer {
  /**
   * @param {object} options
   * @param {object} options.logger - Logger instance
   */
  constructor(options)

  /**
   * Parse gate definition to canonical AST.
   * @param {object|string|Array} gate - Gate in any supported format
   * @returns {{ast: GateAST, parseComplete: boolean, errors: Array<string>}}
   */
  parse(gate)

  /**
   * Check if AST A implies AST B (A → B).
   * @param {GateAST} astA
   * @param {GateAST} astB
   * @returns {{implies: boolean, isVacuous: boolean}}
   */
  checkImplication(astA, astB)

  /**
   * Generate human-readable string from AST.
   * @param {GateAST} ast
   * @returns {string}
   */
  toString(ast)

  /**
   * Evaluate AST against context.
   * @param {GateAST} ast
   * @param {object} context
   * @returns {boolean}
   */
  evaluate(ast, context)

  /**
   * Normalize AST to canonical form (sorted, simplified).
   * @param {GateAST} ast
   * @returns {GateAST}
   */
  normalize(ast)
}
```

### Supported Gate Formats

1. **JSON-Logic**: `{"and": [{">=": [{"var": "valence"}, 0.5]}, ...]}`
2. **String predicates**: `"valence > 0.5 AND arousal >= 0.3"`
3. **Array format**: `[{"axis": "valence", "op": ">", "value": 0.5}, ...]`

### Implication Checking

Use constraint propagation:
- A → B if B's constraints are weaker (broader range) than A's
- Handle AND/OR combinations recursively
- Detect vacuous implications (always true)

## Out of Scope

- Integrating with `GateImplicationEvaluator` (ticket 012)
- DI registration (ticket 009)

## Acceptance Criteria

- [x] Parse JSON-Logic gates to AST
- [x] Parse string predicate gates to AST
- [x] Parse array format gates to AST
- [x] `toString()` generates readable gate expressions
- [x] `evaluate()` correctly evaluates AST against context
- [x] `normalize()` produces canonical AST form
- [x] `checkImplication()` correctly determines A → B
- [x] Vacuous implications detected
- [x] Parse errors collected and reported
- [x] Unit tests cover:
  - Parsing JSON-Logic gates
  - Parsing string predicates
  - Parsing array gates
  - Implication checking (A → B)
  - Vacuous implication detection
  - toString generation
  - AST evaluation
  - Parse error handling
  - Normalization
- [x] 80%+ branch coverage on new code
- [x] `npm run typecheck` passes (pre-existing errors in other files unrelated to this ticket)
- [x] `npx eslint src/expressionDiagnostics/services/prototypeOverlap/GateASTNormalizer.js` passes
- [x] Integration tests created for existing gate parsers BEFORE implementation
- [x] All integration tests pass after GateASTNormalizer implementation

## Dependencies

None - standalone service.

## Estimated Complexity

High - parsing multiple formats, constraint propagation logic.

## Additional Work Completed

### Pre-requisite Integration Tests (Completed)

Created integration tests that pin the current behavior of existing gate parsers before refactoring:

**New test files created:**

1. `tests/integration/expressionDiagnostics/prototypeOverlap/gateParsingConsistency.integration.test.js`
   - Tests GateConstraint.parse(), GateConstraintExtractor.#parseGate(), emotionCalculatorService.#parseGate()
   - Uses real gates from emotion_prototypes.lookup.json and sexual_prototypes.lookup.json
   - Verifies all parsers handle the same gate strings consistently
   - Documents known discrepancy: GateConstraintExtractor regex missing `==` operator

2. `tests/integration/expressionDiagnostics/prototypeOverlap/gateConstraintExtractor.integration.test.js`
   - Tests full pipeline: gates → intervals → interval analysis
   - Uses real prototype data
   - Verifies strict epsilon handling for strict inequalities

3. `tests/integration/expressionDiagnostics/prototypeOverlap/gateImplicationEvaluator.integration.test.js`
   - Tests implication evaluation with real prototype pairs
   - Verifies vacuous implication detection
   - Validates counterexample tracking and performance

### Analysis Summary

The exploration revealed **significant duplication** in gate parsing across the codebase. Three separate implementations parse gate strings using the same regex pattern:

| File | Location | Method |
|------|----------|--------|
| `emotionCalculatorService.js` | Lines 211-223 | `#parseGate()` |
| `GateConstraint.js` | Lines 125-148 | `static parse()` |
| `GateConstraintExtractor.js` | Lines 143-175 | `#parseGate()` |

All three use essentially the same regex: `/^(\w+)\s*(>=|<=|>|<|==)\s*(-?\d*\.?\d+)$/`

**Note**: GateConstraintExtractor is missing `==` operator support (documented discrepancy).

## Post-Implementation Refactoring Tasks

After GateASTNormalizer is complete, the following files should be refactored to use it:

1. **GateConstraint.js** (`src/expressionDiagnostics/models/`)
   - Refactor `static parse()` to use GateASTNormalizer
   - Maintain backward compatibility

2. **GateConstraintExtractor.js** (`src/expressionDiagnostics/services/prototypeOverlap/`)
   - Refactor `#parseGate()` to use GateASTNormalizer
   - Fix missing `==` operator support

3. **emotionCalculatorService.js** (`src/emotions/`)
   - Refactor `#parseGate()` to use GateASTNormalizer
   - **HIGH RISK** - production emotion calculation - requires thorough testing
