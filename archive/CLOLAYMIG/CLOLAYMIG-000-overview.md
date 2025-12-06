# CLOLAYMIG-000: Clothing Layer Migration Overview

## Summary

Migrate 125 clothing entities from the monolithic `clothing` mod into 4 layer-specific mods, following the pattern established by the `armor` mod.

## Goals

1. **Separate concerns**: Each layer-specific mod owns entities of a single clothing layer
2. **Maintain shared infrastructure**: The `clothing` mod retains components, actions, rules, events, conditions, and scopes
3. **Update all references**: Entity IDs change from `clothing:*` to their new mod namespace
4. **Phased execution**: Minimize risk through layer-by-layer migration with validation checkpoints

## Non-Goals

- Modifying the clothing component schemas
- Changing the layer system itself
- Migrating the existing `armor` mod (already separate)
- Any behavioral changes to clothing mechanics

## New Mods

| Mod ID           | Layer       | Entity Count | Entity ID Pattern          |
| ---------------- | ----------- | ------------ | -------------------------- |
| `accessories`    | accessories | 14           | `accessories:item_name`    |
| `outer-clothing` | outer       | 10           | `outer-clothing:item_name` |
| `underwear`      | underwear   | 33           | `underwear:item_name`      |
| `base-clothing`  | base        | 68           | `base-clothing:item_name`  |

## Ticket Index

| Ticket        | Phase | Description                                                 | Dependencies                 |
| ------------- | ----- | ----------------------------------------------------------- | ---------------------------- |
| CLOLAYMIG-001 | 0     | Infrastructure setup - create mod directories and game.json | None                         |
| CLOLAYMIG-002 | 1a    | Accessories - create entities in new mod                    | CLOLAYMIG-001                |
| CLOLAYMIG-003 | 1b    | Accessories - update recipe references                      | CLOLAYMIG-002                |
| CLOLAYMIG-004 | 1c    | Accessories - remove from clothing mod                      | CLOLAYMIG-003                |
| CLOLAYMIG-005 | 2a    | Outer-clothing - create entities in new mod                 | CLOLAYMIG-001                |
| CLOLAYMIG-006 | 2b    | Outer-clothing - update recipe references                   | CLOLAYMIG-005                |
| CLOLAYMIG-007 | 2c    | Outer-clothing - remove from clothing mod                   | CLOLAYMIG-006                |
| CLOLAYMIG-008 | 3a    | Underwear - create entities in new mod                      | CLOLAYMIG-001                |
| CLOLAYMIG-009 | 3b    | Underwear - update recipe references                        | CLOLAYMIG-008                |
| CLOLAYMIG-010 | 3c    | Underwear - remove from clothing mod                        | CLOLAYMIG-009                |
| CLOLAYMIG-011 | 4a    | Base-clothing - create entities in new mod                  | CLOLAYMIG-001                |
| CLOLAYMIG-012 | 4b    | Base-clothing - update recipe references                    | CLOLAYMIG-011                |
| CLOLAYMIG-013 | 4c    | Base-clothing - remove from clothing mod                    | CLOLAYMIG-012                |
| CLOLAYMIG-014 | 5     | Final verification and documentation                        | CLOLAYMIG-004, 007, 010, 013 |

## Execution Order

Phases 1-4 can be executed in any order after Phase 0, but each phase (a → b → c) must be sequential:

```
Phase 0 (Infrastructure)
    │
    ├─→ Phase 1 (Accessories): 1a → 1b → 1c
    ├─→ Phase 2 (Outer): 2a → 2b → 2c
    ├─→ Phase 3 (Underwear): 3a → 3b → 3c
    └─→ Phase 4 (Base): 4a → 4b → 4c
              │
              └─→ Phase 5 (Final verification)
```

## Validation Commands

Run after each ticket completion:

```bash
npm run validate           # Schema and mod validation
npm run test:ci            # Full test suite
npm run test:integration   # Integration tests specifically
```

## Rollback Strategy

Each phase can be rolled back independently:

1. **Entity creation phase**: Delete new mod entity files, revert manifest
2. **Reference update phase**: Git revert the recipe/manifest changes
3. **Entity removal phase**: Restore deleted files from git history

Complete rollback: `git reset --hard <pre-migration-commit>`

## Reference Document

Full specification: `specs/clothing-layer-migration.md`
