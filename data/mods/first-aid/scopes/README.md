# First-Aid Scopes

- `first-aid:wounded_actor_body_parts`: `actor.body_parts[]` filtered to parts with `anatomy:part_health.currentHealth < maxHealth`.
- `first-aid:bleeding_actor_body_parts`: wounded filter + truthy `anatomy:bleeding` component.

Both scopes rely on the existing Scope DSL path (`BodyPartStepResolver` → `ArrayIterationResolver` → `BodyGraphService#getAllParts`) and use only JSON Logic predicates (e.g., `<`, `!!`) against `entity.components.*`.

Reference: `specs/wounded-body-part-scoping.md` for context and intended action usage.
