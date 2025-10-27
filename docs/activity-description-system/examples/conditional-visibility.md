# Conditional Visibility Example

This example shows how to use metadata conditions so that activities only appear under
specific circumstances.

## Scenario

A stealth mission component should only be described when the actor has the component
`stealth:in_cover` set to `true` and the target does **not** have the component
`awareness:alert`.

## 1. Metadata definition

```json
{
  "id": "example:stealth_in_cover_metadata",
  "components": [
    {
      "componentId": "activity:description_metadata",
      "data": {
        "sourceComponent": "stealth:in_cover",
        "descriptionType": "template",
        "template": "{actor} is hiding in cover near {target}",
        "targetRole": "targetId",
        "priority": 80,
        "conditions": {
          "showOnlyIfProperty": {
            "property": "isActive",
            "equals": true
          },
          "hideIfTargetHasComponent": "awareness:alert"
        }
      }
    }
  ]
}
```

The metadata inspects the source component's `isActive` property and hides the activity when
the target is alert.

## 2. Runtime setup

```javascript
entityManager.addComponent('jon_ureña', 'stealth:in_cover', {
  targetId: 'guard_1',
  isActive: true,
});

entityManager.addComponent('guard_1', 'awareness:alert', {
  level: 'low',
});
```

With the target currently alert, the activity should be suppressed.

```javascript
const summary = await activityService.generateActivityDescription('jon_ureña');
console.log(summary); // ""
```

Now update the target state and regenerate:

```javascript
entityManager.removeComponent('guard_1', 'awareness:alert');
const updated = await activityService.generateActivityDescription('jon_ureña');
console.log(updated);
// Activity: Jon Ureña is hiding in cover near Guard 1.
```

## Tips

* Combine `showOnlyIfProperty` with inline metadata flags (`shouldDescribeInActivity`) for
  simple runtime toggles.
* For more complex logic use `JsonLogicEvaluationService` by providing a `jsonLogic`
  expression in your metadata (see ACTDESC-018 examples in the unit tests).
* Conditions run against the component data and resolved target state, so ensure any
  referenced properties exist before enabling the condition.
