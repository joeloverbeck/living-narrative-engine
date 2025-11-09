# Sex Core Module

The `sex-core` module centralizes sexual scaffolding that multiple intimacy-focused mods share. Components, scopes, and future conditions that define shared anatomy states live here so specialized packs such as `sex-breastplay`, `sex-penile-manual`, and `sex-vaginal-penetration` can depend on one source of truth.

## Responsibilities
- Provide reusable posture scopes (for example, kneeling before an exposed penis or partners facing each other with exposed anatomy).
- Maintain paired-state components like `positioning:being_fucked_vaginally` and `positioning:fucking_vaginally` that coordinate penetrative experiences.
- Declare dependencies on anatomy, clothing, and positioning modules so downstream mods automatically inherit those requirements.

All assets within this module use the **Mystic Purple** visual identity documented in [`specs/wcag-compliant-color-combinations.spec.md`](../../../specs/wcag-compliant-color-combinations.spec.md), keeping shared sexual systems visually consistent.
