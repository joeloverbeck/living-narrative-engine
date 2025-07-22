# Notes Migration to Structured Format - Implementation Workflow

## Project Overview

### Executive Summary
This workflow guides the complete migration of the Living Narrative Engine from supporting multiple notes formats (string, mixed arrays, structured objects) to a single, unified structured notes format. This migration will eliminate the `notesRaw` property confusion, remove 345+ lines of compatibility code, and establish a consistent data model throughout the system.

### Key Objectives
1. **Eliminate Legacy Support**: Remove all support for plain-text/legacy notes formats
2. **Property Standardization**: Rename all instances of `notesRaw` to `notes`
3. **Format Unification**: Establish structured notes as the only supported format
4. **Migration Support**: Provide utilities for existing save files
5. **Test Coverage**: Update all tests to validate only the structured format

### Expected Benefits
- **Code Reduction**: ~500 lines of compatibility/conversion code removed
- **Performance**: 10-20% improvement in note operations
- **Maintainability**: Single format reduces complexity
- **Consistency**: Unified schema across all components
- **Developer Experience**: Clear, unambiguous data model

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation Strategy |
|------|------------|--------|-------------------|
| Save file corruption | Low | Critical | Automatic backups, validation testing |
| UI rendering issues | Medium | High | Comprehensive UI testing, fallbacks |
| Mod incompatibility | High | Medium | Migration guide, compatibility warnings |
| Performance regression | Low | Medium | Benchmarking, profiling, optimization |
| Data loss | Low | Critical | Backup strategy, recovery tools |

### Success Criteria
- ✅ All unit tests passing (80%+ coverage maintained)
- ✅ All integration tests passing
- ✅ All E2E tests passing  
- ✅ Zero data loss during migration
- ✅ Performance benchmarks show improvement
- ✅ Mod author migration guide published
- ✅ User acceptance testing completed

## Phase 1: Schema Updates (Critical Priority)

**Duration**: 4-6 hours  
**Dependencies**: None  
**Risk Level**: High (foundational changes)

### Tasks

#### 1.1 Event Schema Updates
- [ ] **Update display_speech.event.json** (1 hour)
  - Change `notes` from string to array of structured notes
  - Add shared definition reference
  - Validate schema changes
  - **Acceptance**: Schema validation passes

- [ ] **Update entity_spoke.event.json** (1.5 hours)
  - Remove `notesRaw` property completely
  - Update `notes` to structured array format
  - Add shared definition reference
  - **Acceptance**: Schema validation passes, no notesRaw references

- [ ] **Update action_decided.event.json** (1 hour)
  - Remove `oneOf` mixed format support
  - Enforce structured notes array only
  - Add shared definition reference
  - **Acceptance**: Schema validation passes

#### 1.2 Shared Definition Setup
- [ ] **Create structuredNote definition** (1.5 hours)
  - Define required fields: text, subject, subjectType
  - Define optional fields: context, tags, timestamp
  - Add subjectType enumeration
  - Test definition reusability
  - **Acceptance**: Definition properly referenced in all schemas

### Phase 1 Validation Gate
- [ ] All schemas load without errors
- [ ] AJV validation tests pass
- [ ] No schema version conflicts

## Phase 2: Core Processing Updates

**Duration**: 6-8 hours  
**Dependencies**: Phase 1 complete  
**Risk Level**: Medium

### Tasks

#### 2.1 Build Speech Payload Updates
- [ ] **Update buildSpeechPayload.js** (2 hours)
  - Remove `notesRaw` parameter handling
  - Update destructuring to use `notes` only
  - Remove format conversion logic
  - Update tests
  - **Acceptance**: All speech payload tests pass

#### 2.2 Note Formatter Simplification
- [ ] **Refactor noteFormatter.js** (3 hours)
  - Remove string format handling
  - Remove mixed array handling
  - Simplify to structured format only
  - Update formatStructuredNote function
  - Create comprehensive tests
  - **Acceptance**: Formatter handles structured notes only

#### 2.3 Remove Compatibility Service
- [ ] **Delete notesCompatibilityService.js** (2 hours)
  - Remove file (345 lines)
  - Update all imports in dependent files
  - Verify no broken references
  - Run full test suite
  - **Acceptance**: No import errors, all tests pass

### Phase 2 Validation Gate
- [ ] Core processing tests pass
- [ ] No runtime errors in development environment
- [ ] Code coverage maintained at 80%+

## Phase 3: UI Component Updates

**Duration**: 4-5 hours  
**Dependencies**: Phase 2 complete  
**Risk Level**: Medium (user-facing changes)

### Tasks

#### 3.1 Build Speech Meta Updates
- [ ] **Update buildSpeechMeta.js** (2 hours)
  - Change `notesRaw` parameter to `notes`
  - Update destructuring
  - Test tooltip rendering
  - **Acceptance**: Tooltips display correctly

#### 3.2 Note Tooltip Formatter Updates
- [ ] **Update noteTooltipFormatter.js** (2.5 hours)
  - Ensure structured format only support
  - Update HTML generation
  - Add proper escaping
  - Test all note fields display
  - **Acceptance**: Rich HTML tooltips work correctly

### Phase 3 Validation Gate
- [ ] UI components render without errors
- [ ] Tooltips display all note fields
- [ ] No console errors in browser

## Phase 4: AI System Updates

**Duration**: 5-6 hours  
**Dependencies**: Phase 2 complete  
**Risk Level**: High (affects AI interactions)

### Tasks

#### 4.1 Notes Service Updates
- [ ] **Update notesService.js** (2 hours)
  - Remove compatibility imports
  - Remove format detection
  - Enforce structured validation
  - Update all methods
  - **Acceptance**: Service handles structured format only

#### 4.2 Notes Persistence Updates
- [ ] **Update notesPersistenceHook.js** (1.5 hours)
  - Remove legacy format handling
  - Add structured format validation
  - Update error handling
  - **Acceptance**: Persistence works with structured format

#### 4.3 Prompt Data Formatter Updates
- [ ] **Update promptDataFormatter.js** (2 hours)
  - Simplify formatNotesForPrompt
  - Remove format detection
  - Test prompt generation
  - **Acceptance**: Prompts generate correctly

### Phase 4 Validation Gate
- [ ] AI system tests pass
- [ ] Notes persist correctly
- [ ] Prompts include structured note data

## Phase 5: Test Suite Migration

**Duration**: 8-10 hours  
**Dependencies**: Phases 1-4 complete  
**Risk Level**: Low

### Tasks

#### 5.1 Event Validation Tests
- [ ] **Update entity spoke tests** (2 hours)
  - Remove legacy format tests
  - Add structured format tests
  - Test validation errors
  - **Acceptance**: All tests pass

- [ ] **Update action decided tests** (2 hours)
  - Remove mixed format tests
  - Test required fields validation
  - **Acceptance**: All tests pass

- [ ] **Update display speech tests** (1.5 hours)
  - Update to structured format
  - Test array validation
  - **Acceptance**: All tests pass

#### 5.2 Test Helper Creation
- [ ] **Create structuredNotesHelper.js** (2 hours)
  - Implement createValidNote
  - Implement createMinimalNote
  - Implement createNotesArray
  - Add documentation
  - **Acceptance**: Helpers used across test suite

#### 5.3 Update Remaining Tests
- [ ] **Update UI component tests** (1.5 hours)
- [ ] **Update processing tests** (1.5 hours)
- [ ] **Update integration tests** (1.5 hours)
  - **Acceptance**: All test suites pass

### Phase 5 Validation Gate
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Test coverage ≥80%

## Phase 6: Migration Utilities

**Duration**: 6-8 hours  
**Dependencies**: Phases 1-4 complete  
**Risk Level**: Critical (data migration)

### Tasks

#### 6.1 Notes Migration Utility
- [ ] **Create notesMigrationUtility.js** (3 hours)
  - Implement legacy format detection
  - Create migration methods
  - Add subject extraction logic
  - Comprehensive error handling
  - **Acceptance**: Utility migrates all formats correctly

#### 6.2 Save File Migration
- [ ] **Create saveFileMigration.js** (3 hours)
  - Implement save file scanner
  - Create entity migration
  - Create event log migration
  - Add version marking
  - **Acceptance**: Save files migrate without data loss

#### 6.3 Migration Testing
- [ ] **Test migration on sample data** (2 hours)
  - Test all legacy formats
  - Verify data integrity
  - Performance testing
  - **Acceptance**: 100% successful migration

### Phase 6 Validation Gate
- [ ] Migration utilities have 90%+ test coverage
- [ ] Sample data migrates successfully
- [ ] No data loss in migration

## Dependency Mapping

### Internal Dependencies
```
Phase 1 (Schemas) → Phase 2 (Core Processing)
                 ↘
                   Phase 3 (UI Components)
                 ↗
Phase 2 → Phase 4 (AI System)
       ↘
         Phase 5 (Test Suite)
       ↗
Phase 6 (Migration) → Can start after Phase 1
```

### External Dependencies
- **AJV**: Schema validation framework
- **Jest**: Testing framework
- **uuid**: ID generation for migration
- **lodash**: Utility functions

### Technical Dependencies
- Node.js environment for tooling
- Browser compatibility for UI components
- LLM proxy server compatibility

## Parallel Work Streams

### Stream A: Core Implementation (Phases 1-4)
**Team Size**: 2-3 developers  
**Focus**: Schema changes, processing updates, UI/AI modifications

### Stream B: Testing & Migration (Phases 5-6)
**Team Size**: 1-2 developers  
**Focus**: Test updates, migration utilities  
**Can Start**: After Phase 1 complete

### Communication Protocols
- Daily standup for progress sync
- Immediate notification of blocking issues
- PR reviews required before phase completion
- Shared tracking document for progress

## Quality Gates & Validation

### Pre-Implementation Checklist
- [x] Specification reviewed and approved
- [ ] Feature branch created
- [ ] Testing environment prepared
- [ ] Sample save files backed up
- [ ] Team briefed on changes

### Phase Completion Criteria
Each phase must meet:
- [ ] All tasks completed
- [ ] Code review passed
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] No regression in other features

### Testing Requirements
- **Unit Tests**: 80% coverage minimum
- **Integration Tests**: Critical paths covered
- **E2E Tests**: User workflows validated
- **Performance Tests**: Benchmark comparisons
- **Migration Tests**: Data integrity verified

### Performance Benchmarks
- Note operations: 10-20% faster
- Memory usage: ≤ current usage
- UI rendering: No perceptible lag
- Save/load times: ≤ current times

## Implementation Timeline

### Week 1
- **Day 1-2**: Phase 1 (Schema Updates)
- **Day 2-3**: Phase 2 (Core Processing)
- **Day 3-4**: Phase 3 (UI Components)
- **Day 4-5**: Phase 4 (AI System)

### Week 2
- **Day 6-7**: Phase 5 (Test Suite)
- **Day 7-8**: Phase 6 (Migration Utilities)
- **Day 8-9**: Integration testing
- **Day 9-10**: Performance testing & optimization

### Critical Path
Phase 1 → Phase 2 → Phase 4 (AI System updates are critical for functionality)

### Milestone Definitions
- **M1**: Schemas updated (End of Day 2)
- **M2**: Core processing complete (End of Day 3)
- **M3**: UI/AI updates complete (End of Day 5)
- **M4**: All tests passing (End of Day 7)
- **M5**: Migration ready (End of Day 8)

## Testing & Validation Strategy

### Unit Test Strategy
- Test each component in isolation
- Mock dependencies appropriately
- Focus on edge cases and error conditions
- Maintain 80%+ coverage

### Integration Test Scenarios
1. **Save/Load Cycle**: Ensure data persists correctly
2. **UI Display**: Verify notes render properly
3. **AI Integration**: Test prompt generation
4. **Event Flow**: Validate event handling

### E2E Test Cases
1. **User creates notes**: Through UI interaction
2. **Notes display**: In speech bubbles and tooltips
3. **Save game**: With structured notes
4. **Load game**: Notes restore correctly
5. **AI responds**: Using note context

### Performance Benchmarking
- Baseline current performance
- Measure after each phase
- Focus on:
  - Note parsing speed
  - UI rendering time
  - Memory consumption
  - Save/load duration

## Risk Mitigation Strategies

### Rollback Procedures
1. **Git Strategy**: Tag release before deployment
2. **Feature Flag**: Add migration toggle
3. **Compatibility Mode**: Temporary dual-format support
4. **Quick Revert**: Prepared rollback branch

### Data Backup Strategies
- Automatic save backup before migration
- Export original format option
- Cloud backup integration
- Version history retention

### Emergency Response
- **Hotline**: Direct contact for critical issues
- **Patches**: Quick fix deployment process
- **Communication**: User notification system
- **Support**: Help documentation ready

## Post-Implementation Tasks

### Documentation Updates
- [ ] Update CLAUDE.md with new patterns
- [ ] Create migration guide for mod authors
- [ ] Update API documentation
- [ ] Add format examples

### Mod Author Support
- [ ] Migration guide with examples
- [ ] Conversion utility provided
- [ ] Support forum monitored
- [ ] Video tutorial created

### Performance Monitoring
- [ ] Set up performance metrics
- [ ] Create monitoring dashboard
- [ ] Alert thresholds configured
- [ ] Weekly performance reviews

### User Acceptance Criteria
- [ ] Beta testing with key users
- [ ] Feedback collection system
- [ ] Issue tracking setup
- [ ] Success metrics defined

## Completion Checklist

### Technical Completion
- [ ] All code changes merged
- [ ] All tests passing
- [ ] Performance targets met
- [ ] Migration utility tested
- [ ] Documentation complete

### Quality Assurance
- [ ] Code review complete
- [ ] Security review passed
- [ ] Performance validated
- [ ] Accessibility checked
- [ ] Browser compatibility verified

### Deployment Readiness
- [ ] Production build created
- [ ] Deployment plan documented
- [ ] Rollback plan tested
- [ ] Monitoring configured
- [ ] Support team briefed

### Post-Launch
- [ ] User communications sent
- [ ] Mod author guide published
- [ ] Support channels active
- [ ] Metrics tracking live
- [ ] Retrospective scheduled

---

**Workflow Version**: 1.0  
**Last Updated**: [Current Date]  
**Status**: Ready for Implementation