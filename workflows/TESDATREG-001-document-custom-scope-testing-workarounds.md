# TESDATREG-001: Document Custom Scope Testing Workarounds

**Priority**: High
**Category**: Documentation
**Timeline**: Short-term (Immediate)
**Effort**: Small (2-4 hours)
**Related Report**: reports/test-dataregistry-scope-dsl-issues.md

## Overview

Add comprehensive documentation to the mod testing guide explaining how to test custom mod-specific scopes that reference conditions from dependency mods. This will help developers understand the current workaround patterns and avoid the confusion encountered during `sex-anal-penetration` mod testing.

## Problem Statement

Currently, testing mods with custom scopes that use `condition_ref` to reference conditions from dependency mods requires manual workarounds that are not well-documented. Developers must:

1. Manually load the dependency condition file
2. Extend the `dataRegistry.getConditionDefinition` mock
3. Manually register the custom scope with ScopeEngine

This process is fragile and requires understanding of internal implementation details. Without clear documentation, developers waste time debugging issues that could be avoided with proper guidance.

## Success Criteria

- [ ] New section added to `docs/testing/mod-testing-guide.md` explaining custom scope testing patterns
- [ ] Clear distinction documented between:
  - Standard scopes (auto-registered with `autoRegisterScopes`)
  - Custom mod-specific scopes (require manual setup)
- [ ] Complete working example provided for loading dependency conditions
- [ ] Pattern documented for extending `dataRegistry.getConditionDefinition` mock
- [ ] Example provided for manual scope registration with ScopeEngine
- [ ] Best practices section added with code comments template
- [ ] Troubleshooting section added for common errors

## Implementation Details

### File to Modify

**Target**: `docs/testing/mod-testing-guide.md`

### New Section Structure

Add a new section after the existing scope testing content:

```markdown
## Testing Custom Mod-Specific Scopes

### Overview

When your mod defines custom scopes (`.scope` files) that reference conditions from dependency mods using `condition_ref`, you need to manually set up these dependencies in your tests.

### When to Use This Pattern

- ✅ Your mod has custom `.scope` files in `data/mods/your-mod/scopes/`
- ✅ These scopes use `{"condition_ref": "dependency-mod:condition-id"}`
- ✅ The scopes are mod-specific, not general positioning/inventory/anatomy scopes
- ❌ Not needed for standard scopes (use `autoRegisterScopes: true` instead)

### Step-by-Step Setup

**Required imports**:
```javascript
import fs from 'fs';
import path from 'path';
import { parseScopeDefinitions } from '../../../../src/scopeDsl/scopeDefinitionParser.js';
import ScopeEngine from '../../../../src/scopeDsl/engine.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
```

1. **Load dependency conditions** (if your scope uses `condition_ref`):
   ```javascript
   const positioningCondition = await import('path/to/condition.json', {
     assert: { type: 'json' }
   });
   ```

2. **Extend dataRegistry mock** to return dependency conditions:
   ```javascript
   const originalGetCondition = testFixture.testEnv.dataRegistry.getConditionDefinition;
   testFixture.testEnv.dataRegistry.getConditionDefinition = jest.fn((conditionId) => {
     if (conditionId === 'dependency-mod:condition-id') {
       return positioningCondition.default;
     }
     return originalGetCondition(conditionId);
   });
   ```

3. **Load and parse your custom scope**:
   ```javascript
   const scopePath = path.join(process.cwd(), 'data/mods/your-mod/scopes/your-scope.scope');
   const scopeContent = fs.readFileSync(scopePath, 'utf-8');
   const parsedScopes = parseScopeDefinitions(scopeContent, scopePath);
   ```

4. **Create ScopeEngine and register resolver**:
   ```javascript
   const scopeEngine = new ScopeEngine();

   for (const [scopeName, scopeAst] of parsedScopes) {
     const scopeResolver = (context) => {
       const runtimeCtx = {
         entityManager: testFixture.testEnv.entityManager,
         jsonLogicEval: testFixture.testEnv.jsonLogic,
         logger: testFixture.testEnv.logger,
       };

       const result = scopeEngine.resolve(scopeAst, context, runtimeCtx);
       return { success: true, value: result };
     };

     ScopeResolverHelpers._registerResolvers(
       testFixture.testEnv,
       testFixture.testEnv.entityManager,
       { [scopeName]: scopeResolver }
     );
   }
   ```

**See complete working example**: `tests/integration/mods/sex-anal-penetration/insert_finger_into_asshole_action_discovery.test.js` (lines 23-69)

### Best Practices

[Document the recommended comment pattern]

### Troubleshooting

[Common errors and solutions]
```

### Content to Include

1. **Clear distinction between scope types**:
   - Standard scopes (positioning, inventory, anatomy) → use `autoRegisterScopes`
   - Custom mod scopes → use manual pattern
   - Include decision flowchart in prose

2. **Complete working example** from the passing tests:
   - Reference: `tests/integration/mods/sex-anal-penetration/insert_finger_into_asshole_action_discovery.test.js`
   - Include lines 37-69 (manual scope registration pattern)
   - Include the dependency condition loading pattern (lines 23-35)

3. **Code comment template**:
   ```javascript
   /**
    * This action uses custom scopes that reference:
    * - positioning:actor-in-entity-facing-away (condition) - must be loaded manually
    * - positioning:close_actors (scope) - auto-registered with autoRegisterScopes
    */
   ```

4. **Common error scenarios**:
   - "Resolver for scope X not found" → forgot to register custom scope
   - "Condition Y is undefined" → forgot to load dependency condition
   - "hasPartOfType is not a function" → NOT an issue with ModTestFixture, custom operators auto-register during fixture initialization via JsonLogicCustomOperators service

5. **Pattern comparison table**:

   | Scenario | Method | Setup Required |
   |----------|--------|----------------|
   | Standard positioning scopes | `autoRegisterScopes: true, scopeCategories: ['positioning']` | None |
   | Custom mod scopes (no deps) | Manual registration | Load scope, register resolver |
   | Custom mod scopes (with deps) | Manual registration + mock extension | Load scope, load conditions, extend mock, register resolver |

### Key Implementation Details

**ScopeEngine Pattern**:
- The test creates a NEW `ScopeEngine` instance (not accessing an existing one)
- Signature: `scopeEngine.resolve(ast, actorEntity, runtimeCtx, trace = null)`
  - `ast`: Parsed scope AST from `parseScopeDefinitions()`
  - `actorEntity`: Context object with actor/entity properties (e.g., `{ actor: { id: 'actor-id' } }`)
  - `runtimeCtx`: Runtime context with `{ entityManager, jsonLogicEval, logger }`
  - `trace`: Optional trace context (can be null)
- The resolver function wraps `scopeEngine.resolve()` and returns `{ success: true, value: result }`

**Custom Operators**:
- Custom operators (`hasPartOfType`, `hasClothingInSlot`, etc.) are registered automatically
- Registration happens during DI initialization via `JsonLogicCustomOperators` service
- In ModTestFixture tests, this occurs automatically during fixture initialization
- No manual registration needed in tests

### Files to Reference

- `tests/common/mods/scopeResolverHelpers.js` - Available helper methods and `_registerResolvers()`
- `tests/integration/mods/sex-anal-penetration/insert_finger_into_asshole_action_discovery.test.js` - Complete working example
- `src/scopeDsl/engine.js` - ScopeEngine API reference
- `src/scopeDsl/scopeDefinitionParser.js` - `parseScopeDefinitions()` function
- `src/logic/jsonLogicCustomOperators.js` - Custom operator registration

## Validation Steps

1. Review documentation with a developer unfamiliar with scope testing
2. Have them implement a test using the documented pattern
3. Verify they can complete the task without additional guidance
4. Check that all code examples are syntactically correct
5. Ensure cross-references to other docs are accurate

## Acceptance Tests

- [ ] Documentation includes 3+ complete code examples
- [ ] Decision tree/flowchart helps developers choose the right pattern
- [ ] Troubleshooting section covers all 3 common error scenarios
- [ ] Pattern comparison table clearly shows when to use each approach
- [ ] Code examples are copy-paste ready (no placeholders)
- [ ] All referenced files and line numbers are accurate (verified: lines 23-69 in test file)
- [ ] New section is discoverable in table of contents
- [ ] ScopeEngine.resolve signature documented with all 4 parameters
- [ ] Key Implementation Details section explains the ScopeEngine pattern clearly
- [ ] Custom operator auto-registration explained with reference to JsonLogicCustomOperators
- [ ] Required imports list is complete and accurate

## Dependencies

None - this is documentation only

## Related Tickets

- TESDATREG-002 (will add convenience method, reducing need for manual pattern)
- TESDATREG-004 (will add helper for custom scope registration)

## Notes

- This documentation captures the current state and working patterns
- Future tickets will add convenience methods to reduce boilerplate
- Documentation should note that these are temporary workarounds
- Include a "Future Improvements" section mentioning upcoming helper methods
- Mark manual patterns as "Current Workaround" with link to TESDATREG-002

## Implementation Checklist

- [ ] Create new section "Testing Custom Mod-Specific Scopes"
- [ ] Add "When to Use This Pattern" decision guide
- [ ] Include complete 4-step setup guide with code examples
- [ ] Add required imports list (fs, path, parseScopeDefinitions, ScopeEngine, ScopeResolverHelpers)
- [ ] Document ScopeEngine.resolve signature with all 4 parameters
- [ ] Add pattern comparison table
- [ ] Document dependency condition loading pattern (step 1-2)
- [ ] Document scope loading and registration pattern (step 3-4)
- [ ] Add code comment template for documenting dependencies
- [ ] Create troubleshooting section with common errors
- [ ] Add "Key Implementation Details" section explaining:
  - ScopeEngine pattern (creating new instance, not accessing existing)
  - Custom operator auto-registration via JsonLogicCustomOperators
- [ ] Add cross-references to helper files (with new references to scopeDefinitionParser.js and jsonLogicCustomOperators.js)
- [ ] Include "Future Improvements" section
- [ ] Update table of contents
- [ ] Verify all code examples are syntactically correct
- [ ] Verify line number references (lines 23-69 confirmed)
- [ ] Test examples by copying into a real test file
