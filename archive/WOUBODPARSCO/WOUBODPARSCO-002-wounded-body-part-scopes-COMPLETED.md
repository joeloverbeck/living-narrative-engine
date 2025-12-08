# Summary
Define first-aid scoped selectors that return wounded and status-affected body parts using the existing scope DSL and BodyGraph cache, per `specs/wounded-body-part-scoping.md`.

Status: Completed

# Reality check (current state)
- No scopes in `data/mods/first-aid/scopes/` to project wounded or bleeding parts; the mod manifest lists no scope files.
- JSON Logic built-ins (e.g., `<`, `!!`) are available inside scope filters today; custom BodyGraph operators only support type/substring/presence-equality checks, so wounded/bleeding predicates must live in the filter logic rather than a new operator.
- APPLY_DAMAGE pipeline already mutates `anatomy:part_health` and optional `anatomy:bleeding`, but no medical scopes consume these states.

# Scope
- Add scoped definitions (e.g., `first-aid:wounded_actor_body_parts`, `first-aid:bleeding_actor_body_parts`) that iterate `actor.body_parts`/`target.body_parts` and filter for `part_health.currentHealth < maxHealth`, optionally requiring `anatomy:bleeding` presence.
- Use JSON Logic predicates only; leverage existing `BodyPartStepResolver`/`ArrayIterationResolver` path (`actor.body_parts[][ {and:[...]} ]`). No new operators are needed because the filter context already exposes `entity.components.*` with standard JSON Logic comparisons.
- Document intended use and examples in scope file headers to align with the spec.

# File list (expected to touch)
- data/mods/first-aid/scopes/wounded_actor_body_parts.scope
- data/mods/first-aid/scopes/bleeding_actor_body_parts.scope (or combined variant)
- data/mods/first-aid/scopes/README.md (brief notes/examples)
- data/mods/first-aid/mod-manifest.json (add scope file references to content list if required by manifest conventions)

# Out of scope
- Adding new JSON Logic operators or BodyGraph services (handled separately).
- Implementing first-aid actions/rules that consume the scopes.
- UI visualization or anatomy-visualizer changes.

# Acceptance criteria
- Scopes return only body part entity IDs whose `anatomy:part_health.currentHealth < maxHealth`; the bleeding variant additionally requires `anatomy:bleeding` component presence.
- Scope definitions load without schema/parse errors via the existing scope DSL (`npm run validate:mod first-aid` or full `npm run validate:ecosystem`).
- Scope docs include inline examples showing expected JSON Logic filters and intended action usage.

# Outcome
- Added actor-focused wounded and bleeding scopes using JSON Logic filters against `actor.body_parts` with BodyGraphService iteration; no new operators were introduced.
- Documented scope intent/examples in the scope files and `data/mods/first-aid/scopes/README.md`; updated the first-aid manifest to register the new scope files.
- Verified scope behavior with targeted integration tests and mod validation (`npm run test:integration -- --runInBand tests/integration/scopes/first-aid/woundedAndBleedingBodyParts.integration.test.js`, `node scripts/validateModReferences.js --mod=first-aid`).

# Invariants that must remain true
- BodyGraph traversal and caching behavior is unchanged outside these new scopes.
- Existing violence/recovery scopes continue to resolve the same results.
- No default health values or damage application semantics are modified.
