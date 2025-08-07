# INTMIG-007: Integration Testing

## Overview

Comprehensive integration testing phase to ensure all migrated intimacy actions work correctly with the game engine's systems including rules, events, UI, and action execution. This ticket validates that the migration maintains full backward compatibility.

## Priority

**CRITICAL** - Must verify system integration before E2E testing

## Dependencies

- **Blocked by**: INTMIG-006 (Schema Validation and Testing)
- **Enables**: INTMIG-008 (Performance and E2E Testing)
- **Related**: All previous migration tickets

## Acceptance Criteria

- [ ] All existing intimacy rules execute correctly with migrated actions
- [ ] Event payloads maintain expected structure
- [ ] Action discovery finds all 25 intimacy actions
- [ ] UI displays actions with correct target selection
- [ ] Action execution triggers appropriate events
- [ ] Component requirements are enforced
- [ ] Forbidden components prevent action availability
- [ ] Prerequisites are evaluated correctly
- [ ] Cross-mod integration works (positioning mod)
- [ ] Action tracing captures correct data
- [ ] No regression in existing functionality
- [ ] Integration test suite passes 100%

## Implementation Steps

### Step 1: Rule Execution Testing

**1.1 Identify all intimacy rules**

```bash
# Find all rules that reference intimacy actions
find data/mods/intimacy/rules -name "*.rule.json" -exec grep -l "intimacy:" {} \;

# Count total intimacy rules
find data/mods/intimacy/rules -name "*.rule.json" | wc -l
```

**1.2 Test rule conditions**

```javascript
// Test script: scripts/test-intimacy-rules.js
import { RuleEngine } from '../src/ruleEngine.js';
import { EventBus } from '../src/eventBus.js';

const ruleEngine = new RuleEngine(/* dependencies */);
const eventBus = new EventBus();

// Test kissing action rules
const kissingActions = [
  'intimacy:accept_kiss_passively',
  'intimacy:kiss_back_passionately',
  // ... all kissing actions
];

kissingActions.forEach((actionId) => {
  const event = {
    type: 'ACTION_SELECTED',
    payload: {
      actionId,
      actorId: 'test_actor',
      targetId: 'test_target',
    },
  };

  try {
    const rules = ruleEngine.evaluateRules(event);
    console.log(`✓ Rules for ${actionId}: ${rules.length} triggered`);
  } catch (err) {
    console.error(`❌ Rule evaluation failed for ${actionId}: ${err.message}`);
  }
});
```

**1.3 Verify rule actions execute**

```bash
# Run integration tests for rules
npm run test:integration -- --testPathPattern="rules" --testNamePattern="intimacy"
```

### Step 2: Event System Integration

**2.1 Test event payload structure**

```javascript
// Verify event payloads maintain structure
const testEventPayload = (actionId, expectedStructure) => {
  const event = eventBus.createActionEvent(actionId, actorId, targetId);

  // For single-target actions
  if (expectedStructure === 'single') {
    assert(event.payload.targetId, 'Missing targetId in payload');
    assert(
      !event.payload.targets,
      'Unexpected targets in single-target action'
    );
  }

  // For multi-target actions (adjust_clothing)
  if (expectedStructure === 'multi') {
    assert(event.payload.targets, 'Missing targets in payload');
    assert(event.payload.targets.primary, 'Missing primary target');
  }
};

// Test all migrated actions
migratedActions.forEach((action) => {
  testEventPayload(action.id, 'single');
});

// Test adjust_clothing separately
testEventPayload('intimacy:adjust_clothing', 'multi');
```

**2.2 Test event flow**

```bash
# Run event system tests
npm run test:integration -- --testPathPattern="event" --testNamePattern="action.*execution"
```

### Step 3: Action Discovery Integration

**3.1 Test action discovery service**

```javascript
// Test discovery finds all actions
import { ActionDiscoveryService } from '../src/actionDiscovery.js';

const discovery = new ActionDiscoveryService(/* dependencies */);
const actor = { id: 'test_actor', components: ['positioning:closeness'] };

// Get all available intimacy actions
const actions = await discovery.getAvailableActions(actor);
const intimacyActions = actions.filter((a) => a.id.startsWith('intimacy:'));

console.log(`Found ${intimacyActions.length} intimacy actions`);
assert(intimacyActions.length >= 24, 'Missing intimacy actions');

// Verify each migrated action is discoverable
const expectedActions = [
  /* list of 24 action IDs */
];
expectedActions.forEach((expectedId) => {
  const found = intimacyActions.find((a) => a.id === expectedId);
  assert(found, `Action ${expectedId} not discoverable`);
});
```

**3.2 Test scope resolution**

```javascript
// Test that scope resolution works for all action types
const testScopes = [
  { scope: 'intimacy:current_kissing_partner', context: 'kissing' },
  { scope: 'positioning:close_actors', context: 'proximity' },
  { scope: 'intimacy:close_actors_facing_away', context: 'positioning' },
];

testScopes.forEach(({ scope, context }) => {
  const targets = discovery.resolveScope(scope, actor);
  console.log(`Scope ${scope}: ${targets.length} targets found`);
});
```

### Step 4: UI Integration Testing

**4.1 Test UI action display**

```javascript
// Simulate UI action list generation
import { UIActionList } from '../src/ui/actionList.js';

const ui = new UIActionList(/* dependencies */);
const actionList = ui.generateActionList(actor, context);

// Verify intimacy actions appear
const intimacySection = actionList.find((s) => s.category === 'intimacy');
assert(intimacySection, 'Intimacy category missing from UI');
assert(intimacySection.actions.length >= 24, 'Missing actions in UI');

// Check action formatting
intimacySection.actions.forEach((action) => {
  assert(action.name, 'Action missing name');
  assert(action.description, 'Action missing description');
  assert(action.template, 'Action missing template');
});
```

**4.2 Test target selection UI**

```javascript
// Test single-target selection
const singleTargetAction = ui.getAction('intimacy:kiss_cheek');
assert(
  singleTargetAction.targetSelection === 'single',
  'Wrong target selection type'
);

// Test multi-target selection (adjust_clothing)
const multiTargetAction = ui.getAction('intimacy:adjust_clothing');
assert(
  multiTargetAction.targetSelection === 'multi',
  'Wrong target selection type'
);
assert(multiTargetAction.targets.primary, 'Missing primary target config');
assert(multiTargetAction.targets.secondary, 'Missing secondary target config');
```

### Step 5: Component Requirements Testing

**5.1 Test required components**

```javascript
// Test that required components are enforced
const actorWithoutCloseness = {
  id: 'distant_actor',
  components: [], // No positioning:closeness
};

const actions = discovery.getAvailableActions(actorWithoutCloseness);
const intimacyActions = actions.filter((a) => a.id.startsWith('intimacy:'));

// Should have no intimacy actions without closeness
assert(
  intimacyActions.length === 0,
  'Actions available without required components'
);
```

**5.2 Test forbidden components**

```javascript
// Test that forbidden components prevent actions
const kissingActor = {
  id: 'kissing_actor',
  components: ['positioning:closeness', 'intimacy:kissing'],
};

const actions = discovery.getAvailableActions(kissingActor);

// Touch actions should not be available while kissing
const touchActions = ['intimacy:brush_hand', 'intimacy:place_hand_on_waist'];
touchActions.forEach((actionId) => {
  const found = actions.find((a) => a.id === actionId);
  assert(!found, `${actionId} available despite forbidden component`);
});
```

### Step 6: Cross-Mod Integration

**6.1 Test positioning mod integration**

```bash
# Verify positioning mod is loaded
grep '"positioning"' data/game.json || exit 1

# Test cross-mod scope resolution
node -e "
const actions = require('./data/mods/intimacy/actions/brush_hand.action.json');
console.log('Cross-mod scope:', actions.targets);
assert(actions.targets.startsWith('positioning:'));
"
```

**6.2 Test cross-mod action availability**

```javascript
// Test that positioning scopes work
const testCrossModIntegration = async () => {
  const actor = {
    id: 'test_actor',
    components: ['positioning:closeness'],
  };

  // These actions use positioning:close_actors scope
  const crossModActions = [
    'intimacy:brush_hand',
    'intimacy:place_hand_on_waist',
  ];

  const available = await discovery.getAvailableActions(actor);

  crossModActions.forEach((actionId) => {
    const found = available.find((a) => a.id === actionId);
    assert(found, `Cross-mod action ${actionId} not available`);
  });
};
```

### Step 7: Action Execution Testing

**7.1 Test action execution flow**

```javascript
// Test complete action execution
const executeAction = async (actionId, actorId, targetId) => {
  // 1. Action selection
  const selectionEvent = {
    type: 'ACTION_SELECTED',
    payload: { actionId, actorId, targetId },
  };

  // 2. Pre-execution validation
  const canExecute = await actionValidator.validate(selectionEvent);
  assert(canExecute, `Cannot execute ${actionId}`);

  // 3. Execute action
  const result = await actionExecutor.execute(selectionEvent);
  assert(result.success, `Execution failed for ${actionId}`);

  // 4. Verify events dispatched
  const events = eventBus.getDispatchedEvents();
  const executionEvent = events.find(
    (e) => e.type === 'ACTION_EXECUTED' && e.payload.actionId === actionId
  );
  assert(executionEvent, `No execution event for ${actionId}`);

  return result;
};

// Test all migrated actions
for (const actionId of migratedActionIds) {
  await executeAction(actionId, 'actor1', 'actor2');
}
```

### Step 8: Action Tracing Validation

**8.1 Enable tracing and test**

```bash
# Enable action tracing
export ACTION_TRACING_ENABLED=true
export ACTION_TRACING_PATTERN="intimacy:*"

# Run test with tracing
npm run test:integration -- --testNamePattern="intimacy.*execution"

# Verify traces generated
ls -la traces/intmig-migration/*.json | wc -l
# Should have traces for executed actions
```

**8.2 Validate trace structure**

```javascript
// Validate action traces
const validateTraces = () => {
  const traceDir = './traces/intmig-migration';
  const traces = fs
    .readdirSync(traceDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(traceDir, f))));

  traces.forEach((trace) => {
    assert(trace.actionId, 'Missing actionId in trace');
    assert(trace.timestamp, 'Missing timestamp');
    assert(trace.eventPayload, 'Missing event payload');

    // For migrated actions, should use targetId not targets
    if (!trace.actionId.includes('adjust_clothing')) {
      assert(trace.eventPayload.targetId, 'Missing targetId in trace');
    }
  });

  console.log(`✅ Validated ${traces.length} action traces`);
};
```

### Step 9: Regression Testing

**9.1 Run full integration test suite**

```bash
# Run all integration tests
npm run test:integration

# Check for any failures
if [ $? -ne 0 ]; then
  echo "❌ Integration tests failed!"
  exit 1
fi
```

**9.2 Compare with baseline**

```bash
# Compare test results with pre-migration baseline
diff test-baselines/intmig-*/integration-tests.json current-integration-results.json

# Check for any new failures
if [ $? -ne 0 ]; then
  echo "⚠️ Integration test results differ from baseline"
  # Analyze differences
fi
```

## Testing Requirements

### Integration Test Suites

```bash
# Rule integration
npm run test:integration -- --testPathPattern="rules/intimacy"

# Event system integration
npm run test:integration -- --testPathPattern="events/action"

# Discovery integration
npm run test:integration -- --testPathPattern="discovery/intimacy"

# UI integration
npm run test:integration -- --testPathPattern="ui/actions"

# Cross-mod integration
npm run test:integration -- --testPathPattern="crossmod"
```

### Manual Integration Testing

1. **Start application**

   ```bash
   npm run dev
   ```

2. **Test action flow**
   - Select an actor with positioning:closeness
   - Open action menu
   - Verify all 25 intimacy actions appear
   - Select a kissing action
   - Verify target selection works
   - Execute action
   - Verify rule triggers
   - Check console for events

3. **Test edge cases**
   - Actor without required components
   - Actor with forbidden components
   - Multiple valid targets
   - No valid targets

## Completion Checklist

- [ ] All intimacy rules execute correctly
- [ ] Event payloads maintain structure
- [ ] Action discovery works for all actions
- [ ] UI displays actions correctly
- [ ] Target selection works (single and multi)
- [ ] Component requirements enforced
- [ ] Cross-mod integration verified
- [ ] Action execution flow works
- [ ] Action traces validate
- [ ] No regression from baseline
- [ ] Integration test suite passes
- [ ] Manual testing completed
- [ ] Ready for E2E testing

## Risk Mitigation

| Risk                    | Impact | Mitigation                  |
| ----------------------- | ------ | --------------------------- |
| Rule breakage           | High   | Test each rule individually |
| Event structure change  | High   | Validate payload structure  |
| UI display issues       | Medium | Manual UI testing           |
| Performance degradation | Medium | Monitor execution times     |

## Notes

- Integration testing is critical for ensuring backward compatibility
- Any failures must be investigated and fixed
- Keep detailed logs of any issues found
- Document any behavioral changes, even if acceptable
