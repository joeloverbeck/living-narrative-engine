# HARMODREF-017: Refactor SlotAccessResolver Positioning Logic

**Priority:** P1 - HIGH
**Effort:** 3 days
**Status:** Not Started

## Report Reference
[reports/hardcoded-mod-references-analysis.md](../reports/hardcoded-mod-references-analysis.md) - "Scope DSL Hardcoding"

## Problem Statement
Refactor slotAccessResolver.js to use plugin-based relationship resolution instead of hardcoded straddling logic.

## Affected Files
1. `src/scopeDsl/nodes/slotAccessResolver.js`
2. `src/scopeDsl/plugins/relationshipResolverPlugin.js` (new base class)
3. `src/scopeDsl/plugins/straddlingRelationshipResolver.js` (new implementation)
4. `src/dependencyInjection/tokens/tokens-core.js`
5. `src/dependencyInjection/registrations/scopeDslRegistrations.js` (new)
6. Test files

## Design

Base Plugin:
```javascript
class RelationshipResolverPlugin {
  canResolve(entityId, relationship) { }
  resolve(entityId, relationship) { }
}
```

SlotAccessResolver:
```javascript
const relatedIds = this.#relationshipPlugins
  .find(p => p.canResolve(entityId, slotName))
  ?.resolve(entityId, slotName) || [];
```

## Acceptance Criteria
- [ ] RelationshipResolverPlugin base class created
- [ ] Straddling logic extracted to plugin
- [ ] No hardcoded positioning:straddling references
- [ ] Plugin collection supported
- [ ] Tests pass with >85% coverage

## Dependencies
HARMODREF-011 (registry pattern established)
