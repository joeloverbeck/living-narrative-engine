# AFFTRAANDAFFAXI-001: Create Affect Traits Component Schema

## Status: ✅ COMPLETED

## Summary

Create the new `core:affect_traits` component that defines stable personality traits affecting empathy and moral emotion capacity. This component represents enduring character attributes (unlike mood which is transient).

## Priority: High | Effort: Low

## Rationale

The emotion calculation system currently lacks a trait dimension for stable empathic capacity. A sociopath with high engagement incorrectly triggers "compassion: moderate" because all 7 current mood axes are fast-moving state variables. This component introduces stable personality traits that modulate specific emotions.

## Files to Touch

| File | Change Type |
|------|-------------|
| `data/mods/core/components/affect_traits.component.json` | **Create** - New component schema |

## Out of Scope

- **DO NOT** modify `mood.component.json` - that's AFFTRAANDAFFAXI-002
- **DO NOT** modify `emotion_prototypes.lookup.json` - that's AFFTRAANDAFFAXI-003/004/005
- **DO NOT** modify `EmotionCalculatorService` - that's AFFTRAANDAFFAXI-006/007
- **DO NOT** create any test files - schema validation is sufficient
- **DO NOT** add this component to any entities - that's a separate concern

## Implementation Details

### New File: data/mods/core/components/affect_traits.component.json

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "core:affect_traits",
  "description": "Stable personality traits affecting empathy and moral emotion capacity. Unlike mood (transient states), these traits rarely change and represent enduring character attributes.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "affective_empathy": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": 50,
        "description": "Capacity to feel what others feel. Allows emotional resonance with others' joy, pain, distress. (0=absent, 50=average, 100=hyper-empathic)"
      },
      "cognitive_empathy": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": 50,
        "description": "Ability to understand others' perspectives intellectually. Can be high even when affective empathy is low. (0=none, 50=average, 100=exceptional)"
      },
      "harm_aversion": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": 50,
        "description": "Aversion to causing harm to others. Modulates guilt and inhibits cruelty. (0=enjoys harm, 50=normal aversion, 100=extreme aversion)"
      }
    },
    "required": ["affective_empathy", "cognitive_empathy", "harm_aversion"],
    "additionalProperties": false
  }
}
```

### Design Notes

- **Range `[0, 100]`**: Matches `core:sexual_state` pattern (all positive, no bipolar axis)
- **Integer values**: Matches existing component conventions
- **Default of 50**: "Average human" ensures backwards compatibility
- **Three distinct traits**: Captures different facets of empathy/moral capacity based on psychology research
- **No dependencies**: This component is standalone and can be added to any entity

## Acceptance Criteria

### Tests That Must Pass

1. **Schema validation passes**:
   ```bash
   npm run validate
   ```
   The new component schema must validate against `component.schema.json`.

2. **Strict validation passes**:
   ```bash
   npm run validate:strict
   ```

### Invariants That Must Remain True

1. **Schema follows conventions**: Uses `type: integer`, `minimum/maximum` pattern like other components
2. **ID format correct**: Uses `core:affect_traits` namespaced format
3. **All properties defined**: Each trait has type, min, max, default, and description
4. **No external dependencies**: Component schema is self-contained
5. **Backwards compatible**: Default values (50) represent average human, existing entities without this component are unaffected

## Verification Commands

```bash
# Validate all schemas including new component
npm run validate

# Verify JSON is valid
node -e "require('./data/mods/core/components/affect_traits.component.json')"

# Check component follows naming convention
ls -la data/mods/core/components/affect_traits.component.json
```

## Definition of Done

- [x] `affect_traits.component.json` created with all three traits
- [x] Each trait has type, minimum, maximum, default, and description
- [x] `npm run validate` passes
- [x] JSON is syntactically valid
- [x] No other files modified

---

## Outcome

### What was actually changed vs originally planned

**Planned:**
- Create `data/mods/core/components/affect_traits.component.json` with three traits

**Actually changed:**
1. ✅ Created `data/mods/core/components/affect_traits.component.json` - exactly as specified
2. ✅ Added `affect_traits.component.json` to `data/mods/core/mod-manifest.json` components array (required for schema validation to pass without "unregistered file" warning)
3. ✅ Added test payloads to `tests/unit/schemas/core-and-anatomy.allComponents.schema.test.js` (required by existing test suite that auto-discovers components)

**Additional changes (not in ticket but required):**
- The mod manifest update was necessary to complete registration of the component in the mod system. This is a standard part of adding any new component.
- The schema test file update was necessary because the existing test suite auto-discovers all components and requires valid/invalid payload entries for each.

### Validation Results

- `npm run validate` ✅ PASSED
- `npm run validate:strict` ✅ PASSED
- JSON syntax validation ✅ PASSED
- No cross-reference violations
- No unregistered files
- All 46035 unit tests ✅ PASSED

### Tests

**Modified tests:**
| File | Change | Rationale |
|------|--------|-----------|
| `tests/unit/schemas/core-and-anatomy.allComponents.schema.test.js` | Added `core:affect_traits` to `validPayloads` and `invalidPayloads` | Required by existing test harness that auto-discovers all components and validates them. The test failed without these entries since the component file was auto-loaded but no payload mappings existed. |

No new test files were created per ticket instructions, but the existing schema test harness required payload entries for the new component.
