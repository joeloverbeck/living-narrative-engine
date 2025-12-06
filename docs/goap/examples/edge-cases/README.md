# GOAP Edge Cases & Error Scenarios

Common error scenarios, defensive programming patterns, and troubleshooting guide for refinement method development.

## 🎯 Purpose

This directory documents **common modder mistakes** and **defensive programming patterns** to prevent runtime errors in refinement methods. Each example shows the **wrong way** (causing errors) and the **right way** (safe handling).

---

## 📋 Edge Case Examples

### 1. Empty Inventory Conditional

**File**: `empty-inventory-conditional.refinement.json`
**Issue**: Accessing array elements without checking array length
**Common Error**: `Cannot read property '0' of undefined`

**Pattern**:

```json
{
  "condition": {
    "and": [
      { "has_component": ["actor", "items:inventory"] },
      { ">": [{ "var": "actor.components.items:inventory.items.length" }, 0] }
    ]
  }
}
```

**Key Learning**: `has_component` only checks component exists, not that arrays are populated. Always check `array.length > 0` before accessing `array[0]`.

---

### 2. Unreachable Location

**File**: `unreachable-location.refinement.json`
**Issue**: Attempting operations on inaccessible targets
**Common Error**: Repeated failed actions, wasted planning cycles

**Pattern**:

```json
{
  "condition": {
    "and": [
      { "has_component": ["location", "positioning:accessible"] },
      { "not": { "has_component": ["location", "positioning:blocked"] } }
    ]
  }
}
```

**Key Learning**: Validate preconditions (accessibility, reachability) **before** expensive operations like movement.

---

### 3. Missing Component

**File**: `missing-component.refinement.json`
**Issue**: Accessing component properties without existence checks
**Common Error**: `Cannot read property 'capacity' of undefined`

**Pattern**:

```json
{
  "condition": {
    "and": [
      { "has_component": ["actor", "items:inventory"] },
      { "!=": [{ "var": "actor.components.items:inventory.capacity" }, null] }
    ]
  }
}
```

**Key Learning**: Check **both** component existence **and** property not null before accessing nested properties.

---

### 4. Invalid Parameter Type

**File**: `invalid-parameter-type.refinement.json`
**Issue**: Using task parameters without type validation
**Common Error**: Type coercion bugs, NaN comparisons, invalid entity IDs

**Pattern**:

```json
{
  "condition": {
    "and": [
      { "!=": [{ "var": "task.params.targetItem" }, null] },
      { "!=": [{ "var": "task.params.targetItem" }, ""] },
      { "===": [{ "typeof": { "var": "task.params.targetItem" } }, "string"] }
    ]
  }
}
```

**Key Learning**: Validate ALL task parameters: type, non-null, non-empty, and (for entity IDs) entity existence.

---

### 5. Condition Evaluation Error

**File**: `condition-evaluation-error.refinement.json`
**Issue**: Condition evaluation throws due to null property access
**Common Error**: `Cannot read property 'room' of undefined` during condition evaluation

**Pattern**:

```json
{
  "condition": {
    "and": [
      { "!=": [{ "var": "actor" }, null] },
      { "!=": [{ "var": "actor.components.positioning:location" }, null] },
      { "!=": [{ "var": "actor.components.positioning:location.room" }, null] },
      {
        "==": [
          { "var": "actor.components.positioning:location.room" },
          "targetRoom"
        ]
      }
    ]
  }
}
```

**Key Learning**: Chain `!= null` checks for **every level** of nested property access in conditions.

---

## 🛡️ Defensive Programming Checklist

Use this checklist when writing refinement methods:

### Before Accessing Arrays

- [ ] Check component exists with `has_component`
- [ ] Check array property is not null
- [ ] Check `array.length > 0` before accessing elements
- [ ] Consider what happens if array is empty

### Before Accessing Components

- [ ] Use `has_component` to verify component exists
- [ ] Check specific properties are not null
- [ ] Don't assume component schema structure
- [ ] Plan for optional components

### Before Using Task Parameters

- [ ] Check parameter is not null
- [ ] Check parameter type with `typeof`
- [ ] For strings: check not empty (`!= ""`)
- [ ] For entity IDs: validate entity exists
- [ ] For numbers: check `!isNaN` and valid range

### Before Nested Property Access

- [ ] Check each level of property chain `!= null`
- [ ] Use `if-then-else` to provide default values
- [ ] Consider using `has_component` for component properties
- [ ] Guard against runtime object structure changes

### When Using JSON Logic Operators

- [ ] `in` operator: validate array exists and is array type
- [ ] Comparison operators: guard against null/undefined
- [ ] Property access: chain null checks
- [ ] Mathematical operations: validate numeric types

---

## 🔍 Common Error Messages

### "Cannot read property 'X' of undefined"

**Cause**: Accessing property on null/undefined object
**Fix**: Add `!= null` checks for intermediate properties

**Example**:

```json
❌ WRONG: {"var": "actor.components.positioning:location.room"}
✅ RIGHT: {
  "and": [
    {"!=": [{"var": "actor.components.positioning:location"}, null]},
    {"!=": [{"var": "actor.components.positioning:location.room"}, null]},
    {"var": "actor.components.positioning:location.room"}
  ]
}
```

---

### "Cannot read property '0' of undefined"

**Cause**: Accessing array element without checking array exists/length
**Fix**: Check `array.length > 0` before accessing elements

**Example**:

```json
❌ WRONG: {"var": "actor.components.items:inventory.items[0]"}
✅ RIGHT: {
  "and": [
    {"has_component": ["actor", "items:inventory"]},
    {">": [{"var": "actor.components.items:inventory.items.length"}, 0]},
    {"var": "actor.components.items:inventory.items[0]"}
  ]
}
```

---

### "Entity does not exist" or "Invalid entity ID"

**Cause**: Using parameter as entity ID without validation
**Fix**: Validate entity exists with `has_component`

**Example**:

```json
❌ WRONG: {"targetBindings": {"item": "task.params.targetItem"}}
✅ RIGHT: {
  "and": [
    {"!=": [{"var": "task.params.targetItem"}, null]},
    {"!=": [{"var": "task.params.targetItem"}, ""]},
    {"has_component": [{"var": "task.params.targetItem"}, "core:identity"]}
  ]
}
```

---

### "Comparison with NaN produces unexpected result"

**Cause**: Using numeric parameter without type validation
**Fix**: Check `typeof === "number"` and `!isNaN`

**Example**:

```json
❌ WRONG: {">": [{"var": "task.params.quantity"}, 0]}
✅ RIGHT: {
  "and": [
    {"!=": [{"var": "task.params.quantity"}, null]},
    {"===": [{"typeof": {"var": "task.params.quantity"}}, "number"]},
    {"===": [{"isNaN": {"var": "task.params.quantity"}}, false]},
    {">": [{"var": "task.params.quantity"}, 0]}
  ]
}
```

---

## 📖 Pattern Library

### Safe Array Access Pattern

```json
{
  "and": [
    { "has_component": ["entity", "component:with_array"] },
    {
      ">": [{ "var": "entity.components.component:with_array.array.length" }, 0]
    },
    {
      "operation_on": {
        "var": "entity.components.component:with_array.array[0]"
      }
    }
  ]
}
```

### Safe Component Property Access Pattern

```json
{
  "and": [
    { "has_component": ["entity", "component:id"] },
    { "!=": [{ "var": "entity.components.component:id.property" }, null] },
    { "operation_on": { "var": "entity.components.component:id.property" } }
  ]
}
```

### Safe Nested Property Access Pattern

```json
{
  "and": [
    { "!=": [{ "var": "obj" }, null] },
    { "!=": [{ "var": "obj.prop1" }, null] },
    { "!=": [{ "var": "obj.prop1.prop2" }, null] },
    { "operation_on": { "var": "obj.prop1.prop2" } }
  ]
}
```

### Parameter Type Validation Pattern

```json
{
  "and": [
    { "!=": [{ "var": "param" }, null] },
    { "!=": [{ "var": "param" }, ""] },
    { "===": [{ "typeof": { "var": "param" } }, "expected_type"] },
    { "additional_validation": "..." }
  ]
}
```

### Default Value Pattern

```json
{
  "operation": [
    {
      "if": [
        { "!=": [{ "var": "value" }, null] },
        { "var": "value" },
        "default_value"
      ]
    },
    "comparison_value"
  ]
}
```

---

## 🚨 Failure Behavior Guidelines

### When to Use "fail" Fallback

- Parameter validation failures (can't recover)
- Fundamental precondition violations
- Configuration errors
- Schema violations

### When to Use "replan" Fallback

- Runtime state changes (entity destroyed, location blocked)
- Accessibility issues (target unreachable)
- Resource unavailability (item consumed by another actor)
- Dynamic world state changes

### When to Use "continue" Fallback

- Optional steps that can be skipped
- Non-critical failures
- Best-effort operations
- Degraded functionality acceptable

**General Rule**: If the failure indicates a **planning or setup error**, use `"fail"`. If it indicates **dynamic world state**, use `"replan"`.

---

## 🎓 Learning Resources

### Related Documentation

- [Parameter Binding Guide](../../refinement-parameter-binding.md) - Complete parameter reference
- [Condition Patterns Guide](../../condition-patterns-guide.md) - JSON Logic patterns
- [Examples README](../README.md) - All example files
- [Templates](../../templates/) - Copy-paste templates

### Validation Tools

```bash
# Validate all refinement methods
npm run validate

# Strict validation (catches more issues)
npm run validate:strict
```

### Debugging Tips

1. **Enable verbose logging**: See condition evaluation details
2. **Check schema validation**: Ensure JSON structure is correct
3. **Test edge cases**: Empty arrays, null values, missing components
4. **Use fail steps**: Provide clear error messages for troubleshooting
5. **Validate parameters**: Check task parameter validity early

---

## 💡 Best Practices Summary

### Golden Rules

1. **Always validate before accessing**: Check existence before property access
2. **Chain null checks**: Check every level of nested properties
3. **Validate parameters**: Type, existence, and format
4. **Safe array access**: Check length before indexing
5. **Use has_component**: Primary tool for component validation
6. **Provide defaults**: Use if-then-else for safe fallbacks
7. **Descriptive failures**: Clear error messages in fail steps
8. **Plan for edge cases**: Empty arrays, null values, missing data

### Common Patterns

- **Component access**: `has_component` → `!= null` → access
- **Array access**: `has_component` → `length > 0` → access element
- **Parameter validation**: `!= null` → `type check` → `entity exists` → use
- **Nested properties**: Chain `!= null` for every level

### Red Flags 🚩

- ❌ Direct array[0] access without length check
- ❌ Component property access without has_component
- ❌ Task parameters used without validation
- ❌ Nested property access without null checks
- ❌ Numeric comparisons without NaN checks
- ❌ Entity IDs used without existence validation

---

## 📊 Edge Case Coverage Matrix

| Scenario             | Example File                  | Pattern Covered            | Common Error                            |
| -------------------- | ----------------------------- | -------------------------- | --------------------------------------- |
| Empty Arrays         | `empty-inventory-conditional` | Array length validation    | `Cannot read property '0'`              |
| Missing Components   | `missing-component`           | Component existence checks | `Cannot read property 'X' of undefined` |
| Inaccessible Targets | `unreachable-location`        | Precondition validation    | Failed actions, wasted cycles           |
| Invalid Parameters   | `invalid-parameter-type`      | Parameter type validation  | Type coercion, NaN issues               |
| Null Property Access | `condition-evaluation-error`  | Nested property guards     | `Cannot read property 'Y' of undefined` |

---

## 🔧 Troubleshooting Workflow

### Step 1: Identify Error Type

- **Runtime exception**: Null/undefined access → Add null checks
- **Validation failure**: Schema error → Check JSON structure
- **Logic error**: Wrong behavior → Review condition logic
- **Repeated failure**: Precondition not met → Add validation

### Step 2: Locate Error Source

- **Component access**: Review has_component usage
- **Array access**: Check length validation
- **Parameter usage**: Verify parameter validation
- **Condition evaluation**: Check property access chains

### Step 3: Apply Defensive Pattern

- Add appropriate guards from Pattern Library
- Test with edge case values (null, empty, missing)
- Provide descriptive fail messages
- Choose correct fallback behavior

### Step 4: Validate Fix

```bash
npm run validate              # Schema validation
npm run test:integration      # Runtime validation
```

---

**Last Updated**: 2024 (GOAPIMPL-007)
**Schema Version**: v1.1.0
**Status**: Production Ready
