# Sitting Scenario Helpers Guide

## Overview

The sitting scenario builders encapsulate common seating arrangements used across positioning mods. Instead of composing rooms,
furniture, and actors by hand, call a single helper to create the full entity graph and load it into a `ModTestFixture`. Each
helper returns the generated entity references so tests can make precise assertions without duplicating setup logic.

## Available Helpers

| Helper | Description |
| ------ | ----------- |
| `createSittingArrangement(options)` | Core factory with full control over seated, standing, and kneeling actors. |
| `createSittingPair(options)` | Two actors sharing the same furniture with closeness metadata. |
| `createSoloSitting(options)` | Single actor occupying a seat—ideal for sit/stand transitions. |
| `createStandingNearSitting(options)` | A seated actor plus nearby standing companions (supports standing_behind). |
| `createSeparateFurnitureArrangement(options)` | Actors placed on different furniture entities in the same room. |
| `createKneelingBeforeSitting(options)` | A seated actor with kneeling observers tied together via `positioning:kneeling_before`. |

All helpers are exposed on `ModEntityScenarios` and as instance methods on `ModTestFixture`.

## Usage Example

```javascript
import { ModTestFixture } from '../../tests/common/mods';
import handleGetUpRule from '../../data/mods/positioning/rules/handle_get_up_from_lying.rule.json' assert { type: 'json' };
import eventIsGetUp from '../../data/mods/positioning/conditions/event-is-action-get-up-from-lying.condition.json' assert { type: 'json' };

const fixture = await ModTestFixture.forAction(
  'positioning',
  'positioning:get_up_from_lying',
  handleGetUpRule,
  eventIsGetUp
);
const scenario = fixture.createSoloSitting({
  furnitureId: 'armchair1',
  locationId: 'reading_nook',
  seatedActors: [{ id: 'reader', name: 'Reader', spotIndex: 0 }],
});

await fixture.executeAction(scenario.seatedActors[0].id, scenario.furniture.id);

const actor = fixture.entityManager.getEntityInstance(scenario.seatedActors[0].id);
expect(actor.components['positioning:standing']).toBeDefined();
```

### Tips

- Override `seatedActors`, `standingActors`, or `kneelingActors` to control IDs, names, and seat indices.
- Pass `closeSeatedActors: false` when you need actors to sit apart without automatic closeness metadata.
- Use `additionalFurniture` to pre-create multiple seating surfaces without manual builders.
