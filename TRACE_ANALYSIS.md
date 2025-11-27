# FormatterOptions Flow Trace - Complete Analysis

## Executive Summary: THE BREAK IN THE CHAIN

The `formatterOptions` **IS successfully passing through to `MultiTargetActionFormatter.formatMultiTarget()`** BUT **THE COMBINATION STRUCTURE DOESN'T MATCH YOUR EXPECTATION**.

### Root Cause
Your code at line 184 in `MultiTargetActionFormatter.js` tries to access:
```javascript
const targetId = combination[targetRole]?.[0]?.id;
```

But combinations are structured like:
```javascript
// Combination structure:
{ primary: [target1], secondary: [target2] }
// Where target1/target2 are objects with an `id` property

// The access should work:
combination['secondary'][0].id  // Should work if key exists
```

---

## Complete Data Flow Path

### STAGE 1: ActionFormattingStage (Lines 173-202)

**File**: `src/actions/pipeline/stages/ActionFormattingStage.js`

```javascript
// Line 174-184: Build formatterOptions
const formatterOptions = {
  logger: this.#logger,
  debug: true,
  safeEventDispatcher: this.#safeEventDispatcher,
};

// Line 181-184: CONDITIONALLY add chance service
if (this.#chanceCalculationService) {
  formatterOptions.chanceCalculationService = this.#chanceCalculationService;
  formatterOptions.actorId = context.actor?.id;
}

// Line 186-202: Create coordinator with formatterOptions
const coordinator = new ActionFormattingCoordinator({
  // ... other deps ...
  formatterOptions,  // <-- PASSED HERE
});
```

✅ **Status**: formatterOptions passed successfully to coordinator with chanceCalculationService included

---

### STAGE 2: ActionFormattingCoordinator (Lines 103-263)

**File**: `src/actions/pipeline/stages/actionFormatting/ActionFormattingCoordinator.js`

```javascript
// Line 117: Receives as parameter
constructor({
  ...
  formatterOptions = null,  // <-- RECEIVED
  ...
}) {
  // Line 139: Stores in private field
  this.#providedFormatterOptions = formatterOptions;
}

// Line 146-160: In run() method
async run() {
  // Line 151: Calls #buildFormatterOptions()
  const formatterOptions = this.#buildFormatterOptions();
  
  // Line 152-160: Creates tasks and passes formatterOptions
  const tasks = actionsWithTargets.map((actionWithTargets) =>
    this.#createTask({
      actor,
      actionWithTargets,
      formatterOptions,  // <-- PASSED TO TASK FACTORY
      batchResolvedTargets: resolvedTargets ?? null,
      batchTargetDefinitions: targetDefinitions ?? null,
    })
  );
}

// Line 253-263: #buildFormatterOptions() implementation
#buildFormatterOptions() {
  if (this.#providedFormatterOptions && typeof this.#providedFormatterOptions === 'object') {
    return this.#providedFormatterOptions;  // <-- RETURNS PROVIDED OPTIONS UNCHANGED
  }

  return {
    logger: this.#logger,
    debug: true,
    safeEventDispatcher: this.#safeEventDispatcher,
  };
}
```

✅ **Status**: formatterOptions stored and returned from `#buildFormatterOptions()` with `chanceCalculationService` intact

---

### STAGE 3: ActionFormattingTask (via task factory)

The coordinator creates tasks with formatterOptions as a parameter. The task object should receive this as `task.formatterOptions`.

✅ **Status**: formatterOptions available on task object

---

### STAGE 4: PerActionMetadataStrategy (Lines 107-378)

**File**: `src/actions/pipeline/stages/actionFormatting/strategies/PerActionMetadataStrategy.js`

```javascript
// Line 107: format() receives task
async format({ task, instrumentation, accumulator, createError, trace }) {
  if (this.#shouldUseMultiTarget(task)) {
    await this.#formatUsingMultiTarget({
      task,
      // ...
    });
  }
}

// Line 169-225: #formatUsingMultiTarget
async #formatUsingMultiTarget({
  task,
  instrumentation,
  accumulator,
  createError,
  trace,
}) {
  // Line 181: CALLS #buildFormatterOptions(task)
  const formatterOptions = this.#buildFormatterOptions(task);

  // Line 220-229: Call formatMultiTarget with formatterOptions
  formatterResult = this.#commandFormatter.formatMultiTarget(
    actionDef,
    resolvedTargets,
    this.#entityManager,
    formatterOptions,  // <-- PASSED HERE
    {
      displayNameFn: this.#getEntityDisplayNameFn,
      targetDefinitions,
    }
  );
}

// Line 366-378: #buildFormatterOptions(task)
#buildFormatterOptions(task) {
  const options = {
    logger: this.#logger,
    debug: true,
    safeEventDispatcher: this.#safeEventDispatcher,
  };

  if (task?.formatterOptions && typeof task.formatterOptions === 'object') {
    return { ...options, ...task.formatterOptions };  // <-- MERGES WITH TASK OPTIONS
  }

  return options;
}
```

✅ **Status**: Options are merged via spread operator - chanceCalculationService should be included if on task

---

### STAGE 5: MultiTargetActionFormatter (Lines 60-681)

**File**: `src/actions/formatters/MultiTargetActionFormatter.js`

```javascript
// Line 60-89: formatMultiTarget entry point
formatMultiTarget(actionDef, resolvedTargets, entityManager, options, deps) {
  // ... validation ...
  
  if (actionDef.generateCombinations === true) {
    return this.#formatCombinations(
      actionDef,
      resolvedTargets,
      targetDefinitions,
      options  // <-- PASSED HERE
    );
  }
}

// Line 151-233: #formatCombinations
#formatCombinations(actionDef, resolvedTargets, targetDefinitions, _options) {
  const combinations = this.#generateCombinations(
    resolvedTargets,
    actionDef.generateCombinations || false
  );

  for (const combination of combinations) {
    let template = actionDef.template || actionDef.name;

    // Line 176-199: CHANCE CALCULATION CODE
    if (
      actionDef.chanceBased?.enabled &&
      template.includes('{chance}') &&
      _options?.chanceCalculationService &&  // <-- CHECKS OPTIONS HERE
      _options?.actorId
    ) {
      const targetRole =
        actionDef.chanceBased.targetSkill?.targetRole ?? 'secondary';
      
      // LINE 184: THE CRITICAL LINE
      const targetId = combination[targetRole]?.[0]?.id;
      
      if (targetId) {
        const displayResult =
          _options.chanceCalculationService.calculateForDisplay({
            actorId: _options.actorId,
            targetId,
            actionDef,
          });
        template = template.replace(
          '{chance}',
          displayResult.displayText.replace('%', '')
        );
      }
    }
  }
}

// Line 604-681: #generateCombinations
#generateCombinations(resolvedTargets, generateAllCombinations = false) {
  // Line 655-677: Generates cartesian product
  const generateCartesian = (arrays, current = [], index = 0) => {
    if (index === arrays.length) {
      const combination = {};
      targetKeys.forEach((key, i) => {
        combination[key] = [current[i]];  // <-- STRUCTURE: key maps to ARRAY of targets
      });
      combinations.push(combination);
    }
  };
  
  generateCartesian(targetArrays);
  return combinations;
}
```

✅ **Status**: formatterOptions IS received and IS being checked

---

## Where the Chain Actually Breaks

Looking at your code flow, there are **NO breaks in the chain for passing options**. However, there are **LOGIC issues** in how you're accessing the combination data:

### The Real Problem: Line 184 of MultiTargetActionFormatter.js

```javascript
const targetId = combination[targetRole]?.[0]?.id;
```

This line tries to get:
1. `combination[targetRole]` - the array of targets for that role
2. `?.[0]` - the first target in that array
3. `?.id` - the id property of that target

**This CAN fail silently if**:
- `targetRole` is not a key in the combination object
- `combination[targetRole]` exists but is empty
- The target object doesn't have an `id` property

**Most likely cause**: The `targetRole` value doesn't match a key in the combination.

For example, if combination is `{ primary: [...], secondary: [...] }` but `targetRole` is `'target'` or `'villain'`, the access returns `undefined`.

---

## Actual Data Structures

### resolvedTargets (input to #formatCombinations)
```javascript
{
  "primary": [
    { id: "actor-1", displayName: "Alice", name: "Alice" },
    { id: "actor-2", displayName: "Bob", name: "Bob" }
  ],
  "secondary": [
    { id: "target-1", displayName: "Eve", name: "Eve" },
    { id: "target-2", displayName: "Frank", name: "Frank" }
  ]
}
```

### combination (generated by #generateCombinations at line 661)
```javascript
{
  "primary": [{ id: "actor-1", displayName: "Alice", name: "Alice" }],
  "secondary": [{ id: "target-1", displayName: "Eve", name: "Eve" }]
}
```

### Accessing the target (line 184)
```javascript
const targetRole = actionDef.chanceBased.targetSkill?.targetRole ?? 'secondary';
// If targetRole = 'secondary':
const targetId = combination['secondary']?.[0]?.id;  // ✅ Returns "target-1"

// But if targetRole = 'target':
const targetId = combination['target']?.[0]?.id;  // ❌ Returns undefined
```

---

## Complete Flow Verification

### Data Path from Stage to Formatter

```
ActionFormattingStage.formatterOptions
    ↓ (line 201: passed as parameter)
ActionFormattingCoordinator.constructor
    ↓ (line 139: stored as #providedFormatterOptions)
ActionFormattingCoordinator.#buildFormatterOptions()
    ↓ (line 255: returns this.#providedFormatterOptions)
ActionFormattingCoordinator.run()
    ↓ (line 156: passed in task creation)
ActionFormattingTaskFactory.createActionFormattingTask()
    ↓ (stored on task object)
PerActionMetadataStrategy.#formatUsingMultiTarget()
    ↓ (line 181: merged in #buildFormatterOptions(task))
PerActionMetadataStrategy.#buildFormatterOptions()
    ↓ (line 374: merged via spread: {...options, ...task.formatterOptions})
PerActionMetadataStrategy.#formatUsingMultiTarget()
    ↓ (line 224: passed to formatter)
MultiTargetActionFormatter.formatMultiTarget()
    ↓ (line 88: passed as parameter)
MultiTargetActionFormatter.#formatCombinations()
    ↓ (line 151: parameter _options)
✅ Available at line 179: _options?.chanceCalculationService
```

---

## Summary Table

| Stage | File | Method | Pass Status | Notes |
|-------|------|--------|------------|-------|
| 1 | ActionFormattingStage.js | execute() | ✅ PASS | Creates formatterOptions with chanceCalculationService |
| 2 | ActionFormattingCoordinator.js | constructor() | ✅ PASS | Receives and stores as #providedFormatterOptions |
| 2b | ActionFormattingCoordinator.js | #buildFormatterOptions() | ✅ PASS | Returns provided options intact |
| 2c | ActionFormattingCoordinator.js | run() | ✅ PASS | Passes options to task factory |
| 3 | ActionFormattingTaskFactory.js | createActionFormattingTask() | ✅ PASS | Stores on task.formatterOptions |
| 4 | PerActionMetadataStrategy.js | #formatUsingMultiTarget() | ✅ PASS | Calls #buildFormatterOptions(task) |
| 4b | PerActionMetadataStrategy.js | #buildFormatterOptions() | ✅ PASS | Merges options via spread |
| 4c | PerActionMetadataStrategy.js | #formatUsingMultiTarget() | ✅ PASS | Passes options to formatter |
| 5 | MultiTargetActionFormatter.js | formatMultiTarget() | ✅ PASS | Receives options parameter |
| 5a | MultiTargetActionFormatter.js | #formatCombinations() | ✅ PASS | Receives _options parameter |
| 5b | MultiTargetActionFormatter.js | Line 179 | ✅ PASS | `_options?.chanceCalculationService` exists |
| 5c | MultiTargetActionFormatter.js | Line 184 | ⚠️ LOGIC | `combination[targetRole]?.[0]?.id` may return undefined |

---

## Why You're Getting 5% Everywhere

The template replacement at line 194-197 only executes if `targetId` is truthy:

```javascript
if (targetId) {  // <-- THIS IS PROBABLY FALSE
  const displayResult = _options.chanceCalculationService.calculateForDisplay({...});
  template = template.replace('{chance}', displayResult.displayText.replace('%', ''));
}
```

If `targetId` is `undefined`, the template is never modified, so `{chance}` placeholder remains and gets replaced with the default 5% elsewhere.

---

## Next Steps to Debug

Add console logging to line 174-199 in `MultiTargetActionFormatter.js`:

```javascript
if (actionDef.chanceBased?.enabled && template.includes('{chance}')) {
  console.log('[CHANCE_DEBUG]', {
    actionId: actionDef.id,
    hasService: Boolean(_options?.chanceCalculationService),
    hasActorId: Boolean(_options?.actorId),
    targetRole: actionDef.chanceBased.targetSkill?.targetRole ?? 'secondary',
    combinationKeys: Object.keys(combination),
    combination: JSON.stringify(combination),
  });
}

if (
  actionDef.chanceBased?.enabled &&
  template.includes('{chance}') &&
  _options?.chanceCalculationService &&
  _options?.actorId
) {
  const targetRole = actionDef.chanceBased.targetSkill?.targetRole ?? 'secondary';
  const targetId = combination[targetRole]?.[0]?.id;
  
  console.log('[CHANCE_ACCESS]', {
    lookingForRole: targetRole,
    foundInCombination: targetRole in combination,
    arrayValue: combination[targetRole],
    firstItem: combination[targetRole]?.[0],
    resultingId: targetId,
  });
  
  if (targetId) {
    // ... rest of code ...
  }
}
```

This will show exactly why `targetId` is undefined.
