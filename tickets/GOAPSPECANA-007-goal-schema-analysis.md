# GOAPSPECANA-007: Goal Schema Analysis and Migration

**Status**: Not Started
**Priority**: CRITICAL
**Estimated Effort**: 1 day
**Dependencies**: GOAPSPECANA-002 (task schema provides context)
**Blocks**: GOAPSPECANA-010 (goal selection implementation)

## Problem Statement

Lines 235-236 state "You'll need to figure out if this schema will need to change" for the existing `data/schemas/goal.schema.json`. This punts a critical decision without analysis, blocking goal system design.

## Objective

Analyze existing goal schema for compatibility with new GOAP system, document required changes (if any), and provide migration path for existing goals.

## Acceptance Criteria

- [ ] Existing `goal.schema.json` analyzed completely
- [ ] Compatibility with new GOAP assessed
- [ ] Required schema changes documented (if needed)
- [ ] Migration path specified for existing goals
- [ ] Decision recorded with rationale
- [ ] Updated or validated schema complete

## Tasks

### 1. Analyze Existing Goal Schema
- [ ] Read `data/schemas/goal.schema.json`
- [ ] Document current structure:
  - Required fields
  - Optional fields
  - Validation rules
  - Default values
- [ ] List existing goals in project (if any):
  ```bash
  find data/mods -name "*.goal.json"
  ```
- [ ] Understand original GOAP system design (pre-removal)

### 2. Define New GOAP Goal Requirements
- [ ] Based on specification, goals need:
  - Goal identification (id, name)
  - Satisfaction condition (when is goal achieved?)
  - Priority/importance (for goal selection)
  - Preconditions (when is goal relevant?)
  - Success metrics (how to measure achievement?)
  - Failure conditions (when to abandon goal?)
- [ ] Example goal structure needed:
  ```json
  {
    "id": "survival:reduce_hunger",
    "name": "Satisfy Hunger",
    "priority": "high",
    "relevance_preconditions": {
      "actor.state.hunger": {">=": 60}
    },
    "satisfaction_condition": {
      "actor.state.hunger": {"<": 30}
    },
    "failure_conditions": [
      {"actor.state.hunger": {">=": 95}}
    ],
    "timeout_turns": 20
  }
  ```

### 3. Compatibility Assessment
- [ ] Compare existing schema to requirements:
  - Does it have satisfaction conditions?
  - Does it have priority?
  - Does it have preconditions?
  - Is structure compatible with planner?
- [ ] Identify gaps:
  - Missing fields needed by new system
  - Incompatible field types
  - Unclear semantics
- [ ] Identify conflicts:
  - Fields that contradict new design
  - Deprecated concepts from old GOAP

### 4. Decision: Migrate or Replace
- [ ] Option A: Existing schema compatible
  - Document compatibility
  - Minor additions only (if needed)
  - Preserve existing goals

- [ ] Option B: Schema needs changes
  - Document specific changes needed
  - Create migration script for existing goals
  - Version schema appropriately

- [ ] Option C: Schema incompatible, replace entirely
  - Document why incompatible
  - Create new schema from scratch
  - Archive old schema
  - Create conversion guide

### 5. Schema Updates (if needed)
- [ ] If modifying existing schema:
  - Add new required fields
  - Add new optional fields
  - Update validation rules
  - Increment schema version
  - Maintain backward compatibility (if possible)
- [ ] If creating new schema:
  - Design complete structure
  - Include all GOAP requirements
  - Add comprehensive validation
  - Document thoroughly
- [ ] Create example goals:
  - `reduce_hunger.goal.json`
  - `find_shelter.goal.json`
  - `heal_self.goal.json`

### 6. Migration Path
- [ ] If existing goals exist:
  - Create migration script: `scripts/migrate-goals.js`
  - Test migration on all existing goals
  - Document manual migration steps (if needed)
  - Preserve goal intent and behavior
- [ ] If no existing goals:
  - Document that no migration needed
  - Provide goal authoring guide
- [ ] Define versioning strategy:
  - How to handle schema version changes in future?
  - Backward compatibility policy

### 7. Goal Selection Integration
- [ ] Document how goals integrate with planning:
  - Goal selection algorithm (priority? relevance?)
  - Goal evaluation frequency (every turn? on state change?)
  - Multiple concurrent goals? (one at a time?)
- [ ] Specify goal lifecycle:
  - Creation → Selection → Planning → Execution → Success/Failure → Cleanup
- [ ] Define goal manager interface:
  ```typescript
  interface GoalManager {
    evaluateRelevantGoals(actor: EntityId): Goal[];
    selectGoal(actor: EntityId, goals: Goal[]): Goal | null;
    checkSatisfaction(actor: EntityId, goal: Goal): boolean;
    checkFailure(actor: EntityId, goal: Goal): boolean;
  }
  ```

### 8. Document in Specification
- [ ] Replace lines 235-236 with complete analysis:
  - Compatibility assessment
  - Changes made (if any)
  - Migration path (if needed)
  - Integration with planner
- [ ] Link to updated schema
- [ ] Link to goal authoring guide

## Expected Outputs

1. **Analysis Report**: `docs/goap/goal-schema-analysis.md`
   - Existing schema review
   - Compatibility assessment
   - Decision rationale
   - Migration impact

2. **Updated/Validated Schema**: `data/schemas/goal.schema.json`
   - Compatible with new GOAP
   - All required fields for planning
   - Comprehensive validation
   - Version updated (if changed)

3. **Example Goals**: `data/mods/core/goals/`
   - `reduce_hunger.goal.json`
   - `find_shelter.goal.json`
   - `heal_self.goal.json`

4. **Migration Script** (if needed): `scripts/migrate-goals.js`
   - Converts old goals to new format
   - Validates migrated goals
   - Reports migration issues

5. **Goal Authoring Guide**: `docs/goap/goal-authoring-guide.md`
   - How to create goals
   - Schema field explanations
   - Common patterns
   - Examples

6. **Specification Update** (lines 235-236 replaced):
   - Goal schema decision documented
   - Compatibility statement clear
   - Integration with planner specified

## Success Metrics

- Goal schema decision is definitive (not "figure out")
- All existing goals (if any) migrate successfully
- New goals validate against schema
- Integration with planner is clear
- No ambiguity remains about goal structure
- Example goals demonstrate all features

## Notes

- Check project history for why goal schema exists (old GOAP system)
- May find goals in `data/mods/*/goals/` or similar
- Schema should align with planning preconditions/effects format
- Goal selection algorithm may need separate specification
- Consider consulting domain experts about goal priorities
- Satisfaction conditions likely use JSON Logic (like preconditions)
- Version schema appropriately if changes needed (semver)
