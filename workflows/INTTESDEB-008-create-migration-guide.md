# INTTESDEB-008: Create Migration Guide with Before/After Examples

## Metadata
- **Status**: Ready for Implementation
- **Priority**: Low (Phase 3)
- **Effort**: 0.5 days
- **Dependencies**: All Phase 1 and Phase 2 tickets (INTTESDEB-001 through INTTESDEB-006)
- **File Updated**: `/docs/testing/action-discovery-testing-toolkit.md`

## Problem Statement

Existing integration tests use old patterns (manual entity creation, generic assertions, no validation). Developers need:
1. **Step-by-step migration guide** from old to new patterns
2. **Before/after examples** showing the transformation
3. **Decision framework** for when to migrate
4. **Common pitfalls** to avoid during migration

Without a clear migration path, developers may be reluctant to adopt new utilities or may use them incorrectly.

## Acceptance Criteria

✅ **Migration Strategy Document**
- When to migrate (criteria for migration priority)
- Migration process (step-by-step)
- Backward compatibility notes
- Gradual adoption strategy

✅ **Before/After Examples**
- Complete test transformation examples
- Line-by-line comparison
- Explains benefits of each change
- Shows 50-70% code reduction

✅ **Common Migration Patterns**
- Manual entity creation → `createActorTargetScenario()`
- Generic assertions → custom matchers
- No validation → automatic validation
- No diagnostics → diagnostic discovery

✅ **Pitfall Guide**
- Common mistakes during migration
- How to debug migration issues
- Compatibility concerns
- Performance considerations

## Implementation Details

### Document Updates
- Extend `/docs/testing/action-discovery-testing-toolkit.md`; do **not** create a separate migration document.
- After the existing **Quick Start** section, insert a new "Migration Decision Guide" subsection containing the priority matrix (high/medium/low) and a concise benefits list. Reference existing utilities rather than restating matcher documentation from `action-discovery-testing-toolkit.md#domain-matchers`.
- Follow the new decision guide with a "Migration Workflow" section that walks through the refactor steps (imports, bed setup, entity creation, assertions, diagnostics) using the correct helper names from `tests/common/actions/actionDiscoveryServiceTestBed.js`.
- Keep headings aligned with the current table of contents. Update the doc TOC manually if anchors change.

### Example Transformation (embed inside "Migration Workflow")
Provide a before/after example that matches actual code paths and async APIs. Use the snippet below as the baseline and adjust copy to match the doc tone:

```javascript
// BEFORE: manual SimpleEntityManager wiring
import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';
import {
  createMockActionIndex,
  createMockLogger,
  createMockTargetResolutionService,
} from '../../common/mockFactories/index.js';

describe('Place Hands on Shoulders Action', () => {
  let entityManager;
  let service;

  beforeEach(() => {
    entityManager = new SimpleEntityManager();
    service = new ActionDiscoveryService({
      entityManager,
      logger: createMockLogger(),
      actionPipelineOrchestrator: {
        discoverActions: jest.fn().mockResolvedValue({ actions: [] }),
      },
      actionIndex: createMockActionIndex(),
      targetResolutionService: createMockTargetResolutionService(),
    });
  });

  it('discovers the action when actors are close', async () => {
    const actor = entityManager.createEntity('actor1');
    entityManager.addComponent('actor1', 'core:name', { text: 'Alice' });
    entityManager.addComponent('actor1', 'core:position', { locationId: 'tavern' });
    entityManager.addComponent('actor1', 'positioning:standing', {});

    const target = entityManager.createEntity('target1');
    entityManager.addComponent('target1', 'core:name', { text: 'Bob' });
    entityManager.addComponent('target1', 'core:position', { locationId: 'tavern' });

    entityManager.addComponent('actor1', 'positioning:closeness', { partners: ['target1'] });
    entityManager.addComponent('target1', 'positioning:closeness', { partners: ['actor1'] });

    const result = await service.getValidActions(actor, {});
    const hasAction = result.actions.some(
      (action) =>
        action.id === 'affection:place_hands_on_shoulders' &&
        action.targetId === 'target1'
    );

    expect(hasAction).toBe(true);
  });
});
```

```javascript
// AFTER: ActionDiscoveryServiceTestBed helpers
import { describe, it, beforeEach, expect } from '@jest/globals';
import { createActionDiscoveryBed } from '../../common/actions/actionDiscoveryServiceTestBed.js';
import '../../common/actionMatchers.js';

describe('Place Hands on Shoulders Action', () => {
  let testBed;

  beforeEach(() => {
    testBed = createActionDiscoveryBed();
  });

  it('discovers the action when actors are close', async () => {
    const { actor } = testBed.createActorTargetScenario({
      location: 'tavern',
      actorComponents: {
        'core:name': { text: 'Alice' },
        'positioning:standing': {},
      },
      targetComponents: {
        'core:name': { text: 'Bob' },
      },
    });

    const result = await testBed.discoverActionsWithDiagnostics(actor, {
      includeDiagnostics: true,
    });

    expect(result).toHaveAction('affection:place_hands_on_shoulders');
  });
});
```

Highlight the measurable deltas (line count, validation coverage, diagnostics) beneath the example.

### Step-by-Step Migration Content
- Reframe each step so it references existing helpers: `createActionDiscoveryBed`, `createActorTargetScenario`, `createActorWithValidation`, `establishClosenessWithValidation`, and the Jest matchers from `tests/common/actionMatchers.js`.
- Emphasise that `discoverActionsWithDiagnostics` is async and returns `{ actions, diagnostics? }`; all examples must use `await`.
- When describing assertions, point readers to the "Domain Matchers" section of `action-discovery-testing-toolkit.md#domain-matchers` instead of duplicating matcher docs. Note that custom matchers accept either the `{ actions }` object or the raw array.
- Call out the correct import paths for legacy utilities (e.g., `tests/common/mockFactories/entities.js` rather than non-existent `../../common/entityManager.js`).

### Diagnostics Guidance
- Encourage optional `traceScopeResolution` usage for flaky scenarios, but keep the default path lightweight.
- Show how to guard `formatDiagnosticSummary` behind a length check to avoid logging noise.

### Common Pattern Updates
- Expand the existing **Common Patterns** section with migration-specific subsections:
  - Multiple targets (use `createActorTargetScenario` + `createActorWithValidation`).
  - Kneeling or facing scenarios (demonstrate component overrides, mention validation catches wrong `entityId`).
  - Custom components or partial migrations (mixing manual entities with bed helpers).
- Wherever matcher usage is needed, link back to `action-discovery-testing-toolkit.md#domain-matchers`.

### Troubleshooting and FAQ Updates
- Within the doc's existing **Troubleshooting** section, add entries for:
  - "Bed factory not found" (forgotten relative import).
  - Async mistakes (missing `await` on `discoverActionsWithDiagnostics`).
  - Mixing SimpleEntityManager mocks with the bed (explain when to replace `testBed.mocks.entityManager`).
- Append an FAQ entry clarifying when manual setup is still appropriate (e.g., bespoke entity graphs) and how to layer validation in those cases (`ModEntityBuilder.validate()`).

## Testing Requirements
- Execute the before/after code locally (paste into a scratch test file) to confirm imports and async usage compile.
- Ensure the after example passes ESLint formatting when run through `npm run format`.
- Keep sample IDs/action IDs consistent with fixtures shipped in `tests/common/actions/actionDiscoveryServiceTestBed.js` to avoid confusing readers.

## Implementation Steps
1. Draft the new sections directly in `/docs/testing/action-discovery-testing-toolkit.md` following the outline above.
2. Verify that all helper/function names match the current exports in `tests/common/actions/actionDiscoveryServiceTestBed.js` and related mocks.
3. Update the document TOC if section headings change.
4. Run `npm run format` on the modified Markdown to maintain wrapping conventions.

## Success Metrics
- **Clarity**: Migration steps are easy to follow with accurate code references.
- **Completeness**: Covers the most common migration scenarios without duplicating matcher docs.
- **Usefulness**: Developers can migrate tests successfully and leverage diagnostics intentionally.
- **Adoption**: Developers reference the guide during migration, reducing ad-hoc Slack questions.

## Related Tickets
- **Documents Migration For**: All implementation tickets (INTTESDEB-001 through INTTESDEB-006)
- **Complements**: INTTESDEB-007 (Usage documentation)
- **Referenced By**: INTTESDEB-009 (Project docs)
- **Supports**: INTTESDEB-010 (Optional test migration)

## References
- Spec: `/specs/integration-test-debugging-improvements-revised.spec.md` (lines 1016-1041)
- Spec Example: Lines 1102-1240 (before/after comparison)
- All implementation tickets for feature references
