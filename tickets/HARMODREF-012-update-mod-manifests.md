# HARMODREF-012: Update Mod Manifests with Component Type Registrations

**Priority:** P1 - HIGH
**Effort:** 1 day
**Status:** Not Started

## Report Reference

[reports/hardcoded-mod-references-analysis.md](../reports/hardcoded-mod-references-analysis.md) - "P1: Short-Term Refactoring"

## Problem Statement

Update mod manifests for positioning, items, affection, violence, and clothing mods to declare their component type registrations, making component categories discoverable.

## Affected Files

1. `data/mods/positioning/mod-manifest.json`
2. `data/mods/items/mod-manifest.json`
3. `data/mods/affection/mod-manifest.json`
4. `data/mods/violence/mod-manifest.json`
5. `data/mods/clothing/mod-manifest.json`
6. `data/schemas/mod-manifest.schema.json`

## Implementation Steps

### 1. Update Manifest Schema

```json
{
  "componentTypeRegistrations": {
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "category": { "type": "string" },
        "componentId": { "type": "string" },
        "default": { "type": "boolean" },
        "description": { "type": "string" }
      },
      "required": ["category", "componentId"]
    }
  }
}
```

### 2. Update Positioning Mod

```json
{
  "componentTypeRegistrations": [
    {
      "category": "sitting",
      "componentId": "positioning:sitting",
      "default": true
    },
    {
      "category": "kneeling",
      "componentId": "positioning:kneeling",
      "default": true
    },
    {
      "category": "lying_down",
      "componentId": "positioning:lying_down",
      "default": true
    },
    {
      "category": "straddling",
      "componentId": "positioning:straddling",
      "default": true
    },
    {
      "category": "standing",
      "componentId": "positioning:standing",
      "default": true
    },
    {
      "category": "facing",
      "componentId": "positioning:facing",
      "default": true
    }
  ]
}
```

### 3. Update Items Mod

```json
{
  "componentTypeRegistrations": [
    {
      "category": "container",
      "componentId": "containers-core:container",
      "default": true
    },
    { "category": "locked", "componentId": "items:locked", "default": true },
    {
      "category": "inventory",
      "componentId": "items:inventory",
      "default": true
    },
    { "category": "weight", "componentId": "items:weight", "default": true }
  ]
}
```

## Acceptance Criteria

- [ ] Manifest schema updated
- [ ] All 5 mods declare registrations
- [ ] Manifests validate against schema
- [ ] Mod loading registers types correctly
- [ ] Registry contains expected categories after loading

## Dependencies

HARMODREF-011 (registry must exist)

## Testing

```bash
npm run validate
npm run test:integration -- tests/integration/loaders/
```
