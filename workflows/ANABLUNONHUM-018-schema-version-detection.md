# ANABLUNONHUM-018: Implement Schema Version Detection and Routing

**Phase**: 4 - Backward Compatibility
**Priority**: Critical
**Estimated Effort**: 6-8 hours
**Dependencies**: ANABLUNONHUM-009, ANABLUNONHUM-017

## Overview

Implement schema version detection to safely route blueprints through v1 or v2 processing paths.

## Implementation

```javascript
class BodyBlueprintFactory {
  #loadBlueprint(blueprintId) {
    const blueprint = this.#dataRegistry.get('anatomyBlueprints', blueprintId);
    if (!blueprint) {
      throw new InvalidArgumentError(
        `Blueprint '${blueprintId}' not found in registry`
      );
    }

    if (blueprint.schemaVersion === '2.0' && blueprint.structureTemplate) {
      return this.#processV2Blueprint(blueprint);
    }

    return blueprint; // V1 or schemaVersion omitted fall back to legacy handling
  }
}
```

> **Note**: `#processV2Blueprint` loads the referenced structure template from the
> `anatomyStructureTemplates` registry, generates sockets/slots, and merges them
> with any `additionalSlots` defined on the blueprint. See
> [`docs/anatomy/blueprints-v2.md`](../docs/anatomy/blueprints-v2.md) and
> [`docs/anatomy/structure-templates.md`](../docs/anatomy/structure-templates.md)
> for full context on V2 behavior.

## Environment Flags

No feature flag currently gates V2 blueprint processing. The factory routes to
`#processV2Blueprint` whenever both `schemaVersion === '2.0'` and
`structureTemplate` are present on the blueprint.

## Test Cases

- Blueprint missing `schemaVersion` continues through the legacy V1 path
- Blueprint explicitly marked `schemaVersion: '1.0'` loads without template
  processing
- Blueprint marked `schemaVersion: '2.0'` **and** providing `structureTemplate`
  routes through `#processV2Blueprint`
- `#processV2Blueprint` throws when referenced structure template is absent in
  the registry
- Generated slots from the structure template merge with `additionalSlots`
  (template-derived entries should not overwrite author-specified overrides)

## References

- **Source**: `reports/anatomy-blueprint-non-human-architecture.md` Phase 4, Section 7.3
