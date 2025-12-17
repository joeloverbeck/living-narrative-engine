# Perception Type Legacy Cleanup Specification

## Overview

This specification documents the current state of the `perceptionType` system and provides a plan for removing all legacy (non-dotted) perception type values from the codebase.

## Current State Analysis

### Schema Definition

**File**: `data/schemas/common.schema.json` (lines 41-124)

The `perceptionType` enum currently contains **80 values**:
- **35 new-format types** (dotted notation like `category.type`) - lines 45-79
- **44 legacy types** (snake_case without dots) - lines 80-123

### New Format Types (35 total)

All valid perception types use the `category.type` format:

| Category | Types | Count |
|----------|-------|-------|
| communication | speech, thought, notes | 3 |
| movement | arrival, departure, navigation | 3 |
| combat | attack, damage, death, violence | 4 |
| item | pickup, drop, transfer, use, examine | 5 |
| container | open, take, put | 3 |
| connection | lock, unlock | 2 |
| consumption | consume | 1 |
| state | observable_change | 1 |
| social | gesture, interaction, affection | 3 |
| physical | self_action, target_action | 2 |
| intimacy | sexual, sensual | 2 |
| performance | music, dance | 2 |
| magic | spell, ritual | 2 |
| error | system_error, action_failed | 2 |

**Note**: `movement.navigation` is in the schema but NOT in the registry. A test explicitly confirms it should not be used (`tests/integration/mods/movement/feel_your_way_to_an_exit_rule_execution.test.js:692`).

### Legacy Types (44 total - to be removed)

The following types do NOT have the `category.type` structure and should be removed:

```
action_self_general        → physical.self_action
action_target_general      → physical.target_action
character_enter            → movement.arrival
character_exit             → movement.departure
combat_attack              → combat.attack
combat_effect              → combat.damage
connection_lock_failed     → error.action_failed
connection_locked          → connection.lock
connection_unlock_failed   → error.action_failed
connection_unlocked        → connection.unlock
container_open_failed      → error.action_failed
container_opened           → container.open
damage_received            → combat.damage
dimensional_arrival        → movement.arrival
dimensional_departure      → movement.departure
drink_consumed             → consumption.consume
entity_died                → combat.death
error                      → error.system_error
food_consumed              → consumption.consume
item_drop                  → item.drop
item_dropped               → item.drop
item_examined              → item.examine
item_pickup                → item.pickup
item_pickup_failed         → error.action_failed
item_picked_up             → item.pickup
item_put_in_container      → container.put
item_put_on_nearby_surface → container.put
item_read                  → item.examine
item_taken_from_container  → container.take
item_taken_from_nearby_surface → container.take
item_transfer              → item.transfer
item_transfer_failed       → error.action_failed
item_use                   → item.use
liquid_consumed            → consumption.consume
liquid_consumed_entirely   → consumption.consume
notes_jotted               → communication.notes
put_in_container_failed    → error.action_failed
put_on_nearby_surface_failed → error.action_failed
rest_action                → physical.self_action
speech_local               → communication.speech
state_change_observable    → state.observable_change
take_from_container_failed → error.action_failed
take_from_nearby_surface_failed → error.action_failed
thought_internal           → communication.thought
```

## Codebase Usage Analysis

### Mod Files: 100% Migrated

**All mod files in `data/mods/*/rules/` and `data/mods/*/macros/` use the new dotted format.**

Search for legacy types yielded **zero results** in mod files:
- No `action_self_general`, `action_target_general` in rules
- No `speech_local`, `thought_internal` in rules
- No other legacy types found in any mod files

### Perception Type Values Found in Mods (86 total instances)

| Type | Count | Format |
|------|-------|--------|
| magic.spell | 19 | NEW ✅ |
| error.action_failed | 11 | NEW ✅ |
| physical.target_action | 10 | NEW ✅ |
| combat.attack | 9 | NEW ✅ |
| {context.perceptionType} | 8 | Template |
| movement.arrival | 5 | NEW ✅ |
| physical.self_action | 4 | NEW ✅ |
| movement.departure | 4 | NEW ✅ |
| item.examine | 4 | NEW ✅ |
| consumption.consume | 4 | NEW ✅ |
| state.observable_change | 2 | NEW ✅ |
| communication.notes | 2 | NEW ✅ |
| social.affection | 1 | NEW ✅ |
| communication.thought | 1 | NEW ✅ |
| communication.speech | 1 | NEW ✅ |
| combat.violence | 1 | NEW ✅ |

### Schema Files with Legacy References

1. **`data/schemas/common.schema.json`** (lines 80-123)
   - Contains all 44 legacy types in the enum
   - **Action**: Remove these values

2. **`data/schemas/operations/prepareActionContext.schema.json`** (line 16)
   - Default value: `"action_target_general"`
   - **Action**: Change default to `"physical.target_action"`

### Source Code Files

**`src/perception/registries/perceptionTypeRegistry.js`** (lines 453-454)
- Contains manual mappings for `action_self_general` and `action_target_general`
- These mappings exist because these legacy types are NOT in the registry's `legacyTypes` arrays
- **Action**: After schema cleanup, these manual mappings can be removed

## UI Coloring Issue

### Problem Statement

The Perception Log section in `game.html` applies specific coloring based on the `perceptionType` category extracted from the dotted format. However, entries without dots (legacy types) cannot be categorized and receive default styling.

### Current Behavior

The `perceptionLogRenderer.js` uses `getPerceptionTypeMetadata()` from the registry to:
1. Extract the category from the type (e.g., `communication` from `communication.speech`)
2. Apply category-specific CSS classes (e.g., `log-cat-communication`)
3. Apply type-specific CSS classes (e.g., `log-type-speech`)

Legacy types without dots:
- Do not match any registry entry directly
- Are mapped via `LEGACY_TYPE_MAP` to their new equivalents
- Still work due to the backward-compatibility layer

### Registry Architecture

**File**: `src/perception/registries/perceptionTypeRegistry.js`

The registry provides:
- `PERCEPTION_TYPE_REGISTRY`: 32 new-format types with metadata
- `PERCEPTION_CATEGORIES`: 14 category definitions with theme colors
- `LEGACY_TYPE_MAP`: Auto-built from `legacyTypes` arrays in registry entries
- Helper functions: `isValidPerceptionType()`, `normalizePerceptionType()`, `getLegacyTypeMapping()`, etc.

## Remediation Plan

### Phase 1: Update Schema Default

**File**: `data/schemas/operations/prepareActionContext.schema.json`

Change line 16:
```json
// Before
"default": "action_target_general",

// After
"default": "physical.target_action",
```

### Phase 2: Update Handler Default (if applicable)

**File**: `src/logic/operationHandlers/prepareActionContextHandler.js`

Check if the handler uses a hardcoded default. If so, update to `"physical.target_action"`.

### Phase 3: Remove Legacy Types from Schema

**File**: `data/schemas/common.schema.json`

Remove lines 80-123 (all legacy types from the enum).

The enum should contain only the 35 dotted-format types (lines 45-79).

### Phase 4: Clean Up Registry (Optional)

**File**: `src/perception/registries/perceptionTypeRegistry.js`

Remove lines 453-454 (manual mappings for `action_self_general` and `action_target_general`).

These were added as a fallback for types not in the registry's `legacyTypes` arrays.

### Phase 5: Remove movement.navigation from Schema

**File**: `data/schemas/common.schema.json`

Remove `"movement.navigation"` (line 79) since:
- It's not in the registry
- There's a test explicitly checking it's not used
- It may have been added prematurely

### Phase 6: Validate

Run validation and tests to ensure no regressions:

```bash
npm run validate
npm run test:unit
npm run test:integration
```

## Files to Modify

| File | Action |
|------|--------|
| `data/schemas/common.schema.json` | Remove 45 legacy types from enum (lines 79-123) |
| `data/schemas/operations/prepareActionContext.schema.json` | Change default from `action_target_general` to `physical.target_action` |
| `src/perception/registries/perceptionTypeRegistry.js` | Remove manual mappings for `action_self_general`/`action_target_general` (optional, after schema update) |

## Risk Assessment

### Low Risk
- **Mod files**: Already 100% migrated to new format
- **Runtime**: Registry's `LEGACY_TYPE_MAP` provides backward compatibility during transition
- **UI**: Already works correctly with new format types

### Medium Risk
- **External integrations**: Any external tools or scripts using legacy types will need updating
- **Documentation**: User documentation may reference legacy types

### Mitigation
- The registry's deprecation warnings will alert users of legacy type usage
- The migration script (`scripts/migratePerceptionTypes.js`) can be re-run to verify migration completeness

## Success Criteria

1. ✅ All 44 legacy types removed from `common.schema.json`
2. ✅ Schema default updated in `prepareActionContext.schema.json`
3. ✅ All tests pass
4. ✅ No deprecation warnings logged during runtime
5. ✅ Perception Log displays correct category colors for all entries

## Appendix: Existing Documentation

A comprehensive specification already exists at:
`archive/specs/perceptionType-consolidation.md`

This document was created during the original migration effort and contains:
- Complete type taxonomy (14 categories, 32 types)
- Legacy-to-new type mappings
- Registry architecture details
- UI theming specifications
- Migration script documentation

## Conclusion

The perceptionType system migration is **effectively complete**. All mod files use the new dotted format, and the backward-compatibility layer handles any remaining legacy references. The remaining task is to clean up the schema by removing the legacy types that are no longer used, which will:

1. Prevent accidental use of deprecated types in new content
2. Simplify the schema definition
3. Ensure all perception log entries can be properly categorized and colored
