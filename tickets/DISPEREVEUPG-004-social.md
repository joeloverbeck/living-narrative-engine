# DISPEREVEUPG-004: Social Rules - Perspective Upgrade

**Status:** Ready
**Priority:** Critical (Priority 1)
**Estimated Effort:** 0.5 days
**Dependencies:** None
**Parent:** DISPEREVEUPG-000

---

## Objective

Upgrade the 4 social interaction rules to support perspective-aware perception with `actor_description`, `target_description`, and `alternate_descriptions`.

---

## Files to Touch

### Modified Files (4 rules)

- `data/mods/caressing/rules/adjust_clothing.rule.json`
- `data/mods/companionship/rules/dismiss.rule.json`
- `data/mods/companionship/rules/stop_following.rule.json`
- `data/mods/distress/rules/clutch_onto_upper_clothing.rule.json`

---

## Out of Scope

**DO NOT modify:**

- Any action files in these mods
- Any condition files in these mods
- Any component files
- Any entity files
- Rules in other mods
- Handler code (`src/logic/operationHandlers/`)
- Schema files (`data/schemas/`)
- Reference implementations (`handle_drink_from.rule.json`, `handle_corrupting_gaze.rule.json`)
- Test files (tests will verify behavior, not be modified)

---

## Implementation Details

### Pattern: Actor-to-Actor Action (Full Perspective)

All four rules involve actor-target interactions where both are actors. Each DISPATCH_PERCEPTIBLE_EVENT must include:
- `actor_description` (first-person)
- `target_description` (second-person)
- `alternate_descriptions` (auditory, tactile as appropriate)

### 1. adjust_clothing.rule.json

**Current:** Single DISPATCH_PERCEPTIBLE_EVENT call

**Upgrade:**
```json
{
  "description_text": "{context.actorName} adjusts {context.targetName}'s clothing.",
  "actor_description": "I reach out and adjust {context.targetName}'s clothing, straightening it.",
  "target_description": "{context.actorName} adjusts my clothing, straightening it for me.",
  "alternate_descriptions": {
    "auditory": "I hear the rustle of fabric being adjusted nearby.",
    "tactile": "I sense clothing being handled near me."
  }
}
```

### 2. dismiss.rule.json

**Current:** Single DISPATCH_PERCEPTIBLE_EVENT call

**Upgrade:**
```json
{
  "description_text": "{context.actorName} dismisses {context.targetName}.",
  "actor_description": "I dismiss {context.targetName}, releasing them from their service.",
  "target_description": "{context.actorName} dismisses me. I am no longer bound to follow.",
  "alternate_descriptions": {
    "auditory": "I hear words of dismissal spoken nearby."
  }
}
```

### 3. stop_following.rule.json

**Current:** Single DISPATCH_PERCEPTIBLE_EVENT call

**Upgrade:**
```json
{
  "description_text": "{context.actorName} tells {context.targetName} to stop following.",
  "actor_description": "I tell {context.targetName} to stop following me.",
  "target_description": "{context.actorName} tells me to stop following. I halt in place.",
  "alternate_descriptions": {
    "auditory": "I hear a command to stop following nearby."
  }
}
```

### 4. clutch_onto_upper_clothing.rule.json

**Current:** Single DISPATCH_PERCEPTIBLE_EVENT call

**Upgrade:**
```json
{
  "description_text": "{context.actorName} clutches onto {context.targetName}'s upper clothing.",
  "actor_description": "I clutch onto {context.targetName}'s clothing, holding tight in distress.",
  "target_description": "{context.actorName} clutches onto my clothing desperately.",
  "alternate_descriptions": {
    "auditory": "I hear fabric being grabbed and someone in distress.",
    "tactile": "I feel sudden desperate gripping nearby."
  }
}
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **Caressing integration tests:**
   ```bash
   NODE_ENV=test npx jest tests/integration/mods/caressing/ --no-coverage --silent
   ```

2. **Companionship integration tests:**
   ```bash
   NODE_ENV=test npx jest tests/integration/mods/companionship/ --no-coverage --silent
   ```

3. **Distress integration tests:**
   ```bash
   NODE_ENV=test npx jest tests/integration/mods/distress/ --no-coverage --silent
   ```

4. **Mod validations:**
   ```bash
   npm run validate:mod:caressing
   npm run validate:mod:companionship
   npm run validate:mod:distress
   ```

5. **Full test suite:**
   ```bash
   npm run test:ci
   ```

### Invariants That Must Remain True

1. All existing social rule behavior is preserved
2. Clothing adjustment mechanics work identically
3. Companionship state changes (dismiss, stop_following) apply correctly
4. Distress behavior executes correctly
5. Events dispatch with correct payloads
6. No regression in other mods

---

## Verification Steps

```bash
# 1. Validate JSON syntax for all modified rules
node -e "JSON.parse(require('fs').readFileSync('data/mods/caressing/rules/adjust_clothing.rule.json'))" && echo "OK: adjust_clothing"
node -e "JSON.parse(require('fs').readFileSync('data/mods/companionship/rules/dismiss.rule.json'))" && echo "OK: dismiss"
node -e "JSON.parse(require('fs').readFileSync('data/mods/companionship/rules/stop_following.rule.json'))" && echo "OK: stop_following"
node -e "JSON.parse(require('fs').readFileSync('data/mods/distress/rules/clutch_onto_upper_clothing.rule.json'))" && echo "OK: clutch_onto_upper_clothing"

# 2. Run mod validations
npm run validate:mod:caressing
npm run validate:mod:companionship
npm run validate:mod:distress

# 3. Run integration tests
NODE_ENV=test npx jest tests/integration/mods/caressing/ --no-coverage --verbose
NODE_ENV=test npx jest tests/integration/mods/companionship/ --no-coverage --verbose
NODE_ENV=test npx jest tests/integration/mods/distress/ --no-coverage --verbose

# 4. Run full test suite
npm run test:ci
```

---

## Reference Files

- Pattern to follow: `data/mods/hexing/rules/handle_corrupting_gaze.rule.json` (full actor/target/alternates per outcome)
- Handler: `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js` (reference only)
- Schema: `data/schemas/operations/dispatchPerceptibleEvent.schema.json` (reference only)
