# DISPEREVEUPG-006: Movement & Positioning Rules - Perspective Upgrade

**Status:** Completed
**Priority:** High (Priority 2)
**Estimated Effort:** 0.5 days
**Dependencies:** None
**Parent:** DISPEREVEUPG-000

---

## Objective

Upgrade the 4 movement and positioning rules to support perspective-aware perception with `actor_description` and `alternate_descriptions` on every `DISPATCH_PERCEPTIBLE_EVENT` emitted by those rules (departures and arrivals alike).

---

## Files to Touch

### Modified Files (4 rules)

- `data/mods/movement/rules/go.rule.json` (two perceptible events: departure + arrival)
- `data/mods/movement/rules/handle_teleport.rule.json` (two perceptible events: vanish at origin + materialize at destination)
- `data/mods/movement/rules/handle_feel_your_way_to_an_exit.rule.json` (per-outcome perceptible events: 2x for CRITICAL_SUCCESS/SUCCESS, 1x for FAILURE, 1x for FUMBLE)
- `data/mods/positioning/rules/bend_over.rule.json` (single perceptible event with `target_id` for the surface)

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
- Tests are normally only observers, but may be updated/added if new perspective invariants need coverage.

---

## Implementation Details

### Pattern: Self-Action (Actor + Observers)

All four rules currently dispatch self-action events. Each `DISPATCH_PERCEPTIBLE_EVENT` must include:
- `actor_description` (first-person)
- `alternate_descriptions` (auditory, and tactile where appropriate)

No `target_description` is needed. Preserve existing `target_id` usage where present (`bend_over` uses the surface id).

### 1. go.rule.json

**Current:** DISPATCH_PERCEPTIBLE_EVENT for movement

**Upgrade (both departure and arrival events):**
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

**Upgrade (origin event):**
```json
{
  "description_text": "{context.actorName} vanishes from sight.",
  "actor_description": "I feel the world blur as I teleport away.",
  "alternate_descriptions": {
    "auditory": "I hear a sudden displacement of air as if some presence suddenly vanished.",
    "tactile": "I feel a strange disturbance in the air nearby."
  }
}
```

**Upgrade (destination event):**
```json
{
  "description_text": "{context.actorName} appears suddenly.",
  "actor_description": "I materialize at my destination.",
  "alternate_descriptions": {
    "auditory": "I hear a sudden displacement of air as if some presence had suddenly appeared.",
    "tactile": "I feel a strange disturbance as some presence materializes nearby."
  }
}
```

### 3. handle_feel_your_way_to_an_exit.rule.json

**Current:** DISPATCH_PERCEPTIBLE_EVENT for blind navigation

**Upgrade SUCCESS (departure + arrival):**
```json
{
  "description_text": "{context.actorName} feels their way to an exit.",
  "actor_description": "I carefully feel my way around until I find an exit.",
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
  "actor_description": "I feel my way around, but cannot find a way out.",
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
    "auditory": "I hear the rustle of someone changing position."
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

## Outcome

- Added `actor_description` and sensory `alternate_descriptions` to every movement/positioning perceptible event in the four targeted rules (departures, arrivals, and failure branches), preserving existing payloads and targets.
- No test files required changes; existing integration suites now cover the updated perspective fields.
- Executed targeted checks: `NODE_ENV=test npx jest tests/integration/mods/movement/ --no-coverage --runInBand` and `NODE_ENV=test npx jest tests/integration/mods/positioning/ --no-coverage --runInBand`.

---

## Reference Files

- Pattern to follow: `data/mods/items/rules/handle_drink_from.rule.json` (actor_description without target)
- Handler: `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js` (reference only)
- Schema: `data/schemas/operations/dispatchPerceptibleEvent.schema.json` (reference only)
