# Positioning System Mod

## Overview

The Positioning System mod provides foundational mechanics for managing physical positioning and spatial relationships between actors in the Living Narrative Engine. This mod was extracted from the intimacy mod to create a cleaner separation of concerns and allow other mods (like violence or social interactions) to use positioning mechanics without depending on intimacy-specific features.

## Features

### Components

- **closeness**: Tracks actors who are in close physical proximity (closeness circle)
- **facing_away**: Tracks which actors an entity is facing away from
- **kneeling_before**: Tracks kneeling or respectful positioning states

### Actions

- **get_close**: Move closer to a target actor, entering their personal space
- **step_back**: Step away from current closeness circle
- **turn_around**: Turn another actor around or have them face you
- **turn_around_to_face**: Turn to face someone you're currently facing away from
- **kneel_before**: Kneel before another actor in a respectful or submissive gesture
- **crawl_to**: Crawl submissively to the entity you are kneeling before, establishing closeness while maintaining the kneeling posture
- **sit_down**: Sit on available furniture in any open seat
- **sit_down_at_distance**: Sit on available furniture while maintaining a one-seat buffer from a selected occupant
  - Requires: Furniture with at least 2 empty seats to the right of an occupant
  - Effect: Actor sits at position (occupant + 2), leaving one empty buffer seat between
  - Differs from `sit_down`: Explicitly maintains social distance from specific person
  - Availability: Only appears when valid occupants with space exist on selected furniture

### Mechanics

1. **Closeness Circles**: When actors get close, they form or join closeness circles that track who is in intimate proximity
2. **Facing Direction**: Actors can face toward or away from others, affecting available interactions
3. **Movement Restrictions**: Some actions require or forbid certain positioning states
4. **Respectful Positioning**: Support for formal gestures like kneeling, bowing, and other positioning behaviors

## Dependencies

- **core**: Required for base actor functionality and movement conditions

## Usage

This mod is intended to be a dependency for other mods that need positioning mechanics:

```json
{
  "dependencies": [
    {
      "id": "positioning",
      "version": "^1.0.0"
    }
  ]
}
```

## Migration Note

This mod contains functionality previously housed in the intimacy mod. The migration was performed to:

- Improve separation of concerns
- Enable reuse by non-intimacy mods
- Create cleaner architectural boundaries

All component and action IDs have been updated from `intimacy:*` to `positioning:*`.

## Architecture Benefits

### Modularity

Other mods (like violence, social interactions) can use positioning mechanics without depending on intimacy-specific features.

### Clarity

Clear separation of concerns between physical positioning and intimate relationships.

### Reusability

Positioning mechanics become a foundational system that can be extended by multiple mods.

## Current Implementation

The mod includes comprehensive positioning functionality:

- Kneeling behaviors and respectful gestures
- Sitting mechanics with furniture occupancy tracking
- Distance-based positioning (sit at distance with buffer seats)
- Closeness and proximity tracking
- Facing direction mechanics
- Spatial relationship tracking with event-driven state management
- Multi-target actions with contextual scope filtering

## Future Expansion

Potential future enhancements include:

- Advanced straddling mechanics and positioning variations
- Lying down and prone positioning states
- Group positioning actions (everyone kneel, form a line)
- Environmental constraints (walls, obstacles affecting positioning)
- Distance-based validation for near/far positioning gradients
