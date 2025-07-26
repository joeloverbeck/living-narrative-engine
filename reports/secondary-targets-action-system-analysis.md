# Secondary Targets in Action System - Comprehensive Analysis Report

## Executive Summary

This report analyzes the Living Narrative Engine's current action system and identifies what modifications are needed to support secondary targets in action templates (e.g., `adjust {target}'s {secondary_target}`). The current system only supports single target resolution, which limits the expressiveness of actions that naturally involve multiple targets.

## Current System Architecture

### Action Processing Flow

1. **Action Discovery** (`actionPipelineOrchestrator.js`)
   - ComponentFilteringStage: Filters actions based on required/forbidden components
   - PrerequisiteEvaluationStage: Evaluates action prerequisites
   - TargetResolutionStage: Resolves the scope to find valid targets
   - ActionFormattingStage: Formats the action template with resolved target

2. **Action Dispatch** (`commandProcessor.js`)
   - Creates payload with: `actorId`, `actionId`, `targetId`, `originalInput`
   - Dispatches `core:attempt_action` event
   - Rules handle the event and execute game logic

3. **Current Limitations**
   - Actions can only have ONE target resolved through the `scope` property
   - The template system only supports `{target}` placeholder
   - The `core:attempt_action` event payload only includes a single `targetId`
   - Target resolution happens once during action discovery, not during rule execution

### Example: Current "adjust_clothing" Action

```json
{
  "id": "intimacy:adjust_clothing",
  "scope": "intimacy:close_actors_facing_each_other_with_torso_clothing",
  "template": "adjust {target}'s clothing"
}
```

The scope resolves to character entities who have clothing, but the actual clothing item to adjust is determined later in the rule through complex logic. This creates a disconnect between what the player sees ("adjust X's clothing") and what actually happens (adjusting a specific garment).

## What the System Lacks for Secondary Targets

### 1. Action Definition Schema

- No way to define multiple scopes (primary and secondary)
- No way to specify dependencies between scopes
- Template system only recognizes `{target}` placeholder

### 2. Target Resolution System

- `TargetResolutionStage` only resolves one scope per action
- No mechanism for dependent scope resolution (where secondary depends on primary)
- `ActionTargetContext` only handles single target contexts

### 3. Action Formatting

- `targetFormatters.js` only has formatters for single targets
- No support for multiple placeholder substitution
- No way to format actions with multiple resolved entities

### 4. Event Payload Structure

- `core:attempt_action` payload only includes single `targetId`
- No standard way to pass multiple targets to rules

### 5. Rule Processing

- Rules expect single target and must derive secondary targets through operations
- No standard pattern for multi-target actions

## Proposed Solution: Multi-Target Action System

### 1. Context-Based Secondary Scope Approach (Recommended)

The most elegant solution aligns with the existing scope DSL system by creating scope files that can receive resolved targets in their context:

#### Secondary Scope File Example

```
// File: clothing/scopes/target_topmost_clothing.scope
// This scope receives the primary target in context
target_topmost_clothing := target.topmost_clothing[]
target_torso_upper_clothing := target.topmost_clothing.torso_upper
target_throwable_items := target.core:inventory.items[][{"==": [{"var": "entity.components.core:item.tags"}, "throwable"]}]
```

#### Enhanced Action Schema

```json
{
  "$schema": "...",
  "id": "intimacy:adjust_clothing",
  "name": "Adjust Clothing",
  "targets": {
    "primary": {
      "scope": "intimacy:close_actors_facing_each_other",
      "placeholder": "target",
      "description": "The person whose clothing to adjust"
    },
    "secondary": {
      "scope": "clothing:target_torso_upper_clothing",
      "placeholder": "garment",
      "description": "The specific clothing item to adjust",
      "contextFrom": "primary"  // Passes primary target as 'target' in scope context
    }
  },
  "template": "adjust {target}'s {garment}",
  "prerequisites": [...]
}
```

### 2. Multi-Target Resolution Pipeline

```javascript
// New MultiTargetResolutionStage
class MultiTargetResolutionStage extends PipelineStage {
  async executeInternal(context) {
    const { actionDef, actor, actionContext } = context;

    // Resolve targets in dependency order
    const resolvedTargets = {};

    // 1. Resolve independent targets first
    for (const [key, targetDef] of Object.entries(actionDef.targets)) {
      if (!targetDef.dependsOn) {
        resolvedTargets[key] = await this.resolveTarget(
          targetDef.scope,
          actor,
          actionContext
        );
      }
    }

    // 2. Resolve dependent targets
    for (const [key, targetDef] of Object.entries(actionDef.targets)) {
      if (targetDef.dependsOn) {
        // Substitute resolved values in scope
        const scope = this.substituteDependencies(
          targetDef.scope,
          resolvedTargets
        );
        resolvedTargets[key] = await this.resolveTarget(
          scope,
          actor,
          actionContext,
          resolvedTargets
        );
      }
    }

    return resolvedTargets;
  }
}
```

### 3. Multi-Action Generation from Target Combinations

A critical aspect of multi-target actions is generating all valid combinations as separate action candidates. This is essential for actions like "throw {item} at {target}".

#### Example: Throw Action

```json
{
  "id": "combat:throw",
  "name": "Throw Item",
  "targets": {
    "primary": {
      "scope": "actor:throwable_items", // knife, grenade
      "placeholder": "item",
      "description": "The item to throw"
    },
    "secondary": {
      "scope": "combat:valid_throw_targets", // goblin, wolf
      "placeholder": "target",
      "description": "The target to throw at"
    }
  },
  "template": "throw {item} at {target}",
  "generateCombinations": true // Enables cartesian product generation
}
```

#### Generated Actions

Given:

- Primary targets: [knife, grenade]
- Secondary targets: [goblin, wolf]

The system generates 4 action candidates:

1. "throw knife at goblin"
2. "throw knife at wolf"
3. "throw grenade at goblin"
4. "throw grenade at wolf"

#### Implementation in ActionFormattingStage

```javascript
// Enhanced action formatting for multi-target combinations
if (
  actionDef.generateCombinations &&
  resolvedTargets.primary &&
  resolvedTargets.secondary
) {
  const combinations = [];

  for (const primaryTarget of resolvedTargets.primary) {
    for (const secondaryTarget of resolvedTargets.secondary) {
      combinations.push({
        actionId: actionDef.id,
        targets: {
          primary: primaryTarget,
          secondary: secondaryTarget,
        },
        formattedText: formatMultiTargetAction(
          actionDef.template,
          { primary: primaryTarget, secondary: secondaryTarget },
          entityManager
        ),
      });
    }
  }

  return combinations;
}
```

### 4. Enhanced Formatting System

```javascript
// Enhanced formatActionCommand
function formatMultiTargetAction(template, resolvedTargets, entityManager) {
  let formatted = template;

  for (const [key, targetDef] of Object.entries(resolvedTargets)) {
    const placeholder = `{${targetDef.placeholder}}`;
    const targetName = getTargetDisplayName(
      targetDef.resolvedEntity,
      entityManager
    );
    formatted = formatted.replace(placeholder, targetName);
  }

  return formatted;
}
```

### 4. Extended Event Payload

```javascript
// Enhanced attempt_action payload
{
  eventName: "core:attempt_action",
  actorId: "actor_123",
  actionId: "intimacy:adjust_clothing",
  targets: {
    primary: "character_456",
    secondary: "shirt_789"
  },
  // Backward compatibility
  targetId: "character_456"
}
```

## Alternative Approaches

### Option A: Scoped Context Variables

Enhance the scope DSL to support context variables that can be referenced in dependent scopes:

```
// Define reusable context-aware scopes
throwable_items_in_inventory := actor.core:inventory.items[][{"in": ["throwable", {"var": "entity.components.core:item.tags"}]}]
hostile_entities_in_range := entities(core:actor)[][{
  "and": [
    {"condition_ref": "core:entity-at-location"},
    {"condition_ref": "combat:is-hostile-to-actor"},
    {"condition_ref": "combat:within-throwing-range"}
  ]
}]
```

### Option B: Pipeline-Based Target Resolution

Implement a pipeline where each stage can access previous resolutions:

```json
{
  "id": "combat:throw",
  "targetPipeline": [
    {
      "name": "item",
      "scope": "actor:throwable_items",
      "placeholder": "item"
    },
    {
      "name": "target",
      "scope": "combat:entities_within_item_range",
      "placeholder": "target",
      "contextVars": ["item"] // Can use {item} in scope resolution
    }
  ],
  "template": "throw {item} at {target}"
}
```

### Option C: Dynamic Scope Generation

Allow scopes to be generated dynamically based on primary target properties:

```javascript
// In scope resolver
if (scopeDef.dynamic) {
  const primaryTarget = context.resolvedTargets.primary;
  const dynamicScope = scopeDef.generator(primaryTarget, context);
  return resolveScope(dynamicScope, context);
}
```

## Files Requiring Modification

### Core Schema Changes

1. `/data/schemas/action.schema.json` - Add multi-target support
2. `/data/schemas/common.schema.json` - Add target definition schema

### Action Processing Pipeline

3. `/src/actions/pipeline/stages/TargetResolutionStage.js` - Handle multiple targets
4. `/src/actions/pipeline/stages/ActionFormattingStage.js` - Format multiple placeholders
5. `/src/actions/actionFormatter.js` - Support multi-target formatting
6. `/src/actions/formatters/targetFormatters.js` - Add formatters for multi-target

### Data Structures

7. `/src/models/actionTargetContext.js` - Extend for multiple targets
8. `/src/actions/targetResolutionService.js` - Resolve dependent scopes

### Event System

9. `/src/commands/commandProcessor.js` - Create multi-target payloads
10. `/src/constants/eventIds.js` - Consider new event types

### New Files

11. `/src/actions/pipeline/stages/MultiTargetResolutionStage.js` - New stage
12. `/src/actions/multiTargetResolver.js` - Dependency resolution logic
13. `/src/actions/formatters/multiTargetFormatter.js` - Multi-target formatting

## Practical Examples

### Example 1: Throw Action with Multiple Targets

```json
// Action definition
{
  "id": "combat:throw",
  "name": "Throw Item",
  "targets": {
    "primary": {
      "scope": "combat:throwable_items",
      "placeholder": "item"
    },
    "secondary": {
      "scope": "combat:valid_targets",
      "placeholder": "target"
    }
  },
  "template": "throw {item} at {target}",
  "generateCombinations": true
}

// Scope definitions
throwable_items := actor.core:inventory.items[][{"in": ["throwable", {"var": "entity.components.core:item.tags"}]}]
valid_targets := entities(core:actor)[][{
  "and": [
    {"condition_ref": "core:entity-at-location"},
    {"!=": [{"var": "entity.id"}, {"var": "actor.id"}]}
  ]
}]
```

**Result**: If actor has knife and grenade, and location has goblin and wolf, generates:

- throw knife at goblin
- throw knife at wolf
- throw grenade at goblin
- throw grenade at wolf

### Example 2: Clothing Adjustment with Context

```json
// Action definition using context-based scopes
{
  "id": "intimacy:adjust_specific_clothing",
  "targets": {
    "primary": {
      "scope": "intimacy:close_actors_facing_each_other",
      "placeholder": "person"
    },
    "secondary": {
      "scope": "clothing:target_adjustable_garments",
      "placeholder": "garment",
      "contextFrom": "primary"
    }
  },
  "template": "adjust {person}'s {garment}"
}

// Context-aware scope
target_adjustable_garments := target.topmost_clothing[][{"in": ["adjustable", {"var": "entity.components.clothing:garment.properties"}]}]
```

## Implementation Recommendations

1. **Backward Compatibility**: Maintain support for single-target actions by treating them as a special case of multi-target actions.

2. **Progressive Enhancement**: Start with simple independent multi-targets before implementing dependent resolution.

3. **Validation First**: Add comprehensive validation for multi-target definitions before implementation.

4. **Modder Experience**: Provide clear examples and migration guides for existing actions.

5. **Performance Considerations**: Cache resolved targets when multiple actions use the same scope combinations.

6. **Context Propagation**: Ensure the scope resolution context properly includes resolved targets from previous stages.

## Conclusion

The current action system's single-target limitation prevents natural expression of many game mechanics. Implementing a multi-target system would enable:

- More intuitive action descriptions
- Complex interactions without rule gymnastics
- Better player understanding of action effects
- Reduced complexity in rule definitions
- Natural multi-action generation for combinatorial scenarios

The recommended approach is to implement the context-based secondary scope system, which:

1. Aligns perfectly with the existing scope DSL architecture
2. Allows secondary scopes to receive the primary target as context
3. Enables multi-action generation for actions with multiple valid target combinations
4. Maintains backward compatibility with single-target actions
5. Provides a clean, data-driven solution without hardcoded logic

This approach leverages the existing scope system's strengths while adding the minimal necessary enhancements to support multi-target scenarios.
