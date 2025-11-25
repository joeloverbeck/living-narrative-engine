# WIECOM-002: Update Positioning Mod Manifest

## Summary

Register the new `wielding.component.json` in the positioning mod manifest.

## Dependencies

- WIECOM-001 must be completed first (component file must exist)

## Files to Touch

| File | Action | Description |
|------|--------|-------------|
| `data/mods/positioning/mod-manifest.json` | MODIFY | Add wielding.component.json to components array |

## Out of Scope

- **DO NOT** modify any component files
- **DO NOT** modify any action files
- **DO NOT** modify any rule files
- **DO NOT** modify any condition files
- **DO NOT** modify any source code files
- **DO NOT** add any new actions, rules, or scopes
- **DO NOT** modify any other manifest files

## Implementation Details

Add `"wielding.component.json"` to the `content.components` array in alphabetical order.

### Current State (lines 18-40)

```json
"components": [
  "allows_bending_over.component.json",
  "allows_lying_on.component.json",
  "allows_sitting.component.json",
  "being_bitten_in_neck.component.json",
  "being_fucked_anally.component.json",
  "being_fucked_vaginally.component.json",
  "being_hugged.component.json",
  "bending_over.component.json",
  "biting_neck.component.json",
  "closeness.component.json",
  "doing_complex_performance.component.json",
  "facing_away.component.json",
  "fucking_anally.component.json",
  "fucking_vaginally.component.json",
  "giving_blowjob.component.json",
  "hugging.component.json",
  "kneeling_before.component.json",
  "lying_down.component.json",
  "receiving_blowjob.component.json",
  "sitting_on.component.json",
  "straddling_waist.component.json"
]
```

### Target State

Add `"wielding.component.json"` after `"straddling_waist.component.json"` (alphabetical: s < w):

```json
"components": [
  ...
  "sitting_on.component.json",
  "straddling_waist.component.json",
  "wielding.component.json"
]
```

## Acceptance Criteria

### Specific Tests That Must Pass

```bash
# Validate manifest JSON syntax
node -e "JSON.parse(require('fs').readFileSync('data/mods/positioning/mod-manifest.json'))"

# Full mod validation
npm run validate

# Component should be loadable
npm run validate:mod:positioning  # if this script exists
```

### Invariants That Must Remain True

1. `mod-manifest.json` remains valid JSON
2. Manifest schema validation passes (`mod-manifest.schema.json`)
3. All existing components remain registered (no removals)
4. Components array maintains alphabetical order
5. `wielding.component.json` appears exactly once
6. No other sections of manifest are modified

### Manual Verification

After implementation, run:
```bash
# Verify component count increased by 1
grep -c "component.json" data/mods/positioning/mod-manifest.json
# Expected: 22 (was 21)

# Verify wielding is present
grep "wielding.component.json" data/mods/positioning/mod-manifest.json
# Expected: exactly one match
```

## Diff Preview

The diff should be minimal - approximately 1-2 lines added:

```diff
       "sitting_on.component.json",
-      "straddling_waist.component.json"
+      "straddling_waist.component.json",
+      "wielding.component.json"
     ],
```
