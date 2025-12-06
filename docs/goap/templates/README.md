# GOAP Refinement Method Templates

Copy-paste-ready templates for creating refinement methods and tasks. Each template includes placeholder markers, inline documentation, and usage instructions.

## 📋 Available Templates

### 1. Simple Sequential Task

**File**: `simple-sequential-task.template.json`
**Pattern**: Linear sequence of actions
**Use When**: Actions execute one after another without branching

**Example Scenarios**:

- Pick up item, then consume it
- Move to location, then interact with object
- Unlock door, then open it

**Key Features**:

- Sequential action steps
- Target bindings for each action
- Fallback behavior on failure

---

### 2. Conditional Acquisition Task

**File**: `conditional-acquisition-task.template.json`
**Pattern**: If-then-else branching
**Use When**: Different actions based on a condition

**Example Scenarios**:

- If item in inventory → consume directly, else → pick up then consume
- If door unlocked → open directly, else → unlock then open
- If location reached → interact, else → move then interact

**Key Features**:

- Conditional branching (if-then-else)
- Different action sequences per branch
- Condition evaluation with JSON Logic
- Per-branch failure handling

---

### 3. Multi-Step State Task

**File**: `multi-step-state-task.template.json`
**Pattern**: State accumulation across steps
**Use When**: Later steps need data from earlier steps

**Example Scenarios**:

- Move to location, pick up item using location data
- Search area, interact with discovered entity
- Unlock door, open door using lock state

**Key Features**:

- `storeResultAs` for capturing step results
- Access to `refinement.localState`
- Success validation between steps
- Property extraction from stored state

---

### 4. Multiple Methods Task

**File**: `multiple-methods-task.template.json`
**Pattern**: Task with multiple refinement methods
**Use When**: A task can be accomplished in different ways

**Example Scenarios**:

- Arm self: pick up weapon OR draw from inventory
- Secure shelter: find existing OR build new OR rent
- Consume item: simple consume OR acquire first

**Key Features**:

- Complete task definition
- Structural gates (fundamental capabilities)
- Planning preconditions and effects
- Multiple refinement method references
- Cost and priority configuration

---

## 🚀 Quick Start

### 1. Choose a Template

Select the template that matches your needs:

- **Sequential**: Simple linear actions → `simple-sequential-task.template.json`
- **Conditional**: Branching logic → `conditional-acquisition-task.template.json`
- **State**: Data passing between steps → `multi-step-state-task.template.json`
- **Task**: Multiple approaches → `multiple-methods-task.template.json`

### 2. Copy and Rename

```bash
# Copy template
cp simple-sequential-task.template.json my-task.my-method.refinement.json

# Or for task file
cp multiple-methods-task.template.json my-task.task.json
```

### 3. Replace Placeholders

Search for `{{` and replace all `{{PLACEHOLDER}}` markers with your actual values.

**Common Placeholders**:

- `{{MOD_ID}}` - Your mod identifier (e.g., "core", "my_mod")
- `{{TASK_ID}}` - Task identifier (e.g., "consume_item")
- `{{METHOD_NAME}}` - Method name (e.g., "simple_consume")
- `{{ACTION_ID}}` - Action identifier (e.g., "items:pick_up_item")
- `{{TARGET_NAME}}` - Target parameter name (e.g., "item", "target")
- `{{DESCRIPTION}}` - Human-readable description

### 4. Remove Comment Block

Delete the usage instructions at the bottom of the template (starting with `// ============`).

### 5. Validate

```bash
npm run validate
```

---

## 📝 Example Workflow

Let's create a "consume potion" refinement method:

### Step 1: Copy Template

```bash
cp simple-sequential-task.template.json consume_potion.drink.refinement.json
```

### Step 2: Replace Placeholders

```json
{
  "$schema": "schema://living-narrative-engine/refinement-method.schema.json",
  "id": "alchemy:consume_potion.drink",
  "taskId": "alchemy:consume_potion",
  "description": "Simple method to drink a potion that is already in inventory",

  "applicability": {
    "description": "Actor has a potion in their inventory",
    "condition": {
      "and": [
        {
          "has_component": [{ "var": "target" }, "alchemy:potion"]
        }
      ]
    }
  },

  "steps": [
    {
      "stepType": "primitive_action",
      "actionId": "items:consume_item",
      "targetBindings": {
        "item": "target"
      }
    }
  ],

  "fallbackBehavior": "replan"
}
```

### Step 3: Remove Comments and Validate

Delete the comment block and run:

```bash
npm run validate
```

---

## 🎯 Placeholder Reference

### Universal Placeholders

| Placeholder       | Example Value          | Description                  |
| ----------------- | ---------------------- | ---------------------------- |
| `{{MOD_ID}}`      | `"core"`, `"my_mod"`   | Your mod's unique identifier |
| `{{TASK_ID}}`     | `"consume_item"`       | Task this method refines     |
| `{{METHOD_NAME}}` | `"simple_consume"`     | Unique method name           |
| `{{DESCRIPTION}}` | `"Drinks a potion..."` | Human-readable description   |

### Action Placeholders

| Placeholder       | Example Value                    | Description                    |
| ----------------- | -------------------------------- | ------------------------------ |
| `{{ACTION_ID}}`   | `"items:pick_up_item"`           | Full action identifier         |
| `{{TARGET_NAME}}` | `"item"`, `"target"`             | Action's target parameter name |
| `{{TARGET_PATH}}` | `"target"`, `"task.params.item"` | Path to target entity          |

### Condition Placeholders

| Placeholder        | Example Value            | Description         |
| ------------------ | ------------------------ | ------------------- |
| `{{OPERATOR}}`     | `"and"`, `"or"`, `"not"` | JSON Logic operator |
| `{{COMPONENT_ID}}` | `"items:nourishing"`     | Component to check  |
| `{{ENTITY_PATH}}`  | `"actor"`, `"target"`    | Entity reference    |

### State Placeholders

| Placeholder         | Example Value          | Description                |
| ------------------- | ---------------------- | -------------------------- |
| `{{STATE_KEY}}`     | `"moveResult"`         | Name for stored result     |
| `{{PROPERTY_NAME}}` | `"item"`, `"position"` | Property from stored state |

---

## 💡 Best Practices

### Target Bindings

✅ **DO**: Use direct paths

```json
"targetBindings": {
  "item": "target"
}
```

❌ **DON'T**: Use JSON Logic in target bindings

```json
"targetBindings": {
  "item": {"var": "target"}  // WRONG!
}
```

### Conditions

✅ **DO**: Use JSON Logic for conditions

```json
"condition": {
  "==": [{"var": "actor.position"}, {"var": "task.params.location"}]
}
```

### State Access

✅ **DO**: Access stored state with full path

```json
"refinement.localState.moveResult.data.position"
```

✅ **DO**: Validate success before using state

```json
{
  "condition": {
    "==": [{ "var": "refinement.localState.myResult.success" }, true]
  }
}
```

### Descriptions

✅ **DO**: Write clear, specific descriptions

```json
"description": "Pick up the health potion from the ground"
```

❌ **DON'T**: Use generic descriptions

```json
"description": "Do stuff"  // Too vague!
```

---

## 📚 Additional Resources

### Complete Examples

See `docs/goap/examples/` for fully-worked examples:

- `refinement-method-simple.json` - Simple sequential
- `conditional-simple.refinement.json` - Basic conditional
- `parameter-state.refinement.json` - State accumulation
- `conditional-nested.refinement.json` - Nested conditionals

### Documentation

- [Parameter Binding Guide](../refinement-parameter-binding.md) - Complete parameter reference
- [Condition Patterns Guide](../condition-patterns-guide.md) - Common condition patterns
- [Examples README](../examples/README.md) - Comprehensive examples guide
- [Task Loading Spec](../task-loading.md) - Task definition specification

### Real Production Examples

See `data/mods/core/tasks/` for real-world tasks:

- `consume_nourishing_item.task.json` - Food consumption
- `secure_shelter.task.json` - Shelter acquisition
- `arm_self.task.json` - Weapon wielding
- `find_instrument.task.json` - Knowledge-gated finding

---

## 🔍 Troubleshooting

### Common Issues

**"Invalid schema" error**

- Check `$schema` matches: `"schema://living-narrative-engine/refinement-method.schema.json"`
- Ensure all required fields present

**"Unknown action" error**

- Verify action exists in `data/mods/*/actions/`
- Check action ID format: `"modId:actionName"`

**"Target binding failed" error**

- Don't use JSON Logic in `targetBindings`
- Use direct paths: `"target"` not `{"var": "target"}`

**"Condition evaluation failed" error**

- Use JSON Logic in `condition` fields
- Check property paths: `{"var": "actor.position"}`

### Getting Help

- Check [Edge Cases](../examples/edge-cases/) for error scenarios
- Review [Condition Patterns](../condition-patterns-guide.md) for correct syntax
- Examine working examples in `docs/goap/examples/`

---

## ✅ Validation Checklist

Before committing your refinement method:

- [ ] All `{{PLACEHOLDER}}` markers replaced
- [ ] Comment block removed
- [ ] Schema reference correct
- [ ] Target bindings use direct paths (not JSON Logic)
- [ ] Conditions use JSON Logic (not direct paths)
- [ ] Action IDs exist in your mod
- [ ] Descriptions are clear and specific
- [ ] `npm run validate` passes
- [ ] File follows naming convention: `{task_id}.{method_name}.refinement.json`
- [ ] File location correct (in mod's `refinement-methods/` directory)

---

## 📦 Template Categories

### By Complexity

- **Beginner**: `simple-sequential-task.template.json`
- **Intermediate**: `conditional-acquisition-task.template.json`
- **Advanced**: `multi-step-state-task.template.json`
- **Expert**: `multiple-methods-task.template.json` (requires task + methods)

### By Feature

- **Branching**: `conditional-acquisition-task.template.json`
- **State Management**: `multi-step-state-task.template.json`
- **Task Definition**: `multiple-methods-task.template.json`
- **Basic Actions**: `simple-sequential-task.template.json`

### By Use Case

- **Item Management**: `simple-sequential-task` or `conditional-acquisition-task`
- **Location Movement**: `multi-step-state-task`
- **Combat/Weapons**: `multiple-methods-task`
- **Resource Gathering**: `conditional-acquisition-task` or `multiple-methods-task`

---

## 🎓 Learning Path

### Recommended Order

1. Start with `simple-sequential-task.template.json`
   - Learn basic structure
   - Understand target bindings
   - Practice action sequencing

2. Move to `conditional-acquisition-task.template.json`
   - Learn conditional logic
   - Understand JSON Logic syntax
   - Practice branching scenarios

3. Progress to `multi-step-state-task.template.json`
   - Learn state accumulation
   - Understand `storeResultAs`
   - Practice data passing

4. Master `multiple-methods-task.template.json`
   - Learn task definition
   - Understand planning concepts
   - Practice method orchestration

---

**Last Updated**: 2024 (GOAPIMPL-007)
**Schema Version**: v1.1.0
**Status**: Production Ready
