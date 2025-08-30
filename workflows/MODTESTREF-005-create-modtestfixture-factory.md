# MODTESTREF-005: Create ModTestFixture Factory

## Overview

Create a unified factory system that orchestrates all infrastructure components (ModTestHandlerFactory, ModEntityBuilder, ModAssertionHelpers, ModActionTestBase) to provide simple, declarative test creation. This factory will be the primary entry point for creating mod tests and will eliminate the need for manual infrastructure coordination.

## Problem Statement

### Current Integration Complexity

Even with base classes, creating mod tests requires multiple steps and coordination:

```javascript
// Still requires manual orchestration
import { ModActionTestBase } from '../common/mods/ModActionTestBase.js';
import kissCheekRule from '../../data/mods/intimacy/rules/kissRule.rule.json';
import eventIsActionKissCheek from '../../data/mods/intimacy/conditions/eventIsActionKissCheek.condition.json';

class KissCheekActionTest extends ModActionTestBase {
  constructor() {
    super({
      modId: 'intimacy',
      actionId: 'kiss_cheek',
      ruleFile: kissCheekRule,
      conditionFile: eventIsActionKissCheek,
      handlerType: 'intimacy',
    });
  }
}

describe('intimacy:kiss_cheek action integration', () => {
  let test;

  beforeEach(() => {
    test = new KissCheekActionTest();
    test.beforeEach();
  });

  // Test implementation
});
```

### Remaining Pain Points

- **Manual Class Creation**: Each test requires creating a custom class
- **File Import Management**: Multiple imports for rule/condition files
- **Configuration Duplication**: Repeated configuration patterns
- **No Convention-Based Defaults**: Must specify everything manually
- **Category-Specific Logic**: Each category has different requirements

### Impact

- **Barrier to Entry**: Still complex for new mod test development
- **Inconsistent Patterns**: Different approaches across test files
- **Maintenance Overhead**: Changes require updating multiple files
- **Knowledge Requirements**: Developers need to understand all infrastructure pieces

## Technical Requirements

### Factory Interface Design

**File Location**: `tests/common/mods/ModTestFixture.js`

**Dependencies**:

```javascript
// Base classes
import { ModActionTestBase } from './ModActionTestBase.js';
import { ModRuleTestBase } from './ModRuleTestBase.js';

// Category-specific extensions
import { ModPositioningTestBase } from './ModPositioningTestBase.js';
import { ModIntimacyTestBase } from './ModIntimacyTestBase.js';

// File system utilities for dynamic loading
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Validation
import {
  assertNonBlankString,
  assertPresent,
} from '../../src/utils/validationCore.js';
```

### Primary Factory Interface

```javascript
class ModTestFixture {
  // Primary factory methods
  static forAction(modId, actionId, options = {}) {
    // Creates action test fixture with auto-detection
  }

  static forRule(modId, ruleId, options = {}) {
    // Creates rule test fixture with auto-detection
  }

  static forCategory(categoryName, actionId, options = {}) {
    // Creates category-specific test fixture
  }

  // Convenience methods
  static forPositioningAction(actionId, options = {}) {
    // Shorthand for positioning category
  }

  static forIntimacyAction(actionId, options = {}) {
    // Shorthand for intimacy category
  }

  static forSexAction(actionId, options = {}) {
    // Shorthand for sex category
  }

  static forViolenceAction(actionId, options = {}) {
    // Shorthand for violence category
  }

  static forExerciseAction(actionId, options = {}) {
    // Shorthand for exercise category
  }

  // Advanced factory methods
  static custom(config) {
    // Fully custom configuration
  }

  static fromConfig(configObject) {
    // Create from configuration object
  }

  // Utility methods
  static detectCategory(modId, actionId) {
    // Auto-detect category based on mod structure
  }

  static loadModFiles(modId, actionId) {
    // Auto-load rule and condition files
  }

  static getDefaultConfig(category) {
    // Get default configuration for category
  }
}
```

### Auto-Detection and Convention System

**File Path Conventions**:

```javascript
// Expected file locations for auto-loading
const MOD_FILE_CONVENTIONS = {
  rules: 'data/mods/{modId}/rules/{actionId}Rule.rule.json',
  conditions:
    'data/mods/{modId}/conditions/eventIsAction{ActionId}.condition.json',
  alternativeRules: 'data/mods/{modId}/actions/{actionId}.rule.json',
  alternativeConditions:
    'data/mods/{modId}/conditions/{actionId}.condition.json',
};

// Category detection patterns
const CATEGORY_PATTERNS = {
  positioning: [
    'kneel',
    'stand',
    'sit',
    'lie',
    'turn',
    'move',
    'place_yourself',
  ],
  intimacy: ['kiss', 'hug', 'cuddle', 'embrace', 'caress', 'nuzzle', 'lean'],
  sex: ['fondle', 'rub', 'touch', 'press_against', 'suck', 'pump'],
  violence: ['slap', 'punch', 'hit', 'strike', 'attack'],
  exercise: ['show_off', 'flex', 'exercise', 'workout'],
};
```

**Auto-Detection Logic**:

```javascript
static detectCategory(modId, actionId) {
  // Check explicit mod-based categories first
  if (modId === 'positioning') return 'positioning';
  if (modId === 'intimacy') return 'intimacy';
  if (modId === 'sex') return 'sex';
  if (modId === 'violence') return 'violence';
  if (modId === 'exercise') return 'exercise';

  // Check action ID patterns
  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    if (patterns.some(pattern => actionId.includes(pattern))) {
      return category;
    }
  }

  // Default to standard if no pattern matches
  return 'standard';
}
```

### Implementation Details

**Primary Factory Method**:

```javascript
static forAction(modId, actionId, options = {}) {
  assertNonBlankString(modId, 'Mod ID', 'ModTestFixture.forAction');
  assertNonBlankString(actionId, 'Action ID', 'ModTestFixture.forAction');

  try {
    // Auto-detect category if not specified
    const category = options.category || this.detectCategory(modId, actionId);

    // Load mod files automatically
    const { ruleFile, conditionFile } = this.loadModFiles(modId, actionId, options);

    // Get category-specific configuration
    const defaultConfig = this.getDefaultConfig(category);

    // Build complete configuration
    const config = {
      ...defaultConfig,
      ...options,
      modId,
      actionId,
      ruleFile,
      conditionFile,
      testCategory: category
    };

    // Create appropriate base class instance
    return this.createTestInstance(category, config);

  } catch (error) {
    throw new Error(`ModTestFixture.forAction failed for ${modId}:${actionId}: ${error.message}`);
  }
}
```

**File Loading System**:

```javascript
static loadModFiles(modId, actionId, options = {}) {
  const errors = [];
  let ruleFile = null;
  let conditionFile = null;

  // Try explicit file paths first
  if (options.ruleFile) {
    ruleFile = options.ruleFile;
  }
  if (options.conditionFile) {
    conditionFile = options.conditionFile;
  }

  // Auto-load rule file if not provided
  if (!ruleFile) {
    const rulePaths = [
      `data/mods/${modId}/rules/${actionId}Rule.rule.json`,
      `data/mods/${modId}/actions/${actionId}.rule.json`,
      `data/mods/${modId}/rules/${actionId}.rule.json`
    ];

    for (const path of rulePaths) {
      try {
        ruleFile = require(resolve(path));
        break;
      } catch (error) {
        errors.push(`Failed to load rule from ${path}: ${error.message}`);
      }
    }
  }

  // Auto-load condition file if not provided
  if (!conditionFile) {
    const actionIdCapitalized = actionId.charAt(0).toUpperCase() + actionId.slice(1);
    const conditionPaths = [
      `data/mods/${modId}/conditions/eventIsAction${actionIdCapitalized}.condition.json`,
      `data/mods/${modId}/conditions/${actionId}.condition.json`,
      `data/mods/${modId}/conditions/eventIsAction${actionId}.condition.json`
    ];

    for (const path of conditionPaths) {
      try {
        conditionFile = require(resolve(path));
        break;
      } catch (error) {
        errors.push(`Failed to load condition from ${path}: ${error.message}`);
      }
    }
  }

  // Validate required files were loaded
  if (!ruleFile) {
    throw new Error(`Could not load rule file for ${modId}:${actionId}. Errors: ${errors.join(', ')}`);
  }
  if (!conditionFile) {
    throw new Error(`Could not load condition file for ${modId}:${actionId}. Errors: ${errors.join(', ')}`);
  }

  return { ruleFile, conditionFile };
}
```

**Test Instance Creation**:

```javascript
static createTestInstance(category, config) {
  switch (category) {
    case 'positioning':
      return new ModPositioningTestBase(config);
    case 'intimacy':
      return new ModIntimacyTestBase(config);
    case 'sex':
      return new ModSexTestBase(config);
    case 'violence':
      return new ModViolenceTestBase(config);
    case 'exercise':
      return new ModExerciseTestBase(config);
    default:
      return new ModActionTestBase(config);
  }
}
```

**Default Configuration by Category**:

```javascript
static getDefaultConfig(category) {
  const configs = {
    positioning: {
      handlerType: 'positioning',
      defaultLocation: 'room1',
      requiresCloseness: true,
      componentsToCheck: ['positioning:closeness']
    },
    intimacy: {
      handlerType: 'intimacy',
      defaultLocation: 'room1',
      requiresCloseness: true,
      intimacyLevel: 'close'
    },
    sex: {
      handlerType: 'standard',
      requiresAnatomy: true,
      requiresCloseness: true,
      explicitContent: true
    },
    violence: {
      handlerType: 'standard',
      requiresAnatomy: false,
      conflictType: 'physical'
    },
    exercise: {
      handlerType: 'standard',
      requiresCloseness: false,
      actorFocus: true
    },
    standard: {
      handlerType: 'standard',
      defaultLocation: 'room1'
    }
  };

  return configs[category] || configs.standard;
}
```

### Convenience Methods

**Category-Specific Shortcuts**:

```javascript
static forPositioningAction(actionId, options = {}) {
  return this.forCategory('positioning', actionId, options);
}

static forIntimacyAction(actionId, options = {}) {
  return this.forCategory('intimacy', actionId, options);
}

static forSexAction(actionId, options = {}) {
  return this.forCategory('sex', actionId, options);
}

static forViolenceAction(actionId, options = {}) {
  return this.forCategory('violence', actionId, options);
}

static forExerciseAction(actionId, options = {}) {
  return this.forCategory('exercise', actionId, options);
}
```

**Advanced Configuration**:

```javascript
static custom(config) {
  assertPresent(config, 'Configuration is required for custom fixture');
  assertNonBlankString(config.modId, 'Mod ID', 'ModTestFixture.custom');
  assertNonBlankString(config.actionId, 'Action ID', 'ModTestFixture.custom');

  const category = config.testCategory || 'standard';
  return this.createTestInstance(category, config);
}

static fromConfig(configObject) {
  // Load configuration from external object (for CI/automation)
  return this.custom(configObject);
}
```

### Usage Patterns

**Before (manual base class setup)**:

```javascript
import { ModActionTestBase } from '../common/mods/ModActionTestBase.js';
import kissCheekRule from '../../data/mods/intimacy/rules/kissRule.rule.json';
import eventIsActionKissCheek from '../../data/mods/intimacy/conditions/eventIsActionKissCheek.condition.json';

class KissCheekActionTest extends ModActionTestBase {
  constructor() {
    super({
      modId: 'intimacy',
      actionId: 'kiss_cheek',
      ruleFile: kissCheekRule,
      conditionFile: eventIsActionKissCheek,
      handlerType: 'intimacy',
    });
  }
}

describe('intimacy:kiss_cheek action integration', () => {
  let test;

  beforeEach(() => {
    test = new KissCheekActionTest();
    test.beforeEach();
  });
});
```

**After (fixture factory)**:

```javascript
import { ModTestFixture } from '../common/mods/ModTestFixture.js';

describe('intimacy:kiss_cheek action integration', () => {
  let test;

  beforeEach(() => {
    test = ModTestFixture.forAction('intimacy', 'kiss_cheek');
    test.beforeEach();
  });

  // Or even simpler for intimacy category
  // test = ModTestFixture.forIntimacyAction('kiss_cheek');
});
```

**Ultra-Simple Usage**:

```javascript
import { ModTestFixture } from '../common/mods/ModTestFixture.js';

describe('positioning:kneel_before action integration', () => {
  let test;

  beforeEach(() => {
    // Auto-detects category, loads files, configures everything
    test = ModTestFixture.forAction('positioning', 'kneel_before');
    test.beforeEach();
  });

  it('should execute kneeling action successfully', async () => {
    const { actor, target } = test.createCloseActors(['Alice', 'Bob']);
    test.resetWithEntities([actor, target]);

    await test.executeAction(actor.id, target.id);
    test.assertActionSuccess();
    test.assertPositionChanged(actor.id, 'kneeling_before');
  });
});
```

### Error Handling and Fallbacks

**File Loading Error Handling**:

```javascript
static loadModFiles(modId, actionId, options = {}) {
  try {
    // Primary loading logic
    return this.tryLoadModFiles(modId, actionId, options);
  } catch (error) {
    // Try fallback locations
    return this.tryFallbackLocations(modId, actionId, options, error);
  }
}

static tryFallbackLocations(modId, actionId, options, originalError) {
  const fallbacks = this.getFallbackPaths(modId, actionId);

  for (const fallback of fallbacks) {
    try {
      return this.loadFromPath(fallback.rule, fallback.condition);
    } catch (fallbackError) {
      // Continue to next fallback
    }
  }

  // All fallbacks failed
  throw new Error(`Could not load mod files for ${modId}:${actionId}. Original error: ${originalError.message}`);
}
```

**Category Detection Fallbacks**:

```javascript
static detectCategory(modId, actionId) {
  // Try explicit mod name mapping first
  const explicitCategory = this.getExplicitCategory(modId);
  if (explicitCategory) return explicitCategory;

  // Try action pattern matching
  const patternCategory = this.matchActionPatterns(actionId);
  if (patternCategory) return patternCategory;

  // Try mod file location analysis
  const locationCategory = this.analyzeModFileLocations(modId);
  if (locationCategory) return locationCategory;

  // Default fallback
  return 'standard';
}
```

## Implementation Steps

### Step 1: Create Factory Core Structure

1. Create `tests/common/mods/ModTestFixture.js`
2. Implement basic factory interface with `forAction` and `forRule` methods
3. Add auto-detection logic for categories
4. Implement file loading system with convention-based paths

### Step 2: Implement Auto-Loading System

1. Add file system utilities for dynamic mod file loading
2. Implement convention-based file path resolution
3. Add fallback mechanisms for non-standard file locations
4. Test auto-loading with existing mod structures

### Step 3: Add Category-Specific Logic

1. Implement category detection based on mod ID and action patterns
2. Add default configurations for each category
3. Create category-specific test instance factories
4. Add convenience methods for each category

### Step 4: Integrate with Base Classes

1. Wire factory to create appropriate base class instances
2. Test integration with all existing base classes
3. Add configuration override capabilities
4. Validate configuration propagation

### Step 5: Add Error Handling and Validation

1. Implement comprehensive error handling for file loading
2. Add validation for configuration objects
3. Create helpful error messages for common issues
4. Add diagnostic utilities for troubleshooting

## Validation & Testing

### Unit Tests Required

**File**: `tests/unit/common/mods/ModTestFixture.test.js`

**Test Coverage**:

```javascript
describe('ModTestFixture', () => {
  describe('forAction', () => {
    it('should create action test fixture with auto-detection');
    it('should load rule and condition files automatically');
    it('should detect category based on mod ID and action patterns');
    it('should apply default configuration for detected category');
    it('should throw error when files cannot be loaded');
  });

  describe('category detection', () => {
    it('should detect positioning category from mod ID');
    it('should detect intimacy category from action patterns');
    it('should detect sex category from action keywords');
    it('should default to standard when no pattern matches');
  });

  describe('file loading', () => {
    it('should load files from conventional paths');
    it('should try multiple path conventions');
    it('should use provided files when specified');
    it('should provide helpful error messages when files missing');
  });

  describe('convenience methods', () => {
    it('should create positioning fixtures with forPositioningAction');
    it('should create intimacy fixtures with forIntimacyAction');
    it('should apply category-specific defaults correctly');
  });

  describe('custom configuration', () => {
    it('should create fixtures from custom config object');
    it('should override defaults with custom options');
    it('should validate required configuration parameters');
  });
});
```

### Integration Testing

1. Test fixture creation with real mod files from all categories
2. Verify auto-detection works with existing mod structures
3. Test error scenarios with missing or malformed files
4. Validate integration with all base class types

### File System Testing

1. Test file loading with various mod directory structures
2. Verify convention-based path resolution works correctly
3. Test fallback mechanisms with non-standard file locations
4. Validate error handling for file system issues

## Acceptance Criteria

### Functional Requirements

- [ ] Factory creates test fixtures with minimal configuration
- [ ] Auto-detection correctly identifies mod categories
- [ ] File loading handles various mod directory structures
- [ ] Convenience methods provide category-specific shortcuts
- [ ] Error handling provides actionable error messages
- [ ] Configuration overrides work correctly

### Quality Requirements

- [ ] 100% unit test coverage for all factory methods
- [ ] Integration tests validate real-world usage scenarios
- [ ] JSDoc documentation complete for all public methods
- [ ] Error handling comprehensive with helpful diagnostics
- [ ] Performance comparable to manual test setup

### Usability Requirements

- [ ] Single method call creates fully configured test
- [ ] Convention-based auto-detection reduces configuration
- [ ] Clear error messages guide resolution of common issues
- [ ] Category-specific methods provide intuitive shortcuts

### Reliability Requirements

- [ ] Robust file loading with multiple fallback strategies
- [ ] Category detection handles edge cases gracefully
- [ ] Configuration validation prevents common mistakes
- [ ] Error recovery maintains useful debugging information

## Success Metrics

### Development Speed Improvement

- **Target**: 90% reduction in test setup code
- **Measurement**: Lines of code needed to create new mod test
- **Success**: From 50+ lines to <5 lines for standard test creation

### Developer Experience Enhancement

- **Target**: Simplified test creation for all skill levels
- **Measurement**: Developer feedback and onboarding time
- **Success**: New developers can create mod tests in <10 minutes

### Consistency Improvement

- **Target**: Standardized test creation across all mod categories
- **Measurement**: Variation in test structure patterns
- **Success**: >98% consistency in fixture-created tests

### Error Reduction

- **Target**: Fewer test setup errors and faster debugging
- **Measurement**: Setup error rates and resolution time
- **Success**: 80%+ reduction in setup-related issues

## Integration Points

### Infrastructure Dependencies

- **MODTESTREF-001-004**: Integrates and orchestrates all previous infrastructure
- Must work seamlessly with handlers, entity builder, assertions, and base classes

### Migration Readiness

- **MODTESTREF-007**: Factory will be primary tool for migrating existing tests
- Must support all patterns found in current 48 test files

### Future Extensibility

- **New Mod Categories**: Factory must be easily extensible for new categories
- **Community Mods**: Must support convention-based development for community

## Next Steps

Upon completion, this factory will be ready for:

1. **MODTESTREF-006**: Use in infrastructure testing to validate complete integration
2. **MODTESTREF-007**: Primary tool for migrating all 48 existing test files
3. **MODTESTREF-008**: Documentation of factory patterns and best practices
4. **Future**: Foundation for automated test generation and community mod support

This factory will be the culmination of all infrastructure work, providing a single, simple entry point for creating mod tests that eliminates complexity and enables rapid, consistent test development across the entire project.
