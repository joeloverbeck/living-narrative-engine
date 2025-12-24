# ITEMSPLIT-000: Items Mod Granularization Overview

## Summary

Split the monolithic `items` mod (75 files) into 11+ focused, single-responsibility mods following the project's established granularity patterns (`-core`, `-states`, main mod separation).

## Motivation

The current `items` mod is a "kitchen-sink" containing unrelated features:
- Core item markers and inventory
- Aiming/targeting (weapons, flashlights)
- Drinking/consumption
- Reading (letters, books)
- Cosmetics (lipstick)
- Comfort items (teddy bears)
- Wielding state management
- Container-related entities

This violates the project's modular design where each mod has a single, focused responsibility.

## User Decisions

- **Namespaces**: Update to new mod namespaces (e.g., `items:aimable` → `aiming:aimable`)
- **Entities**: Keep with behavior mods (e.g., revolver with aiming mod)
- **States mods**: Create companion `-states` mods for aiming and wielding
- **Approach**: Incremental - one mod at a time

## Implementation Order

### Phase 1: Foundation (required first)
| Ticket | Mod | Purpose |
|--------|-----|---------|
| ITEMSPLIT-001 | `items-core` | Core item markers (`items:item`, `items:portable`) and foundational scopes |
| ITEMSPLIT-002 | `inventory` | Inventory component and transfer events |

### Phase 2: State Mods (before their action mods)
| Ticket | Mod | Purpose |
|--------|-----|---------|
| ITEMSPLIT-003 | `aiming-states` | `aiming:aimable`, `aiming:aimed_at` components |
| ITEMSPLIT-004 | `wielding-states` | Wielding state components |

### Phase 3: Feature Mods (any order after Phase 2)
| Ticket | Mod | Purpose |
|--------|-----|---------|
| ITEMSPLIT-005 | `aiming` | `aim_item`, `lower_aim` actions |
| ITEMSPLIT-006 | `wielding` | `unwield_item` action |
| ITEMSPLIT-007 | `drinking` | `drink_from`, `drink_entirely` actions |
| ITEMSPLIT-008 | `reading` | `read_item` action |
| ITEMSPLIT-009 | `cosmetics` | `apply_lipstick` action |
| ITEMSPLIT-010 | `comfort-items` | `hug_item_for_comfort` action |

### Phase 4: Cleanup
| Ticket | Task | Purpose |
|--------|------|---------|
| ITEMSPLIT-011 | Entity relocation | Move container/valuable entities to appropriate mods |
| ITEMSPLIT-012 | Cleanup | Delete or convert original items mod |

## Dependency Graph

```
                         core
                          │
                          ▼
                     items-core
                    /    |    \
                   /     |     \
                  ▼      ▼      ▼
           inventory  reading  (other simple mods)
              │
      ┌───────┴────────┬──────────┬─────────────┐
      │                │          │             │
      ▼                ▼          ▼             ▼
aiming-states   wielding-states  drinking   cosmetics
      │                │          │             │
      ▼                ▼          │             ▼
   aiming           wielding      │        comfort-items
```

## Per-Ticket Migration Steps

Each ticket follows this pattern:

1. Create mod directory structure
2. Create mod-manifest.json with correct dependencies
3. Move/copy relevant files from `items` mod
4. Update IDs to new namespace
5. Find and update all external references
6. Update related tests
7. Validate: `npm run validate && npm run test:unit && npm run test:integration`
8. Remove migrated files from original items mod

## Success Criteria

- [ ] All 11 new mods created and functional
- [ ] Original `items` mod deleted or converted to meta-dependency
- [ ] All tests passing
- [ ] No circular dependencies
- [ ] `npm run validate` passes

## Files Reference

Source: `data/mods/items/`
- 11 components
- 8 actions
- 8 rules
- 8 events
- 9 conditions
- 11 scopes
- 10 entity definitions + 1 instance

## Related

- Plan file: `/home/joeloverbeck/.claude/plans/parsed-humming-kay.md`
