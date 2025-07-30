# Multi-Target Action Secondary Resolution Analysis

## Executive Summary

This report analyzes a critical issue in the Living Narrative Engine's multi-target action system where secondary targets that depend on primary target context are not correctly resolved when multiple primary targets exist. The issue specifically affects actions like `adjust_clothing` that have a `contextFrom: "primary"` dependency.

**Key Finding**: The production code resolves secondary targets only once using the first primary target's context, rather than resolving secondary targets independently for each primary target.

## Table of Contents
1. [Issue Identification](#issue-identification)
2. [Technical Analysis](#technical-analysis)
3. [Code Flow Analysis](#code-flow-analysis)
4. [Root Cause Analysis](#root-cause-analysis)
5. [Test Suite Design](#test-suite-design)
6. [Solution Approach](#solution-approach)
7. [Impact Assessment](#impact-assessment)
8. [Recommendations](#recommendations)

## Issue Identification

### Problem Statement
When an action has:
- Multiple valid primary targets (e.g., multiple actors in closeness)
- A secondary target that depends on the primary target's context (`contextFrom: "primary"`)
- Different secondary targets for each primary (e.g., different clothing items per actor)

The current implementation fails to resolve the correct secondary targets for each primary target.

### Example Scenario
Consider the `adjust_clothing` action with:
- **Primary scope**: `close_actors_facing_each_other_with_torso_clothing`
- **Secondary scope**: `target_topmost_torso_upper_clothing` with `contextFrom: "primary"`

Given:
- Actor 1: Elara Thorn wearing a blazer
- Actor 2: Joel Overbeck wearing a trenchcoat

Expected output:
- Action 1: "adjust Elara Thorn's blazer"
- Action 2: "adjust Joel Overbeck's trenchcoat"

Actual output:
- Action 1: "adjust Elara Thorn's blazer"
- Action 2: "adjust Joel Overbeck's blazer" (INCORRECT - uses Elara's clothing)

## Technical Analysis

### Action Definition Structure
```json
{
  "id": "intimacy:adjust_clothing",
  "targets": {
    "primary": {
      "scope": "intimacy:close_actors_facing_each_other_with_torso_clothing",
      "placeholder": "primary"
    },
    "secondary": {
      "scope": "intimacy:target_topmost_torso_upper_clothing",
      "placeholder": "secondary",
      "contextFrom": "primary"
    }
  },
  "template": "adjust {primary}'s {secondary}"
}
```

### Scope Definitions
1. **Primary Scope**: Filters actors based on closeness, facing direction, and clothing presence
2. **Secondary Scope**: Accesses `target.topmost_clothing.torso_upper` where `target` should be each primary target

## Code Flow Analysis

### 1. Action Discovery Flow
```
ActionDiscoveryService.getValidActions()
  → ActionPipelineOrchestrator.discoverActions()
    → Pipeline stages:
      1. ComponentFilteringStage
      2. PrerequisiteEvaluationStage
      3. MultiTargetResolutionStage ← Issue occurs here
      4. ActionFormattingStage
```

### 2. MultiTargetResolutionStage Implementation

The critical code section in `MultiTargetResolutionStage.js`:

```javascript
// Lines 319-391: Target resolution loop
for (const targetKey of resolutionOrder) {
  const targetDef = targetDefs[targetKey];
  
  // Build scope context
  const scopeContext = this.#buildScopeContext(
    actor,
    actionContext,
    resolvedTargets,  // Previously resolved targets
    targetDef,
    trace
  );
  
  // Resolve scope
  const candidates = await this.#resolveScope(
    targetDef.scope,
    scopeContext,
    trace
  );
  
  // Store resolved targets
  resolvedTargets[targetKey] = candidates.map(/* ... */);
}
```

### 3. Context Building Issue

The `TargetContextBuilder.buildDependentContext()` method (lines 77-104):

```javascript
buildDependentContext(baseContext, resolvedTargets, targetDef) {
  const context = { ...baseContext };
  
  // Add all resolved targets
  context.targets = { ...resolvedTargets };
  
  // Add specific target if contextFrom is specified
  if (targetDef.contextFrom && resolvedTargets[targetDef.contextFrom]) {
    const primaryTargets = resolvedTargets[targetDef.contextFrom];
    if (Array.isArray(primaryTargets) && primaryTargets.length > 0) {
      // ISSUE: Only uses the FIRST primary target
      context.target = this.#buildEntityContext(primaryTargets[0].id);
    }
  }
  
  return context;
}
```

## Root Cause Analysis

### The Core Problem

1. **Single Context Resolution**: The `buildDependentContext` method creates only one context using the first primary target (`primaryTargets[0]`), regardless of how many primary targets exist.

2. **Single Secondary Resolution**: The secondary scope is resolved only once with this single context, producing one set of secondary targets that gets associated with ALL primary targets.

3. **Formatting Stage Limitation**: The `MultiTargetActionFormatter` receives the pre-resolved targets and has no ability to re-resolve secondary targets per primary target.

### Why This Happens

The current architecture assumes that secondary targets are either:
- Independent of primary targets (no `contextFrom`)
- Uniform across all primary targets

It doesn't handle the case where each primary target needs its own secondary target resolution.

## Test Suite Design

### Comprehensive Test Case: Multiple Actors with Different Clothing

```javascript
describe('Multi-target action with contextFrom dependency - multiple actors', () => {
  it('should resolve different secondary targets for each primary target', async () => {
    // Arrange
    // Create first actor with blazer
    entityManager.addComponent('elara', 'core:name', { value: 'Elara Thorn' });
    entityManager.addComponent('elara', 'intimacy:closeness', {
      partners: ['actor1'],
      facing_away_from: []
    });
    entityManager.addComponent('elara', 'clothing:equipment', {
      equipped: { torso_upper: { base: 'blazer123' } }
    });
    entityManager.addComponent('blazer123', 'core:name', { name: 'silk blazer' });
    
    // Create second actor with trenchcoat
    entityManager.addComponent('joel', 'core:name', { value: 'Joel Overbeck' });
    entityManager.addComponent('joel', 'intimacy:closeness', {
      partners: ['actor1'],
      facing_away_from: []
    });
    entityManager.addComponent('joel', 'clothing:equipment', {
      equipped: { torso_upper: { base: 'trenchcoat456' } }
    });
    entityManager.addComponent('trenchcoat456', 'core:name', { name: 'leather trenchcoat' });
    
    // Create the acting entity with closeness to both
    entityManager.addComponent('actor1', 'intimacy:closeness', {
      partners: ['elara', 'joel'],
      facing_away_from: []
    });
    
    // Act
    const actor = entityManager.getEntityInstance('actor1');
    const result = await actionDiscoveryService.getValidActions(actor, {});
    
    // Assert
    const adjustClothingActions = result.actions.filter(
      action => action.id === 'intimacy:adjust_clothing'
    );
    
    // Should have one multi-target action
    expect(adjustClothingActions).toHaveLength(1);
    expect(adjustClothingActions[0].params.isMultiTarget).toBe(true);
    
    // Should have both primary targets
    expect(adjustClothingActions[0].params.targetIds.primary).toEqual(['elara', 'joel']);
    
    // CRITICAL TEST: Secondary targets should be different for each primary
    expect(adjustClothingActions[0].params.targetIds.secondary).toEqual(['blazer123', 'trenchcoat456']);
    
    // Commands should be distinct
    const commands = adjustClothingActions[0].command;
    expect(Array.isArray(commands)).toBe(true);
    expect(commands).toHaveLength(2);
    expect(commands[0]).toBe("adjust Elara Thorn's silk blazer");
    expect(commands[1]).toBe("adjust Joel Overbeck's leather trenchcoat");
  });
});
```

### Additional Test Cases

1. **Empty Secondary for Some Primaries**
   - Test when some primary targets have no valid secondary targets
   - Ensure action is still generated for primaries with valid secondaries

2. **Complex Dependency Chains**
   - Test with tertiary targets that depend on secondary targets
   - Verify proper context propagation through the chain

3. **Performance Test**
   - Test with many primary targets (e.g., 10+ actors)
   - Ensure reasonable performance with cartesian product generation

## Solution Approach

### High-Level Solution

1. **Modify Target Resolution Strategy**
   - Resolve secondary targets individually for each primary target
   - Store secondary targets as arrays indexed by primary target

2. **Update Data Structures**
   ```javascript
   // Current structure
   resolvedTargets = {
     primary: [target1, target2],
     secondary: [secondaryForTarget1]  // Wrong!
   }
   
   // Proposed structure
   resolvedTargets = {
     primary: [target1, target2],
     secondary: {
       byPrimary: {
         'target1': [secondaryForTarget1],
         'target2': [secondaryForTarget2]
       }
     }
   }
   ```

3. **Enhance MultiTargetResolutionStage**
   - Detect when a target has `contextFrom` dependency
   - Loop through each resolved primary target
   - Build context specific to each primary
   - Resolve secondary targets per primary

4. **Update Formatter**
   - Handle the new data structure
   - Generate proper combinations respecting dependencies

### Implementation Sketch

```javascript
// In MultiTargetResolutionStage
async #resolveMultiTargets(context, trace) {
  // ... existing code ...
  
  for (const targetKey of resolutionOrder) {
    const targetDef = targetDefs[targetKey];
    
    if (targetDef.contextFrom && resolvedTargets[targetDef.contextFrom]) {
      // New: Resolve per primary target
      const primaryTargets = resolvedTargets[targetDef.contextFrom];
      const secondaryByPrimary = {};
      
      for (const primaryTarget of primaryTargets) {
        const scopeContext = this.#buildScopeContextForSpecificPrimary(
          actor, actionContext, primaryTarget, targetDef
        );
        
        const candidates = await this.#resolveScope(
          targetDef.scope, scopeContext, trace
        );
        
        secondaryByPrimary[primaryTarget.id] = candidates;
      }
      
      resolvedTargets[targetKey] = { byPrimary: secondaryByPrimary };
    } else {
      // Existing logic for independent targets
      // ...
    }
  }
}
```

## Impact Assessment

### Affected Components
1. `MultiTargetResolutionStage` - Core changes needed
2. `TargetContextBuilder` - New method for specific primary context
3. `MultiTargetActionFormatter` - Handle new data structure
4. `ActionFormattingStage` - Pass correct data to formatter

### Backward Compatibility
- Need to maintain support for actions without `contextFrom`
- Existing single-target actions must continue working
- Consider migration path for existing save games

### Performance Implications
- Additional scope resolutions (N primaries × M scope evaluations)
- Larger memory footprint for resolved targets
- May need optimization for large target sets

## Recommendations

### Immediate Actions
1. **Create failing test** - Implement the comprehensive test case above to prove the issue
2. **Document the limitation** - Update action system documentation
3. **Workaround guidance** - Provide modders with temporary solutions

### Short-term Solution
1. **Implement the fix** in `MultiTargetResolutionStage`
2. **Update formatters** to handle new structure
3. **Add comprehensive tests** for various scenarios
4. **Performance testing** with realistic data sets

### Long-term Considerations
1. **Optimize scope resolution** - Cache results where possible
2. **Lazy evaluation** - Resolve secondary targets only when needed
3. **Configurable strategies** - Allow actions to specify resolution behavior
4. **Better error handling** - Clear messages when resolution fails

### Testing Strategy
1. **Unit tests** for each modified component
2. **Integration tests** for complete action flow
3. **Performance benchmarks** for large target sets
4. **Regression tests** for existing functionality

## Conclusion

The current implementation has a fundamental limitation in handling secondary targets that depend on primary target context. This affects any action where the secondary target varies based on which primary target is being considered.

The proposed solution maintains backward compatibility while properly supporting context-dependent secondary targets. Implementation will require careful coordination across multiple components but will significantly enhance the flexibility of the action system.

This issue is particularly important for immersive gameplay mechanics where actions need to respect the specific relationships and states between entities, such as the clothing adjustment example or similar context-sensitive interactions.