# HUNMETSYS-000: Hunger and Metabolism System - Overview

**Status:** Planning  
**Priority:** High  
**Estimated Effort:** 6 weeks  
**Dependencies:** anatomy mod (v1.0.0+)

## System Summary

Implementation of a comprehensive hunger and metabolism system that transforms food consumption from instant-gratification into strategic resource management with realistic digestion, energy conversion, and metabolic processes.

## Key Features

- **Digestion Buffer System**: Food enters stomach before converting to energy
- **Dual-Value Food**: Volume (satiety) vs. Calories (energy)
- **Threshold-Based States**: Hidden numerical values with emergent gameplay states
- **Generic Fuel Abstraction**: Supports humans, vampires, robots, etc.
- **GOAP-Safe Design**: Prevents AI overeating through predicted energy calculation
- **Anatomy Integration**: Visual consequences of starvation through body composition
- **Turn-Based Processing**: Automatic energy burn and digestion each turn

## Implementation Phases

### Phase 1: Foundation (Tickets 001-005)

- Component schemas and operation handlers
- Core business logic for metabolism
- Schema validation and DI setup

### Phase 2: Mod Structure (Tickets 006-010)

- Complete metabolism mod structure
- Turn-based processing rules
- Action definitions and handlers

### Phase 3: GOAP Integration (Tickets 011-013)

- Custom JSON Logic operators
- Hunger-driven AI behavior
- Energy-based action costs

### Phase 4: Visual Integration (Tickets 014-015)

- Body composition updates
- State change events
- UI/audio feedback

### Phase 5: Action Energy Costs (Tickets 016-017)

- Energy cost integration for existing actions
- Gameplay balancing
- Performance validation

### Phase 6: Polish & Documentation (Tickets 018-020)

- Edge case handling
- Complete test coverage
- Documentation and examples

## Ticket List

- **HUNMETSYS-001**: Component Schemas - Fuel Converter & Fuel Source
- **HUNMETSYS-002**: Component Schemas - Metabolic Store & Hunger State
- **HUNMETSYS-003**: Operation Handler - BURN_ENERGY
- **HUNMETSYS-004**: Operation Handler - DIGEST_FOOD
- **HUNMETSYS-005**: Operation Handler - CONSUME_ITEM
- **HUNMETSYS-006**: Mod Structure Setup
- **HUNMETSYS-007**: Turn-Based Processing Rules
- **HUNMETSYS-008**: Action Definitions - Eat, Drink, Rest
- **HUNMETSYS-009**: Action Rule Handlers
- **HUNMETSYS-010**: Sample Food Entities
- **HUNMETSYS-011**: JSON Logic Operators - Hunger Detection
- **HUNMETSYS-012**: JSON Logic Operators - Energy Prediction
- **HUNMETSYS-013**: GOAP Goals & Conditions
- **HUNMETSYS-014**: Operation Handler - UPDATE_HUNGER_STATE
- **HUNMETSYS-015**: Operation Handler - UPDATE_BODY_COMPOSITION
- **HUNMETSYS-016**: Energy Costs for Movement & Exercise
- **HUNMETSYS-017**: Integration Tests & Performance Validation
- **HUNMETSYS-018**: Edge Cases & Error Handling
- **HUNMETSYS-019**: Complete Test Coverage
- **HUNMETSYS-020**: Documentation & Examples

## Success Criteria

- All component schemas validate correctly
- All operation handlers achieve 90%+ test coverage
- Turn-based processing works reliably
- AI makes intelligent eating decisions without spamming
- Body composition updates realistically over time
- Performance target: <100ms per turn for 100 entities
- Gameplay feels balanced and strategic
- All edge cases handled gracefully
- Complete documentation for modders

## Technical Notes

- Uses ECS architecture throughout
- All mechanics defined through mod files
- Event-driven communication via event bus
- Dependency injection for all handlers
- AJV schema validation for all components
- Compatible with existing anatomy, movement, and exercise mods

## Related Documentation

- Spec: `specs/hunger-metabolism-system.md`
- CLAUDE.md: Operation handler addition checklist
- Body Descriptors: `docs/anatomy/body-descriptors-complete.md`
- Mod Testing: `docs/testing/mod-testing-guide.md`
