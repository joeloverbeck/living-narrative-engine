# ANABLUNONHUM-018: Implement Schema Version Detection and Routing

**Phase**: 4 - Backward Compatibility
**Priority**: Critical
**Estimated Effort**: 6-8 hours
**Dependencies**: ANABLUNONHUM-009, ANABLUNONHUM-017

## Overview

Implement feature flag and version detection to safely route blueprints through v1 or v2 processing paths.

## Implementation

```javascript
class BodyBlueprintFactory {
  #loadBlueprint(blueprintId) {
    const blueprint = this.#dataRegistry.get('anatomyBlueprints', blueprintId);
    
    // Default to v1 if schemaVersion missing
    const version = blueprint.schemaVersion || '1.0';
    
    if (version === '2.0') {
      if (!blueprint.structureTemplate) {
        throw new ValidationError('V2 blueprints require structureTemplate');
      }
      return this.#processTemplatedBlueprint(blueprint);
    } else if (version === '1.0') {
      if (blueprint.structureTemplate) {
        throw new ValidationError('V1 blueprints cannot use structureTemplate');
      }
      return blueprint;  // Existing v1 path
    } else {
      throw new ValidationError(`Invalid schemaVersion: ${version}`);
    }
  }
}
```

## Feature Flag

Add environment variable: `ENABLE_STRUCTURE_TEMPLATES=true/false`

## Test Cases

- V1 blueprint (no schemaVersion) processes correctly
- V1 blueprint (explicit 1.0) processes correctly
- V2 blueprint routes to template processor
- Invalid version rejected
- Mixed features rejected
- Feature flag disables v2 processing

## References

- **Source**: `reports/anatomy-blueprint-non-human-architecture.md` Phase 4, Section 7.3
