# EXPSYSBRA-007: Perception Type Registration

## Summary

Verify and register the `emotion.expression` perception type in the perception system (registry + UI theming) to enable sense-aware routing and styling of expression events.

## Status

Completed

## Background

The expression system dispatches events with `perceptionType: 'emotion.expression'`. This perception type must be:
1. Defined in the perception type registry (registry exists and is used at runtime)
2. Reflected in UI theming so perception logs render with category/type styling
3. Have appropriate sensory routing (visual primary, auditory/tactile/olfactory fallbacks)

## File List (Expected to Touch)

### Files to Verify/Modify
- `data/schemas/common.schema.json` - Confirm `emotion.expression` already present (no change expected)
- `src/perception/registries/perceptionTypeRegistry.js` - Add type + category metadata
- `css/components/_perception-log.css` - Add category color and type styling (symbol)

### Files to Read (NOT modify)
- `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js` - Understand perception type handling
- `data/schemas/expression.schema.json` - Already defines default perception type

## Out of Scope (MUST NOT Change)

- `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js` - Use existing dispatch logic
- `data/schemas/expression.schema.json` - Schema already complete
- Any existing perception types - Don't modify existing definitions

## Implementation Details

### 1. Verify Schema Definition

Check `data/schemas/common.schema.json` for perception type enum:

```json
{
  "perceptionType": {
    "type": "string",
    "enum": [
      "communication.speech",
      "physical.self_action",
      "intimacy.sensual",
      "emotion.expression"  // <-- Verify this exists or add
    ]
  }
}
```

### 2. Perception Type Definition (Registry Exists)

Add to `src/perception/registries/perceptionTypeRegistry.js`:

```javascript
'emotion.expression': {
  type: 'emotion.expression',
  category: 'emotion',
  displayLabel: 'Expression',
  cssClass: 'log-type-expression',
  legacyTypes: [],
  isFailure: false,
  primarySense: 'visual',
  fallbackSenses: ['auditory', 'tactile', 'olfactory']
}
```

Add category metadata:

```javascript
emotion: {
  displayLabel: 'Emotion',
  cssClassPrefix: 'log-cat-emotion',
  themeColor: '<matches css/components/_perception-log.css>'
}
```

### 3. Sensory Routing Logic

- **Primary**: Visual - observers can see facial expressions, body language
- **Fallback 1**: Auditory - breathing changes, sighs, vocal tension
- **Fallback 2**: Tactile - trembling, warmth (close contact only)
- **Fallback 3**: Olfactory - stress sweat, pheromones (optional but supported)

### 4. Perception Log Styling

- Add emotion category color in `css/components/_perception-log.css`
- Add `.log-type-expression` styling with a small symbol marker (see existing movement/combat/magic types for pattern)

### Investigation Required

1. Check if perception type registry exists:
   ```bash
   find src -name "*perceptionType*" -o -name "*perception*Registry*"
   ```

2. Check how `dispatchPerceptibleEventHandler` validates perception types

3. Verify `emotion.expression` is already in common.schema.json (it is already present)

## Acceptance Criteria

### Tests That Must Pass

1. **Schema Validation Test**
   - Expression files with `perception_type: "emotion.expression"` pass validation
   - Expression files with default perception type (omitted) pass validation

2. **Integration Test**
   - `core:perceptible_event` with `perceptionType: "emotion.expression"` dispatches successfully
   - Sense-aware routing works correctly (visual primary, auditory/tactile/olfactory fallbacks)

3. **UI Theming**
   - Perception log entries render with emotion category color and expression type marker

### Invariants That Must Remain True

1. **Existing perception types unchanged** - Don't modify existing types
2. **Schema validation passes** - Expression files validate correctly
3. **Backward compatible** - Existing perceptible events unaffected
4. **Default works** - Omitted perception_type defaults to `emotion.expression`

## Estimated Size

- Schema change: 1 line (if needed)
- Registry addition: 5-10 lines (if registry exists)
- May be NOOP if already configured

## Dependencies

- Can run in parallel with EXPSYSBRA-006
- No code dependencies on other tickets

## Notes

- This may already be complete based on Phase 1 notes
- Verify first before making changes
- Perception type registry exists and is used for runtime validation
- Check dispatchPerceptibleEventHandler for validation logic and errors

## Outcome

- Added `emotion.expression` to the perception type registry with sense routing and theming metadata.
- Added emotion category styling + expression marker in perception log CSS.
- Updated perception type registry unit tests for the new category/type.
- Common schema already contained `emotion.expression`, so no schema changes were needed.
