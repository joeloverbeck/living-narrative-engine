# DISPEREVEUPG-006: Movement & Positioning Rules - Perspective Upgrade

**Status:** Ready
**Priority:** High (Priority 2)
**Estimated Effort:** 0.5 days
**Dependencies:** None
**Parent:** DISPEREVEUPG-000

---

## Objective

Upgrade the 4 movement and positioning rules to support perspective-aware perception with `actor_description` and `alternate_descriptions`.

---

## Files to Touch

### Modified Files (4 rules)

- `data/mods/movement/rules/go.rule.json`
- `data/mods/movement/rules/handle_teleport.rule.json`
- `data/mods/movement/rules/handle_feel_your_way_to_an_exit.rule.json`
- `data/mods/positioning/rules/bend_over.rule.json`

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

### Pattern: Self-Action (Actor + Observers)

All four rules are self-actions where the actor performs an action visible to others. Each DISPATCH_PERCEPTIBLE_EVENT must include:
- `actor_description` (first-person)
- `alternate_descriptions` (auditory, and tactile where appropriate)

No `target_description` is needed as these are self-actions.

### 1. go.rule.json

**Current:** DISPATCH_PERCEPTIBLE_EVENT for movement

**Upgrade:**
```json
{
  "description_text": "{context.actorName} goes to {context.destinationName}.",
  "actor_description": "I move to {context.destinationName}.",
  "alternate_descriptions": {
    "auditory": "I hear footsteps as someone moves away.",
    "tactile": "I feel the vibrations of someone walking nearby."
  }
}
```

### 2. handle_teleport.rule.json

**Current:** DISPATCH_PERCEPTIBLE_EVENT for teleportation

**Upgrade (at origin):**
```json
{
  "description_text": "{context.actorName} vanishes from sight.",
  "actor_description": "I feel the world blur as I teleport away.",
  "alternate_descriptions": {
    "auditory": "I hear a sudden displacement of air as someone vanishes.",
    "tactile": "I feel a strange disturbance in the air nearby."
  }
}
```

**Upgrade (at destination):**
```json
{
  "description_text": "{context.actorName} appears suddenly.",
  "actor_description": "I materialize at my destination.",
  "alternate_descriptions": {
    "auditory": "I hear a sudden displacement of air as someone appears.",
    "tactile": "I feel a strange disturbance as someone materializes nearby."
  }
}
```

### 3. handle_feel_your_way_to_an_exit.rule.json

**Current:** DISPATCH_PERCEPTIBLE_EVENT for blind navigation

**Upgrade SUCCESS:**
```json
{
  "description_text": "{context.actorName} feels their way to an exit.",
  "actor_description": "I carefully feel along the walls until I find an exit.",
  "alternate_descriptions": {
    "auditory": "I hear someone slowly shuffling and feeling along surfaces.",
    "tactile": "I sense careful, deliberate movements nearby."
  }
}
```

**Upgrade FAILURE:**
```json
{
  "description_text": "{context.actorName} fails to find an exit.",
  "actor_description": "I feel along the walls but cannot find a way out.",
  "alternate_descriptions": {
    "auditory": "I hear frustrated searching movements nearby."
  }
}
```

### 4. bend_over.rule.json

**Current:** DISPATCH_PERCEPTIBLE_EVENT for bending action

**Upgrade:**
```json
{
  "description_text": "{context.actorName} bends over.",
  "actor_description": "I bend over, lowering my upper body.",
  "alternate_descriptions": {
    "auditory": "I hear the rustle of someone bending over.",
    "tactile": "I sense someone lowering their body nearby."
  }
}
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **Movement integration tests:**
   ```bash
   NODE_ENV=test npx jest tests/integration/mods/movement/ --no-coverage --silent
   ```

2. **Positioning integration tests:**
   ```bash
   NODE_ENV=test npx jest tests/integration/mods/positioning/ --no-coverage --silent
   ```

3. **Mod validations:**
   ```bash
   npm run validate:mod:movement
   npm run validate:mod:positioning
   ```

4. **Full test suite:**
   ```bash
   npm run test:ci
   ```

### Invariants That Must Remain True

1. All existing movement and positioning behavior is preserved
2. Location changes occur correctly (go, teleport)
3. Navigation mechanics work identically (feel_your_way_to_an_exit)
4. Body positioning state changes correctly (bend_over)
5. Events dispatch with correct payloads
6. No regression in other mods

---

## Verification Steps

```bash
# 1. Validate JSON syntax for all modified rules
node -e "JSON.parse(require('fs').readFileSync('data/mods/movement/rules/go.rule.json'))" && echo "OK: go"
node -e "JSON.parse(require('fs').readFileSync('data/mods/movement/rules/handle_teleport.rule.json'))" && echo "OK: handle_teleport"
node -e "JSON.parse(require('fs').readFileSync('data/mods/movement/rules/handle_feel_your_way_to_an_exit.rule.json'))" && echo "OK: handle_feel_your_way_to_an_exit"
node -e "JSON.parse(require('fs').readFileSync('data/mods/positioning/rules/bend_over.rule.json'))" && echo "OK: bend_over"

# 2. Run mod validations
npm run validate:mod:movement
npm run validate:mod:positioning

# 3. Run movement integration tests
NODE_ENV=test npx jest tests/integration/mods/movement/ --no-coverage --verbose

# 4. Run positioning integration tests
NODE_ENV=test npx jest tests/integration/mods/positioning/ --no-coverage --verbose

# 5. Run full test suite
npm run test:ci
```

---

## Reference Files

- Pattern to follow: `data/mods/items/rules/handle_drink_from.rule.json` (actor_description without target)
- Handler: `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js` (reference only)
- Schema: `data/schemas/operations/dispatchPerceptibleEvent.schema.json` (reference only)
