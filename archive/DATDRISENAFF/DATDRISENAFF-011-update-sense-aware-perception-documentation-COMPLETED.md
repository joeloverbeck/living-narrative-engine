# DATDRISENAFF-011: Update Sense-Aware Perception Documentation

## Description

Add section on sensory affordance components to the modding documentation to help modders create custom sensory organs.

## Status

Completed (2025-12-17).

## Files to Touch

### MODIFY
- `docs/modding/sense-aware-perception.md`
- `tests/unit/docs/senseAwarePerceptionDocumentation.test.js`

## Out of Scope

- Do NOT modify production code files (`src/`)
- Do NOT modify entity files
- Do NOT create new documentation files
- Do NOT modify other documentation files

Note: Adding/adjusting tests is in scope to keep the documentation examples correct over time.

## Implementation Details

### New Section to Add

Add a new section "Sensory Affordance Components" to the documentation:

```markdown
## Sensory Affordance Components

Body parts that provide sensory capabilities must include the appropriate affordance marker component:

- `anatomy:provides_sight` - Enables visual perception
- `anatomy:provides_hearing` - Enables auditory perception
- `anatomy:provides_smell` - Enables olfactory perception

### Adding Sensory Affordances to Custom Body Parts

When creating custom sensory organs, add the appropriate affordance component:

```json
{
  "id": "my-mod:crystal_eye",
  "components": {
    "anatomy:part": { "subType": "crystal_eye", ... },
    "anatomy:part_health": { ... },
    "anatomy:provides_sight": {}
  }
}
```

### Multi-Sensory Organs

Multiple affordances can be added to multi-sensory organs:

```json
{
  "id": "my-mod:sensory_tentacle",
  "components": {
    "anatomy:part": { "subType": "tentacle", ... },
    "anatomy:provides_sight": {},
    "anatomy:provides_smell": {}
  }
}
```

### Important Notes

- The `subType` value in `anatomy:part` can be any descriptive string
- Sensory capability is determined by the presence of affordance components, not by subType name
- A body part is considered functional if it is not destroyed and not dismembered
- Manual override via `perception:sensory_capability` component takes precedence
```

### Placement

The current document does not have a dedicated "sensory capability detection" section. Add the new section immediately after the overview (where anatomy-driven sensory capability is introduced) and before the rule-authoring sections (e.g., “Adding Alternate Descriptions”).

## Acceptance Criteria

### Tests That Must Pass
- Documentation renders correctly in markdown viewers
- New code examples added by this ticket are syntactically valid JSON
- A unit test validates the JSON examples in the new section
- Links to referenced components work (if any)

### Invariants That Must Remain True
- Existing documentation content must remain unchanged (except for insertion of the new section)
- Document structure must follow existing patterns
- Code examples in the new section must be copy-pasteable and functional

## Risk Assessment

**Low Risk** - Documentation change plus a small documentation-focused test; no runtime behavior changes.

## Dependencies

- DATDRISENAFF-001 must be completed (components must exist to document)
- DATDRISENAFF-002 must be completed (behavior must be implemented to document)

## Estimated Diff Size

~50 lines

## Outcome

- Added “Sensory Affordance Components” to `docs/modding/sense-aware-perception.md`, using valid JSON entity-definition examples aligned with `specs/data-driven-sensory-affordances.spec.md`.
- Updated scope to include a small unit test that ensures the new JSON examples remain syntactically valid; no production/runtime code changes were required.
