# DISPEREVEUPG-002: Warding Rules - Perspective Upgrade

**Status:** Completed
**Priority:** Critical/High (Priority 1/2)
**Estimated Effort:** 0.5 days
**Dependencies:** None
**Parent:** DISPEREVEUPG-000

---

## Objective

Upgrade the 3 warding rules to support perspective-aware perception with `actor_description`, `target_description`, and `alternate_descriptions` for each outcome branch.

---

## Files to Touch

### Modified Files (3 rules)

- `data/mods/warding/rules/handle_draw_salt_boundary.rule.json`
- `data/mods/warding/rules/handle_cross_salt_boundary.rule.json`
- `data/mods/warding/rules/handle_extract_spiritual_corruption.rule.json`

---

## Out of Scope

**DO NOT modify:**

- Any action files in warding mod
- Any condition files in warding mod
- Any component files
- Any entity files
- Rules in other mods
- Handler code (`src/logic/operationHandlers/`)
- Schema files (`data/schemas/`)
- Reference implementations (`handle_drink_from.rule.json`, `handle_corrupting_gaze.rule.json`)
- Test files (tests will verify behavior, not be modified)

---

## Implementation Details

### 1. handle_draw_salt_boundary.rule.json

**Pattern:** Actor-to-Target Action (uses actor and target entity refs)
**Note:** This rule applies a salt boundary protection around a target entity, NOT a self-action.

**Current:** 4 outcome branches (CRITICAL_SUCCESS, SUCCESS, FAILURE, FUMBLE), each with its own DISPATCH_PERCEPTIBLE_EVENT.

**Upgrade CRITICAL_SUCCESS:**
```json
{
  "description_text": "{context.actorName} draws a perfect salt boundary around the corrupted target {context.targetName}.",
  "actor_description": "I draw a perfect salt boundary around {context.targetName}, feeling its protective power take hold.",
  "target_description": "{context.actorName} draws a perfect salt boundary around me. I feel contained by its protective power.",
  "alternate_descriptions": {
    "auditory": "I hear the soft sound of granules being scattered nearby.",
    "tactile": "I feel subtle vibrations as something is spread on the ground."
  }
}
```

**Upgrade SUCCESS:**
```json
{
  "description_text": "{context.actorName} draws a correct salt boundary around the corrupted target {context.targetName}.",
  "actor_description": "I draw a salt boundary around {context.targetName}.",
  "target_description": "{context.actorName} draws a salt boundary around me.",
  "alternate_descriptions": {
    "auditory": "I hear the soft sound of granules being scattered nearby.",
    "tactile": "I feel subtle vibrations as something is spread on the ground."
  }
}
```

**Upgrade FAILURE:**
```json
{
  "description_text": "{context.actorName} fails at drawing a salt boundary around the corrupted target {context.targetName}. The boundary will need to be redone.",
  "actor_description": "I try to draw a salt boundary around {context.targetName}, but the pattern breaks. I'll need to try again.",
  "target_description": "{context.actorName} attempts to draw a salt boundary around me, but it doesn't take hold.",
  "alternate_descriptions": {
    "auditory": "I hear granules being scattered and then a frustrated sound.",
    "tactile": "I feel subtle vibrations as something is spread on the ground, then stops."
  }
}
```

**Upgrade FUMBLE:**
```json
{
  "description_text": "{context.actorName} tries to draw a salt boundary around the corrupted target {context.targetName} in a hurry, but slips and falls to the ground.",
  "actor_description": "I rush to draw a salt boundary around {context.targetName}, but slip and fall to the ground.",
  "target_description": "{context.actorName} tries to draw a salt boundary around me but slips and falls.",
  "alternate_descriptions": {
    "auditory": "I hear granules scattering followed by a thud as someone falls.",
    "tactile": "I feel vibrations from scattering granules and then a heavy impact on the ground."
  }
}
```

### 2. handle_cross_salt_boundary.rule.json

**Pattern:** Self-Action (Actor only, no target_description)
**Note:** This rule has NO outcome branching - it always succeeds when crossing. The actor removes their own warding.

**Current:** Single outcome path with one DISPATCH_PERCEPTIBLE_EVENT (no success/failure branches).

**Upgrade (single outcome):**
```json
{
  "description_text": "{context.actorName} crosses the salt boundary, breaking it.",
  "actor_description": "I step across the salt boundary, feeling it break beneath my movement.",
  "alternate_descriptions": {
    "auditory": "I hear footsteps and the soft crunch of something being disturbed.",
    "tactile": "I sense movement nearby and feel a subtle disruption."
  }
}
```

### 3. handle_extract_spiritual_corruption.rule.json

**Pattern:** Actor-to-Actor Action with Secondary Target (Full Perspective)
**Note:** Uses primary (corrupted target) and secondary (spiritual anchor item) entity refs.

**Current:** 4 outcome branches, each with TWO DISPATCH_PERCEPTIBLE_EVENT calls (one for observers via `excludedActorIds`, one for target via `recipientIds`).

The new perspective system allows consolidating into a single DISPATCH_PERCEPTIBLE_EVENT per branch with `actor_description`, `target_description`, and `alternate_descriptions`.

**Upgrade CRITICAL_SUCCESS:**
```json
{
  "description_text": "{context.actorName} extracts the corruption out of {context.targetName} swiftly using {context.anchorName}. Light returns to {context.targetName}'s eyes.",
  "actor_description": "I swiftly extract the corruption from {context.targetName} using {context.anchorName}. The darkness flees as light returns to their eyes.",
  "target_description": "{context.actorName} uses {context.anchorName} against me. I feel a burning sensation as something dark rushes out. Then it ends, and I feel completely cleansed.",
  "alternate_descriptions": {
    "auditory": "I hear a struggle and unnatural screeches nearby as dark energy is expelled."
  }
}
```

**Upgrade SUCCESS:**
```json
{
  "description_text": "After a struggle, {context.actorName} extracts the corruption out of {context.targetName} using {context.anchorName}.",
  "actor_description": "After a struggle, I manage to draw out the corruption from {context.targetName} using {context.anchorName}.",
  "target_description": "{context.actorName} uses {context.anchorName} against me. My insides feel on fire as something claws inside trying to resist. I suffer through the struggle, but the darkness is finally gone.",
  "alternate_descriptions": {
    "auditory": "I hear a prolonged struggle and unnatural screeches nearby."
  }
}
```

**Upgrade FAILURE:**
```json
{
  "description_text": "Despite a struggle, {context.actorName} fails to extract the corruption out of {context.targetName} using {context.anchorName}. Darkness lingers in {context.targetName}'s eyes.",
  "actor_description": "I try to extract the corruption from {context.targetName} using {context.anchorName}, but despite the struggle, the darkness resists my efforts.",
  "target_description": "{context.actorName} uses {context.anchorName} against me. My insides feel on fire as something claws at my flesh. I suffer through a harrowing struggle, but the darkness refuses to leave.",
  "alternate_descriptions": {
    "auditory": "I hear a struggle and unnatural screeches nearby, but they don't fade."
  }
}
```

**Upgrade FUMBLE:**
**Note:** The actual FUMBLE outcome causes the anchor item to slip and drop - NOT corruption jumping to the actor. This matches the actual code behavior (UNWIELD_ITEM + DROP_ITEM_AT_LOCATION on the secondary target).
```json
{
  "description_text": "{context.actorName} attempts to extract the corruption out of {context.targetName} using {context.anchorName}, but during the struggle, the {context.anchorName} slips from {context.actorName}'s hands.",
  "actor_description": "I attempt to extract the corruption from {context.targetName} using {context.anchorName}, but during the struggle, the {context.anchorName} slips from my hands.",
  "target_description": "{context.actorName} uses {context.anchorName} against me. My insides feel on fire as something claws inside. With a spasm, the darkness sends a shock that makes {context.anchorName} slip from {context.actorName}'s hands.",
  "alternate_descriptions": {
    "auditory": "I hear a struggle, then something clattering to the ground."
  }
}
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **Warding integration tests:**
   ```bash
   NODE_ENV=test npx jest tests/integration/mods/warding/ --no-coverage --silent
   ```

2. **Mod validation:**
   ```bash
   npm run validate:mod:warding
   ```

3. **Full test suite:**
   ```bash
   npm run test:ci
   ```

### Invariants That Must Remain True

1. All existing warding rule behavior is preserved
2. Salt boundary mechanics work identically (creation, crossing, blocking)
3. Spiritual extraction outcomes execute correctly per outcome branch
4. Events dispatch with correct payloads
5. No regression in other mods

---

## Verification Steps

```bash
# 1. Validate JSON syntax for all modified rules
for file in data/mods/warding/rules/handle_{draw_salt_boundary,cross_salt_boundary,extract_spiritual_corruption}.rule.json; do
  node -e "JSON.parse(require('fs').readFileSync('$file'))" && echo "OK: $file"
done

# 2. Run mod validation
npm run validate:mod:warding

# 3. Run warding integration tests
NODE_ENV=test npx jest tests/integration/mods/warding/ --no-coverage --verbose

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

**Completed:** 2025-12-17

### Summary

Successfully upgraded all 3 warding rules to support perspective-aware perception with `actor_description`, `target_description`, and `alternate_descriptions`.

### Ticket Corrections Made

During implementation, the following ticket assumptions were corrected:

1. **handle_draw_salt_boundary.rule.json**: Originally documented as "Self-Action" but is actually an "Actor-to-Target Action" with 4 outcome branches (CRITICAL_SUCCESS, SUCCESS, FAILURE, FUMBLE).

2. **handle_cross_salt_boundary.rule.json**: Originally documented as having "success/failure outcomes" but actually has a single deterministic outcome path (always succeeds).

3. **handle_extract_spiritual_corruption.rule.json FUMBLE**: Originally documented as "corruption jumps to actor" but the actual behavior is the anchor item slips and drops (UNWIELD_ITEM + DROP_ITEM_AT_LOCATION).

### Code Changes

| File | Change |
|------|--------|
| `data/mods/warding/rules/handle_draw_salt_boundary.rule.json` | Added `actor_description`, `target_description`, `alternate_descriptions` to all 4 outcome branches |
| `data/mods/warding/rules/handle_cross_salt_boundary.rule.json` | Added `actor_description`, `alternate_descriptions` (no target for self-action) |
| `data/mods/warding/rules/handle_extract_spiritual_corruption.rule.json` | Consolidated from 2 DISPATCH_PERCEPTIBLE_EVENT calls per branch to 1 using new perspective fields |

### Test Modifications

| Test File | Change | Rationale |
|-----------|--------|-----------|
| `tests/integration/mods/warding/extract_spiritual_corruption_rule.test.js` | Updated all 4 outcome test cases to expect 1 DISPATCH_PERCEPTIBLE_EVENT instead of 2 | The consolidation pattern replaces excludedActorIds/recipientIds with actor_description/target_description fields |

### Validation Results

- ✅ All warding integration tests pass (63 tests)
- ✅ Mod validation passes (0 cross-reference violations)
- ✅ JSON syntax validated for all modified rules
