# Liquid Body Swim Action + Connected Bodies Spec

## Overview

This spec defines a new swim action/rule that lets an actor move between connected liquid bodies, extends the liquid body component to encode connections, and introduces a mobility skill. It is based on the existing liquid body data in the dredgers mod, current liquids actions/rules, and chance-based action patterns.

## Analysis Summary (Current Content)

### Liquid Body Entities

From `data/mods/dredgers/entities/definitions/*.entity.json`:
- `dredgers:canal_run_segment_a_liquid_body`
- `dredgers:canal_run_segment_b_liquid_body`
- `dredgers:canal_run_segment_c_liquid_body`
- `dredgers:flooded_approach_liquid_body`

Each definition only includes `liquids:liquid_body` as a marker component and has a matching instance with a `core:position.locationId` override.

### Liquid Body Components

- `data/mods/liquids/components/liquid_body.component.json` is a marker component with empty data.
- `data/mods/liquids-states/components/in_liquid_body.component.json` tracks the current liquid body via `liquid_body_id`.

### Liquids Actions and Rules

- `data/mods/liquids/actions/enter_liquid_body.action.json` and `data/mods/liquids/actions/climb_out_of_liquid_body.action.json` use `liquids:liquid_bodies_at_location` and `liquids:liquid_body_actor_is_in` scopes.
- `data/mods/liquids/rules/handle_enter_liquid_body.rule.json` and `handle_climb_out_of_liquid_body.rule.json` update `liquids-states:in_liquid_body`, call `REGENERATE_DESCRIPTION`, and dispatch perceptible events.

### Movement Actions and Rules (for reference)

- `data/mods/movement/actions/go.action.json` forbids actors in `liquids-states:in_liquid_body` and uses a single target scope.
- `data/mods/movement/actions/pass_through_breach.action.json` demonstrates multi-target usage with `contextFrom: "primary"` and resolves `secondary` destination from `movement:destinations_for_breached_blocker`.
- `data/mods/movement/rules/go.rule.json` and `pass_through_breach.rule.json` show the standard movement flow: dispatch departure/arrival perceptible events, update `core:position`, emit `core:entity_moved`, and display success.

### ContextFrom Usage (Action Targets)

All current uses of `contextFrom` are on secondary or tertiary targets, consistent with `data/schemas/action.schema.json`:
- `containers:take_from_container` + `containers-core:container_contents` (`target` refers to primary container)
- `locks:unlock_connection` + `locks:keys_for_blocker` (`target` refers to primary blocker)
- `movement:pass_through_breach` + `movement:destinations_for_breached_blocker` (`target` refers to primary breached blocker)

Relevant scope patterns:
- `data/mods/containers-core/scopes/container_contents.scope`: `target.<component>`
- `data/mods/locks/scopes/keys_for_blocker.scope`: `target.components...`
- `data/mods/movement/scopes/destinations_for_breached_blocker.scope`: `target.id` / `target` comparisons

Note: `contextFrom` is **not valid** on `primary` targets per schema. This impacts the requested target layout and is called out in Open Questions below.

### Chance-Based Action Patterns (fixed_difficulty)

Actions using `chanceBased` + `contestType: fixed_difficulty`:
- `movement:feel_your_way_to_an_exit` (fixedDifficulty 50)
- `first-aid:treat_my_wounded_part` (fixedDifficulty 50)
- `first-aid:treat_wounded_part` (fixedDifficulty 50)
- `warding:draw_salt_boundary` (fixedDifficulty 50)

Rule handling pattern in `data/mods/movement/rules/handle_feel_your_way_to_an_exit.rule.json`:
- `RESOLVE_OUTCOME` resolves outcome using the skill + difficulty.
- Separate `IF` blocks handle `CRITICAL_SUCCESS`, `SUCCESS`, `FAILURE`, `FUMBLE`.
- Uses sense-aware `DISPATCH_PERCEPTIBLE_EVENT` with `actor_description` + `alternate_descriptions`.

## Required Data Extensions

### 1) Extend `liquids:liquid_body` Component

Update `data/mods/liquids/components/liquid_body.component.json` to include an **optional** array of connected liquid bodies.

Proposed schema shape (final field name to be confirmed):
- `connected_liquid_body_ids`: array of `namespacedId`, unique, default `[]`.

This array is used to list other liquid body entities that can be swum to from the current body.

### 2) Populate Connections in Dredgers Entities

Set connected bodies in the dredgers liquid body definitions to match:
- `dredgers:flooded_approach_liquid_body` -> `dredgers:canal_run_segment_c_liquid_body`
- `dredgers:canal_run_segment_c_liquid_body` -> `dredgers:flooded_approach_liquid_body`, `dredgers:canal_run_segment_b_liquid_body`
- `dredgers:canal_run_segment_b_liquid_body` -> `dredgers:canal_run_segment_c_liquid_body`, `dredgers:canal_run_segment_a_liquid_body`
- `dredgers:canal_run_segment_a_liquid_body` -> `dredgers:canal_run_segment_b_liquid_body`

Use definition files in `data/mods/dredgers/entities/definitions/*.entity.json` so instances inherit the connection map.

### 3) New Mobility Skill Component

Add `data/mods/skills/components/mobility_skill.component.json` matching the structure of existing skill components (e.g., `awareness_skill.component.json`) with:
- `id`: `skills:mobility_skill`
- `value`: integer 0-100, default 0

Update `data/mods/skills/mod-manifest.json` to include the new component.

## New Swim Action + Rule

### Action: `liquids:swim_to_connected_liquid_body` (new)

**Intent:** allow an actor in a liquid body to swim to a connected liquid body, using chance-based resolution.

**Required Components:**
- `actor`: `liquids-states:in_liquid_body`, `skills:mobility_skill`

**Targets (proposed):**
- **Primary:** connected liquid body entity
- **Secondary:** destination location resolved from the primary target's `core:position.locationId` using `contextFrom: \"primary\"`

**Template:**
- `swim to {connectedLocation} via {connectedLiquidBody} ({chance}% chance)`

**Chance-Based:**
- `contestType`: `fixed_difficulty`
- `fixedDifficulty`: `50`
- `actorSkill`: `skills:mobility_skill` (property `value`, default `0`)
- `formula`: `linear`
- `bounds`: `min 5`, `max 95`
- `criticalSuccessThreshold`: `5`
- `criticalFailureThreshold`: `95`

**Scope Requirements:**
- Primary scope returns connected liquid bodies for the current `liquids-states:in_liquid_body.liquid_body_id`.
- Secondary scope resolves the location entity for the primary target's `core:position.locationId` using `contextFrom: \"primary\"` (so `target` in the scope is the selected connected liquid body).
- Primary target must be filtered so only liquid bodies that are connected to the actor's current liquid body are returned.

**Proposed New Scopes:**
- `liquids:connected_liquid_bodies_for_actor` (or similar) in `data/mods/liquids/scopes/`.
- `liquids:connected_liquid_body_location` (or similar) to return the location entity for a target liquid body.

### Rule: `handle_swim_to_connected_liquid_body` (new)

Use `handle_feel_your_way_to_an_exit.rule.json` and movement rules as reference. Required behavior:

1) **Resolve Outcome**
- Use `RESOLVE_OUTCOME` with `skills:mobility_skill` vs fixed difficulty 50.

2) **Outcome: CRITICAL_SUCCESS**
- Perceptible + success message: `{actor} swims effortlessly to {connectedLocation} via {connectedLiquidBody}.`
- Must be sense-aware (use `actor_description` and `alternate_descriptions` per `docs/modding/sense-aware-perception.md`).
- Update actor components:
  - `liquids-states:in_liquid_body.liquid_body_id` -> connected liquid body.
  - `core:position.locationId` -> connected location.
- Call `REGENERATE_DESCRIPTION` for the actor.

3) **Outcome: SUCCESS**
- Perceptible + success message: `{actor} swims to {connectedLocation} via {connectedLiquidBody}.`
- Sense-aware dispatch.
- Update `liquids-states:in_liquid_body.liquid_body_id` and `core:position.locationId`.
- Call `REGENERATE_DESCRIPTION`.

4) **Outcome: FAILURE**
- Perceptible + failure message: `{actor} struggles to swim to {connectedLocation} via {connectedLiquidBody}, making little progress.`
- No component changes.

5) **Outcome: FUMBLE**
- Perceptible + failure message: `{actor} struggles in an uncoordinated way to {connectedLocation} via {connectedLiquidBody}, and ends up submerged in the liquid, having made no progress to the destination.`
- No component changes yet (future submerged state to be added later).

6) **Turn + UI Flow**
- Follow the established pattern from liquids and movement rules:
  - `DISPATCH_PERCEPTIBLE_EVENT` for the action.
  - `core:display_successful_action_result` / `core:display_failed_action_result`.
  - `core:action_success` / `core:action_failure` (if applicable).
  - `END_TURN` with `success` true/false.

## Open Questions / Constraints

1) **Target Context Usage**
- `contextFrom` should be on the secondary target (schema-valid) and uses `target` as the selected primary liquid body when resolving the destination location.

## Test Requirements

Comprehensive tests are required for both discoverability and rule behavior.

### Action Discoverability Tests

- Action appears only when actor has `liquids-states:in_liquid_body`.
- Action targets include only connected liquid bodies from the current body.
- Action does not appear when no connections exist.
- Target resolution respects connection directionality (A -> B does not imply B -> A unless explicitly listed).
- Secondary target (connected location) resolves from the selected connected liquid body.
- ContextFrom behavior (if used) is verified via target scope resolution tests.

### Rule Outcome Tests

- `CRITICAL_SUCCESS` and `SUCCESS` update:
  - `liquids-states:in_liquid_body.liquid_body_id`
  - `core:position.locationId`
  - `REGENERATE_DESCRIPTION` is invoked for the actor
- `FAILURE` and `FUMBLE` do not change components.
- Perceptible event payloads include sense-aware fields (`actor_description`, `alternate_descriptions`), matching the templates above.
- UI events (`core:display_successful_action_result` / failure) match the outcome messages.
- `END_TURN` success flags align with outcome.

### Scope + Registry Tests

- Custom scopes added for connected bodies and destination locations resolve correctly via ScopeDSL.
- If tests use custom scopes, follow `docs/testing/mod-testing-guide.md` setup to register custom scope resolvers and dependency conditions.

## Files to Add or Update (No Code Changes Yet)

- `data/mods/liquids/components/liquid_body.component.json`
- `data/mods/dredgers/entities/definitions/canal_run_segment_a_liquid_body.entity.json`
- `data/mods/dredgers/entities/definitions/canal_run_segment_b_liquid_body.entity.json`
- `data/mods/dredgers/entities/definitions/canal_run_segment_c_liquid_body.entity.json`
- `data/mods/dredgers/entities/definitions/flooded_approach_liquid_body.entity.json`
- `data/mods/skills/components/mobility_skill.component.json`
- `data/mods/skills/mod-manifest.json`
- `data/mods/liquids/actions/swim_to_connected_liquid_body.action.json`
- `data/mods/liquids/rules/handle_swim_to_connected_liquid_body.rule.json`
- `data/mods/liquids/conditions/event-is-action-swim-to-connected-liquid-body.condition.json`
- `data/mods/liquids/scopes/*` (new scopes for connected bodies + destination location)
- `data/mods/liquids/mod-manifest.json`
- Tests under `tests/` (new suites for action discoverability + rule outcomes)
