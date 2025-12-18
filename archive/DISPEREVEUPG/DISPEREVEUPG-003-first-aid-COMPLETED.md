# DISPEREVEUPG-003: First Aid Rules - Perspective Upgrade

**Status:** ✅ Completed
**Priority:** Critical/High (Priority 1/2)
**Estimated Effort:** 0.5 days
**Dependencies:** None
**Parent:** DISPEREVEUPG-000
**Completed:** 2025-12-17

---

## Objective

Upgrade the 2 first-aid rules to support perspective-aware perception with `alternate_descriptions` for each outcome branch.

---

## ⚠️ Assumption Corrections (Verified 2024)

The original ticket incorrectly assumed that `actor_description` and `target_description` are parameters of `DISPATCH_PERCEPTIBLE_EVENT`. **This is incorrect.**

**Actual Schema (from `dispatchPerceptibleEvent.schema.json`):**
- `description_text` (required) - Primary event description
- `alternate_descriptions` (optional object) - Contains `auditory`, `tactile`, `olfactory`, `limited` fallback descriptions

**Correct Pattern for Perspective-Aware Messaging:**

The reference implementations (`handle_drink_from.rule.json`, `handle_corrupting_gaze.rule.json`) achieve perspective-specific messaging through:
1. **Multiple `DISPATCH_PERCEPTIBLE_EVENT` calls** with different `contextual_data` filters
2. Using `excludedActorIds` to hide a message from specific recipients
3. Using `recipientIds` to send a message only to specific recipients

**Simplified Approach for First-Aid Rules:**

For the first-aid rules, we will use the simpler pattern with:
- Third-person `description_text` as the standard message
- `alternate_descriptions` for sensory fallbacks (auditory, tactile)

The dual-dispatch pattern (actor-specific + target-specific messages) adds complexity that is **out of scope** for this ticket. The goal is to add sensory fallback support, not implement the full perspective system.

---

## Files to Touch

### Modified Files (2 rules)

- `data/mods/first-aid/rules/handle_treat_wounded_part.rule.json`
- `data/mods/first-aid/rules/handle_treat_my_wounded_part.rule.json`

---

## Out of Scope

**DO NOT modify:**

- Any action files in first-aid mod
- Any condition files in first-aid mod
- Any component files
- Any entity files
- Rules in other mods
- Handler code (`src/logic/operationHandlers/`)
- Schema files (`data/schemas/`)
- Reference implementations (`handle_drink_from.rule.json`, `handle_corrupting_gaze.rule.json`)

---

## Implementation Details

### 1. handle_treat_wounded_part.rule.json

**Pattern:** Actor-to-Actor Action (with sensory fallbacks)

**Current:** Single DISPATCH_PERCEPTIBLE_EVENT per outcome, no `alternate_descriptions`

**Upgrade CRITICAL_SUCCESS:**
```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "location_id": "{context.locationId}",
    "description_text": "{context.actorName} expertly treats {context.targetName}'s wounded {context.bodyPartName}, achieving remarkable healing results!",
    "perception_type": "{context.perceptionType}",
    "actor_id": "{event.payload.actorId}",
    "target_id": "{context.targetId}",
    "alternate_descriptions": {
      "auditory": "I hear the sounds of medical treatment being administered with exceptional skill.",
      "tactile": "I sense careful, deliberate movements of someone providing expert care."
    }
  }
}
```

**Upgrade SUCCESS:**
```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "location_id": "{context.locationId}",
    "description_text": "{context.actorName} successfully treats {context.targetName}'s wounded {context.bodyPartName}.",
    "perception_type": "{context.perceptionType}",
    "actor_id": "{event.payload.actorId}",
    "target_id": "{context.targetId}",
    "alternate_descriptions": {
      "auditory": "I hear the rustle of bandages and sounds of treatment nearby."
    }
  }
}
```

**Upgrade FAILURE:**
```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "location_id": "{context.locationId}",
    "description_text": "{context.actorName} attempts to treat {context.targetName}'s wounded {context.bodyPartName} but fails to provide effective care.",
    "perception_type": "{context.perceptionType}",
    "actor_id": "{event.payload.actorId}",
    "target_id": "{context.targetId}",
    "alternate_descriptions": {
      "auditory": "I hear frustrated attempts at medical treatment nearby."
    }
  }
}
```

**Upgrade FUMBLE:**
```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "location_id": "{context.locationId}",
    "description_text": "{context.actorName} fumbles badly while treating {context.targetName}'s wounded {context.bodyPartName}, causing additional injury!",
    "perception_type": "{context.perceptionType}",
    "actor_id": "{event.payload.actorId}",
    "target_id": "{context.targetId}",
    "alternate_descriptions": {
      "auditory": "I hear the rustle of medical treatment nearby, then a pained cry.",
      "tactile": "I sense sudden distress nearby."
    }
  }
}
```

### 2. handle_treat_my_wounded_part.rule.json

**Pattern:** Self-Action (with sensory fallbacks)

**Current:** Single DISPATCH_PERCEPTIBLE_EVENT per outcome, no `alternate_descriptions`

**Upgrade CRITICAL_SUCCESS:**
```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "location_id": "{context.locationId}",
    "description_text": "{context.actorName} expertly treats their own wounded {context.bodyPartName}, achieving remarkable healing results!",
    "perception_type": "{context.perceptionType}",
    "actor_id": "{event.payload.actorId}",
    "alternate_descriptions": {
      "auditory": "I hear the rustle of medical self-treatment nearby."
    }
  }
}
```

**Upgrade SUCCESS:**
```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "location_id": "{context.locationId}",
    "description_text": "{context.actorName} successfully treats their own wounded {context.bodyPartName}.",
    "perception_type": "{context.perceptionType}",
    "actor_id": "{event.payload.actorId}",
    "alternate_descriptions": {
      "auditory": "I hear the rustle of medical treatment nearby."
    }
  }
}
```

**Upgrade FAILURE:**
```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "location_id": "{context.locationId}",
    "description_text": "{context.actorName} attempts to treat their own wounded {context.bodyPartName} but fails to provide effective care.",
    "perception_type": "{context.perceptionType}",
    "actor_id": "{event.payload.actorId}",
    "alternate_descriptions": {
      "auditory": "I hear frustrated sounds of failed medical treatment."
    }
  }
}
```

**Upgrade FUMBLE:**
```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "location_id": "{context.locationId}",
    "description_text": "{context.actorName} fumbles badly while treating their own wounded {context.bodyPartName}, causing additional injury!",
    "perception_type": "{context.perceptionType}",
    "actor_id": "{event.payload.actorId}",
    "alternate_descriptions": {
      "auditory": "I hear the rustle of medical treatment, then a pained sound."
    }
  }
}
```

---

## Technical Notes

### Key Changes from Original Ticket

1. **Removed non-existent parameters:** `actor_description` and `target_description` do not exist in the schema
2. **Simplified scope:** Focus on adding `alternate_descriptions` for sensory fallbacks only
3. **Description text consolidation:** Remove intermediate `SET_VARIABLE` for `logMessage` and inline the message directly in `DISPATCH_PERCEPTIBLE_EVENT`

### Why This Approach

- The current rules already have working `DISPATCH_PERCEPTIBLE_EVENT` calls with correct structure
- Adding `alternate_descriptions` is a minimal, non-breaking change
- Full perspective-aware first-person messaging (dual-dispatch pattern) would require significant refactoring and is out of scope

---

## Acceptance Criteria

### Tests That Must Pass

1. **First aid integration tests:**
   ```bash
   NODE_ENV=test npx jest tests/integration/mods/first-aid/ --no-coverage --silent
   ```

2. **Mod validation:**
   ```bash
   npm run validate:mod:first-aid
   ```

3. **Full test suite:**
   ```bash
   npm run test:ci
   ```

### Invariants That Must Remain True

1. All existing first-aid rule behavior is preserved
2. Wound treatment mechanics work identically (healing applied correctly)
3. All 4 outcome branches execute correctly per rule
4. Events dispatch with correct payloads
5. No regression in other mods

---

## Verification Steps

```bash
# 1. Validate JSON syntax for all modified rules
for file in data/mods/first-aid/rules/handle_{treat_wounded_part,treat_my_wounded_part}.rule.json; do
  node -e "JSON.parse(require('fs').readFileSync('$file'))" && echo "OK: $file"
done

# 2. Run mod validation
npm run validate:mod:first-aid

# 3. Run first-aid integration tests
NODE_ENV=test npx jest tests/integration/mods/first-aid/ --no-coverage --verbose

# 4. Run full test suite
npm run test:ci
```

---

## Reference Files

- Pattern to follow: `data/mods/positioning/rules/handle_bend_over.rule.json` (simple alternate_descriptions)
- Handler: `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js` (reference only)
- Schema: `data/schemas/operations/dispatchPerceptibleEvent.schema.json` (reference only)
- Docs: `docs/modding/sense-aware-perception.md`

---

## Outcome

### ✅ Completed Successfully (2025-12-17)

**Implementation Summary:**

1. **Ticket Assumption Corrections**: Original ticket incorrectly assumed `actor_description` and `target_description` parameters exist in `DISPATCH_PERCEPTIBLE_EVENT`. Added "⚠️ Assumption Corrections" section documenting actual schema: `description_text` (required) + `alternate_descriptions` (optional sensory fallbacks).

2. **Rules Updated (2 files)**:
   - `data/mods/first-aid/rules/handle_treat_wounded_part.rule.json` - All 4 outcome branches (CRITICAL_SUCCESS, SUCCESS, FAILURE, FUMBLE) now include `alternate_descriptions` with appropriate sensory fallbacks
   - `data/mods/first-aid/rules/handle_treat_my_wounded_part.rule.json` - All 4 outcome branches now include `alternate_descriptions` with auditory fallbacks

3. **Tests Added (2 files, 12 new tests)**:
   - `tests/integration/mods/first-aid/handle_treat_wounded_part_rule.test.js` - Added "Alternate Descriptions (Sensory Fallbacks)" describe block with 6 tests
   - `tests/integration/mods/first-aid/handle_treat_my_wounded_part_rule.test.js` - Added "Alternate Descriptions (Sensory Fallbacks)" describe block with 6 tests

**Test Results:**
- 15 test suites, 131 tests - all passing
- Ecosystem validation: 0 cross-reference violations across 65 mods

**Key Design Decisions:**

1. **Target treatment** (`handle_treat_wounded_part.rule.json`) uses both `auditory` and `tactile` fallbacks for CRITICAL_SUCCESS and FUMBLE outcomes (high-impact events warrant richer sensory description)

2. **Self-treatment** (`handle_treat_my_wounded_part.rule.json`) uses `auditory` only fallbacks (simpler for self-action, less external impact)

3. **`alternate_descriptions` NOT in event payload**: Per handler design, `alternate_descriptions` are passed to the perception log handler for sense-aware filtering but are not included in the dispatched event payload itself. Tests validate this correct behavior.

**Deviations from Original Ticket:**
- Removed references to non-existent `actor_description`/`target_description` parameters
- Simplified scope to focus on `alternate_descriptions` for sensory fallbacks
- Did not implement dual-dispatch pattern (out of scope per corrected ticket)
