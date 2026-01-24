# COGLEDACTPROIMP-001: Create Cognitive Ledger Component and Constant

## Summary

Create the new `cognitive_ledger` component definition and add its constant ID. This establishes the data storage foundation for tracking settled conclusions and open questions.

---

## Files to Touch

| File | Action |
|------|--------|
| `data/mods/core/components/cognitive_ledger.component.json` | CREATE |
| `src/constants/componentIds.js` | MODIFY (add 1 constant) |
| `data/mods/core/mod-manifest.json` | MODIFY (add component to manifest) |
| `tests/unit/mods/core/components/cognitiveLedger.component.test.js` | CREATE |

---

## Out of Scope

- **DO NOT** modify any prompt generation files
- **DO NOT** modify any response processing files
- **DO NOT** modify LLM output schemas
- **DO NOT** add any listeners or hooks
- **DO NOT** modify `corePromptText.json`
- **DO NOT** touch any files in `src/prompting/`
- **DO NOT** touch any files in `src/turns/`
- **DO NOT** touch any files in `src/ai/`

---

## Implementation Details

### 1. Create Component Definition

**File**: `data/mods/core/components/cognitive_ledger.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "core:cognitive_ledger",
  "description": "Stores settled conclusions and open questions to prevent re-litigation of resolved matters.",
  "dataSchema": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
      "settled_conclusions": {
        "type": "array",
        "maxItems": 3,
        "items": {
          "type": "string",
          "minLength": 1,
          "description": "A conclusion the character has reached and should not re-derive."
        },
        "default": []
      },
      "open_questions": {
        "type": "array",
        "maxItems": 3,
        "items": {
          "type": "string",
          "minLength": 1,
          "description": "A question the character is still actively considering."
        },
        "default": []
      }
    },
    "required": ["settled_conclusions", "open_questions"],
    "additionalProperties": false
  }
}
```

### 2. Add Component ID Constant

**File**: `src/constants/componentIds.js`

Add after `AFFECT_TRAITS_COMPONENT_ID`:

```javascript
// Cognitive system components
export const COGNITIVE_LEDGER_COMPONENT_ID = 'core:cognitive_ledger';
```

### 3. Update Mod Manifest

**File**: `data/mods/core/mod-manifest.json`

Add `"components/cognitive_ledger.component.json"` to the `components` array.

---

## Acceptance Criteria

### Tests That Must Pass

1. **Component Schema Validation**
   - `tests/unit/mods/core/components/cognitiveLedger.component.test.js`
   - Test: Component has correct `$schema` reference
   - Test: Component has id `core:cognitive_ledger`
   - Test: `settled_conclusions` is array with `maxItems: 3`
   - Test: `open_questions` is array with `maxItems: 3`
   - Test: Both fields are required
   - Test: `additionalProperties: false` prevents extra fields
   - Test: Array items require `minLength: 1`
   - Test: Empty arrays are valid (default state)

2. **Existing Tests**
   - `npm run test:unit` passes without regressions
   - `npm run validate:strict` passes (mod structure valid)

### Invariants That Must Remain True

1. All existing component IDs in `componentIds.js` remain unchanged
2. All existing components in `data/mods/core/components/` remain unchanged
3. The mod manifest remains valid JSON and loads correctly
4. No circular dependencies introduced

---

## Verification Commands

```bash
# Validate mod structure
npm run validate:strict

# Run new unit tests
npm run test:unit -- --testPathPattern="cognitiveLedger.component"

# Run all unit tests to ensure no regressions
npm run test:unit

# Verify constant exports
node -e "const c = require('./src/constants/componentIds.js'); console.log(c.COGNITIVE_LEDGER_COMPONENT_ID)"
```
