# Music Mod Specification

## Overview

**Mod ID**: `music`
**Version Target**: `1.0.0`
**Working Title**: Musical Performance System
**Summary**: Introduces musical performance capabilities, allowing trained musicians to play instruments with different emotional moods.
**Primary Author**: _TBD_
**Minimum Game Version**: `>=0.0.1`

### Purpose

The music mod expands the character action system with musical performance capabilities. It enables actors with musical training to play instruments with varying emotional tones and moods. The mod establishes a foundation for instrument-based interactions, performance states, and audience engagement mechanics. Musical performances are treated as complex activities that prevent conflicting actions (similar to how hugging prevents certain movements), ensuring realistic gameplay constraints.

### Dependencies

- `positioning` (^1.0.0) — provides the foundation for activity-related state components and supplies the new `positioning:doing_complex_performance` component that gates conflicting actions during performances.
- `core` (^1.0.0) — provides core rule macros, logging helpers, component management, and the action attempt event stream.
- `items` (^1.0.0) — provides item system for instrument entities (optional, for when items mod exists).

## Visual Identity

**Assigned Color Scheme**: Starlight Navy (Section 11.4 of `wcag-compliant-color-combinations.spec.md`)

```json
{
  "backgroundColor": "#1a2332",
  "textColor": "#d1d5db",
  "hoverBackgroundColor": "#2d3748",
  "hoverTextColor": "#f3f4f6"
}
```

- **Contrast Ratios**: Normal 11.8:1 🌟 AAA, Hover 9.2:1 🌟 AAA
- **Theme Fit**: Conveys artistic sophistication and creative expression with a calm, focused aesthetic suitable for musical performances. The deep navy background suggests both professionalism and artistic depth.
- **Usage Note**: This scheme is now tagged as actively used by the Music mod in the WCAG specification; other mods should avoid reusing it unless establishing intentional visual linkage.

## Component Definitions

### 1. `is_musician.component.json`

Marker component indicating the entity has musical training and can perform with instruments.

**Storage**: `data/mods/music/components/is_musician.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "music:is_musician",
  "description": "Marker component indicating the entity is a trained musician capable of playing musical instruments",
  "dataSchema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
```

**Usage**: Required by musical performance actions via the `required_components.actor` array.

### 2. `is_instrument.component.json`

Marker component indicating an item can be played as a musical instrument.

**Storage**: `data/mods/music/components/is_instrument.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "music:is_instrument",
  "description": "Marker component indicating this item is a playable musical instrument",
  "dataSchema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
```

**Usage**: Applied to item entities to mark them as instruments. Used in scopes and action prerequisites to identify available instruments.

### 3. `playing_music.component.json`

State component tracking active musical performance and the instrument being played.

**Storage**: `data/mods/music/components/playing_music.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "music:playing_music",
  "description": "Marks an actor who is actively performing music on an instrument, tracking which instrument is being played",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["playing_on"],
    "properties": {
      "playing_on": {
        "type": "string",
        "description": "The entity ID of the instrument currently being played by this actor",
        "pattern": "^([a-zA-Z0-9_]+:[a-zA-Z0-9_-]+|[a-zA-Z0-9_]+)$"
      },
      "activityMetadata": {
        "type": "object",
        "description": "Inline metadata for activity description generation. Allows this component to define how it should be described in activity summaries without requiring a separate metadata component.",
        "additionalProperties": false,
        "properties": {
          "shouldDescribeInActivity": {
            "type": "boolean",
            "default": true,
            "description": "Whether this component should be included in activity descriptions. Set to false to hide from activity summaries."
          },
          "template": {
            "type": "string",
            "default": "{actor} is playing {target}",
            "description": "Template string with placeholders: {actor} for the entity with this component, {target} for the instrument entity referenced by playing_on"
          },
          "targetRole": {
            "type": "string",
            "default": "playing_on",
            "description": "Property name in this component's data containing the target entity ID. References the instrument being played."
          },
          "priority": {
            "type": "integer",
            "minimum": 0,
            "maximum": 100,
            "default": 70,
            "description": "Display priority for activity ordering. Higher values appear first. Range: 0-100. High priority (70) for active performance, as it's a primary visible activity."
          }
        }
      }
    }
  }
}
```

**Usage**: Added to the actor when they begin playing an instrument, removed when they stop. The `playing_on` property links to the instrument entity ID.

### 4. `performance_mood.component.json`

State component defining the emotional tone of the current musical performance.

**Storage**: `data/mods/music/components/performance_mood.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "music:performance_mood",
  "description": "Defines the emotional mood and tone of a musical performance",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["mood"],
    "properties": {
      "mood": {
        "type": "string",
        "description": "The emotional character of the performance",
        "enum": [
          "cheerful",
          "solemn",
          "mournful",
          "eerie",
          "tense",
          "triumphant",
          "tender",
          "playful",
          "aggressive",
          "meditative"
        ]
      },
      "activityMetadata": {
        "type": "object",
        "description": "Inline metadata for activity description generation.",
        "additionalProperties": false,
        "properties": {
          "shouldDescribeInActivity": {
            "type": "boolean",
            "default": true,
            "description": "Whether this component should be included in activity descriptions."
          },
          "template": {
            "type": "string",
            "default": "{actor} performs with {mood} mood",
            "description": "Template string describing the performance mood. The {mood} placeholder will be replaced with the mood value."
          },
          "priority": {
            "type": "integer",
            "minimum": 0,
            "maximum": 100,
            "default": 65,
            "description": "Display priority for activity ordering. Moderate-high priority (65) as it modifies the primary performance activity."
          }
        }
      }
    }
  }
}
```

**Usage**: Added alongside `playing_music` to characterize the performance. Can be set when starting to play or changed dynamically during performance.

**Mood Descriptions**:
- **cheerful**: Bright, uplifting, joyful
- **solemn**: Serious, dignified, formal
- **mournful**: Sad, lamenting, grief-stricken
- **eerie**: Unsettling, mysterious, haunting
- **tense**: Anxious, suspenseful, nervous
- **triumphant**: Victorious, celebratory, glorious
- **tender**: Gentle, loving, intimate
- **playful**: Light-hearted, whimsical, fun
- **aggressive**: Forceful, intense, combative
- **meditative**: Calm, contemplative, peaceful

### 5. `doing_complex_performance.component.json` (Positioning Mod)

Marker component added to the positioning mod to indicate an actor is engaged in a complex performance activity.

**Storage**: `data/mods/positioning/components/doing_complex_performance.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "positioning:doing_complex_performance",
  "description": "Marker component indicating the entity is engaged in a complex performance activity that requires concentration and prevents certain physical actions",
  "dataSchema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
```

**Usage**: Applied to actors during musical performances (and potentially other performance types like dancing, theatrical acting, etc.). Used as a forbidden component in actions that would be incompatible with complex performances (e.g., violent actions, certain movement actions).

**Positioning Mod Integration**:
- Add to `data/mods/positioning/components/` directory
- Update `data/mods/positioning/mod-manifest.json` to include this component in the `content.components` array
- This component provides a reusable abstraction for any mod that needs to gate actions during performance states

## Initial Action Suggestions

While the core specification focuses on component infrastructure, here are suggested initial actions for future implementation:

### Play Instrument
- **Action ID**: `music:play_instrument`
- **Targets**: `"item"` (the instrument to play)
- **Required Components**:
  - `actor`: `["music:is_musician"]`
  - `target`: `["music:is_instrument"]`
- **Forbidden Components**:
  - `actor`: `["positioning:hugging", "music:playing_music"]`
- **Effect**: Adds `music:playing_music` and `positioning:doing_complex_performance` to actor, adds default `music:performance_mood`

### Stop Playing
- **Action ID**: `music:stop_playing`
- **Targets**: `"none"`
- **Required Components**:
  - `actor`: `["music:playing_music"]`
- **Effect**: Removes `music:playing_music`, `positioning:doing_complex_performance`, and `music:performance_mood` from actor

### Change Performance Mood
- **Action ID**: `music:change_performance_mood`
- **Targets**: `"none"`
- **Required Components**:
  - `actor`: `["music:playing_music"]`
- **Parameters**: Accept mood selection from available enum values
- **Effect**: Updates the `mood` property in actor's `music:performance_mood` component

## File & Directory Layout

```
data/mods/music/
├── mod-manifest.json
├── components/
│   ├── is_musician.component.json
│   ├── is_instrument.component.json
│   ├── playing_music.component.json
│   └── performance_mood.component.json
├── actions/
│   └── (future: play_instrument.action.json, stop_playing.action.json, etc.)
├── rules/
│   └── (future: handle_play_instrument.rule.json, etc.)
├── conditions/
│   └── (future: event-is-action-play-instrument.condition.json, etc.)
└── scopes/
    └── (future: available_instruments.scope, etc.)

data/mods/positioning/components/
└── doing_complex_performance.component.json (NEW)
```

### Mod Manifest Structure

**File**: `data/mods/music/mod-manifest.json`

```json
{
  "$schema": "http://example.com/schemas/mod-manifest.schema.json",
  "id": "music",
  "version": "1.0.0",
  "name": "Music Performance System",
  "description": "Musical performance capabilities with instruments and emotional moods",
  "author": "Living Narrative Engine",
  "gameVersion": ">=0.0.1",
  "dependencies": [
    {
      "id": "positioning",
      "version": "^1.0.0"
    },
    {
      "id": "core",
      "version": "^1.0.0"
    }
  ],
  "content": {
    "components": [
      "is_musician.component.json",
      "is_instrument.component.json",
      "playing_music.component.json",
      "performance_mood.component.json"
    ],
    "actions": [],
    "rules": [],
    "conditions": [],
    "scopes": []
  }
}
```

## Testing Strategy

Comprehensive automated testing is required for component validation and integration:

### 1. Component Schema Tests
- **Location**: `tests/unit/mods/music/components/`
- **Coverage**:
  - Validate all component schemas load correctly
  - Test `is_musician` and `is_instrument` marker components (empty properties)
  - Test `playing_music` state component with valid/invalid entity IDs
  - Test `performance_mood` with all enum values and reject invalid moods
  - Test `doing_complex_performance` in positioning mod

### 2. Component Integration Tests
- **Location**: `tests/integration/mods/music/`
- **Coverage**:
  - Adding/removing `playing_music` component correctly links to instrument entity
  - `performance_mood` component can be added/updated with valid moods
  - `doing_complex_performance` component integration with positioning mod
  - Activity metadata rendering for performance states
  - Multiple musicians performing simultaneously with different instruments and moods

### 3. Positioning Mod Integration Tests
- **Location**: `tests/integration/mods/positioning/`
- **Coverage**:
  - `doing_complex_performance` component loads with positioning mod
  - Component can be used in action forbidden_components constraints
  - No regression in existing positioning mod functionality

### 4. Future Action Tests (when actions are implemented)
- Action discovery with `is_musician` and `is_instrument` requirements
- Play/stop instrument workflow
- Mood change during performance
- Forbidden action enforcement during performance

**Test Execution**: Use the mod testing framework documented in `docs/testing/mod-testing-guide.md`, leveraging `ModTestFixture` and scenario helpers.

## Implementation Notes

### Phase 1: Component Infrastructure (This Spec)
1. Create music mod directory structure
2. Implement all five component definitions
3. Add `doing_complex_performance` to positioning mod
4. Update positioning mod manifest
5. Create component validation tests
6. Update WCAG spec to mark Starlight Navy as assigned

### Phase 2: Basic Actions (Future Spec)
1. Implement play/stop instrument actions
2. Create instrument scopes for discovery
3. Add rule handlers for performance start/end
4. Implement mood selection/change mechanics

### Phase 3: Advanced Features (Future Specs)
1. Audience reaction system
2. Performance quality mechanics
3. Multiple instruments/ensemble playing
4. Performance interruption handling
5. Instrument-specific capabilities

### Validation Requirements
- Run `npm run scope:lint` for any scope definitions
- Run `npm run validate` to confirm schema compliance
- Ensure all component IDs follow `music:identifier` pattern
- Verify positioning mod manifest includes new component
- Test component loading during mod initialization

### Design Principles

**Reusability**: The `doing_complex_performance` component is intentionally generic and placed in positioning mod to serve as a shared foundation for various performance activities (music, dance, theater, etc.).

**Modularity**: Components are self-contained with clear purposes. The music mod can evolve independently while relying on positioning mod's performance state infrastructure.

**Extensibility**:
- The mood enum can be expanded in future versions
- Additional instruments require only entity definitions with `is_instrument` marker
- Performance mechanics can be enhanced without changing core components

**Compatibility**:
- Avoid state conflicts with existing positioning components (hugging, kneeling, etc.)
- Use consistent activity metadata patterns for UI rendering
- Follow established component priority ranges (60-70 for active activities)

## Reference Alignment

### Similar Patterns in Existing Mods

**Positioning Mod (Hugging System)**:
- `hugging` and `being_hugged` components provide precedent for bidirectional relationship components
- `playing_music` follows similar pattern but references an item rather than another actor
- Activity metadata structure is directly modeled on the hugging components

**Gymnastics/Ballet Mods**:
- Marker components (`is_gymnast`, `is_ballet_dancer`) establish pattern for `is_musician`
- Forbidden components during complex activities inform `doing_complex_performance` usage
- Self-targeted performance actions provide template for future music actions

**Items Mod** (when available):
- `is_instrument` marker will be applied to item entities
- Inventory and item interaction patterns will inform instrument selection mechanics

### Narrative Voice
- Performance descriptions should be evocative and mood-appropriate
- Log messages focus on the musician's actions and emotional expression
- Audience/observer reactions can be handled through separate event listeners

## Dependency Chain

```
core (foundation)
  ↓
positioning (spatial relationships, performance states)
  ↓
music (musical performances)
  ↓
(future: items mod for instrument entities)
  ↓
(future: audience reaction systems, ensemble mechanics)
```

## Next Steps

1. **Implement Components**: Create all five component JSON files per specifications above
2. **Update Positioning Mod**: Add `doing_complex_performance.component.json` and update manifest
3. **Create Tests**: Build comprehensive component validation test suite
4. **Validate Schemas**: Run validation tools to ensure schema compliance
5. **Update WCAG Spec**: Mark Starlight Navy (11.4) as actively used by Music mod
6. **Documentation**: Update mod dependency documentation to reflect music mod
7. **Future Planning**: Draft separate specs for action implementation phases

---

**Specification Status**: Ready for Implementation
**Last Updated**: 2025-11-04
**Version**: 1.0.0
