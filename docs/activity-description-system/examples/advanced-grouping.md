# Advanced Grouping Example

This example demonstrates how to combine multiple activities into a single sentence using the
`grouping` metadata block.

## Scenario

A character is both **holding hands** and **embracing** another entity. Each activity should
be discoverable individually, but the final description should read:

```
Activity: Jon Ureña is embracing Alicia Western while holding hands.
```

## 1. Define metadata

Create dedicated metadata entities that share a `groupKey` and specify compatible
`combineWith` values.

```json
{
  "id": "example:intimate_embrace_metadata",
  "components": [
    {
      "componentId": "activity:description_metadata",
      "data": {
        "sourceComponent": "intimacy:embracing",
        "descriptionType": "template",
        "template": "{actor} is embracing {target}",
        "priority": 85,
        "grouping": {
          "groupKey": "intimate_contact",
          "combineWith": ["intimacy:holding_hands"]
        }
      }
    }
  ]
}
```

```json
{
  "id": "example:holding_hands_metadata",
  "components": [
    {
      "componentId": "activity:description_metadata",
      "data": {
        "sourceComponent": "intimacy:holding_hands",
        "descriptionType": "template",
        "template": "{actor} is holding hands with {target}",
        "priority": 70,
        "grouping": {
          "groupKey": "intimate_contact",
          "combineWith": ["intimacy:embracing"]
        }
      }
    }
  ]
}
```

Both records share the same `groupKey` (`intimate_contact`). Each declares that it can be
combined with the other's `sourceComponent`.

## 2. Add runtime components

```javascript
entityManager.addComponent('jon_ureña', 'intimacy:embracing', {
  partner: 'alicia_western',
});

entityManager.addComponent('jon_ureña', 'intimacy:holding_hands', {
  partner: 'alicia_western',
});
```

## 3. Generate description

```javascript
const summary = await activityService.generateActivityDescription('jon_ureña');
```

The service detects the shared group key, merges the phrases, and inserts a conjunction using
the `buildRelatedActivityFragment` helper. The result is a single sentence describing both
activities without repetition.

### Tips

* Prioritise the primary activity by giving it the highest `priority`. The first item in the
  group controls the base template.
* Use `groupKey` values to scope combinations. Activities with different keys will never be
  merged.
* If you need custom conjunctions or phrasing, adjust the metadata templates to include the
  conjunction text directly (for example, `'{actor} is embracing {target} while {adverb}'`).
