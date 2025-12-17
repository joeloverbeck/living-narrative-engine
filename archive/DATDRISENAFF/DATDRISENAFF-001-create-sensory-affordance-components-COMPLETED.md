# DATDRISENAFF-001: Create Sensory Affordance Components

## Description

Create the three marker component definitions (`anatomy:provides_sight`, `anatomy:provides_hearing`, `anatomy:provides_smell`) and update the anatomy mod manifest so they can be referenced by body-part entities.

Reference spec: `specs/data-driven-sensory-affordances.spec.md`

## Status

- [ ] In Progress
- [x] Completed

## Files to Touch

### CREATE
- `data/mods/anatomy/components/provides_sight.component.json`
- `data/mods/anatomy/components/provides_hearing.component.json`
- `data/mods/anatomy/components/provides_smell.component.json`

### MODIFY
- `data/mods/anatomy/mod-manifest.json` - Add component references to `content.components` array

## Out of Scope

- Do NOT modify any entity files
- Do NOT modify any service code (SensoryCapabilityService)
- Do NOT touch anatomy-creatures mod
- Do NOT modify any other existing components

## Implementation Details

### Component Schema Format

Each component should follow this structure (matches the spec; note that not all legacy components include `$schema`, but these new ones should):

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "anatomy:provides_[sense]",
  "description": "Marker component indicating this body part enables [visual|auditory|olfactory] perception when functioning",
  "dataSchema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
```

### Manifest Update

Add to the `content.components` array in `mod-manifest.json`:
```json
"provides_sight.component.json",
"provides_hearing.component.json",
"provides_smell.component.json"
```

## Acceptance Criteria

### Validation That Must Pass
- `npm run validate` passes with new components (schema + mod manifest references)
- `npm run validate:ecosystem` passes (cross-mod reference checks)

### Notes on Repo Typechecking
- As of this ticket, `npm run typecheck` fails repo-wide due to existing TypeScript issues in JS sources (out of scope for this data-only change). This ticket does not attempt to remediate those failures.

### Runtime Check
- Components are loadable by the mod loading system (covered indirectly by `npm run validate` + manifest correctness)

### Invariants That Must Remain True
- Existing anatomy components must remain unchanged
- Manifest must maintain valid JSON structure
- All other mod content continues to load correctly
- Component IDs follow the `anatomy:provides_[sense]` naming convention

## Risk Assessment

**Low Risk** - Simple JSON file creation with no logic changes.

## Dependencies

None - this is the foundation ticket.

## Estimated Diff Size

~50 lines across 4 files

## Outcome

- Created 3 new marker component definitions:
  - `data/mods/anatomy/components/provides_sight.component.json`
  - `data/mods/anatomy/components/provides_hearing.component.json`
  - `data/mods/anatomy/components/provides_smell.component.json`
- Registered the new component files in `data/mods/anatomy/mod-manifest.json` (`content.components`).
- Validation results:
  - `npm run validate` passes (with an unrelated pre-existing warning about one unregistered anatomy lookup file).
  - `npm run validate:ecosystem` passes.
  - `npm run typecheck` is currently failing repo-wide (pre-existing; out of scope for this data-only ticket).
