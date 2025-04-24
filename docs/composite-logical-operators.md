# Composite Logical Operators in JSON Conditions
_Sub-ticket 5 – Documentation_

The engine now supports the three **composite boolean operators** provided by
[json-logic-js](https://github.com/jwadhams/json-logic-js):

| Operator | Purpose | Notes & Edge-cases |
|----------|---------|--------------------|
| **`and`** | Returns the _last_ operand if they are **all** truthy; otherwise returns the first falsy operand. | **Vacuous truth** – an empty list is considered `true` (`{"and": []}` ⇒ `true`). |
| **`or`**  | Returns the _first_ truthy operand; if none are truthy returns the last operand. | **Vacuous falsity** – an empty list is considered `false` (`{"or": []}` ⇒ `false`). |
| **`not`** / **`!`** | Unary operator that negates its single argument. `!` is shorthand for `not`. | Expects exactly one operand. |

The engine enforces the vacuous truth/falsity rules above in `JsonLogicEvaluationService`.

---

## 1 · Simple Examples

```jsonc
// 1.1  AND – require both conditions to be true
{ "and": [
  { "==": [ { "var": "event.type" }, "event:door_try_open" ] },
  { "==": [ { "var": "target.components.game:lockable.state" }, "locked" ] }
]}

// 1.2  OR – poisoned OR diseased
{ "or": [
  { "!!": { "var": "actor.components.effect:poison" } },
  { "!!": { "var": "actor.components.effect:disease" } }
]}

// 1.3  NOT – actor is *not* burdened
{ "!": { "var": "actor.components.status:burdened" } }
```
## 2 · Nested Example
```jsonc
{
  "or": [
    { "==": [ { "var": "target.components.Locked" }, true ] },
    { "and": [
        { ">=": [ { "var": "actor.components.SecurityLevel" }, 3 ] },
        { "==": [ { "var": "actor.components.Alarm" }, false ] }
    ]}
  ]
}
```
Reads as: “Pass if the target is locked or the actor has security ≥3 and no alarm.”

## 3 · How to Reference Game Data

Path root |	What it gives you | Example
event.* |	Triggering event info |	event.type, event.payload.itemId
actor.* |	Acting entity (may be null) |	actor.id, actor.components.core:health.current
target.* |	Target entity (may be null) |	target.id, target.components.game:lockable.state
context.* |	Temp variables set earlier in the same rule |	context.rollResult
See the full JSON Logic Usage Guide for advanced operators, data-access quirks, and 50+ patterns.

## 4 · Gotchas
Empty operand arrays follow the vacuous rules noted in the table above – this differs from raw json-logic-js which returns undefined.

Arrays ([]) are truthy in a bare JavaScript sense, but boolean coercion (!![]) in json-logic-js treats them as falsy. Our service coerces the final result with !!, so {"and":[true,[]]} ends up true.