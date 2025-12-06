# NONDETACTSYS-009: Extend action.schema.json with chanceBased Property ✅

## Summary

Extend the action schema to support the `chanceBased` optional property that configures non-deterministic action behavior. This allows actions to declare skill-based probability calculations and outcome thresholds.

## Status: COMPLETED

## Outcome

### Changes Made

1. **Added `chanceModifier` definition** to `data/schemas/action.schema.json` in the `definitions` section
2. **Added `chanceBased` property** to `data/schemas/action.schema.json` in the `properties` section
3. **Created comprehensive schema validation tests** at `tests/unit/schemas/action.chanceBased.schema.test.js` with 32 test cases

### Ticket Discrepancies Corrected

During implementation, the following discrepancies were identified and the ticket was updated:

1. **`$defs` vs `definitions`**: Original ticket used `$defs` syntax, but the existing `action.schema.json` uses `definitions` (JSON Schema Draft-07 convention). Updated ticket examples to use `definitions`.

2. **Test file creation**: Original ticket mentioned "DO NOT create tests" but user explicitly requested tests be created. Updated ticket to include test file in scope.

### Validation Results

- `npm run validate`: ✅ PASSED (325.72ms)
- Schema validation tests: ✅ 32/32 tests pass
- Backward compatibility tests: ✅ 226/226 existing actions validate
- ESLint: ✅ No errors

### Files Modified

| File                                                    | Change                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------ |
| `data/schemas/action.schema.json`                       | Added `chanceModifier` definition and `chanceBased` property |
| `tickets/NONDETACTSYS-009-action-schema-chancebased.md` | Fixed `$defs` → `definitions`, added test file to scope      |

### Files Created

| File                                                   | Purpose                                                                                                                          |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/schemas/action.chanceBased.schema.test.js` | 32 schema validation tests covering backward compatibility, valid configs, invalid configs, and additionalProperties enforcement |

### Test Coverage

The new test file covers:

- **Backward compatibility** (2 tests): Actions without `chanceBased` continue to validate
- **Valid configurations** (12 tests): Minimal, full, all formula types, bounds, outcomes, modifiers
- **Missing required fields** (6 tests): `enabled`, `contestType`, `actorSkill`, `actorSkill.component`, modifier `condition`/`modifier`
- **Invalid values** (9 tests): Invalid enums, out-of-range bounds, wrong types
- **Additional properties** (3 tests): Unknown properties correctly rejected

---

## Original Ticket Content

## Files to Modify

| File                              | Change                                                     |
| --------------------------------- | ---------------------------------------------------------- |
| `data/schemas/action.schema.json` | Add `chanceBased` property and `chanceModifier` definition |

## Implementation Details

### chanceBased Property Schema

Add to `action.schema.json` properties:

```json
{
  "chanceBased": {
    "type": "object",
    "description": "Configuration for non-deterministic action with probability calculation",
    "properties": {
      "enabled": {
        "type": "boolean",
        "default": false,
        "description": "Whether this action uses chance-based resolution"
      },
      "contestType": {
        "type": "string",
        "enum": ["opposed", "fixed_difficulty"],
        "description": "opposed: actor vs target skill, fixed_difficulty: actor vs static value"
      },
      "actorSkill": {
        "type": "object",
        "description": "Actor's skill configuration",
        "properties": {
          "component": {
            "$ref": "./common.schema.json#/definitions/namespacedId",
            "description": "Component ID for skill (e.g., 'skills:melee_skill')"
          },
          "property": {
            "type": "string",
            "default": "value",
            "description": "Property path within component"
          },
          "default": {
            "type": "number",
            "default": 0,
            "description": "Default value if component missing"
          }
        },
        "required": ["component"]
      },
      "targetSkill": {
        "type": "object",
        "description": "Target's skill configuration (for opposed checks)",
        "properties": {
          "component": {
            "$ref": "./common.schema.json#/definitions/namespacedId"
          },
          "property": {
            "type": "string",
            "default": "value"
          },
          "default": {
            "type": "number",
            "default": 0
          }
        },
        "required": ["component"]
      },
      "fixedDifficulty": {
        "type": "integer",
        "minimum": 0,
        "description": "Static difficulty for fixed_difficulty contest type"
      },
      "difficultyModifier": {
        "type": "integer",
        "default": 0,
        "description": "Static modifier applied to difficulty"
      },
      "formula": {
        "type": "string",
        "enum": ["ratio", "logistic", "linear"],
        "default": "ratio",
        "description": "Probability calculation formula"
      },
      "bounds": {
        "type": "object",
        "description": "Probability bounds (min/max chance)",
        "properties": {
          "min": {
            "type": "integer",
            "default": 5,
            "minimum": 0,
            "maximum": 100
          },
          "max": {
            "type": "integer",
            "default": 95,
            "minimum": 0,
            "maximum": 100
          }
        }
      },
      "modifiers": {
        "type": "array",
        "description": "Conditional modifiers to probability",
        "items": {
          "$ref": "#/definitions/chanceModifier"
        }
      },
      "outcomes": {
        "type": "object",
        "description": "Critical success/failure thresholds",
        "properties": {
          "criticalSuccessThreshold": {
            "type": "integer",
            "default": 5,
            "minimum": 1,
            "maximum": 100
          },
          "criticalFailureThreshold": {
            "type": "integer",
            "default": 95,
            "minimum": 1,
            "maximum": 100
          }
        }
      }
    },
    "required": ["enabled", "contestType", "actorSkill"]
  }
}
```

### chanceModifier Definition

Add to `definitions` section (this schema uses `definitions` not `$defs`):

```json
{
  "definitions": {
    "chanceModifier": {
      "type": "object",
      "description": "Conditional modifier to action success probability",
      "properties": {
        "condition": {
          "$ref": "./condition-container.schema.json",
          "description": "Condition that must be true for modifier to apply"
        },
        "modifier": {
          "type": "integer",
          "description": "Flat modifier to success chance (can be negative)"
        },
        "description": {
          "type": "string",
          "description": "Human-readable description of modifier"
        }
      },
      "required": ["condition", "modifier"]
    }
  }
}
```

## Out of Scope

- **DO NOT** modify any action definition files
- **DO NOT** create any service files
- **DO NOT** modify ActionFormattingStage (NONDETACTSYS-011)

## Test Files to Create

| File                                                   | Purpose                                          |
| ------------------------------------------------------ | ------------------------------------------------ |
| `tests/unit/schemas/action.chanceBased.schema.test.js` | Schema validation tests for chanceBased property |

## Acceptance Criteria

### Tests That Must Pass

```bash
# Validate all schemas
npm run validate

# Full validation suite
npm run test:ci
```

### Schema Validation Tests

The following action definition should pass validation:

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "weapons:swing_at_target",
  "name": "Swing at Target",
  "template": "swing {weapon} at {target} ({chance}%)",
  "chanceBased": {
    "enabled": true,
    "contestType": "opposed",
    "actorSkill": {
      "component": "skills:melee_skill",
      "property": "value",
      "default": 10
    },
    "targetSkill": {
      "component": "skills:defense_skill",
      "property": "value",
      "default": 0
    },
    "formula": "ratio",
    "bounds": { "min": 5, "max": 95 },
    "outcomes": {
      "criticalSuccessThreshold": 5,
      "criticalFailureThreshold": 95
    }
  }
}
```

### Invalid Definitions (Should Fail Validation)

```json
// Missing required contestType
{
  "chanceBased": {
    "enabled": true,
    "actorSkill": { "component": "skills:melee" }
  }
}

// Missing required actorSkill
{
  "chanceBased": {
    "enabled": true,
    "contestType": "opposed"
  }
}

// Invalid formula
{
  "chanceBased": {
    "enabled": true,
    "contestType": "opposed",
    "actorSkill": { "component": "skills:melee" },
    "formula": "invalid"
  }
}

// Bounds out of range
{
  "chanceBased": {
    "enabled": true,
    "contestType": "opposed",
    "actorSkill": { "component": "skills:melee" },
    "bounds": { "min": -5, "max": 150 }
  }
}
```

### Invariants That Must Remain True

- [x] Existing action definitions continue to validate
- [x] `chanceBased` is optional (actions without it still work)
- [x] All `$ref` references resolve correctly
- [x] Common schema references work for namespacedId
- [x] No breaking changes to existing action properties
- [x] Schema maintains backward compatibility

## Dependencies

- **Depends on**: Nothing
- **Blocked by**: Nothing
- **Blocks**: NONDETACTSYS-011 (ActionFormattingStage needs schema for validation)

## Reference Files

| File                                                 | Purpose                          |
| ---------------------------------------------------- | -------------------------------- |
| `data/schemas/action.schema.json`                    | File to modify                   |
| `data/schemas/common.schema.json`                    | Contains namespacedId definition |
| `data/schemas/condition-container.schema.json`       | Condition reference              |
| `data/mods/weapons/actions/wield_weapon.action.json` | Existing action pattern          |
