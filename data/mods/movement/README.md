# Movement Mod

## Purpose

The Movement mod provides all spatial navigation and movement mechanics for the Living Narrative Engine. It serves as the authoritative source for movement-related functionality, separating these mechanics from the core mod to maintain clean architectural boundaries.

## Features

- **Basic Movement Actions**: Primary movement command (go to location) for actor navigation
- **Movement Validation**: Conditions to check if actors can move to specific locations
- **Exit Management**: Handling of blocked and unblocked paths between locations
- **Direction Scoping**: UI support for available movement directions
- **Movement Rules**: Event processing for movement actions and their consequences

## Dependencies

- **core (^1.0.0)**: Required for basic entity and component systems, actor definitions, and position management

## Content Types

### Actions

Movement commands available to actors:

- `go` action: Navigate to a different location

### Rules

Movement event processing logic:

- Movement validation rules
- Location transition handling

### Conditions

Movement validation logic:

- `actor-can-move`: Validates if an actor is capable of movement
- `exit-is-unblocked`: Checks if a path is available
- `event-is-action-go`: Identifies movement action events

### Scopes

Direction and path availability:

- Direction availability for UI display
- Path validation for movement options

### Macros

Movement-related macros for reusable logic patterns

## Architecture

The movement mod follows the Entity-Component-System (ECS) architecture:

- **Components**: Data definitions for movement-related properties
- **Rules**: Processing logic for movement events
- **Conditions**: Validation logic for movement operations
- **Actions**: Available movement commands

## Color Scheme

The movement mod uses the **Explorer Cyan** color scheme (#5EC8E5) for its visual elements, representing exploration and navigation.

## Migration Status

This mod is part of a larger architectural refactoring to extract movement functionality from the core mod. The migration follows a phased approach to ensure system stability and backward compatibility.

## Future Enhancements

- Advanced pathfinding algorithms
- Movement cost calculations
- Terrain-based movement restrictions
- Vehicle and mount support
- Fast travel systems
