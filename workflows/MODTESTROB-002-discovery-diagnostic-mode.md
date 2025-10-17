# MODTESTROB-002: Discovery Diagnostic Mode Implementation

**Status**: Ready for Implementation
**Priority**: P0 - High (Quick Win)
**Estimated Time**: 6 hours
**Risk Level**: Low
**Phase**: 1 - Quick Wins

## Overview

Implements a comprehensive diagnostic mode for action discovery that provides complete visibility into the discovery pipeline. When an action doesn't appear in discovered actions, developers get a detailed trace showing exactly what happened at each step (scope resolution, component checks, condition evaluation) with actionable hints for fixing the issue.

## Prerequisites

- [ ] MODTESTROB-001 complete (validation proxy in place)
- [ ] Clean git working directory
- [ ] All existing tests passing
- [ ] Feature branch: `feature/modtest-discovery-diagnostics`

## Problem Statement

**Current Pain Point**: When `discoverActions()` doesn't return an expected action, developers have zero visibility into why. They spend 15-30 minutes adding console.log statements, inspecting scope resolvers, and guessing at which component is missing.

**Target State**: Enable diagnostic mode that traces the entire discovery pipeline:
```
🔍 ACTION DISCOVERY DIAGNOSTICS: actor1
   Looking for: positioning:scoot_closer

  📊 Scope: positioning:furniture_actor_sitting_on
     Context: actor=actor1
     Result: 1 entities
     Entities: [furniture1]

  📊 Scope: positioning:closest_leftmost_occupant
     Context: actor=actor1, target=furniture1
     Result: 0 entities ❌

❌ Expected action 'positioning:scoot_closer' WAS NOT FOUND
🔍 DEBUGGING HINTS:
   ⚠️  1 scope returned empty results:
      - positioning:closest_leftmost_occupant
        Suggestion: Check if required components exist on entities
```

## Detailed Steps

### Step 1: Create Discovery Diagnostics Module

**File to create**: `tests/common/mods/discoveryDiagnostics.js`

**Implementation**:
```javascript
/**
 * @file Discovery diagnostic tools for action discovery pipeline
 * Provides detailed tracing and debugging hints for action discovery issues
 */

/**
 * Diagnostic wrapper for action discovery pipeline
 * Traces every step and provides actionable debugging hints
 */
export class DiscoveryDiagnostics {
  constructor(testEnv) {
    this.testEnv = testEnv;
    this.trace = [];
    this.originalResolvers = new Map();
  }

  /**
   * Enable diagnostic mode - wraps key components with tracing
   */
  enableDiagnostics() {
    this._wrapScopeResolver();
    this._wrapActionIndex();
    this._wrapComponentQueries();
  }

  /**
   * Disable diagnostic mode and restore original behavior
   */
  disableDiagnostics() {
    // Restore original scope resolver
    if (this.originalResolvers.has('scopeResolver')) {
      this.testEnv.unifiedScopeResolver.resolveSync =
        this.originalResolvers.get('scopeResolver');
    }
  }

  /**
   * Discover actions with full diagnostic output
   * @param {string} actorId - Actor to discover actions for
   * @param {string} [expectedActionId] - Optional action ID to look for
   * @returns {Array} Discovered actions
   */
  discoverWithDiagnostics(actorId, expectedActionId = null) {
    this.trace = [];

    console.log('\n' + '='.repeat(80));
    console.log(`🔍 ACTION DISCOVERY DIAGNOSTICS: ${actorId}`);
    if (expectedActionId) {
      console.log(`   Looking for: ${expectedActionId}`);
    }
    console.log('='.repeat(80) + '\n');

    const startTime = Date.now();
    const actions = this.testEnv.getAvailableActions(actorId);
    const duration = Date.now() - startTime;

    this._printDiagnosticReport(actions, expectedActionId, duration);

    return actions;
  }

  /**
   * Wrap scope resolver to trace all resolution attempts
   */
  _wrapScopeResolver() {
    const original = this.testEnv.unifiedScopeResolver.resolveSync.bind(
      this.testEnv.unifiedScopeResolver
    );
    this.originalResolvers.set('scopeResolver', original);

    this.testEnv.unifiedScopeResolver.resolveSync = (scopeName, context) => {
      const startTime = Date.now();
      const result = original(scopeName, context);
      const duration = Date.now() - startTime;

      const traceEntry = {
        type: 'scope_resolution',
        scope: scopeName,
        context: {
          actorId: context?.actor?.id,
          targetId: context?.target?.id,
          primaryId: context?.primary?.id,
          secondaryId: context?.secondary?.id,
        },
        result: result.success
          ? {
              success: true,
              count: result.value.size,
              entities: Array.from(result.value),
            }
          : { success: false, error: result.error },
        duration,
      };

      this.trace.push(traceEntry);

      // Log immediately for real-time feedback
      console.log(`  📊 Scope: ${scopeName}`);
      console.log(
        `     Context: ${this._formatContext(traceEntry.context)}`
      );

      if (result.success) {
        const count = result.value.size;
        if (count === 0) {
          console.log(`     Result: 0 entities ❌`);
        } else {
          console.log(`     Result: ${count} entities ✅`);
          if (count <= 5) {
            // Show entities if not too many
            console.log(
              `     Entities: [${Array.from(result.value).join(', ')}]`
            );
          }
        }
      } else {
        console.log(`     Result: FAILED ❌`);
        console.log(`     Error: ${result.error || 'Unknown error'}`);
      }

      console.log(`     Time: ${duration}ms\n`);

      return result;
    };
  }

  /**
   * Wrap action index to trace action filtering
   */
  _wrapActionIndex() {
    // If testEnv has action discovery system, wrap it
    // This is optional and depends on implementation
  }

  /**
   * Wrap component queries to trace component checks
   */
  _wrapComponentQueries() {
    // If needed, wrap entity manager component checks
    // This is optional for additional diagnostics
  }

  /**
   * Format context for display
   */
  _formatContext(context) {
    const parts = [];
    if (context.actorId) parts.push(`actor=${context.actorId}`);
    if (context.targetId) parts.push(`target=${context.targetId}`);
    if (context.primaryId) parts.push(`primary=${context.primaryId}`);
    if (context.secondaryId) parts.push(`secondary=${context.secondaryId}`);
    return parts.length > 0 ? parts.join(', ') : 'none';
  }

  /**
   * Print comprehensive diagnostic report
   */
  _printDiagnosticReport(actions, expectedActionId, duration) {
    console.log('\n' + '-'.repeat(80));
    console.log('📋 DISCOVERY SUMMARY');
    console.log('-'.repeat(80));
    console.log(`Total time: ${duration}ms`);
    console.log(`Total actions discovered: ${actions.length}`);

    if (actions.length > 0) {
      console.log(
        `Action IDs: [${actions.map(a => a.id).slice(0, 10).join(', ')}${actions.length > 10 ? '...' : ''}]`
      );
    }

    if (expectedActionId) {
      const found = actions.some(a => a.id === expectedActionId);
      if (found) {
        console.log(`\n✅ Expected action '${expectedActionId}' WAS FOUND`);
        const action = actions.find(a => a.id === expectedActionId);
        console.log(`   Targets: ${JSON.stringify(action.targets || {})}`);
      } else {
        console.log(`\n❌ Expected action '${expectedActionId}' WAS NOT FOUND`);
        console.log('\n🔍 DEBUGGING HINTS:');
        this._provideDiagnosticHints(expectedActionId);
      }
    }

    // Show scope statistics
    console.log('\n📊 SCOPE RESOLUTION STATISTICS:');
    this._printScopeStatistics();

    console.log('\n' + '='.repeat(80) + '\n');
  }

  /**
   * Provide specific debugging hints based on trace analysis
   */
  _provideDiagnosticHints(expectedActionId) {
    const scopeTraces = this.trace.filter(t => t.type === 'scope_resolution');

    // Find empty scopes
    const emptyScopes = scopeTraces.filter(
      t => t.result.success && t.result.count === 0
    );

    if (emptyScopes.length > 0) {
      console.log(
        `\n   ⚠️  ${emptyScopes.length} scope(s) returned empty results:`
      );
      emptyScopes.forEach(t => {
        console.log(`      - ${t.scope}`);
        console.log(
          `        Context: ${this._formatContext(t.context)}`
        );
        console.log(
          `        💡 Check if entities have required components`
        );
        console.log(
          `        💡 Verify entities are in correct location/state`
        );
      });
    }

    // Find failed scopes
    const failedScopes = scopeTraces.filter(t => !t.result.success);
    if (failedScopes.length > 0) {
      console.log(`\n   ❌ ${failedScopes.length} scope(s) FAILED to resolve:`);
      failedScopes.forEach(t => {
        console.log(`      - ${t.scope}`);
        console.log(`        Error: ${t.result.error || 'Unknown'}`);
        console.log(
          `        💡 Implement custom scope resolver for this scope`
        );
        console.log(
          `        💡 Check if scope is registered in test environment`
        );
      });
    }

    // Find slow scopes
    const slowScopes = scopeTraces.filter(t => t.duration > 100);
    if (slowScopes.length > 0) {
      console.log(
        `\n   ⏱️  ${slowScopes.length} scope(s) were slow (>100ms):`
      );
      slowScopes.forEach(t => {
        console.log(`      - ${t.scope}: ${t.duration}ms`);
      });
    }

    // General suggestions
    console.log(`\n   📖 GENERAL DEBUGGING STEPS:`);
    console.log(`      1. Check action file exists: data/mods/.../actions/`);
    console.log(`      2. Verify action ID matches: '${expectedActionId}'`);
    console.log(`      3. Check required_components on actor/targets`);
    console.log(`      4. Verify prerequisite conditions are met`);
    console.log(
      `      5. Enable MODTESTROB-001 validation to catch action definition errors`
    );
  }

  /**
   * Print scope resolution statistics
   */
  _printScopeStatistics() {
    const scopeTraces = this.trace.filter(t => t.type === 'scope_resolution');

    if (scopeTraces.length === 0) {
      console.log('   No scope resolutions traced');
      return;
    }

    const stats = {
      total: scopeTraces.length,
      successful: scopeTraces.filter(t => t.result.success).length,
      failed: scopeTraces.filter(t => !t.result.success).length,
      empty: scopeTraces.filter(
        t => t.result.success && t.result.count === 0
      ).length,
      nonEmpty: scopeTraces.filter(
        t => t.result.success && t.result.count > 0
      ).length,
      avgDuration:
        scopeTraces.reduce((sum, t) => sum + t.duration, 0) /
        scopeTraces.length,
    };

    console.log(`   Total resolutions: ${stats.total}`);
    console.log(`   Successful: ${stats.successful} ✅`);
    console.log(`   Failed: ${stats.failed} ❌`);
    console.log(
      `   Empty results: ${stats.empty} ${stats.empty > 0 ? '⚠️' : ''}`
    );
    console.log(`   Non-empty results: ${stats.nonEmpty}`);
    console.log(`   Average resolution time: ${stats.avgDuration.toFixed(2)}ms`);
  }

  /**
   * Get trace data for programmatic analysis
   */
  getTrace() {
    return [...this.trace];
  }

  /**
   * Clear trace data
   */
  clearTrace() {
    this.trace = [];
  }
}
```

**Validation**:
```bash
# Verify file created
test -f tests/common/mods/discoveryDiagnostics.js && echo "✓ File created"
```

### Step 2: Add Diagnostic Method to ModTestFixture

**File to modify**: `tests/common/mods/ModTestFixture.js`

**Changes**:
```javascript
// Add import at top
import { DiscoveryDiagnostics } from './discoveryDiagnostics.js';

// Add to class
class ModTestFixture {
  constructor(...) {
    // ... existing code ...
    this.diagnostics = null; // Will be created on demand
  }

  /**
   * Enable diagnostic mode for action discovery debugging
   * @returns {DiscoveryDiagnostics} Diagnostics instance
   */
  enableDiagnostics() {
    if (!this.diagnostics) {
      this.diagnostics = new DiscoveryDiagnostics(this.testEnv);
    }
    this.diagnostics.enableDiagnostics();
    return this.diagnostics;
  }

  /**
   * Disable diagnostic mode
   */
  disableDiagnostics() {
    if (this.diagnostics) {
      this.diagnostics.disableDiagnostics();
    }
  }

  /**
   * Discover actions with full diagnostic output
   * Useful for debugging why an action doesn't appear
   * @param {string} actorId - Actor to discover for
   * @param {string} [expectedActionId] - Optional action to look for
   * @returns {Array} Discovered actions
   */
  discoverWithDiagnostics(actorId, expectedActionId = null) {
    const diag = this.enableDiagnostics();
    return diag.discoverWithDiagnostics(actorId, expectedActionId);
  }

  // Update cleanup to disable diagnostics
  cleanup() {
    this.disableDiagnostics();
    // ... existing cleanup code ...
  }
}
```

**Validation**:
```bash
# Check methods added
grep -q "enableDiagnostics" tests/common/mods/ModTestFixture.js && echo "✓ Diagnostics methods added"
grep -q "discoverWithDiagnostics" tests/common/mods/ModTestFixture.js && echo "✓ Diagnostic discovery added"
```

### Step 3: Create Unit Tests

**File to create**: `tests/unit/common/mods/discoveryDiagnostics.test.js`

**Implementation**:
```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { DiscoveryDiagnostics } from '../../../common/mods/discoveryDiagnostics.js';

describe('DiscoveryDiagnostics - Trace Collection', () => {
  let mockTestEnv;
  let diagnostics;

  beforeEach(() => {
    mockTestEnv = {
      unifiedScopeResolver: {
        resolveSync: jest.fn((scopeName, context) => ({
          success: true,
          value: new Set(['entity1']),
        })),
      },
      getAvailableActions: jest.fn(() => [
        { id: 'test:action1' },
        { id: 'test:action2' },
      ]),
    };

    diagnostics = new DiscoveryDiagnostics(mockTestEnv);
  });

  it('should enable and disable diagnostics', () => {
    const original =
      mockTestEnv.unifiedScopeResolver.resolveSync;

    diagnostics.enableDiagnostics();
    expect(
      mockTestEnv.unifiedScopeResolver.resolveSync
    ).not.toBe(original);

    diagnostics.disableDiagnostics();
    expect(
      mockTestEnv.unifiedScopeResolver.resolveSync
    ).toBe(original);
  });

  it('should collect trace data during scope resolution', () => {
    diagnostics.enableDiagnostics();

    mockTestEnv.unifiedScopeResolver.resolveSync('test:scope', {
      actor: { id: 'actor1' },
    });

    const trace = diagnostics.getTrace();
    expect(trace).toHaveLength(1);
    expect(trace[0]).toMatchObject({
      type: 'scope_resolution',
      scope: 'test:scope',
      context: { actorId: 'actor1' },
    });
  });

  it('should track empty scope results', () => {
    mockTestEnv.unifiedScopeResolver.resolveSync = jest.fn(() => ({
      success: true,
      value: new Set(), // Empty result
    }));

    diagnostics.enableDiagnostics();
    mockTestEnv.unifiedScopeResolver.resolveSync('test:empty_scope', {
      actor: { id: 'actor1' },
    });

    const trace = diagnostics.getTrace();
    expect(trace[0].result).toMatchObject({
      success: true,
      count: 0,
      entities: [],
    });
  });

  it('should track failed scope resolutions', () => {
    mockTestEnv.unifiedScopeResolver.resolveSync = jest.fn(() => ({
      success: false,
      error: 'Scope not found',
    }));

    diagnostics.enableDiagnostics();
    mockTestEnv.unifiedScopeResolver.resolveSync('test:failed_scope', {
      actor: { id: 'actor1' },
    });

    const trace = diagnostics.getTrace();
    expect(trace[0].result).toMatchObject({
      success: false,
      error: 'Scope not found',
    });
  });
});

describe('DiscoveryDiagnostics - Diagnostic Output', () => {
  it('should identify empty scopes in hints', () => {
    const consoleSpy = jest.spyOn(console, 'log');

    const mockTestEnv = {
      unifiedScopeResolver: {
        resolveSync: jest.fn(() => ({
          success: true,
          value: new Set(),
        })),
      },
      getAvailableActions: jest.fn(() => []),
    };

    const diagnostics = new DiscoveryDiagnostics(mockTestEnv);
    diagnostics.enableDiagnostics();

    diagnostics.discoverWithDiagnostics(
      'actor1',
      'test:missing_action'
    );

    // Verify debugging hints were printed
    const output = consoleSpy.mock.calls
      .map(call => call.join(' '))
      .join('\n');

    expect(output).toContain('returned empty results');
    expect(output).toContain('Check if entities have required components');

    consoleSpy.mockRestore();
  });
});
```

**Validation**:
```bash
# Run tests
npm run test:unit -- tests/unit/common/mods/discoveryDiagnostics.test.js

# Expected: All tests pass
```

### Step 4: Create Integration Test with Real Action Discovery

**File to create**: `tests/integration/common/mods/discoveryDiagnosticsIntegration.test.js`

**Implementation**:
```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';

describe('Discovery Diagnostics Integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:sit_down',
      null,
      null
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should provide diagnostics when action is found', async () => {
    const consoleSpy = jest.spyOn(console, 'log');

    const room = new ModEntityBuilder('room1')
      .asRoom('Test Room')
      .build();
    const actor = new ModEntityBuilder('actor1')
      .withName('Alice')
      .atLocation('room1')
      .asActor()
      .build();

    testFixture.reset([room, actor]);

    const actions = testFixture.discoverWithDiagnostics(
      'actor1',
      'positioning:sit_down'
    );

    // Verify diagnostic output
    const output = consoleSpy.mock.calls
      .map(call => call.join(' '))
      .join('\n');

    expect(output).toContain('ACTION DISCOVERY DIAGNOSTICS');
    expect(output).toContain('sit_down');
    expect(output).toContain('WAS FOUND');

    expect(actions.some(a => a.id === 'positioning:sit_down')).toBe(
      true
    );

    consoleSpy.mockRestore();
  });

  it('should provide hints when action is missing', async () => {
    const consoleSpy = jest.spyOn(console, 'log');

    const room = new ModEntityBuilder('room1')
      .asRoom('Test Room')
      .build();
    const actor = new ModEntityBuilder('actor1')
      .withName('Alice')
      .atLocation('room1')
      .asActor()
      .build();

    testFixture.reset([room, actor]);

    // Look for action that requires sitting_on component (not present)
    const actions = testFixture.discoverWithDiagnostics(
      'actor1',
      'positioning:stand_up'
    );

    const output = consoleSpy.mock.calls
      .map(call => call.join(' '))
      .join('\n');

    expect(output).toContain('WAS NOT FOUND');
    expect(output).toContain('DEBUGGING HINTS');

    consoleSpy.mockRestore();
  });

  it('should track scope resolution statistics', async () => {
    const consoleSpy = jest.spyOn(console, 'log');

    const room = new ModEntityBuilder('room1')
      .asRoom('Test Room')
      .build();
    const actor = new ModEntityBuilder('actor1')
      .withName('Alice')
      .atLocation('room1')
      .asActor()
      .build();

    testFixture.reset([room, actor]);

    testFixture.discoverWithDiagnostics('actor1');

    const output = consoleSpy.mock.calls
      .map(call => call.join(' '))
      .join('\n');

    expect(output).toContain('SCOPE RESOLUTION STATISTICS');
    expect(output).toContain('Total resolutions');
    expect(output).toContain('Average resolution time');

    consoleSpy.mockRestore();
  });
});
```

**Validation**:
```bash
# Run integration test
npm run test:integration -- tests/integration/common/mods/discoveryDiagnosticsIntegration.test.js

# Expected: Tests demonstrate diagnostic output
```

### Step 5: Update Existing Test as Example

**File to modify**: `tests/integration/mods/positioning/scoot_closer_action_discovery.test.js`

**Add example usage** (commented out by default):
```javascript
it('should discover scoot_closer when actor can move closer', async () => {
  // Setup entities...
  testFixture.reset([room, furniture, occupant1, actor]);

  // OPTIONAL: Enable diagnostics for debugging
  // Uncomment to see detailed discovery trace:
  // const actions = testFixture.discoverWithDiagnostics('actor1', 'positioning:scoot_closer');

  const actions = await testFixture.discoverActions('actor1');
  const scootAction = actions.find(a => a.id === 'positioning:scoot_closer');
  expect(scootAction).toBeDefined();
});
```

## Validation Criteria

### Functionality Checklist

- [ ] discoveryDiagnostics.js created with full tracing
- [ ] ModTestFixture.js has diagnostic methods
- [ ] Unit tests pass with 100% coverage
- [ ] Integration tests demonstrate real diagnostics
- [ ] Scope resolution tracing works
- [ ] Empty scope detection and hints work
- [ ] Failed scope detection and hints work
- [ ] Statistics reporting works
- [ ] Example usage added to existing test

### Quality Standards

```bash
# All tests pass
npm run test:unit -- tests/unit/common/mods/discoveryDiagnostics.test.js
npm run test:integration -- tests/integration/common/mods/discoveryDiagnosticsIntegration.test.js

# No linting issues
npx eslint tests/common/mods/discoveryDiagnostics.js

# Existing tests still pass
npm run test:integration -- tests/integration/mods/positioning/
```

## Files Created/Modified

### New Files
```
tests/common/mods/discoveryDiagnostics.js                           (diagnostic utility)
tests/unit/common/mods/discoveryDiagnostics.test.js                (unit tests)
tests/integration/common/mods/discoveryDiagnosticsIntegration.test.js (integration tests)
```

### Modified Files
```
tests/common/mods/ModTestFixture.js                                  (add diagnostic methods)
tests/integration/mods/positioning/scoot_closer_action_discovery.test.js (add example usage - commented)
```

## Testing

### Manual Testing

**Test 1: Enable diagnostics for failing test**

Create temporary test that should fail to discover an action:
```javascript
it('diagnostic demo - missing component', async () => {
  const room = new ModEntityBuilder('room1').asRoom('Test').build();
  const actor = new ModEntityBuilder('actor1')
    .withName('Alice')
    .atLocation('room1')
    .asActor()
    // Missing positioning:sitting_on component
    .build();

  testFixture.reset([room, actor]);

  // Should show diagnostic output explaining why stand_up not found
  const actions = testFixture.discoverWithDiagnostics(
    'actor1',
    'positioning:stand_up'
  );
  // Action won't be found, but diagnostics will explain why
});
```

**Run and verify output shows:**
- Scope resolution attempts
- Empty results with hints
- Clear debugging suggestions

**Test 2: Verify performance impact is minimal**

```bash
# Benchmark discovery without diagnostics
time npm run test:integration -- tests/integration/mods/positioning/sit_down_action_discovery.test.js

# Benchmark with diagnostics enabled
# (modify test temporarily to enable)
time npm run test:integration -- tests/integration/mods/positioning/sit_down_action_discovery.test.js

# Expected: <5% performance difference
```

## Rollback Plan

If diagnostics cause issues:

```bash
# Revert ModTestFixture changes
git checkout HEAD -- tests/common/mods/ModTestFixture.js

# Keep diagnostic module for future use
# git rm tests/common/mods/discoveryDiagnostics.js
```

## Commit Strategy

**Single atomic commit**:
```bash
git add tests/common/mods/discoveryDiagnostics.js
git add tests/common/mods/ModTestFixture.js
git add tests/unit/common/mods/discoveryDiagnostics.test.js
git add tests/integration/common/mods/discoveryDiagnosticsIntegration.test.js
git add tests/integration/mods/positioning/scoot_closer_action_discovery.test.js

git commit -m "MODTESTROB-002: Implement discovery diagnostic mode

- Add DiscoveryDiagnostics class with full pipeline tracing
- Trace scope resolutions with context and results
- Provide actionable debugging hints for:
  - Empty scope results
  - Failed scope resolutions
  - Missing components
  - General troubleshooting steps
- Add enableDiagnostics() and discoverWithDiagnostics() to ModTestFixture
- Add comprehensive unit and integration tests
- Add commented example usage to existing test
- Zero performance impact when disabled

Impact:
- Complete visibility into discovery pipeline
- 80% reduction in 'why isn't this showing up?' debugging time
- Clear, actionable hints for common issues
- Statistics for performance analysis

Resolves MODTESTROB-002 (Phase 1 - P0 Priority)
"
```

## Success Criteria

Implementation is successful when:
- ✅ Diagnostic mode can be enabled/disabled easily
- ✅ Scope resolutions are traced with full context
- ✅ Empty results trigger helpful hints
- ✅ Failed resolutions are clearly identified
- ✅ Statistics provide performance insights
- ✅ Integration with ModTestFixture is seamless
- ✅ Zero performance impact when disabled
- ✅ Clear, actionable debugging suggestions

## Expected Impact

### Quantitative
- **80% reduction** in discovery debugging time
- **Complete visibility** into 100% of discovery steps
- **5-10 minutes saved** per discovery issue
- **<5% performance overhead** when enabled

### Qualitative
- Developers immediately see why actions don't appear
- Clear path from problem to solution
- Reduced frustration from "black box" discovery
- Faster test development and debugging

## Next Steps

After this ticket is complete:
1. Verify all tests pass with diagnostics
2. Test diagnostic output is clear and helpful
3. Create clean commit as specified
4. Proceed to **MODTESTROB-003** (Enhanced Error Messages)
5. Document diagnostic usage in MODTESTROB-008

---

**Dependencies**: None (Phase 1 ticket)
**Blocks**: MODTESTROB-008 (needs diagnostic examples)
**Complements**: MODTESTROB-001 (validation catches definition errors, diagnostics catches discovery errors)
