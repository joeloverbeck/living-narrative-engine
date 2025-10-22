# Pat Head Affection Action & Rule Specification

## Overview

Design and implement a new affectionate interaction where the actor pats the target on the head. This builds on the existing
`affection:ruffle_hair_playfully` action, reusing its proximity scope, component requirements, and visual palette to maintain
mod consistency. 【F:data/mods/affection/actions/ruffle_hair_playfully.action.json†L6-L16】

## Action Implementation Requirements

Create `data/mods/affection/actions/pat_head_affectionately.action.json` with the following schema-aligned fields:

- `$schema`: `schema://living-narrative-engine/action.schema.json`.
- `id`: `affection:pat_head_affectionately`.
- `name`: "Pat head affectionately".
- `description`: Briefly conveys a caring head pat (e.g., "Pat the target's head to show gentle affection.").
- `targets`: `positioning:close_actors_or_entity_kneeling_before_actor` (matches the playful ruffle reference). 【F:data/mods/affection/actions/ruffle_hair_playfully.action.json†L6-L6】
- `required_components.actor`: `["positioning:closeness"]`.
- `template`: **exactly** `pat {target} on the head`.
- `prerequisites`: keep an empty array unless discovery tests surface mandatory gating.
- `visual`: copy the affection palette from the reference action (background `#6a1b9a`, text `#f3e5f5`, hover background `#8e24aa`, hover text `#ffffff`). 【F:data/mods/affection/actions/ruffle_hair_playfully.action.json†L12-L16】

Update `data/mods/affection/mod-manifest.json` to register the new action.

## Rule Implementation Requirements

Add `data/mods/affection/rules/handle_pat_head_affectionately.rule.json` that follows the affection resolver pattern:

- `rule_id`: `handle_pat_head_affectionately` with a clarifying `comment` describing the handled action.
- `event_type`: `core:attempt_action`.
- Single `condition`: `{ "condition_ref": "affection:event-is-action-pat-head-affectionately" }`.
- Action sequence should:
  1. Resolve actor and target display names into `actorName` / `targetName` variables.
  2. Retrieve the actor's `core:position` component (store in `actorPosition`).
  3. Set `logMessage` to `{actor} pats {target} on the head affectionately.` via the templated context variables.
  4. Provide `perceptionType`, `locationId`, and `targetId` consistent with other affection touch rules before invoking the
     standard success macro (e.g., `core:logSuccessAndEndTurn`).
- The emitted successful action event and the perceptible event must both use the exact string `{actor} pats {target} on the head affectionately.`

Create the matching condition file `data/mods/affection/conditions/event-is-action-pat-head-affectionately.condition.json` and register both the rule and condition in the mod manifest alongside the new action.

## Testing Requirements

Author comprehensive integration coverage in `tests/integration/mods/affection/`:

1. **Action discoverability suite** – Mirror existing affection discovery tests to ensure the action surfaces only when
   closeness requirements are satisfied and the target meets the kneeling-or-close scope, using the Action Discovery Bed and
   fixture utilities recommended in the mod testing guide. 【F:docs/testing/mod-testing-guide.md†L5-L139】
2. **Rule behavior suite** – Use `ModTestFixture.forAction` (auto-loading the new rule) to execute the action and assert the
   success event, perceptible event payload, and target bindings all reflect the affectionate head-pat messaging. Follow the
   lifecycle and matcher practices documented in the testing guide. 【F:docs/testing/mod-testing-guide.md†L49-L197】

Both suites must assert the exact success/perceptible message string and exercise negative discoverability scenarios (e.g.,
missing `positioning:closeness`). Incorporate diagnostics helpers only while triaging failures.

## Out of Scope

- New animations, audio, or UI assets beyond the reused visual palette.
- Changes to global positioning scopes or component schemas.
- Alterations to existing affection actions beyond manifest registration.
