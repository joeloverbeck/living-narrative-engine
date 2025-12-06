# HARMODREF-025: Review and Refactor Core Mod References

**Priority:** P2 - LOW
**Effort:** 1 week
**Status:** Not Started

## Report Reference

[reports/hardcoded-mod-references-analysis.md](../reports/hardcoded-mod-references-analysis.md) - "Core References Requiring Review (20 references)"

## Problem Statement

Review and refactor 20 core mod references that enforce potentially unnecessary constraints. Make validation rules configurable based on entity types.

## Affected Files

1. `src/validation/entityValidator.js`
2. `src/entities/registries/entityTypeRegistry.js` (new)
3. `data/schemas/entity-type.schema.json` (new)
4. Test files

## Implementation

### EntityTypeRegistry

```javascript
export class EntityTypeRegistry {
  register(entityType, definition) {
    // definition: { requiredComponents: [], optional: [] }
  }

  getRequiredComponents(entityType) {
    const def = this.get(entityType);
    return def?.requiredComponents || ['core:name', 'core:description'];
  }
}
```

### EntityValidator Refactored

```javascript
// OLD
const requiredCoreComponents = ['core:name', 'core:description', 'core:tags'];

// NEW
const entityTypeDef = this.#entityTypeRegistry.get(entity.type);
const requiredComponents = entityTypeDef.requiredComponents || [];
```

## Entity Type Categories

1. **Standard Entities** - Full requirements (name, description, tags)
2. **Abstract Entities** - Minimal requirements (ID only)
3. **System Entities** - No UI requirements

## Acceptance Criteria

- [ ] EntityTypeRegistry created
- [ ] Entity type schema defined
- [ ] Validation uses entity type definitions
- [ ] Abstract/system entities validated
- [ ] Tests pass with >85% coverage
- [ ] Entity creation guide updated

## Dependencies

HARMODREF-011 (registry pattern established)
