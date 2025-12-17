# DISPEREVEUPG-001: Physical Control Rules - Perspective Upgrade

**Status:** Completed
**Priority:** Critical (Priority 1)
**Estimated Effort:** 0.5 days
**Dependencies:** None
**Parent:** DISPEREVEUPG-000

---

## Objective

Upgrade the 3 physical-control rules to support perspective-aware perception with `actor_description`, `target_description`, and `alternate_descriptions` for each outcome branch.

## Notes / Assumptions (Verified)

- Each of the three rules already dispatches `DISPATCH_PERCEPTIBLE_EVENT` with `description_text`, `actor_id`, and `target_id` (where applicable).
- `handle_restrain_target.rule.json` has 4 outcome branches and exactly 1 `DISPATCH_PERCEPTIBLE_EVENT` in each branch.
- `handle_break_free_from_restraint.rule.json` has 4 outcome branches and exactly 1 `DISPATCH_PERCEPTIBLE_EVENT` in each branch (the ticket previously assumed multiple dispatches per outcome).
- `handle_break_free_from_restraint.rule.json` currently uses the same `description_text` for FAILURE and FUMBLE; this upgrade keeps that behavior and adds perspective fields to both.
- Integration tests under `tests/integration/mods/physical-control/` validate rule wiring and message payloads; these tests must be updated to assert the new perspective fields.

---

## Files to Touch

### Modified Files (3 rules)

- `data/mods/physical-control/rules/handle_restrain_target.rule.json`
- `data/mods/physical-control/rules/handle_break_free_from_restraint.rule.json`
- `data/mods/physical-control/rules/handle_let_go_of_restrained_target.rule.json`

---

## Out of Scope

**DO NOT modify:**

- Any action files in physical-control mod
- Any condition files in physical-control mod
- Any component files
- Any entity files
- Rules in other mods
- Handler code (`src/logic/operationHandlers/`)
- Schema files (`data/schemas/`)
- Reference implementations (`handle_drink_from.rule.json`, `handle_corrupting_gaze.rule.json`)
- Test semantics unrelated to these three rules (tests may be updated/added to assert perspective-aware fields for these rules)

---

## Implementation Details

### Pattern: Actor-to-Actor Action (Full Perspective)

All three rules involve actor-target interactions where both are actors. Each `DISPATCH_PERCEPTIBLE_EVENT` in these rules must include:
- `actor_description` (first-person)
- `target_description` (second-person)
- `alternate_descriptions` (at minimum `auditory`; add `tactile` when it reads naturally)

**Important:** Preserve existing `description_text` values and non-perception side effects (components, closeness, grabbing locks, macros). This ticket is a data upgrade only.

### 1. handle_restrain_target.rule.json

**Current:** 4 `DISPATCH_PERCEPTIBLE_EVENT` calls (one per outcome)

**Upgrade each outcome** by adding `actor_description`, `target_description`, and `alternate_descriptions` while leaving the existing `description_text` untouched.

**CRITICAL_SUCCESS:**
```json
{
  "description_text": "{context.actorName} restrains {context.targetName}, preventing them from moving freely.",
  "actor_description": "I restrain {context.targetName}, preventing them from moving freely.",
  "target_description": "{context.actorName} restrains me, preventing me from moving freely.",
  "alternate_descriptions": {
    "auditory": "I hear sounds of a struggle and someone being subdued nearby.",
    "tactile": "I feel vibrations from a physical altercation nearby."
  }
}
```

**SUCCESS:**
```json
{
  "description_text": "{context.actorName} restrains {context.targetName}, preventing them from moving freely.",
  "actor_description": "I restrain {context.targetName}, preventing them from moving freely.",
  "target_description": "{context.actorName} restrains me, preventing me from moving freely.",
  "alternate_descriptions": {
    "auditory": "I hear sounds of a struggle nearby.",
    "tactile": "I feel movement and scuffling nearby."
  }
}
```

**FAILURE:**
```json
{
  "description_text": "{context.actorName} attempts to restrain {context.targetName}, but {context.targetName} resists, remaining free to move.",
  "actor_description": "I try to restrain {context.targetName}, but they resist and stay free.",
  "target_description": "{context.actorName} tries to restrain me, but I resist and remain free to move.",
  "alternate_descriptions": {
    "auditory": "I hear sounds of struggling and movement nearby."
  }
}
```

**FUMBLE:**
```json
{
  "description_text": "{context.actorName} attempts to restrain {context.targetName}, but during the struggle, {context.actorName} falls to the ground.",
  "actor_description": "I try to restrain {context.targetName}, but I lose my balance and fall to the ground.",
  "target_description": "{context.actorName} lunges to restrain me, but loses their balance and falls to the ground.",
  "alternate_descriptions": {
    "auditory": "I hear someone stumble and fall nearby."
  }
}
```

### 2. handle_break_free_from_restraint.rule.json

**Current:** 4 `DISPATCH_PERCEPTIBLE_EVENT` calls (one per outcome)

**Upgrade each outcome** by adding `actor_description`, `target_description`, and `alternate_descriptions` while leaving the existing `description_text` untouched.

**CRITICAL_SUCCESS:**
```json
{
  "description_text": "{context.actorName} breaks free from {context.targetName}'s grip, and during the struggle, {context.targetName} falls to the ground.",
  "actor_description": "I break free from {context.targetName}'s grip; in the struggle, they fall to the ground.",
  "target_description": "{context.actorName} breaks free from my grip; in the struggle, I fall to the ground.",
  "alternate_descriptions": {
    "auditory": "I hear sudden movement and someone breaking free nearby.",
    "tactile": "I feel a sudden release of physical tension nearby."
  }
}
```

**SUCCESS:**
```json
{
  "description_text": "{context.actorName} breaks free from {context.targetName}'s grip.",
  "actor_description": "I break free from {context.targetName}'s grip.",
  "target_description": "{context.actorName} breaks free from my grip.",
  "alternate_descriptions": {
    "auditory": "I hear struggling sounds and someone breaking free."
  }
}
```

**FAILURE:**
```json
{
  "description_text": "{context.actorName} tries to break free from {context.targetName}'s grip, but fails to release themselves.",
  "actor_description": "I struggle against {context.targetName}'s grip, but I can't break free.",
  "target_description": "{context.actorName} struggles against my grip, but I keep them restrained.",
  "alternate_descriptions": {
    "auditory": "I hear sounds of struggling nearby."
  }
}
```

**FUMBLE:**
```json
{
  "description_text": "{context.actorName} tries to break free from {context.targetName}'s grip, but fails to release themselves.",
  "actor_description": "I struggle against {context.targetName}'s grip, but I can't break free.",
  "target_description": "{context.actorName} struggles against my grip, but I keep them restrained.",
  "alternate_descriptions": {
    "auditory": "I hear someone struggling and a pained sound."
  }
}
```

### 3. handle_let_go_of_restrained_target.rule.json

**Current:** Single `DISPATCH_PERCEPTIBLE_EVENT`

**Upgrade** by adding `actor_description`, `target_description`, and `alternate_descriptions` while leaving the existing `description_text` untouched.
```json
{
  "description_text": "{context.actorName} lets go of {context.targetName}, leaving them unrestrained.",
  "actor_description": "I release my hold on {context.targetName}.",
  "target_description": "{context.actorName} releases their hold on me. I am free.",
  "alternate_descriptions": {
    "auditory": "I hear movement and someone being released nearby."
  }
}
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **Physical control integration tests:**
   ```bash
   NODE_ENV=test npx jest --config jest.config.integration.js tests/integration/mods/physical-control --runInBand --no-coverage --silent
   ```

2. **Mod validation:**
   ```bash
   npm run validate:mod physical-control
   ```

3. **Full test suite (optional for this ticket, required before merging the series):**
   ```bash
   npm run test:ci
   ```

### Invariants That Must Remain True

1. All existing physical-control rule behavior is preserved
2. Restraint mechanics work identically (components added/removed correctly)
3. All 4 outcome branches execute correctly per rule
4. Events dispatch with correct payloads
5. No regression in other mods

---

## Verification Steps

```bash
# 1. Validate JSON syntax for all modified rules
for file in data/mods/physical-control/rules/handle_{restrain_target,break_free_from_restraint,let_go_of_restrained_target}.rule.json; do
  node -e "JSON.parse(require('fs').readFileSync('$file'))" && echo "OK: $file"
done

# 2. Run mod validation
npm run validate:mod physical-control

# 3. Run physical-control integration tests
NODE_ENV=test npx jest --config jest.config.integration.js tests/integration/mods/physical-control --runInBand --no-coverage --verbose

# 4. Run full test suite
npm run test:ci
```

---

## Reference Files

- Pattern to follow: `data/mods/hexing/rules/handle_corrupting_gaze.rule.json` (full actor/target/alternates per outcome)
- Handler: `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js` (reference only)
- Schema: `data/schemas/operations/dispatchPerceptibleEvent.schema.json` (reference only)

---

## Outcome

This ticket was completed as a data + test upgrade.

- Updated the three physical-control rules to add `actor_description`, `target_description`, and `alternate_descriptions` to each `DISPATCH_PERCEPTIBLE_EVENT` without changing existing `description_text` or rule side effects.
- Updated existing integration tests to assert the new perspective-aware fields for these rules (the original ticket incorrectly claimed tests would not be modified).
- Corrected ticket assumptions/commands to match the repo (`npm run validate:mod physical-control`, and running Jest with `--config jest.config.integration.js --runInBand`).
