# Changelog

All notable changes to the Living Narrative Engine will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - Clothing Removal Blocking System (2025-11-12)

#### Overview

Comprehensive documentation for the clothing removal blocking system, which enforces realistic clothing physics by preventing removal of items that are secured by other items.

#### Added

- **Documentation**:
  - New modding guide: `docs/modding/clothing-blocking-system.md` - Complete guide for content creators
  - Updated `docs/modding/clothing-items.md` with removal blocking section
  - New troubleshooting guide: `docs/troubleshooting/clothing-blocking.md`
  - Updated `CLAUDE.md` with developer documentation for blocking system
  - Changelog entry for blocking system documentation

- **System Features Documented**:
  - `clothing:blocks_removal` component for declaring blocking rules
  - `isRemovalBlocked` JSON Logic operator for blocking evaluation
  - `ClothingAccessibilityService` for filtering blocked items
  - Scope filtering in `topmost_clothing` to hide blocked items
  - Belt entities updated to block pants removal
  - Comprehensive test suite for blocking scenarios

#### Documentation Highlights

- Clear examples for common use cases (belts, armor, multiple blockers)
- Troubleshooting guides for self-blocking, circular dependencies, performance
- Best practices for slot-based vs. item-specific blocking
- Testing workflows and debug procedures
- Integration points with scope resolution and action discovery

### Major Refactoring - Activity Description System (2025-11-01)

#### Overview

The Activity Description System has been completely refactored from a monolithic service into a clean facade pattern with 7 specialized services. This architectural transformation improves maintainability, testability, and separation of concerns while maintaining full backward compatibility.

#### Changed

**Architecture Transformation**:
- Refactored monolithic `ActivityDescriptionService` (previously ~2000+ lines) into:
  - **ActivityDescriptionFacade** (393 lines) - Clean facade layer
  - **ActivityDescriptionService** (1,078 lines) - Legacy API compatibility + delegation
  - 7 specialized services handling specific concerns

**Extracted Services**:
1. **ActivityCacheManager** (`src/anatomy/cache/activityCacheManager.js`)
   - Centralized caching with TTL support
   - Event-driven cache invalidation
   - Component-specific cache management

2. **ActivityIndexManager** (`src/anatomy/services/activityIndexManager.js`)
   - Activity index building and management
   - Slot-to-activity mapping
   - Efficient activity lookup

3. **ActivityMetadataCollectionSystem** (`src/anatomy/services/activityMetadataCollectionSystem.js`)
   - 3-tier metadata collection (entity → slot → part)
   - Activity sorting and prioritization
   - Metadata aggregation and merging

4. **ActivityNLGSystem** (`src/anatomy/services/activityNLGSystem.js`)
   - Natural language generation
   - Pronoun resolution
   - Description formatting

5. **ActivityGroupingSystem** (`src/anatomy/services/grouping/activityGroupingSystem.js`)
   - Sequential grouping with "and" conjunctions
   - Subject-verb-object grouping
   - Intelligent activity clustering

6. **ActivityContextBuildingSystem** (`src/anatomy/services/context/activityContextBuildingSystem.js`)
   - Context analysis and tone detection
   - Relationship context building
   - Situation-aware description generation

7. **ActivityFilteringSystem** (`src/anatomy/services/filtering/activityFilteringSystem.js`)
   - Condition-based filtering
   - Activity visibility rules
   - Context-aware filtering

#### Added

**New Services**:
- All 7 specialized services listed above with complete test coverage
- Migration tests for each service validating backward compatibility
- Comprehensive documentation in `docs/activity-description-system/`

**New Documentation**:
- `docs/activity-description-system/README.md` - System overview
- `docs/activity-description-system/architecture.md` - Architecture details
- `docs/activity-description-system/api-reference.md` - API documentation
- `docs/activity-description-system/testing-guide.md` - Testing strategies
- `docs/activity-description-system/integration-guide.md` - Integration instructions
- `docs/activity-description-system/troubleshooting.md` - Common issues
- `docs/activity-description-system/configuration-guide.md` - Configuration options
- `docs/activity-description-system/development-guide.md` - Development workflows
- `docs/activity-description-system/metadata-patterns.md` - Authoring guide

**New Tests**:
- Unit tests for all 7 specialized services
- Migration tests validating backward compatibility
- Integration tests for full pipeline
- Performance benchmarks
- Memory leak detection tests

#### Performance

- ✅ No performance regression
- ✅ Cache effectiveness maintained (>80% hit ratio)
- ✅ Service orchestration overhead minimal (<5ms)
- ✅ Memory usage stable (no leaks detected)

#### Testing

- **Unit Tests**: 51 tests pass (2 facades + services)
- **Integration Tests**: 7 tests pass (end-to-end workflows)
- **Performance Tests**: 9 tests pass (benchmarks + NLG)
- **Memory Tests**: 1 test pass (leak detection)
- **Migration Tests**: All services validated for backward compatibility

#### Code Quality Metrics

| Component | Size | Target | Status |
|-----------|------|--------|--------|
| ActivityDescriptionFacade | 393 lines | <500 | ✅ |
| ActivityDescriptionService | 1,078 lines | Legacy compat | ✅ |
| ActivityCacheManager | <400 lines | <400 | ✅ |
| ActivityIndexManager | <400 lines | <400 | ✅ |
| ActivityMetadataCollectionSystem | <400 lines | <400 | ✅ |
| ActivityNLGSystem | <400 lines | <400 | ✅ |
| ActivityGroupingSystem | <400 lines | <400 | ✅ |
| ActivityContextBuildingSystem | <400 lines | <400 | ✅ |
| ActivityFilteringSystem | <400 lines | <400 | ✅ |

#### Backward Compatibility

- ✅ **Full backward compatibility maintained**
- Legacy `ActivityDescriptionService` API unchanged
- All existing code continues to work without modification
- New `ActivityDescriptionFacade` available for clean API usage

#### Migration Path

For codebases using the old monolithic service, migration is **optional**:

**Option 1: No Changes Required** (Recommended for stability)
- Continue using `ActivityDescriptionService` as before
- All functionality works identically
- Service now delegates to specialized services internally

**Option 2: Migrate to New Facade** (Recommended for new code)
- Use `ActivityDescriptionFacade` for cleaner API
- Benefit from explicit service injection
- See `docs/migration/activity-description-service-refactoring.md` for details

#### Dependency Injection

All services registered in DI container:
- `IActivityCacheManager` → `ActivityCacheManager`
- `IActivityIndexManager` → `ActivityIndexManager`
- `IActivityMetadataCollectionSystem` → `ActivityMetadataCollectionSystem`
- `IActivityNLGSystem` → `ActivityNLGSystem`
- `IActivityGroupingSystem` → `ActivityGroupingSystem`
- `IActivityContextBuildingSystem` → `ActivityContextBuildingSystem`
- `IActivityFilteringSystem` → `ActivityFilteringSystem`

#### Related Tickets

- ACTDESSERREF-001 through ACTDESSERREF-012
- Complete refactoring project from monolithic to facade pattern

#### Credits

**Refactoring Project**:
- Tickets: ACTDESSERREF-001 to ACTDESSERREF-012
- Duration: 12 weeks (planned), completed on schedule
- Test Coverage: 100% of extracted services
- Documentation: Comprehensive system documentation

---

## Project History

### Earlier Changes

_Previous changelog entries will be added here as the project evolves._

---

**Note**: This is the first formal CHANGELOG for the Living Narrative Engine. Future changes will be documented here following semantic versioning and Keep a Changelog conventions.
