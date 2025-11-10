# Weapons System Implementation Specification

## Overview

This specification defines the implementation of a weapons system for the Living Narrative Engine, designed to support a scenario where armed sentinels patrol a reality rip and engage hostile entities. The system is split into two mods:

1. **Items Mod Extensions**: General aiming functionality applicable to any aimable item (flashlights, cameras, weapons)
2. **Weapons Mod**: Weapon-specific functionality including firearms, ammunition, reloading, and shooting mechanics

## Use Case Scenario

Two sentinels patrol the perimeter of a reality rip:
- **Sentinel A**: Non-military background, armed with a side-arm (pistol)
- **Sentinel B**: Military background, armed with an automatic rifle
- **Threats**: Hostile entities emerging from the reality rip
- **Actions**: Aim, shoot, reload, manage ammunition

## Architecture Overview

```
Items Mod (General Aiming)
  ↓
Weapons Mod (Weapon-Specific)
  ↓
Scenario Content (Specific Weapons)
```

## Part 1: Items Mod Extensions

### Components

#### items:aimable (Marker Component)

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "items:aimable",
  "description": "Marker component indicating an item can be aimed at targets. Applies to weapons, flashlights, cameras, and similar directional items.",
  "dataSchema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
```

**Rationale**: Marker component pattern consistent with `items:portable`, `items:item`. Enables scope filtering for aimable items.

#### items:aimed_at (State Component)

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "items:aimed_at",
  "description": "State component tracking what an aimable item is currently aimed at. Present only when item is actively aimed.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "targetId": {
        "type": "string",
        "pattern": "^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$",
        "description": "Entity ID of the target being aimed at"
      },
      "aimedBy": {
        "type": "string",
        "pattern": "^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$",
        "description": "Entity ID of the actor aiming the item"
      },
      "timestamp": {
        "type": "number",
        "description": "Game timestamp when aiming started"
      }
    },
    "required": ["targetId", "aimedBy", "timestamp"],
    "additionalProperties": false
  }
}
```

**Rationale**: State component that exists only while aiming, automatically removed when aim is lowered. Follows pattern of transient state components.

### Actions

#### items:aim_item

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "items:aim_item",
  "name": "Aim Item",
  "description": "Aim an aimable item at a target",
  "generateCombinations": true,
  "required_components": {
    "actor": ["items:inventory"]
  },
  "targets": {
    "primary": {
      "scope": "items:aimable_targets",
      "placeholder": "target",
      "description": "Entity to aim at"
    },
    "secondary": {
      "scope": "items:aimable_items_in_inventory",
      "placeholder": "item",
      "description": "Aimable item to use"
    }
  },
  "template": "aim {item} at {target}",
  "visual": {
    "backgroundColor": "#004d61",
    "textColor": "#e0f7fa",
    "hoverBackgroundColor": "#006978",
    "hoverTextColor": "#ffffff"
  }
}
```

**Implementation Notes**:
- Requires new scope `items:aimable_items_in_inventory` (filters actor inventory for items with `items:aimable`)
- Requires new scope `items:aimable_targets` (all entities in same location, excluding self)
- Rule handler adds `items:aimed_at` component to the item
- Dispatches `items:item_aimed` event

#### items:lower_aim

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "items:lower_aim",
  "name": "Lower Aim",
  "description": "Stop aiming an item",
  "generateCombinations": true,
  "required_components": {
    "actor": ["items:inventory"]
  },
  "targets": {
    "primary": {
      "scope": "items:aimed_items_in_inventory",
      "placeholder": "item",
      "description": "Item currently being aimed"
    }
  },
  "template": "lower {item}",
  "visual": {
    "backgroundColor": "#004d61",
    "textColor": "#e0f7fa",
    "hoverBackgroundColor": "#006978",
    "hoverTextColor": "#ffffff"
  }
}
```

**Implementation Notes**:
- Requires new scope `items:aimed_items_in_inventory` (filters actor inventory for items with `items:aimed_at`)
- Rule handler removes `items:aimed_at` component from the item
- Dispatches `items:aim_lowered` event

### Scopes

#### items:aimable_items_in_inventory

```scope-dsl
actor.components.items:inventory.items[][{"has": [{"var": "."}, "items:aimable"]}]
```

**Description**: All aimable items in the actor's inventory.

**Note**: Uses filter to check for `items:aimable` component on inventory items.

#### items:aimed_items_in_inventory

```scope-dsl
actor.components.items:inventory.items[][{"has": [{"var": "."}, "items:aimed_at"]}]
```

**Description**: All items in actor's inventory that are currently aimed (have `items:aimed_at` component).

**Note**: Uses filter to check for `items:aimed_at` component on inventory items.

#### items:aimable_targets

```scope-dsl
entities(core:actor)[{"and": [
  {"!=": [{"var": "id"}, {"var": "actor.id"}]},
  {"==": [
    {"var": "entity.components.core:position.locationId"},
    {"var": "actor.components.core:position.locationId"}
  ]}
]}]
```

**Description**: All actors at the actor's location except the actor themselves. Can be refined to include other entity types if needed.

**Note**: Uses `entities(core:actor)` source with filters for same location and not self.

### Events

#### items:item_aimed

```json
{
  "$schema": "schema://living-narrative-engine/event.schema.json",
  "id": "items:item_aimed",
  "description": "Dispatched when an actor aims an item at a target",
  "payloadSchema": {
    "type": "object",
    "properties": {
      "actorId": {
        "type": "string",
        "description": "ID of actor aiming the item"
      },
      "itemId": {
        "type": "string",
        "description": "ID of item being aimed"
      },
      "targetId": {
        "type": "string",
        "description": "ID of target being aimed at"
      },
      "timestamp": {
        "type": "number",
        "description": "Game timestamp"
      }
    },
    "required": ["actorId", "itemId", "targetId", "timestamp"],
    "additionalProperties": false
  }
}
```

#### items:aim_lowered

```json
{
  "$schema": "schema://living-narrative-engine/event.schema.json",
  "id": "items:aim_lowered",
  "description": "Dispatched when an actor stops aiming an item",
  "payloadSchema": {
    "type": "object",
    "properties": {
      "actorId": {
        "type": "string",
        "description": "ID of actor who lowered aim"
      },
      "itemId": {
        "type": "string",
        "description": "ID of item that was aimed"
      },
      "previousTargetId": {
        "type": "string",
        "description": "ID of target that was aimed at"
      },
      "timestamp": {
        "type": "number",
        "description": "Game timestamp"
      }
    },
    "required": ["actorId", "itemId", "timestamp"],
    "additionalProperties": false
  }
}
```

### Rules

#### items:handle_aim_item

**Condition**: `event-is-action-aim-item`

**Actions**:
1. `ADD_COMPONENT` - Add `items:aimed_at` to secondary target (item)
   ```json
   {
     "type": "ADD_COMPONENT",
     "parameters": {
       "entity_ref": "{event.payload.secondaryId}",
       "component_type": "items:aimed_at",
       "value": {
         "targetId": "{event.payload.targetId}",
         "aimedBy": "{event.payload.actorId}",
         "timestamp": "{context.currentTimestamp}"
       }
     }
   }
   ```
2. `GET_TIMESTAMP` - Get current timestamp
3. `DISPATCH_EVENT` - `items:item_aimed`

**Note**: Use `GET_TIMESTAMP` operation to get current timestamp before adding component.

#### items:handle_lower_aim

**Condition**: `event-is-action-lower-aim`

**Actions**:
1. `REMOVE_COMPONENT` - Remove `items:aimed_at` from primary target (item)
   ```json
   {
     "type": "REMOVE_COMPONENT",
     "parameters": {
       "entity_ref": "{event.payload.targetId}",
       "component_type": "items:aimed_at"
     }
   }
   ```
2. `DISPATCH_EVENT` - `items:aim_lowered`

**Note**: Rules use `"actions"` array, not `"operations"`. Event payload accessed via `event.payload.*`.

---

## Part 2: Weapons Mod

### Mod Manifest

```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "weapons",
  "version": "1.0.0",
  "name": "Weapons System",
  "description": "Firearms, ammunition, reloading, and shooting mechanics",
  "author": "Living Narrative Engine",
  "gameVersion": "0.0.1",
  "dependencies": [
    {
      "id": "core",
      "version": "1.0.0"
    },
    {
      "id": "items",
      "version": "1.0.0"
    }
  ]
}
```

### Color Scheme

**Selected Scheme**: Arctic Steel (11.8)

```json
{
  "backgroundColor": "#112a46",
  "textColor": "#e6f1ff",
  "hoverBackgroundColor": "#0b3954",
  "hoverTextColor": "#f0f4f8"
}
```

- **Normal Contrast**: 12.74:1 🌟 AAA
- **Hover Contrast**: 11.00:1 🌟 AAA
- **Rationale**: Described as ideal for "high-tech interfaces, precision ranged actions, frost magic" - perfectly aligned with tactical weapons systems
- **Theme**: Tempered steel, arctic clarity, precision

### Components

#### weapons:weapon (Marker Component)

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "weapons:weapon",
  "description": "Marker component identifying an item as a weapon. All weapons must have this component.",
  "dataSchema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
```

#### weapons:firearm (Data Component)

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "weapons:firearm",
  "description": "Component defining firearm-specific properties",
  "dataSchema": {
    "type": "object",
    "properties": {
      "firearmType": {
        "type": "string",
        "enum": ["pistol", "revolver", "rifle", "shotgun", "submachine_gun", "machine_gun"],
        "description": "Type of firearm"
      },
      "firingMode": {
        "type": "string",
        "enum": ["semi-automatic", "automatic", "burst", "manual"],
        "description": "Firing mechanism"
      },
      "rateOfFire": {
        "type": "number",
        "minimum": 1,
        "description": "Rounds per minute (for automatic weapons)"
      },
      "accuracy": {
        "type": "number",
        "minimum": 0,
        "maximum": 100,
        "description": "Base accuracy percentage"
      },
      "range": {
        "type": "number",
        "minimum": 1,
        "description": "Effective range in meters"
      },
      "condition": {
        "type": "string",
        "enum": ["pristine", "good", "fair", "poor", "broken"],
        "default": "good",
        "description": "Current condition affecting reliability"
      }
    },
    "required": ["firearmType", "firingMode", "accuracy", "range"],
    "additionalProperties": false
  }
}
```

**Design Notes**:
- `condition` affects jam probability
- `accuracy` provides base for hit probability calculations (can be extended with skills system)
- `firingMode` determines available shooting actions

#### weapons:ammunition (Data Component)

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "weapons:ammunition",
  "description": "Component tracking ammunition state for a firearm",
  "dataSchema": {
    "type": "object",
    "properties": {
      "ammoType": {
        "type": "string",
        "description": "Type of ammunition this weapon uses (e.g., '9mm', '.45 ACP', '5.56mm')"
      },
      "currentAmmo": {
        "type": "integer",
        "minimum": 0,
        "description": "Current rounds loaded in weapon"
      },
      "maxCapacity": {
        "type": "integer",
        "minimum": 1,
        "description": "Maximum rounds the weapon can hold"
      },
      "chambered": {
        "type": "boolean",
        "default": false,
        "description": "Whether a round is chambered and ready to fire"
      }
    },
    "required": ["ammoType", "currentAmmo", "maxCapacity"],
    "additionalProperties": false
  }
}
```

**Design Notes**:
- `chambered` is critical for manual-action weapons (pump shotguns, bolt-action rifles)
- `currentAmmo` includes chambered round if present
- Empty magazine: `currentAmmo: 0, chambered: false`

#### weapons:magazine (Data Component)

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "weapons:magazine",
  "description": "Component for weapons that use detachable magazines",
  "dataSchema": {
    "type": "object",
    "properties": {
      "magazineInserted": {
        "type": "boolean",
        "description": "Whether a magazine is currently inserted"
      },
      "magazineType": {
        "type": "string",
        "description": "Type/model of magazine"
      }
    },
    "required": ["magazineInserted", "magazineType"],
    "additionalProperties": false
  }
}
```

**Design Notes**:
- Separate from `weapons:ammunition` to support weapons without magazines (revolvers)
- Enables "eject magazine" / "insert magazine" actions
- `magazineInserted: false` prevents weapon from firing even if `currentAmmo > 0` (magazine removed but chambered round present)

#### weapons:jammed (State Component)

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "weapons:jammed",
  "description": "State component indicating weapon is jammed and cannot fire until cleared",
  "dataSchema": {
    "type": "object",
    "properties": {
      "jamType": {
        "type": "string",
        "enum": ["stovepipe", "double_feed", "failure_to_extract", "squib_load"],
        "description": "Type of jam"
      },
      "timestamp": {
        "type": "number",
        "description": "When the jam occurred"
      }
    },
    "required": ["jamType", "timestamp"],
    "additionalProperties": false
  }
}
```

**Design Notes**:
- Transient state component, present only while jammed
- `jamType` can influence clearance difficulty/time
- Cleared by `weapons:clear_jam` action

#### weapons:ammo_container (Data Component for Ammo Items)

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "weapons:ammo_container",
  "description": "Component for items that contain ammunition (magazines, ammo boxes, speed loaders)",
  "dataSchema": {
    "type": "object",
    "properties": {
      "ammoType": {
        "type": "string",
        "description": "Type of ammunition contained"
      },
      "currentRounds": {
        "type": "integer",
        "minimum": 0,
        "description": "Number of rounds currently in container"
      },
      "maxCapacity": {
        "type": "integer",
        "minimum": 1,
        "description": "Maximum rounds container can hold"
      },
      "containerType": {
        "type": "string",
        "enum": ["magazine", "speed_loader", "ammo_box", "stripper_clip"],
        "description": "Type of ammunition container"
      }
    },
    "required": ["ammoType", "currentRounds", "maxCapacity", "containerType"],
    "additionalProperties": false
  }
}
```

**Design Notes**:
- Enables magazines as separate inventory items
- Supports speed loaders for revolvers
- Ammo boxes for bulk storage

### Actions

#### weapons:shoot_weapon

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "weapons:shoot_weapon",
  "name": "Shoot",
  "description": "Fire weapon at aimed target",
  "generateCombinations": true,
  "required_components": {
    "actor": ["items:inventory"],
    "secondary": ["weapons:weapon", "weapons:ammunition", "items:aimed_at"]
  },
  "forbidden_components": {
    "secondary": ["weapons:jammed"]
  },
  "targets": {
    "primary": {
      "scope": "weapons:aimed_target_from_weapon",
      "placeholder": "target",
      "description": "Entity being aimed at"
    },
    "secondary": {
      "scope": "weapons:ready_firearms_in_inventory",
      "placeholder": "weapon",
      "description": "Weapon to fire"
    }
  },
  "template": "shoot {target} with {weapon}",
  "visual": {
    "backgroundColor": "#112a46",
    "textColor": "#e6f1ff",
    "hoverBackgroundColor": "#0b3954",
    "hoverTextColor": "#f0f4f8"
  }
}
```

**Implementation Notes**:
- Only appears when weapon is aimed (requires `items:aimed_at`)
- Only appears when weapon has ammo (`currentAmmo > 0`) and is not jammed
- Rule handler:
  1. Decrements `weapons:ammunition.currentAmmo`
  2. Calculates hit/miss based on accuracy + random factor
  3. Applies damage if hit (requires damage system - out of scope)
  4. Roll for jam probability (based on condition)
  5. Dispatches `weapons:weapon_fired` event
  6. Optionally dispatches `weapons:weapon_jammed` event
  7. If `currentAmmo` reaches 0, may auto-lower aim or require explicit reload

#### weapons:reload_weapon

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "weapons:reload_weapon",
  "name": "Reload",
  "description": "Reload weapon with ammunition from inventory",
  "generateCombinations": true,
  "required_components": {
    "actor": ["items:inventory"],
    "secondary": ["weapons:weapon", "weapons:ammunition"]
  },
  "targets": {
    "primary": {
      "scope": "weapons:reloadable_firearms_in_inventory",
      "placeholder": "weapon",
      "description": "Weapon to reload"
    },
    "secondary": {
      "scope": "weapons:compatible_ammo_in_inventory",
      "placeholder": "ammo_source",
      "description": "Ammunition source (magazine, ammo box, loose rounds)"
    }
  },
  "template": "reload {weapon} with {ammo_source}",
  "visual": {
    "backgroundColor": "#112a46",
    "textColor": "#e6f1ff",
    "hoverBackgroundColor": "#0b3954",
    "hoverTextColor": "#f0f4f8"
  }
}
```

**Implementation Notes**:
- Scope must filter for compatible ammo type
- Rule handler:
  1. Removes `items:aimed_at` if present (can't reload while aiming)
  2. Transfers ammo from source to weapon
  3. Updates `weapons:ammunition.currentAmmo`
  4. For magazine-fed weapons, may require `weapons:magazine.magazineInserted: true`
  5. Dispatches `weapons:weapon_reloaded` event
  6. Sets `chambered: true` for auto-loading weapons

#### weapons:chamber_round

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "weapons:chamber_round",
  "name": "Chamber Round",
  "description": "Manually chamber a round in a weapon",
  "generateCombinations": true,
  "required_components": {
    "actor": ["items:inventory"],
    "primary": ["weapons:weapon", "weapons:ammunition"]
  },
  "targets": {
    "primary": {
      "scope": "weapons:unchambered_firearms_in_inventory",
      "placeholder": "weapon",
      "description": "Weapon to chamber"
    }
  },
  "template": "chamber round in {weapon}",
  "visual": {
    "backgroundColor": "#112a46",
    "textColor": "#e6f1ff",
    "hoverBackgroundColor": "#0b3954",
    "hoverTextColor": "#f0f4f8"
  }
}
```

**Implementation Notes**:
- Only appears when `chambered: false` and `currentAmmo > 0`
- Critical for pump shotguns, bolt-action rifles
- Rule handler sets `chambered: true`
- Dispatches `weapons:round_chambered` event

#### weapons:clear_jam

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "weapons:clear_jam",
  "name": "Clear Jam",
  "description": "Attempt to clear a weapon jam",
  "generateCombinations": true,
  "required_components": {
    "actor": ["items:inventory"],
    "primary": ["weapons:weapon", "weapons:jammed"]
  },
  "targets": {
    "primary": {
      "scope": "weapons:jammed_firearms_in_inventory",
      "placeholder": "weapon",
      "description": "Jammed weapon"
    }
  },
  "template": "clear jam in {weapon}",
  "visual": {
    "backgroundColor": "#112a46",
    "textColor": "#e6f1ff",
    "hoverBackgroundColor": "#0b3954",
    "hoverTextColor": "#f0f4f8"
  }
}
```

**Implementation Notes**:
- Only appears when weapon has `weapons:jammed` component
- Rule handler:
  1. Roll for success (can be 100% or skill-based)
  2. If successful, removes `weapons:jammed` component
  3. May eject chambered round or magazine depending on jam type
  4. Dispatches `weapons:jam_cleared` event (or `weapons:jam_clear_failed`)

#### weapons:eject_magazine

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "weapons:eject_magazine",
  "name": "Eject Magazine",
  "description": "Remove magazine from weapon",
  "generateCombinations": true,
  "required_components": {
    "actor": ["items:inventory"],
    "primary": ["weapons:weapon", "weapons:magazine"]
  },
  "targets": {
    "primary": {
      "scope": "weapons:magazine_fed_firearms_with_magazine",
      "placeholder": "weapon",
      "description": "Weapon to eject magazine from"
    }
  },
  "template": "eject magazine from {weapon}",
  "visual": {
    "backgroundColor": "#112a46",
    "textColor": "#e6f1ff",
    "hoverBackgroundColor": "#0b3954",
    "hoverTextColor": "#f0f4f8"
  }
}
```

**Implementation Notes**:
- Only appears when `weapons:magazine.magazineInserted: true`
- Rule handler:
  1. Creates magazine entity instance in inventory
  2. Sets `weapons:magazine.magazineInserted: false`
  3. Preserves `currentAmmo` count in magazine entity
  4. Weapon retains chambered round if present
  5. Dispatches `weapons:magazine_ejected` event

#### weapons:insert_magazine

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "weapons:insert_magazine",
  "name": "Insert Magazine",
  "description": "Insert magazine into weapon",
  "generateCombinations": true,
  "required_components": {
    "actor": ["items:inventory"]
  },
  "targets": {
    "primary": {
      "scope": "weapons:magazine_fed_firearms_without_magazine",
      "placeholder": "weapon",
      "description": "Weapon to insert magazine into"
    },
    "secondary": {
      "scope": "weapons:compatible_magazines_in_inventory",
      "placeholder": "magazine",
      "description": "Magazine to insert"
    }
  },
  "template": "insert {magazine} into {weapon}",
  "visual": {
    "backgroundColor": "#112a46",
    "textColor": "#e6f1ff",
    "hoverBackgroundColor": "#0b3954",
    "hoverTextColor": "#f0f4f8"
  }
}
```

**Implementation Notes**:
- Only appears when `weapons:magazine.magazineInserted: false`
- Requires compatible magazine type
- Rule handler:
  1. Removes magazine entity from inventory
  2. Transfers ammo count to weapon
  3. Sets `weapons:magazine.magazineInserted: true`
  4. Dispatches `weapons:magazine_inserted` event

### Scopes

#### weapons:ready_firearms_in_inventory

```scope-dsl
actor.components.items:inventory.items[][{"and": [
  {"has": [{"var": "."}, "weapons:weapon"]},
  {"has": [{"var": "."}, "items:aimed_at"]},
  {"has": [{"var": "."}, "weapons:ammunition"]},
  {">": [{"var": "entity.components.weapons:ammunition.currentAmmo"}, 0]},
  {"!": [{"has": [{"var": "."}, "weapons:jammed"]}]}
]}]
```

**Description**: Firearms in inventory that are ready to shoot (aimed, loaded, not jammed).

**Note**: Accesses inventory via `actor.components.items:inventory.items[]` and component data via `entity.components.*`.

#### weapons:reloadable_firearms_in_inventory

```scope-dsl
actor.components.items:inventory.items[][{"and": [
  {"has": [{"var": "."}, "weapons:weapon"]},
  {"has": [{"var": "."}, "weapons:ammunition"]},
  {"<": [
    {"var": "entity.components.weapons:ammunition.currentAmmo"},
    {"var": "entity.components.weapons:ammunition.maxCapacity"}
  ]}
]}]
```

**Description**: Firearms in inventory that can be reloaded (not at max capacity).

**Note**: Uses `entity.components.*` to access component field values within filters.

#### weapons:unchambered_firearms_in_inventory

```scope-dsl
actor.components.items:inventory.items[][{"and": [
  {"has": [{"var": "."}, "weapons:weapon"]},
  {"has": [{"var": "."}, "weapons:ammunition"]},
  {">": [{"var": "entity.components.weapons:ammunition.currentAmmo"}, 0]},
  {"==": [{"var": "entity.components.weapons:ammunition.chambered"}, false]}
]}]
```

**Description**: Firearms with ammo but no round chambered.

**Note**: Uses `entity.components.*` notation for accessing component field values.

#### weapons:jammed_firearms_in_inventory

```scope-dsl
actor.components.items:inventory.items[][{"and": [
  {"has": [{"var": "."}, "weapons:weapon"]},
  {"has": [{"var": "."}, "weapons:jammed"]}
]}]
```

**Description**: Jammed firearms in inventory.

**Note**: Uses `actor.components.items:inventory.items[]` to access inventory items.

#### weapons:compatible_ammo_in_inventory

**Note**: This scope requires context from the weapon being reloaded. Implementation would use a parameterized scope or condition logic.

```scope-dsl
actor.components.items:inventory.items[][{"and": [
  {"has": [{"var": "."}, "weapons:ammo_container"]},
  {"==": [
    {"var": "entity.components.weapons:ammo_container.ammoType"},
    {"var": "context.weapon.components.weapons:ammunition.ammoType"}
  ]},
  {">": [{"var": "entity.components.weapons:ammo_container.currentRounds"}, 0]}
]}]
```

**Description**: Ammo containers with compatible ammunition type and available rounds.

**Note**: Context weapon accessed via `context.weapon.components.*`.

#### weapons:aimed_target_from_weapon

**Note**: Extracts target ID from weapon's `items:aimed_at` component.

```scope-dsl
entity[{"==": [{"var": "id"}, {"var": "context.weapon.components.items:aimed_at.targetId"}]}]
```

**Description**: The entity that the weapon is currently aimed at.

**Note**: Accesses weapon component via `context.weapon.components.items:aimed_at.*`.

#### weapons:magazine_fed_firearms_with_magazine

```scope-dsl
actor.components.items:inventory.items[][{"and": [
  {"has": [{"var": "."}, "weapons:weapon"]},
  {"has": [{"var": "."}, "weapons:magazine"]},
  {"==": [{"var": "entity.components.weapons:magazine.magazineInserted"}, true]}
]}]
```

**Description**: Magazine-fed firearms with magazine inserted.

**Note**: Accesses component field via `entity.components.weapons:magazine.magazineInserted`.

#### weapons:magazine_fed_firearms_without_magazine

```scope-dsl
actor.components.items:inventory.items[][{"and": [
  {"has": [{"var": "."}, "weapons:weapon"]},
  {"has": [{"var": "."}, "weapons:magazine"]},
  {"==": [{"var": "entity.components.weapons:magazine.magazineInserted"}, false]}
]}]
```

**Description**: Magazine-fed firearms without magazine inserted.

**Note**: Accesses component field via `entity.components.weapons:magazine.magazineInserted`.

#### weapons:compatible_magazines_in_inventory

**Note**: Requires context from weapon.

```scope-dsl
actor.components.items:inventory.items[][{"and": [
  {"has": [{"var": "."}, "weapons:ammo_container"]},
  {"==": [{"var": "entity.components.weapons:ammo_container.containerType"}, "magazine"]},
  {"==": [
    {"var": "entity.components.weapons:ammo_container.ammoType"},
    {"var": "context.weapon.components.weapons:ammunition.ammoType"}
  ]}
]}]
```

**Description**: Magazines compatible with the weapon's ammunition type.

**Note**: Accesses weapon context via `context.weapon.components.weapons:ammunition.*`.

### Events

#### weapons:weapon_fired

```json
{
  "$schema": "schema://living-narrative-engine/event.schema.json",
  "id": "weapons:weapon_fired",
  "description": "Dispatched when a weapon is fired",
  "payloadSchema": {
    "type": "object",
    "properties": {
      "actorId": {
        "type": "string",
        "description": "ID of actor firing weapon"
      },
      "weaponId": {
        "type": "string",
        "description": "ID of weapon fired"
      },
      "targetId": {
        "type": "string",
        "description": "ID of target"
      },
      "hit": {
        "type": "boolean",
        "description": "Whether shot hit target"
      },
      "remainingAmmo": {
        "type": "integer",
        "minimum": 0,
        "description": "Remaining ammunition after shot"
      },
      "timestamp": {
        "type": "number",
        "description": "Game timestamp"
      }
    },
    "required": ["actorId", "weaponId", "targetId", "hit", "remainingAmmo", "timestamp"],
    "additionalProperties": false
  }
}
```

#### weapons:weapon_jammed

```json
{
  "$schema": "schema://living-narrative-engine/event.schema.json",
  "id": "weapons:weapon_jammed",
  "description": "Dispatched when a weapon jams",
  "payloadSchema": {
    "type": "object",
    "properties": {
      "actorId": {
        "type": "string",
        "description": "ID of actor whose weapon jammed"
      },
      "weaponId": {
        "type": "string",
        "description": "ID of jammed weapon"
      },
      "jamType": {
        "type": "string",
        "enum": ["stovepipe", "double_feed", "failure_to_extract", "squib_load"],
        "description": "Type of jam"
      },
      "timestamp": {
        "type": "number",
        "description": "Game timestamp"
      }
    },
    "required": ["actorId", "weaponId", "jamType", "timestamp"],
    "additionalProperties": false
  }
}
```

#### weapons:weapon_reloaded

```json
{
  "$schema": "schema://living-narrative-engine/event.schema.json",
  "id": "weapons:weapon_reloaded",
  "description": "Dispatched when a weapon is reloaded",
  "payloadSchema": {
    "type": "object",
    "properties": {
      "actorId": {
        "type": "string",
        "description": "ID of actor reloading"
      },
      "weaponId": {
        "type": "string",
        "description": "ID of weapon reloaded"
      },
      "ammoSourceId": {
        "type": "string",
        "description": "ID of ammo source used"
      },
      "roundsLoaded": {
        "type": "integer",
        "minimum": 1,
        "description": "Number of rounds loaded"
      },
      "newAmmoCount": {
        "type": "integer",
        "minimum": 0,
        "description": "New ammo count in weapon"
      },
      "timestamp": {
        "type": "number",
        "description": "Game timestamp"
      }
    },
    "required": ["actorId", "weaponId", "ammoSourceId", "roundsLoaded", "newAmmoCount", "timestamp"],
    "additionalProperties": false
  }
}
```

#### weapons:round_chambered

```json
{
  "$schema": "schema://living-narrative-engine/event.schema.json",
  "id": "weapons:round_chambered",
  "description": "Dispatched when a round is manually chambered",
  "payloadSchema": {
    "type": "object",
    "properties": {
      "actorId": {
        "type": "string",
        "description": "ID of actor chambering round"
      },
      "weaponId": {
        "type": "string",
        "description": "ID of weapon"
      },
      "timestamp": {
        "type": "number",
        "description": "Game timestamp"
      }
    },
    "required": ["actorId", "weaponId", "timestamp"],
    "additionalProperties": false
  }
}
```

#### weapons:jam_cleared

```json
{
  "$schema": "schema://living-narrative-engine/event.schema.json",
  "id": "weapons:jam_cleared",
  "description": "Dispatched when a weapon jam is successfully cleared",
  "payloadSchema": {
    "type": "object",
    "properties": {
      "actorId": {
        "type": "string",
        "description": "ID of actor clearing jam"
      },
      "weaponId": {
        "type": "string",
        "description": "ID of weapon"
      },
      "jamType": {
        "type": "string",
        "enum": ["stovepipe", "double_feed", "failure_to_extract", "squib_load"],
        "description": "Type of jam that was cleared"
      },
      "timestamp": {
        "type": "number",
        "description": "Game timestamp"
      }
    },
    "required": ["actorId", "weaponId", "jamType", "timestamp"],
    "additionalProperties": false
  }
}
```

#### weapons:magazine_ejected

```json
{
  "$schema": "schema://living-narrative-engine/event.schema.json",
  "id": "weapons:magazine_ejected",
  "description": "Dispatched when a magazine is ejected from a weapon",
  "payloadSchema": {
    "type": "object",
    "properties": {
      "actorId": {
        "type": "string",
        "description": "ID of actor ejecting magazine"
      },
      "weaponId": {
        "type": "string",
        "description": "ID of weapon"
      },
      "magazineId": {
        "type": "string",
        "description": "ID of ejected magazine entity"
      },
      "remainingRounds": {
        "type": "integer",
        "minimum": 0,
        "description": "Rounds remaining in ejected magazine"
      },
      "timestamp": {
        "type": "number",
        "description": "Game timestamp"
      }
    },
    "required": ["actorId", "weaponId", "magazineId", "remainingRounds", "timestamp"],
    "additionalProperties": false
  }
}
```

#### weapons:magazine_inserted

```json
{
  "$schema": "schema://living-narrative-engine/event.schema.json",
  "id": "weapons:magazine_inserted",
  "description": "Dispatched when a magazine is inserted into a weapon",
  "payloadSchema": {
    "type": "object",
    "properties": {
      "actorId": {
        "type": "string",
        "description": "ID of actor inserting magazine"
      },
      "weaponId": {
        "type": "string",
        "description": "ID of weapon"
      },
      "magazineId": {
        "type": "string",
        "description": "ID of magazine entity (will be removed from inventory)"
      },
      "roundsInMagazine": {
        "type": "integer",
        "minimum": 0,
        "description": "Rounds in inserted magazine"
      },
      "timestamp": {
        "type": "number",
        "description": "Game timestamp"
      }
    },
    "required": ["actorId", "weaponId", "magazineId", "roundsInMagazine", "timestamp"],
    "additionalProperties": false
  }
}
```

---

## Part 3: Example Entity Definitions

### Pistol (Semi-Automatic, Magazine-Fed)

**Entity**: `weapons:pistol_9mm_standard`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "weapons:pistol_9mm_standard",
  "description": "Standard 9mm semi-automatic pistol with 15-round magazine capacity",
  "components": {
    "core:name": {
      "text": "9mm Pistol"
    },
    "core:description": {
      "text": "A reliable semi-automatic pistol chambered in 9mm. Favored by law enforcement and civilian defense."
    },
    "items:item": {},
    "items:portable": {},
    "items:aimable": {},
    "items:weight": {
      "weight": 0.8
    },
    "weapons:weapon": {},
    "weapons:firearm": {
      "firearmType": "pistol",
      "firingMode": "semi-automatic",
      "accuracy": 75,
      "range": 50,
      "condition": "good"
    },
    "weapons:ammunition": {
      "ammoType": "9mm",
      "currentAmmo": 15,
      "maxCapacity": 15,
      "chambered": true
    },
    "weapons:magazine": {
      "magazineInserted": true,
      "magazineType": "9mm_15rd"
    }
  }
}
```

### Automatic Rifle (Magazine-Fed)

**Entity**: `weapons:rifle_556_auto`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "weapons:rifle_556_auto",
  "description": "Military-grade 5.56mm automatic rifle with 30-round magazine",
  "components": {
    "core:name": {
      "text": "5.56mm Automatic Rifle"
    },
    "core:description": {
      "text": "A robust military assault rifle chambered in 5.56mm NATO. Features selective fire modes and exceptional reliability in adverse conditions."
    },
    "items:item": {},
    "items:portable": {},
    "items:aimable": {},
    "items:weight": {
      "weight": 3.5
    },
    "weapons:weapon": {},
    "weapons:firearm": {
      "firearmType": "rifle",
      "firingMode": "automatic",
      "rateOfFire": 700,
      "accuracy": 85,
      "range": 400,
      "condition": "good"
    },
    "weapons:ammunition": {
      "ammoType": "5.56mm",
      "currentAmmo": 30,
      "maxCapacity": 30,
      "chambered": true
    },
    "weapons:magazine": {
      "magazineInserted": true,
      "magazineType": "5.56mm_30rd"
    }
  }
}
```

### Revolver (No Magazine, Manual Chamber)

**Entity**: `weapons:revolver_357`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "weapons:revolver_357",
  "description": "Classic .357 Magnum revolver with 6-round cylinder",
  "components": {
    "core:name": {
      "text": ".357 Magnum Revolver"
    },
    "core:description": {
      "text": "A powerful revolver chambered in .357 Magnum. The cylinder holds six rounds and requires manual loading."
    },
    "items:item": {},
    "items:portable": {},
    "items:aimable": {},
    "items:weight": {
      "weight": 1.2
    },
    "weapons:weapon": {},
    "weapons:firearm": {
      "firearmType": "revolver",
      "firingMode": "manual",
      "accuracy": 80,
      "range": 50,
      "condition": "good"
    },
    "weapons:ammunition": {
      "ammoType": ".357_magnum",
      "currentAmmo": 6,
      "maxCapacity": 6,
      "chambered": true
    }
  }
}
```

**Note**: Revolvers don't have `weapons:magazine` component. Reloading uses speed loaders or individual rounds.

### Ammunition Entities

#### 9mm Magazine

**Entity**: `weapons:magazine_9mm_loaded`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "weapons:magazine_9mm_loaded",
  "description": "Loaded 15-round 9mm magazine",
  "components": {
    "core:name": {
      "text": "9mm Magazine (15 rounds)"
    },
    "core:description": {
      "text": "A standard capacity magazine loaded with 9mm rounds."
    },
    "items:item": {},
    "items:portable": {},
    "items:weight": {
      "weight": 0.3
    },
    "weapons:ammo_container": {
      "ammoType": "9mm",
      "currentRounds": 15,
      "maxCapacity": 15,
      "containerType": "magazine"
    }
  }
}
```

#### 5.56mm Ammo Box

**Entity**: `weapons:ammo_box_556`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "weapons:ammo_box_556",
  "description": "Box of 5.56mm ammunition containing 200 rounds",
  "components": {
    "core:name": {
      "text": "5.56mm Ammo Box (200 rounds)"
    },
    "core:description": {
      "text": "A military surplus ammunition box filled with 5.56mm NATO rounds."
    },
    "items:item": {},
    "items:portable": {},
    "items:weight": {
      "weight": 2.5
    },
    "weapons:ammo_container": {
      "ammoType": "5.56mm",
      "currentRounds": 200,
      "maxCapacity": 200,
      "containerType": "ammo_box"
    }
  }
}
```

#### .357 Speed Loader

**Entity**: `weapons:speed_loader_357`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "weapons:speed_loader_357",
  "description": "6-round speed loader for .357 Magnum revolvers",
  "components": {
    "core:name": {
      "text": ".357 Speed Loader (6 rounds)"
    },
    "core:description": {
      "text": "A circular device holding six .357 Magnum rounds for quick reloading of revolvers."
    },
    "items:item": {},
    "items:portable": {},
    "items:weight": {
      "weight": 0.15
    },
    "weapons:ammo_container": {
      "ammoType": ".357_magnum",
      "currentRounds": 6,
      "maxCapacity": 6,
      "containerType": "speed_loader"
    }
  }
}
```

---

## Part 4: Rules Implementation

### Rule: handle_shoot_weapon

**Condition**: `event-is-action-shoot-weapon`

**Actions Sequence**:

1. **Query Weapon Component**
   ```json
   {
     "type": "QUERY_COMPONENT",
     "parameters": {
       "entity_ref": "{event.payload.secondaryId}",
       "component_type": "weapons:ammunition",
       "result_variable": "weaponAmmo"
     }
   }
   ```

2. **Calculate New Ammo Count**
   ```json
   {
     "type": "MATH",
     "parameters": {
       "operation": "subtract",
       "operands": [
         {"var": "context.weaponAmmo.currentAmmo"},
         1
       ],
       "result_variable": "newAmmoCount"
     }
   }
   ```

3. **Decrement Ammo**
   ```json
   {
     "type": "MODIFY_COMPONENT",
     "parameters": {
       "entity_ref": "{event.payload.secondaryId}",
       "component_type": "weapons:ammunition",
       "field": "currentAmmo",
       "mode": "set",
       "value": "{context.newAmmoCount}"
     }
   }
   ```

4. **Set Chambered to False**
   ```json
   {
     "type": "MODIFY_COMPONENT",
     "parameters": {
       "entity_ref": "{event.payload.secondaryId}",
       "component_type": "weapons:ammunition",
       "field": "chambered",
       "mode": "set",
       "value": false
     }
   }
   ```

5. **Calculate Hit** (Simplified - can be expanded with random logic)
   ```json
   {
     "type": "SET_VARIABLE",
     "comment": "For now, set hit to true; implement random logic later",
     "parameters": {
       "variable_name": "hit",
       "value": true
     }
   }
   ```

6. **Check for Jam** (Simplified - implement probability later)
   ```json
   {
     "type": "SET_VARIABLE",
     "comment": "Jam check disabled for MVP; set to false",
     "parameters": {
       "variable_name": "jammed",
       "value": false
     }
   }
   ```

7. **Get Timestamp**
   ```json
   {
     "type": "GET_TIMESTAMP",
     "parameters": {
       "result_variable": "currentTimestamp"
     }
   }
   ```

8. **Dispatch Weapon Fired Event**
   ```json
   {
     "type": "DISPATCH_EVENT",
     "parameters": {
       "eventType": "weapons:weapon_fired",
       "payload": {
         "actorId": "{event.payload.actorId}",
         "weaponId": "{event.payload.secondaryId}",
         "targetId": "{event.payload.targetId}",
         "hit": "{context.hit}",
         "remainingAmmo": "{context.newAmmoCount}",
         "timestamp": "{context.currentTimestamp}"
       }
     }
   }
   ```

9. **Auto-Chamber Next Round** (for semi-auto/auto weapons)
   ```json
   {
     "type": "IF",
     "parameters": {
       "condition": {
         "and": [
           {"!=": [{"var": "context.weaponAmmo.firingMode"}, "manual"]},
           {">": [{"var": "context.newAmmoCount"}, 0]}
         ]
       },
       "then_actions": [
         {
           "type": "MODIFY_COMPONENT",
           "parameters": {
             "entity_ref": "{event.payload.secondaryId}",
             "component_type": "weapons:ammunition",
             "field": "chambered",
             "mode": "set",
             "value": true
           }
         }
       ]
     }
   }
   ```

10. **End Turn**
    ```json
    {
      "type": "END_TURN",
      "parameters": {
        "entityId": "{event.payload.actorId}",
        "success": true
      }
    }
    ```

**Note**: This implementation is simplified for MVP. Random hit calculation and jam probability should be implemented using custom operations or JavaScript logic in operation handlers.

### Rule: handle_reload_weapon

**Condition**: `event-is-action-reload-weapon`

**Actions Sequence**:

1. **Check if Weapon is Aimed**
   ```json
   {
     "type": "HAS_COMPONENT",
     "parameters": {
       "entity_ref": "{event.payload.targetId}",
       "component_type": "items:aimed_at",
       "result_variable": "weaponAimed"
     }
   }
   ```

2. **Remove Aim (if aimed)**
   ```json
   {
     "type": "IF",
     "parameters": {
       "condition": {"==": [{"var": "context.weaponAimed"}, true]},
       "then_actions": [
         {
           "type": "REMOVE_COMPONENT",
           "parameters": {
             "entity_ref": "{event.payload.targetId}",
             "component_type": "items:aimed_at"
           }
         }
       ]
     }
   }
   ```

3. **Query Weapon and Ammo Container Components**
   ```json
   {
     "type": "QUERY_COMPONENT",
     "parameters": {
       "entity_ref": "{event.payload.targetId}",
       "component_type": "weapons:ammunition",
       "result_variable": "weaponAmmo"
     }
   },
   {
     "type": "QUERY_COMPONENT",
     "parameters": {
       "entity_ref": "{event.payload.secondaryId}",
       "component_type": "weapons:ammo_container",
       "result_variable": "ammoContainer"
     }
   }
   ```

4. **Calculate Rounds to Transfer**
   ```json
   {
     "type": "MATH",
     "parameters": {
       "operation": "subtract",
       "operands": [
         {"var": "context.weaponAmmo.maxCapacity"},
         {"var": "context.weaponAmmo.currentAmmo"}
       ],
       "result_variable": "neededRounds"
     }
   },
   {
     "type": "MATH",
     "parameters": {
       "operation": "min",
       "operands": [
         {"var": "context.ammoContainer.currentRounds"},
         {"var": "context.neededRounds"}
       ],
       "result_variable": "roundsToTransfer"
     }
   }
   ```

5. **Calculate New Ammo Counts**
   ```json
   {
     "type": "MATH",
     "parameters": {
       "operation": "add",
       "operands": [
         {"var": "context.weaponAmmo.currentAmmo"},
         {"var": "context.roundsToTransfer"}
       ],
       "result_variable": "newWeaponAmmo"
     }
   },
   {
     "type": "MATH",
     "parameters": {
       "operation": "subtract",
       "operands": [
         {"var": "context.ammoContainer.currentRounds"},
         {"var": "context.roundsToTransfer"}
       ],
       "result_variable": "newContainerRounds"
     }
   }
   ```

6. **Update Weapon Ammunition**
   ```json
   {
     "type": "MODIFY_COMPONENT",
     "parameters": {
       "entity_ref": "{event.payload.targetId}",
       "component_type": "weapons:ammunition",
       "field": "currentAmmo",
       "mode": "set",
       "value": "{context.newWeaponAmmo}"
     }
   },
   {
     "type": "MODIFY_COMPONENT",
     "parameters": {
       "entity_ref": "{event.payload.targetId}",
       "component_type": "weapons:ammunition",
       "field": "chambered",
       "mode": "set",
       "value": true
     }
   }
   ```

7. **Update or Remove Ammo Container**
   ```json
   {
     "type": "IF",
     "parameters": {
       "condition": {"<=": [{"var": "context.newContainerRounds"}, 0]},
       "then_actions": [
         {
           "type": "REMOVE_COMPONENT",
           "comment": "Remove empty container from game (simplified)",
           "parameters": {
             "entity_ref": "{event.payload.secondaryId}",
             "component_type": "weapons:ammo_container"
           }
         }
       ],
       "else_actions": [
         {
           "type": "MODIFY_COMPONENT",
           "parameters": {
             "entity_ref": "{event.payload.secondaryId}",
             "component_type": "weapons:ammo_container",
             "field": "currentRounds",
             "mode": "set",
             "value": "{context.newContainerRounds}"
           }
         }
       ]
     }
   }
   ```

8. **Get Timestamp and Dispatch Event**
   ```json
   {
     "type": "GET_TIMESTAMP",
     "parameters": {
       "result_variable": "currentTimestamp"
     }
   },
   {
     "type": "DISPATCH_EVENT",
     "parameters": {
       "eventType": "weapons:weapon_reloaded",
       "payload": {
         "actorId": "{event.payload.actorId}",
         "weaponId": "{event.payload.targetId}",
         "ammoSourceId": "{event.payload.secondaryId}",
         "roundsLoaded": "{context.roundsToTransfer}",
         "newAmmoCount": "{context.newWeaponAmmo}",
         "timestamp": "{context.currentTimestamp}"
       }
     }
   }
   ```

9. **End Turn**
   ```json
   {
     "type": "END_TURN",
     "parameters": {
       "entityId": "{event.payload.actorId}",
       "success": true
     }
   }
   ```

### Rule: handle_chamber_round

**Condition**: `event-is-action-chamber-round`

**Actions Sequence**:

1. **Set Chambered Flag**
   ```json
   {
     "type": "MODIFY_COMPONENT",
     "parameters": {
       "entity_ref": "{event.payload.targetId}",
       "component_type": "weapons:ammunition",
       "field": "chambered",
       "mode": "set",
       "value": true
     }
   }
   ```

2. **Get Timestamp**
   ```json
   {
     "type": "GET_TIMESTAMP",
     "parameters": {
       "result_variable": "currentTimestamp"
     }
   }
   ```

3. **Dispatch Round Chambered Event**
   ```json
   {
     "type": "DISPATCH_EVENT",
     "parameters": {
       "eventType": "weapons:round_chambered",
       "payload": {
         "actorId": "{event.payload.actorId}",
         "weaponId": "{event.payload.targetId}",
         "timestamp": "{context.currentTimestamp}"
       }
     }
   }
   ```

4. **End Turn**
   ```json
   {
     "type": "END_TURN",
     "parameters": {
       "entityId": "{event.payload.actorId}",
       "success": true
     }
   }
   ```

### Rule: handle_clear_jam

**Condition**: `event-is-action-clear-jam`

**Actions Sequence**:

1. **Query Jam Component**
   ```json
   {
     "type": "QUERY_COMPONENT",
     "parameters": {
       "entity_ref": "{event.payload.targetId}",
       "component_type": "weapons:jammed",
       "result_variable": "jamInfo"
     }
   }
   ```

2. **Remove Jam Component**
   ```json
   {
     "type": "REMOVE_COMPONENT",
     "parameters": {
       "entity_ref": "{event.payload.targetId}",
       "component_type": "weapons:jammed"
     }
   }
   ```

3. **Eject Chambered Round** (for certain jam types)
   ```json
   {
     "type": "IF",
     "parameters": {
       "condition": {
         "or": [
           {"==": [{"var": "context.jamInfo.jamType"}, "double_feed"]},
           {"==": [{"var": "context.jamInfo.jamType"}, "stovepipe"]}
         ]
       },
       "then_actions": [
         {
           "type": "MODIFY_COMPONENT",
           "parameters": {
             "entity_ref": "{event.payload.targetId}",
             "component_type": "weapons:ammunition",
             "field": "chambered",
             "mode": "set",
             "value": false
           }
         }
       ]
     }
   }
   ```

4. **Get Timestamp**
   ```json
   {
     "type": "GET_TIMESTAMP",
     "parameters": {
       "result_variable": "currentTimestamp"
     }
   }
   ```

5. **Dispatch Jam Cleared Event**
   ```json
   {
     "type": "DISPATCH_EVENT",
     "parameters": {
       "eventType": "weapons:jam_cleared",
       "payload": {
         "actorId": "{event.payload.actorId}",
         "weaponId": "{event.payload.targetId}",
         "jamType": "{context.jamInfo.jamType}",
         "timestamp": "{context.currentTimestamp}"
       }
     }
   }
   ```

6. **End Turn**
   ```json
   {
     "type": "END_TURN",
     "parameters": {
       "entityId": "{event.payload.actorId}",
       "success": true
     }
   }
   ```

---

## Part 5: Testing Strategy

### Unit Tests

**Location**: `tests/unit/mods/weapons/`

- `components/ammunition.test.js` - Ammunition component validation
- `components/firearm.test.js` - Firearm component validation
- `components/magazine.test.js` - Magazine component validation
- `actions/shoot_weapon.test.js` - Shoot action validation
- `actions/reload_weapon.test.js` - Reload action validation
- `scopes/ready_firearms.test.js` - Scope resolution tests

### Integration Tests

**Location**: `tests/integration/mods/weapons/`

- `shootingWorkflow.integration.test.js` - Full shooting sequence
- `reloadingWorkflow.integration.test.js` - Reload mechanics
- `jammingAndClearing.integration.test.js` - Jam and clear actions
- `magazineManagement.integration.test.js` - Magazine insertion/ejection
- `chamberingWorkflow.integration.test.js` - Manual chambering for bolt-action/pump weapons

### E2E Tests

**Location**: `tests/e2e/weapons/`

- `sentinelPatrol.e2e.test.js` - Complete sentinel scenario
  - Sentinel equips weapon
  - Aims at hostile entity
  - Shoots until ammo depleted
  - Reloads weapon
  - Continues engagement
  - Handles jam situation

### Test Scenarios

#### Scenario 1: Pistol Combat

```javascript
describe('Pistol Combat Workflow', () => {
  it('should allow sentinel to engage hostile with pistol', async () => {
    const fixture = await ModTestFixture.forAction('weapons', 'weapons:shoot_weapon');

    // Setup sentinel with pistol
    const sentinel = fixture.createActor('Sentinel Alpha', {
      inventory: ['weapons:pistol_9mm_standard']
    });

    // Setup hostile entity
    const hostile = fixture.createActor('Hostile Entity');

    // Aim weapon
    await fixture.executeAction(sentinel.id, 'items:aim_item', {
      primary: hostile.id,
      secondary: 'weapons:pistol_9mm_standard'
    });

    // Verify aimed
    expect(fixture.getComponent(sentinel.id, 'items:aimed_at')).toBeDefined();

    // Shoot weapon
    await fixture.executeAction(sentinel.id, 'weapons:shoot_weapon', {
      primary: hostile.id,
      secondary: 'weapons:pistol_9mm_standard'
    });

    // Verify ammo decremented
    const ammoComponent = fixture.getComponent('weapons:pistol_9mm_standard', 'weapons:ammunition');
    expect(ammoComponent.currentAmmo).toBe(14);

    // Verify event dispatched
    expect(fixture.getDispatchedEvents('weapons:weapon_fired')).toHaveLength(1);
  });
});
```

#### Scenario 2: Reload Under Pressure

```javascript
describe('Reload Under Pressure', () => {
  it('should allow reload even when aimed', async () => {
    const fixture = await ModTestFixture.forAction('weapons', 'weapons:reload_weapon');

    // Setup sentinel with empty weapon, aimed at hostile
    const sentinel = fixture.createActor('Sentinel Beta', {
      inventory: [
        'weapons:rifle_556_empty',
        'weapons:magazine_556_loaded'
      ]
    });
    const hostile = fixture.createActor('Hostile Entity');

    // Aim empty weapon
    await fixture.executeAction(sentinel.id, 'items:aim_item', {
      primary: hostile.id,
      secondary: 'weapons:rifle_556_empty'
    });

    // Reload (should clear aim)
    await fixture.executeAction(sentinel.id, 'weapons:reload_weapon', {
      primary: 'weapons:rifle_556_empty',
      secondary: 'weapons:magazine_556_loaded'
    });

    // Verify aim removed
    expect(fixture.getComponent('weapons:rifle_556_empty', 'items:aimed_at')).toBeUndefined();

    // Verify weapon reloaded
    const ammoComponent = fixture.getComponent('weapons:rifle_556_empty', 'weapons:ammunition');
    expect(ammoComponent.currentAmmo).toBe(30);
  });
});
```

---

## Part 6: Future Extensions

### Phase 2 Enhancements

1. **Burst Fire Mode**
   - Action: `weapons:shoot_burst`
   - Fires 3-round burst
   - Higher ammo consumption, improved hit probability

2. **Suppressive Fire**
   - Action: `weapons:suppress_area`
   - Targets area instead of entity
   - Applies debuff to entities in area

3. **Weapon Attachments**
   - Components: `weapons:scope`, `weapons:suppressor`, `weapons:flashlight`
   - Modify accuracy, detection, visibility

4. **Weapon Maintenance**
   - Action: `weapons:clean_weapon`
   - Improves condition rating
   - Reduces jam probability

5. **Advanced Ammunition Types**
   - Armor-piercing, hollow-point, tracer rounds
   - Component: `weapons:special_ammo`
   - Different damage profiles

### Phase 3 Enhancements

1. **Damage System Integration**
   - Component: `core:health`
   - Hit location system
   - Critical hits

2. **Cover System**
   - Component: `positioning:in_cover`
   - Actions: `positioning:take_cover`, `positioning:leave_cover`
   - Modifies accuracy calculations

3. **Weapon Skills**
   - Component: `core:skills`
   - Experience-based accuracy improvements
   - Faster reload times

4. **Inventory Weight/Capacity**
   - Enforce weight limits
   - Movement speed penalties

5. **Weapon Customization**
   - Modular attachment system
   - Custom weapon builds

---

## Part 7: Implementation Checklist

### Items Mod Extensions

- [ ] Create `items:aimable` component
- [ ] Create `items:aimed_at` component
- [ ] Create `items:aim_item` action
- [ ] Create `items:lower_aim` action
- [ ] Create `items:aimable_items_in_inventory` scope
- [ ] Create `items:aimed_items_in_inventory` scope
- [ ] Create `items:aimable_targets` scope
- [ ] Create `items:item_aimed` event
- [ ] Create `items:aim_lowered` event
- [ ] Create `items:handle_aim_item` rule
- [ ] Create `items:handle_lower_aim` rule
- [ ] Create conditions for aim actions
- [ ] Update items mod manifest
- [ ] Create unit tests
- [ ] Create integration tests
- [ ] Run `npm run validate`

### Weapons Mod Creation

- [ ] Create `data/mods/weapons/` directory structure
- [ ] Create mod manifest
- [ ] Create `weapons:weapon` component
- [ ] Create `weapons:firearm` component
- [ ] Create `weapons:ammunition` component
- [ ] Create `weapons:magazine` component
- [ ] Create `weapons:jammed` component
- [ ] Create `weapons:ammo_container` component
- [ ] Create all 7 weapon actions (shoot, reload, chamber, clear_jam, eject_mag, insert_mag)
- [ ] Create all weapon scopes (8 scopes)
- [ ] Create all weapon events (8 events)
- [ ] Create all rule handlers (7 rules)
- [ ] Create action conditions (7 conditions)
- [ ] Create example entity definitions (3 weapons + 3 ammo types)
- [ ] Create unit tests for all components
- [ ] Create integration tests for all workflows
- [ ] Create E2E test for sentinel scenario
- [ ] Run `npm run validate:mod:weapons`
- [ ] Run `npm run test:integration -- tests/integration/mods/weapons/`
- [ ] Update `game.json` to include weapons mod

### Documentation

- [ ] Update mod-color-schemes.md with weapons color scheme
- [ ] Create `docs/mods/weapons-mod-guide.md` user guide
- [ ] Add weapons mod to main README
- [ ] Create example scenarios document

### Validation

- [ ] All schemas pass JSON validation
- [ ] All actions discoverable in-game
- [ ] All scopes resolve correctly
- [ ] All events dispatch successfully
- [ ] Color scheme meets WCAG AA standards
- [ ] Test coverage > 80%
- [ ] ESLint passes on all files
- [ ] TypeScript types check correctly

---

## Appendix A: Jam Probability Calculation

Jam probability based on weapon condition:

```javascript
function calculateJamProbability(condition) {
  const jamRates = {
    pristine: 0.1,  // 0.1% chance
    good: 0.5,      // 0.5% chance
    fair: 2.0,      // 2% chance
    poor: 5.0,      // 5% chance
    broken: 100.0   // Always jams
  };
  return jamRates[condition] || 0.5;
}
```

## Appendix B: Hit Probability Calculation

Basic hit calculation (can be extended with range, skills, cover):

```javascript
function calculateHitProbability(weapon, range, targetDistance) {
  let baseAccuracy = weapon.accuracy;

  // Range penalty
  if (targetDistance > weapon.range) {
    const rangePenalty = ((targetDistance - weapon.range) / weapon.range) * 50;
    baseAccuracy -= rangePenalty;
  }

  // Clamp between 5% and 95%
  return Math.max(5, Math.min(95, baseAccuracy));
}
```

## Appendix C: Color Scheme Validation

Arctic Steel scheme validation results:

- **Background (#112a46) vs Text (#e6f1ff)**: 12.74:1 (AAA) ✅
- **Hover Background (#0b3954) vs Hover Text (#f0f4f8)**: 11.00:1 (AAA) ✅
- **Accessibility**: Full WCAG 2.1 AAA compliance
- **Theme Alignment**: Perfect for tactical/weapons context

---

## Summary

This specification provides a complete, production-ready implementation plan for a weapons system supporting the sentinel patrol scenario. The design follows Living Narrative Engine's ECS architecture, maintains separation of concerns between general aiming (items mod) and weapon-specific functionality (weapons mod), and includes comprehensive testing strategies.

**Key Design Principles**:
1. Modular component architecture
2. Clear separation: general aiming vs. weapon-specific
3. Event-driven communication
4. State management through transient components
5. Extensible design for future enhancements
6. WCAG-compliant visual design
7. Comprehensive test coverage

**Implementation Time Estimate**: 20-30 hours for full Phase 1 implementation including testing.
