# GOAP Dismantling Tickets (GOADISANA)

**Generated**: 2025-01-13
**Source**: `reports/goap-dismantling-analysis.md`
**Namespace**: GOADISANA (GOAP Dismantling Analysis)

## Overview

This directory contains 25 actionable tickets for the complete removal of the GOAP (Goal-Oriented Action Planning) system from the Living Narrative Engine. Each ticket is self-contained with complete context, detailed steps, acceptance criteria, and verification commands.

## Fatal Flaw Summary

The GOAP system attempted to auto-generate planning effects from execution rules, assuming planning-time filters would match execution-time filters. This approach failed because:
- Action discovery uses dynamic ScopeDSL queries requiring full world state traversal
- Prerequisites use JSON Logic with runtime-only data
- The planner cannot simulate future action availability without full execution context

## Ticket Organization

### Phase 1: Preparation & Safety (Tickets 001-003)
**Goal**: Create historical references and validate system before removal

- **GOADISANA-001**: Create Historical Reference Points (git tags, backup branches)
- **GOADISANA-002**: Validate Current System State (baseline tests, coverage)
- **GOADISANA-003**: Audit GOAP Dependencies (identify all references)

### Phase 2: Core Service Removal (Ticket 004)
**Goal**: Remove all GOAP implementation files

- **GOADISANA-004**: Remove GOAP Core Services Directory (9 service files)

### Phase 3: Dependency Injection Updates (Tickets 005-008)
**Goal**: Clean up DI system and replace provider with stub

- **GOADISANA-005**: Remove GOAP DI Token Definitions
- **GOADISANA-006**: Remove GOAP Service Registrations
- **GOADISANA-007**: Update Base Container Configuration
- **GOADISANA-008**: Replace GOAP Decision Provider with Stub

### Phase 4: Schema & Loader Cleanup (Tickets 009-011)
**Goal**: Remove GOAP schemas, verify goal schema

- **GOADISANA-009**: Remove Planning Effects Schema
- **GOADISANA-010**: Verify Action Schema Has No GOAP References
- **GOADISANA-011**: Verify Goal Schema Status (KEEP per user requirement)

### Phase 5: Test Suite Removal (Tickets 012-017)
**Goal**: Remove all GOAP test files (47 total)

- **GOADISANA-012**: Remove GOAP Unit Tests (13 files)
- **GOADISANA-013**: Remove GOAP Integration Tests (14 files)
- **GOADISANA-014**: Remove GOAP E2E Tests (16 files)
- **GOADISANA-015**: Remove GOAP Performance Tests (2 files)
- **GOADISANA-016**: Remove GOAP Memory Tests (1 file)
- **GOADISANA-017**: Remove GOAP Test Helpers (1 file)

### Phase 6: Documentation Cleanup (Tickets 018-020)
**Goal**: Remove GOAP documentation files

- **GOADISANA-018**: Remove GOAP Documentation (5 files in docs/goap/)
- **GOADISANA-019**: Remove GOAP Specifications (specs/goap-tier1-implementation.md)
- **GOADISANA-020**: Remove GOAP Brainstorming Files (preserved in git history)

### Phase 7: Verification & Quality Gates (Tickets 021-025)
**Goal**: Verify complete removal and system health

- **GOADISANA-021**: Verify No GOAP Import Errors (TypeScript, grep checks)
- **GOADISANA-022**: Verify Build System Works (bundle size reduced)
- **GOADISANA-023**: Verify All Tests Pass (remaining test suite)
- **GOADISANA-024**: Verify Player Type Routing Works (human, llm, goap stub)
- **GOADISANA-025**: Verify Application Startup (no DI errors)

## Dependency Flow

```
Sequential Dependencies:
Phase 1 (001-003) → Phase 2 (004) → Phase 3 (005-008) → Phase 4 (009-011) → Phase 5 (012-017) → Phase 6 (018-020) → Phase 7 (021-025)

Parallel Opportunities:
- Phase 4 tickets (009-011) can run in parallel
- Phase 5 tickets (012-017) can run in parallel
- Phase 6 tickets (018-020) can run in parallel

Critical Path:
001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 021 → 022 → 023 → 024 → 025
```

## Key Preservation Points

**DO NOT REMOVE** (preserved for future task-based system):
- `data/mods/core/components/player_type.component.json` - Entry point for player type routing
- `src/dependencyInjection/registrations/registerActorAwareStrategy.js` - Provider routing logic
- `src/turns/factories/actorAwareStrategyFactory.js` - Player type resolver
- `src/dependencyInjection/tokens/tokens-core.js` - IGoapDecisionProvider token (re-registerable)
- `src/loaders/goalLoader.js` - **KEEP per user requirement for future mod-based goals**
- Historical reports in `reports/` directory

## User Requirements

**EXCLUDED from removal** (per user specification):
- `src/loaders/goalLoader.js` - User wants to keep for future mod-based goals in 'goals/' folders
- `data/schemas/goal.schema.json` - May be needed by goalLoader (verified in GOADISANA-011)

## Ticket Usage

### Reading a Ticket
Each ticket is self-contained and includes:
1. **Context**: Why this work is needed (includes fatal flaw explanation)
2. **Objective**: Clear goal statement
3. **Files Affected**: Complete list of files to modify/remove
4. **Detailed Steps**: Step-by-step instructions
5. **Acceptance Criteria**: Measurable completion checks
6. **Dependencies**: Required prior tickets and what this blocks
7. **Verification Commands**: Exact commands to validate completion

### Executing a Ticket
1. Read the ticket completely before starting
2. Verify dependencies are complete
3. Follow detailed steps in order
4. Run verification commands
5. Check all acceptance criteria
6. Mark ticket complete only when all criteria met

### Tracking Progress
- Mark tickets complete as they're finished
- Document any deviations or issues
- Update README with progress status
- Create follow-up tickets if unexpected issues arise

## Removal Summary

| Category | Count | Action |
|----------|-------|--------|
| Source Code (GOAP Core) | 9 files | Remove |
| Source Code (DI) | 3 files | Remove (2 full, 1 partial update) |
| Source Code (Provider) | 1 file | Replace with stub |
| Unit Tests | 13 files | Remove |
| Integration Tests | 14 files | Remove |
| E2E Tests | 16 files | Remove |
| Performance Tests | 2 files | Remove |
| Memory Tests | 1 file | Remove |
| Test Helpers | 1 file | Remove |
| Documentation | 5 files | Remove |
| Specifications | 1 file | Remove |
| Brainstorming | 1 file | Remove |
| Schemas | 1 file | Remove (planning-effects) |
| **TOTAL** | **67 files** | **Remove/Update** |

## Completion Checklist

### Phase 1: Preparation
- [ ] GOADISANA-001: Historical reference points created
- [ ] GOADISANA-002: Current system validated
- [ ] GOADISANA-003: Dependencies audited

### Phase 2: Core Removal
- [ ] GOADISANA-004: GOAP services removed

### Phase 3: DI Updates
- [ ] GOADISANA-005: DI tokens removed
- [ ] GOADISANA-006: Service registrations removed
- [ ] GOADISANA-007: Container config updated
- [ ] GOADISANA-008: Provider stub implemented

### Phase 4: Schema Cleanup
- [ ] GOADISANA-009: Planning effects schema removed
- [ ] GOADISANA-010: Action schema verified clean
- [ ] GOADISANA-011: Goal schema status determined

### Phase 5: Test Removal
- [ ] GOADISANA-012: Unit tests removed
- [ ] GOADISANA-013: Integration tests removed
- [ ] GOADISANA-014: E2E tests removed
- [ ] GOADISANA-015: Performance tests removed
- [ ] GOADISANA-016: Memory tests removed
- [ ] GOADISANA-017: Test helpers removed

### Phase 6: Documentation
- [ ] GOADISANA-018: Documentation removed
- [ ] GOADISANA-019: Specifications removed
- [ ] GOADISANA-020: Brainstorming files removed

### Phase 7: Verification
- [ ] GOADISANA-021: No import errors
- [ ] GOADISANA-022: Build succeeds
- [ ] GOADISANA-023: All tests pass
- [ ] GOADISANA-024: Routing verified
- [ ] GOADISANA-025: Application starts

**When all checkboxes complete**: GOAP removal is SUCCESSFUL ✅

## Next Steps After Completion

1. Create final removal PR with comprehensive commit message
2. Tag release: `v1.x.x-goap-removed`
3. Update main README noting GOAP removal
4. Plan future task-based decision system implementation
5. Close all GOAP-related GitHub issues
6. Archive tickets/ directory or remove after merge

## Historical Reference

All removed code remains accessible:
- **Git tag**: `goap-before-removal`
- **Backup branch**: `backup/goap-implementation`
- **Historical reports**: `reports/goap-system-narrative-potential-blog-report.md`, `reports/goap-e2e-coverage-analysis.md`
- **Ticket backups**: Various files backed up in `tickets/` directory

## Future Implementation

When implementing task-based decision system:
- Use preserved player_type routing mechanism
- Replace GoapDecisionProvider stub with task-based implementation
- Do NOT use effects-generation approach
- Design explicit task primitives (not auto-generated from rules)
- Decompose tasks into actions at execution time, not planning time
