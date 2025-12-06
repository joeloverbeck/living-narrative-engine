# DISBODPARSPA-000: Dismembered Body Part Spawning - Overview

## Summary

Implement a system that spawns pickable body part entities when dismemberment occurs. When a body part is severed, a new physical entity should be created at the location of the affected character, allowing players/NPCs to interact with it (pick up, carry, use).

## Spec Reference

See: `specs/dismembered-body-part-spawning.md`

---

## Ticket Breakdown

### Phase 1: Schema & Event Foundation

| Ticket           | Title                                                       | Est. Size | Dependencies |
| ---------------- | ----------------------------------------------------------- | --------- | ------------ |
| DISBODPARSPA-001 | Add `definitionId` field to `anatomy:part` component schema | S         | None         |
| DISBODPARSPA-002 | Create `anatomy:body_part_spawned` event definition         | S         | None         |

### Phase 2: Entity Definition Weight Data (Data-Driven)

| Ticket           | Title                                                                                     | Est. Size | Dependencies |
| ---------------- | ----------------------------------------------------------------------------------------- | --------- | ------------ |
| DISBODPARSPA-010 | Add `items:weight` to human torso/limb entity definitions                                 | M         | None         |
| DISBODPARSPA-011 | Add `items:weight` to human head/face entity definitions                                  | M         | None         |
| DISBODPARSPA-012 | Add `items:weight` to human hair/extremity entity definitions                             | M         | None         |
| DISBODPARSPA-013 | Add `items:weight` to chicken entity definitions                                          | S         | None         |
| DISBODPARSPA-014 | Add `items:weight` to creature entity definitions (centaur, dragon, eldritch, cat, horse) | M         | None         |
| DISBODPARSPA-015 | Add `items:weight` to utility/generic entity definitions                                  | S         | None         |

### Phase 3: Core Code Implementation

| Ticket           | Title                                                                | Est. Size | Dependencies                       |
| ---------------- | -------------------------------------------------------------------- | --------- | ---------------------------------- |
| DISBODPARSPA-020 | Update EntityGraphBuilder to store `definitionId` in `anatomy:part`  | S         | DISBODPARSPA-001                   |
| DISBODPARSPA-021 | Create `DismemberedBodyPartSpawner` service                          | M         | DISBODPARSPA-001, DISBODPARSPA-002 |
| DISBODPARSPA-022 | Register `DismemberedBodyPartSpawner` in DI container and initialize | S         | DISBODPARSPA-021                   |

### Phase 4: Testing

| Ticket           | Title                                                    | Est. Size | Dependencies         |
| ---------------- | -------------------------------------------------------- | --------- | -------------------- |
| DISBODPARSPA-030 | Unit tests for `DismemberedBodyPartSpawner` service      | M         | DISBODPARSPA-021     |
| DISBODPARSPA-031 | Unit tests for EntityGraphBuilder `definitionId` storage | S         | DISBODPARSPA-020     |
| DISBODPARSPA-032 | Integration tests for dismemberment spawning flow        | M         | DISBODPARSPA-022     |
| DISBODPARSPA-033 | Data validation tests for body part weight completeness  | S         | DISBODPARSPA-010-015 |

---

## Size Legend

- **S (Small)**: < 50 lines changed, single file or straightforward multi-file
- **M (Medium)**: 50-200 lines, 2-5 files, moderate complexity
- **L (Large)**: 200+ lines, 5+ files, high complexity

---

## Dependency Graph

```
DISBODPARSPA-001 ─────────────────────┬─► DISBODPARSPA-020 ─► DISBODPARSPA-031
(anatomy:part schema)                 │
                                      │
DISBODPARSPA-002 ─────────────────────┼─► DISBODPARSPA-021 ─► DISBODPARSPA-022 ─► DISBODPARSPA-032
(body_part_spawned event)             │   (Spawner service)   (DI registration)   (Integration tests)
                                      │
                                      └─► DISBODPARSPA-030
                                          (Unit tests)

DISBODPARSPA-010 ─┐
DISBODPARSPA-011 ─┼─► DISBODPARSPA-033 (Validation tests)
DISBODPARSPA-012 ─┤
DISBODPARSPA-013 ─┤
DISBODPARSPA-014 ─┤
DISBODPARSPA-015 ─┘
```

---

## Recommended Execution Order

1. **Parallelizable**: DISBODPARSPA-001, DISBODPARSPA-002, DISBODPARSPA-010-015 (all independent)
2. **After Phase 1**: DISBODPARSPA-020 (depends on 001)
3. **After 001 & 002**: DISBODPARSPA-021 (core service)
4. **After 021**: DISBODPARSPA-022 (DI registration)
5. **Testing**: DISBODPARSPA-030, 031, 032, 033 (after respective implementations)

---

## Open Questions (from spec)

These should be resolved before or during implementation:

1. **Missing Weight Handling**: If a body part definition lacks `items:weight`, use default 1.0 kg and log warning
2. **Internal Organs**: Internal organs (brain, heart) SHOULD spawn when dismembered
3. **Original Part**: The original body part entity remains in the character's anatomy graph (as `anatomy:dismembered` marker); the spawned entity is a NEW separate item

---

## Success Criteria

- [ ] When a character's body part is dismembered via APPLY_DAMAGE, a new pickable entity spawns at their location
- [ ] The spawned entity has the correct name format: "[Character]'s [orientation] [part type]"
- [ ] The spawned entity can be picked up via standard pick_up action
- [ ] All 214 body part definitions have realistic `items:weight` values
- [ ] All tests pass with > 80% coverage on new code
