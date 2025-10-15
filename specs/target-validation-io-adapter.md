# Target Validation IO Adapter Overview

## Summary

The `TargetValidationIOAdapter` encapsulates the data-shape quirks that the
`TargetComponentValidationStage` previously handled inline. The adapter exposes
`normalize` and `rebuild` APIs so pipeline stages can operate on canonical
structures regardless of whether the upstream payload originated from
`actionsWithTargets` or `candidateActions`.

## Responsibilities

- **normalize(context)**
  - Detects the source payload (`actionsWithTargets`, `candidateActions`, or
    `empty`).
  - Produces an array of canonical items, each containing the action definition,
    resolved targets (including the actor), target definitions, placeholder
    metadata, and the original index/format.
  - Captures shared metadata (actor reference and shared resolved targets map)
    required to rebuild legacy payloads without additional context inspection.
- **rebuild(params)**
  - Restores the original structure using validated items while preserving
    ordering and updating shared resolved target references.
  - Sanitizes resolved target maps so downstream consumers no longer receive the
    implicit actor entry.

## Role Registry

`TargetRoleRegistry` centralizes the canonical role names (`target`, `primary`,
`secondary`, `tertiary`, and `actor`) and provides helpers for placeholder
lookups, requirement role extraction, and payload-shape detection. The
validation stage now consumes this registry instead of hard-coded arrays,
keeping role semantics consistent across future refactors.

## Testing Strategy

Unit tests snapshot the normalization output for the new adapter and verify
round-trip fidelity for both payload formats. Additional registry tests assert
role support, placeholder discovery, and legacy vs. multi-target detection.
