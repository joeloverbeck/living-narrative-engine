# Lighting System Brainstorming Document

## Overview

This document explores implementing a data-driven lighting system for the Living Narrative Engine, specifically addressing naturally dark underground locations where actors need light sources to see.

---

## Current State Analysis

### Location Rendering (`src/domUI/locationRenderer.js`)

**Data Flow:**
```
Turn Started Event → Actor Entity ID → Location ID Resolution
  ↓
EntityDisplayDataProvider queries:
  ├─ getLocationDetails() → NAME, DESCRIPTION, EXITS components
  ├─ getLocationPortraitData() → PORTRAIT component
  └─ getCharacterDisplayInfo() × N → NAME, DESCRIPTION, PORTRAIT components
  ↓
LocationDisplayPayload → DOM Rendering
```

**Key Integration Points:**
- `#buildDisplayPayload(locationId, actorId)` - Assembles display data (lines 263-278)
- `renderDescription()` - Renders location description (lines 480-496)
- `_renderList()` - Renders character list with portraits and tooltips (lines 418-429)
- `LocationDataService.gatherLocationCharacters()` - Gathers other actors at location

### LLM Prompt Generation (`src/prompting/AIPromptContentProvider.js`)

**World Context Building (`getWorldContextContent`, lines 561-666):**
```javascript
// Current structure:
## Current Situation
### Location
{locationName}
### Description
{locationDescription}

## Exits from Current Location
- **Towards {direction}** leads to {targetName}

## Other Characters Present
### {characterName}
- **Apparent age**: {age}
- **Height**: {height}
// ... detailed anatomy/clothing
```

**Key Method:** `getWorldContextContent(gameState)` builds markdown sections for:
1. Location name and description
2. Exits with formatted directions
3. Characters with full physical descriptions

### Existing Location Files (dredgers mod)

All five underground locations follow the same pattern:
```json
{
  "definitionId": "dredgers:location_name",
  "components": {
    "core:name": { "text": "Location Name" },
    "core:description": { "text": "Atmospheric prose..." },
    "core:portrait": { "path": "...", "altText": "..." },
    "movement:exits": [{ "direction": "...", "target": "...", "blocker": null }]
  }
}
```

**Interesting observations:**
- Descriptions already reference lighting metaphorically ("lantern light has to fight", "the light dies in the sludge")
- No current lighting mechanics - purely atmospheric
- Exits use narrative directions, not cardinal directions

### Hooded Oil Lantern Entity

```json
{
  "components": {
    "core:name": { "text": "hooded oil lantern" },
    "core:description": { "text": "..." },
    "items:item": {},
    "items:portable": {},
    "core:weight": { "value": 1.5 },
    "core:material": { "type": "brass", "property": "rigid" },
    "descriptors:color_extended": { "value": "dull-brass" },
    "descriptors:texture": { "value": "oiled" }
  }
}
```

### Existing Operators Pattern

Operators follow this structure:
```javascript
class MyOperator {
  constructor({ entityManager, logger }) { ... }

  evaluate(params, context) {
    // 1. Validate params
    // 2. Resolve entities from context
    // 3. Access components via entityManager.getComponentData()
    // 4. Return boolean or value
  }
}
```

**Relevant existing operators:**
- `hasComponentOperator` - Checks if entity has component
- `hasOtherActorsAtLocationOperator` - Queries actors at location
- Component access pattern: `entityManager.getComponentData(entityId, 'namespace:component')`

---

## Proposed Architecture

### New Mod: `data/mods/locations/`

**Rationale:** Dedicated mod for location-specific mechanics keeps `core` clean and allows optional inclusion.

### Component Design

#### 1. `locations:naturally_dark` (Marker Component)

```json
// data/mods/locations/components/naturally_dark.component.json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "locations:naturally_dark",
  "description": "Marks a location as having no natural light source. Requires active light sources to see.",
  "dataSchema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
```

**Usage:** Pure marker. Presence = naturally dark, absence = ambient light available.

#### 2. `locations:light_sources` (Reference Array)

```json
// data/mods/locations/components/light_sources.component.json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "locations:light_sources",
  "description": "Array of active light source entity IDs providing illumination at this location.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "sources": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Entity IDs of active light sources"
      }
    },
    "required": ["sources"],
    "additionalProperties": false
  }
}
```

**Usage:** Empty array or missing component = no light. Non-empty = location is lit.

#### 3. `locations:description_in_darkness` (Optional Text Override)

```json
// data/mods/locations/components/description_in_darkness.component.json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "locations:description_in_darkness",
  "description": "Alternative description shown when location is in darkness. Should focus on non-visual senses.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "text": {
        "type": "string",
        "description": "Description emphasizing sounds, smells, textures, and atmosphere in darkness"
      }
    },
    "required": ["text"],
    "additionalProperties": false
  }
}
```

**Usage:** Optional. If present, replaces normal description in darkness. If absent, use generic "pitch darkness" message.

---

## Lighting State Logic

### Decision Matrix

| `naturally_dark` | `light_sources.sources` | Result |
|------------------|------------------------|--------|
| Absent | Any | **Lit** (ambient light) |
| Present | Empty or missing | **Dark** |
| Present | Non-empty array | **Lit** (artificial) |

### Proposed Helper Service

```javascript
// src/locations/services/lightingStateService.js
class LightingStateService {
  constructor({ entityManager, logger }) { ... }

  /**
   * Determines if a location is currently lit
   * @param {string} locationId - Location entity ID
   * @returns {{ isLit: boolean, lightSources: string[] }}
   */
  getLocationLightingState(locationId) {
    const isNaturallyDark = this.#entityManager.hasComponent(
      locationId,
      'locations:naturally_dark'
    );

    if (!isNaturallyDark) {
      return { isLit: true, lightSources: [] };
    }

    const lightSourcesData = this.#entityManager.getComponentData(
      locationId,
      'locations:light_sources'
    );

    const sources = lightSourcesData?.sources || [];
    return {
      isLit: sources.length > 0,
      lightSources: sources
    };
  }
}
```

---

## UI Changes (LocationRenderer)

### Modified `#buildDisplayPayload`

```javascript
#buildDisplayPayload(locationId, actorId) {
  // Get lighting state first
  const { isLit } = this.lightingStateService.getLocationLightingState(locationId);

  if (!isLit) {
    return this.#buildDarknessPayload(locationId, actorId);
  }

  // Existing logic for lit locations
  return this.#buildLitPayload(locationId, actorId);
}

#buildDarknessPayload(locationId, actorId) {
  // Get darkness description or default
  const darknessDesc = this.#entityManager.getComponentData(
    locationId,
    'locations:description_in_darkness'
  );

  const description = darknessDesc?.text || "You're in pitch darkness.";

  // Get character count (not details) for presence sensing
  const charactersInLocation = this.locationDataService
    .gatherLocationCharacters(locationId, actorId);
  const otherActorCount = charactersInLocation.length;

  // Return minimal payload for darkness
  return {
    name: locationDetails.name, // Keep location name
    description: description,
    portraitPath: null, // No portrait in darkness
    portraitAltText: null,
    exits: [], // Can't see exits in darkness
    characters: [], // Empty - replaced by presence message
    isDark: true,
    otherActorCount: otherActorCount // For three-tier presence sensing
  };
}
```

### Modified Rendering

```javascript
renderDescription(locationDto) {
  // ... clear element ...

  if (locationDto.isDark) {
    // Render darkness-specific content
    const descElement = this.#domElementFactory.p(locationDto.description);
    this.#boundElements.descriptionDisplay.appendChild(descElement);

    // Add presence sensing message with three-tier count
    const presenceMsg = this.#getPresenceMessage(locationDto.otherActorCount);
    const presenceElement = this.#domElementFactory.p(presenceMsg);
    presenceElement.className = 'darkness-presence';
    this.#boundElements.descriptionDisplay.appendChild(presenceElement);
  }

  // ... existing lit logic ...
}

#getPresenceMessage(count) {
  if (count === 0) {
    return "You can't see anything in the dark, but you can't sense any other person or creature here.";
  } else if (count === 1) {
    return "You can't see anything in the dark, but you sense a presence here.";
  } else if (count <= 3) {
    return "You can't see anything in the dark, but you sense a few presences here.";
  } else {
    return "You can't see anything in the dark, but you sense several presences here.";
  }
}
```

---

## LLM Prompt Changes

### Modified `getWorldContextContent`

```javascript
getWorldContextContent(gameState) {
  const segments = [];
  const currentLocation = gameState.currentLocation;

  // Determine lighting state
  const isLit = this.#isLocationLit(currentLocation);

  if (!isLit) {
    return this.#buildDarknessWorldContext(currentLocation, gameState);
  }

  // Existing lit location logic...
}

#buildDarknessWorldContext(currentLocation, gameState) {
  const segments = [];

  segments.push('## Current Situation');
  segments.push('### Location');
  segments.push(currentLocation.name || 'Unknown');

  segments.push('### Conditions');
  segments.push('**Pitch darkness.** You cannot see anything.');

  // Darkness description if available
  if (currentLocation.descriptionInDarkness) {
    segments.push('### Sensory Impressions');
    segments.push(currentLocation.descriptionInDarkness);
  }

  // No exits section - can't see them
  segments.push('## Navigation');
  segments.push("You cannot see any exits in the darkness.");

  // Presence sensing with three-tier count
  segments.push('## Other Presences');
  const count = currentLocation.characters?.length || 0;
  segments.push(this.#getPresenceMessageForPrompt(count));

  return segments.join('\n');
}

#getPresenceMessageForPrompt(count) {
  if (count === 0) {
    return "You can't see anything in the dark, but you can't sense any other person or creature here.";
  } else if (count === 1) {
    return "You can't see anything in the dark, but you sense a presence here.";
  } else if (count <= 3) {
    return "You can't see anything in the dark, but you sense a few presences here.";
  } else {
    return "You can't see anything in the dark, but you sense several presences here.";
  }
}
```

---

## Alternative Designs Considered

### 1. Light Level Instead of Binary

```json
{
  "locations:lighting": {
    "ambientLevel": 0,      // 0-100
    "threshold": 20         // Minimum to see
  }
}
```

**Pros:** More nuanced (dim, twilight, etc.)
**Cons:** Complexity; would need to calculate cumulative light from sources
**Verdict:** YAGNI for now. Binary dark/lit is sufficient for initial implementation.

### 2. Light Sources on Actor Inventory

Instead of `light_sources` on location, check if any actor at location has lit torch/lantern.

**Pros:** More dynamic; natural for carried lights
**Cons:** Requires checking all actors' inventories; complex state tracking
**Verdict:** Hybrid approach possible later. Static location array is simpler for MVP.

### 3. Separate `lit` Component Instead of Sources Array

```json
{
  "locations:lit": {}  // Marker: location is currently lit
}
```

**Pros:** Simpler boolean check
**Cons:** No tracking of *what* is providing light; harder to remove light when source extinguishes
**Verdict:** `light_sources` array provides better future extensibility.

---

## Implementation Sequence

### Phase 1: Components (Data Layer)
1. Create `data/mods/locations/` mod structure
2. Create `mod-manifest.json`
3. Create three component schemas:
   - `naturally_dark.component.json`
   - `light_sources.component.json`
   - `description_in_darkness.component.json`

### Phase 2: Service (Logic Layer)
4. Create `LightingStateService` in `src/locations/services/`
5. Register service with DI container
6. Create `isLocationLit` operator if needed for rules

### Phase 3: UI Integration
7. Modify `LocationRenderer` to check lighting state
8. Implement darkness-specific payload building
9. Update rendering to show presence messages

### Phase 4: LLM Integration
10. Modify `AIPromptContentProvider.getWorldContextContent()`
11. Create darkness-specific world context builder
12. Update `AIGameStateDTO` to include lighting state

### Phase 5: Content
13. Add components to underground location instances
14. Write `description_in_darkness` content for each location

### Phase 6: Testing
15. Unit tests for `LightingStateService`
16. Integration tests for darkness rendering
17. E2E tests for prompt generation in darkness

---

## Design Decisions (Confirmed)

1. **Light source tracking:** `light_sources` references any lit entity by ID, regardless of physical location (stationary at location OR in actor inventory). Actions for lighting/extinguishing manage array membership independently.

2. **Exit visibility:** Completely hidden in pitch darkness - no exit info in UI or LLM prompts.

3. **Portrait handling:** No portrait displayed in darkness.

4. **Presence sensing:** Three-tier approximate count:
   - 1 actor: "a presence"
   - 2-3 actors: "a few presences"
   - 4+ actors: "several presences"

5. **Darkness descriptions:** Optional with generic fallback for locations without custom text.

---

## Files to Modify/Create

### New Files
- `data/mods/locations/mod-manifest.json`
- `data/mods/locations/components/naturally_dark.component.json`
- `data/mods/locations/components/light_sources.component.json`
- `data/mods/locations/components/description_in_darkness.component.json`
- `src/locations/services/lightingStateService.js`
- `tests/unit/locations/services/lightingStateService.test.js`
- `tests/integration/locations/darknessRendering.integration.test.js`

### Modified Files
- `src/domUI/locationRenderer.js` - Add darkness handling
- `src/prompting/AIPromptContentProvider.js` - Add darkness world context
- `src/dependencyInjection/tokens/tokens-core.js` - Add LightingStateService token
- `src/dependencyInjection/registrations/` - Register new service
- `data/mods/dredgers/entities/instances/*.location.json` - Add lighting components

---

## Summary

The proposed lighting system provides:

1. **Data-driven design:** All lighting state determined by components
2. **Modular architecture:** New `locations` mod keeps core clean
3. **Clear separation:** Marker for darkness, array for sources, optional text override
4. **Future extensibility:** Source array allows tracking what provides light
5. **Graceful degradation:** Works without darkness descriptions (generic fallback)
6. **Dual integration:** Both UI and LLM prompts handle darkness consistently
