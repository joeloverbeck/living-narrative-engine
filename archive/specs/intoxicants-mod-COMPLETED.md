# Intoxicants Mod Specification

## Overview

The `intoxicants` mod provides consumable alcoholic beverages and will expand to include other substances like tobacco and drugs for smoking, snorting, and related actions.

## Mod Metadata

- **Mod ID**: `intoxicants`
- **Version**: `0.1.0`
- **Name**: Intoxicants
- **Description**: Alcoholic beverages and other intoxicating substances
- **Author**: Living Narrative Engine Team
- **Dependencies**: `core`, `items`, `metabolism`

## Color Scheme

**Selected**: Tavern Amber (Section 17.1)

```json
{
  "backgroundColor": "#5c3d1e",
  "textColor": "#fff3e0",
  "hoverBackgroundColor": "#704b2a",
  "hoverTextColor": "#ffffff"
}
```

**Theme**: Warm whiskey/amber tones evoking tavern firelight and aged spirits

**Future Alternative**: Hazy Smoke (Section 17.2) available for smoking/drug-related actions

## Phase 1: Entity Definitions

### Directory Structure

```
data/mods/intoxicants/
├── mod-manifest.json
├── entities/
│   └── definitions/
│       ├── jug_of_ale.entity.json
│       ├── jug_of_cider.entity.json
│       └── jug_of_mead.entity.json
```

### Entity: jug_of_ale

**File**: `data/mods/intoxicants/entities/definitions/jug_of_ale.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "intoxicants:jug_of_ale",
  "components": {
    "core:name": {
      "text": "clay jug of ale"
    },
    "core:description": {
      "text": "A heavy clay jug glazed with earthy browns, stoppered with a cork and sealed with wax. Inside sloshes a generous measure of amber ale, its yeasty aroma escaping through the seal. The rustic vessel is cool to the touch and beaded with condensation."
    },
    "items:item": {},
    "items:portable": {},
    "core:weight": {
      "weight": 1.2
    },
    "items:drinkable": {},
    "containers-core:liquid_container": {
      "currentVolumeMilliliters": 1000,
      "maxCapacityMilliliters": 1000,
      "servingSizeMilliliters": 200,
      "isRefillable": true,
      "flavorText": "The ale is rich and malty with a slightly bitter hop finish. It goes down smooth, warming your belly and leaving a pleasant earthy aftertaste."
    },
    "metabolism:fuel_source": {
      "energy_content": 200,
      "bulk": 30,
      "fuel_type": "drink",
      "fuel_tags": ["organic", "beverage", "alcohol"],
      "digestion_speed": "medium",
      "spoilage_rate": 0
    }
  }
}
```

### Entity: jug_of_cider

**File**: `data/mods/intoxicants/entities/definitions/jug_of_cider.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "intoxicants:jug_of_cider",
  "components": {
    "core:name": {
      "text": "clay jug of cider"
    },
    "core:description": {
      "text": "A stout clay jug with a rounded belly and narrow neck, sealed with a wooden stopper. The contents glint golden through the slightly translucent glaze when held to the light. A faint scent of apples and fermentation wafts from beneath the seal."
    },
    "items:item": {},
    "items:portable": {},
    "core:weight": {
      "weight": 1.2
    },
    "items:drinkable": {},
    "containers-core:liquid_container": {
      "currentVolumeMilliliters": 1000,
      "maxCapacityMilliliters": 1000,
      "servingSizeMilliliters": 200,
      "isRefillable": true,
      "flavorText": "The cider is crisp and refreshing with a bright apple tartness that gives way to a subtle sweetness. It leaves a pleasant tingle on the tongue and a warm glow in the chest."
    },
    "metabolism:fuel_source": {
      "energy_content": 180,
      "bulk": 25,
      "fuel_type": "drink",
      "fuel_tags": ["organic", "beverage", "alcohol", "fruit"],
      "digestion_speed": "fast",
      "spoilage_rate": 0
    }
  }
}
```

### Entity: jug_of_mead

**File**: `data/mods/intoxicants/entities/definitions/jug_of_mead.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "intoxicants:jug_of_mead",
  "components": {
    "core:name": {
      "text": "clay jug of mead"
    },
    "core:description": {
      "text": "A handsome clay jug with decorative bee motifs pressed into its surface, sealed with a cork and stamped with beeswax. The golden-amber liquid within is thick and viscous, promising sweetness. A rich honey fragrance clings to the vessel."
    },
    "items:item": {},
    "items:portable": {},
    "core:weight": {
      "weight": 1.3
    },
    "items:drinkable": {},
    "containers-core:liquid_container": {
      "currentVolumeMilliliters": 1000,
      "maxCapacityMilliliters": 1000,
      "servingSizeMilliliters": 200,
      "isRefillable": true,
      "flavorText": "The mead is luxuriously sweet with deep honey notes and subtle floral undertones. It coats the throat like liquid gold and spreads warmth through your limbs with every swallow."
    },
    "metabolism:fuel_source": {
      "energy_content": 220,
      "bulk": 30,
      "fuel_type": "drink",
      "fuel_tags": ["organic", "beverage", "alcohol", "honey"],
      "digestion_speed": "medium",
      "spoilage_rate": 0
    }
  }
}
```

## Future Phases

### Phase 2: Intoxication System

- Create `intoxicants:intoxicated` component for tracking intoxication level
- Implement intoxication effects on character behavior
- Add sobriety recovery mechanics

### Phase 3: Smoking Actions

- Create tobacco/pipe entity definitions
- Implement `smoke_pipe` action
- Use **Hazy Smoke** color scheme for smoking actions

### Phase 4: Other Substances

- Drug entity definitions (poppy milk, mushrooms, etc.)
- Snorting/inhaling actions
- Withdrawal and addiction systems (optional)

## Implementation Checklist

### Phase 1 Tasks

- [ ] Create `data/mods/intoxicants/` directory structure
- [ ] Create `mod-manifest.json`
- [ ] Create `jug_of_ale.entity.json`
- [ ] Create `jug_of_cider.entity.json`
- [ ] Create `jug_of_mead.entity.json`
- [ ] Add mod to game.json
- [ ] Test entity loading
- [ ] Create integration tests

## Reference Files

- Entity pattern reference: `data/mods/fantasy/entities/definitions/ale_tankard.entity.json`
- Liquid container reference: `data/mods/fantasy/entities/definitions/jar_of_vinegar.entity.json`
- Color scheme documentation: `docs/mods/mod-color-schemes.md` (Section 17)
