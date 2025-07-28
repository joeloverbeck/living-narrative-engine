# Action Schema Properties Analysis: `generateCombinations` and `contextFrom`

## Executive Summary

This report provides a comprehensive analysis of two key properties in the Living Narrative Engine's action schema system: `generateCombinations` and `contextFrom`. These properties enable sophisticated multi-target action handling, allowing actions to work with multiple entities in flexible ways. The `generateCombinations` property controls whether an action generates all possible combinations of targets (Cartesian product), while `contextFrom` enables dependent target resolution where secondary targets can be determined based on previously resolved targets.

## 1. Introduction: Action System Architecture

The Living Narrative Engine uses a sophisticated action system that processes player commands through several stages:

1. **Action Discovery**: Identifies available actions based on game state
2. **Target Resolution**: Resolves scopes to find valid targets for actions
3. **Action Formatting**: Formats action templates with resolved targets
4. **Command Generation**: Creates executable commands for the game engine

### Multi-Target Actions

The system supports multi-target actions where an action can involve multiple entities in different roles:

```json
{
  "targets": {
    "primary": { "scope": "...", "placeholder": "item" },
    "secondary": { "scope": "...", "placeholder": "target" },
    "tertiary": { "scope": "...", "placeholder": "focus" }
  }
}
```

## 2. The `generateCombinations` Property

### 2.1 Purpose and Definition

The `generateCombinations` property is a boolean flag that controls how multi-target actions are processed when multiple valid targets exist for each target definition.

```json
{
  "generateCombinations": {
    "type": "boolean",
    "default": false,
    "description": "Generate all target combinations as separate actions (cartesian product). Only applicable for multi-target actions."
  }
}
```

### 2.2 When `generateCombinations` is `true`

When set to `true`, the system generates the Cartesian product of all valid targets, creating multiple action instances for all possible combinations.

#### Example: Throw Action
```json
{
  "id": "combat:throw",
  "template": "throw {item} at {target}",
  "targets": {
    "primary": { "scope": "throwable_items", "placeholder": "item" },
    "secondary": { "scope": "valid_targets", "placeholder": "target" }
  },
  "generateCombinations": true
}
```

If the scope resolution finds:
- Primary targets: ["rock", "knife", "spear"]
- Secondary targets: ["goblin", "orc"]

The system generates 6 actions:
1. "throw rock at goblin"
2. "throw rock at orc"
3. "throw knife at goblin"
4. "throw knife at orc"
5. "throw spear at goblin"
6. "throw spear at orc"

#### Implementation Details (MultiTargetActionFormatter.js)

```javascript
#formatCombinations(actionDef, resolvedTargets, targetDefinitions, _options) {
  const combinations = this.#generateCombinations(resolvedTargets);
  const formattedCommands = [];

  for (const combination of combinations) {
    const result = this.#formatSingleMultiTarget(
      actionDef.template,
      combination,
      targetDefinitions,
      _options
    );
    if (result.ok) {
      formattedCommands.push(result.value);
    }
  }
  return { ok: true, value: formattedCommands };
}
```

The Cartesian product generation includes safeguards:
- Maximum 50 combinations to prevent UI overflow
- Maximum 10 items per dimension
- Early termination when limits are reached

### 2.3 When `generateCombinations` is `false` (Default)

When set to `false`, the system creates a single action using the first valid target from each target definition.

#### Example: Give Action
```json
{
  "id": "interaction:give",
  "template": "give {item} to {recipient}",
  "targets": {
    "primary": { "scope": "inventory_items", "placeholder": "item" },
    "secondary": { "scope": "nearby_characters", "placeholder": "recipient" }
  },
  "generateCombinations": false
}
```

If the scope resolution finds:
- Primary targets: ["gold", "sword", "potion"]
- Secondary targets: ["merchant", "guard"]

The system generates only ONE action: "give gold to merchant"

#### Implementation Details

```javascript
// Format single action with first target from each definition
#formatSingleMultiTarget(template, resolvedTargets, targetDefinitions, _options) {
  let formattedTemplate = template;
  
  for (const [targetKey, targets] of Object.entries(resolvedTargets)) {
    if (targets.length === 0) continue;
    
    const target = targets[0]; // Use first target
    const placeholder = targetDefinitions?.[targetKey]?.placeholder;
    
    const placeholderRegex = new RegExp(`\\{${placeholder}\\}`, 'g');
    formattedTemplate = formattedTemplate.replace(
      placeholderRegex,
      target.displayName || target.id
    );
  }
  
  return { ok: true, value: formattedTemplate };
}
```

### 2.4 Use Case Guidelines

**Use `generateCombinations: true` when:**
- Players should see all possible combinations
- Each combination represents a distinct, meaningful choice
- The number of combinations won't overwhelm the UI
- Examples: combat actions, crafting recipes

**Use `generateCombinations: false` when:**
- Only one combination makes sense at a time
- The action involves a specific sequence or dependency
- You want to reduce UI clutter
- Examples: contextual interactions, give/take actions

## 3. The `contextFrom` Property

### 3.1 Purpose and Definition

The `contextFrom` property enables dependent target resolution, where a secondary target's scope can access and use a previously resolved target as context.

```json
{
  "contextFrom": {
    "type": "string",
    "enum": ["primary"],
    "description": "Use another target as context for scope evaluation (currently only 'primary' supported)"
  }
}
```

### 3.2 How `contextFrom` Works

When a target definition includes `contextFrom`, the scope resolution process:

1. Resolves targets in dependency order (primary → secondary → tertiary)
2. Makes resolved targets available in the scope evaluation context
3. Allows scope DSL expressions to access properties of previous targets

#### Example: Unlock Container with Key
```json
{
  "id": "examples:unlock_container_with_key",
  "targets": {
    "primary": {
      "scope": "examples:locked_containers",
      "placeholder": "container"
    },
    "secondary": {
      "scope": "examples:keys",
      "placeholder": "key",
      "contextFrom": "primary"
    }
  }
}
```

### 3.3 Resolution Process

#### 1. Dependency Order Resolution (MultiTargetResolutionStage.js)

```javascript
#getResolutionOrder(targetDefs) {
  const order = [];
  const pending = new Set(Object.keys(targetDefs));
  
  while (pending.size > 0) {
    const ready = Array.from(pending).filter((key) => {
      const targetDef = targetDefs[key];
      if (!targetDef.contextFrom) return true;
      return order.includes(targetDef.contextFrom);
    });
    
    ready.forEach((key) => {
      order.push(key);
      pending.delete(key);
    });
  }
  
  return order; // e.g., ["primary", "secondary", "tertiary"]
}
```

#### 2. Context Building (targetContextBuilder.js)

```javascript
buildDependentContext(baseContext, resolvedTargets, targetDef) {
  const context = { ...baseContext };
  
  // Add all resolved targets
  context.targets = { ...resolvedTargets };
  
  // Add specific target if contextFrom is specified
  if (targetDef.contextFrom && resolvedTargets[targetDef.contextFrom]) {
    const primaryTargets = resolvedTargets[targetDef.contextFrom];
    if (Array.isArray(primaryTargets) && primaryTargets.length > 0) {
      context.target = this.#buildEntityContext(primaryTargets[0].id);
    }
  }
  
  return context;
}
```

### 3.4 Scope DSL Access

With `contextFrom: "primary"`, scope DSL expressions can access the primary target:

```
# File: examples/scopes/target_context.scope
# Access target's components
examples:target_name := target.components.core:actor.name
examples:target_location := target.components.core:position.locationId
examples:target_items := target.components.core:inventory.items[]

# Filter based on target properties
examples:keys_for_target := actor.components.core:inventory.items[][{
  "in": [
    { "var": "target.components.core:container.lock_type" },
    { "var": "entity.components.core:key.types" }
  ]
}]
```

### 3.5 Use Cases

**Common `contextFrom` patterns:**

1. **Lock and Key Matching**: Keys that can unlock a specific container
2. **Ammunition Selection**: Ammo that fits a selected weapon
3. **Spell Targeting**: Valid targets based on selected spell type
4. **Gift Giving**: Recipients who would accept the selected item
5. **Tool Usage**: Objects that can be affected by the selected tool

## 4. Integration Between Both Properties

### 4.1 Combined Behavior

When both properties are used together:

```json
{
  "targets": {
    "primary": { "scope": "weapons", "placeholder": "weapon" },
    "secondary": { 
      "scope": "matching_ammo", 
      "placeholder": "ammo",
      "contextFrom": "primary"
    }
  },
  "generateCombinations": true
}
```

The system:
1. Resolves primary targets first
2. For each primary target, resolves secondary targets with that primary as context
3. If `generateCombinations` is true, creates all valid combinations
4. If false, uses only the first valid combination

### 4.2 Performance Considerations

- **Resolution Order**: Dependencies are resolved sequentially, not in parallel
- **Context Switching**: Each primary target requires a new scope evaluation for dependents
- **Combination Limits**: Cartesian products are capped at 50 total combinations
- **Caching**: Scope resolution results can be cached for performance

## 5. Technical Deep Dive

### 5.1 Pipeline Flow

1. **MultiTargetResolutionStage**
   - Determines resolution order based on dependencies
   - Resolves each target with appropriate context
   - Builds resolved target data structure

2. **ActionFormattingStage**
   - Receives resolved targets and target definitions
   - Checks `generateCombinations` flag
   - Calls appropriate formatter method

3. **MultiTargetActionFormatter**
   - `formatCombinations()`: Generates Cartesian product
   - `formatSingleMultiTarget()`: Formats single action
   - Handles placeholder substitution

### 5.2 Key Data Structures

```javascript
// Resolved targets structure
{
  "primary": [
    { id: "entity1", displayName: "Rock", entity: {...} }
  ],
  "secondary": [
    { id: "entity2", displayName: "Goblin", entity: {...} }
  ]
}

// Target definitions from action schema
{
  "primary": {
    "scope": "throwable_items",
    "placeholder": "item",
    "description": "Item to throw"
  },
  "secondary": {
    "scope": "valid_targets",
    "placeholder": "target",
    "contextFrom": "primary"
  }
}
```

### 5.3 Error Handling

- **Circular Dependencies**: Detected and reported during resolution order
- **Missing Targets**: Required targets cause action to be filtered out
- **Invalid Placeholders**: Gracefully handled with fallback logic
- **Scope Failures**: Logged and treated as empty target lists

## 6. Conclusion

The `generateCombinations` and `contextFrom` properties provide powerful mechanisms for handling multi-target actions in the Living Narrative Engine:

- **`generateCombinations`** controls whether to create all possible combinations (Cartesian product) or just a single action with the first valid targets
- **`contextFrom`** enables sophisticated dependent target resolution where secondary targets can be filtered based on primary target properties

Together, these properties enable complex interactions like:
- "throw [any throwable item] at [any valid target]" (combinations)
- "unlock [container] with [matching key]" (contextual dependency)
- "cast [spell] on [valid target for that spell type]" (context + combinations)

The implementation is robust, with proper error handling, performance limits, and extensibility for future enhancements. The system maintains backward compatibility while providing powerful new capabilities for mod developers.