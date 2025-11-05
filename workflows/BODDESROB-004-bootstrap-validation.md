# BODDESROB-004: Add Bootstrap Validation for Body Descriptors

**Status**: TODO
**Priority**: HIGH
**Phase**: 3 (Integration)
**Estimated Effort**: 0.5 days
**Dependencies**: BODDESROB-001, BODDESROB-002

## Overview

Integrate body descriptor validation into the system bootstrap process to detect configuration issues at startup. This provides immediate feedback when descriptors are missing from formatting configuration or when there are inconsistencies in the system.

## Problem Context

Currently, descriptor configuration issues are only discovered:
- During integration tests (if tests cover the scenario)
- At runtime when descriptions are generated (silent failures)
- Through manual inspection

This leads to late detection and difficult debugging. Bootstrap validation will detect issues immediately when the application starts.

## Acceptance Criteria

- [ ] Validation integrated into bootstrap/initialization process
- [ ] Validator checks formatting config consistency on startup
- [ ] Warnings logged for missing descriptors in development mode
- [ ] Critical errors fail fast in development mode
- [ ] Production mode logs warnings but doesn't fail
- [ ] Clear, actionable error messages with file paths
- [ ] Performance impact minimal (< 50ms)
- [ ] Integration tests verify validation behavior
- [ ] Environment-specific behavior (dev vs production)

## Technical Details

### Integration Point

Determine appropriate bootstrap stage for validation:
- Option 1: During anatomy formatting service initialization
- Option 2: As dedicated bootstrap validation stage
- Option 3: During data registry initialization

**Recommended**: Integrate into anatomy formatting service initialization for direct connection to config loading.

### Implementation Approach

```javascript
// src/services/anatomyFormattingService.js (enhanced)

import { BODY_DESCRIPTOR_REGISTRY } from '../anatomy/registries/bodyDescriptorRegistry.js';
import { BodyDescriptorValidator } from '../anatomy/validators/bodyDescriptorValidator.js';

export class AnatomyFormattingService extends BaseService {
  #logger;
  #validator;
  #config;

  constructor({ logger, dataRegistry }) {
    super();
    this.#logger = ensureValidLogger(logger, 'AnatomyFormattingService');
    this.#validator = new BodyDescriptorValidator({ logger: this.#logger });
    this.#loadAndValidateConfig(dataRegistry);
  }

  /**
   * Load formatting config and validate consistency
   * @private
   */
  #loadAndValidateConfig(dataRegistry) {
    this.#config = dataRegistry.get('anatomyFormatting', 'default');

    if (!this.#config) {
      const error = 'Anatomy formatting config not found: anatomy:default';
      this.#logger.error(error);
      throw new Error(error);
    }

    // Validate configuration consistency
    this.#validateConfigurationConsistency();
  }

  /**
   * Validate configuration consistency with registry
   * @private
   */
  #validateConfigurationConsistency() {
    const result = this.#validator.validateFormattingConfig(this.#config);

    // Log errors (critical issues)
    for (const error of result.errors) {
      this.#logger.error(`[Body Descriptor Config] ${error}`);
    }

    // Log warnings (missing descriptors)
    for (const warning of result.warnings) {
      this.#logger.warn(`[Body Descriptor Config] ${warning}`);
    }

    // In development mode, fail fast on errors
    if (process.env.NODE_ENV !== 'production' && result.errors.length > 0) {
      throw new Error(
        `Body descriptor configuration errors detected:\n${result.errors.join('\n')}`
      );
    }

    // In development mode, make warnings visible
    if (process.env.NODE_ENV !== 'production' && result.warnings.length > 0) {
      console.warn('\n⚠️  Body Descriptor Configuration Issues:\n');
      result.warnings.forEach(warning => {
        console.warn(`   ${warning}`);
      });
      console.warn('\n   Fix by adding missing descriptors to:');
      console.warn('   data/mods/anatomy/anatomy-formatting/default.json\n');
    }
  }

  /**
   * Get description order with validation
   */
  getDescriptionOrder() {
    return this.#config?.descriptionOrder || this.#getDefaultDescriptionOrder();
  }

  /**
   * Get default description order from registry as fallback
   * @private
   */
  #getDefaultDescriptionOrder() {
    const descriptorKeys = Object.values(BODY_DESCRIPTOR_REGISTRY)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map(meta => meta.displayKey);

    return [
      ...descriptorKeys,
      'head', 'hair', 'eye', 'face', 'ear', 'nose', 'mouth', 'neck',
      'breast', 'torso', 'arm', 'hand', 'leg', 'foot',
      // ... other part types
    ];
  }
}
```

### Alternative: Dedicated Bootstrap Stage

```javascript
// src/bootstrapper/stages/bodyDescriptorValidationStage.js

export class BodyDescriptorValidationStage {
  #logger;
  #validator;

  constructor({ logger }) {
    this.#logger = ensureValidLogger(logger, 'BodyDescriptorValidationStage');
    this.#validator = new BodyDescriptorValidator({ logger: this.#logger });
  }

  /**
   * Execute validation stage during bootstrap
   */
  async execute({ dataRegistry }) {
    this.#logger.info('Validating body descriptor system consistency...');

    const issues = await this.#validator.validateSystemConsistency({ dataRegistry });

    // Log results
    this.#logValidationResults(issues);

    // Fail fast in development if errors found
    if (process.env.NODE_ENV !== 'production' && issues.errors.length > 0) {
      throw new Error('Body descriptor system validation failed');
    }
  }

  #logValidationResults(issues) {
    // Log errors
    issues.errors.forEach(error => {
      this.#logger.error(`[Body Descriptor Validation] ${error}`);
    });

    // Log warnings
    issues.warnings.forEach(warning => {
      this.#logger.warn(`[Body Descriptor Validation] ${warning}`);
    });

    // Log info
    issues.info.forEach(info => {
      this.#logger.info(`[Body Descriptor Validation] ${info}`);
    });
  }
}
```

### Implementation Steps

1. **Choose Integration Point**
   - Analyze bootstrap flow
   - Determine best location for validation
   - Consider dependency injection requirements

2. **Implement Validation Call**
   - Import validator
   - Call validation during initialization
   - Handle validation results

3. **Add Error/Warning Logging**
   - Log errors with full context
   - Log warnings with actionable guidance
   - Include file paths in messages

4. **Implement Environment Logic**
   - Development: fail fast on errors, show warnings
   - Production: log warnings, continue operation
   - Use NODE_ENV for detection

5. **Test Integration**
   - Test with valid configuration
   - Test with missing descriptors
   - Test with invalid configuration
   - Test environment-specific behavior

## Files to Modify

- `src/services/anatomyFormattingService.js` (MODIFY)
  - Add validation during initialization
  - Add error/warning logging
  - Add environment-specific behavior

OR (if using dedicated stage):

- `src/bootstrapper/stages/bodyDescriptorValidationStage.js` (NEW)
  - Create validation stage
- `src/bootstrapper/bootstrapper.js` (MODIFY)
  - Register validation stage

## Testing Requirements

### Unit Tests

**File**: `tests/unit/services/anatomyFormattingService.validation.test.js` (or appropriate location)

Test cases:
1. Validation called during initialization
2. Errors logged appropriately
3. Warnings logged appropriately
4. Development mode fails on errors
5. Production mode doesn't fail on warnings
6. Clear error messages with file paths

### Integration Tests

**File**: `tests/integration/bootstrapper/bodyDescriptorValidation.test.js`

Test cases:
1. Bootstrap succeeds with valid configuration
2. Bootstrap fails in dev mode with invalid config
3. Bootstrap succeeds in production with invalid config (warns only)
4. Validation output includes file paths
5. Multiple validation issues reported together
6. System continues to work after warnings

### Test Template

```javascript
describe('Bootstrap Validation - Body Descriptors', () => {
  describe('Development Mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should fail fast when descriptors missing from config', () => {
      const invalidConfig = {
        descriptionOrder: ['height'], // Missing other descriptors
      };

      expect(() => {
        // Initialize service with invalid config
      }).toThrow('Body descriptor configuration');
    });

    it('should log warnings for missing descriptors', () => {
      const mockLogger = createMockLogger();
      // Initialize with invalid config
      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockLogger.warn.mock.calls[0][0]).toContain('missing from descriptionOrder');
    });
  });

  describe('Production Mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should not fail when descriptors missing from config', () => {
      const invalidConfig = {
        descriptionOrder: ['height'],
      };

      expect(() => {
        // Initialize service with invalid config
      }).not.toThrow();
    });

    it('should log warnings but continue', () => {
      const mockLogger = createMockLogger();
      // Initialize with invalid config
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });
});
```

## Success Criteria

- [ ] Validation runs on every application startup
- [ ] Missing descriptors detected immediately
- [ ] Clear warnings in development console
- [ ] Development mode fails fast on critical errors
- [ ] Production mode logs but doesn't fail
- [ ] Performance impact < 50ms
- [ ] All tests pass
- [ ] ESLint passes with no errors
- [ ] Error messages include file paths and fixes

## Related Tickets

- Depends on: BODDESROB-001 (Centralized Registry)
- Depends on: BODDESROB-002 (Enhanced Validator)
- Related to: BODDESROB-007 (CLI Validation Tool)
- Related to: Spec Section 3.5 "Integration with Formatting Service"

## Environment Configuration

### Development Mode
- Fail fast on critical errors
- Display warnings prominently in console
- Include file paths and suggested fixes
- Help developers catch issues early

### Production Mode
- Log warnings to system logger
- Don't interrupt application startup
- Allow graceful degradation
- Monitor for issues

## Notes

- Keep validation lightweight (< 50ms)
- Consider caching validation results if needed
- Make error messages actionable and clear
- Include file paths in all messages
- Test both environment modes thoroughly
- Consider adding validation disable flag for emergencies
- Document validation behavior in README
