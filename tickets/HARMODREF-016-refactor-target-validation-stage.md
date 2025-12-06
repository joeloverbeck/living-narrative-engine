# HARMODREF-016: Refactor TargetComponentValidationStage

**Priority:** P1 - HIGH
**Effort:** 1 day
**Status:** Not Started

## Report Reference

[reports/hardcoded-mod-references-analysis.md](../reports/hardcoded-mod-references-analysis.md) - "Action Pipeline Hardcoding"

## Problem Statement

Refactor TargetComponentValidationStage to load forbidden components from action definition data instead of hardcoding positioning component IDs.

## Affected Files

1. `src/actions/pipeline/stages/TargetComponentValidationStage.js`
2. `data/schemas/action.schema.json`
3. Action definition files
4. Test files

## Before

```javascript
const forbiddenComponents = [
  'positioning:kneeling', // ❌ HARDCODED
  'positioning:lying_down',
  'positioning:sitting',
];
```

## After

```javascript
const actionDef = this.#actionRegistry.get(actionId);
const forbiddenComponents =
  actionDef.targetValidation?.forbiddenComponents || [];
```

Action schema:

```json
{
  "targetValidation": {
    "forbiddenComponents": ["positioning:kneeling"]
  }
}
```

## Acceptance Criteria

- [ ] No hardcoded component arrays
- [ ] Action schema includes targetValidation
- [ ] Validation loads from action definitions
- [ ] Tests validate custom forbidden components

## Dependencies

None (independent refactoring)
