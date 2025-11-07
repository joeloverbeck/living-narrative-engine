# Archived Anatomy Documentation

This directory contains the original anatomy documentation files that have been consolidated into a streamlined set of 6 documents (down from 15).

## Consolidation Date

November 7, 2025

## What Happened?

The anatomy documentation was reorganized to:
- Reduce document count from 15 to 6 (60% reduction)
- Eliminate ~50% of redundant content
- Create clearer, more focused documents
- Improve discoverability and user experience
- Reduce long-term maintenance burden

## Archived Documents → New Documents

### Body Descriptor Documents (3 → 1)
**Archived:**
- `adding-body-descriptors.md`
- `body-descriptor-registry.md`
- `body-descriptor-validator-reference.md`

**New Document:**
- [body-descriptors-complete.md](../body-descriptors-complete.md) - Complete guide including registry, adding descriptors, and validation

### Architecture Documents (2 → 1)
**Archived:**
- `architecture.md`
- `refactoring-history.md`

**New Document:**
- [anatomy-system-guide.md](../anatomy-system-guide.md) - System architecture, design, and historical context

### Blueprint and Template Documents (2 → 1)
**Archived:**
- `blueprints-v2.md`
- `structure-templates.md`

**New Document:**
- [blueprints-and-templates.md](../blueprints-and-templates.md) - Blueprint V2 and structure templates

### Pattern Matching Documents (5 → 1)
**Archived:**
- `recipe-patterns.md`
- `pattern-matching-best-practices.md`
- `property-based-filtering-examples.md`
- `common-non-human-patterns.md`
- `v1-to-v2-pattern-migration.md`

**New Document:**
- [recipe-pattern-matching.md](../recipe-pattern-matching.md) - Comprehensive pattern matching guide

### Troubleshooting Documents (2 → 1)
**Archived:**
- `troubleshooting-parttype-subtype.md` (merged into main troubleshooting)

**Updated Document:**
- [troubleshooting.md](../troubleshooting.md) - Now includes partType/subType troubleshooting

### Unchanged Documents
**Kept as-is:**
- [non-human-quickstart.md](../non-human-quickstart.md) - End-to-end tutorial

## Migration Guide

If you have links to these archived documents:

| Old Document | New Document | Notes |
|-------------|--------------|-------|
| `architecture.md` | `anatomy-system-guide.md` | Architecture section |
| `refactoring-history.md` | `anatomy-system-guide.md` | Historical Context section |
| `body-descriptor-registry.md` | `body-descriptors-complete.md` | Registry Architecture section |
| `adding-body-descriptors.md` | `body-descriptors-complete.md` | Adding New Descriptors section |
| `body-descriptor-validator-reference.md` | `body-descriptors-complete.md` | Validation System section |
| `blueprints-v2.md` | `blueprints-and-templates.md` | Part 1 |
| `structure-templates.md` | `blueprints-and-templates.md` | Part 2 |
| `recipe-patterns.md` | `recipe-pattern-matching.md` | Parts 1-2 |
| `pattern-matching-best-practices.md` | `recipe-pattern-matching.md` | Part 3 |
| `property-based-filtering-examples.md` | `recipe-pattern-matching.md` | Part 2 |
| `common-non-human-patterns.md` | `recipe-pattern-matching.md` | Part 4 |
| `v1-to-v2-pattern-migration.md` | `recipe-pattern-matching.md` | Part 5 |
| `troubleshooting-parttype-subtype.md` | `troubleshooting.md` | partType/subType Mismatches section |

## Complete Consolidated Documentation Set

1. [anatomy-system-guide.md](../anatomy-system-guide.md) - System architecture and design
2. [body-descriptors-complete.md](../body-descriptors-complete.md) - Body descriptor system
3. [blueprints-and-templates.md](../blueprints-and-templates.md) - Blueprints and structure templates
4. [recipe-pattern-matching.md](../recipe-pattern-matching.md) - Pattern matching reference
5. [non-human-quickstart.md](../non-human-quickstart.md) - End-to-end tutorial
6. [troubleshooting.md](../troubleshooting.md) - Common issues and solutions

## Why Archive Instead of Delete?

These files are archived (not deleted) to:
- Preserve historical reference
- Allow easy recovery if needed
- Provide transition period for external links
- Document what content was consolidated where

## Questions?

See the main anatomy documentation index or refer to [anatomy-system-guide.md](../anatomy-system-guide.md) for the system overview.

---

**Consolidation Spec**: `specs/anatomy-docs-consolidation.spec.md`
**Date**: 2025-11-07
**Maintained By**: Living Narrative Engine Core Team
