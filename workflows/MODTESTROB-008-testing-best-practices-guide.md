# MODTESTROB-008: Comprehensive Testing Best Practices Guide

**Status:** Ready for Implementation
**Priority:** P2 (Medium)
**Estimated Time:** 3-4 hours
**Risk Level:** Low
**Phase:** 3 - Documentation

---

## Overview

Create a comprehensive guide documenting best practices, patterns, and anti-patterns for mod action testing using the new testing infrastructure (validation proxy, diagnostic mode, domain matchers, scenario builders).

### Problem Statement

Current state:
- Testing knowledge scattered across individual test files
- No centralized documentation of best practices
- Developers repeat common mistakes
- Inconsistent testing approaches across mods
- New developers struggle to write effective tests

### Target State

Comprehensive guide providing:
- Clear testing patterns and examples
- Common pitfalls and how to avoid them
- Decision trees for tool selection
- Performance optimization tips
- Complete workflow examples

### Benefits

- **Faster onboarding** for new developers
- **Consistent testing quality** across all mods
- **Reduced debugging time** with better patterns
- **Knowledge sharing** of effective approaches
- **Reference documentation** for all testing tools

---

## Prerequisites

**Required Understanding:**
- All Phase 1 and Phase 2 improvements:
  - Action validation proxy (MODTESTROB-001)
  - Discovery diagnostic mode (MODTESTROB-002)
  - Enhanced error messages (MODTESTROB-003)
  - Scope resolver helpers (MODTESTROB-004)
  - Domain matchers (MODTESTROB-005)
  - Sitting scenarios (MODTESTROB-006)
  - Inventory scenarios (MODTESTROB-007)
- ModTestFixture API and patterns
- Jest testing framework

**Required Files:**
- All testing utilities from Phase 1 and Phase 2
- Existing test files for example extraction
- Documentation structure in `docs/testing/`

**Development Environment:**
- Markdown editing capabilities
- Access to codebase for examples

---

## Detailed Steps


### Step 1: Strengthen `docs/testing/mod-testing-guide.md`

- Re-use the existing guide as the single source of truth—do **not** introduce a new Markdown file.
- Add a "Best Practices" chapter that summarizes success patterns, anti-patterns, and test workflow guidance using the current infrastructure under `tests/common/mods/`.
- Ensure all examples reflect the real fixture API:
  ```javascript
  import { afterEach, beforeEach, describe, it, expect } from '@jest/globals';
  import { ModTestFixture } from '../../common/mods/ModTestFixture.js';

  describe('positioning:sit_down', () => {
    let fixture;

    beforeEach(async () => {
      fixture = await ModTestFixture.forAction('positioning', 'positioning:sit_down');
    });

    afterEach(() => {
      fixture.cleanup();
    });

    it('makes the actor sit on the target furniture', async () => {
      const scenario = fixture.createSittingPair({ furnitureId: 'couch1' });

      await fixture.executeAction(scenario.seatedActors[0].id, scenario.furniture.id);

      const actor = fixture.entityManager.getEntityInstance(scenario.seatedActors[0].id);
      expect(actor).toHaveComponent('positioning:sitting_on');
    });
  });
  ```
- Reference existing helper names (e.g., `createSittingPair`, `createInventoryLoadout`) instead of the deprecated `testEnv.scenarios.*` surface.
- Cross-link to the scenario catalog already documented in the same file instead of duplicating content.

### Step 2: Embed Troubleshooting Guidance Where Readers Already Look

- Append a troubleshooting appendix to `docs/testing/mod-testing-guide.md` that calls out discovery diagnostics, validation errors, and execution failures.
- Re-use the diagnostics helpers exported from `tests/common/mods/discoveryDiagnostics.js`; document them with accurate method names such as `fixture.enableDiagnostics()` and `fixture.discoverWithDiagnostics(actorId)`.
- Reference `docs/testing/action-discovery-testing-toolkit.md` for deep dives into discovery tracing instead of restating its content.
- Remove or rewrite any references to non-existent files (e.g., the previous `scope-resolver-helpers-guide.md`).

### Step 3: Surface Checklists Without Creating New Files

- Add an "Action Test Checklist" section at the end of `docs/testing/mod-testing-guide.md` so contributors can verify coverage without switching documents.
- Keep the checklist concise and aligned with actual APIs (`await fixture.executeAction(...)`, matcher utilities from `tests/common/actionMatchers.js`).
- If discovery-specific items arise, link directly to sections inside `docs/testing/action-discovery-testing-toolkit.md` rather than duplicating bullet lists.

---

## Validation Criteria

- Updated sections accurately describe `ModTestFixture.forAction(modId, actionId, ...)` and `fixture.executeAction(actorId, targetId, options?)`.
- Troubleshooting guidance points to existing utilities and omits dead links.
- The checklist lives inside an existing document and does not create redundant Markdown files.
- Cross-references to other guides (e.g., action discovery toolkit) resolve correctly.

---

## Files Updated

1. `docs/testing/mod-testing-guide.md`
2. `docs/testing/action-discovery-testing-toolkit.md` (only if additional cross-links or clarifications are required)
3. `docs/ModTestFixture-API-Usage.md` (sync API notes if examples are adjusted)

---

## Testing

```bash
# Validate Markdown formatting for updated docs
npx markdownlint docs/testing/*.md docs/ModTestFixture-API-Usage.md
```

---

## Rollback Plan

```bash
# Revert documentation updates
git checkout -- docs/testing/mod-testing-guide.md \
               docs/testing/action-discovery-testing-toolkit.md \
               docs/ModTestFixture-API-Usage.md
```

---

## Commit Strategy

```bash
git add docs/testing/mod-testing-guide.md docs/testing/action-discovery-testing-toolkit.md docs/ModTestFixture-API-Usage.md

git commit -m "docs(testing): tighten mod action testing guidance"
```

---

## Success Criteria

- Best-practice guidance consolidated in existing documentation without spawning new files.
- Examples and instructions mirror the current fixtures, helpers, and matcher APIs in `tests/common/mods/`.
- Troubleshooting content directs developers to the correct diagnostics utilities and discovery resources.
- Contributors can rely on a single checklist embedded in the primary guide.

---

## Next Steps

- Follow up with MODTESTROB-009 and MODTESTROB-010 to migrate legacy suites using the refreshed guidance.
- Periodically audit `docs/testing/` to keep examples synchronized with future fixture changes.

---

## Notes

- Coordinate with maintainers of the testing utilities when documenting new helpers to avoid drift.
- Prefer linking to existing deep-dive docs over repeating their content.
