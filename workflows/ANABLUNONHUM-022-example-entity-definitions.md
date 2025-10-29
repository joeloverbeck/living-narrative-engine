# ANABLUNONHUM-022: Create Example Entity Definitions for Non-Human Parts

**Phase**: 5 - Example Content  
**Priority**: Medium  
**Estimated Effort**: 8-10 hours  
**Dependencies**: ANABLUNONHUM-021

## Overview

Create anatomy entity definitions for non-human body parts (spider legs, dragon wings, tentacles, etc.) using the live entity-definition schema and the socket conventions described in the [anatomy structure documentation](../docs/anatomy/structure-templates.md). Each entity definition must:

- Live under `data/mods/anatomy/entities/definitions/` in the anatomy mod.
- Reference the entity-definition schema (`schema://living-narrative-engine/entity-definition.schema.json`).
- Use the `components` object shape from the current codebase (see `data/mods/anatomy/entities/definitions/*.entity.json` for reference).
- Provide an `anatomy:part` component with the correct `subType` for the part being defined.
- Include a `core:name` component so UI and debugging tools have a stable label.
- Supply an `anatomy:sockets` component **only** on root parts, using the `sockets` array format with `id`, optional `orientation`, `allowedTypes`, and an appropriate `nameTpl`.

## Deliverables

Create the following entity definition files (schema-compliant JSON) in `data/mods/anatomy/entities/definitions/`:

### Spider Parts
- `spider_cephalothorax.entity.json` — root; exposes eight leg sockets, two pedipalp sockets, and one abdomen socket.
- `spider_leg.entity.json`
- `spider_pedipalp.entity.json`
- `spider_abdomen.entity.json`

### Dragon Parts
- `dragon_torso.entity.json` — root; exposes four leg sockets, two wing sockets, one neck socket, and one tail socket.
- `dragon_leg.entity.json`
- `dragon_wing.entity.json`
- `dragon_tail.entity.json`
- `dragon_head.entity.json`

### Octopoid Parts
- `kraken_mantle.entity.json` — root; exposes eight tentacle sockets and one head socket.
- `kraken_tentacle.entity.json`
- `kraken_head.entity.json`

## Socket Component Guidelines

Root entities must follow the same socket component structure used elsewhere in the anatomy mod:

```jsonc
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy:spider_cephalothorax",
  "description": "Root body segment for an eight-legged spider",
  "components": {
    "anatomy:part": { "subType": "cephalothorax" },
    "anatomy:sockets": {
      "sockets": [
        { "id": "leg_1", "allowedTypes": ["spider_leg"], "nameTpl": "leg" },
        { "id": "leg_2", "allowedTypes": ["spider_leg"], "nameTpl": "leg" },
        // ... continue for all sockets (match structure-template expectations)
        { "id": "pedipalp_left", "orientation": "left", "allowedTypes": ["spider_pedipalp"], "nameTpl": "{{orientation}} pedipalp" },
        { "id": "abdomen", "allowedTypes": ["spider_abdomen"], "nameTpl": "abdomen" }
      ]
    },
    "core:name": { "text": "spider cephalothorax" }
  }
}
```

Key reminders:

- Socket `id`s must align with the structure template or blueprint naming you intend to use. For bilateral or positional sockets, set `orientation` (e.g., `left`, `right`, `front_left`). For radial sockets, sequential IDs (`leg_1` … `leg_8`) are acceptable.
- `allowedTypes` must list anatomy part sub-types (the same strings you set in the child entities' `anatomy:part.subType`).
- Provide a `nameTpl` for each socket so generated slots inherit readable names (`{{orientation}} {{type}}` for bilateral sockets, `{{type}}` or custom strings for singular sockets).
- Non-root parts generally omit `anatomy:sockets` unless they have their own attach points; if you add sockets, follow the same structure.

## Validation

- Ensure every file validates against `entity-definition.schema.json`.
- Confirm the `id` namespace is `anatomy:` and unique per file.
- Verify socket counts and IDs exactly match the expectations listed above.
- Run `npm run validate` for the anatomy mod (or the narrower validation command covering entity definitions) to confirm schema compliance once files are added.

## References

- Anatomy structure templates overview: `docs/anatomy/structure-templates.md`
- Non-human quickstart (for naming conventions and recipes): `docs/anatomy/non-human-quickstart.md`
