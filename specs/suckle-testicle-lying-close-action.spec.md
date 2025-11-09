# Specification: Suckle Testicle (Lying Close) Action Implementation

## Overview

This specification defines the implementation requirements for a new action/rule combination that allows characters to suckle their partner's testicle while both are lying down in close proximity on shared furniture. This action extends the existing testicle-suckling mechanics to support lying positions, complementing the existing sitting and kneeling variants.

**Content Type**: Mature - Sexual Content

## Reference Actions

This implementation should follow established patterns from:
- **`lick_testicles_lying_close.action.json`** - Template for lying-down close proximity testicle actions
- **`suckle_testicle_sitting_close.action.json`** - Template for testicle-suckling while sitting close
- **`suckle_testicle.action.json`** - Template for testicle-suckling mechanics (kneeling variant)
- **`sex-core:actors_lying_close_with_uncovered_testicle.scope`** - Scope for lying-down with testicle exposure checks (created in LICKLYTHIACTMP-011)
- **`sex-core:actors_sitting_close_with_uncovered_testicle.scope`** - Pattern for testicle coverage checks

## Implementation Files

### 1. Action Definition

**File**: `data/mods/sex-penile-oral/actions/suckle_testicle_lying_close.action.json`

**Schema**: `schema://living-narrative-engine/action.schema.json`

**Action ID**: `sex-penile-oral:suckle_testicle_lying_close`

**Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "sex-penile-oral:suckle_testicle_lying_close",
  "name": "Suckle Testicle (Lying Close)",
  "description": "Suckle on a partner's testicle while both are lying close together. Requires both participants to be lying down on the same furniture with mutual closeness. The partner must have at least one exposed testicle.",
  "targets": {
    "primary": {
      "scope": "sex-core:actors_lying_close_with_uncovered_testicle",
      "placeholder": "primary",
      "description": "Partner lying close with exposed testicles"
    }
  },
  "template": "suckle on {primary}'s testicle",
  "prerequisites": [],
  "required_components": {
    "actor": ["positioning:lying_down", "positioning:closeness"],
    "primary": ["positioning:lying_down", "positioning:closeness"]
  },
  "forbidden_components": {
    "actor": ["positioning:giving_blowjob"]
  },
  "visual": {
    "backgroundColor": "#2a1a5e",
    "textColor": "#ede7f6",
    "hoverBackgroundColor": "#372483",
    "hoverTextColor": "#ffffff"
  }
}
```

**Key Requirements**:
- Both actor and primary must have `positioning:lying_down` component
- Both actor and primary must have `positioning:closeness` component with mutual partner references
- Actor must NOT have `positioning:giving_blowjob` component (prevents conflicting states)
- Primary must have at least one uncovered testicle (validated by scope)
- Uses `primary` as the placeholder (following pattern from `suckle_testicle_sitting_close`)
- Visual properties match sex-penile-oral mod standards (purple theme)

**Manifest Update**: Add action file to `data/mods/sex-penile-oral/mod-manifest.json`:
```json
{
  "actions": [
    "actions/suckle_testicle_lying_close.action.json"
  ]
}
```

### 2. Condition File

**File**: `data/mods/sex-penile-oral/conditions/event-is-action-suckle-testicle-lying-close.condition.json`

**Critical**: Use hyphens in filename, even though action uses underscores

**Schema**: `schema://living-narrative-engine/condition.schema.json`

**Condition ID**: `sex-penile-oral:event-is-action-suckle-testicle-lying-close`

**Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "sex-penile-oral:event-is-action-suckle-testicle-lying-close",
  "description": "Checks if the triggering event is for the 'sex-penile-oral:suckle_testicle_lying_close' action.",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "sex-penile-oral:suckle_testicle_lying_close"
    ]
  }
}
```

**Key Requirements**:
- Filename uses hyphens (convention for condition files)
- Action ID in logic uses underscores (matches action definition)
- Standard event-matching pattern

**Manifest Update**: Add condition file to `data/mods/sex-penile-oral/mod-manifest.json`:
```json
{
  "conditions": [
    "conditions/event-is-action-suckle-testicle-lying-close.condition.json"
  ]
}
```

### 3. Rule Definition

**File**: `data/mods/sex-penile-oral/rules/handle_suckle_testicle_lying_close.rule.json`

**Schema**: `schema://living-narrative-engine/rule.schema.json`

**Rule ID**: `sex-penile-oral:handle_suckle_testicle_lying_close`

**Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "sex-penile-oral:handle_suckle_testicle_lying_close",
  "comment": "Handles the suckle_testicle_lying_close action: actor suckles primary's testicle while both are lying close together",
  "event_type": "core:attempt_action",
  "condition": "sex-penile-oral:event-is-action-suckle-testicle-lying-close",
  "actions": [
    {
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "actor",
        "result_variable": "actorName"
      }
    },
    {
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "primary",
        "result_variable": "primaryName"
      }
    },
    {
      "type": "QUERY_COMPONENT",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "core:position",
        "result_variable": "actorPosition"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} wraps her lips around {context.primaryName}'s scrotum and sucks carefully on one testicle, tracing it with the tongue."
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "perceptionType",
        "value": "action_target_general"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "locationId",
        "value": "{context.actorPosition.locationId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "actorId",
        "value": "{event.payload.actorId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "targetId",
        "value": "{event.payload.primaryId}"
      }
    },
    {
      "macro": "core:logSuccessAndEndTurn"
    }
  ]
}
```

**Key Requirements**:
- Uses `primary` entity reference for GET_NAME and stores in `primaryName` variable
- Message: `"{actor} wraps her lips around {primary}'s scrotum and sucks carefully on one testicle, tracing it with the tongue."`
- Perception type: `action_target_general`
- Standard operation sequence: GET_NAME (actor), GET_NAME (primary), QUERY_COMPONENT (actor position), SET_VARIABLE (all needed variables), macro (logSuccessAndEndTurn)
- `targetId` set to `{event.payload.primaryId}` (matches the primary target reference)

**Message Rationale**:
- "wraps her lips around {primary}'s scrotum" - establishes the oral contact
- "sucks carefully on one testicle" - describes the suckling action
- "tracing it with the tongue" - adds sensory detail specific to this action
- Matches the user's requested message format exactly

**Manifest Update**: Add rule file to `data/mods/sex-penile-oral/mod-manifest.json`:
```json
{
  "rules": [
    "rules/handle_suckle_testicle_lying_close.rule.json"
  ]
}
```

## Test Suite Specifications

### Test File 1: Test Fixtures

**File**: `tests/common/mods/sex-penile-oral/suckleTesticleLyingCloseFixtures.js`

**Purpose**: Provide reusable scenario builders and scope override functions for testing

**Note**: This implementation reuses the `lickTesticlesLyingCloseFixtures.js` file created in LICKLYTHIACTMP-011, as both actions share identical scope requirements and test scenarios. The fixture function names remain generic (e.g., `buildLickTesticlesLyingCloseScenario`) and are suitable for testing both lick and suckle actions.

**Reuse Strategy**:
```javascript
// Import existing fixtures from lick testicles lying close
import {
  buildLickTesticlesLyingCloseScenario,
  installLyingCloseUncoveredTesticleScopeOverride,
} from './lickTesticlesLyingCloseFixtures.js';

// These fixtures support all lying-close testicle actions:
// - Both actions require same positioning (lying_down, closeness)
// - Both actions use same scope (actors_lying_close_with_uncovered_testicle)
// - Both actions have same forbidden components (giving_blowjob)
// - Scenario builder options work for both actions
```

**Shared Fixture Capabilities**:
- Default scenario: Valid state with all preconditions met
- Options for negative test scenarios (toggle each precondition)
- Supports both testicles with independent coverage control
- Scope override implements same logic as actual scope file
- Includes test for `fucking_vaginally` constraint
- Cleanup function for proper test teardown

### Test File 2: Action Discovery Tests

**File**: `tests/integration/mods/sex-penile-oral/suckle_testicle_lying_close_action_discovery.test.js`

**Purpose**: Verify the action appears in the discovery system only when all preconditions are met

**Test Structure**:
```javascript
/**
 * @file Integration tests for sex-penile-oral:suckle_testicle_lying_close action discovery.
 * @description Ensures the lying-down suckle action only appears when both partners are lying close with at least one uncovered testicle.
 */

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  buildLickTesticlesLyingCloseScenario,
  installLyingCloseUncoveredTesticleScopeOverride,
} from '../../../common/mods/sex-penile-oral/lickTesticlesLyingCloseFixtures.js';
import suckleTesticleLyingCloseAction from '../../../../data/mods/sex-penile-oral/actions/suckle_testicle_lying_close.action.json';

const ACTION_ID = 'sex-penile-oral:suckle_testicle_lying_close';

/**
 * Configures action discovery for test scenarios.
 *
 * @param {import('../../../common/mods/ModTestFixture.js').ModTestFixture} fixture - Test fixture instance
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([suckleTesticleLyingCloseAction]);
}

describe('sex-penile-oral:suckle_testicle_lying_close action discovery', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('sex-penile-oral', ACTION_ID);
    restoreScopeResolver = installLyingCloseUncoveredTesticleScopeOverride(testFixture);
  });

  afterEach(() => {
    if (restoreScopeResolver) {
      restoreScopeResolver();
      restoreScopeResolver = null;
    }
    if (testFixture) {
      testFixture.cleanup();
      testFixture = null;
    }
  });

  // Positive test case
  it('appears when both participants are lying close with uncovered testicles', async () => {
    const { entities, actorId } = buildLickTesticlesLyingCloseScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeDefined();
    expect(discovered.template).toBe("suckle on {primary}'s testicle");
  });

  // Positive test case - only one testicle uncovered
  it('appears when only one testicle remains uncovered', async () => {
    const { entities, actorId } = buildLickTesticlesLyingCloseScenario({
      coverLeftTesticle: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeDefined();
  });

  // Negative test cases
  it('does NOT appear when both testicles are covered', async () => {
    const { entities, actorId } = buildLickTesticlesLyingCloseScenario({
      coverLeftTesticle: true,
      coverRightTesticle: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does NOT appear when actor is not lying down', async () => {
    const { entities, actorId } = buildLickTesticlesLyingCloseScenario({
      includeActorLying: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does NOT appear when primary is not lying down', async () => {
    const { entities, actorId } = buildLickTesticlesLyingCloseScenario({
      includePrimaryLying: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does NOT appear when mutual closeness is not established', async () => {
    const { entities, actorId } = buildLickTesticlesLyingCloseScenario({
      includeCloseness: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does NOT appear when participants are on different furniture', async () => {
    const { entities, actorId } = buildLickTesticlesLyingCloseScenario({
      useDifferentFurniture: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does NOT appear when actor has giving_blowjob component', async () => {
    const { entities, actorId } = buildLickTesticlesLyingCloseScenario({
      actorGivingBlowjob: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does NOT appear when target is fucking actor vaginally', async () => {
    const { entities, actorId } = buildLickTesticlesLyingCloseScenario({
      targetFuckingActor: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });
});
```

**Required Test Cases**:
1. ✅ **Positive**: Action appears when all preconditions met (both testicles uncovered)
2. ✅ **Positive**: Action appears when only one testicle uncovered
3. ❌ **Both testicles covered**: Action blocked when both testicles are covered
4. ❌ **Actor not lying**: Action blocked when actor lacks lying_down component
5. ❌ **Primary not lying**: Action blocked when primary lacks lying_down component
6. ❌ **No closeness**: Action blocked when mutual closeness not established
7. ❌ **Different furniture**: Action blocked when on different furniture pieces
8. ❌ **Forbidden component**: Action blocked when actor has giving_blowjob component
9. ❌ **Sexual conflict**: Action blocked when target is fucking actor vaginally

### Test File 3: Action Execution Tests

**File**: `tests/integration/mods/sex-penile-oral/suckle_testicle_lying_close_action.test.js`

**Purpose**: Verify the rule executes correctly, dispatches proper events, and produces expected narrative output

**Test Structure**:
```javascript
/**
 * @file Integration tests for sex-penile-oral:suckle_testicle_lying_close action execution.
 * @description Validates rule execution produces correct narrative output and events.
 */

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import {
  buildLickTesticlesLyingCloseScenario,
  installLyingCloseUncoveredTesticleScopeOverride,
} from '../../../common/mods/sex-penile-oral/lickTesticlesLyingCloseFixtures.js';
import suckleTesticleLyingCloseAction from '../../../../data/mods/sex-penile-oral/actions/suckle_testicle_lying_close.action.json';

const ACTION_ID = 'sex-penile-oral:suckle_testicle_lying_close';
const EXPECTED_MESSAGE =
  "Ava wraps her lips around Nolan's scrotum and sucks carefully on one testicle, tracing it with the tongue.";

/**
 * Configures action discovery for test scenarios.
 *
 * @param {import('../../../common/mods/ModTestFixture.js').ModTestFixture} fixture - Test fixture instance
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([suckleTesticleLyingCloseAction]);
}

describe('sex-penile-oral:suckle_testicle_lying_close action execution', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forActionAutoLoad(
      'sex-penile-oral',
      ACTION_ID
    );
    restoreScopeResolver =
      installLyingCloseUncoveredTesticleScopeOverride(testFixture);
  });

  afterEach(() => {
    if (restoreScopeResolver) {
      restoreScopeResolver();
      restoreScopeResolver = null;
    }
    if (testFixture) {
      testFixture.cleanup();
      testFixture = null;
    }
  });

  it('successfully executes lying-down testicle suckling action', async () => {
    expect.hasAssertions();
    const { entities, actorId, primaryId, roomId } =
      buildLickTesticlesLyingCloseScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    ModAssertionHelpers.assertActionSuccess(
      testFixture.events,
      EXPECTED_MESSAGE,
      {
        shouldEndTurn: true,
        shouldHavePerceptibleEvent: true,
      }
    );

    ModAssertionHelpers.assertPerceptibleEvent(testFixture.events, {
      descriptionText: EXPECTED_MESSAGE,
      locationId: roomId,
      actorId,
      targetId: primaryId,
      perceptionType: 'action_target_general',
    });
  });
});
```

**Required Test Cases**:
1. ✅ **Success message**: Verifies correct narrative message dispatched
2. ✅ **Perceptible event**: Verifies perceptible event with correct structure
3. ✅ **Turn ended**: Verifies turn_ended event dispatched
4. ✅ **Entity references**: Verifies correct actorId, targetId, locationId in events

## Implementation Checklist

### Phase 1: File Creation (Order Matters)

- [ ] **Step 1**: Verify scope file exists
  - Location: `data/mods/sex-core/scopes/actors_lying_close_with_uncovered_testicle.scope`
  - This scope was created in LICKLYTHIACTMP-011 and should already exist
  - No changes required

- [ ] **Step 2**: Create condition file `event-is-action-suckle-testicle-lying-close.condition.json`
  - ⚠️ Critical: Use hyphens in filename
  - Validate: Action ID in logic uses underscores
  - Update `sex-penile-oral` mod manifest

- [ ] **Step 3**: Create action file `suckle_testicle_lying_close.action.json`
  - Validate: All component namespaces correct
  - Validate: Scope reference matches existing scope file
  - Validate: Uses `primary` placeholder
  - Validate: Visual properties match mod standards
  - Update `sex-penile-oral` mod manifest

- [ ] **Step 4**: Create rule file `handle_suckle_testicle_lying_close.rule.json`
  - Validate: Condition reference uses hyphens
  - Validate: Uses `primary` entity reference and stores in `primaryName`
  - Validate: Message matches exactly: "{actor} wraps her lips around {primary}'s scrotum and sucks carefully on one testicle, tracing it with the tongue."
  - Update `sex-penile-oral` mod manifest

### Phase 2: Test Infrastructure

- [ ] **Step 5**: Verify fixture file exists
  - Location: `tests/common/mods/sex-penile-oral/lickTesticlesLyingCloseFixtures.js`
  - This fixture was created in LICKLYTHIACTMP-011 and should already exist
  - Supports all required test scenarios
  - No changes required - reuse existing fixtures

- [ ] **Step 6**: Create action discovery test file
  - Location: `tests/integration/mods/sex-penile-oral/suckle_testicle_lying_close_action_discovery.test.js`
  - Import fixture functions from lickTesticlesLyingCloseFixtures.js
  - Implement 9 test cases (2 positive, 7 negative)
  - Verify cleanup in afterEach

- [ ] **Step 7**: Create action execution test file
  - Location: `tests/integration/mods/sex-penile-oral/suckle_testicle_lying_close_action.test.js`
  - Import ModAssertionHelpers
  - Implement 1+ test case (success message and perceptible event)
  - Verify cleanup in afterEach

### Phase 3: Validation

- [ ] **Step 8**: Run schema validation
  ```bash
  npm run validate
  ```
  - Verifies all JSON files are valid
  - Checks schema references resolve
  - Validates component namespacing

- [ ] **Step 9**: Run linting
  ```bash
  npx eslint tests/integration/mods/sex-penile-oral/suckle_testicle_lying_close_*.test.js
  ```
  - Fixes code style issues
  - Ensures test file conventions

- [ ] **Step 10**: Run tests
  ```bash
  NODE_ENV=test npm run test:integration -- tests/integration/mods/sex-penile-oral/suckle_testicle_lying_close_action_discovery.test.js --no-coverage --silent
  NODE_ENV=test npm run test:integration -- tests/integration/mods/sex-penile-oral/suckle_testicle_lying_close_action.test.js --no-coverage --silent
  ```
  - Verifies all test cases pass
  - Checks coverage meets requirements

### Phase 4: Final Verification

- [ ] **Step 11**: Verify naming conventions
  - Action file: underscores ✅
  - Rule file: underscores ✅
  - Condition file: hyphens ✅
  - Test files: underscores ✅
  - Fixture file: camelCase (reused from existing) ✅

- [ ] **Step 12**: Verify ID consistency
  - Action ID same across action, rule, tests
  - Condition ID uses hyphens in file reference
  - Scope reference matches existing scope file
  - Placeholder uses `primary` consistently

- [ ] **Step 13**: Visual consistency check
  - Colors match other sex-penile-oral actions
  - Template format matches existing patterns
  - Message style consistent with mod voice

## Common Pitfalls & Solutions

### Pitfall 1: Filename Convention Mismatch
**Problem**: Using underscores in condition filename
**Solution**: Always use hyphens for condition files, even when action uses underscores
**Example**: ❌ `event-is-action-suckle_testicle_lying_close.condition.json` → ✅ `event-is-action-suckle-testicle-lying-close.condition.json`

### Pitfall 2: Placeholder Consistency
**Problem**: Mixing `target` and `primary` placeholders
**Solution**: This action uses `primary` placeholder consistently (following `suckle_testicle_sitting_close` pattern)
**Example**:
- Action template: `suckle on {primary}'s testicle`
- Rule GET_NAME: `entity_ref: "primary", result_variable: "primaryName"`
- Rule SET_VARIABLE for targetId: `{event.payload.primaryId}`

### Pitfall 3: Reusing Wrong Fixtures
**Problem**: Creating duplicate fixtures when existing ones work
**Solution**: Reuse `lickTesticlesLyingCloseFixtures.js` - it supports all lying-close testicle actions
**Rationale**: Both lick and suckle actions share identical positioning requirements, scope, and preconditions

### Pitfall 4: Message Format Inconsistency
**Problem**: Deviating from specified message format
**Solution**: Use exact message format from spec
**Correct**: `"{actor} wraps her lips around {primary}'s scrotum and sucks carefully on one testicle, tracing it with the tongue."`

### Pitfall 5: Test Cleanup Missing
**Problem**: Tests leave dirty state affecting subsequent tests
**Solution**: Always call `fixture.cleanup()` in afterEach, restore scope resolver
**Example**:
```javascript
afterEach(() => {
  if (restoreScopeResolver) {
    restoreScopeResolver();
    restoreScopeResolver = null;
  }
  if (testFixture) {
    testFixture.cleanup();
    testFixture = null;
  }
});
```

### Pitfall 6: Scope Already Exists
**Problem**: Attempting to create scope that was already created in LICKLYTHIACTMP-011
**Solution**: Verify `sex-core:actors_lying_close_with_uncovered_testicle` scope exists and reuse it
**Check**: `data/mods/sex-core/scopes/actors_lying_close_with_uncovered_testicle.scope`

## Reference Documentation

### Related Files to Review
- **Lick testicles lying variant**: `lick_testicles_lying_close.action.json` and corresponding rule/tests (LICKLYTHIACTMP-011)
- **Suckle testicle sitting variant**: `suckle_testicle_sitting_close.action.json` and corresponding rule/tests
- **Suckle testicle kneeling variant**: `suckle_testicle.action.json` and corresponding rule/tests
- **Shared scope**: `sex-core:actors_lying_close_with_uncovered_testicle.scope` (from LICKLYTHIACTMP-011)
- **Shared fixtures**: `lickTesticlesLyingCloseFixtures.js` (from LICKLYTHIACTMP-011)
- **Test guide**: `docs/testing/mod-testing-guide.md`

### Key Patterns
- **lying_close actions**: Require same furniture_id, reuse shared scope and fixtures
- **sitting_close actions**: No furniture matching, simpler scope
- **testicle anatomy**: Requires checking BOTH left and right testicles with OR logic
- **Component namespacing**: Always use `modId:componentName` format
- **Test fixtures**: Reuse existing fixtures when scope requirements match
- **Placeholder consistency**: Follow the pattern of the closest sibling action

## Success Criteria

✅ **Implementation Complete When**:
1. Scope file verified to exist (created in LICKLYTHIACTMP-011)
2. All 3 new JSON files created and schema-valid (action, condition, rule)
3. All 9 discovery test cases pass
4. All execution test cases pass
5. Naming conventions verified correct
6. Linting passes with no errors
7. Visual properties match mod standards
8. Message formatting matches user specification exactly

✅ **Quality Metrics**:
- Test coverage: 100% of action/rule logic
- Schema validation: All files pass
- Integration tests: All scenarios covered (2 positive + 7 negative)
- Code style: ESLint compliant
- Documentation: Inline comments explain test structure
- Fixture reuse: No duplicate test infrastructure

## Maintenance Notes

### Future Considerations
- If positioning system changes, verify scope logic still works (shared with lick action)
- If new forbidden states added, add corresponding negative test cases
- If message formatting changes, update EXPECTED_MESSAGE constant
- Keep fixture scenario builder in sync with actual component schemas (already handled by shared fixtures)
- If new testicle-related components added, verify scope and tests still work

### Related Systems
- **Positioning System**: `data/mods/positioning/` - defines lying_down, closeness components
- **Anatomy System**: `data/mods/anatomy/` - defines testicle body parts and coverage
- **Furniture System**: `data/mods/furniture/` - defines allows_lying property
- **Perception System**: `src/perception/` - handles perceptible_event dispatching
- **Sexual Positioning**: Various `positioning:` components track sexual interactions

### Related Implementations
- **LICKLYTHIACTMP-011**: Created the shared scope `actors_lying_close_with_uncovered_testicle` and fixtures that this action reuses

---

**Specification Version**: 1.0
**Created**: 2025-11-09
**Status**: Ready for Implementation
**Related Specs**: LICKLYTHIACTMP-011 (lick-testicles-lying-close-action.spec.md)
