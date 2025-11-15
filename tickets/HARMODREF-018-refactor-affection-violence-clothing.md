# HARMODREF-018: Refactor Affection, Violence, Clothing References

**Priority:** P1 - MEDIUM
**Effort:** 3 days
**Status:** Not Started

## Report Reference
[reports/hardcoded-mod-references-analysis.md](../reports/hardcoded-mod-references-analysis.md) - "Additional Non-Core Violations"

## Problem Statement
Refactor remaining non-core mod references in affection (5), violence (4), and clothing (6) systems.

## Affected Files
### Affection (5 refs)
- `src/ai/services/notesAnalyticsService.js:234`
- `src/characterBuilder/services/traitsRewriterGenerator.js:156`

### Violence (4 refs)
- `src/events/eventBusRecursionGuard.js:89`
- `src/logging/logMetadataEnricher.js:123`

### Clothing (6 refs)
- `src/anatomy/services/bodyDescriptionComposer.js:178`
- `src/domUI/components/portraitRenderer.js:245`

## Approach
1. Affection: Use Component Type Registry for affection lookups
2. Violence: Use generic event categorization
3. Clothing: Use Component Type Registry for clothing visibility

## Acceptance Criteria
- [ ] Zero hardcoded affection:* references
- [ ] Zero hardcoded violence:* references
- [ ] Zero hardcoded clothing:* references
- [ ] All functionality preserved
- [ ] Tests pass with >85% coverage

## Dependencies
HARMODREF-011 (registry available)
