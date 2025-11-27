# Operation Handler Architecture Analysis & Migration Plan

**Date:** 2025-11-27
**Scope:** Analysis of all rules in data/mods/ to identify missing operation handlers
**Objective:** Reduce repetition and redundancy in the rules system

---

## Executive Summary

Analysis of **237 rules** across **30+ mods** reveals significant redundancy that can be addressed through new composite operation handlers. This report recommends a **Phased Hybrid Approach** with full backward compatibility.

### Key Findings

| Finding | Impact |
|---------|--------|
| **194 rules (82%)** follow identical "simple action" pattern | Critical |
| **12 rules** manage bidirectional closeness relationships | High |
| **4 rules** handle inventory validation + transfer | Medium |
| **3 rules** manage follow relationships | Low |
| **~2,529 total operations** could be reduced by **53%** | Significant |

### Recommended New Handlers

| Handler | Rules Affected | Line Reduction |
|---------|----------------|----------------|
| `PREPARE_ACTION_CONTEXT` | 194 | 57% |
| `ESTABLISH_BIDIRECTIONAL_CLOSENESS` | 12 | 88% |
| `BREAK_BIDIRECTIONAL_CLOSENESS` | 6 | 85% |
| `VALIDATED_ITEM_TRANSFER` | 4 | 92% |

---

## Part 1: Current State Analysis

### 1.1 Operation Handlers Inventory

The project currently has **66 operation handlers** organized into these categories:

| Category | Count | Examples |
|----------|-------|----------|
| Flow Control | 4 | `IF`, `FOR_EACH`, `SEQUENCE`, `IF_CO_LOCATED` |
| Component Operations | 8 | `ADD_COMPONENT`, `REMOVE_COMPONENT`, `MODIFY_COMPONENT`, `QUERY_COMPONENT` |
| Entity & Movement | 4 | `SYSTEM_MOVE_ENTITY`, `AUTO_MOVE_FOLLOWERS`, `AUTO_MOVE_CLOSENESS_PARTNERS` |
| Context & Variables | 4 | `SET_VARIABLE`, `GET_NAME`, `GET_TIMESTAMP`, `MODIFY_CONTEXT_ARRAY` |
| Inventory & Containers | 8 | `TRANSFER_ITEM`, `DROP_ITEM_AT_LOCATION`, `PICK_UP_ITEM_FROM_LOCATION`, `OPEN_CONTAINER` |
| Closeness/Proximity | 8 | `ESTABLISH_SITTING_CLOSENESS`, `REMOVE_LYING_CLOSENESS`, `MERGE_CLOSENESS_CIRCLE` |
| Messaging & Events | 5 | `DISPATCH_EVENT`, `DISPATCH_PERCEPTIBLE_EVENT`, `DISPATCH_SPEECH`, `DISPATCH_THOUGHT` |
| Following | 5 | `ESTABLISH_FOLLOW_RELATION`, `BREAK_FOLLOW_RELATION`, `CHECK_FOLLOW_CYCLE` |
| Clothing | 2 | `UNEQUIP_CLOTHING`, `HAS_BODY_PART_WITH_COMPONENT_VALUE` |
| Energy & State | 3 | `BURN_ENERGY`, `UPDATE_HUNGER_STATE`, `END_TURN` |
| Consumption | 4 | `CONSUME_ITEM`, `DRINK_FROM`, `DRINK_ENTIRELY`, `DIGEST_FOOD` |
| Utility | 3 | `LOG`, `MATH`, `QUERY_ENTITIES` |
| Description | 2 | `REGENERATE_DESCRIPTION`, `RESOLVE_OUTCOME` |
| Constraints | 6 | `LOCK_MOVEMENT`, `UNLOCK_MOVEMENT`, `LOCK_GRABBING`, etc. |

### 1.2 Mods with Rules

| Mod | Rules Count | Primary Pattern |
|-----|-------------|-----------------|
| affection | 19 | Simple Action |
| caressing | 11 | Simple Action |
| kissing | 15 | Simple Action |
| hand-holding | 5 | Bidirectional Closeness |
| hugging | 4 | Bidirectional Closeness |
| items | 8 | Inventory Validation |
| companionship | 4 | Follow Relationship |
| sex-breastplay | 10 | Simple Action |
| seduction | 7 | Simple Action |
| positioning | varies | Mixed |
| sex-penile-manual | ~10 | Simple Action |
| sex-penile-oral | ~10 | Simple Action |
| sex-anal-penetration | ~10 | Simple Action |
| sex-vaginal-penetration | ~10 | Simple Action |
| sex-dry-intimacy | ~10 | Simple Action |
| sex-physical-control | ~10 | Simple Action |
| exercise | 2 | Simple Action |
| ballet | 2 | Simple Action |
| gymnastics | 2 | Simple Action |
| music | 1 | Simple Action |
| distress | 2 | Simple Action |
| clothing | 3 | Component Modification |
| core | 6 | System Lifecycle |
| movement | 1 | Teleportation |
| physical-control | 5 | Simple Action |
| vampirism | varies | Mixed |
| violence | varies | Mixed |
| weapons | varies | Mixed |
| metabolism | varies | Energy/State |
| **Total** | **~237** | |

### 1.3 Operation Usage Statistics

| Rank | Operation | Count | % of Total |
|------|-----------|-------|------------|
| 1 | `SET_VARIABLE` | 932 | 36.8% |
| 2 | `GET_NAME` | 448 | 17.7% |
| 3 | `QUERY_COMPONENT` | 280 | 11.1% |
| 4 | `REMOVE_COMPONENT` | 130 | 5.1% |
| 5 | `IF` | 121 | 4.8% |
| 6 | `REGENERATE_DESCRIPTION` | 109 | 4.3% |
| 7 | `ADD_COMPONENT` | 88 | 3.5% |
| 8 | `DISPATCH_EVENT` | 45 | 1.8% |
| 9 | `QUERY_COMPONENTS` | 27 | 1.1% |
| 10 | `END_TURN` | 27 | 1.1% |

### 1.4 Macro Usage

| Macro | Usage Count | % of Rules |
|-------|-------------|------------|
| `core:logSuccessAndEndTurn` | 204 | 86% |
| `core:displaySuccessAndEndTurn` | 6 | 2.5% |
| `core:logFailureAndEndTurn` | 4 | 1.7% |

---

## Part 2: Identified Repetitive Patterns

### Pattern A: Simple Action (194 rules - 82%)

**This is the most impactful pattern affecting 82% of all rules.**

#### Current Implementation

Every simple action rule follows this exact sequence:

```json
{
  "actions": [
    { "type": "GET_NAME", "parameters": { "entity_ref": "actor", "result_variable": "actorName" } },
    { "type": "GET_NAME", "parameters": { "entity_ref": "target", "result_variable": "targetName" } },
    { "type": "QUERY_COMPONENT", "parameters": { "entity_ref": "actor", "component_type": "core:position", "result_variable": "actorPosition" } },
    { "type": "SET_VARIABLE", "parameters": { "variable_name": "logMessage", "value": "{context.actorName} does X to {context.targetName}." } },
    { "type": "SET_VARIABLE", "parameters": { "variable_name": "perceptionType", "value": "action_target_general" } },
    { "type": "SET_VARIABLE", "parameters": { "variable_name": "locationId", "value": "{context.actorPosition.locationId}" } },
    { "type": "SET_VARIABLE", "parameters": { "variable_name": "targetId", "value": "{event.payload.targetId}" } },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

**Only the `logMessage` value varies between these 194 rules.**

#### Example Rules Using This Pattern

- `affection/rules/brush_hand.rule.json`
- `kissing/rules/kiss_cheek.rule.json`
- `caressing/rules/caress_cheek_softly.rule.json`
- `seduction/rules/blow_kiss_teasingly.rule.json`
- All `sex-*` mod rules for simple actions

#### Problem Statement

- **7 identical operations** before the macro in every rule
- **~45 lines of JSON** per rule that could be **~15 lines**
- **High risk of inconsistency** if pattern needs to change
- **Mod authors must copy-paste** boilerplate for every new action

### Pattern B: Bidirectional Closeness (12 rules)

**Complex pattern for establishing mutual relationships.**

#### Current Implementation (~200 lines per rule)

```
1. Query existing relationships on both entities
2. IF actor is already in relationship with third party:
   - Remove third party's component
3. IF target is already in relationship with third party:
   - Remove third party's component
4. REMOVE_COMPONENT from actor (old relationship)
5. REMOVE_COMPONENT from actor (secondary)
6. REMOVE_COMPONENT from target (old relationship)
7. REMOVE_COMPONENT from target (secondary)
8. ADD_COMPONENT to actor (new relationship)
9. ADD_COMPONENT to target (reciprocal relationship)
10. REGENERATE_DESCRIPTION for actor
11. REGENERATE_DESCRIPTION for target
12. GET_NAME (actor)
13. GET_NAME (target)
14. SET_VARIABLE (x3 for macro context)
15. macro: core:logSuccessAndEndTurn
```

#### Affected Mods

- `hugging/rules/handle_hug_tight.rule.json` (207 lines)
- `hugging/rules/handle_release_hug.rule.json` (297 lines)
- `hand-holding/rules/handle_hold_hand.rule.json` (209 lines)
- `hand-holding/rules/handle_release_hand.rule.json` (similar)
- Embrace variants in positioning

#### Problem Statement

- **~200 lines** of complex conditional logic per rule
- **8+ IF blocks** checking various relationship states
- **Error-prone** third-party cleanup logic
- **Difficult to maintain** when relationship model changes

### Pattern C: Inventory Validation + Transfer (4 rules)

**Validates capacity before transferring items.**

#### Current Implementation (~180 lines per rule)

```
1. VALIDATE_INVENTORY_CAPACITY or VALIDATE_CONTAINER_CAPACITY
2. IF validation fails:
   a. QUERY_COMPONENT (position)
   b. GET_NAME (actor)
   c. GET_NAME (target/item)
   d. GET_TIMESTAMP
   e. DISPATCH_PERCEPTIBLE_EVENT (failure)
   f. DISPATCH_EVENT (UI)
   g. END_TURN (failure)
3. ELSE (success path):
   a. TRANSFER_ITEM / PICK_UP_ITEM_FROM_LOCATION
   b. QUERY_COMPONENT (position)
   c. GET_NAME (x3)
   d. GET_TIMESTAMP
   e. SET_VARIABLE (x3 for macro)
   f. macro: core:logSuccessAndEndTurn
```

#### Affected Rules

- `items/rules/handle_give_item.rule.json` (187 lines)
- `items/rules/handle_pick_up_item.rule.json`
- `items/rules/handle_put_in_container.rule.json`
- `items/rules/handle_take_from_container.rule.json`

#### Problem Statement

- **75% duplicate logic** across the 4 rules
- **Two parallel code paths** (failure/success) that must be maintained
- **Complex event dispatch** sequences

### Pattern D: Follow Relationship (3 rules)

**Manages leader-follower relationships with cycle detection.**

#### Current Implementation (~100 lines)

```
1. CHECK_FOLLOW_CYCLE
2. IF cycle detected:
   a. Failure event dispatch
   b. END_TURN
3. ELSE:
   a. ESTABLISH_FOLLOW_RELATION or BREAK_FOLLOW_RELATION
   b. REGENERATE_DESCRIPTION (x2)
   c. GET_NAME (x2)
   d. QUERY_COMPONENT (position)
   e. SET_VARIABLE (x3)
   f. macro: core:logSuccessAndEndTurn
```

#### Affected Rules

- `companionship/rules/follow.rule.json`
- `companionship/rules/dismiss.rule.json`
- Auto-move related rules

---

## Part 3: Recommended New Operation Handlers

### 3.1 PREPARE_ACTION_CONTEXT (Phase 1 - Highest Priority)

**Purpose:** Extract the common context setup pattern used by 194 rules.

#### Schema Definition

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/prepareActionContext.schema.json",
  "title": "PREPARE_ACTION_CONTEXT Operation",
  "allOf": [
    { "$ref": "../base-operation.schema.json" },
    {
      "properties": {
        "type": { "const": "PREPARE_ACTION_CONTEXT" },
        "parameters": {
          "type": "object",
          "properties": {
            "perception_type": {
              "type": "string",
              "default": "action_target_general",
              "description": "Type of perception event for witnesses"
            },
            "include_secondary": {
              "type": "boolean",
              "default": false,
              "description": "Whether to resolve secondaryId name"
            },
            "secondary_name_variable": {
              "type": "string",
              "description": "Variable name for secondary entity name"
            }
          },
          "additionalProperties": false
        }
      }
    }
  ]
}
```

#### Handler Behavior

1. Resolve actor name → `context.actorName`
2. Resolve target name → `context.targetName`
3. Query actor position → `context.locationId`
4. Set `context.targetId` from `event.payload.targetId`
5. Set `context.perceptionType` from parameter
6. Optionally resolve secondary name if `include_secondary: true`

#### Usage Example

**Before (8 operations, ~45 lines):**
```json
{
  "actions": [
    { "type": "GET_NAME", "parameters": { "entity_ref": "actor", "result_variable": "actorName" } },
    { "type": "GET_NAME", "parameters": { "entity_ref": "target", "result_variable": "targetName" } },
    { "type": "QUERY_COMPONENT", "parameters": { "entity_ref": "actor", "component_type": "core:position", "result_variable": "actorPosition" } },
    { "type": "SET_VARIABLE", "parameters": { "variable_name": "logMessage", "value": "{context.actorName} kisses {context.targetName}'s forehead gently." } },
    { "type": "SET_VARIABLE", "parameters": { "variable_name": "perceptionType", "value": "action_target_general" } },
    { "type": "SET_VARIABLE", "parameters": { "variable_name": "locationId", "value": "{context.actorPosition.locationId}" } },
    { "type": "SET_VARIABLE", "parameters": { "variable_name": "targetId", "value": "{event.payload.targetId}" } },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

**After (3 operations, ~15 lines):**
```json
{
  "actions": [
    { "type": "PREPARE_ACTION_CONTEXT" },
    { "type": "SET_VARIABLE", "parameters": { "variable_name": "logMessage", "value": "{context.actorName} kisses {context.targetName}'s forehead gently." } },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

**Reduction: 57% fewer operations, 67% fewer lines**

### 3.2 ESTABLISH_BIDIRECTIONAL_CLOSENESS (Phase 2)

**Purpose:** Consolidate hugging/hand-holding establishment pattern.

#### Schema Definition

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/establishBidirectionalCloseness.schema.json",
  "title": "ESTABLISH_BIDIRECTIONAL_CLOSENESS Operation",
  "allOf": [
    { "$ref": "../base-operation.schema.json" },
    {
      "properties": {
        "type": { "const": "ESTABLISH_BIDIRECTIONAL_CLOSENESS" },
        "parameters": {
          "type": "object",
          "properties": {
            "actor_component_type": {
              "type": "string",
              "description": "Component type for actor, e.g., 'hugging:hugging'"
            },
            "target_component_type": {
              "type": "string",
              "description": "Component type for target, e.g., 'hugging:being_hugged'"
            },
            "actor_data": {
              "type": "object",
              "description": "Component data for actor"
            },
            "target_data": {
              "type": "object",
              "description": "Component data for target"
            },
            "clean_existing": {
              "type": "boolean",
              "default": true,
              "description": "Clean up existing relationships with third parties"
            },
            "regenerate_descriptions": {
              "type": "boolean",
              "default": true,
              "description": "Regenerate entity descriptions after relationship change"
            }
          },
          "required": ["actor_component_type", "target_component_type", "actor_data", "target_data"],
          "additionalProperties": false
        }
      }
    }
  ]
}
```

#### Handler Behavior

1. Query existing relationships on both entities
2. If `clean_existing: true`:
   - Find third-party relationships
   - Remove reciprocal components from third parties
3. Remove old components from actor
4. Remove old components from target
5. Add new component to actor with `actor_data`
6. Add new component to target with `target_data`
7. If `regenerate_descriptions: true`:
   - Call REGENERATE_DESCRIPTION for actor
   - Call REGENERATE_DESCRIPTION for target

#### Usage Example

**Before (~207 lines):** See `hugging/rules/handle_hug_tight.rule.json`

**After (~25 lines):**
```json
{
  "actions": [
    { "type": "PREPARE_ACTION_CONTEXT" },
    {
      "type": "ESTABLISH_BIDIRECTIONAL_CLOSENESS",
      "parameters": {
        "actor_component_type": "hugging:hugging",
        "target_component_type": "hugging:being_hugged",
        "actor_data": { "embraced_entity_id": "{event.payload.targetId}", "initiated": true },
        "target_data": { "hugging_entity_id": "{event.payload.actorId}", "consented": true }
      }
    },
    { "type": "SET_VARIABLE", "parameters": { "variable_name": "logMessage", "value": "{context.actorName} hugs {context.targetName} tightly." } },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

**Reduction: 88% fewer lines**

### 3.3 BREAK_BIDIRECTIONAL_CLOSENESS (Phase 2)

**Purpose:** Consolidate release/break pattern.

Similar schema to ESTABLISH_BIDIRECTIONAL_CLOSENESS but with simpler logic (just removal, no addition).

### 3.4 VALIDATED_ITEM_TRANSFER (Phase 3)

**Purpose:** Consolidate inventory validation + transfer + logging pattern.

#### Schema Definition

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/validatedItemTransfer.schema.json",
  "title": "VALIDATED_ITEM_TRANSFER Operation",
  "allOf": [
    { "$ref": "../base-operation.schema.json" },
    {
      "properties": {
        "type": { "const": "VALIDATED_ITEM_TRANSFER" },
        "parameters": {
          "type": "object",
          "properties": {
            "from_entity": { "type": "string" },
            "to_entity": { "type": "string" },
            "item_entity": { "type": "string" },
            "validation_type": { "enum": ["inventory", "container"] },
            "success_message_template": { "type": "string" },
            "failure_message_template": { "type": "string" },
            "perception_type": { "type": "string", "default": "item_transfer" }
          },
          "required": ["from_entity", "to_entity", "item_entity", "success_message_template", "failure_message_template"],
          "additionalProperties": false
        }
      }
    }
  ]
}
```

#### Handler Behavior

1. Resolve all entity names
2. Validate capacity (inventory or container)
3. On failure:
   - Format failure message
   - Dispatch perception event
   - End turn with failure
4. On success:
   - Transfer item
   - Format success message
   - Dispatch perception event
   - End turn with success

**Reduction: 92% fewer lines**

---

## Part 4: Migration Plan

### 4.1 Migration Principles

1. **Full backward compatibility** - Old patterns continue to work unchanged
2. **Gradual migration** - Migrate by mod category, lowest risk first
3. **No regressions** - Each migrated rule verified with existing tests
4. **Documentation** - Update mod author guide with new patterns

### 4.2 Migration Batches

| Batch | Mods | Rules | Pattern | Risk | Effort |
|-------|------|-------|---------|------|--------|
| 1 | affection, caressing, kissing | 45 | Simple Action | Low | 1 day |
| 2 | hand-holding (simple), seduction | 12 | Simple Action | Low | 0.5 days |
| 3 | hugging, hand-holding (complex) | 12 | Bidirectional | Medium | 1 day |
| 4 | items | 4 | Inventory | Medium | 0.5 days |
| 5 | sex-* mods | ~100 | Simple Action | Low | 2 days |
| 6 | Remaining mods | ~25 | Simple Action | Low | 0.5 days |

### 4.3 Detailed Migration by Mod

#### Batch 1: Affection, Caressing, Kissing (45 rules)

**Affection (19 rules):**
- `brush_hand.rule.json` → PREPARE_ACTION_CONTEXT
- `massage_back.rule.json` → PREPARE_ACTION_CONTEXT
- `massage_shoulders.rule.json` → PREPARE_ACTION_CONTEXT
- `pat_head.rule.json` → PREPARE_ACTION_CONTEXT
- (15 more similar rules)

**Caressing (11 rules):**
- `caress_cheek_softly.rule.json` → PREPARE_ACTION_CONTEXT
- `caress_arm.rule.json` → PREPARE_ACTION_CONTEXT
- (9 more similar rules)

**Kissing (15 rules):**
- `kiss_cheek.rule.json` → PREPARE_ACTION_CONTEXT
- `kiss_forehead_gently.rule.json` → PREPARE_ACTION_CONTEXT
- (13 more similar rules)

#### Batch 2: Hand-holding (simple) + Seduction (12 rules)

**Hand-holding simple (5 rules):**
- Simple affection-like rules

**Seduction (7 rules):**
- `blow_kiss_teasingly.rule.json` → PREPARE_ACTION_CONTEXT
- (6 more similar rules)

#### Batch 3: Bidirectional Closeness (12 rules)

**Hugging (4 rules):**
- `handle_hug_tight.rule.json` → ESTABLISH_BIDIRECTIONAL_CLOSENESS
- `handle_release_hug.rule.json` → BREAK_BIDIRECTIONAL_CLOSENESS
- (2 more embrace variants)

**Hand-holding complex (8 rules):**
- `handle_hold_hand.rule.json` → ESTABLISH_BIDIRECTIONAL_CLOSENESS
- `handle_release_hand.rule.json` → BREAK_BIDIRECTIONAL_CLOSENESS
- (6 more similar rules)

#### Batch 4: Inventory Operations (4 rules)

**Items (4 core rules):**
- `handle_give_item.rule.json` → VALIDATED_ITEM_TRANSFER
- `handle_pick_up_item.rule.json` → VALIDATED_ITEM_TRANSFER
- `handle_put_in_container.rule.json` → VALIDATED_ITEM_TRANSFER
- `handle_take_from_container.rule.json` → VALIDATED_ITEM_TRANSFER

#### Batch 5: Adult Content (~100 rules)

All follow Simple Action pattern → PREPARE_ACTION_CONTEXT

**Mods:**
- sex-breastplay (10 rules)
- sex-penile-manual (~10 rules)
- sex-penile-oral (~10 rules)
- sex-anal-penetration (~10 rules)
- sex-vaginal-penetration (~10 rules)
- sex-dry-intimacy (~10 rules)
- sex-physical-control (~10 rules)
- physical-control (5 rules)
- (and similar mods)

#### Batch 6: Remaining Mods (~25 rules)

**Mods:**
- exercise (2 rules)
- ballet (2 rules)
- gymnastics (2 rules)
- music (1 rule)
- distress (2 rules)
- (and remaining simple action rules)

### 4.4 Migration Checklist Per Rule

For each rule being migrated:

- [ ] Identify current pattern (A, B, C, or D)
- [ ] Create migrated version using new handler
- [ ] Run existing integration test (if exists)
- [ ] Compare behavior: same events dispatched, same context state
- [ ] Update rule file in mod
- [ ] Run full mod test suite
- [ ] Verify no console warnings/errors

### 4.5 Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Phase 1: PREPARE_ACTION_CONTEXT handler | 2-3 days | Handler + unit tests + integration tests |
| Batch 1-2 Migration | 1.5 days | 57 rules migrated |
| Phase 2: Bidirectional handlers | 5 days | 2 handlers + tests |
| Batch 3 Migration | 1 day | 12 rules migrated |
| Phase 3: Inventory handler | 2 days | 1 handler + tests |
| Batch 4 Migration | 0.5 days | 4 rules migrated |
| Batch 5-6 Migration | 2.5 days | 125 rules migrated |
| Documentation | 1 day | Mod author guide update |
| **Total** | **~15 days** | **198 rules migrated (84%)** |

---

## Part 5: Implementation Details

### 5.1 Files to Create

| File | Purpose |
|------|---------|
| `data/schemas/operations/prepareActionContext.schema.json` | Phase 1 schema |
| `data/schemas/operations/establishBidirectionalCloseness.schema.json` | Phase 2 schema |
| `data/schemas/operations/breakBidirectionalCloseness.schema.json` | Phase 2 schema |
| `data/schemas/operations/validatedItemTransfer.schema.json` | Phase 3 schema |
| `src/logic/operationHandlers/prepareActionContextHandler.js` | Phase 1 handler |
| `src/logic/operationHandlers/establishBidirectionalClosenessHandler.js` | Phase 2 handler |
| `src/logic/operationHandlers/breakBidirectionalClosenessHandler.js` | Phase 2 handler |
| `src/logic/operationHandlers/validatedItemTransferHandler.js` | Phase 3 handler |
| `tests/unit/logic/operationHandlers/prepareActionContextHandler.test.js` | Phase 1 tests |
| `tests/unit/logic/operationHandlers/establishBidirectionalClosenessHandler.test.js` | Phase 2 tests |
| `tests/unit/logic/operationHandlers/breakBidirectionalClosenessHandler.test.js` | Phase 2 tests |
| `tests/unit/logic/operationHandlers/validatedItemTransferHandler.test.js` | Phase 3 tests |

### 5.2 Files to Modify

| File | Change |
|------|--------|
| `data/schemas/operation.schema.json` | Add $ref entries for 4 new schemas |
| `src/dependencyInjection/tokens/tokens-core.js` | Add 4 handler tokens |
| `src/dependencyInjection/registrations/operationHandlerRegistrations.js` | Add 4 factories |
| `src/dependencyInjection/registrations/interpreterRegistrations.js` | Add 4 operation mappings |
| `src/utils/preValidationUtils.js` | Add 4 types to KNOWN_OPERATION_TYPES |
| `docs/modding/operation-handlers.md` | Document new handlers |

### 5.3 Implementation Checklist Per Handler

Following the project's established pattern:

1. [ ] Create operation schema in `data/schemas/operations/`
2. [ ] Add `$ref` to `data/schemas/operation.schema.json` (alphabetical)
3. [ ] Create handler class extending `BaseOperationHandler`
4. [ ] Add token to `src/dependencyInjection/tokens/tokens-core.js`
5. [ ] Register factory in `operationHandlerRegistrations.js`
6. [ ] Map operation in `interpreterRegistrations.js`
7. [ ] **CRITICAL:** Add to `KNOWN_OPERATION_TYPES` in `preValidationUtils.js`
8. [ ] Create unit tests with 90%+ coverage
9. [ ] Create integration test with real mod usage
10. [ ] Run `npm run validate && npm run test:ci`

---

## Part 6: Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Rule line reduction | 50%+ average | Before/after line count comparison |
| Operation count reduction | 53% | Count operations in all rules |
| Handler test coverage | 90%+ branches | Jest coverage report |
| Zero regressions | 0 failing tests | Full test suite pass |
| Migration completion | 198/237 rules (84%) | Count migrated rules |
| Mod author satisfaction | Positive feedback | Documentation clarity |

---

## Part 7: Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Handler bugs cause action failures | Medium | High | Extensive unit tests, gradual rollout by mod |
| Context variable pollution | Medium | Medium | Use prefixed temp variables (_temp*) |
| Breaking existing rules | Low | High | Full backward compatibility, no deprecation |
| Performance regression | Low | Low | Benchmark before/after per handler |
| Mod author confusion | Medium | Medium | Comprehensive docs, migration examples |
| Third-party relationship cleanup bugs | Medium | High | Edge case testing for closeness handlers |

---

## Appendix A: Reference Files

### Handler Patterns to Follow

| File | Pattern |
|------|---------|
| `src/logic/operationHandlers/baseOperationHandler.js` | Base class pattern |
| `src/logic/operationHandlers/componentOperationHandler.js` | Entity/component helper pattern |
| `src/logic/operationHandlers/establishSittingClosenessHandler.js` | Closeness handler pattern (500+ lines) |
| `src/logic/operationHandlers/transferItemHandler.js` | Transfer pattern |
| `src/logic/operationHandlers/getNameHandler.js` | Simple utility pattern |

### Rule Examples

| File | Pattern Type |
|------|--------------|
| `data/mods/affection/rules/brush_hand.rule.json` | Simple Action |
| `data/mods/kissing/rules/kiss_forehead_gently.rule.json` | Simple Action |
| `data/mods/hugging/rules/handle_hug_tight.rule.json` | Bidirectional Closeness |
| `data/mods/hugging/rules/handle_release_hug.rule.json` | Break Closeness |
| `data/mods/items/rules/handle_give_item.rule.json` | Inventory Validation |
| `data/mods/companionship/rules/follow.rule.json` | Follow Relationship |

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Operation Handler** | JavaScript class that executes a specific operation type |
| **Rule** | JSON file defining actions to take when an event occurs |
| **Macro** | Reusable sequence of operations expanded at load time |
| **Bidirectional Closeness** | Mutual relationship where both entities have reciprocal components |
| **Context** | Runtime state object passed between operations |
| **Perception Event** | Event dispatched to witnesses in the same location |

---

*Report generated: 2025-11-27*
*Analysis scope: 237 rules across 30+ mods*
*Recommendation: Phased Hybrid Approach with full backward compatibility*
