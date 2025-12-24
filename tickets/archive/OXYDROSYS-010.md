# OXYDROSYS-010: Create reptilian and eldritch respiratory entities

## Status: COMPLETED

## Description

Create respiratory entities for dragons (reptilian) and eldritch creatures.

## Critical Corrections Made During Implementation

**Original Ticket Error**: The ticket originally specified creating files in `data/mods/breathing/entities/definitions/`. This was INCORRECT.

**Correction Applied**: Files were created in `data/mods/anatomy-creatures/entities/definitions/` to avoid circular references. The `breathing` mod depends on `breathing-states` mod, which defines the `breathing-states:respiratory_organ` component used by lung entities. Creating lung entities in the `breathing` mod would cause circular references.

This follows the pattern established by previous tickets (OXYDROSYS-001 through OXYDROSYS-009) which also placed lung-related body part entities in `anatomy` or `anatomy-creatures` mods.

## Files Created

- `data/mods/anatomy-creatures/entities/definitions/reptilian_lung_left.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/reptilian_lung_right.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/eldritch_respiratory_mass.entity.json`

## Files Modified

- `data/mods/anatomy-creatures/entities/definitions/dragon_torso.entity.json` - Added lung sockets (`lung_left_socket`, `lung_right_socket`)
- `data/mods/anatomy-creatures/entities/definitions/eldritch_core_mass.entity.json` - Added respiratory socket (`respiratory_mass_socket`)
- `data/mods/anatomy-creatures/mod-manifest.json` - Registered new entities
- `data/mods/anatomy-creatures/recipes/red_dragon.recipe.json` - Added lung slots with preferId
- `data/mods/anatomy-creatures/recipes/writhing_observer.recipe.json` - Added respiratory mass slot with preferId

## Blueprint Note

Blueprints did NOT need modification. The `writhing_observer.blueprint.json` already defines `additionalSlots` that reference socket IDs in the torso entity, but the respiratory organs are populated through the recipe's `slots` section with `preferId`, not through blueprint changes.

## Out of Scope

- Fire-breathing dragon mechanics
- Eldritch special abilities

## Acceptance Criteria

1. **Reptilian lungs**: ✅ Larger capacity (oxygenCapacity: 20 vs. human's 10), `respirationType: "pulmonary"`
2. **Eldritch respiratory**: ✅ `respirationType: "unusual"`, unique amorphous organ design
3. **Recipes updated**: ✅ Dragon and writhing observer recipes include respiratory organs via preferId slots
4. **Entity names**: ✅ Appropriate for creature type ("left lung"/"right lung" for reptilian, "respiratory mass" for eldritch)

## Tests That Must Pass

- `npm run validate` - Schema validation
- Integration test: Dragon and eldritch entities have respiratory organs after instantiation

## Invariants

- Dragons have higher oxygen capacity (oxygenCapacity: 20) - larger creatures
- Eldritch creatures have "unusual" respiration type
- No circular references between mods

## Implementation Details

### Reptilian Lungs (Dragon)
- Health: 50/50 (higher than human's 30/30)
- Weight: 2.5 kg each (scaled for massive dragon)
- Oxygen capacity: 20 (vs. human's 10)
- Respiration type: pulmonary

### Eldritch Respiratory Mass
- Health: 60/60 (robust eldritch organ)
- Weight: 5.0 kg (amorphous mass)
- Oxygen capacity: 30 (supernatural capacity)
- Respiration type: unusual
