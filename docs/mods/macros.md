# Action Macros

Macros let you reuse common action sequences across multiple rules. Define them in `content.macros` within your mod and reference them by ID inside rule `actions`.

## Defining a Macro

Create a file in your mod's `macros/` folder:

```json
{
  "$schema": "http://example.com/schemas/macro.schema.json",
  "id": "core:say_hello",
  "actions": [{ "type": "DISPATCH_SPEECH", "parameters": { "text": "Hello!" } }]
}
```

Add the file path to `macros` in your `mod-manifest.json`.

## Using a Macro in a Rule

Inside a rule's `actions` array use a reference object:

```json
{
  "event_type": "core:turn_started",
  "actions": [{ "macro": "core:say_hello" }]
}
```

During loading the engine expands the macro so the rule executes the macro's actions.
