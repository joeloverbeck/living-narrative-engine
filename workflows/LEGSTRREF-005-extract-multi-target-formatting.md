# LEGSTRREF-005: Extract Multi-Target Formatting

## Metadata
- **Ticket ID**: LEGSTRREF-005
- **Phase**: 2 - Method Extraction
- **Priority**: High
- **Effort**: 1-2 days
- **Status**: Not Started
- **Dependencies**: LEGSTRREF-001, LEGSTRREF-002, LEGSTRREF-003
- **Blocks**: LEGSTRREF-007, LEGSTRREF-008

## Problem Statement

Multi-target formatting logic (lines 164-270 in `#formatTraced` and lines 412-514 in `#formatStandard`) is highly complex with:
- 8 distinct branches
- 3 different exit points
- 2 different fallback conditions
- 5 different type validations
- 6 levels of nesting

Extracting this will reduce cyclomatic complexity from 18 to ~8 per method.

## Implementation Steps

### Step 1: Extract `#formatMultiTargetAction` Method

```javascript
/**
 * Formats a multi-target action with proper validation and error handling.
 * @private
 */
async #formatMultiTargetAction({
  actionDef,
  targetContexts,
  formatterOptions,
  actor,
  trace,
  statsCollector,
  errorHandler,
}) {
  // Extract targets
  const actionSpecificTargets = this.#extractTargetsFromContexts(
    targetContexts,
    actionDef
  );

  // Validate targets
  const validation = this.#validateMultiTargetAction(
    actionSpecificTargets,
    actionDef
  );

  if (!validation.valid) {
    errorHandler.handleValidationError({
      message: validation.message,
      actionDef,
      context: { targetContexts },
    });
    return { formatted: [], errors: [], fallbackCount: 0 };
  }

  // Attempt primary formatting
  if (this.#commandFormatter.formatMultiTarget) {
    const result = await this.#formatWithMultiTargetFormatter({
      actionDef,
      actionSpecificTargets,
      formatterOptions,
      actor,
      trace,
      statsCollector,
      errorHandler,
    });

    if (result.success) {
      return result;
    }
  }

  // Fallback formatting
  if (targetContexts.length > 0) {
    return this.#formatWithFallback({
      actionDef,
      targetContexts,
      formatterOptions,
      actionSpecificTargets,
      actor,
      trace,
      statsCollector,
      errorHandler,
    });
  }

  return { formatted: [], errors: [], fallbackCount: 0 };
}

/**
 * Validates multi-target action has required targets.
 * @private
 */
#validateMultiTargetAction(actionSpecificTargets, actionDef) {
  if (!actionSpecificTargets || Object.keys(actionSpecificTargets).length === 0) {
    return {
      valid: false,
      message: `Skipping multi-target action '${actionDef.id}' in legacy formatting path - ` +
               `no resolved targets available for proper formatting`,
    };
  }
  return { valid: true };
}

/**
 * Formats multi-target action using formatMultiTarget formatter.
 * @private
 */
async #formatWithMultiTargetFormatter({
  actionDef,
  actionSpecificTargets,
  formatterOptions,
  actor,
  trace,
  statsCollector,
  errorHandler,
}) {
  const formatResult = this.#commandFormatter.formatMultiTarget(
    actionDef,
    actionSpecificTargets,
    this.#entityManager,
    formatterOptions,
    {
      displayNameFn: this.#getEntityDisplayNameFn,
      targetDefinitions: actionDef.targets,
    }
  );

  if (!formatResult.ok) {
    return { success: false };
  }

  const commands = Array.isArray(formatResult.value)
    ? formatResult.value
    : [formatResult.value];

  const formatted = [];
  const errors = [];

  for (const commandData of commands) {
    const result = this.#processCommandData({
      commandData,
      actionSpecificTargets,
      actionDef,
      actor,
      trace,
      errorHandler,
    });

    if (result.error) {
      errors.push(result.error);
    } else {
      formatted.push(result.formatted);
    }
  }

  if (statsCollector) {
    statsCollector.increment('successful');
    statsCollector.increment('multiTarget');
  }

  return { success: true, formatted, errors, fallbackCount: 0 };
}
```

### Step 2: Extract `#processCommandData` Method

```javascript
/**
 * Processes command data from multi-target formatter.
 * @private
 */
#processCommandData({
  commandData,
  actionSpecificTargets,
  actionDef,
  actor,
  trace,
  errorHandler,
}) {
  const command = typeof commandData === 'string'
    ? commandData
    : commandData.command;

  const targetSpec = typeof commandData === 'object' && commandData.target
    ? commandData.target
    : null;

  const resolvedTargetId = this.#resolveTargetId(
    targetSpec,
    actionSpecificTargets
  );

  const normalizationResult = this.#targetNormalizationService.normalize(
    resolvedTargetId,
    actionDef.targets,
    this.#entityManager
  );

  if (normalizationResult.error) {
    return {
      error: errorHandler.handleNormalizationError({
        error: normalizationResult.error,
        actionDef,
        actorId: actor.id,
        trace,
      }),
    };
  }

  return {
    formatted: {
      id: actionDef.id,
      name: actionDef.name,
      command,
      description: actionDef.description || '',
      params: { targetId: normalizationResult.targetId },
      visual: actionDef.visual || null,
    },
  };
}
```

### Step 3: Add Comprehensive Tests

Test scenarios:
- Valid multi-target action
- Missing targets
- Formatter unavailable
- Normalization error
- Fallback success
- Fallback failure
- Multiple commands
- Command data type handling

## Acceptance Criteria

- ✅ Multi-target methods extracted
- ✅ Cyclomatic complexity reduced to ~8
- ✅ Clear separation of concerns
- ✅ All existing tests pass
- ✅ New tests with >90% coverage
- ✅ No behavioral changes

## Validation Steps

```bash
npm run test:unit -- tests/unit/actions/pipeline/stages/actionFormatting/legacy/
npm run test:ci
```

## Files Affected

### Modified Files
- `src/actions/pipeline/stages/actionFormatting/legacy/LegacyStrategy.js`

### New Files
- `tests/unit/actions/pipeline/stages/actionFormatting/legacy/LegacyStrategy.multiTarget.test.js`

## Related Tickets
- **Depends on**: LEGSTRREF-001, LEGSTRREF-002, LEGSTRREF-003
- **Blocks**: LEGSTRREF-007, LEGSTRREF-008
- **Part of**: Phase 2 - Method Extraction
