# TORPERANAREC-014: Update Anatomy Mod Manifest

## Objective
Add all new tortoise-person files to the anatomy mod manifest.

## Dependencies
- **REQUIRES**: TORPERANAREC-001 (structure template created)
- **REQUIRES**: TORPERANAREC-002 (blueprint created)
- **REQUIRES**: TORPERANAREC-003 through TORPERANAREC-011 (all 11 entity definitions created)
- **REQUIRES**: TORPERANAREC-013 (recipe created)

## Files to Touch
- **MODIFY**: `data/mods/anatomy/mod-manifest.json`

## Out of Scope
- Do NOT modify other sections of the manifest (components, actions, etc.)
- Do NOT remove existing entries
- Do NOT change manifest metadata (id, version, name, etc.)
- Do NOT create new files

## Implementation Details

### File: `mod-manifest.json` (modifications only)

Add to existing arrays:

1. **structureTemplates** array:
   - Add: `"structure-templates/structure_tortoise_biped.structure-template.json"`

2. **blueprints** array:
   - Add: `"blueprints/tortoise_person.blueprint.json"`

3. **entities** array (11 new entries in alphabetical order):
   - Add: `"entities/definitions/tortoise_arm.entity.json"`
   - Add: `"entities/definitions/tortoise_beak.entity.json"`
   - Add: `"entities/definitions/tortoise_carapace.entity.json"`
   - Add: `"entities/definitions/tortoise_eye.entity.json"`
   - Add: `"entities/definitions/tortoise_foot.entity.json"`
   - Add: `"entities/definitions/tortoise_hand.entity.json"`
   - Add: `"entities/definitions/tortoise_head.entity.json"`
   - Add: `"entities/definitions/tortoise_leg.entity.json"`
   - Add: `"entities/definitions/tortoise_plastron.entity.json"`
   - Add: `"entities/definitions/tortoise_tail.entity.json"`
   - Add: `"entities/definitions/tortoise_torso_with_shell.entity.json"`

4. **recipes** array:
   - Add: `"recipes/tortoise_person.recipe.json"`

### Important Notes

1. **Alphabetical Order**: Insert entries in alphabetical order within each array
2. **Path Format**: Use relative paths from mod root (no leading slash)
3. **Consistent Naming**: Paths must match actual file names exactly
4. **JSON Syntax**: Ensure proper comma placement (no trailing comma on last item)

## Acceptance Criteria

### Tests that must pass:
1. `npm run validate` - Schema validation passes
2. Manifest validates against mod-manifest schema
3. All referenced files exist at specified paths
4. JSON is well-formed and parseable
5. `npm run update-manifest` - Runs without errors (if applicable)

### Invariants that must remain true:
1. No existing manifest entries are removed
2. No existing manifest entries are modified
3. Manifest structure remains unchanged (same top-level keys)
4. All file paths are relative to mod root
5. All paths use forward slashes (not backslashes)
6. structureTemplates array contains exactly 1 new entry
7. blueprints array contains exactly 1 new entry
8. entities array contains exactly 11 new entries
9. recipes array contains exactly 1 new entry
10. Total additions: 14 new file references

## Validation Commands
```bash
npm run validate
npm run update-manifest  # If automatic manifest update is supported
```

## Definition of Done
- [ ] 1 structure template added to manifest
- [ ] 1 blueprint added to manifest
- [ ] 11 entity definitions added to manifest
- [ ] 1 recipe added to manifest
- [ ] All paths match actual file locations
- [ ] Entries in alphabetical order within sections
- [ ] JSON syntax is valid
- [ ] Validation passes without errors
- [ ] File committed with descriptive message
