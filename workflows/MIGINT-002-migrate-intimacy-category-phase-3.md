# MIGINT-002: Migrate Intimacy Category Test Suites - Phase 3

## Objective

Complete the intimacy category migration by converting the final 8 test files from legacy patterns to ModTestFixture infrastructure, including complex rule tests and a special case file, achieving full category modernization.

## Background

Phases 1 and 2 will have successfully migrated 18 of the 27 intimacy test files to ModTestFixture. Phase 3 completes this effort by addressing the remaining files, which include:
- 2 standard action tests in the root directory
- 6 rule integration tests in the rules/ subdirectory  
- 1 special case test with custom setup pattern

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

### Special Case (1 file - evaluate for migration feasibility)
- `rules/closenessActionAvailability.integration.test.js`
  - Currently uses custom setup without createRuleTestEnvironment
  - Assess if ModTestFixture can support its requirements
  - May remain as-is if it tests cross-module functionality

## Implementation Strategy

### Phase 3A: Standard Action Tests (Files 1-2)
- Apply established ModTestFixture.forAction() pattern
- These should follow Phase 1/2 patterns closely
- Focus on maintaining consistency

### Phase 3B: Rule Integration Tests (Files 3-8)
- Adapt ModTestFixture for rule-specific testing
- May require different fixture initialization
- Consider if `ModTestFixture.forRule()` variant is needed
- Document any pattern adaptations required

### Phase 3C: Special Case Analysis
- Analyze closenessActionAvailability.integration.test.js requirements
- Determine if ModTestFixture can support its test scenarios
- If not suitable for migration:
  - Document why it remains different
  - Ensure it follows modern best practices
  - Consider creating a specialized test pattern

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
// May require adaptation for rule-specific testing
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../../common/mods/ModTestFixture.js';

describe('[rule_name] rule integration', () => {
  let testFixture;

  beforeEach(async () => {
    // Investigate if ModTestFixture supports rule testing
    // May need ModTestFixture.forRule() or similar
    testFixture = await ModTestFixture.forAction(
      'intimacy',
      'intimacy:[associated_action]',
      ruleFile
      // May need different initialization
    );
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
  - [ ] Both files migrated to ModTestFixture
  - [ ] Following established patterns
  - [ ] 80-90% code reduction achieved

- [ ] **Rule Integration Tests (6 files)**
  - [ ] Migration feasibility assessed for each
  - [ ] Migrated files use appropriate ModTestFixture pattern
  - [ ] Rule-specific adaptations documented
  - [ ] Test coverage maintained

- [ ] **Special Case Handling**
  - [ ] closenessActionAvailability.integration.test.js evaluated
  - [ ] Migration decision documented with rationale
  - [ ] If not migrated, modernization improvements applied
  - [ ] Pattern documented for similar future cases

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
   - Up to 8 files converted to ModTestFixture
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
- [ ] All feasible files migrated (target: 7-8 of 8)
- [ ] Overall intimacy category: >90% files on ModTestFixture
- [ ] Code reduction: Average 70%+ across Phase 3
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

- [ ] All 8 target files evaluated for migration
- [ ] Feasible files successfully migrated
- [ ] Non-migrated files have documented rationale
- [ ] All tests passing with acceptable performance
- [ ] Migration documentation complete
- [ ] Category migration considered complete