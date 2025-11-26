# GRAPREFORACT-003: Add Grabbing Prerequisites to Exercise Mod Action

## Summary

**SPECIAL CASE**: Append a grabbing prerequisite to the `show_off_biceps` action. This action **already has existing prerequisites** (muscular/hulking build check), so the new prerequisite must be **appended** to the existing array, not replace it.

## Background

The `show_off_biceps` action requires both arms free to perform the flexing pose. Unlike other actions in this series, it already has a prerequisite checking for muscular build. The grabbing prerequisite must coexist with this existing check.

**Reference Implementation**: `data/mods/weapons/actions/wield_threateningly.action.json`

## Files to Modify

| File | Change |
|------|--------|
| `data/mods/exercise/actions/show_off_biceps.action.json` | **Append** new prerequisite to existing array |

## Current State

The action currently has this prerequisites array:
```json
"prerequisites": [
  {
    "logic": {
      "or": [
        {
          "hasPartOfTypeWithComponentValue": [
            "actor",
            "arm",
            "descriptors:build",
            "build",
            "muscular"
          ]
        },
        {
          "hasPartOfTypeWithComponentValue": [
            "actor",
            "arm",
            "descriptors:build",
            "build",
            "hulking"
          ]
        }
      ]
    },
    "failure_message": "You don't have the muscular arms needed to show off."
  }
]
```

## Detailed Change

**Append** this object to the existing prerequisites array:
```json
{
  "logic": {
    "condition_ref": "anatomy:actor-has-two-free-grabbing-appendages"
  },
  "failure_message": "You need both arms free to show off your biceps."
}
```

**Final prerequisites array** should contain **2 prerequisite objects**:
```json
"prerequisites": [
  {
    "logic": {
      "or": [
        {
          "hasPartOfTypeWithComponentValue": [
            "actor",
            "arm",
            "descriptors:build",
            "build",
            "muscular"
          ]
        },
        {
          "hasPartOfTypeWithComponentValue": [
            "actor",
            "arm",
            "descriptors:build",
            "build",
            "hulking"
          ]
        }
      ]
    },
    "failure_message": "You don't have the muscular arms needed to show off."
  },
  {
    "logic": {
      "condition_ref": "anatomy:actor-has-two-free-grabbing-appendages"
    },
    "failure_message": "You need both arms free to show off your biceps."
  }
]
```

**Rationale**: Showing off biceps requires both arms to be free for the pose, AND the actor must have muscular arms to show off.

## Out of Scope

- **DO NOT** modify the existing muscular build prerequisite
- **DO NOT** modify any other properties in this action file (targets, required_components, forbidden_components, visual, template, etc.)
- **DO NOT** modify any condition files in `data/mods/anatomy/conditions/`
- **DO NOT** modify the grabbing operators in `src/logic/operators/`
- **DO NOT** create test files (covered in GRAPREFORACT-007)
- **DO NOT** modify any other mod's action files

## Acceptance Criteria

### Schema Validation
- [ ] `npm run validate` passes without errors
- [ ] Modified file remains valid against `action.schema.json`

### Structural Integrity
- [ ] Prerequisites array contains exactly **2** prerequisite objects
- [ ] **First** prerequisite is unchanged (muscular/hulking build check)
- [ ] **Second** prerequisite has `logic.condition_ref` = `anatomy:actor-has-two-free-grabbing-appendages`
- [ ] **Second** prerequisite has `failure_message` = `"You need both arms free to show off your biceps."`
- [ ] All other action properties remain unchanged

### Invariants That Must Remain True
- [ ] Action ID unchanged: `exercise:show_off_biceps`
- [ ] Targets configuration unchanged (`"none"`)
- [ ] Template string unchanged: `"show off your muscular arms"`
- [ ] Visual styling unchanged
- [ ] Required/forbidden components unchanged
- [ ] **Existing muscular build prerequisite exactly preserved**

## Verification Commands

```bash
# Validate schema compliance
npm run validate

# Verify JSON syntax and structure
node -e "
const action = require('./data/mods/exercise/actions/show_off_biceps.action.json');
console.log('Prerequisites count:', action.prerequisites.length);
console.log('First prereq has muscular check:', action.prerequisites[0].logic.or !== undefined);
console.log('Second prereq condition_ref:', action.prerequisites[1]?.logic?.condition_ref);
"

# Check condition reference exists
cat data/mods/anatomy/conditions/actor-has-two-free-grabbing-appendages.condition.json
```

## Dependencies

- **Depends on**: Nothing (condition files already exist)
- **Blocked by**: Nothing
- **Blocks**: GRAPREFORACT-007 (test file creation)

## Risk Notes

⚠️ **This ticket requires appending, not replacing**. If the existing muscular build prerequisite is accidentally removed or modified, the action will break. Double-check the final prerequisites array contains both checks.
