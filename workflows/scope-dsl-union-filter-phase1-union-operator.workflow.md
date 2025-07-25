# Phase 1: Union Operator Implementation

**Phase**: 1 of 3  
**Feature**: Pipe (`|`) Union Operator  
**Complexity**: Low  
**Timeline**: 3-4 days  
**Prerequisites**: None

## Phase Overview

Implement the pipe (`|`) operator as an alternative syntax for unions in Scope DSL expressions. This operator will function identically to the existing plus (`+`) operator but provides a more intuitive syntax for combining scope results.

### Key Requirements

- Add `|` as a recognized token in the tokenizer
- Update parser to handle `|` as a union operator
- Maintain 100% backward compatibility with `+` operator
- Both operators produce identical AST nodes

### Success Criteria

- `actor.followers | actor.partners` produces same result as `actor.followers + actor.partners`
- All existing scope files using `+` continue to work
- New operator properly handles precedence and nesting
- Comprehensive test coverage for new syntax

---

## Ticket 1.1: Add PIPE Token to Tokenizer

**File**: `src/scopeDsl/parser/tokenizer.js`  
**Time Estimate**: 1 hour  
**Dependencies**: None  
**Complexity**: Trivial

### Description

Add support for the pipe character (`|`) as a new token type in the Scope DSL tokenizer. This token will be used by the parser to create Union AST nodes.

### Implementation Details

#### Step 1: Add PIPE Token Case

In the `tokenize()` method's switch statement (around line 60-96), add a new case for the pipe character:

```javascript
// In tokenizer.js, inside the switch statement in tokenize() method
// After line 93 (case '!': ...) and before default case

case '|':
  this.push('PIPE', '|');
  break;
```

#### Step 2: Update Token Type Documentation

At the top of the file, update any token type documentation to include PIPE:

```javascript
// Token types recognized by the tokenizer:
// IDENTIFIER, LPAREN, RPAREN, LBRACKET, RBRACKET, LBRACE, RBRACE,
// COMMA, PLUS, PIPE, DOT, COLON, BANG, STRING, EOF
```

### Test Cases

Create file: `tests/unit/scopeDsl/parser/tokenizer.pipe.test.js`

```javascript
import { describe, it, expect } from '@jest/globals';
import { Tokenizer } from '../../../../src/scopeDsl/parser/tokenizer.js';

describe('Tokenizer - PIPE Token Support', () => {
  it('should tokenize pipe character as PIPE token', () => {
    const tokenizer = new Tokenizer('actor.followers | actor.partners');
    const tokens = tokenizer.getTokens();

    expect(tokens).toMatchObject([
      { type: 'IDENTIFIER', value: 'actor' },
      { type: 'DOT', value: '.' },
      { type: 'IDENTIFIER', value: 'followers' },
      { type: 'PIPE', value: '|' },
      { type: 'IDENTIFIER', value: 'actor' },
      { type: 'DOT', value: '.' },
      { type: 'IDENTIFIER', value: 'partners' },
      { type: 'EOF', value: '' },
    ]);
  });

  it('should handle pipe with whitespace', () => {
    const tokenizer = new Tokenizer('a|b');
    const tokens = tokenizer.getTokens();

    expect(tokens[1]).toMatchObject({ type: 'PIPE', value: '|' });
  });

  it('should track line and column for pipe token', () => {
    const tokenizer = new Tokenizer('foo\n  | bar');
    const tokens = tokenizer.getTokens();
    const pipeToken = tokens.find((t) => t.type === 'PIPE');

    expect(pipeToken).toMatchObject({
      type: 'PIPE',
      value: '|',
      line: 2,
      column: 3,
    });
  });

  it('should handle multiple pipes in expression', () => {
    const tokenizer = new Tokenizer('a | b | c');
    const tokens = tokenizer.getTokens();
    const pipeTokens = tokens.filter((t) => t.type === 'PIPE');

    expect(pipeTokens).toHaveLength(2);
  });
});
```

### Verification Steps

1. Run the new test file: `npm run test:unit -- tokenizer.pipe.test.js`
2. Verify all tests pass
3. Run existing tokenizer tests to ensure no regression: `npm run test:unit -- tokenizer.test.js`
4. Run linting: `npm run lint`

### Acceptance Criteria

- [ ] Pipe character produces PIPE token
- [ ] Token includes correct line/column information
- [ ] Existing tokenizer functionality unchanged
- [ ] All tests pass
- [ ] No linting errors

---

## Ticket 1.2: Update Parser to Handle PIPE Token

**File**: `src/scopeDsl/parser/parser.js`  
**Time Estimate**: 2 hours  
**Dependencies**: Ticket 1.1  
**Complexity**: Low

### Description

Modify the parser's `parseExpr()` method to recognize the PIPE token as a union operator, creating the same Union AST node as the PLUS token.

### Implementation Details

#### Step 1: Modify parseExpr() Method

Update the `parseExpr()` method (around line 77-85) to check for both PLUS and PIPE tokens:

```javascript
// In parser.js, replace the existing parseExpr() method

/** @returns {object} */
parseExpr() {
  const left = this.parseTerm();

  // Check for union operators (both + and |)
  if (this.match('PLUS') || this.match('PIPE')) {
    const operatorToken = this.advance(); // Capture which operator was used
    const right = this.parseExpr();
    return {
      type: 'Union',
      left,
      right,
      // Note: We don't need to track the operator type since both
      // produce identical behavior, but it could be useful for debugging
    };
  }
  return left;
}
```

### Test Cases

Create file: `tests/unit/scopeDsl/parser/parser.pipe.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { parseDslExpression } from '../../../../src/scopeDsl/parser/parser.js';

describe('Parser - PIPE Union Operator', () => {
  it('should parse pipe operator as Union node', () => {
    const ast = parseDslExpression('actor.followers | actor.partners');

    expect(ast).toMatchObject({
      type: 'Union',
      left: {
        type: 'Step',
        field: 'followers',
        parent: {
          type: 'Source',
          kind: 'actor',
        },
      },
      right: {
        type: 'Step',
        field: 'partners',
        parent: {
          type: 'Source',
          kind: 'actor',
        },
      },
    });
  });

  it('should handle multiple pipe unions (right-associative)', () => {
    const ast = parseDslExpression('a | b | c');

    expect(ast).toMatchObject({
      type: 'Union',
      left: { type: 'Source', kind: 'actor' }, // 'a' defaults to actor
      right: {
        type: 'Union',
        left: { type: 'Source', kind: 'actor' }, // 'b'
        right: { type: 'Source', kind: 'actor' }, // 'c'
      },
    });
  });

  it('should handle mixed union operators', () => {
    const ast = parseDslExpression('a + b | c');

    expect(ast).toMatchObject({
      type: 'Union',
      left: { type: 'Source' },
      right: {
        type: 'Union',
        left: { type: 'Source' },
        right: { type: 'Source' },
      },
    });
  });

  it('should preserve operator precedence with pipes', () => {
    const ast = parseDslExpression(
      'actor.items[].name | location.items[].name'
    );

    expect(ast.type).toBe('Union');
    expect(ast.left.type).toBe('Step');
    expect(ast.left.field).toBe('name');
    expect(ast.right.type).toBe('Step');
    expect(ast.right.field).toBe('name');
  });

  it('should handle pipe in complex expressions', () => {
    const ast = parseDslExpression(
      'actor.topmost_clothing.torso_upper | actor.topmost_clothing.torso_lower'
    );

    expect(ast.type).toBe('Union');
    expect(ast.left.parent.field).toBe('topmost_clothing');
    expect(ast.right.parent.field).toBe('topmost_clothing');
  });

  it('should work with filters and pipes', () => {
    const ast = parseDslExpression(
      'actor.items[{"==": [{"var": "type"}, "weapon"]}] | actor.equipped'
    );

    expect(ast.type).toBe('Union');
    expect(ast.left.type).toBe('Filter');
    expect(ast.right.field).toBe('equipped');
  });
});
```

### Additional Test - Backward Compatibility

Add to existing parser test file to ensure `+` still works:

```javascript
describe('Parser - Backward Compatibility', () => {
  it('should still support plus operator for unions', () => {
    const plusAst = parseDslExpression('a + b');
    const pipeAst = parseDslExpression('a | b');

    // Both should produce identical Union nodes
    expect(plusAst.type).toBe('Union');
    expect(pipeAst.type).toBe('Union');

    // Structure should be identical
    expect(plusAst.left).toEqual(pipeAst.left);
    expect(plusAst.right).toEqual(pipeAst.right);
  });
});
```

### Verification Steps

1. Run new parser tests: `npm run test:unit -- parser.pipe.test.js`
2. Run existing parser tests: `npm run test:unit -- parser.test.js`
3. Verify AST structure matches for both operators
4. Check no regression in complex expressions

### Acceptance Criteria

- [ ] Pipe operator creates Union AST nodes
- [ ] Plus operator continues to work
- [ ] Both operators produce identical AST structure
- [ ] Operator precedence maintained
- [ ] All tests pass

---

## Ticket 1.3: Integration Testing for Union Operator

**File**: `tests/integration/scopeDsl/unionOperator.test.js`  
**Time Estimate**: 2 hours  
**Dependencies**: Tickets 1.1, 1.2  
**Complexity**: Low

### Description

Create comprehensive integration tests to verify the pipe operator works correctly with the entire Scope DSL engine, including resolution and result combination.

### Implementation Details

Create complete integration test file:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import createScopeDslEngine from '../../../src/scopeDsl/engine.js';
import { createMockEntity } from '../../common/testHelpers/entityHelpers.js';
import { createTestDependencies } from '../../common/testHelpers/dependencyHelpers.js';

describe('Scope DSL - Union Operator Integration', () => {
  let engine;
  let actorEntity;
  let runtimeCtx;

  beforeEach(() => {
    const deps = createTestDependencies();
    engine = createScopeDslEngine(deps);

    // Create test actor with followers and partners
    actorEntity = createMockEntity('test:actor', {
      'social:relationships': {
        followers: ['follower1', 'follower2'],
        partners: ['partner1', 'partner2'],
      },
    });

    // Mock entity manager
    const entityManager = {
      getEntity: (id) => {
        const entities = {
          'test:actor': actorEntity,
          follower1: createMockEntity('follower1'),
          follower2: createMockEntity('follower2'),
          partner1: createMockEntity('partner1'),
          partner2: createMockEntity('partner2'),
        };
        return entities[id];
      },
    };

    runtimeCtx = { entityManager };
  });

  describe('Pipe operator functionality', () => {
    it('should combine results using pipe operator', () => {
      const ast = engine.parse('actor.followers | actor.partners');
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      expect(Array.from(result).sort()).toEqual([
        'follower1',
        'follower2',
        'partner1',
        'partner2',
      ]);
    });

    it('should produce identical results to plus operator', () => {
      const pipeAst = engine.parse('actor.followers | actor.partners');
      const plusAst = engine.parse('actor.followers + actor.partners');

      const pipeResult = engine.resolve(pipeAst, actorEntity, runtimeCtx);
      const plusResult = engine.resolve(plusAst, actorEntity, runtimeCtx);

      expect(Array.from(pipeResult).sort()).toEqual(
        Array.from(plusResult).sort()
      );
    });

    it('should handle multiple pipe unions', () => {
      // Add more relationships
      actorEntity.components.set('social:relationships', {
        followers: ['f1'],
        partners: ['p1'],
        friends: ['fr1', 'fr2'],
      });

      const ast = engine.parse(
        'actor.followers | actor.partners | actor.friends'
      );
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result).sort()).toEqual(['f1', 'fr1', 'fr2', 'p1']);
    });

    it('should work with entity queries', () => {
      // Mock entities query
      runtimeCtx.componentRegistry = {
        getEntitiesWithComponent: (componentId) => {
          if (componentId === 'core:actor')
            return new Set(['actor1', 'actor2']);
          if (componentId === 'core:npc') return new Set(['npc1', 'npc2']);
          return new Set();
        },
      };

      const ast = engine.parse('entities(core:actor) | entities(core:npc)');
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result).sort()).toEqual([
        'actor1',
        'actor2',
        'npc1',
        'npc2',
      ]);
    });

    it('should handle empty results in unions', () => {
      actorEntity.components.set('social:relationships', {
        followers: [],
        partners: ['partner1'],
      });

      const ast = engine.parse('actor.followers | actor.partners');
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result)).toEqual(['partner1']);
    });

    it('should deduplicate results', () => {
      actorEntity.components.set('social:relationships', {
        followers: ['person1', 'person2'],
        partners: ['person1', 'person3'], // person1 is both follower and partner
      });

      const ast = engine.parse('actor.followers | actor.partners');
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result).sort()).toEqual([
        'person1',
        'person2',
        'person3',
      ]);
      expect(result.size).toBe(3); // Not 4, due to deduplication
    });
  });

  describe('Complex union scenarios', () => {
    it('should work with clothing queries', () => {
      actorEntity.components.set('clothing:wearing', {
        slots: {
          'torso:upper': { items: ['shirt1'] },
          'torso:lower': { items: ['pants1'] },
        },
      });

      const ast = engine.parse(
        'actor.topmost_clothing.torso_upper | actor.topmost_clothing.torso_lower'
      );
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result).sort()).toEqual(['pants1', 'shirt1']);
    });

    it('should work with filters and unions', () => {
      actorEntity.components.set('inventory:items', {
        items: [
          { id: 'sword1', type: 'weapon' },
          { id: 'shield1', type: 'armor' },
          { id: 'potion1', type: 'consumable' },
        ],
      });

      actorEntity.components.set('equipment:equipped', {
        weapon: 'sword2',
      });

      const ast = engine.parse(
        'actor.inventory[{"==": [{"var": "type"}, "weapon"]}] | actor.equipped.weapon'
      );
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result).sort()).toEqual(['sword1', 'sword2']);
    });

    it('should handle nested unions with parentheses simulation', () => {
      // Since we don't have parentheses, test right-associativity
      actorEntity.components.set('test:data', {
        a: ['a1'],
        b: ['b1'],
        c: ['c1'],
        d: ['d1'],
      });

      // This parses as: a | (b | (c | d))
      const ast = engine.parse('actor.a | actor.b | actor.c | actor.d');
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result).sort()).toEqual(['a1', 'b1', 'c1', 'd1']);
    });
  });

  describe('Error handling', () => {
    it('should handle invalid fields in union gracefully', () => {
      const ast = engine.parse('actor.nonexistent | actor.followers');
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      // Should return only the valid results
      expect(Array.from(result)).toEqual(['follower1', 'follower2']);
    });

    it('should handle null actor entity appropriately', () => {
      const ast = engine.parse('actor.followers | actor.partners');

      expect(() => {
        engine.resolve(ast, null, runtimeCtx);
      }).toThrow();
    });
  });

  describe('Performance considerations', () => {
    it('should handle large unions efficiently', () => {
      // Create large sets
      const largeFollowers = Array.from({ length: 1000 }, (_, i) => `f${i}`);
      const largePartners = Array.from({ length: 1000 }, (_, i) => `p${i}`);

      actorEntity.components.set('social:relationships', {
        followers: largeFollowers,
        partners: largePartners,
      });

      const start = Date.now();
      const ast = engine.parse('actor.followers | actor.partners');
      const result = engine.resolve(ast, actorEntity, runtimeCtx);
      const duration = Date.now() - start;

      expect(result.size).toBe(2000);
      expect(duration).toBeLessThan(100); // Should complete in under 100ms
    });
  });
});
```

### Verification Steps

1. Run integration tests: `npm run test:integration -- unionOperator.test.js`
2. Verify all scenarios pass
3. Check performance test completes quickly
4. Run full test suite to ensure no regression

### Acceptance Criteria

- [ ] Pipe operator works in real resolution scenarios
- [ ] Results identical to plus operator
- [ ] Deduplication works correctly
- [ ] Complex queries supported
- [ ] Performance acceptable for large sets
- [ ] Error handling appropriate

---

## Ticket 1.4: Documentation Updates for Union Operator

**Files**: Multiple documentation files  
**Time Estimate**: 1 hour  
**Dependencies**: Tickets 1.1-1.3  
**Complexity**: Trivial

### Description

Update all relevant documentation to include the new pipe operator syntax for unions.

### Implementation Details

#### Update 1: Scope DSL Documentation

Create or update `docs/scope-dsl.md`:

````markdown
## Union Operations

The Scope DSL supports combining results from multiple expressions using union operators.

### Syntax

You can use either the `+` or `|` operator to create unions:

```scope
# Using plus operator (original syntax)
actor.followers + actor.partners

# Using pipe operator (new alternative syntax)
actor.followers | actor.partners
```
````

Both operators produce identical results - they combine the results from both expressions into a single set, automatically removing duplicates.

### Examples

```scope
# Combine different clothing slots
actor.topmost_clothing.torso_upper | actor.topmost_clothing.torso_lower

# Combine entity queries
entities(core:actor) | entities(core:npc)

# Multiple unions (right-associative)
actor.followers | actor.partners | actor.friends

# Mixed with filters
actor.items[{"==": [{"var": "type"}, "weapon"]}] | actor.equipped
```

### Precedence

Union operators have the same precedence as each other and are right-associative. This means `a | b | c` is parsed as `a | (b | c)`.

````

#### Update 2: Parser JSDoc Comments

In `src/scopeDsl/parser/parser.js`, update the file header:

```javascript
/**
 * @file Scope-DSL Parser — *stable version*
 * @description Recursive-descent parser for the Scope-DSL that converts DSL expression
 * strings into AST objects. This parser is used to process the expressions defined
 * in `.scope` files.
 *
 * Supported union operators:
 * - '+' (plus) - Original union syntax
 * - '|' (pipe) - Alternative union syntax (produces identical behavior)
 *
 * ... rest of existing documentation ...
 */
````

#### Update 3: Example Scope Files

Create `data/examples/union-examples.scope`:

```scope
# Union Operator Examples
# Both + and | operators work identically

# Social relationships - combine different relationship types
all_connections := actor.followers | actor.partners | actor.friends
close_connections := actor.partners + actor.family

# Clothing combinations - useful for outfit checks
visible_clothing := actor.topmost_clothing.torso_upper | actor.topmost_clothing.torso_lower | actor.topmost_clothing.head
all_armor := actor.outer_clothing[{"in": ["armor", {"var": "tags"}]}] | actor.equipped.armor

# Entity queries - combine different entity types
all_characters := entities(core:actor) | entities(core:npc)
all_items := entities(core:item) | entities(core:container) | entities(core:weapon)

# Complex filters with unions
valuable_items := actor.inventory[{">": [{"var": "value"}, 100]}] | actor.equipped[{">": [{"var": "value"}, 100]}]
```

#### Update 4: CLAUDE.md Addition

Add to the Scope DSL section:

```markdown
### Scope DSL Syntax

The Scope DSL supports the following operators:

- `.` - Field access (e.g., `actor.name`)
- `[]` - Array iteration (e.g., `actor.items[]`)
- `[{...}]` - JSON Logic filters (e.g., `actor.items[{"==": [{"var": "type"}, "weapon"]}]`)
- `+` or `|` - Union operators (e.g., `actor.followers | actor.partners`)
- `:` - Component namespacing (e.g., `core:actor`)

Note: Both `+` and `|` produce identical union behavior. Use whichever feels more natural.
```

### Verification Steps

1. Review all documentation updates for accuracy
2. Ensure examples are syntactically correct
3. Test example expressions in the engine
4. Check for consistent terminology

### Acceptance Criteria

- [ ] Scope DSL documentation includes pipe operator
- [ ] Examples demonstrate both operators
- [ ] JSDoc comments updated
- [ ] CLAUDE.md reflects new syntax
- [ ] Migration notes included

---

## Ticket 1.5: Add Scope Linting for Union Operator

**File**: `src/scopeDsl/scopeDefinitionParser.js` (if linting exists)  
**Time Estimate**: 1 hour  
**Dependencies**: Tickets 1.1-1.3  
**Complexity**: Low

### Description

Update any scope file linting or validation to recognize the pipe operator as valid syntax.

### Implementation Details

If there's a linting system, update it. If not, ensure the scope loader handles the new syntax:

```javascript
// In any validation functions
const VALID_OPERATORS = ['+', '|', '.', ':', '[', ']'];

// Ensure pipe is recognized as valid
function validateOperator(op) {
  if (!VALID_OPERATORS.includes(op)) {
    throw new Error(`Invalid operator: ${op}`);
  }
}
```

### Test for Scope Loading

```javascript
import { describe, it, expect } from '@jest/globals';
import { loadScopeFile } from '../../../src/scopeDsl/scopeLoader.js';

describe('Scope Loader - Pipe Operator Support', () => {
  it('should load scope files with pipe operators', () => {
    const scopeContent = `
      # Test scope with pipe operators
      union_example := actor.a | actor.b
      mixed_example := actor.c + actor.d | actor.e
    `;

    const result = loadScopeFile(scopeContent, 'test.scope');

    expect(result.definitions).toHaveProperty('union_example');
    expect(result.definitions).toHaveProperty('mixed_example');
  });
});
```

### Verification Steps

1. Test loading scope files with pipe operators
2. Run `npm run scope:lint` if it exists
3. Verify no validation errors for valid pipe usage

### Acceptance Criteria

- [ ] Scope files with pipes load successfully
- [ ] No false validation errors
- [ ] Linting recognizes pipe as valid

---

## Phase 1 Summary

### Deliverables Checklist

- [ ] Tokenizer recognizes `|` character
- [ ] Parser creates Union nodes for pipe operator
- [ ] Integration tests pass
- [ ] Documentation updated
- [ ] No breaking changes to existing functionality

### Final Verification

1. Run full test suite: `npm run test:ci`
2. Run linting: `npm run lint`
3. Run type checking: `npm run typecheck`
4. Manual test with example scope files
5. Verify both `+` and `|` work identically

### Time Summary

- Ticket 1.1: 1 hour (Tokenizer)
- Ticket 1.2: 2 hours (Parser)
- Ticket 1.3: 2 hours (Integration tests)
- Ticket 1.4: 1 hour (Documentation)
- Ticket 1.5: 1 hour (Linting/validation)
- **Total: 7 hours**

### Next Phase

Once all Phase 1 tickets are complete and verified, proceed to [Phase 2: Enhanced Filter Syntax](./scope-dsl-union-filter-phase2-enhanced-filters.workflow.md)
