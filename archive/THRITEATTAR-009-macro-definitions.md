# THRITEATTAR-009: Create Outcome Macros for Throw Item Action

## Summary

Create the four outcome macros for the throw item action: Critical Success, Success (Hit), Failure (Miss), and Fumble. Each macro handles item dropping, message dispatch, and damage application as appropriate.

## Files to Create

| File | Purpose |
|------|---------|
| `data/mods/ranged/macros/handleThrowCritical.macro.json` | CRITICAL_SUCCESS outcome (1.5x damage) |
| `data/mods/ranged/macros/handleThrowHit.macro.json` | SUCCESS outcome (normal damage) |
| `data/mods/ranged/macros/handleThrowMiss.macro.json` | FAILURE outcome (no damage) |
| `data/mods/ranged/macros/handleThrowFumble.macro.json` | FUMBLE outcome (random collateral) |

## Implementation Details

### handleThrowCritical.macro.json

```json
{
  "$schema": "schema://living-narrative-engine/macro.schema.json",
  "id": "ranged:handleThrowCritical",
  "description": "Handles CRITICAL_SUCCESS outcome for thrown item attacks with 1.5x damage multiplier. Drops the thrown item.",
  "actions": [
    {
      "type": "UNWIELD_ITEM",
      "comment": "If item was wielded, unwield it first (idempotent)",
      "parameters": {
        "actorEntity": "{event.payload.actorId}",
        "itemEntity": "{event.payload.primaryId}"
      }
    },
    {
      "type": "DROP_ITEM_AT_LOCATION",
      "comment": "Thrown item lands at location",
      "parameters": {
        "actorEntity": "{event.payload.actorId}",
        "itemEntity": "{event.payload.primaryId}",
        "locationId": "{context.actorPosition.locationId}"
      }
    },
    {
      "type": "DISPATCH_PERCEPTIBLE_EVENT",
      "parameters": {
        "location_id": "{context.actorPosition.locationId}",
        "description_text": "{context.actorName} throws {context.throwableName} at {context.targetName}, and it lands a devastating blow!",
        "perception_type": "action_target_general",
        "actor_id": "{event.payload.actorId}",
        "target_id": "{event.payload.secondaryId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} throws {context.throwableName} at {context.targetName}, and it lands a devastating blow!"
      }
    },
    {
      "type": "DISPATCH_EVENT",
      "parameters": {
        "eventType": "core:display_successful_action_result",
        "payload": { "message": "{context.logMessage}" }
      }
    },
    {
      "type": "FOR_EACH",
      "parameters": {
        "collection": "context.throwableDamage",
        "item_variable": "dmgEntry",
        "actions": [
          {
            "type": "APPLY_DAMAGE",
            "parameters": {
              "entity_ref": "secondary",
              "damage_entry": { "var": "context.dmgEntry" },
              "damage_multiplier": 1.5
            }
          }
        ]
      }
    },
    {
      "macro": "core:endTurnOnly"
    }
  ]
}
```

### handleThrowHit.macro.json

```json
{
  "$schema": "schema://living-narrative-engine/macro.schema.json",
  "id": "ranged:handleThrowHit",
  "description": "Handles SUCCESS outcome for thrown item attacks with normal damage. Drops the thrown item.",
  "actions": [
    {
      "type": "UNWIELD_ITEM",
      "comment": "If item was wielded, unwield it first (idempotent)",
      "parameters": {
        "actorEntity": "{event.payload.actorId}",
        "itemEntity": "{event.payload.primaryId}"
      }
    },
    {
      "type": "DROP_ITEM_AT_LOCATION",
      "comment": "Thrown item lands at location",
      "parameters": {
        "actorEntity": "{event.payload.actorId}",
        "itemEntity": "{event.payload.primaryId}",
        "locationId": "{context.actorPosition.locationId}"
      }
    },
    {
      "type": "DISPATCH_PERCEPTIBLE_EVENT",
      "parameters": {
        "location_id": "{context.actorPosition.locationId}",
        "description_text": "{context.actorName} throws {context.throwableName} at {context.targetName}, and it hits the target.",
        "perception_type": "action_target_general",
        "actor_id": "{event.payload.actorId}",
        "target_id": "{event.payload.secondaryId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} throws {context.throwableName} at {context.targetName}, and it hits the target."
      }
    },
    {
      "type": "DISPATCH_EVENT",
      "parameters": {
        "eventType": "core:display_successful_action_result",
        "payload": { "message": "{context.logMessage}" }
      }
    },
    {
      "type": "FOR_EACH",
      "parameters": {
        "collection": "context.throwableDamage",
        "item_variable": "dmgEntry",
        "actions": [
          {
            "type": "APPLY_DAMAGE",
            "parameters": {
              "entity_ref": "secondary",
              "damage_entry": { "var": "context.dmgEntry" }
            }
          }
        ]
      }
    },
    {
      "macro": "core:endTurnOnly"
    }
  ]
}
```

### handleThrowMiss.macro.json

```json
{
  "$schema": "schema://living-narrative-engine/macro.schema.json",
  "id": "ranged:handleThrowMiss",
  "description": "Handles FAILURE outcome for thrown item attacks - misses target, item is dropped.",
  "actions": [
    {
      "type": "UNWIELD_ITEM",
      "comment": "If item was wielded, unwield it first (idempotent)",
      "parameters": {
        "actorEntity": "{event.payload.actorId}",
        "itemEntity": "{event.payload.primaryId}"
      }
    },
    {
      "type": "DROP_ITEM_AT_LOCATION",
      "comment": "Thrown item lands at location",
      "parameters": {
        "actorEntity": "{event.payload.actorId}",
        "itemEntity": "{event.payload.primaryId}",
        "locationId": "{context.actorPosition.locationId}"
      }
    },
    {
      "type": "DISPATCH_PERCEPTIBLE_EVENT",
      "parameters": {
        "location_id": "{context.actorPosition.locationId}",
        "description_text": "{context.actorName} throws {context.throwableName} at {context.targetName}, but the {context.throwableName} flies past the target.",
        "perception_type": "action_target_general",
        "actor_id": "{event.payload.actorId}",
        "target_id": "{event.payload.secondaryId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} throws {context.throwableName} at {context.targetName}, but the {context.throwableName} flies past the target."
      }
    },
    {
      "macro": "core:logFailureOutcomeAndEndTurn"
    }
  ]
}
```

### handleThrowFumble.macro.json

```json
{
  "$schema": "schema://living-narrative-engine/macro.schema.json",
  "id": "ranged:handleThrowFumble",
  "description": "Handles FUMBLE outcome for thrown item attacks - may hit unintended target or miss completely.",
  "actions": [
    {
      "type": "UNWIELD_ITEM",
      "comment": "If item was wielded, unwield it first (idempotent)",
      "parameters": {
        "actorEntity": "{event.payload.actorId}",
        "itemEntity": "{event.payload.primaryId}"
      }
    },
    {
      "type": "DROP_ITEM_AT_LOCATION",
      "comment": "Thrown item lands at location",
      "parameters": {
        "actorEntity": "{event.payload.actorId}",
        "itemEntity": "{event.payload.primaryId}",
        "locationId": "{context.actorPosition.locationId}"
      }
    },
    {
      "type": "PICK_RANDOM_ENTITY",
      "comment": "Try to find a random non-actor entity at location (excluding actor and target)",
      "parameters": {
        "location_id": "{context.actorPosition.locationId}",
        "exclude_entities": [
          "{event.payload.actorId}",
          "{event.payload.secondaryId}"
        ],
        "exclude_components": ["core:actor"],
        "result_variable": "fumbleVictim"
      }
    },
    {
      "type": "IF",
      "comment": "If we found a non-actor entity to hit",
      "parameters": {
        "condition": { "!!": { "var": "context.fumbleVictim" } },
        "then_actions": [
          {
            "type": "GET_NAME",
            "parameters": {
              "entity_ref": { "var": "context.fumbleVictim" },
              "result_variable": "fumbleVictimName"
            }
          },
          {
            "type": "DISPATCH_PERCEPTIBLE_EVENT",
            "parameters": {
              "location_id": "{context.actorPosition.locationId}",
              "description_text": "{context.actorName} throws {context.throwableName} wildly at {context.targetName}, but the {context.throwableName} flies past the target and hits {context.fumbleVictimName} instead!",
              "perception_type": "action_target_general",
              "actor_id": "{event.payload.actorId}",
              "target_id": "{event.payload.secondaryId}"
            }
          },
          {
            "type": "SET_VARIABLE",
            "parameters": {
              "variable_name": "logMessage",
              "value": "{context.actorName} throws {context.throwableName} wildly at {context.targetName}, but the {context.throwableName} flies past the target and hits {context.fumbleVictimName} instead!"
            }
          }
        ],
        "else_actions": [
          {
            "type": "DISPATCH_PERCEPTIBLE_EVENT",
            "comment": "No entity to hit - complete miss",
            "parameters": {
              "location_id": "{context.actorPosition.locationId}",
              "description_text": "{context.actorName} throws {context.throwableName} wildly at {context.targetName}, but the throw misses by a long shot!",
              "perception_type": "action_target_general",
              "actor_id": "{event.payload.actorId}",
              "target_id": "{event.payload.secondaryId}"
            }
          },
          {
            "type": "SET_VARIABLE",
            "parameters": {
              "variable_name": "logMessage",
              "value": "{context.actorName} throws {context.throwableName} wildly at {context.targetName}, but the throw misses by a long shot!"
            }
          }
        ]
      }
    },
    {
      "macro": "core:logFailureOutcomeAndEndTurn"
    }
  ]
}
```

## Macro Behavior Summary

| Macro | Item Dropped | Damage Applied | Message Type |
|-------|-------------|----------------|--------------|
| Critical | Yes | 1.5x multiplier | Success |
| Hit | Yes | 1.0x (normal) | Success |
| Miss | Yes | None | Failure |
| Fumble | Yes | None (hits furniture) | Failure |

## Out of Scope

- **DO NOT** modify any existing macros
- **DO NOT** modify the macro schema
- **DO NOT** create the rule (THRITEATTAR-008)
- **DO NOT** create the PICK_RANDOM_ENTITY operation (THRITEATTAR-005, 006, 007)
- **DO NOT** create test files (THRITEATTAR-012)

## Acceptance Criteria

### Tests That Must Pass

1. `npm run validate` completes without errors
2. All macro JSONs pass schema validation against `macro.schema.json`
3. All macros are valid JSON (parseable without errors)
4. All referenced operations exist in pre-validation whitelist

### Invariants That Must Remain True

1. All existing macros continue to function correctly
2. Macro IDs are unique across all mods
3. Referenced core macros exist: `core:endTurnOnly`, `core:logFailureOutcomeAndEndTurn`
4. Referenced operations exist and are registered
5. `PICK_RANDOM_ENTITY` operation is used correctly in fumble macro

## Validation Commands

```bash
# Verify all macros are valid JSON
for f in data/mods/ranged/macros/*.json; do
  node -e "JSON.parse(require('fs').readFileSync('$f'))" && echo "✓ $f"
done

# Run project validation
npm run validate
```

## Reference Files

For understanding macro patterns:
- `data/mods/weapons/macros/handleMeleeCritical.macro.json` - Critical hit pattern
- `data/mods/weapons/macros/handleMeleeFumble.macro.json` - Fumble pattern
- `data/mods/core/macros/endTurnOnly.macro.json` - Turn ending macro
- `data/mods/core/macros/logFailureOutcomeAndEndTurn.macro.json` - Failure logging macro

## Dependencies

- THRITEATTAR-001 (mod structure must exist)
- THRITEATTAR-007 (PICK_RANDOM_ENTITY must be registered for fumble macro)

## Blocks

- THRITEATTAR-012 (integration tests verify macro execution)

## Outcome

The four macros for the ranged throw item action were created:
- `data/mods/ranged/macros/handleThrowCritical.macro.json`
- `data/mods/ranged/macros/handleThrowHit.macro.json`
- `data/mods/ranged/macros/handleThrowMiss.macro.json`
- `data/mods/ranged/macros/handleThrowFumble.macro.json`

Validation (`npm run validate`) was performed, and no schema or cross-reference violations were detected.
The ticket's assumptions about `PICK_RANDOM_ENTITY` and core macros were confirmed to be valid.

**Status: Completed**
