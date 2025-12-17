# DISPEREVEUPG-007: Core Rules (Speech & Thought) - Perspective Upgrade

**Status:** Ready
**Priority:** High (Priority 2)
**Estimated Effort:** 0.5 days
**Dependencies:** None
**Parent:** DISPEREVEUPG-000

---

## Objective

Upgrade the 2 core communication rules (speech and thought) to support perspective-aware perception with `actor_description` and `alternate_descriptions`.

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
- `actor_description` (first-person)
- `alternate_descriptions` (appropriate sensory fallbacks)

No `target_description` is needed as these are self-actions (though speech may be directed at someone).

### 1. entity_speech.rule.json

**Current:** DISPATCH_PERCEPTIBLE_EVENT for verbal communication

**Upgrade:**
```json
{
  "description_text": "{context.actorName} says: \"{context.speechContent}\"",
  "actor_description": "I speak: \"{context.speechContent}\"",
  "alternate_descriptions": {
    "auditory": "I hear {context.actorName} speaking nearby.",
    "limited": "I sense someone speaking, but cannot make out the words."
  }
}
```

**Note:** The speech content itself may be filtered by sensory capabilities. The `auditory` fallback provides awareness of speech without content for those who can hear but not understand (e.g., distance, language barriers). The `limited` fallback is for those with partial sensory access.

### 2. entity_thought.rule.json

**Current:** DISPATCH_PERCEPTIBLE_EVENT for internal thought

**Upgrade:**
```json
{
  "description_text": "{context.actorName} thinks: \"{context.thoughtContent}\"",
  "actor_description": "I think to myself: \"{context.thoughtContent}\"",
  "alternate_descriptions": {
    "telepathic": "I sense {context.actorName}'s thoughts nearby."
  }
}
```

**Note:** Thoughts are typically only perceivable by the actor themselves or through special telepathic abilities. The `actor_description` ensures the thinker always receives their own thought. The `telepathic` alternate provides a fallback for entities with mind-reading capabilities.

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
1. **Actor**: Always receives their own thought (first-person)
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
