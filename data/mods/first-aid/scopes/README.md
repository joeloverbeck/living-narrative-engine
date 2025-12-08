# First-Aid Scopes

- `first-aid:wounded_target_body_parts`: `target.body_parts[]` filtered to parts with `anatomy:part_health.currentHealth < maxHealth` and excluding vital organs.
- `first-aid:wounded_actor_body_parts`: `actor.body_parts[]` filtered to parts with `anatomy:part_health.currentHealth < maxHealth` and excluding vital organs.
- `first-aid:bleeding_actor_body_parts`: wounded filter + truthy `anatomy:bleeding` component.

All scopes rely on the existing Scope DSL path (`BodyPartStepResolver` → `ArrayIterationResolver` → `BodyGraphService#getAllParts`) and use only JSON Logic predicates (e.g., `<`, `!!`) against `entity.components.*`.

Reference: `specs/wounded-body-part-scoping.md` for context and intended action usage.
