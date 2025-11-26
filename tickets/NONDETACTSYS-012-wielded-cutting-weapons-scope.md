# NONDETACTSYS-012: Create wielded_cutting_weapons Scope

## Summary

Create a Scope DSL file that resolves to weapons the actor is wielding that have the `damage-types:can_cut` component. This scope is used by the `swing_at_target` action to identify valid primary targets.

## Files to Create

| File | Purpose |
|------|---------|
| `data/mods/weapons/scopes/wielded_cutting_weapons.scope` | Scope definition |

## Implementation Details

### wielded_cutting_weapons.scope

```
// Scope: weapons:wielded_cutting_weapons
// Description: Returns weapons the actor is wielding that can deal cutting damage
// Usage: Primary target scope for swing_at_target action

actor.positioning:wielding.weapon_id[{
  "and": [
    { "hasComponent": [{ "var": "" }, "weapons:weapon"] },
    { "hasComponent": [{ "var": "" }, "damage-types:can_cut"] }
  ]
}]
```

### Scope Resolution Logic

1. **Start**: `actor` - The entity performing the action
2. **Navigate**: `.positioning:wielding` - Get wielding component data
3. **Access**: `.weapon_id` - Get the weapon entity ID
4. **Filter**: JSON Logic condition requiring both:
   - Entity has `weapons:weapon` component
   - Entity has `damage-types:can_cut` component

### Expected Behavior

| Scenario | Result |
|----------|--------|
| Actor wielding longsword (has can_cut) | Returns [longsword_id] |
| Actor wielding mace (no can_cut) | Returns [] |
| Actor wielding two swords (both can_cut) | Returns [sword1_id, sword2_id] |
| Actor not wielding anything | Returns [] |

## Out of Scope

- **DO NOT** modify existing scopes
- **DO NOT** create action definitions (NONDETACTSYS-013)
- **DO NOT** modify weapon entities (NONDETACTSYS-015)
- **DO NOT** create service files
- **DO NOT** create unit tests (scope validation is handled by lint)

## Acceptance Criteria

### Tests That Must Pass

```bash
# Scope DSL validation
npm run scope:lint

# Full validation
npm run validate

# Full test suite
npm run test:ci
```

### Manual Verification

1. Load game with a character wielding a cutting weapon
2. Verify action discovery finds the weapon via this scope
3. Verify non-cutting weapons are excluded

### Invariants That Must Remain True

- [ ] Scope follows existing DSL syntax
- [ ] Scope file is in correct location (`data/mods/weapons/scopes/`)
- [ ] No modifications to existing scopes
- [ ] Scope ID matches file naming convention
- [ ] JSON Logic filter syntax is valid
- [ ] `hasComponent` operator is used correctly

## Dependencies

- **Depends on**:
  - NONDETACTSYS-002 (damage-types mod with can_cut component)
- **Blocked by**: NONDETACTSYS-002
- **Blocks**: NONDETACTSYS-013 (swing_at_target needs this scope)

## Reference Files

| File | Purpose |
|------|---------|
| `data/mods/weapons/scopes/wielded_weapon_ids.scope` | Existing weapons scope pattern |
| `data/mods/core/scopes/actors_in_location.scope` | Scope with filter pattern |
| `docs/modding/scope-dsl-reference.md` | DSL syntax reference |

## Scope DSL Syntax Reference

From CLAUDE.md:
- `.` - Field access
- `[]` - Array iteration
- `[{...}]` - JSON Logic filters
- `hasComponent` - Checks if entity has component
