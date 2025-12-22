# Liquids Mod: Canal Interaction Spec

## Summary

The dredgers canal locations already describe a contiguous body of water (canal run) that actors can plausibly enter, exit, and traverse. This spec defines a new `liquids` mod that marks liquid bodies as in-world entities, adds a scope for liquid bodies at the actor's location, and introduces an initial action/rule pair for entering a liquid body. The rule will attach a new `liquids-states:in_liquid_body` state component with activity description metadata and emit sense-aware perceptible messages plus a success action result. Tests will cover action discoverability and rule behavior.

## Location Analysis (Canal Presence)

The following location definitions explicitly describe a water channel/canal suitable for entering or traversing:

- `data/mods/dredgers/entities/definitions/access_point_segment_a.location.json`
  - Mentions "actual channel of stagnant, tar-dark water" beside the footpath.
- `data/mods/dredgers/entities/definitions/segment_b.location.json`
  - Describes "muddied footpath beside the water channel" with slow, greasy water.
- `data/mods/dredgers/entities/definitions/segment_c.location.json`
  - Notes a close water channel, opaque water, and a pull toward it.
- `data/mods/dredgers/entities/definitions/flooded_approach.location.json`
  - Explicitly describes a wading route through contaminated water.

These should gain explicit liquid-body entities so systems can target them, track actor state in water, and support new actions.

## Goals

- Add a `liquids` mod with a `liquids:liquid_body` component for marking liquid entities.
- Add a `liquids-states:in_liquid_body` component for actors, with activity description metadata.
- Add a liquid-body scope targeting entities at the actor's location.
- Add an initial action/rule: enter a liquid body.
- Ensure the rule dispatches a successful action message and a sense-aware perceptible event.
- Establish a color scheme for the new mod, aligned with existing scheme docs.
- Define tests for discoverability and rule behavior.

## Non-Goals (For This Spec)

- Swimming between connected liquid bodies.
- Climbing out of liquid bodies.
- Pathfinding or cross-location traversal in liquids.
- Water hazards, damage, or contamination mechanics.

## New Mod: `data/mods/liquids/`

### Mod Manifest

Create `data/mods/liquids/mod-manifest.json` with content sections for components, scopes, actions, conditions, rules, and (initially empty) entities/events/macros. Dependencies should include any state mods required by the forbidden component list (mirroring `sitting` action dependencies). Use `sitting/mod-manifest.json` as a template for structure.

### Components

1. `data/mods/liquids/components/liquid_body.component.json`
   - Purpose: marks an entity as a liquid body.
   - Data schema: allow an empty object (tag-like). Optional fields can be added later (e.g., `depth`, `liquid_type`) but keep minimal for now.

2. `data/mods/liquids-states/components/in_liquid_body.component.json`
   - Purpose: actor state indicating they are currently in a liquid body.
   - Data schema:
     - Required: `liquid_body_id` (namespaced ID of the liquid body entity).
     - Optional: `activityMetadata` (inline per activity description system).
   - Activity metadata should mirror the pattern in `data/mods/sitting-states/components/sitting_on.component.json` and `docs/activity-description-system/`:
     - `shouldDescribeInActivity`: true
     - `template`: "{actor} is in {target}"
     - `targetRole`: `liquid_body_id`
     - `priority`: choose a value around the sitting state priority (e.g., 62) unless the team prefers a higher/lower ordering.

### Liquid Body Entities (Dredgers Content)

Add liquid body entities in the dredgers mod so the scope has targets:

- `data/mods/dredgers/entities/definitions/`:
  - Define four liquid bodies, one for each canal segment/approach.
  - Example definition content:
    - `core:name` (e.g., "canal run (segment A)")
    - `core:description` (short, optional)
    - `liquids:liquid_body` {}
- `data/mods/dredgers/entities/instances/`:
  - Place each liquid body at its corresponding location via `core:position.locationId`.

This keeps the existing locations unchanged while providing explicit entities for interactions.

### Scope

Create `data/mods/liquids/scopes/liquid_bodies_at_location.scope`.

- Pattern should match `data/mods/items/scopes/items_at_location.scope` and `docs/scopeDsl/README.md`:

```
liquids:liquid_bodies_at_location := entities(liquids:liquid_body)[][{"and": [
  {"==": [
    {"var": "entity.components.core:position.locationId"},
    {"var": "actor.components.core:position.locationId"}
  ]}
]}]
```

This assumes liquid body entities include `core:position` (set on instances).

### Action: Enter Liquid Body

Create `data/mods/liquids/actions/enter_liquid_body.action.json`:

- `id`: `liquids:enter_liquid_body`
- `targets.primary`:
  - `scope`: `liquids:liquid_bodies_at_location`
  - `placeholder`: `liquidBody`
  - `description`: "Liquid body to enter"
- `template`: "enter the {liquidBody}"
- `forbidden_components.actor`:
  - Same list as `data/mods/sitting/actions/sit_down.action.json`, plus `liquids-states:in_liquid_body` to prevent entering when already in water.
- `visual`: use the chosen liquids color scheme.

### Condition

Create `data/mods/liquids/conditions/event-is-action-enter-liquid-body.condition.json` mirroring other event-is-action conditions.

### Rule: Handle Enter Liquid Body

Create `data/mods/liquids/rules/handle_enter_liquid_body.rule.json` similar to `data/mods/breaching/rules/handle_saw_through_barred_blocker.rule.json` for sense-aware logging.

Core actions:

- Resolve names for actor and liquid body (`GET_NAME`).
- Query actor position (`QUERY_COMPONENT` for `core:position`).
- Add `liquids-states:in_liquid_body` to actor with `liquid_body_id: {event.payload.targetId}`.
- Dispatch a sense-aware perceptible event (`DISPATCH_PERCEPTIBLE_EVENT`) with:
  - `description_text`: "{actor} enters the {liquidBody}."
  - `actor_description`: "I enter the {liquidBody}."
  - `perception_type`: `physical.self_action`
  - `actor_id`: actor id
  - `target_id`: liquid body id
  - `alternate_descriptions` (auditory), e.g., "You hear a splash as someone enters the water."
- Dispatch `core:display_successful_action_result` with the same message.
- Dispatch `core:action_success` and `END_TURN`.
- Optionally `REGENERATE_DESCRIPTION` for the actor so activity summaries update immediately.

Avoid macros like `core:logSuccessAndEndTurn` so the rule can include `alternate_descriptions` per `docs/modding/sense-aware-perception.md`.

## Visual Scheme Selection

Use an existing available scheme if possible. `16.2 Blighted Moss` (from `docs/mods/mod-color-schemes-available.md`) is the closest fit for contaminated canal water and submerged traversal. It is currently available and designed as a bog/decay palette.

Required doc updates (future implementation):

- Move `16.2 Blighted Moss` from available to used.
- Add `Liquids` entry to the used schemes table in `docs/mods/mod-color-schemes-used.md`.
- Update counts in both documents.

If the team rejects `Blighted Moss`, define a new WCAG-compliant scheme with water/teal tones and add it per the color scheme docs, then assign it to `Liquids`.

## Testing Requirements

Add comprehensive integration tests covering both discoverability and rule behavior. Suggested structure (patterned after `tests/integration/mods/...`):

1. `tests/integration/mods/liquids/enter_liquid_body_action_discovery.test.js`
   - Validates action metadata (id, template, visual scheme, target placeholder).
   - Ensures the liquid body scope resolves entities at the same location.
   - Verifies forbidden components (matches `sit_down` list + `liquids-states:in_liquid_body`).
   - Ensures action is not discoverable if the actor already has `liquids-states:in_liquid_body`.

2. `tests/integration/mods/liquids/enter_liquid_body_action.test.js`
   - Executes the action successfully.
   - Confirms the actor gains `liquids-states:in_liquid_body` with the correct `liquid_body_id`.
   - Confirms `core:perceptible_event` is dispatched with correct payload fields (including `actorDescription` and `alternateDescriptions`).
   - Confirms `core:display_successful_action_result` message and `core:turn_ended` success.

Use `ModTestFixture` and `ModEntityBuilder` patterns from existing integration tests.

## Open Questions

- Should the liquid body entities carry additional metadata (depth, contamination, swim difficulty) from the start?
- Should `liquids-states:in_liquid_body` block other movement/positioning actions beyond the `sit_down` forbidden list?
- Do we want a shared canal entity across segments or separate entities per location for easier navigation logic later?

