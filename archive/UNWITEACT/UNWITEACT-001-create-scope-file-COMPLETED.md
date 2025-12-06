# UNWITEACT-001: Create `wielded_items.scope` File

## Status: ✅ COMPLETED

## Summary

Create a new scope file that returns all entity IDs of items currently being wielded by an actor. This scope will be used by the `unwield_item` action to provide valid targets (items that can be unwielded).

## Dependencies

- None (can be implemented independently)

## File Created

### `data/mods/weapons/scopes/wielded_items.scope`

```
weapons:wielded_items := actor.components.positioning:wielding.wielded_item_ids[]
```

This scope:

- Accesses the actor's `positioning:wielding` component
- Retrieves the `wielded_item_ids` array
- Uses the `[]` operator to iterate and return all entity IDs in the array

## Files Modified

None

## Out of Scope

- **DO NOT** modify any existing scope files ✅ (preserved)
- **DO NOT** modify the `positioning:wielding` component definition ✅ (preserved)
- **DO NOT** modify any action or rule files ✅ (preserved)
- **DO NOT** modify `mod-manifest.json` (scopes are auto-discovered) ✅ (preserved)

## Implementation Notes

The scope follows the established pattern in the weapons mod. Compare with existing scope:

```
# weapons:weapons_in_inventory.scope (actual)
weapons:weapons_in_inventory := actor.components.items:inventory.items[][{"!!": {"var": "entity.components.weapons:weapon"}}]
```

The new scope follows a simpler pattern (no filtering needed) as it directly returns entity IDs from the `wielded_item_ids` array.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run validate                           # ✅ Schema validation passes
npm run scope:lint                         # ✅ Scope DSL validation passes (104 scopes valid)
npm run test:integration -- --testPathPattern="weapons"  # ✅ All 95 tests pass (10 suites)
```

### Manual Verification

1. ✅ Scope file exists at `data/mods/weapons/scopes/wielded_items.scope`
2. ✅ File content matches the spec exactly (single line, correct syntax)
3. ✅ No syntax errors when loading scopes

### Invariants That Must Remain True

1. ✅ All existing weapons tests pass (88 → 95 tests with new test file)
2. ✅ All existing scopes in the weapons mod remain unchanged
3. ✅ No changes to any other files in the repository (except new test file)

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Planned:**

- Create `data/mods/weapons/scopes/wielded_items.scope`

**Actual:**

- ✅ Created `data/mods/weapons/scopes/wielded_items.scope` (exactly as specified)
- ✅ Created `tests/integration/mods/weapons/wielded_items_scope.integration.test.js` (7 tests added to ensure comprehensive coverage)

### Assumption Verification

The ticket's assumptions were **verified correct**:

- ✅ `positioning:wielding` component exists at `data/mods/positioning/components/wielding.component.json`
- ✅ `wielded_item_ids` field exists as an array of entity IDs (namespaced IDs, uniqueItems: true)

### Tests Added

| Test File                                                                | Tests | Rationale                                                                                                                    |
| ------------------------------------------------------------------------ | ----- | ---------------------------------------------------------------------------------------------------------------------------- |
| `tests/integration/mods/weapons/wielded_items_scope.integration.test.js` | 7     | Validates scope correctly returns wielded item IDs, handles edge cases (empty array, missing component), and preserves order |

### Validation Results

- `npm run validate`: ✅ Pass
- `npm run scope:lint`: ✅ 104 scope files valid
- Weapons integration tests: ✅ 95 tests pass (10 suites)

### Completion Date

2025-11-26
