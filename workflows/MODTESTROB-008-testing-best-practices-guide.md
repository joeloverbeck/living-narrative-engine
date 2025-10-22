# MODTESTROB-008: Comprehensive Testing Best Practices Guide

**Status:** Ready for Implementation
**Priority:** P2 (Medium)
**Estimated Time:** 3-4 hours
**Risk Level:** Low
**Phase:** 3 - Documentation

---

## Overview

Audit the existing mod testing documentation to ensure it accurately reflects the current testing infrastructure (validation proxy, diagnostic mode, domain matchers, scenario builders) and highlight any corrections that are still needed. The living source of truth already lives in `docs/testing/`; keep improvements focused on that material instead of authoring parallel guides.

### Problem Statement

Current state:
- The consolidated guidance in `docs/testing/mod-testing-guide.md` already captures best practices, scenario helpers, troubleshooting, and a checklist for action tests.
- Supplemental discovery instructions live in `docs/testing/action-discovery-testing-toolkit.md`.
- Periodic audits are required to keep examples aligned with the real fixture API and to remove stale references when helper names evolve.

### Target State

- Confirm the existing documentation remains accurate and matches the current helper names, imports, and workflow expectations.
- Identify and patch gaps only when a Phase 1/2 feature has changed behaviour without being reflected in the docs.
- Remove instructions that reference deprecated utilities or files that no longer exist.

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


### Step 1: Verify `docs/testing/mod-testing-guide.md`

- Treat the existing guide as the single source of truth—do **not** introduce a new Markdown file.
- Review the "Best Practices" and "Troubleshooting" chapters already present to confirm they reference real helpers under `tests/common/mods/`.
- Ensure all examples continue to reflect the real fixture API:
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
- Flag any drift between the guide and actual helper signatures so engineering can update the docs and/or utilities in tandem.

### Step 2: Keep Troubleshooting Guidance Accurate

- The troubleshooting appendix already lives inside `docs/testing/mod-testing-guide.md`; refresh it only when diagnostics helpers or error messaging change.
- Ensure the documented helpers (e.g., `fixture.enableDiagnostics()`, `fixture.discoverWithDiagnostics(actorId)`) match the exports from `tests/common/mods/discoveryDiagnostics.js`.
- Reference `docs/testing/action-discovery-testing-toolkit.md` for deep dives into discovery tracing instead of restating its content.
- Remove or rewrite any lingering references to non-existent files (e.g., the retired `scope-resolver-helpers-guide.md`).

### Step 3: Maintain the Embedded Checklist

- The "Action Test Checklist" already resides at the end of `docs/testing/mod-testing-guide.md`; update it only when fixture lifecycle expectations change.
- Keep the checklist aligned with actual APIs (`await fixture.executeAction(...)`, matcher utilities from `tests/common/actionMatchers.js`).
- If discovery-specific items arise, link directly to sections inside `docs/testing/action-discovery-testing-toolkit.md` rather than duplicating bullet lists.

---

## Validation Criteria

- Confirm the guide continues to accurately describe `ModTestFixture.forAction(modId, actionId, ...)` and `fixture.executeAction(actorId, targetId, options?)`.
- Troubleshooting guidance points to existing utilities and omits dead links.
- The checklist remains inside the canonical guide and avoids redundant Markdown files.
- Cross-references to other guides (e.g., action discovery toolkit) resolve correctly.

---

## Files Updated

1. `docs/testing/mod-testing-guide.md`
2. `docs/testing/action-discovery-testing-toolkit.md` (only if additional cross-links or clarifications are required)

---

## Testing

```bash
# Validate Markdown formatting for updated docs
npx markdownlint docs/testing/*.md
```

---

## Rollback Plan

```bash
# Revert documentation updates
git checkout -- docs/testing/mod-testing-guide.md \
               docs/testing/action-discovery-testing-toolkit.md
```

---

## Commit Strategy

```bash
git add docs/testing/mod-testing-guide.md docs/testing/action-discovery-testing-toolkit.md

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
