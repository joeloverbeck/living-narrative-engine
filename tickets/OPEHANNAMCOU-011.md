# OPEHANNAMCOU-011: Create cross-mod dependency validation test

## Summary

Create a test that validates cross-mod component references respect mod dependency declarations. Handlers should only reference components from mods they explicitly depend on.

## Files to Touch

- `tests/integration/validation/crossModDependency.test.js` (NEW FILE)

## Out of Scope

- DO NOT modify any handler source files
- DO NOT modify mod manifests
- DO NOT modify existing tests
- DO NOT modify constants files

## Changes

Create test validating cross-mod component references:

### Test Structure

```javascript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('Cross-Mod Dependency Validation', () => {
  describe('Valid Cross-Mod References', () => {
    it('allows cross-mod component references with explicit dependency', () => {
      // Scenario: Handler in mod A references component from mod B
      // mod A's manifest declares dependency on mod B
      // Validation should pass

      const modAManifest = {
        id: 'mod_a',
        dependencies: ['mod_b'],
      };

      const modBComponents = ['mod_b:some_component'];

      // Handler in mod_a uses 'mod_b:some_component'
      const result = validateCrossModReference(
        'mod_b:some_component',
        modAManifest,
        modBComponents
      );

      expect(result.valid).toBe(true);
    });

    it('allows references to core mod without explicit dependency', () => {
      // Core mod is implicitly available to all mods
      const modManifest = {
        id: 'my_mod',
        dependencies: [],
      };

      const result = validateCrossModReference(
        'core:actor',
        modManifest,
        ['core:actor']
      );

      expect(result.valid).toBe(true);
    });
  });

  describe('Invalid Cross-Mod References', () => {
    it('rejects cross-mod references without declared dependency', () => {
      // Scenario: Handler references component from undeclared mod
      const modManifest = {
        id: 'mod_a',
        dependencies: [], // No dependency on mod_b
      };

      const result = validateCrossModReference(
        'mod_b:some_component',
        modManifest,
        ['mod_b:some_component']
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('undeclared dependency');
      expect(result.error).toContain('mod_b');
    });

    it('provides suggestion to add dependency to manifest', () => {
      const modManifest = {
        id: 'mod_a',
        dependencies: [],
      };

      const result = validateCrossModReference(
        'mod_b:some_component',
        modManifest,
        ['mod_b:some_component']
      );

      expect(result.suggestion).toContain('add "mod_b" to dependencies');
    });
  });

  describe('Real-World Scenarios', () => {
    it('drinking handler can reference containers-core components', () => {
      // drinking mod depends on containers-core
      const drinkingManifest = {
        id: 'drinking',
        dependencies: ['containers-core'],
      };

      const result = validateCrossModReference(
        'containers-core:liquid_container',
        drinkingManifest,
        ['containers-core:liquid_container']
      );

      expect(result.valid).toBe(true);
    });

    it('validates all handler imports against mod dependencies', async () => {
      // For each handler, verify all imported component IDs
      // come from either:
      // 1. The handler's own mod
      // 2. A declared dependency
      // 3. The core mod

      // This test should scan actual handlers and manifests
    });
  });

  describe('Transitive Dependencies', () => {
    it('allows references through transitive dependencies', () => {
      // mod_a depends on mod_b, mod_b depends on mod_c
      // mod_a should be able to reference mod_c components
      // (Or not - depending on policy decision)

      // Document the expected behavior
    });
  });
});
```

## Acceptance Criteria

### Tests That Must Pass

- `NODE_ENV=test npx jest tests/integration/validation/crossModDependency.test.js --no-coverage` passes
- `npx eslint tests/integration/validation/crossModDependency.test.js` passes

### Invariants

- Test validates mod dependency chain is respected
- Test ensures explicit cross-mod references are documented
- Test provides actionable error messages
- Test handles core mod as implicit dependency
- Test scans real mod manifests and handlers (not just mocks)

## Dependencies

None - this test can be implemented independently

## Implementation Order

Phase 4: Validation Tests (can be done in parallel with other Phase 4 tickets)

## Notes

This test addresses the edge case from the spec: "Cross-mod references: Handlers in mod A referencing components from mod B should use the B mod's namespace explicitly and document the dependency."

The test should help developers understand:
1. Why cross-mod references require explicit dependencies
2. How to properly declare dependencies in mod-manifest.json
3. What happens when a dependency is missing

Consider whether transitive dependencies should be allowed (mod_a → mod_b → mod_c means mod_a can use mod_c?) and document the decision.
