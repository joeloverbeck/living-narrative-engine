# ITEMSPLIT-001: Create items-core Mod

## Status: ✅ COMPLETED (2025-12-24)

## Summary

Created the foundational `items-core` mod containing core item identification markers and basic location-based scopes. This mod was created first as all other item-related mods depend on it.

## Archive

See `archive/items-mod-split/ITEMSPLIT-001-completed.md` for full implementation details.

## Implementation Summary

### What Was Created

```
data/mods/items-core/
├── mod-manifest.json (id: "items-core", dependencies: [])
├── components/
│   ├── item.component.json (id: items-core:item)
│   ├── portable.component.json (id: items-core:portable)
│   └── openable.component.json (id: items-core:openable)
├── scopes/
│   ├── items_at_location.scope (id: items-core:items_at_location)
│   ├── items_at_actor_location.scope (id: items-core:items_at_actor_location)
│   └── non_portable_items_at_location.scope (id: items-core:non_portable_items_at_location)
└── conditions/
    └── secondary-has-portable.condition.json (id: items-core:secondary-has-portable)
```

### Key Implementation Decisions

1. **Namespace Changed to `items-core:`** - Per project convention, mod namespace must match mod name
2. **Dependencies**: `[]` (no dependencies - self-contained core markers)
3. **Scope Reduction**: 3 scopes instead of 5 (two depend on `items:inventory`)
4. **19 mods updated** with `items-core` dependency

### Validation Results

- ✅ `npm run validate` - PASSED (0 violations across 93 mods)
- ✅ Unit tests - PASSED (40,763 tests)
- ✅ Integration tests - PASSED for items-core related tests

## Blocks

- ITEMSPLIT-002 (inventory) - includes remaining scopes that depend on `items:inventory`
- ITEMSPLIT-003 through ITEMSPLIT-012 (other item-related mods)
