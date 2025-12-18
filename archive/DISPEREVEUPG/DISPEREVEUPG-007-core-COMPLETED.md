# DISPEREVEUPG-007: Core Rules (Speech & Thought) - Perspective Upgrade

**Status:** Completed
**Priority:** High (Priority 2)
**Estimated Effort:** 0.5 days
**Dependencies:** None
**Parent:** DISPEREVEUPG-000
**Completed:** 2025-12-18

---

## Objective

Upgrade the 2 core communication rules (speech and thought) to support perspective-aware perception with `actor_description` and `alternate_descriptions`.

---

## Outcome

### Ticket Corrections Made

During implementation, the following discrepancies were identified and corrected in the ticket itself before proceeding with code changes:

1. **Invalid `telepathic` alternate type**: The original ticket proposed using `"telepathic"` in `alternate_descriptions`, but the schema (`dispatchPerceptibleEvent.schema.json`) only allows: `auditory`, `tactile`, `olfactory`, `limited`. Corrected to use `limited` instead.

2. **Thought perception model clarified**: The original ticket suggested adding `actor_description` to thoughts, but the ticket's own notes correctly questioned this. Design decision validated: thoughts should NOT have `actor_description` because thoughts are already delivered to the actor via `DISPATCH_THOUGHT` operation - adding them to the perceptible event would pollute the perception log.

### Actual Changes

#### `data/mods/core/rules/entity_speech.rule.json`
- Added `actor_description`: `"I say: \"{event.payload.speechContent}\""`
- Added `alternate_descriptions` with `auditory` and `limited` fallbacks
- Set `log_entry: true`
- Added `contextual_data` with speechContent

#### `data/mods/core/rules/entity_thought.rule.json`
- **Did NOT add** `actor_description` (per validated design decision)
- Added `alternate_descriptions` with `limited` fallback only
- Set `log_entry: true`
- Added `contextual_data` with thoughts

### Tests Added

Created `tests/integration/mods/core/entity_speech_thought_perspective.integration.test.js` with 13 tests verifying:
- Speech rule includes `actor_description` for first-person perspective
- Speech rule includes `alternate_descriptions` with valid sensory types
- Thought rule does NOT include `actor_description`
- Thought rule does NOT use invalid `telepathic` type
- Both rules include `log_entry: true`
- Both rules maintain third-person `description_text` for observers
- Thought rule still dispatches via `DISPATCH_THOUGHT` operation

### Validation Results

- JSON syntax validation: PASSED
- Mod validation (`npm run validate:mod:core`): 0 violations
- Core integration tests: 35 tests PASSED
- New perspective tests: 13 tests PASSED
- Full unit test suite: 40,304 tests PASSED

---

## Files to Touch

### Modified Files (2 rules)

- `data/mods/core/rules/entity_speech.rule.json`
- `data/mods/core/rules/entity_thought.rule.json`

---

## Out of Scope

**DO NOT modify:**

- Any action files in core mod
- Any condition files in core mod
- Any component files
- Any entity files
- Any macro files in core mod
- Rules in other mods
- Handler code (`src/logic/operationHandlers/`)
- Schema files (`data/schemas/`)
- Reference implementations (`handle_drink_from.rule.json`, `handle_corrupting_gaze.rule.json`)
- Test files (tests will verify behavior, not be modified)

---

## Implementation Details

### Pattern: Self-Action (Actor + Observers)

Both rules are self-actions where the actor produces communication. Each DISPATCH_PERCEPTIBLE_EVENT must include:
- `actor_description` (first-person) - **for speech only**
- `alternate_descriptions` (appropriate sensory fallbacks)

No `target_description` is needed as these are self-actions (though speech may be directed at someone).

### 1. entity_speech.rule.json

**Current:** DISPATCH_PERCEPTIBLE_EVENT for verbal communication

**Upgrade:**
```json
{
  "description_text": "{context.speakerNameComponent.text} says: \"{event.payload.speechContent}\"",
  "actor_description": "I say: \"{event.payload.speechContent}\"",
  "log_entry": true,
  "alternate_descriptions": {
    "auditory": "{context.speakerNameComponent.text} speaks, but I cannot make out the words.",
    "limited": "I sense someone speaking nearby."
  }
}
```

**Note:** The speech content itself may be filtered by sensory capabilities. The `auditory` fallback provides awareness of speech without content for those who can hear but not understand (e.g., distance, language barriers). The `limited` fallback is for those with partial sensory access.

### 2. entity_thought.rule.json

**Current:** DISPATCH_PERCEPTIBLE_EVENT for internal thought

**Design Decision (validated):**
1. Other actors shouldn't know what another character is thinking - the content remains private.
2. There should NOT be `actor_description` for one's own thoughts, as thoughts are already registered via DISPATCH_THOUGHT to the thoughts component independently; adding them as perceptible log messages would pollute the perceptible log.
3. The `telepathic` alternate type is NOT valid per schema - only `auditory`, `tactile`, `olfactory`, and `limited` are allowed.

**Upgrade:**
```json
{
  "description_text": "{context.thinkerNameComponent.text} is lost in thought.",
  "log_entry": true,
  "alternate_descriptions": {
    "limited": "I sense {context.thinkerNameComponent.text} is distracted."
  }
}
```

**Note:** Thoughts are private by default. The perceptible event only conveys that someone *appears* thoughtful to observers - not the thought content. No `actor_description` is added since the actor already receives their thoughts via the DISPATCH_THOUGHT operation. The `limited` fallback provides a vague awareness for entities with partial perception.

---

## Special Considerations

### Speech Perception Logic

Speech has unique perception requirements:
1. **Actor**: Always receives their own speech (first-person)
2. **Nearby listeners**: Receive third-person if they can hear
3. **Deaf/distant**: May receive visual cue ("I see someone speaking") or nothing
4. **Language barriers**: Future enhancement - may need `alternate_descriptions.foreign_language`

### Thought Perception Logic

Thoughts are private by default:
2. **Others**: Only receive if they have telepathic capabilities
3. **Standard observers**: Receive nothing (thought is private)

---

## Acceptance Criteria

### Tests That Must Pass

1. **Core integration tests:**
   ```bash
   NODE_ENV=test npx jest tests/integration/mods/core/ --no-coverage --silent
   ```

2. **Speech/thought specific tests:**
   ```bash
   NODE_ENV=test npx jest tests/integration/mods/core/ --testNamePattern="speech|thought" --no-coverage --silent
   ```

3. **Mod validation:**
   ```bash
   npm run validate:mod:core
   ```

4. **Full test suite:**
   ```bash
   npm run test:ci
   ```

### Invariants That Must Remain True

1. All existing speech and thought behavior is preserved
2. Speech content reaches appropriate listeners
3. Thought content remains private to actor (unless telepathy exists)
4. Events dispatch with correct payloads
5. No regression in other mods

---

## Verification Steps

```bash
# 1. Validate JSON syntax for all modified rules
node -e "JSON.parse(require('fs').readFileSync('data/mods/core/rules/entity_speech.rule.json'))" && echo "OK: entity_speech"
node -e "JSON.parse(require('fs').readFileSync('data/mods/core/rules/entity_thought.rule.json'))" && echo "OK: entity_thought"

# 2. Run mod validation
npm run validate:mod:core

# 3. Run core integration tests
NODE_ENV=test npx jest tests/integration/mods/core/ --no-coverage --verbose

# 4. Run full test suite
npm run test:ci
```

---

## Reference Files

- Pattern to follow: `data/mods/items/rules/handle_drink_from.rule.json` (actor_description without target)
- Handler: `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js` (reference only)
- Schema: `data/schemas/operations/dispatchPerceptibleEvent.schema.json` (reference only)
