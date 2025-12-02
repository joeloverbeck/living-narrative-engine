# Investigation: Performance Test Failures for validate-recipe.js

**Status**: Complete  
**Date**: 2025-12-02  
**Findings**: Root cause identified with 4 solution options

---

## Executive Summary

The performance tests fail with exit code 1 because the `human_male.blueprint.json` uses the **V1 `compose` system**, but the validation code (`SocketSlotCompatibilityValidator.js`) does **NOT implement composition handling**. 

The recipe references slots like `head`, `left_arm`, etc., but these come from a composed blueprint part (`anatomy:humanoid_core`), NOT from the blueprint's own explicit `slots` property. The validator cannot find these slots because it doesn't process the `compose` instruction.

---

## Root Cause Analysis

### The Validation Error
```
[ERROR] Socket 'left_eye' not found on parent slot 'head'
[ERROR] Parent slot 'head' not found in structure template. Verify structure template 'undefined' generates slot 'head'
```

The "structure template 'undefined'" is the smoking gun—the blueprint has no structure template because it's a V1 blueprint using `compose` instead.

### The Data Flow

1. **Recipe** (`human_male.recipe.json`) defines slots: `head`, `left_arm`, `right_arm`, `left_leg`, `right_leg`
2. **Blueprint** (`human_male.blueprint.json`) is V1 with `compose` instruction
3. **Composed part** (`humanoid_core.part.json`) defines the missing slots
4. **Validator** attempts to validate socket compatibility
5. **Problem**: Validator never loads the composed part

### Code Chain

| Component | File | Issue |
|-----------|------|-------|
| Blueprint Loader | `blueprintLoader.js` | Processes V2+structureTemplate only; ignores `compose` |
| Socket Extractor | `socketExtractor.js` | Tries `extractSlotChildSockets()` but requires explicit `requirements.partType` in blueprint slots |
| Validator | `SocketSlotCompatibilityValidator.js` | Can't find slots from composed parts |

### Why V1 Compose Isn't Processed

The blueprint loader has this logic (line 48-54):
```javascript
// Route v2 blueprints through template processor
if (blueprint.schemaVersion === '2.0' && blueprint.structureTemplate) {
  return processV2Blueprint(...);
}
// V1 blueprints pass through unchanged
return blueprint;
```

V1 blueprints with `compose` are passed through unchanged—no composition processing happens.

---

## Structural Evidence

### human_male.blueprint.json (V1 with compose)
```json
{
  "id": "anatomy:human_male",
  "root": "anatomy:human_male_torso",
  "compose": [
    {
      "part": "anatomy:humanoid_core",
      "include": ["slots", "clothingSlotMappings"]
    }
  ],
  "slots": {
    "penis": { "socket": "penis" },
    "left_testicle": { "socket": "left_testicle" },
    "right_testicle": { "socket": "right_testicle" }
  }
}
```

**What it declares**: Only 3 explicit slots
**What it needs**: 5 more slots from humanoid_core

### humanoid_core.part.json (Blueprint part)
```json
{
  "id": "anatomy:humanoid_core",
  "slots": {
    "head": { "$use": "standard_head" },
    "left_arm": { "$use": "standard_arm", "socket": "left_shoulder" },
    "right_arm": { "$use": "standard_arm", "socket": "right_shoulder" },
    "left_leg": { "$use": "standard_leg", "socket": "left_hip" },
    "right_leg": { "$use": "standard_leg", "socket": "right_hip" },
    ...
  }
}
```

**What it provides**: The 5 missing slots

### red_dragon.blueprint.json (V2 with structureTemplate)
```json
{
  "id": "anatomy:red_dragon",
  "schemaVersion": "2.0",
  "root": "anatomy:dragon_torso",
  "structureTemplate": "anatomy:structure_winged_quadruped",
  "clothingSlotMappings": { ... }
}
```

**Contrast**: Uses `structureTemplate` instead of `compose`; validated successfully

### Socket Hierarchy Verification

Root entity has sockets:
- `left_shoulder`, `right_shoulder` (for arms)
- `left_hip`, `right_hip` (for legs)  
- `neck` (for head)

Child entities have sockets:
- `humanoid_arm`: has `wrist` socket
- `humanoid_head_bearded`: has `left_eye`, `right_eye`, `left_ear`, `right_ear`, etc.

The architecture is **hierarchically sound**—the problem is purely in the validator not processing `compose`.

---

## Test Expectations vs Reality

### What Tests Expect
```javascript
const result = executeCLI([recipePath]);
expect(result.exitCode).toBe(0);  // Success
```

### What Actually Happens
1. CLI calls validator on `human_male.recipe.json`
2. Validator loads blueprint `human_male`
3. Validator tries to resolve slots `head`, `left_arm`, etc.
4. Blueprint has no `structureTemplate` (it's V1)
5. Socket extraction falls back to looking for explicit slots
6. Explicit slots don't include these (they're in composed part)
7. Validation fails, exit code = 1

---

## Solution Options

### Option A: Implement `compose` Support in Validator
**Approach**: Modify `socketExtractor.js` to process blueprint `compose` instruction

**Pros**:
- Validates V1 blueprints correctly
- Honors original blueprint architecture

**Cons**:
- Complex logic needed for composition merging
- Risk of subtle bugs
- Maintains legacy V1 system

**Effort**: High (requires new socket extraction logic)

---

### Option B: Convert to V2 with Structure Template (RECOMMENDED)
**Approach**: Update `human_male.blueprint.json` to V2 schema with `structureTemplate`

**Pros**:
- Aligns with current validation system
- Consistent with other humanoid blueprints in future
- Structure templates are already working
- Simpler than implementing compose support

**Cons**:
- Requires defining/updating structure template
- Breaking change from V1 to V2 format

**Effort**: Medium (mostly data/schema work)

**Required Changes**:
1. Create or reuse structure template for humanoid biped
2. Update `human_male.blueprint.json` to reference it
3. Remove `compose` instruction
4. Tests should pass immediately

---

### Option C: Update Test Expectations
**Approach**: Change test to expect `exitCode === 1` for `human_male`

**Pros**:
- Immediate test passage
- No data changes needed

**Cons**:
- Masks architectural problem
- Recipe remains unvalidated
- Poor documentation of issue
- Tests aren't actually validating anything

**Effort**: Low (1-line test change)

---

### Option D: Mark Recipe as Invalid
**Approach**: Move recipe to a separate "unsupported" directory; skip from validation tests

**Pros**:
- Honest about system limitations
- Documents deprecated format
- Tests stay accurate

**Cons**:
- Feature loss (can't use this recipe)
- Recipe isn't validated before use

**Effort**: Low (move files, update tests)

---

## Schema Version Analysis

### V1 Blueprints (Legacy)
- Optional: `compose`, `slots`
- Not allowed: `schemaVersion`, `structureTemplate`, `additionalSlots`
- Support: Full blueprint composition via `compose` instruction
- Validator Support: ❌ Not implemented

### V2 Blueprints (Current)  
- Required: `schemaVersion: "2.0"`, `structureTemplate`
- Allowed: `additionalSlots`
- Not allowed: `compose`, `slots`, `parts`
- Support: Structure template with automatic slot generation
- Validator Support: ✅ Fully implemented

---

## Validator Code Logic

The validator in `SocketSlotCompatibilityValidator.js` calls `extractHierarchicalSockets()` which:

1. **Extracts root sockets** (from root entity) ✓
2. **Extracts structure template sockets** (if V2) ✓
3. **Extracts slot child sockets** (for V1):
   ```javascript
   // For each slot without a parent, look up its partType
   // and extract sockets from that part entity
   const partType = parentSlotConfig.requirements?.partType;
   ```
   
This only works if slots have explicit `requirements.partType` properties. The `compose` instruction doesn't add these—it's supposed to merge the slots directly.

---

## Test Failure Root Cause Chain

```
Tests expect: exit code 0 for human_male
        ↓
CLI calls validation
        ↓
SocketSlotCompatibilityValidator.validateSocketSlotCompatibility()
        ↓
extractHierarchicalSockets(blueprint, rootEntity, structureTemplate, dataRegistry)
        ↓
blueprint.structureTemplate === undefined (V1 blueprint)
        ↓
falls through to extractSlotChildSockets()
        ↓
Looks for blueprint slots with requirements.partType
        ↓
Blueprint only has explicit: penis, left_testicle, right_testicle
        ↓
Missing: head, left_arm, right_arm, left_leg, right_foot
        ↓
Composed parts never loaded
        ↓
validation errors for missing slots
        ↓
exit code 1 ❌
```

---

## Recommendation

**Implement Option B: Convert to V2 with Structure Template**

This approach:
1. ✓ Makes tests pass
2. ✓ Aligns with current validation system
3. ✓ Documented migration path
4. ✓ No validator code changes needed
5. ✓ Future-proofs the recipe
6. ✓ Consistent with project architecture

The V1 `compose` system appears effectively deprecated. No other recent code implements or tests compose functionality. The project has moved to structure templates for all modern blueprints.

---

## Files Involved

### Blueprints
- `data/mods/anatomy/blueprints/human_male.blueprint.json` (V1 with compose)
- `data/mods/anatomy/blueprints/human_female.blueprint.json` (V1 with compose)  
- `data/mods/anatomy/blueprints/human_futa.blueprint.json` (V1 with compose)
- `data/mods/anatomy/blueprints/red_dragon.blueprint.json` (V2 with structureTemplate) ✓

### Parts
- `data/mods/anatomy/parts/humanoid_core.part.json` (composed content)

### Recipes
- `data/mods/anatomy/recipes/human_male.recipe.json` (references composed blueprint)

### Validator
- `src/anatomy/validation/validators/SocketSlotCompatibilityValidator.js`
- `src/anatomy/validation/socketExtractor.js`
- `src/anatomy/bodyBlueprintFactory/blueprintLoader.js`

### Tests
- `tests/performance/scripts/validateRecipe.performance.test.js`

---

## Files to Modify (Option B Recommendation)

1. `data/mods/anatomy/blueprints/human_male.blueprint.json`
   - Remove `compose` instruction
   - Add `schemaVersion: "2.0"`
   - Add `structureTemplate` reference
   - Remove explicit `slots` property (except additionalSlots for male-specific parts)

2. `data/mods/anatomy/blueprints/human_female.blueprint.json`
   - Same changes as human_male

3. `data/mods/anatomy/blueprints/human_futa.blueprint.json`
   - Same changes as human_male

4. Create or update structure template
   - May reuse existing `humanoid` structure or create new one

5. Update tests if needed
   - Should pass once blueprints are V2

---

## Conclusion

The validation failure is not due to incorrect recipes or validation bugs. It's due to an architectural mismatch: V1 blueprints use `compose` for composition, but the current validator only supports V2 with `structureTemplate`.

The recommended path forward is to migrate the remaining V1 blueprints to V2 schema, aligning with the project's current direction and making the validator fully functional.
