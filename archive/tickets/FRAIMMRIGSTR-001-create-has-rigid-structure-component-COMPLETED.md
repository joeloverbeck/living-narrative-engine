# FRAIMMRIGSTR-001: Create `anatomy:has_rigid_structure` Component Schema

## Summary
Create the new marker component that indicates a body part contains rigid internal structure (bones, cartilage, chitin, etc.) that can be fractured.

## Background
Currently, the fracture system has no mechanism to determine whether a body part can structurally fracture. This component provides that capability using a positive marker pattern (presence = can fracture).

## File List

### Files to Create
- `data/mods/anatomy/components/has_rigid_structure.component.json`

### Files to Modify
- `data/mods/anatomy/mod-manifest.json` (register new component)

### Reference Files (read-only)
- `data/mods/anatomy/components/embedded.component.json` (pattern reference)

## Out of Scope
- **DO NOT** modify `src/anatomy/applicators/fractureApplicator.js` (FRAIMMRIGSTR-002)
- **DO NOT** add new integration or E2E tests (FRAIMMRIGSTR-003, FRAIMMRIGSTR-006, FRAIMMRIGSTR-007)
- **DO NOT** modify any entity definition files (FRAIMMRIGSTR-004, FRAIMMRIGSTR-005)

## Implementation Details

Create the component schema with:
- `id`: `"anatomy:has_rigid_structure"`
- `description`: Marks a body part as containing rigid internal structure (bones, cartilage, carapace, etc.) that can be fractured under sufficient trauma.
- `dataSchema.properties.structureType`:
  - type: `"string"`
  - enum: `["bone", "cartilage", "chitin", "carapace", "exoskeleton", "shell"]`
  - default: `"bone"`
  - description: "The type of rigid structure. Used for narrative purposes."
- `dataSchema.additionalProperties`: `false`
- `dataSchema.type`: `"object"`

The component should allow empty objects `{}` as valid data (defaults to bone).

## Acceptance Criteria

### Tests That Must Pass
```bash
npm run validate
```
- Schema validation must pass with zero errors
- The component must be loadable by the mod system

### Notes on Test Scope
- This ticket only adds a data file, so schema validation is the only required suite here.

### Invariants That Must Remain True
- All existing anatomy components continue to load
- The new component follows the same pattern as `anatomy:embedded`

## Estimated Diff Size
~15 lines (single new JSON file)

## Dependencies
None - this is the foundational ticket.

## Blocked By
None

## Blocks
- FRAIMMRIGSTR-002 (needs component to check for)
- FRAIMMRIGSTR-004 (needs component to add to entities)
- FRAIMMRIGSTR-005 (needs component to add to entities)

## Status
- [x] Completed

## Outcome
- Added the component schema and registered it in the anatomy mod manifest to keep validation clean.
- Trimmed test assumptions to the schema validation run required for a data-only change.
