# HARMODREF-022: Migrate Scope DSL to Plugin Architecture

**Priority:** P2 - MEDIUM
**Effort:** 2 weeks
**Status:** Not Started

## Report Reference

[reports/hardcoded-mod-references-analysis.md](../reports/hardcoded-mod-references-analysis.md) - "Scope DSL Hardcoding"

## Problem Statement

Migrate scope DSL relationship resolution from hardcoded logic to plugin-based system. Convert straddling logic to relationship resolver plugin.

## Affected Files

1. `src/scopeDsl/nodes/slotAccessResolver.js` (major refactor)
2. `data/mods/positioning/plugins/straddlingRelationshipResolver.js` (new)
3. `data/mods/positioning/mod-manifest.json` (add plugin)
4. `examples/mods/custom_relationships/` (example custom plugin)
5. Test files

## Implementation

### StraddlingRelationshipResolver Plugin

```javascript
export class StraddlingRelationshipResolver extends BaseRelationshipResolverPlugin {
  constructor({ entityManager, logger }) {
    super({ entityManager, logger });
  }

  canResolve(entityId, relationship) {
    return (
      relationship === 'straddling' &&
      this.entityManager.hasComponent(entityId, 'positioning:straddling')
    );
  }

  resolve(entityId, relationship) {
    const straddlingComp = this.entityManager.getComponent(
      entityId,
      'positioning:straddling'
    );
    return [straddlingComp.targetId];
  }
}
```

### SlotAccessResolver Refactored

```javascript
class SlotAccessResolver {
  #pluginManager;

  resolve(entityId, slotName) {
    const plugin = this.#pluginManager.findPlugin('relationshipResolver', (p) =>
      p.canResolve(entityId, slotName)
    );

    if (plugin) {
      return plugin.resolve(entityId, slotName);
    }

    return [];
  }
}
```

## Acceptance Criteria

- [ ] Straddling logic moved to plugin
- [ ] No hardcoded relationship logic in scope DSL
- [ ] Plugin registered via mod manifest
- [ ] Custom relationship plugins work
- [ ] All tests pass with >85% coverage
- [ ] Example custom plugin documented

## Dependencies

HARMODREF-021 (plugin infrastructure must exist)
