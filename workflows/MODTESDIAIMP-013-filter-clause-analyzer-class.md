# MODTESDIAIMP-013: Create FilterClauseAnalyzer Class

**Phase**: 4 - Filter Clause Breakdown
**Priority**: 🟢 Medium
**Estimated Effort**: 4 hours
**Dependencies**: None (independent)

---

## Overview

Create a comprehensive filter clause analyzer that recursively breaks down JSON Logic expressions into detailed evaluation trees with per-clause results, enabling precise identification of which filter conditions pass or fail during entity evaluation.

## Objectives

- Parse JSON Logic expressions recursively
- Track evaluation results for each clause
- Build detailed breakdown trees with pass/fail status
- Support all JSON Logic operators
- Handle nested conditions and arrays
- Provide readable clause descriptions

## Implementation Details

### File Location
- **Path**: `src/scopeDsl/analysis/filterClauseAnalyzer.js`
- **New File**: Yes

### Class Structure

```javascript
export class FilterClauseAnalyzer {
  static analyzeFilter(logic, evalContext, logicEval)
  #analyzeNode(node, evalContext, logicEval, path = [])
  #describeClause(node, path)
  #formatValue(value)
}
```

### Core Methods

#### 1. Public API

```javascript
/**
 * Analyze a JSON Logic expression
 * @param {object} logic - JSON Logic expression
 * @param {object} evalContext - Evaluation context with variables
 * @param {object} logicEval - JSON Logic evaluator instance
 * @returns {object} Analysis result with breakdown tree
 */
static analyzeFilter(logic, evalContext, logicEval) {
  if (!logic || typeof logic !== 'object') {
    return {
      result: logicEval.evaluate(logic, evalContext),
      breakdown: null,
      description: 'Empty or invalid logic',
    };
  }

  try {
    const result = logicEval.evaluate(logic, evalContext);
    const breakdown = this.#analyzeNode(logic, evalContext, logicEval, []);

    return {
      result,
      breakdown,
      description: this.#describeClause(logic, []),
    };
  } catch (error) {
    return {
      result: false,
      breakdown: null,
      description: `Error evaluating filter: ${error.message}`,
      error: error.message,
    };
  }
}
```

#### 2. Recursive Analysis

```javascript
#analyzeNode(node, evalContext, logicEval, path) {
  if (typeof node !== 'object' || node === null) {
    // Primitive value
    return {
      type: 'value',
      value: node,
      path,
    };
  }

  const operator = Object.keys(node)[0];
  const args = node[operator];

  // Special case: var operator
  if (operator === 'var') {
    const varName = typeof args === 'string' ? args : args[0];
    const defaultValue = Array.isArray(args) ? args[1] : undefined;
    const value = evalContext[varName] ?? defaultValue;

    return {
      type: 'variable',
      operator: 'var',
      varName,
      value,
      path,
      description: `var("${varName}") = ${this.#formatValue(value)}`,
    };
  }

  // Evaluate this node
  const nodeResult = logicEval.evaluate(node, evalContext);

  // Analyze children recursively
  const children = Array.isArray(args)
    ? args.map((arg, i) => this.#analyzeNode(arg, evalContext, logicEval, [...path, i]))
    : [this.#analyzeNode(args, evalContext, logicEval, [...path, 0])];

  return {
    type: 'operator',
    operator,
    result: nodeResult,
    children,
    path,
    description: this.#describeClause(node, path),
  };
}
```

#### 3. Clause Description

```javascript
#describeClause(node, path) {
  if (typeof node !== 'object' || node === null) {
    return String(node);
  }

  const operator = Object.keys(node)[0];
  const args = node[operator];

  // Operator-specific descriptions
  switch (operator) {
    case 'and':
      return 'All conditions must be true';

    case 'or':
      return 'At least one condition must be true';

    case '==':
      return `${this.#formatValue(args[0])} equals ${this.#formatValue(args[1])}`;

    case '!=':
      return `${this.#formatValue(args[0])} does not equal ${this.#formatValue(args[1])}`;

    case '>':
      return `${this.#formatValue(args[0])} is greater than ${this.#formatValue(args[1])}`;

    case '>=':
      return `${this.#formatValue(args[0])} is greater than or equal to ${this.#formatValue(args[1])}`;

    case '<':
      return `${this.#formatValue(args[0])} is less than ${this.#formatValue(args[1])}`;

    case '<=':
      return `${this.#formatValue(args[0])} is less than or equal to ${this.#formatValue(args[1])}`;

    case 'in':
      return `${this.#formatValue(args[0])} is in ${this.#formatValue(args[1])}`;

    case '!':
      return `NOT (${this.#describeClause(args, [...path, 0])})`;

    case 'var':
      return `variable "${args}"`;

    case 'condition_ref':
      return `condition reference "${args}"`;

    default:
      return `${operator} operation`;
  }
}
```

#### 4. Value Formatting

```javascript
#formatValue(value) {
  if (typeof value === 'object' && value !== null) {
    if ('var' in value) {
      return `var("${value.var}")`;
    }
    if ('condition_ref' in value) {
      return `condition_ref("${value.condition_ref}")`;
    }
    if (Array.isArray(value)) {
      return `[${value.map(v => this.#formatValue(v)).join(', ')}]`;
    }
    return JSON.stringify(value);
  }

  if (typeof value === 'string') {
    return `"${value}"`;
  }

  return String(value);
}
```

### Breakdown Structure

```javascript
{
  result: boolean,              // Overall filter result
  breakdown: {
    type: 'operator' | 'variable' | 'value',
    operator: string,           // For operator nodes
    result: boolean,            // For operator nodes
    children: Array,            // Recursive breakdown
    varName: string,            // For variable nodes
    value: any,                 // For variable/value nodes
    path: Array<number>,        // Path in expression tree
    description: string         // Human-readable description
  },
  description: string,          // Top-level description
  error?: string                // Error message if evaluation failed
}
```

## Acceptance Criteria

### Core Functionality
- ✅ Recursively analyzes JSON Logic expressions
- ✅ Tracks result for each operator node
- ✅ Builds complete breakdown tree
- ✅ Handles nested conditions
- ✅ Supports all JSON Logic operators

### Variable Handling
- ✅ Extracts variable references
- ✅ Shows resolved values
- ✅ Handles default values
- ✅ Shows variable paths

### Operator Support
- ✅ Logical: `and`, `or`, `!`
- ✅ Comparison: `==`, `!=`, `>`, `>=`, `<`, `<=`
- ✅ Membership: `in`
- ✅ Custom: `condition_ref`
- ✅ Variables: `var`

### Description Quality
- ✅ Human-readable clause descriptions
- ✅ Operator-specific formatting
- ✅ Value formatting (arrays, objects, primitives)
- ✅ Clear path tracking

### Error Handling
- ✅ Graceful handling of invalid logic
- ✅ Error messages captured
- ✅ Partial results when possible

## Testing Requirements

**Test File**: `tests/unit/scopeDsl/analysis/filterClauseAnalyzer.test.js`

### Test Cases

```javascript
describe('FilterClauseAnalyzer', () => {
  describe('Simple operators', () => {
    it('should analyze == operator')
    it('should analyze != operator')
    it('should analyze > operator')
    it('should analyze >= operator')
    it('should analyze < operator')
    it('should analyze <= operator')
    it('should analyze in operator')
  });

  describe('Logical operators', () => {
    it('should analyze and operator with all true')
    it('should analyze and operator with some false')
    it('should analyze or operator with all false')
    it('should analyze or operator with some true')
    it('should analyze ! (not) operator')
  });

  describe('Variable handling', () => {
    it('should resolve var references')
    it('should show variable values')
    it('should handle default values')
    it('should track variable paths')
  });

  describe('Nested conditions', () => {
    it('should analyze nested and/or')
    it('should analyze deeply nested conditions')
    it('should track paths correctly')
  });

  describe('Custom operators', () => {
    it('should handle condition_ref operator')
    it('should describe custom operators')
  });

  describe('Edge cases', () => {
    it('should handle null/undefined logic')
    it('should handle empty objects')
    it('should handle evaluation errors')
    it('should handle missing variables')
  });

  describe('Description generation', () => {
    it('should generate readable descriptions')
    it('should format values correctly')
    it('should describe complex expressions')
  });
});
```

## Integration Points

Will be integrated into:
- `FilterResolver.resolve()` (MODTESDIAIMP-014)
- `ScopeEvaluationTracer.logFilterEvaluation()` (MODTESDIAIMP-014)
- Test diagnostics output (MODTESDIAIMP-015)

## Example Usage

```javascript
import { FilterClauseAnalyzer } from './analysis/filterClauseAnalyzer.js';
import jsonLogic from 'json-logic-js';

const logic = {
  and: [
    { '==': [{ var: 'type' }, 'actor'] },
    { '>': [{ var: 'level' }, 5] },
  ],
};

const evalContext = {
  type: 'actor',
  level: 3,
};

const analysis = FilterClauseAnalyzer.analyzeFilter(
  logic,
  evalContext,
  jsonLogic
);

console.log(analysis);
// {
//   result: false,
//   breakdown: {
//     type: 'operator',
//     operator: 'and',
//     result: false,
//     children: [
//       {
//         type: 'operator',
//         operator: '==',
//         result: true,
//         children: [...]
//       },
//       {
//         type: 'operator',
//         operator: '>',
//         result: false,
//         children: [...]
//       }
//     ],
//     description: 'All conditions must be true'
//   }
// }
```

## Performance Considerations

- Recursive analysis adds overhead (~10-20%)
- Only analyze when tracer enabled
- Cache operator descriptions
- Limit recursion depth if needed
- Optimize value formatting

## References

- **Spec Section**: 4. Filter Clause Breakdown (lines 1177-1485)
- **Example Section**: 5. Usage Examples, Example 3 (lines 2003-2086)
- **Related Tickets**:
  - MODTESDIAIMP-014 (Integration into FilterResolver)
  - MODTESDIAIMP-015 (Filter breakdown tests)
