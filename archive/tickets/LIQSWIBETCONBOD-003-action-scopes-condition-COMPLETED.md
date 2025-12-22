# LIQSWIBETCONBOD-003: Swim Action + Scopes + Condition

## Goal
Add the swim-to-connected-liquid-body action with supporting scopes and condition, wired into the liquids mod manifest.

## File list (expected to touch)
- data/mods/liquids/actions/swim_to_connected_liquid_body.action.json
- data/mods/liquids/scopes/connected_liquid_bodies_for_actor.scope.json
- data/mods/liquids/scopes/connected_liquid_body_location.scope.json
- data/mods/liquids/conditions/event-is-action-swim-to-connected-liquid-body.condition.json
- data/mods/liquids/mod-manifest.json

## Out of scope
- Rule implementation (handled in a separate ticket).
- Test updates (handled in separate tickets).
- Any changes to movement or other existing liquids actions.

## Acceptance criteria
### Specific tests that must pass
- `npm run validate`

### Invariants that must remain true
- `contextFrom` is only used on non-primary targets (schema compliant).
- Action only targets connected liquid bodies for the actor's current body.
- Secondary target resolves a location entity based on the selected primary liquid body.

## Outcome

### Status: COMPLETED

### Files created/modified:
1. **data/mods/liquids/actions/swim_to_connected_liquid_body.action.json** - Created
   - Action with `chanceBased` using `fixed_difficulty` contest type (difficulty 50)
   - Primary target: `liquids:connected_liquid_bodies_for_actor` scope
   - Secondary target: `liquids:connected_liquid_body_location` scope with `contextFrom: "primary"`
   - Required components: `liquids-states:in_liquid_body`, `skills:mobility_skill`
   - Forbidden components: `physical-control-states:being_restrained`, `physical-control-states:restraining`, `positioning:fallen`
   - Blighted Moss visual scheme

2. **data/mods/liquids/scopes/connected_liquid_bodies_for_actor.scope** - Created
   - Uses `get_component_value` to dynamically fetch connected_liquid_body_ids from actor's current liquid body
   - Filters entities with `liquids:liquid_body` component

3. **data/mods/liquids/scopes/connected_liquid_body_location.scope** - Created
   - Receives target (connected liquid body) via `contextFrom: "primary"`
   - Filters entities with `locations:exits` where entity.id matches target's position locationId

4. **data/mods/liquids/conditions/event-is-action-swim-to-connected-liquid-body.condition.json** - Created
   - Standard event action check condition

5. **data/mods/liquids/mod-manifest.json** - Updated
   - Added action, scopes, and condition references

6. **tests/common/engine/systemLogicTestEnv.js** - Fixed
   - Fixed `simpleScopeResolver` to forward `target` and `targets` from context to `runtimeCtx`
   - This was blocking the secondary scope from resolving the target's location

### Tests:
- All 13 tests pass in `tests/integration/mods/liquids/swim_to_connected_liquid_body_action_discovery.test.js`
- `npm run validate` passes with 0 violations

### Key finding:
The test environment's `simpleScopeResolver` was not forwarding `target` from the resolution context to the `runtimeCtx` passed to `ScopeEngine.resolve()`. This prevented scope filters using `{"var": "target.components..."}` from accessing the target entity. Fixed by adding `target: context?.target, targets: context?.targets` to the `runtimeCtx` object.
