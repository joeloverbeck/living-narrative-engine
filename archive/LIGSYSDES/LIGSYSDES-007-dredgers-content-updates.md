# LIGSYSDES-007: Add Lighting Components to Dredgers Underground Locations

**STATUS: ✅ COMPLETED**

## Summary

Add the `locations:naturally_dark`, `locations:light_sources`, and `locations:description_in_darkness` components to the appropriate underground location definitions in the dredgers mod. This enables the lighting system for actual game content.

## Rationale

The dredgers mod contains underground locations (lower gallery, construction zone, segments, flooded approach) that should be naturally dark and require artificial light to see. The canal vestibule and service stair are transitional areas that should remain lit (ambient light from above-ground sources).

## Files to Create

None.

## Files to Modify

| File | Change |
|------|--------|
| `data/mods/dredgers/entities/definitions/lower_gallery.location.json` | Add `naturally_dark`, `light_sources`, and `description_in_darkness` components |
| `data/mods/dredgers/entities/definitions/construction_zone.location.json` | Add `naturally_dark`, `light_sources`, and `description_in_darkness` components |
| `data/mods/dredgers/entities/definitions/access_point_segment_a.location.json` | Add `naturally_dark`, `light_sources`, and `description_in_darkness` components |
| `data/mods/dredgers/entities/definitions/segment_b.location.json` | Add `naturally_dark`, `light_sources`, and `description_in_darkness` components |
| `data/mods/dredgers/entities/definitions/segment_c.location.json` | Add `naturally_dark`, `light_sources`, and `description_in_darkness` components |
| `data/mods/dredgers/entities/definitions/flooded_approach.location.json` | Add `naturally_dark`, `light_sources`, and `description_in_darkness` components |
| `data/mods/dredgers/mod-manifest.json` | Add `"locations"` to the `dependencies` array |

## Out of Scope - DO NOT CHANGE

- `canal_vestibule.location.json` (has ambient light from canal doors)
- `concordance_salon.location.json` (above-ground, lit)
- `outer_service_yard.location.json` (outdoor/transitional, lit)
- `service_stair.location.json` (has lantern hooks with some ambient light from above)
- Any source code files
- Component schemas (those are in the `locations` mod)
- Hooded oil lantern entity definition (light source behavior is a future ticket)

## Implementation Details

### Components to Add

For each underground location definition, add these three components:

```json
{
  "locations:naturally_dark": {},
  "locations:light_sources": {
    "sources": []
  },
  "locations:description_in_darkness": {
    "text": "[LOCATION-SPECIFIC SENSORY TEXT]"
  }
}
```

### Darkness Descriptions by Location

Write sensory-focused descriptions emphasizing non-visual senses (sounds, smells, textures, temperature, echoes).

#### `lower_gallery.location.json`

```json
"locations:description_in_darkness": {
  "text": "The darkness presses close. Your boots scrape on uneven flagstone, each step echoing off stone walls that seem too near. The air is cold and mineral, with a chalk-dust bite in your nose. Water drips somewhere ahead—a slow, arrhythmic plinking. The walls sweat with condensation you can feel but not see, and the floor slopes unpredictably underfoot."
}
```

#### `construction_zone.location.json`

```json
"locations:description_in_darkness": {
  "text": "The space opens around you—you sense it in the changed echo and the way the air moves. Dust particles tickle your throat with each breath. Somewhere, timbers creak under settling weight. The ground is treacherous: loose gravel, abandoned tools, unseen drops. The smell of disturbed earth and old iron hangs heavy."
}
```

#### `access_point_segment_a.location.json`

```json
"locations:description_in_darkness": {
  "text": "The tunnel swallows all light. Your hand finds damp brick when you reach out—rough mortar gaps where fingers catch. The air is stale and close, with an undertone of something organic and old. Each sound you make returns to you distorted, stretched by the passage's length."
}
```

#### `segment_b.location.json`

```json
"locations:description_in_darkness": {
  "text": "Complete blackness. The passage narrows—you can feel it in how the echoes shorten. Your breathing sounds too loud. Something scuttles ahead, then silence. The floor is slick with a film you'd rather not identify. The temperature drops noticeably."
}
```

#### `segment_c.location.json`

```json
"locations:description_in_darkness": {
  "text": "The dark here feels heavier, older. Water trickles nearby—not dripping but flowing, a thin stream somewhere below floor level. The walls vibrate faintly with some distant mechanical thrumming. The air tastes of copper and wet stone."
}
```

#### `flooded_approach.location.json`

```json
"locations:description_in_darkness": {
  "text": "Water. You hear it before you feel it—gentle lapping against stone, the hollow sound of an enclosed space with liquid below. When you step forward, cold water floods over your boot. The air is thick with moisture and the smell of stagnant canal water. Something floats past your ankle."
}
```

### Update Dredgers Manifest Dependencies

Add the `locations` mod to the dependencies array in `data/mods/dredgers/mod-manifest.json`:

```json
{
  "id": "locations",
  "version": "^1.0.0"
}
```

## Acceptance Criteria

### Tests That Must Pass

1. **Schema validation**: All modified JSON files must pass validation
   ```bash
   npm run validate
   ```

2. **Mod loading test**: Create integration test
   - File: `tests/integration/mods/dredgers/lightingComponents.integration.test.js`
   - Test: All 6 underground locations have `locations:naturally_dark` component
   - Test: All 6 underground locations have `locations:light_sources` component with empty `sources` array
   - Test: All 6 underground locations have `locations:description_in_darkness` component with non-empty `text`
   - Test: Locations NOT marked naturally dark: `canal_vestibule`, `concordance_salon`, `outer_service_yard`, `service_stair`

3. **Content validation test**:
   - Test: Each darkness description is at least 100 characters
   - Test: Each darkness description focuses on non-visual senses (contains words like "hear", "feel", "smell", "cold", "sound", "echo", etc.)

4. **Existing tests**:
   ```bash
   npm run test:integration -- tests/integration/mods/dredgers/
   ```
   All existing dredgers tests must continue to pass.

### Invariants That Must Remain True

1. **Component schema compliance**: All added components must conform to schemas from LIGSYSDES-002
2. **No breaking changes**: Lit locations remain unchanged and functional
3. **Mod dependency chain**: Dredgers depends on `locations` which depends on `core`
4. **Empty light sources**: All locations start with empty `sources` array (initial darkness)
5. **Backward compatibility**: Game must load and run without the `locations` mod present (graceful degradation)

### Manual Verification

1. `npm run validate` passes
2. Load the game and verify underground locations are dark
3. Verify darkness descriptions appear in UI when in dark locations
4. Verify canal vestibule and service stair remain lit

## Dependencies

- LIGSYSDES-001 (locations mod structure)
- LIGSYSDES-002 (component schemas)

## Blocked By

- LIGSYSDES-002 (needs component schemas to exist)

## Blocks

- E2E testing of the complete lighting system

## Location Classification Reference

| Location | Naturally Dark? | Rationale |
|----------|----------------|-----------|
| `canal_vestibule` | No | Opens to canal/outside, wall-mounted lamps mentioned |
| `concordance_salon` | No | Above-ground room with windows |
| `outer_service_yard` | No | Outdoor area |
| `service_stair` | No | Has lantern hooks, connects to lit areas above |
| `lower_gallery` | **Yes** | Subterranean corridor, mentions lanterns "used to hang" |
| `construction_zone` | **Yes** | Active excavation, underground |
| `access_point_segment_a` | **Yes** | Tunnel/segment, deep underground |
| `segment_b` | **Yes** | Tunnel/segment, deep underground |
| `segment_c` | **Yes** | Tunnel/segment, deep underground |
| `flooded_approach` | **Yes** | Flooded tunnel, deep underground |

## Estimated Diff Size

- 6 modified location definitions (~15 lines each = ~90 lines)
- 1 modified mod manifest (~1 line)
- 1 new test file (~100 lines)
- Total: ~200 lines

---

## Outcome

**Completion Date**: 2025-12-16

### What Was Changed

1. **Ticket Correction**: Fixed manifest dependency format example from shorthand array to full object format `{ "id": "locations", "version": "^1.0.0" }`

2. **Manifest Update**: Added `locations` dependency to `data/mods/dredgers/mod-manifest.json`

3. **Location Definitions Modified** (6 files):
   - `lower_gallery.location.json`
   - `construction_zone.location.json`
   - `access_point_segment_a.location.json`
   - `segment_b.location.json`
   - `segment_c.location.json`
   - `flooded_approach.location.json`

   Each received the 3 lighting components as specified in the ticket.

4. **Integration Test Created**: `tests/integration/mods/dredgers/lightingComponents.integration.test.js`
   - Tests all 6 dark locations have required components
   - Tests 4 lit locations do NOT have `naturally_dark`
   - Tests darkness descriptions meet quality requirements (≥100 chars, sensory words)
   - Tests manifest has `locations` dependency

### Validation Results

- `npm run validate`: ✅ PASSED (0 violations)
- `npm run test:integration -- tests/integration/mods/dredgers/`: ✅ ALL 5 SUITES PASSED (76 tests)

### Deviation from Plan

None. Implementation matched ticket specifications exactly.
