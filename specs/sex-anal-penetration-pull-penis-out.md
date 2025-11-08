# Specification: Pull Penis Out Action/Rule Combo

**Mod**: `sex-anal-penetration`
**Type**: Completion Action/Rule
**Status**: Specification
**Created**: 2025-01-08

---

## 1. Project Context

The `sex-anal-penetration` mod manages anal sex interactions in the Living Narrative Engine. It currently includes initiation actions (`push_glans_into_asshole`, `tease_asshole_with_glans`) and preparation actions (`insert_finger_into_asshole`), but lacks a completion action to end anal sex interactions.

This specification defines a new "pull penis out" action/rule combo that allows actors to disengage from anal sex, properly cleaning up component state and generating appropriate narrative events.

---

## 2. Feature Overview

### Purpose
Provide a natural conclusion to anal sex interactions by allowing the penetrating actor to withdraw their penis from the receiving actor's asshole.

### Key Behaviors
- Actor must be currently penetrating target anally (`positioning:fucking_anally` component)
- Target must be currently receiving anal penetration (`positioning:being_fucked_anally` component)
- Action removes both components from respective actors
- Regenerates entity descriptions to reflect new state
- Dispatches narrative and perceptible events for observers

### User Experience
```
Action Button: "pull penis out of Alice's asshole"
Success Message: "You pull out your penis out of Alice's ass."
Perceptible Event: "Bob pulls out their penis out of Alice's ass."
```

---

## 3. Technical Requirements

### 3.1 New Files Required

#### Scope Definition
**File**: `data/mods/sex-anal-penetration/scopes/actor_being_fucked_anally_by_me.scope`

**Purpose**: Filter for entities currently receiving anal penetration from the acting entity.

**Pattern Reference**: `sex-penile-oral:actor_giving_blowjob_to_me.scope`

**Scope Logic**:
```javascript
// Restricts potential targets to entities currently being anally fucked by the acting entity
sex-anal-penetration:actor_being_fucked_anally_by_me := actor.components.positioning:closeness.partners[][{
  "and": [
    // Actor must have fucking_anally component
    {"!!": {"var": "actor.components.positioning:fucking_anally"}},

    // Entity must have being_fucked_anally component
    {"!!": {"var": "entity.components.positioning:being_fucked_anally"}},

    // Actor's fucking_anally.being_fucked_entity_id must match entity's id
    {"==": [
      {"var": "actor.components.positioning:fucking_anally.being_fucked_entity_id"},
      {"var": "entity.id"}
    ]},

    // Entity's being_fucked_anally.fucking_entity_id must match actor's id
    {"==": [
      {"var": "entity.components.positioning:being_fucked_anally.fucking_entity_id"},
      {"var": "actor.id"}
    ]}
  ]
}]
```

**Validation Rules**:
- Reciprocal relationship verification (both entities reference each other)
- Ensures scope only returns entities in active anal sex with actor
- Filters from `positioning:closeness.partners` (ensures physical proximity)

---

#### Action Definition
**File**: `data/mods/sex-anal-penetration/actions/pull_penis_out.action.json`

**Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "sex-anal-penetration:pull_penis_out",
  "name": "Pull Penis Out",
  "description": "Withdraw your penis from the target's asshole, ending anal penetration",
  "targets": {
    "primary": {
      "scope": "sex-anal-penetration:actor_being_fucked_anally_by_me",
      "placeholder": "primary",
      "description": "The entity whose asshole you are currently penetrating"
    }
  },
  "required_components": {
    "actor": [
      "positioning:closeness",
      "positioning:fucking_anally"
    ]
  },
  "forbidden_components": {},
  "prerequisites": [],
  "template": "pull penis out of {primary}'s asshole",
  "visual": {
    "backgroundColor": "#053b3f",
    "textColor": "#e0f7f9",
    "hoverBackgroundColor": "#075055",
    "hoverTextColor": "#f1feff"
  }
}
```

**Design Rationale**:
- **No Prerequisites**: If actor is currently fucking, they can always pull out (no anatomy checks needed)
- **Required Components**: `positioning:fucking_anally` ensures action only appears when actually penetrating
- **No Forbidden Components**: Pulling out is always allowed during anal sex
- **Visual Styling**: Matches other sex-anal-penetration actions (teal theme)

---

#### Condition Definition
**File**: `data/mods/sex-anal-penetration/conditions/event-is-action-pull-penis-out.condition.json`

**Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "sex-anal-penetration:event-is-action-pull-penis-out",
  "description": "Checks if the event is the pull_penis_out action being performed",
  "logic": {
    "==": [
      {"var": "event.payload.actionId"},
      "sex-anal-penetration:pull_penis_out"
    ]
  }
}
```

**Purpose**: Rule trigger condition for `handle_pull_penis_out` rule.

---

#### Rule Definition
**File**: `data/mods/sex-anal-penetration/rules/handle_pull_penis_out.rule.json`

**Structure Overview**:
```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "id": "sex-anal-penetration:handle_pull_penis_out",
  "description": "Handles the pull_penis_out action by removing anal sex components and generating events",
  "conditions": [
    "sex-anal-penetration:event-is-action-pull-penis-out"
  ],
  "operations": [
    // 1. Get actor and primary names
    // 2. Remove fucking_anally component from actor
    // 3. Remove being_fucked_anally component from primary
    // 4. Regenerate descriptions for both entities
    // 5. Dispatch narrative success message
    // 6. Dispatch perceptible event
    // 7. End turn (using core:logSuccessAndEndTurn macro)
  ]
}
```

**Detailed Operations**:

1. **Get Entity Names** (for messaging):
```json
{
  "type": "QUERY_ENTITY",
  "entity_id": {"var": "event.payload.actorId"},
  "output": "actorName",
  "query": "name"
}
```

2. **Remove fucking_anally Component from Actor**:
```json
{
  "type": "REMOVE_COMPONENT",
  "entity_id": {"var": "event.payload.actorId"},
  "component": "positioning:fucking_anally"
}
```

3. **Remove being_fucked_anally Component from Primary**:
```json
{
  "type": "REMOVE_COMPONENT",
  "entity_id": {"var": "event.payload.targetId"},
  "component": "positioning:being_fucked_anally"
}
```

4. **Regenerate Entity Descriptions** (both entities):
```json
{
  "type": "REGENERATE_DESCRIPTION",
  "entity_id": {"var": "event.payload.actorId"}
},
{
  "type": "REGENERATE_DESCRIPTION",
  "entity_id": {"var": "event.payload.targetId"}
}
```

5. **Dispatch Success Narrative**:
```json
{
  "type": "DISPATCH_EVENT",
  "event": {
    "type": "NARRATIVE_MESSAGE_OCCURRED",
    "payload": {
      "message": {
        "cat": [
          "You pull out your penis out of ",
          {"var": "primaryName"},
          "'s ass."
        ]
      },
      "category": "action_success"
    }
  }
}
```

6. **Dispatch Perceptible Event**:
```json
{
  "type": "DISPATCH_EVENT",
  "event": {
    "type": "PERCEPTIBLE_EVENT_OCCURRED",
    "payload": {
      "message": {
        "cat": [
          {"var": "actorName"},
          " pulls out their penis out of ",
          {"var": "primaryName"},
          "'s ass."
        ]
      },
      "room": {"var": "event.payload.room"}
    }
  }
}
```

7. **End Turn** (using macro):
```json
{
  "type": "USE_MACRO",
  "macro": "core:logSuccessAndEndTurn",
  "parameters": {
    "success_message": "Successfully pulled penis out"
  }
}
```

**Rule Complexity**: Estimated ~60-80 lines (simpler than initiation rule's 232 lines)

**Reference Implementation**: `sex-penile-oral:handle_pull_penis_out_of_mouth.rule.json`

---

### 3.2 Component Definitions (Existing)

These components are already defined in the `positioning` mod and will be **removed** by this rule:

#### `positioning:fucking_anally`
```json
{
  "id": "positioning:fucking_anally",
  "description": "Marks an actor who is actively penetrating another entity's asshole",
  "dataSchema": {
    "type": "object",
    "required": ["being_fucked_entity_id", "initiated"],
    "properties": {
      "being_fucked_entity_id": { "type": "string" },
      "initiated": { "type": "boolean" },
      "consented": { "type": "boolean", "default": true },
      "activityMetadata": {
        "template": "{actor} is anally penetrating {target}",
        "targetRole": "being_fucked_entity_id",
        "priority": 82
      }
    }
  }
}
```

#### `positioning:being_fucked_anally`
```json
{
  "id": "positioning:being_fucked_anally",
  "description": "Marks an entity currently receiving anal penetration",
  "dataSchema": {
    "type": "object",
    "required": ["fucking_entity_id"],
    "properties": {
      "fucking_entity_id": { "type": "string" },
      "consented": { "type": "boolean", "default": true },
      "activityMetadata": {
        "template": "{actor} is being anally penetrated by {target}",
        "targetRole": "fucking_entity_id",
        "priority": 80
      }
    }
  }
}
```

---

## 4. Testing Requirements

### 4.1 Test Coverage Strategy

**Two Test Suites Required**:
1. **Action Discovery Tests**: Verify action appears/disappears correctly
2. **Rule Execution Tests**: Verify rule behavior and component management

**Test Location**: `tests/integration/mods/sex-anal-penetration/`

---

### 4.2 Action Discovery Test Suite

**File**: `tests/integration/mods/sex-anal-penetration/pull_penis_out_action_discovery.test.js`

**Test Cases**:

1. ✅ **Action appears when actor is fucking target**
   - Setup: Actor with `fucking_anally`, target with `being_fucked_anally`
   - Expected: Action discovered with target as option

2. ✅ **Action does not appear when not fucking anyone**
   - Setup: Actor without `fucking_anally` component
   - Expected: Action not discovered

3. ✅ **Action only targets current partner**
   - Setup: Actor fucking Entity A, Entity B nearby
   - Expected: Action only shows Entity A as target

4. ✅ **Action does not appear for other entities**
   - Setup: Observer entity not involved in anal sex
   - Expected: Action not discovered for observer

**Test Pattern**:
```javascript
describe('sex-anal-penetration:pull_penis_out action discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forActionAutoLoad(
      'sex-anal-penetration',
      'sex-anal-penetration:pull_penis_out'
    );
  });

  afterEach(() => {
    testFixture?.cleanup();
  });

  it('discovers action when actor is actively fucking target', async () => {
    // Arrange: Build scenario with anal sex components
    const scenario = testFixture.createStandardActorTarget(['Bob', 'Alice']);

    // Add fucking_anally component to actor
    await testFixture.addComponent(scenario.actor.id, 'positioning:fucking_anally', {
      being_fucked_entity_id: scenario.target.id,
      initiated: true
    });

    // Add being_fucked_anally component to target
    await testFixture.addComponent(scenario.target.id, 'positioning:being_fucked_anally', {
      fucking_entity_id: scenario.actor.id
    });

    // Act: Discover actions
    const actions = await testFixture.discoverActionsForActor(scenario.actor.id);

    // Assert: Action discovered with correct target
    const pullOutAction = actions.find(a =>
      a.actionId === 'sex-anal-penetration:pull_penis_out'
    );
    expect(pullOutAction).toBeDefined();
    expect(pullOutAction.primary).toBe(scenario.target.id);
  });
});
```

**Reference Tests**:
- `tests/integration/mods/sex-penile-oral/pull_penis_out_of_mouth_action_discovery.test.js`
- `tests/integration/mods/sex-anal-penetration/push_glans_into_asshole_action_discovery.test.js`

---

### 4.3 Rule Execution Test Suite

**File**: `tests/integration/mods/sex-anal-penetration/pull_penis_out_action.test.js`

**Test Cases**:

1. ✅ **Rule removes fucking_anally component from actor**
   - Setup: Actor with `fucking_anally` component
   - Execute: Pull penis out action
   - Assert: Component removed from actor

2. ✅ **Rule removes being_fucked_anally component from target**
   - Setup: Target with `being_fucked_anally` component
   - Execute: Pull penis out action
   - Assert: Component removed from target

3. ✅ **Rule regenerates descriptions for both entities**
   - Setup: Both entities with anal sex components
   - Execute: Pull penis out action
   - Assert: `DESCRIPTION_REGENERATED` events dispatched for both

4. ✅ **Rule dispatches narrative success message**
   - Expected: "You pull out your penis out of {target}'s ass."
   - Category: `action_success`

5. ✅ **Rule dispatches perceptible event**
   - Expected: "{actor} pulls out their penis out of {target}'s ass."
   - Event type: `PERCEPTIBLE_EVENT_OCCURRED`

6. ✅ **Rule does not affect other entities**
   - Setup: Observer entity in room
   - Execute: Pull penis out action
   - Assert: Observer's components unchanged

7. ✅ **Rule does not fire for different action**
   - Setup: Trigger different action event
   - Assert: Rule does not execute

8. ✅ **Full workflow: initiation to completion**
   - Execute: `push_glans_into_asshole` action
   - Assert: Components added
   - Execute: `pull_penis_out` action
   - Assert: Components removed, entities back to neutral state

**Test Pattern**:
```javascript
describe('sex-anal-penetration:pull_penis_out action integration', () => {
  let testFixture;
  const ACTION_ID = 'sex-anal-penetration:pull_penis_out';

  beforeEach(async () => {
    testFixture = await ModTestFixture.forActionAutoLoad('sex-anal-penetration', ACTION_ID);
  });

  afterEach(() => {
    testFixture?.cleanup();
  });

  it('removes fucking_anally component from actor', async () => {
    // Arrange
    const scenario = testFixture.createStandardActorTarget(['Bob', 'Alice']);
    await testFixture.addComponent(scenario.actor.id, 'positioning:fucking_anally', {
      being_fucked_entity_id: scenario.target.id,
      initiated: true
    });
    await testFixture.addComponent(scenario.target.id, 'positioning:being_fucked_anally', {
      fucking_entity_id: scenario.actor.id
    });

    // Act
    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    // Assert
    const actorComponents = testFixture.getEntityComponents(scenario.actor.id);
    expect(actorComponents).not.toHaveComponent('positioning:fucking_anally');
  });

  it('dispatches perceptible event with correct message', async () => {
    // Arrange
    const scenario = testFixture.createStandardActorTarget(['Bob', 'Alice']);
    // ... setup components ...

    // Act
    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    // Assert
    expect(testFixture.eventBus).toHaveDispatched({
      type: 'PERCEPTIBLE_EVENT_OCCURRED',
      payload: expect.objectContaining({
        message: expect.stringContaining("pulls out their penis out of")
      })
    });
  });
});
```

**Reference Tests**:
- `tests/integration/mods/sex-penile-oral/pull_penis_out_of_mouth_action.test.js`
- `tests/integration/mods/sex-anal-penetration/push_glans_into_asshole_action.test.js`

---

### 4.4 Testing Utilities

**Required Test Helpers** (from `tests/common/mods/`):
- `ModTestFixture.forActionAutoLoad()` - Automatic rule/condition loading
- `ModEntityBuilder` - Build test scenarios with components
- `ModAssertionHelpers` - Domain-specific assertions
- Domain matchers (`toHaveComponent`, `toHaveDispatched`)

**Scope Registration** (if needed):
```javascript
import { ScopeResolverHelpers } from '../../common/helpers/scopeResolverHelpers.js';

beforeEach(() => {
  // Register positioning scopes (includes closeness.partners)
  ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);

  // Register custom sex-anal-penetration scope
  testFixture.registerCustomScope(
    'sex-anal-penetration:actor_being_fucked_anally_by_me',
    scopeDefinition
  );
});
```

**Documentation Reference**: `docs/testing/mod-testing-guide.md`

---

## 5. Implementation Checklist

### Phase 1: Scope Definition
- [ ] Create `actor_being_fucked_anally_by_me.scope` file
- [ ] Implement scope logic filtering for reciprocal anal sex components
- [ ] Validate scope syntax with `npm run scope:lint`
- [ ] Register scope in mod manifest (if required)

### Phase 2: Action Definition
- [ ] Create `pull_penis_out.action.json` file
- [ ] Define target with custom scope
- [ ] Set required components (`positioning:fucking_anally`)
- [ ] Set template and visual styling
- [ ] Validate schema with `npm run validate`

### Phase 3: Condition Definition
- [ ] Create `event-is-action-pull-penis-out.condition.json` file
- [ ] Implement action ID comparison logic
- [ ] Validate schema with `npm run validate`

### Phase 4: Rule Definition
- [ ] Create `handle_pull_penis_out.rule.json` file
- [ ] Implement operations:
  - [ ] Query entity names
  - [ ] Remove `fucking_anally` component
  - [ ] Remove `being_fucked_anally` component
  - [ ] Regenerate descriptions (both entities)
  - [ ] Dispatch narrative message
  - [ ] Dispatch perceptible event
  - [ ] End turn using macro
- [ ] Validate schema with `npm run validate`

### Phase 5: Testing - Action Discovery
- [ ] Create `pull_penis_out_action_discovery.test.js`
- [ ] Implement test: Action appears when fucking
- [ ] Implement test: Action hidden when not fucking
- [ ] Implement test: Action only targets current partner
- [ ] Implement test: Action not available to observers
- [ ] Run tests: `npm run test:integration`

### Phase 6: Testing - Rule Execution
- [ ] Create `pull_penis_out_action.test.js`
- [ ] Implement test: Remove `fucking_anally` from actor
- [ ] Implement test: Remove `being_fucked_anally` from target
- [ ] Implement test: Regenerate descriptions
- [ ] Implement test: Dispatch narrative message
- [ ] Implement test: Dispatch perceptible event
- [ ] Implement test: Other entities unaffected
- [ ] Implement test: Rule isolation
- [ ] Implement test: Full workflow (initiate → complete)
- [ ] Run tests: `npm run test:integration`

### Phase 7: Validation & Quality
- [ ] Run full test suite: `npm run test:ci`
- [ ] Lint modified files: `npx eslint <files>`
- [ ] Validate all schemas: `npm run validate:strict`
- [ ] Manual gameplay testing
- [ ] Code review for consistency with mod patterns

---

## 6. Edge Cases & Considerations

### 6.1 State Management
- **Scenario**: Actor has `fucking_anally` but target lacks `being_fucked_anally`
- **Handling**: Scope validation prevents this (requires reciprocal components)
- **Fallback**: Rule should handle gracefully (check component existence before removal)

### 6.2 Multiple Partners
- **Scenario**: Actor could theoretically have multiple `fucking_anally` instances
- **Current Design**: Components use single entity ID (one partner at a time)
- **Note**: Architecture supports one active anal sex partner per entity

### 6.3 Description Regeneration
- **Importance**: Critical for UI consistency
- **Timing**: Must occur AFTER component removal
- **Both Entities**: Both actor and target must regenerate

### 6.4 Observer Notifications
- **Perceptible Event**: All entities in room should receive notification
- **Privacy**: Event message is public (visible to observers)
- **Room Scoping**: Use `event.payload.room` for proper event routing

---

## 7. Reference Implementations

### Similar Completion Actions
1. **`sex-penile-oral:pull_penis_out_of_mouth`**
   - Action: `data/mods/sex-penile-oral/actions/pull_penis_out_of_mouth.action.json`
   - Rule: `data/mods/sex-penile-oral/rules/handle_pull_penis_out_of_mouth.rule.json`
   - Tests: `tests/integration/mods/sex-penile-oral/pull_penis_out_of_mouth_action*.test.js`

2. **`sex-penile-vaginal:pull_penis_out_of_vagina`** (if exists)
   - Similar pattern for vaginal completion

### Initiation Action (for contrast)
1. **`sex-anal-penetration:push_glans_into_asshole`**
   - Action: `data/mods/sex-anal-penetration/actions/push_glans_into_asshole.action.json`
   - Rule: `data/mods/sex-anal-penetration/rules/handle_push_glans_into_asshole.rule.json`
   - Tests: `tests/integration/mods/sex-anal-penetration/push_glans_into_asshole_action*.test.js`

### Scope Pattern Reference
1. **`sex-penile-oral:actor_giving_blowjob_to_me`**
   - Scope: `data/mods/sex-penile-oral/scopes/actor_giving_blowjob_to_me.scope`
   - Pattern for reciprocal relationship filtering

---

## 8. Success Criteria

### Functional Requirements
- ✅ Action appears only when actor is actively penetrating target
- ✅ Action correctly identifies current anal sex partner as target
- ✅ Rule removes both anal sex components from respective entities
- ✅ Entity descriptions regenerate to reflect new state
- ✅ Narrative and perceptible events dispatch with correct messages
- ✅ Other entities in room remain unaffected

### Quality Requirements
- ✅ All tests pass (`npm run test:ci`)
- ✅ Test coverage: 100% for new files
- ✅ Schema validation passes (`npm run validate:strict`)
- ✅ Code style passes (`npx eslint <files>`)
- ✅ Scope linting passes (`npm run scope:lint`)

### Integration Requirements
- ✅ Seamless integration with existing `push_glans_into_asshole` action
- ✅ Consistent with other completion actions in related mods
- ✅ No breaking changes to existing functionality
- ✅ Mod manifest updated (if required)

---

## 9. Timeline Estimate

**Total Effort**: ~4-6 hours for experienced developer

- **Phase 1** (Scope): 30 minutes
- **Phase 2** (Action): 30 minutes
- **Phase 3** (Condition): 15 minutes
- **Phase 4** (Rule): 1 hour
- **Phase 5** (Discovery Tests): 1 hour
- **Phase 6** (Execution Tests): 1.5 hours
- **Phase 7** (Validation): 30 minutes
- **Buffer**: 30-60 minutes

---

## 10. Maintenance Notes

### Future Enhancements
- Consider adding consent checks (if consent system exists)
- Consider adding stamina/arousal state transitions
- Consider adding position-specific variations (e.g., "pull out and stand up")
- Consider adding cleanup actions (e.g., "wipe penis clean")

### Potential Issues
- **Performance**: Description regeneration can be expensive (monitor with many entities)
- **State Consistency**: Ensure component removal is atomic
- **Event Ordering**: Narrative must dispatch before perceptible event

### Documentation Updates
- Update mod README with new action documentation
- Update changelog with new feature
- Add to mod feature list in `mod-manifest.json`

---

## 11. Appendix: File Structure Summary

```
data/mods/sex-anal-penetration/
├── actions/
│   └── pull_penis_out.action.json                    [NEW]
├── conditions/
│   └── event-is-action-pull-penis-out.condition.json [NEW]
├── rules/
│   └── handle_pull_penis_out.rule.json               [NEW]
└── scopes/
    └── actor_being_fucked_anally_by_me.scope         [NEW]

tests/integration/mods/sex-anal-penetration/
├── pull_penis_out_action_discovery.test.js           [NEW]
└── pull_penis_out_action.test.js                     [NEW]
```

---

## 12. Questions for Review

Before implementation, consider:

1. **Message Phrasing**: Is "pulls out their penis out of" grammatically correct? (Note: double "out" appears intentional based on existing patterns)
2. **Visual Styling**: Should completion actions have different colors than initiation actions?
3. **Consent Tracking**: Should pulling out update consent tracking if implemented?
4. **State Transitions**: Should pulling out trigger any other state changes (arousal, satisfaction, etc.)?
5. **Multi-Actor**: Should we consider scenarios with multiple actors engaging same target?

---

**End of Specification**

This document provides comprehensive guidance for implementing the "pull penis out" action/rule combo with full test coverage and quality assurance.