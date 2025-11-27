# Macro Expansion in Nested IF Statements - Investigation Report

## Executive Summary

The `swing_at_target` rule fails to end the turn when macros containing `END_TURN` operations are placed inside nested IF statements. **The root cause is: macros ARE expanded during rule loading via recursive logic, but the expansion is applied correctly. The actual issue appears to be context passing in deeply nested IF execution paths.**

---

## Problem Statement

**Symptom**: Turn timeout error for `swing_at_target` action:
```
"No rule ended the turn for actor fantasy:threadscar_melissa_instance after action 'weapons:swing_at_target'. The engine timed out after 3000 ms."
```

**Rule Structure**:
```json
{
  "type": "IF",
  "parameters": {
    "condition": { "==": [{ "var": "context.attackResult.outcome" }, "CRITICAL_SUCCESS"] },
    "then_actions": [
      { "macro": "core:logSuccessOutcomeAndEndTurn" }  // <-- INSIDE IF
    ],
    "else_actions": [
      {
        "type": "IF",
        "parameters": {
          "then_actions": [
            { "macro": "core:logSuccessOutcomeAndEndTurn" }  // <-- DEEPLY NESTED
          ]
        }
      }
    ]
  }
}
```

---

## Root Cause Analysis

### 1. Macro Expansion Happens at Rule Loading Time

**File**: `src/loaders/ruleLoader.js` (lines 120-144)

The `_processFetchedItem` method calls macro expansion on top-level actions:
```javascript
if (Array.isArray(data.actions)) {
  data.actions = expandMacros(
    data.actions,
    this._dataRegistry,
    this._logger
  );
}
```

### 2. Macro Expansion Logic is Recursive

**File**: `src/utils/macroUtils.js` (lines 15-42)

The `_expandActions` helper IS RECURSIVE and correctly handles nested IF statements:
```javascript
function _expandActions(actions, registry, logger) {
  const result = [];
  for (const action of actions) {
    if (action && action.macro) {
      // Expand macro reference
      const macro = registry.get('macros', action.macro);
      if (macro && Array.isArray(macro.actions)) {
        result.push(..._expandActions(macro.actions, registry, logger));
      }
    } else if (action && action.parameters) {
      const newParams = { ...action.parameters };
      // RECURSIVE: Process nested action arrays
      for (const key of ['then_actions', 'else_actions', 'actions']) {
        if (Array.isArray(newParams[key])) {
          newParams[key] = _expandActions(newParams[key], registry, logger);
        }
      }
      result.push({ ...action, parameters: newParams });
    } else {
      result.push(action);
    }
  }
  return result;
}
```

**This is correct and SHOULD work for all nesting levels.**

---

## Working vs Non-Working Patterns

### ✅ Working Pattern 1: Top-Level Macros
```json
{
  "actions": [
    { "type": "SET_VARIABLE", ... },
    { "macro": "core:logSuccessAndEndTurn" }  
  ]
}
```
**Examples**: `handle_pat_ass_affectionately.rule.json`, `handle_unwield_item.rule.json`

### ✅ Working Pattern 2: Macros in First-Level IF
```json
{
  "actions": [
    {
      "type": "IF",
      "parameters": {
        "then_actions": [
          { "type": "UNEQUIP_CLOTHING", ... },
          { "macro": "core:logSuccessAndEndTurn" }
        ],
        "else_actions": [
          { "type": "DISPATCH_EVENT", ... }
        ]
      }
    }
  ]
}
```
**Example**: `handle_remove_clothing.rule.json` - **WORKS!**

### ❌ Non-Working Pattern: Macros in Deeply Nested IFs
```json
{
  "actions": [
    {
      "type": "IF",  // LEVEL 1
      "parameters": {
        "then_actions": [
          { "macro": "core:logSuccessOutcomeAndEndTurn" }
        ],
        "else_actions": [
          {
            "type": "IF",  // LEVEL 2 (nested in else)
            "parameters": {
              "then_actions": [
                { "macro": "core:logSuccessOutcomeAndEndTurn" }
              ],
              "else_actions": [
                {
                  "type": "IF",  // LEVEL 3 (nested in else of level 2)
                  "parameters": {
                    "then_actions": [
                      { "macro": "core:logSuccessOutcomeAndEndTurn" }
                    ]
                  }
                }
              ]
            }
          }
        ]
      }
    }
  ]
}
```
**Example**: `handle_swing_at_target.rule.json` - **FAILS!**

---

## Detailed Processing Chain

### Phase 1: Rule Loading (RuleLoader._processFetchedItem)
1. Rule file is loaded and parsed as JSON
2. `expandMacros(data.actions, registry, logger)` is called
3. `_expandActions` recursively processes all action arrays
4. Result: All `{ "macro": "..." }` references are replaced with their expanded action arrays
5. Expanded rule is stored in data registry

### Phase 2: Event Firing (Core Engine)
Action dispatcher fires `core:attempt_action` event with rule ID

### Phase 3: Rule Processing (SystemLogicInterpreter._handleEvent)
1. Matching rule is retrieved from cache
2. `#processRule` evaluates the rule's condition
3. If condition passes, `_executeActions` is called with rule.actions

### Phase 4: Action Sequence Execution (executeActionSequence)
In `src/logic/actionSequence.js`:
```javascript
for (let i = 0; i < total; i++) {
  const op = actions[i];
  
  // Check if operation is a flow handler (IF, FOR_EACH)
  const flowHandler = FLOW_HANDLERS[opType];
  if (flowHandler) {
    await flowHandler(
      nodeToOperation(op),
      { ...baseCtx, scopeLabel, jsonLogic },
      logger,
      operationInterpreter,
      executeActionSequence
    );
  } else {
    // Execute via operation interpreter
    const operationResult = await operationInterpreter.execute(op, baseCtx);
  }
}
```

### Phase 5: IF Handler Execution (handleIf)
In `src/logic/flowHandlers/ifHandler.js`:
```javascript
export async function handleIf(
  node, nestedCtx, logger, operationInterpreter, executeActionSequence
) {
  const { condition, then_actions = [], else_actions = [] } = node.parameters;
  
  // Evaluate condition
  const { result } = evaluateConditionWithLogging(
    jsonLogic, condition, baseCtx.evaluationContext, logger, scopeLabel
  );
  
  // Recursively execute appropriate action sequence
  await executeActionSequence(
    result ? thenActs : elseActs,
    { ...baseCtx, scopeLabel, jsonLogic },
    logger,
    operationInterpreter
  );
}
```

**Critical**: Context is spread with `{ ...baseCtx, scopeLabel, jsonLogic }`

---

## The Critical Bottleneck: Context Propagation

When `handleIf` calls `executeActionSequence` recursively (line 92 in flowHandlers/ifHandler.js):

```javascript
await executeActionSequence(
  result ? thenActs : elseActs,
  { ...baseCtx, scopeLabel, jsonLogic },  // <-- CONTEXT SPREAD
  logger,
  operationInterpreter
);
```

The context object includes:
- All properties from `baseCtx` (spread operator)
- `scopeLabel` (overwrite or add)
- `jsonLogic` (overwrite or add)

**Potential Issue**: If `baseCtx` is missing required properties, they won't be passed to nested operations.

### Required Context Properties

For END_TURN to work, the context must include:
- `evaluationContext` - Contains event data, actor, target info
- `entityManager` - To look up entities
- `logger` - For logging
- `validatedEventDispatcher` - To dispatch turn_ended event (used by EndTurnHandler)

---

## Macro Expansion Verification

**File**: `src/utils/macroUtils.js` (lines 101-111)

The `validateMacroExpansion` function checks for unexpanded macros:
```javascript
export function validateMacroExpansion(actions, registry, logger) {
  const unexpanded = findUnexpandedMacros(actions);
  if (unexpanded.length > 0) {
    logger?.warn?(`Found ${unexpanded.length} unexpanded macro references:`, unexpanded);
    return false;
  }
  return true;
}
```

**Called in RuleLoader** (lines 133-143):
```javascript
if (!validateMacroExpansion(data.actions, this._dataRegistry, this._logger)) {
  this._logger.warn(
    `RuleLoader [${modId}]: Some macros may not have been fully expanded in ${filename}.`
  );
}
```

If this logs a warning, it means macros are NOT fully expanded.

---

## END_TURN Operation Handling

**File**: `src/logic/operationHandlers/endTurnHandler.js`

The handler:
1. Validates `params.entityId` and `params.success`
2. Creates a payload with `entityId` and `success`
3. Dispatches `core:turn_ended` event via `safeEventDispatcher`
4. Awaits the dispatch result

The macro `core:logSuccessOutcomeAndEndTurn` expands to:
```json
{
  "actions": [
    {
      "type": "DISPATCH_EVENT",
      "parameters": {
        "eventType": "core:display_successful_action_result",
        "payload": { "message": "{context.logMessage}" }
      }
    },
    {
      "type": "DISPATCH_EVENT",
      "parameters": { "eventType": "core:action_success", "payload": {...} }
    },
    {
      "type": "END_TURN",
      "parameters": {
        "entityId": "{event.payload.actorId}",
        "success": true
      }
    }
  ]
}
```

**Key dependency**: The `END_TURN` parameters use `{event.payload.actorId}` which requires proper context.

---

## Placeholder Resolution

**File**: `src/logic/operationInterpreter.js`

The OperationInterpreter uses `resolvePlaceholders` on parameters:
```javascript
const resolvedParams = resolvePlaceholders(
  op.parameters,
  executionContext.evaluationContext
);
```

This resolves placeholders like `{context.logMessage}` and `{event.payload.actorId}`.

**If evaluationContext is missing or incomplete**, placeholder resolution will fail or use undefined values.

---

## Summary of Findings

| Component | Status | Evidence |
|-----------|--------|----------|
| Macro expansion recursion | ✅ Correct | `_expandActions` handles nested arrays properly |
| Rule loader macro call | ✅ Correct | Calls `expandMacros` on top-level actions |
| IF handler recursion | ✅ Correct | `handleIf` calls `executeActionSequence` recursively |
| Action sequence routing | ✅ Correct | Routes to flow handlers or operation interpreter |
| END_TURN handler registration | ✅ Correct | Handler exists and is mapped in registry |
| Context preservation | ⚠️ **SUSPECT** | Spread operator might lose properties in deep nesting |
| Placeholder resolution | ⚠️ **SUSPECT** | Depends on evaluationContext availability |
| Validation/warnings | ✅ Works | Macro expansion is validated after loading |

---

## Most Likely Causes (In Order of Probability)

### 1. **Context Loss in Nested IF Execution (MOST LIKELY)**
When context is spread multiple times through nested IF handlers, critical properties might be lost or overwritten.

**Test Hypothesis**: Add logging to verify context completeness at each nesting level.

### 2. **Placeholder Resolution Failure (LIKELY)**
If `{event.payload.actorId}` isn't properly resolved, END_TURN receives undefined entityId.

**Test Hypothesis**: Log the resolved parameters in END_TURN handler.

### 3. **Early Listener Pattern Issue (POSSIBLE)**
The comment in endTurnHandler.js mentions previous race conditions with nested IF handlers and queueMicrotask deferral.

**Test Hypothesis**: Check if timing issues reappear with deeply nested execution.

### 4. **Incomplete Macro Expansion (UNLIKELY)**
The recursive expansion logic appears correct, but validation might not catch deep nesting issues.

**Test Hypothesis**: Log the fully expanded rule to verify all macros are actually expanded.

---

## Comparison: handle_remove_clothing (WORKS) vs handle_swing_at_target (FAILS)

### handle_remove_clothing.rule.json Structure:
```
actions[0]: SET_VARIABLE
actions[1]: SET_VARIABLE  
actions[2]: QUERY_COMPONENT
actions[3]: IF
  ├─ then_actions:
  │   ├─ UNEQUIP_CLOTHING
  │   ├─ REGENERATE_DESCRIPTION
  │   ├─ SET_VARIABLE
  │   ├─ SET_VARIABLE
  │   ├─ SET_VARIABLE
  │   └─ [EXPANDED MACRO: logSuccessAndEndTurn]
  │       ├─ DISPATCH_EVENT
  │       ├─ DISPATCH_EVENT  
  │       └─ END_TURN ✅ WORKS
  └─ else_actions:
      ├─ SET_VARIABLE
      └─ DISPATCH_EVENT
```

### handle_swing_at_target.rule.json Structure:
```
actions[0]: GET_NAME
actions[1]: GET_NAME
actions[2]: GET_NAME
actions[3]: QUERY_COMPONENT
actions[4]: RESOLVE_OUTCOME
actions[5]: SET_VARIABLE
actions[6]: SET_VARIABLE
actions[7]: SET_VARIABLE
actions[8]: IF (Level 1)
  ├─ then_actions:
  │   ├─ DISPATCH_PERCEPTIBLE_EVENT
  │   ├─ SET_VARIABLE
  │   └─ [EXPANDED MACRO: logSuccessOutcomeAndEndTurn]
  │       ├─ DISPATCH_EVENT
  │       ├─ DISPATCH_EVENT
  │       └─ END_TURN ✅ SHOULD WORK (Level 1)
  └─ else_actions:
      └─ IF (Level 2 - NESTED)
          ├─ then_actions:
          │   ├─ DISPATCH_PERCEPTIBLE_EVENT
          │   ├─ SET_VARIABLE
          │   └─ [EXPANDED MACRO: logSuccessOutcomeAndEndTurn]
          │       ├─ DISPATCH_EVENT
          │       ├─ DISPATCH_EVENT
          │       └─ END_TURN ❌ POSSIBLY FAILS (Level 2)
          └─ else_actions:
              └─ IF (Level 3 - DEEPLY NESTED)
                  ├─ then_actions:
                  │   ├─ DISPATCH_PERCEPTIBLE_EVENT
                  │   ├─ SET_VARIABLE
                  │   └─ [EXPANDED MACRO: logSuccessOutcomeAndEndTurn]
                  │       ├─ DISPATCH_EVENT
                  │       ├─ DISPATCH_EVENT
                  │       └─ END_TURN ❌ LIKELY FAILS (Level 3)
                  └─ else_actions:
                      └─ DISPATCH_PERCEPTIBLE_EVENT
                      └─ SET_VARIABLE
                      └─ [EXPANDED MACRO: logFailureOutcomeAndEndTurn]
                          ├─ DISPATCH_EVENT
                          └─ END_TURN ❌ LIKELY FAILS (Level 3)
```

**Key Difference**: Nesting depth and number of IF levels. The working rule has ONE IF level, the failing rule has UP TO THREE IF levels.

---

## Recommended Debugging Steps

1. **Add Context Logging in handleIf**
   - Log context properties before and after spread operator
   - Verify evaluationContext, entityManager, validatedEventDispatcher are present

2. **Add Parameter Logging in OperationInterpreter**
   - Log original parameters and resolved parameters
   - Verify placeholder resolution works in nested contexts

3. **Add Execution Logging in executeActionSequence**
   - Log which operations execute at each nesting level
   - Verify macro-expanded END_TURN operations reach the interpreter

4. **Verify Macro Expansion Output**
   - Check if rule in data registry has ALL macros fully expanded
   - Compare rule file with its expanded form in registry

5. **Test Simpler Nested IF Pattern**
   - Create a test rule with 2-level IF nesting
   - Verify whether issue appears at level 2 or only level 3

---

## Key Code Locations for Investigation

| File | Lines | Purpose |
|------|-------|---------|
| `src/loaders/ruleLoader.js` | 120-144 | Macro expansion entry point |
| `src/utils/macroUtils.js` | 15-42 | Recursive expansion logic |
| `src/logic/actionSequence.js` | 40-166 | Action execution orchestration |
| `src/logic/flowHandlers/ifHandler.js` | 32-98 | IF handler with context passing |
| `src/logic/operationHandlers/endTurnHandler.js` | 78-138 | END_TURN dispatcher |
| `src/logic/operationInterpreter.js` | 1-200+ | Parameter resolution and execution |

---

## Files Used in Analysis

- `/home/joeloverbeck/projects/living-narrative-engine/src/logic/operationHandlers/ifHandler.js`
- `/home/joeloverbeck/projects/living-narrative-engine/src/logic/operationHandlers/endTurnHandler.js`
- `/home/joeloverbeck/projects/living-narrative-engine/src/logic/systemLogicInterpreter.js`
- `/home/joeloverbeck/projects/living-narrative-engine/src/logic/flowHandlers/ifHandler.js`
- `/home/joeloverbeck/projects/living-narrative-engine/src/logic/actionSequence.js`
- `/home/joeloverbeck/projects/living-narrative-engine/src/loaders/ruleLoader.js`
- `/home/joeloverbeck/projects/living-narrative-engine/src/utils/macroUtils.js`
- `/home/joeloverbeck/projects/living-narrative-engine/data/mods/weapons/rules/handle_swing_at_target.rule.json`
- `/home/joeloverbeck/projects/living-narrative-engine/data/mods/core/macros/logSuccessOutcomeAndEndTurn.macro.json`
- `/home/joeloverbeck/projects/living-narrative-engine/data/mods/core/macros/logFailureOutcomeAndEndTurn.macro.json`
- `/home/joeloverbeck/projects/living-narrative-engine/data/mods/clothing/rules/handle_remove_clothing.rule.json` (working example)
- `/home/joeloverbeck/projects/living-narrative-engine/data/mods/affection/rules/handle_pat_ass_affectionately.rule.json` (working example)
- `/home/joeloverbeck/projects/living-narrative-engine/data/mods/items/rules/handle_unwield_item.rule.json` (working example)
