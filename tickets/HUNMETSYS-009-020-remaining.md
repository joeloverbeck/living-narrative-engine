# HUNMETSYS-009 through HUNMETSYS-020: Remaining Tickets

This file contains condensed versions of the remaining tickets. Each should be expanded into full ticket format when ready to implement.

---

## HUNMETSYS-009: Action Rule Handlers

**Phase:** 2 - Mod Structure  
**Dependencies:** HUNMETSYS-005, 008  
**Estimated Effort:** 5 hours

### Objective
Create rule handlers that execute when eat, drink, and rest actions are attempted.

### Files to Touch
- **New:** `data/mods/metabolism/rules/handle_eat.rule.json`
- **New:** `data/mods/metabolism/rules/handle_drink.rule.json`
- **New:** `data/mods/metabolism/rules/handle_rest.rule.json`
- **Modified:** `data/mods/metabolism/mod-manifest.json`

### Key Implementation
- Eat/Drink rules: Call CONSUME_ITEM operation, dispatch action_completed event
- Rest rule: Add fixed energy (50 points), increase digestion multiplier to 1.5x
- All rules trigger on `core:attempt_action` event

### Out of Scope
- Integration tests (HUNMETSYS-017)
- Energy costs on actions (HUNMETSYS-016)

---

## HUNMETSYS-010: Sample Food Entities

**Phase:** 2 - Mod Structure  
**Dependencies:** HUNMETSYS-001  
**Estimated Effort:** 3 hours

### Objective
Create sample food entity definitions demonstrating different fuel source properties.

### Files to Touch
- **New:** `data/mods/metabolism/entities/definitions/bread.entity.json`
- **New:** `data/mods/metabolism/entities/definitions/water.entity.json`
- **New:** `data/mods/metabolism/entities/definitions/steak.entity.json`
- **Modified:** `data/mods/metabolism/mod-manifest.json`

### Key Implementation
- **Bread:** Balanced (energy: 200, bulk: 30, medium digestion)
- **Water:** Low energy, high bulk, fast digestion, liquid tag
- **Steak:** High energy, medium bulk, slow digestion, meat tag

### Out of Scope
- Complex recipes or cooking (future extension)
- Spoilage mechanics (future extension)
- Nutritional variety system (future extension)

---

## HUNMETSYS-011: JSON Logic Operators - Hunger Detection

**Phase:** 3 - GOAP Integration  
**Dependencies:** HUNMETSYS-002  
**Estimated Effort:** 4 hours

### Objective
Implement `is_hungry` JSON Logic operator for GOAP preconditions.

### Files to Touch
- **New:** `src/logic/operators/isHungryOperator.js`
- **New:** `tests/unit/logic/operators/isHungryOperator.test.js`
- **Modified:** `src/logic/jsonLogicCustomOperators.js`

### Key Implementation
- Returns true if hunger_state is "hungry", "starving", or "critical"
- Returns false otherwise
- Used in GOAP goal preconditions

### Out of Scope
- Threshold calculation (handled in UPDATE_HUNGER_STATE)
- Energy percentage calculation

---

## HUNMETSYS-012: JSON Logic Operators - Energy Prediction

**Phase:** 3 - GOAP Integration  
**Dependencies:** HUNMETSYS-001, 002  
**Estimated Effort:** 5 hours

### Objective
Implement `predicted_energy` and `can_consume` operators to prevent AI overeating.

### Files to Touch
- **New:** `src/logic/operators/predictedEnergyOperator.js`
- **New:** `src/logic/operators/canConsumeOperator.js`
- **New:** `tests/unit/logic/operators/predictedEnergyOperator.test.js`
- **New:** `tests/unit/logic/operators/canConsumeOperator.test.js`
- **Modified:** `src/logic/jsonLogicCustomOperators.js`

### Key Implementation
- **predicted_energy:** current_energy + (buffer_storage × efficiency)
- **can_consume:** Validates fuel tags match and buffer has room
- Prevents AI from eating when predicted energy is sufficient

### Out of Scope
- GOAP planner modifications (should work with existing planner)

---

## HUNMETSYS-013: GOAP Goals & Conditions

**Phase:** 3 - GOAP Integration  
**Dependencies:** HUNMETSYS-011, 012  
**Estimated Effort:** 6 hours

### Objective
Create GOAP goal for hunger satisfaction plus conditions and scopes for food discovery.

### Files to Touch
- **New:** `data/mods/metabolism/goap/goals/satisfy_hunger.goal.json`
- **New:** `data/mods/metabolism/conditions/has_energy_above.condition.json`
- **New:** `data/mods/metabolism/conditions/is_hungry.condition.json`
- **New:** `data/mods/metabolism/conditions/can_consume.condition.json`
- **New:** `data/mods/metabolism/conditions/is_digesting.condition.json`
- **New:** `data/mods/metabolism/scopes/nearby_food.scope`
- **New:** `data/mods/metabolism/scopes/consumable_items.scope`
- **New:** `data/mods/metabolism/scopes/inventory_food.scope`
- **Modified:** `data/mods/metabolism/mod-manifest.json`

### Key Implementation
- Goal activates when is_hungry OR predicted_energy < 500
- Desired state: predicted_energy > 700
- Valid actions: eat, drink
- Scopes find food in inventory, nearby, or in containers

### Out of Scope
- GOAP planner implementation (assumed exists)
- Complex AI behavior tuning

---

## HUNMETSYS-014: Operation Handler - UPDATE_HUNGER_STATE

**Phase:** 4 - Visual Integration  
**Dependencies:** HUNMETSYS-002  
**Estimated Effort:** 6 hours

### Objective
Implement UPDATE_HUNGER_STATE operation that calculates hunger state from energy thresholds.

### Files to Touch
- **New:** `data/schemas/operations/updateHungerState.schema.json`
- **New:** `src/logic/operationHandlers/updateHungerStateHandler.js`
- **New:** `tests/unit/logic/operationHandlers/updateHungerStateHandler.test.js`
- **Modified:** `data/schemas/operation.schema.json`
- **Modified:** DI files (tokens, registrations, preValidation)

### Key Implementation
- Calculate energy_percentage: (current_energy / max_energy) × 100
- Map to state: gluttonous (>100%), satiated (75-100%), neutral (30-75%), hungry (10-30%), starving (0.1-10%), critical (≤0%)
- Increment turns_in_state or reset to 0 on state change
- Dispatch metabolism:hunger_state_changed event

### Out of Scope
- State effects application (handled by other systems)
- Body composition updates (HUNMETSYS-015)

---

## HUNMETSYS-015: Operation Handler - UPDATE_BODY_COMPOSITION

**Phase:** 4 - Visual Integration  
**Dependencies:** HUNMETSYS-014, anatomy mod  
**Estimated Effort:** 7 hours

### Objective
Implement UPDATE_BODY_COMPOSITION operation that modifies anatomy:body composition based on prolonged hunger states.

### Files to Touch
- **New:** `data/schemas/operations/updateBodyComposition.schema.json`
- **New:** `src/logic/operationHandlers/updateBodyCompositionHandler.js`
- **New:** `tests/unit/logic/operationHandlers/updateBodyCompositionHandler.test.js`
- **Modified:** `data/schemas/operation.schema.json`
- **Modified:** DI files (tokens, registrations, preValidation)
- **Modified:** `data/mods/metabolism/rules/turn_hunger_update.rule.json` (add operation call)

### Key Implementation
- Only updates if entity has anatomy:body component
- Maps turns_in_state to composition descriptors:
  - Critical 20+ turns → desiccated
  - Starving 30+ turns → wasted
  - Gluttonous 50+ turns → overweight
- Updates gradual (not instant)
- Dispatches anatomy:body_composition_changed event

### Out of Scope
- New body descriptors (use existing from anatomy mod)
- Hair density/other descriptor changes
- Immediate visual feedback

---

## HUNMETSYS-016: Energy Costs for Movement & Exercise

**Phase:** 5 - Action Energy Costs  
**Dependencies:** HUNMETSYS-003, 007  
**Estimated Effort:** 5 hours

### Objective
Integrate BURN_ENERGY operation into existing movement and exercise action rules.

### Files to Touch (Modified 6+)
- `data/mods/movement/rules/go.rule.json` (add BURN_ENERGY with 1.2x multiplier)
- `data/mods/movement/rules/run.rule.json` (add BURN_ENERGY with 2.0x multiplier)
- `data/mods/exercise/rules/ballet_*.rule.json` (add BURN_ENERGY with 3.0x multiplier)
- `data/mods/exercise/rules/gymnastics_*.rule.json` (add BURN_ENERGY with 3.0x multiplier)
- Combat mod rules if applicable (2.5x multiplier)
- Sex mod rules if applicable (2.5x multiplier)

### Key Implementation
- Add BURN_ENERGY to actions array in each rule
- Set appropriate activity_multiplier per action type
- Maintain existing action logic (additive not replacement)

### Out of Scope
- Creating new actions
- Modifying action prerequisites
- Balancing gameplay (initial values from spec)

---

## HUNMETSYS-017: Integration Tests & Performance Validation

**Phase:** 5 - Integration Testing  
**Dependencies:** HUNMETSYS-001-016 (all previous)  
**Estimated Effort:** 10 hours

### Objective
Create comprehensive integration and performance tests for complete system.

### Files to Touch (New 8+)
- `tests/integration/mods/metabolism/eatAction.test.js`
- `tests/integration/mods/metabolism/turnProcessing.test.js`
- `tests/integration/mods/metabolism/hungerCycle.test.js`
- `tests/integration/goap/hungerGoals.test.js`
- `tests/e2e/metabolism/completeHungerCycle.test.js`
- `tests/e2e/metabolism/multiEntityProcessing.test.js`
- `tests/performance/metabolism/turnProcessing.performance.test.js`
- `tests/performance/metabolism/scalability.performance.test.js`

### Key Tests
- Complete hunger cycle (eat → digest → burn → state update → body composition)
- Multi-entity turn processing (100 entities)
- GOAP hunger goal activation and planning
- AI eating behavior (no spam eating)
- Performance: <100ms per turn for 100 entities
- Linear scaling validation

### Out of Scope
- Unit tests (created with each handler)
- Manual QA testing

---

## HUNMETSYS-018: Edge Cases & Error Handling

**Phase:** 6 - Polish  
**Dependencies:** HUNMETSYS-001-017  
**Estimated Effort:** 6 hours

### Objective
Handle all edge cases identified in spec and add comprehensive error handling.

### Files to Touch (Modified 5-10)
- All operation handlers (add edge case handling)
- Error message improvements
- Validation enhancements
- Clamp operations for numeric values

### Key Edge Cases
1. Negative energy scenarios (clamp to 0, apply critical state)
2. Overeating mechanics (capacity checking, penalties)
3. Invalid fuel types (clear error messages)
4. Missing components (graceful degradation)
5. Energy underflow/overflow (clamping)
6. Turn processing order conflicts (deterministic order)
7. Division by zero (minimum value validation)
8. Simultaneous consumption (entity locking)

### Out of Scope
- Overeating/vomiting full implementation (marked as future extension)
- New features beyond spec

---

## HUNMETSYS-019: Complete Test Coverage

**Phase:** 6 - Polish  
**Dependencies:** HUNMETSYS-018  
**Estimated Effort:** 8 hours

### Objective
Ensure test coverage meets project requirements: 80%+ branches, 90%+ functions/lines.

### Files to Touch (New 10+)
- Additional unit tests for uncovered code paths
- Additional integration tests for system interactions
- Edge case tests
- Validation tests for all schemas
- Error condition tests

### Coverage Targets
- **Branches:** 80%+ required
- **Functions:** 90%+ required
- **Lines:** 90%+ required
- **Statements:** 90%+ required

### Key Areas
- All operation handlers fully covered
- All JSON Logic operators fully covered
- Edge cases from HUNMETSYS-018 tested
- Event dispatching tested
- Component validation tested

### Out of Scope
- Visual/manual testing
- UI testing
- Browser-specific testing

---

## HUNMETSYS-020: Documentation & Examples

**Phase:** 6 - Polish  
**Dependencies:** HUNMETSYS-001-019  
**Estimated Effort:** 6 hours

### Objective
Create complete documentation for modders and developers.

### Files to Touch (New 3+)
- `docs/mods/metabolism-system.md` (modder guide)
- `docs/development/metabolism-architecture.md` (developer guide)
- `docs/examples/metabolism-custom-entities.md` (examples)

### Documentation Sections

**For Modders:**
- Creating custom food items
- Creating custom fuel converters (vampire, robot, etc.)
- Adding energy costs to custom actions
- Fuel tag system explanation
- Threshold configuration

**For Developers:**
- Architecture overview
- Operation handler patterns
- Event flow diagrams
- Performance optimization
- Extension points

**Examples:**
- Vampire with blood-only metabolism
- Robot with electricity fuel
- Steam-powered entity with coal
- Custom food with unique properties
- Custom hunger thresholds

### Out of Scope
- API documentation (generated from JSDoc)
- Tutorial videos
- Interactive examples

---

# Implementation Priority

**Critical Path (Must Complete First):**
1. HUNMETSYS-001, 002 (Component schemas)
2. HUNMETSYS-003, 004, 005 (Core operations)
3. HUNMETSYS-006, 007 (Mod structure and turn processing)
4. HUNMETSYS-014 (Hunger state updates)

**Secondary (Core Gameplay):**
5. HUNMETSYS-008, 009, 010 (Actions and food)
6. HUNMETSYS-011, 012, 013 (GOAP integration)

**Tertiary (Enhancement):**
7. HUNMETSYS-015 (Body composition)
8. HUNMETSYS-016 (Energy costs)

**Final (Quality):**
9. HUNMETSYS-017, 018, 019 (Testing)
10. HUNMETSYS-020 (Documentation)

---

# Notes

Each of these condensed tickets should be expanded into full format (matching HUNMETSYS-001 through HUNMETSYS-007) when ready to implement, including:
- Complete "Files to Touch" section
- Detailed "Out of Scope" section
- Comprehensive "Acceptance Criteria"
- Test examples
- Invariants documentation
- References to spec sections
