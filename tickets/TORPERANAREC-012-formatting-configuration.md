# TORPERANAREC-012: Add Tortoise Formatting Configuration

## Objective
Add all 11 tortoise part type descriptions and composition rules to the anatomy formatting configuration.

## Dependencies
- **REQUIRES**: TORPERANAREC-003 through TORPERANAREC-011 (all entity definitions should exist)

## Files to Touch
- **MODIFY**: `data/mods/anatomy/anatomy-formatting/default.json`

## Out of Scope
- Do NOT modify existing part type descriptions for other creatures
- Do NOT remove or change existing composition rules
- Do NOT modify the file structure or top-level keys
- Do NOT create new formatting files

## Implementation Details

### File: `default.json` (modifications only)

Add to **partTypeDescriptions** object (11 new entries):

1. **tortoise_torso**:
   - singular, plural, article, descriptivePatterns (3 patterns)

2. **shell_carapace**:
   - singular, plural, article, descriptivePatterns (3 patterns)
   - prominence: "high"

3. **shell_plastron**:
   - singular, plural, article, descriptivePatterns (3 patterns)
   - prominence: "medium"

4. **tortoise_head**:
   - singular, plural, article, descriptivePatterns (3 patterns)

5. **tortoise_beak**:
   - singular, plural, article, descriptivePatterns (3 patterns)
   - prominence: "high"

6. **tortoise_eye**:
   - singular, plural, article, descriptivePatterns (3 patterns)

7. **tortoise_arm**:
   - singular, plural, article, descriptivePatterns (3 patterns)

8. **tortoise_hand**:
   - singular, plural, article, descriptivePatterns (3 patterns)
   - clawMention: "prominent claws"

9. **tortoise_leg**:
   - singular, plural, article, descriptivePatterns (3 patterns)

10. **tortoise_foot**:
    - singular, plural, article, descriptivePatterns (3 patterns)
    - clawMention: "sharp claws"

11. **tortoise_tail**:
    - singular, plural, article, descriptivePatterns (3 patterns)

Add to **compositionRules** object (1 new entry):

**tortoise_person**:
  - bodyOverview: array of 3 template strings
  - limbDescription: array of 2 template strings
  - prominentFeatures: array of 4 strings

### Descriptor Template Variables

Ensure patterns use correct variable syntax:
- `{texture}` - from descriptors:texture
- `{color}` - from descriptors:color_extended
- `{pattern}` - from descriptors:pattern
- `{shape}` - from descriptors:shape_general
- `{build}` - from descriptors:build
- `{digit_count}` - from descriptors:digit_count
- `{projection}` - from descriptors:projection
- `{length}` - from descriptors:length_category
- `{height}` - from body descriptors
- `{shell_carapace}`, `{shell_plastron}`, etc. - part references

## Acceptance Criteria

### Tests that must pass:
1. `npm run validate` - Schema validation passes
2. JSON remains well-formed after additions
3. No syntax errors in template strings
4. All variable names match descriptor component properties

### Invariants that must remain true:
1. All existing partTypeDescriptions remain unchanged
2. All existing compositionRules remain unchanged
3. File structure and top-level keys unchanged
4. Part type keys match entity subTypes exactly
5. All descriptivePatterns arrays have exactly 3 entries
6. prominence values (if present) are "high", "medium", or omitted
7. clawMention fields only on hand and foot
8. Template variables use correct curly brace syntax: `{variable}`

## Validation Commands
```bash
npm run validate
```

## Definition of Done
- [ ] All 11 part type descriptions added
- [ ] tortoise_person composition rules added
- [ ] Template variables use correct syntax
- [ ] No existing entries modified
- [ ] JSON structure remains valid
- [ ] Validation passes without errors
- [ ] File committed with descriptive message
