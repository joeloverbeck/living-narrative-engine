# Chance Percentage Runtime Bug - Detailed Analysis

## Executive Summary

The bug where chance percentages display as 5% at runtime (despite correct code in `ActionFormattingStage.js`) is caused by **the `#injectChanceIntoTemplates()` method being called BEFORE the `resolvedTargets` data has been attached to `actionWithTarget` objects, or being called with `context.resolvedTargets` that belong to a different action**.

For `generateCombinations: true` actions like `swing_at_target`, the `resolvedTargets` are attached to each combination as it's being created in `MultiTargetActionFormatter.#formatCombinations()`, but the chance injection happens in `ActionFormattingStage.executeInternal()` which processes the aggregated, pre-combination `actionsWithTargets` array.

---

## Data Flow Analysis

### Current Code Path

```
MultiTargetResolutionStage.executeInternal()
  ├─ Creates actionsWithTargets items with:
  │  ├─ actionDef
  │  ├─ resolvedTargets ← Set here (lines 397-401)
  │  ├─ targetDefinitions ← Set here
  │  └─ isMultiTarget: true
  │
  └─ Passes to ActionFormattingStage.executeInternal(context)

ActionFormattingStage.executeInternal(context)
  ├─ Line 170: #injectChanceIntoTemplates(context) ← RUNS HERE
  │   └─ Processes context.actionsWithTargets[i]
  │       ├─ Tries to access actionWithTarget.resolvedTargets (line 303)
  │       ├─ Falls back to context.resolvedTargets (line 304)
  │       └─ For combo actions: context.resolvedTargets may be from WRONG action!
  │
  └─ Line 173: Creates ActionFormattingCoordinator

ActionFormattingCoordinator.run()
  ├─ Creates tasks from actionsWithTargets (lines 152-160)
  │   └─ Calls createActionFormattingTask({
  │         actor,
  │         actionWithTargets,  ← Has resolvedTargets
  │         formatterOptions,
  │         batchResolvedTargets: resolvedTargets ?? null,
  │         batchTargetDefinitions: targetDefinitions ?? null,
  │       })
  │
  └─ Selects strategy for formatting (decision, lines 173-193)

PerActionMetadataStrategy.format()
  └─ Uses MultiTargetActionFormatter.formatMultiTarget()

MultiTargetActionFormatter.formatMultiTarget()
  ├─ Checks if generateCombinations === true (line 83)
  └─ Calls #formatCombinations(actionDef, resolvedTargets, ...)
      └─ Generates array of combination objects
```

### The Problem: Timeline Mismatch

```
Time T0: MultiTargetResolutionStage
  - Creates actionWithTarget with resolvedTargets ✅
  - Sets lastResolvedTargets to these targets

Time T0b: If multiple actions processed
  - Action 2 is processed
  - lastResolvedTargets is OVERWRITTEN with Action 2's targets
  - Original Action 1's targets are lost at batch level

Time T1: ActionFormattingStage.#injectChanceIntoTemplates() 
  - Tries to extract target ID from swing_at_target
  - Status: ❌ FAILS for this reason:
  
  actionWithTarget.resolvedTargets DOES exist
  BUT context.resolvedTargets (fallback) = Action 2's targets
  
  When processing swing_at_target:
  - actionWithTarget.resolvedTargets = correct weapon/target
  - context.resolvedTargets = drop_item's targets
  - #extractTargetId uses fallback path if per-action lookup fails
  - Falls back to: targetContext[0]?.entityId → null for multi-target
  - Result: targetId = null
  - Chance calc: ChanceCalculationService.calculateForDisplay({ targetId: null, ... })
  - Output: Falls back to 5% default

Time T2: ActionFormattingCoordinator creates tasks
  - Each task created with proper batchResolvedTargets
  - But #injectChanceIntoTemplates already completed at T1

Time T3: Formatting happens
  - Templates use the pre-injected (wrong) {chance} values
```

---

## Root Cause: Batch-Level Resolved Targets Overwritten

### MultiTargetResolutionStage Loop (lines 236-445)

```javascript
for (const actionDef of candidateActions) {
  // ... resolution ...
  if (isLegacy) {
    // Handle legacy
  } else {
    // Multi-target action
    const result = await this.#resolutionCoordinator.coordinateResolution(...);
    
    if (result.success && result.data.actionsWithTargets) {
      result.data.actionsWithTargets.forEach((awt) => {
        if (result.data.resolvedTargets && result.data.targetDefinitions) {
          awt.resolvedTargets = result.data.resolvedTargets;  // ← Per-action
          awt.targetDefinitions = result.data.targetDefinitions;
          awt.isMultiTarget = true;
        }
      });
      
      allActionsWithTargets.push(...result.data.actionsWithTargets);
      
      // OVERWRITES lastResolvedTargets for next iteration!
      if (result.data.resolvedTargets) {
        lastResolvedTargets = result.data.resolvedTargets;
      }
      if (result.data.targetDefinitions) {
        lastTargetDefinitions = result.data.targetDefinitions;
      }
    }
  }
}

// At end, lastResolvedTargets = LAST action's targets only!
return this.#resultBuilder.buildFinalResult(
  context,
  allActionsWithTargets,
  allTargetContexts,
  lastResolvedTargets,  // ← May be from last action, not current
  lastTargetDefinitions,
  errors
);
```

### TargetResolutionResultBuilder.buildFinalResult (lines 132-158)

```javascript
buildFinalResult(
  context,
  allActionsWithTargets,
  allTargetContexts,
  lastResolvedTargets,
  lastTargetDefinitions,
  errors
) {
  const resultData = {
    ...context.data,
    actionsWithTargets: allActionsWithTargets,
  };

  if (allTargetContexts.length > 0) {
    resultData.targetContexts = allTargetContexts;
  }

  // Only sets batch-level resolvedTargets if both exist
  if (lastResolvedTargets && lastTargetDefinitions) {
    resultData.resolvedTargets = lastResolvedTargets;  // ← From LAST action!
    resultData.targetDefinitions = lastTargetDefinitions;
  }

  return PipelineResult.success({
    data: resultData,
    errors,
  });
}
```

**CRITICAL**: `context.resolvedTargets` now contains LAST action's resolved targets, not swing_at_target's targets!

---

## Why The Code Looks Correct But Fails

In `ActionFormattingStage.#extractTargetId()` (lines 301-324):

```javascript
#extractTargetId(actionWithTarget, context) {
  const { actionDef } = actionWithTarget;
  
  // This line checks actionWithTarget FIRST - should work!
  const resolvedTargets =
    actionWithTarget.resolvedTargets ?? context.resolvedTargets;
  
  const targetRole = actionDef?.chanceBased?.targetSkill?.targetRole ?? 'secondary';

  // Try configured role first
  if (resolvedTargets?.[targetRole]?.[0]?.id) {
    return resolvedTargets[targetRole][0].id;  // ✅ Should work if resolvedTargets is set
  }

  // Fall back to primary
  if (resolvedTargets?.primary?.[0]?.id) {
    return resolvedTargets.primary[0].id;  // ✅ Should work
  }

  // Legacy path
  return actionWithTarget.targetContexts?.[0]?.entityId ?? null;  // ❌ null for multi-target
}
```

**The issue is subtle**: The code logic is correct, BUT:

1. `actionWithTarget.resolvedTargets` EXISTS (set by MultiTargetResolutionStage)
2. BUT for some reason, accessing `resolvedTargets?.[targetRole]?.[0]?.id` might fail
3. Possible reasons:
   - The structure doesn't match expected (secondary targets may not exist at index 0?)
   - Optional chaining (?.) short-circuits silently
   - The secondary target object doesn't have an `id` field

4. Falls back to `context.resolvedTargets` (from drop_item action) which ALSO fails
5. Finally falls back to `actionWithTarget.targetContexts[0]?.entityId` which is empty for multi-target
6. Returns `null`
7. `ChanceCalculationService.calculateForDisplay({ targetId: null, actionDef })` returns 5%

---

## Why Tests Pass But Runtime Fails

### Test Scenario
In tests, typically ONE action is tested:
```javascript
const fixture = await ModTestFixture.forAction('weapons', 'weapon:swing_at_target');
```

Process:
- Only ONE action in candidateActions
- MultiTargetResolutionStage processes it
- lastResolvedTargets = swing_at_target's targets ✅
- context.resolvedTargets = swing_at_target's targets ✅
- #injectChanceIntoTemplates finds correct secondary target ✅

### Runtime Scenario
Multiple actions discovered in order:
```
[
  "move_to_location"    (legacy)
  "perform_emote"       (legacy)
  "swing_at_target"     (multi-target) ← What we care about
  "drop_item"           (multi-target) ← Last one!
]
```

Process:
- MultiTargetResolutionStage processes all 4
- lastResolvedTargets gets OVERWRITTEN 3 times
- Final value: drop_item's targets
- context.resolvedTargets = drop_item targets ❌

When #injectChanceIntoTemplates processes swing_at_target:
- actionWithTarget.resolvedTargets = weapon + opponents ✅
- context.resolvedTargets = drop_item's inventory items ❌
- #extractTargetId tries to find "secondary" in weapon+opponent data
- If structure issue exists, falls back to context.resolvedTargets (wrong action!)
- Returns null → 5% default

---

## Specific Issues to Investigate

### Issue 1: actionWithTarget.resolvedTargets Structure
When swing_at_target is processed, its resolvedTargets should be:
```javascript
{
  "primary": [{ id: "weapon_123", displayName: "Sword", ... }],
  "secondary": [
    { id: "npc_456", displayName: "Orc", contextFromId: "weapon_123" },
    { id: "npc_789", displayName: "Goblin", contextFromId: "weapon_123" }
  ]
}
```

But if it's something like:
```javascript
{
  "primary": [{ id: "weapon_123", ... }],
  "secondary": []  // ← Empty!
}
```

Then `resolvedTargets?.secondary?.[0]?.id` safely returns `undefined`, falls through all checks, returns `null`.

### Issue 2: Context.resolvedTargets Fallback Danger
Even if per-action access fails, the fallback to `context.resolvedTargets` uses data from a completely different action (drop_item), which won't have the expected secondary targets.

### Issue 3: Empty targetContexts for Multi-Target
The final fallback `actionWithTarget.targetContexts?.[0]?.entityId` depends on targetContexts being populated.

For multi-target actions:
- targetContexts may be empty or populated differently
- Legacy actions had targetContexts from single-target resolution
- Multi-target actions have targetContexts created differently

---

## The Fix Strategy

The current code at line 303-304 is correct in principle:
```javascript
const resolvedTargets =
  actionWithTarget.resolvedTargets ?? context.resolvedTargets;
```

But the issue is:
1. `actionWithTarget.resolvedTargets` may exist but be empty/incomplete
2. `context.resolvedTargets` is from the LAST processed action, not current action
3. No logging to debug which path is being taken

**Recommended Fixes (in order of preference)**:

### Fix A: Debug First (Recommended)
Add detailed logging to understand what's happening:

```javascript
#extractTargetId(actionWithTarget, context) {
  const { actionDef } = actionWithTarget;
  const resolvedTargets =
    actionWithTarget.resolvedTargets ?? context.resolvedTargets;

  this.#logger.debug(`#extractTargetId for ${actionDef.id}:`, {
    hasPerActionResolvedTargets: !!actionWithTarget.resolvedTargets,
    hasContextResolvedTargets: !!context.resolvedTargets,
    usedSource: actionWithTarget.resolvedTargets ? 'per-action' : 'context',
    resolvedTargetsKeys: resolvedTargets ? Object.keys(resolvedTargets) : null,
    targetRole: actionDef?.chanceBased?.targetSkill?.targetRole,
    resolvedTargets: JSON.stringify(resolvedTargets, null, 2),
  });
  
  // ... rest of method ...
}
```

### Fix B: Per-Action Injection During Formatting
Move chance injection into the formatter so each action is processed with its own data:

Instead of calling `#injectChanceIntoTemplates()` once in executeInternal, inject chance inside the formatting strategies where we have access to the task with per-action metadata.

### Fix C: Defensive Extraction
Create multiple fallback strategies:

```javascript
#extractTargetId(actionWithTarget, context) {
  const { actionDef } = actionWithTarget;
  const targetRole = actionDef?.chanceBased?.targetSkill?.targetRole ?? 'secondary';

  // Strategy 1: Use per-action resolvedTargets
  if (actionWithTarget.resolvedTargets?.[targetRole]?.[0]?.id) {
    return actionWithTarget.resolvedTargets[targetRole][0].id;
  }

  // Strategy 2: Try primary if configured role not found
  if (actionWithTarget.resolvedTargets?.primary?.[0]?.id) {
    return actionWithTarget.resolvedTargets.primary[0].id;
  }

  // Strategy 3: DON'T use context.resolvedTargets (it's from wrong action!)
  // Skip fallback to context.resolvedTargets entirely

  // Strategy 4: Use targetContexts as last resort
  if (Array.isArray(actionWithTarget.targetContexts) && 
      actionWithTarget.targetContexts.length > 0) {
    return actionWithTarget.targetContexts[0].entityId ?? null;
  }

  // No target found
  this.#logger.warn(
    `Could not extract target ID for chance calculation in ${actionDef.id}`
  );
  return null;
}
```

This avoids using `context.resolvedTargets` which is incorrect data from the last action.

---

## Summary of Required Verification

Before implementing a fix, verify:

1. **What does `actionWithTarget.resolvedTargets` contain for swing_at_target?**
   - Add logging in #injectChanceIntoTemplates
   - Check if secondary targets are present and properly structured

2. **What does `context.resolvedTargets` contain?**
   - Add logging to see if it's from drop_item (last action) instead of swing_at_target

3. **What does `actionWithTarget.targetContexts` contain for multi-target actions?**
   - Is it populated or empty?
   - Does it have entityId fields?

4. **What is the actual targetRole value for swing_at_target?**
   - Is it 'secondary'?
   - Does that key exist in resolvedTargets?

5. **Test with multiple actions in discovery order**
   - Run action discovery with several actions
   - Verify the order they're processed
   - Confirm last action overwrites context.resolvedTargets

The logging will reveal exactly which fallback path is being taken and why `null` is being returned.

