# MIGINT-002: Migrate Intimacy Category Test Suites - Phase 3

## Objective

Complete the intimacy category migration by converting the final 9 test files from legacy patterns to ModTestFixture infrastructure, including complex rule tests and a special case file, achieving full category modernization.

## Background

Phases 1 and 2 will have successfully migrated 18 of the 27 intimacy test files to ModTestFixture. Phase 3 completes this effort by addressing the remaining 9 files, which include:
- 2 standard action tests in the root directory
- 6 rule integration tests in the rules/ subdirectory  
- 1 special case test with custom setup pattern (recommended to AVOID migration)

This phase tackles the most complex migrations, including tests that may have unique validation requirements or cross-module dependencies.

## Dependencies

- **TSTAIMIG-010**: Phase 1 migration completed ✅
- **MIGINT-001**: Phase 2 migration (prerequisite)
- Established patterns from Phases 1 and 2
- Understanding of rule test complexities

## Target Files (Phase 3)

### Standard Action Tests (2 files)
1. `suck_on_neck_to_leave_hickey_action.test.js`
2. `suck_on_tongue.test.js`

### Rule Integration Tests (6 files in rules/ subdirectory)
3. `rules/brushHandRule.integration.test.js`
4. `rules/kissCheekRule.integration.test.js`
5. `rules/peckOnLipsRule.integration.test.js`
6. `rules/placeHandOnWaistRule.integration.test.js`
7. `rules/runFingersThroughHairRule.integration.test.js`
8. `rules/thumbWipeCheekRule.integration.test.js`

### Special Case (1 file - AVOID migration)
- `rules/closenessActionAvailability.integration.test.js`
  - Uses complex custom setup for positioning/intimacy integration
  - Tests cross-module dependencies with extensive manual handler setup
  - **RECOMMENDATION**: Do NOT migrate - modernize in-place instead
  - This file's complexity justifies keeping specialized test pattern

## Implementation Strategy

### Phase 3A: Standard Action Tests (Files 1-2)
- Apply established ModTestFixture.forAction() pattern
- These should follow Phase 1/2 patterns closely
- Focus on maintaining consistency

### Phase 3B: Rule Integration Tests (Files 3-8)
- Use ModTestFixture.forRule() for rule-specific testing
- Rule-specific fixture initialization available
- ModTestFixture.forRule() method exists and supports rule testing
- Document rule test patterns for future reference

### Phase 3C: Special Case Handling
- **Do NOT attempt migration** of closenessActionAvailability.integration.test.js
- This file has complex positioning/intimacy cross-module dependencies
- Instead, apply modern best practices to existing custom setup:
  - Code formatting and style improvements
  - Add missing JSDoc documentation
  - Ensure consistent error handling
- Document this as an acceptable exception to migration

## Implementation Patterns

### For Standard Action Tests
```javascript
// Continue using established pattern from Phases 1-2
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('intimacy:[action] action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'intimacy',
      'intimacy:[action_name]'
      // Auto-loading preferred
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  // Test implementation...
});
```

### For Rule Integration Tests
```javascript
// Pattern for rule-specific testing using ModTestFixture.forRule()
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../../common/mods/ModTestFixture.js';

describe('[rule_name] rule integration', () => {
  let testFixture;

  beforeEach(async () => {
    // Use ModTestFixture.forRule() for rule testing
    testFixture = await ModTestFixture.forRule(
      'intimacy',
      'intimacy:[rule_name]'
      // Auto-loading preferred, or explicit rule/condition files
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  // Rule-specific test scenarios...
});
```

## Special Considerations

### Rule Test Complexities
- Rule tests may validate multiple execution paths
- Could test rule conditions and outcomes separately
- May require more complex entity setups
- Possibly test rule interactions with other systems

### Cross-Module Dependencies
- Some rule tests may depend on positioning module
- closenessActionAvailability specifically tests positioning/intimacy interaction
- Ensure dependencies are properly handled

### Migration Decision Framework
For each file, evaluate:
1. Can ModTestFixture support the test requirements?
2. Would migration improve maintainability?
3. Is the effort justified by the benefits?
4. Would a custom pattern better serve this test?

## Acceptance Criteria

### Migration Requirements

- [ ] **Standard Action Tests (2 files)**
  - [ ] Both files migrated to ModTestFixture.forAction()
  - [ ] Following established patterns from Phase 1/2
  - [ ] 80-90% code reduction achieved

- [ ] **Rule Integration Tests (6 files)**
  - [ ] All 6 files migrated using ModTestFixture.forRule()
  - [ ] Rule-specific patterns documented
  - [ ] Auto-loading feature utilized where possible
  - [ ] Test coverage maintained with improved maintainability

- [ ] **Special Case Handling**
  - [ ] closenessActionAvailability.integration.test.js left unmigrated
  - [ ] Modernization improvements applied in-place
  - [ ] Decision rationale documented for future reference
  - [ ] Exception pattern established for complex cross-module tests

### Quality Metrics

- [ ] **Code Reduction**: 70-90% for migrated files (may be lower for complex rule tests)
- [ ] **Test Preservation**: 100% test case coverage maintained
- [ ] **Performance**: <30% regression threshold
- [ ] **Documentation**: Complete migration notes for all decisions

## Risk Management

### High-Risk Areas
1. **Rule Test Complexity**: May require new ModTestFixture capabilities
2. **Cross-Module Tests**: Dependencies might complicate migration
3. **Custom Patterns**: Some tests may genuinely need different approaches

### Mitigation Strategies
- Start with simpler files to build confidence
- Create proof-of-concept for rule test migration first
- Keep original files until migration is validated
- Be willing to leave complex tests unmigrated if justified

## Deliverables

1. **Migrated Test Files**
   - Up to 8 files converted to ModTestFixture (8 of 9 target files)
   - Appropriate patterns for each test type
   - Maintained test coverage and quality

2. **Migration Documentation**
   - Decision log for each file
   - Pattern adaptations for rule tests
   - Special case handling rationale

3. **Category Completion Report**
   - Final statistics on intimacy category migration
   - Lessons learned across all three phases
   - Recommendations for future categories

4. **Pattern Library Updates**
   - Rule test patterns if developed
   - Special case handling guidelines
   - Cross-module test strategies

## Success Metrics

### Quantitative
- [ ] All feasible files migrated (target: 8 of 9 files)
- [ ] Overall intimacy category: 26 of 27 files (96%) on ModTestFixture
- [ ] Code reduction: Average 70%+ across Phase 3 migrated files
- [ ] All tests passing without regression

### Qualitative
- [ ] Clear documentation of migration decisions
- [ ] Established patterns for complex test types
- [ ] Improved overall test maintainability
- [ ] Knowledge transfer for future migrations

## Next Steps

Upon Phase 3 completion:
- Intimacy category fully migrated (or consciously excepted)
- Patterns established for all test types
- Ready for validation phase
- Can proceed to next category or optimization phase

## Definition of Done

- [ ] All 9 target files evaluated for migration
- [ ] 8 feasible files successfully migrated
- [ ] 1 non-migrated file (closenessActionAvailability) has documented rationale
- [ ] All tests passing with acceptable performance
- [ ] Migration documentation complete
- [ ] Category migration considered complete (96% modernized)