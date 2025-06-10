## Part I: Introduction to JsonLogic

Welcome to the heart of the Living Narrative Engine's modding system! Many of the JSON files you'll create—for actions, events, and game rules—need a way to check for certain conditions. For example, you might want an action to be available only if the player has a specific item, or a rule to trigger only if an NPC's health is low.

Instead of requiring you to write programming code, the engine uses **JsonLogic**.

**What is JsonLogic?** It's a way to build rules and conditions using the same simple JSON format you use for everything else.

Think of it like this:

Instead of thinking: "I need to write a function that checks if the actor's health is less than 10."
You can now think: "I need to write a **JSON rule** that checks if the actor's health is less than 10."

The most important thing to remember is that every rule you write, no matter how complex, is designed to answer a single question and will always give a simple, final answer: `true` or `false`.

## The Data Context: Your World View

Every time the game evaluates one of your rules, it provides a "snapshot" of the current situation. This snapshot is called the **data context**, and it contains all the information your rule might need.

This data is organized into four main objects that are always available at the top level of your rule's "world view":

- **`actor`**: This represents the primary entity performing or initiating the action.
  - _Example_: The player character opening a door, or the NPC casting a spell.
- **`target`**: This represents the entity being acted upon. It has the same structure as the `actor` object.
  - _Example_: The door being opened, or the character being hit by the spell.
- **`event`**: This contains data about the specific event that triggered the rule check.
  - _Example_: Information about the `ACTION:PERFORMED` event, including its type and any associated data.
- **`context`**: This is a flexible, general-purpose "data bag" for any other information the game needs to pass to the rule.
  - _Example_: The current turn number, the weather, or the results of a previous game query.

Visually, you can think of it like this:

[ Your Rule ]
|
+--> actor (Who is doing it?)
+--> target (Who/what is it being done to?)
+--> event (What just happened?)
+--> context (What else is going on in the world?)

---

# Part II: Accessing Data

## The 'var' Operator: Getting Your Data

Now that you know what data is available, how do you get it? You use the `var` operator. The `var` operator's job is to retrieve a piece of data from the context using a "path" to the value you want. The path is written as a string with dots separating each step.

The basic syntax looks like this:

```json
{ "var": "object.property.nested_property" }
```

Here are some practical examples of how you'd use var to get different kinds of information:

To get the actor's ID:

```json
{ "var": "actor.id" }
```

To get the current health from a target's Health component:

```json
{ "var": "target.components.Health.current" }
```

To get the type of the triggering event:

```json
{ "var": "event.type" }
```

To get the current turn count from the general context:

```json
{ "var": "context.turnCount" }
```

Accessing Array Elements
You can also use dot notation to access a specific element in an array (a list of items). The numbering starts at zero. For example, to get the ID of the very first item in an inventory:

```json
{ "var": "target.components.Inventory.items.0.id" }
```

## The Golden Rule: Safe and Graceful Null Handling

This is the most important feature to understand about the engine's rule system: **it is designed to be safe**. You do not need to worry about causing an error if you try to access data that might not exist.

If you use `var` to ask for a piece of data and any part of that path is missing, the rule will not crash. Instead, the `var` expression will simply and safely return `null`.

Let's look at what this means in practice:

#### Accessing a Missing Component:

An actor does not have a `Shields` component.

- The rule `{ "var": "actor.components.Shields.power" }` resolves to `null`.

#### Accessing a Missing Property on an Existing Component:

An actor has a `Health` component, but it only contains `{ "current": 10 }` (no `max` property).

- The rule `{ "var": "actor.components.Health.max" }` resolves to `null`.

#### Accessing through a Missing Nested Object:

An actor has a `Stats` component, but it's just `{ "attributes": {} }` (no `resistances` object inside).

- The rule `{ "var": "actor.components.Stats.attributes.resistances.fire" }` resolves to `null`.

#### Accessing Data on a Missing Entity:

An action is performed without a target, so the `target` object itself is `null`.

- The rule `{ "var": "target.components.Health.current" }` resolves to `null`.

**Key Takeaway:** You can write rules that access properties on optional components without fear. The system's safe handling of `null` is a powerful feature you will use in almost every complex rule you write.

## Part III: Building Conditions: Operators

Now that you can get data with `var`, the next step is to use operators to ask questions about it.

### Comparison Operators: Is it equal, greater, or less?

These are the most common operators you will use. They let you compare two values.

#### Loose Equality (`==` and `!=`)

The `==` (is equal to) and `!=` (is not equal to) operators check if two values are the same. They use "loose" equality, meaning they will consider values of different types to be equal if their content is the same. For example, the number `1` is considered equal to the string `"1"`.

**The `null` Exception**: There is one very important rule. The special value `null` (which you get from missing data) is **only** equal to `null`. It is not equal to `0`, `false`, or an empty string `""`.

This makes checking for missing data very easy and predictable:

**Rule**: `{ "==": [{ "var": "actor.components.missing_component" }, null] }`
**Result**: `true`.

---

#### Relational Operators (>, <, >=, <=)

These operators check for "greater than," "less than," etc. They are primarily used for numbers.

**The `null` Coercion Rule**: These operators have a different, critical rule for handling `null`. When used in a relational comparison, `null` is treated as the number `0`.

This behavior is incredibly useful. Consider this example:

**Goal**: We want a rule to be `true` if a target's health is depleted (is 0 or less).
**Rule**: `{ "<=": [{ "var": "target.components.Health.current" }, 0] }`
**Result**: This rule works perfectly whether the target has health or not!

- If `current` is `-10`, the rule is `-10 <= 0` -> `true`.
- If `current` is `0`, the rule is `0 <= 0` -> `true`.
- If the `Health` component or the `current` property is missing, the `var` path becomes `null`. The rule becomes `0 <= 0` -> `true`.

The rule correctly and safely assumes that a non-existent health value is a depleted one.

### Logical Combinators: Combining Your Checks

Often, a single check isn't enough. You need to combine conditions, for example, "the actor must have the key **and** the door must be locked." Logical operators let you do this.

- `and`: Takes a list of conditions and returns `true` only if **all** of them are `true`.
- `or`: Takes a list of conditions and returns `true` if **at least one** of them is `true`.
- `not` (or `! `): Takes a single condition and inverts its result (turns `true` to `false`, and `false` to `true`).

You can "nest" these operators to create very powerful rules. For example, here's how you could check if `(condition1 is true) AND (condition2 OR condition3 is true)`:

```json
{
  "and": [
    { "<condition1>" },
    { "or": [ { "<condition2>" }, { "<condition3>" } ] }
  ]
}
```

### Important: Short-Circuit Evaluation

The and and or operators are smart. They stop evaluating as soon as they know the final answer. This is called short-circuiting.

For an and rule, if it sees a single false condition, it immediately stops and returns false without checking the rest.
For an or rule, if it sees a single true condition, it immediately stops and returns true without checking the rest.
This isn't just for performance—it's a powerful safety feature. A very common pattern is to check that a component exists before you try to access its properties.

Goal: Check if a target has a "lockable" component AND its state is "locked".

Rule:

```json
{
  "and": [
    { "!!": { "var": "target.components.['game:lockable']" } },
    { "==": [{ "var": "target.components.['game:lockable'].state" }, "locked"] }
  ]
}
```

**How it works**: If the target does not have the game:lockable component, the first condition becomes false. The and operator short-circuits and immediately stops. The second condition, which would have resulted in null, is never even evaluated. This prevents any potential issues and is the standard way to write safe, complex checks.

### The 'in' Operator: Checking for Membership

The `in` operator is a versatile tool that checks for presence. Its behavior changes depending on what you are checking.

#### Array Membership

When the second argument is an array (a list), the `in` operator checks if the first argument is an element inside that array. This is the most common way to check for things like status effects, quest progress, or tags.

**Goal**: Check if the active quest log contains "quest_1".
**Actor's Data**: The `active_quests` property is `["quest_0", "quest_1", "quest_5"]`.
**Rule**:

```json
{
  "in": [
    "quest_1",
    { "var": "actor.components.['core:quest_log'].active_quests" }
  ]
}
```

**Result**: `true`.

#### Substring Search

When the second argument is a string, the `in` operator checks if the first argument is a _substring_ (a part of the text) inside it. This is useful for checking text from events or other descriptions.

**Goal**: Check if an event's message contains the word "critical".
**Event's Data**: The `message` property is `"A critical hit was landed!"`.
**Rule**: `{ "in": ["critical", { "var": "event.payload.message" }] }`
**Result**: `true`.

**Null Safety**: Consistent with the engine's Golden Rule, if the `var` path resolves to `null` (because the component, property, or text doesn't exist), the `in` operator will safely return `false`.

### Arithmetic Operations: Doing the Math

You can also perform mathematical calculations directly inside your rules. The engine supports the standard arithmetic operators: `+`, `-`, `*`, `/`, and `%` (modulo).

This is powerful for creating dynamic conditions. For example, you can check if an actor's base strength plus a bonus from an event is enough to pass a threshold.

**Goal**: Check if an actor's `strength` plus an event `bonus` is greater than 15.

- **Actor's Data**: `strength` is 10.
- **Event's Data**: `bonus` is 6.
- **Rule**:
  ```json
  {
    ">": [
      {
        "+": [
          { "var": "actor.components.Stats.strength" },
          { "var": "event.payload.bonus" }
        ]
      },
      15
    ]
  }
  ```
- **Result**: The `+` operator calculates `10 + 6 = 16`. The `>` operator then checks if `16 > 15`, which is `true`.

**Note on Modulo (%)**: The modulo operator (which gives the remainder of a division) is useful for checking for things like even/odd turn counts. Please be aware that if its input is `null` (e.g., the `turnCount` variable is missing), it will be treated as `0`. So, `null % 2` results in `0`.

## Part IV: Common Modding Patterns & Recipes

This section is a "cookbook" of solutions to common problems. You can use these patterns as a starting point for your own rules.

### Pattern: Checking for Existence

This is the most common task you'll perform: checking if a component, property, or entity exists.

#### Use Case 1: Is a component present? (Component as a Flag)

Often, the mere presence of a component is enough to signal a state (e.g., the actor is poisoned, has a key). The best way to check for this is the `!!` operator, which forces the result to a strict `true` or `false`.

**Goal:** Check if the actor has the `effect:poisoned` component.

**Pattern:**

```json
{ "!!": { "var": "actor.components.['effect:poisoned']" } }
```

Result: true if the component exists, false if it does not.

#### Use Case 2: Is a deeply nested property present?

The !! operator is also perfect for safely checking for a property deep inside a component's data.

Goal: Check if the actor's inventory component has an "orb" item.

Pattern:

```json
{ "!!": { "var": "actor.components.inv.items.orb" } }
```

Result: true only if the inv component, the items object, and the orb property all exist. If any part of that path is missing, it safely returns false.

#### Use Case 3: Is an entity available?

To ensure an action has a valid target before proceeding, check that the entity object itself is not null.

Goal: Check that a valid target exists for the action.

Pattern:

```json
{ "!=": [{ "var": "target" }, null] }
```

Result: true only if a target was provided and successfully found by the game. false if the target ID was null or not found.

#### Use Case 4: Is a custom context variable set?

When checking for a variable in the context object, you have two options:

Is it set to anything other than null? Use != null. This is a broad check.

```json
{ "!=": [{ "var": "context.queryResult" }, null] }
```

Is it set to a "truthy" value? Use !!. This is more specific and will return false for null, 0, false, or "" (empty string).

```json
{ "!!": { "var": "context.queryResult" } }
```

### Pattern: Checking for Absence

Just as important as checking if something exists is checking if it doesn't. These patterns are designed to do so safely.

**Pattern 1: Is a component absent?**

The most concise way to check that a component is not on an entity is to use the `!` (not) operator directly on the `var` accessor.

**Goal:** A rule should apply only if the actor is not burdened.

**Pattern:** `{ "!": { "var": "actor.components.['status:burdened']" } }`

**How it Works:**

- If the `status:burdened` component exists, its data (an object) is "truthy." The `!` operator inverts this to `false`.
- If the component is missing, the `var` path resolves to `null`, which is "falsy." The `!` operator inverts this to `true`.

**Result:** This single line correctly returns `true` only when the component is absent.

**Pattern 2: Is a value NOT in an array?**

To verify that an item is not in a list (e.g., a quest has not been completed), you combine the `!` and `in` operators. This pattern is exceptionally robust.

**Goal:** Check that 'quest_2' has NOT been completed.

**Pattern:**

```json
{
  "!": {
    "in": [
      "quest_2",
      { "var": "actor.components.['core:quest_log'].completed_quests" }
    ]
  }
}
```

How it Works: The inner in check runs first.

If the completed_quests array contains 'quest_2', the in check is true. The outer ! inverts this to false.
If the completed_quests array does not contain 'quest_2', the in check is false, which the ! inverts to true.
The Robust Part: This pattern also returns true if the completed_quests array is empty, if the property is missing, or if the entire core:quest_log component doesn't exist! In all those cases, the inner in check safely returns false, which ! inverts to true. This makes it a very reliable way to check for the absence of a state.

### Pattern: State and Value Checks

This pattern involves retrieving a value with `var` and comparing it to a specific, static value.

#### Boolean Checks (Is it `true`?)

When a component property is a boolean (true/false), you have two ways to check it.

**The Explicit Method (Recommended for clarity):**

- **Goal:** Check if a door's `isOpen` property is `true`.
- **Pattern:** `{ "==": [{ "var": "target.components.door.isOpen" }, true] }`
- **Result:** This is precise and easy to read. It returns `true` only if the value is exactly `true`.

**The Shorthand Method:**

- **Goal:** Same as above.
- **Pattern:** `{ "var": "target.components.door.isOpen" }`
- **How it Works:** The rule itself just returns the value (`true`, `false`, or `null` if missing). The game engine then automatically converts that final result into a strict boolean. `true` stays `true`, while `false` and `null` both become `false`. This is a concise way to check for a `true` state.

#### String or ID Checks

This is the standard way to check for specific event types, entity IDs, or state names.

- **Goal:** Check if the triggering event's type is "event:entity_dies".
- **Pattern:** `{ "==": [{ "var": "event.type" }, "event:entity_dies"] }`

- **Goal:** Check if the target's ID is "npc:shopkeeper".
- **Pattern:** `{ "==": [{ "var": "target.id" }, "npc:shopkeeper"] }`

#### Numeric Checks

Use standard comparison operators (>, `<`, `==`, etc.) to check numeric properties.

- **Goal:** Check if an event's payload carried a `damageAmount` greater than 10.
- **Pattern:** `{ ">": [{ "var": "event.payload.damageAmount" }, 10] }`

## Part V: Advanced Topics & Appendix

This final section covers some of the deeper mechanics of the rule engine. You don't need to master these to get started, but they can be helpful for understanding why certain rules behave the way they do.

### Truthiness & Falsiness Explained

In a boolean context, like an `if` or `!!` operator, values that are not strictly `true` or `false` must be coerced into one of them. The rules for this are called "truthiness" and "falsiness."

#### Falsy Values

These values are treated as `false` in a boolean check. The list is short and specific:

- `false` (the boolean)
- `null` (the value for missing data)
- `0` (the number zero)
- `""` (an empty string)

#### Truthy Values

Any value that is not on the "falsy" list is considered "truthy" and will be treated as `true`. This includes:

- Any number other than `0` (e.g., `1`, `-10`).
- Any non-empty string (e.g., `"hello"`, `"0"`).
- Any object, even an empty one (`{}`).
- Any array, even an empty one (`[]`) - _but see the exception below!_

#### The Empty Array `[]` Exception

The empty array (`[]`) has a very specific and nuanced behavior that you must be aware of. How it is treated depends on the operator being used.

- **In a pure boolean context (`!!` or `!`)**: An empty array is **FALSY**.
  - `{ "!!": [] }` evaluates to `false`.
  - This is the behavior you'll see when checking for the existence of an empty list of tags, for example.
- **In a value-returning context (`and` or `or`)**: An empty array is **TRUTHY**.
  - The rule `{ "and": [true, []] }` evaluates to `true`.
  - This happens because the `and` operator checks the raw JavaScript truthiness of its arguments. It sees `true` (truthy) and `[]` (also truthy in this context), so it returns the last value, `[]`. The game service then coerces the `[]` object to `true`.

**Recommendation**: This is a tricky nuance of the underlying JsonLogic library. To avoid confusion, **always use the `!!` operator when your intent is to check if an array exists or is non-empty.**

### Service Guarantees & Error Handling

The game's rule evaluation service provides two key guarantees that make the system robust and predictable.

#### 1. The Final Result is Always a Strict Boolean

You may have noticed in the "Shorthand Boolean Check" pattern that a rule like `{ "var": "target.components.door.isOpen" }` works correctly. This is because of a service-level guarantee: **the final result of any rule evaluation is always automatically coerced into a strict `true` or `false`**.

If your rule's logic happens to return a non-boolean value, the service will convert it based on its "truthiness":

- Rule returns `50` (a truthy number): Service result is `true`.
- Rule returns `"some_string"` (a truthy string): Service result is `true`.
- Rule returns `0` (a falsy number): Service result is `false`.
- Rule returns `null` (a falsy value): Service result is `false`.

You do not need to wrap your entire rule in a `!!` operator to ensure a boolean outcome; the service handles this for you.

#### 2. Evaluation Errors are Caught Gracefully

A malformed or syntactically invalid JsonLogic rule will **not** crash the game. The evaluation service is wrapped in a safety layer.

If a rule throws an error during evaluation for any reason (e.g., invalid operator, incorrect structure), the system will:

1.  **Catch** the internal error.
2.  **Log** detailed diagnostic information for the game's developers. This log includes a snippet of the failing rule, the keys of the data context (`actor`, `target`, etc.), and the original error message.
3.  **Return** `false` as the final result for the rule evaluation.

This ensures that the rest of the game logic can continue to function smoothly, treating the failed condition check as if it were simply not met.
