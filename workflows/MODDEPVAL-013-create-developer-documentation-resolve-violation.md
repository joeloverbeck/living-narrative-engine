# MODDEPVAL-013: Create Developer Documentation and Resolve Current Violation

## Overview

Create comprehensive developer documentation for the mod dependency validation system and resolve the specific positioning/intimacy violation identified in the initial analysis. This ticket ensures the system is properly documented, examples are provided, and the immediate violation is addressed.

## Technical Specifications

### Developer Documentation Structure

#### Main Documentation File

```markdown
# docs/validation/mod-dependency-validation.md

# Mod Dependency Validation System

## Overview
The mod dependency validation system ensures architectural integrity by validating that all cross-mod references are properly declared as dependencies.

## System Architecture
[Detailed architecture diagrams and component interactions]

## Usage Guide
[Step-by-step usage instructions for developers]

## API Reference
[Complete API documentation with examples]

## Configuration
[Configuration options and best practices]

## Troubleshooting
[Common issues and solutions]

## Migration Guide
[How to adopt the system in existing projects]
```

#### API Documentation

```javascript
// docs/validation/api-reference.md

/**
 * @class ModReferenceExtractor
 * @description Core class for extracting mod references from various file formats
 * 
 * @example
 * const extractor = container.get('IModReferenceExtractor');
 * const references = await extractor.extractFromMod('positioning');
 * console.log(references); // { dependencies: ['intimacy'], references: [...] }
 */

/**
 * @class ModCrossReferenceValidator  
 * @description Validates cross-references against declared dependencies
 * 
 * @example
 * const validator = container.get('IModCrossReferenceValidator');
 * const violations = await validator.validateReferences(references);
 * if (violations.length > 0) {
 *   console.log('Violations found:', violations);
 * }
 */

/**
 * @class ViolationReporter
 * @description Generates formatted reports for dependency violations
 * 
 * @example
 * const reporter = container.get('IViolationReporter');
 * const report = await reporter.generateReport(violations, { format: 'html' });
 * fs.writeFileSync('validation-report.html', report);
 */
```

### Usage Examples

#### Basic Validation Example

```javascript
// docs/examples/basic-validation.js

import { createContainer } from '../src/dependencyInjection/container.js';
import { registerValidationDependencies } from '../src/validation/registrations.js';

async function validateModDependencies() {
  // Setup
  const container = createContainer();
  registerValidationDependencies(container);
  
  // Get validators
  const extractor = container.get('IModReferenceExtractor');
  const validator = container.get('IModCrossReferenceValidator');
  const reporter = container.get('IViolationReporter');
  
  try {
    // Extract references from all mods
    const allReferences = await extractor.extractFromAllMods('data/mods');
    
    // Validate cross-references
    const violations = await validator.validateReferences(allReferences);
    
    if (violations.length === 0) {
      console.log('✅ All mod dependencies are valid!');
      return;
    }
    
    // Generate report
    const report = await reporter.generateReport(violations, {
      format: 'console',
      includeContext: true,
      groupByMod: true
    });
    
    console.log(report);
    process.exit(1);
    
  } catch (error) {
    console.error('Validation failed:', error.message);
    process.exit(1);
  }
}

validateModDependencies();
```

#### CLI Integration Example

```javascript
// docs/examples/cli-integration.js

import { program } from 'commander';
import { validateModsCommand } from '../src/validation/cli/validateModsCommand.js';

program
  .name('validate-mods')
  .description('Validate mod dependency integrity')
  .version('1.0.0');

program
  .command('validate')
  .description('Validate all mod dependencies')
  .option('-p, --path <path>', 'Path to mods directory', 'data/mods')
  .option('-f, --format <format>', 'Report format (console|json|html)', 'console')
  .option('--fix', 'Attempt to auto-fix violations where possible')
  .option('--strict', 'Fail on warnings as well as errors')
  .action(validateModsCommand);

program
  .command('check <modId>')  
  .description('Validate specific mod dependencies')
  .option('-v, --verbose', 'Show detailed reference information')
  .action(async (modId, options) => {
    const result = await validateSingleMod(modId, options);
    console.log(result);
  });

program.parse();
```

#### Integration with UpdateManifest Example

```javascript
// docs/examples/update-manifest-integration.js

// Enhanced updateManifest.js with validation
import { ModDependencyValidator } from '../src/validation/modDependencyValidator.js';

async function updateManifestWithValidation(modPath, options = {}) {
  const validator = new ModDependencyValidator({
    logger: console,
    enableCrossReferenceValidation: options.validate !== false
  });
  
  try {
    // Pre-validation
    if (options.validateBefore) {
      console.log('🔍 Pre-update validation...');
      const preViolations = await validator.validateMod(modPath);
      if (preViolations.length > 0 && options.strict) {
        throw new Error(`Pre-validation failed: ${preViolations.length} violations`);
      }
    }
    
    // Update manifest
    const updatedManifest = await updateManifest(modPath, options);
    
    // Post-validation
    console.log('✅ Post-update validation...');
    const postViolations = await validator.validateMod(modPath);
    
    if (postViolations.length > 0) {
      console.warn(`⚠️ ${postViolations.length} validation issues found after update`);
      
      if (options.autoFix) {
        console.log('🔧 Attempting auto-fix...');
        const fixResults = await validator.attemptAutoFix(postViolations);
        console.log(`Fixed ${fixResults.fixed}/${fixResults.total} violations`);
      }
    }
    
    return updatedManifest;
    
  } catch (error) {
    console.error('Update with validation failed:', error.message);
    throw error;
  }
}
```

### Configuration Documentation

```javascript
// docs/configuration/validation-config.md

# Validation Configuration

## Basic Configuration

```javascript
// validation.config.js
export const validationConfig = {
  // File scanning options
  scanning: {
    includePatterns: ['**/*.json', '**/*.scope'],
    excludePatterns: ['**/node_modules/**', '**/.*'],
    followSymlinks: false,
    maxFileSize: 10 * 1024 * 1024, // 10MB
  },
  
  // Reference extraction options
  extraction: {
    enableJsonLogicTraversal: true,
    enableScopeDslParsing: true,
    maxNestingDepth: 50,
    cacheResults: true,
  },
  
  // Validation behavior
  validation: {
    strictMode: false, // Treat warnings as errors
    allowSelfReferences: true,
    allowCoreReferences: true, // Allow references to 'core' without dependency
    checkCircularDependencies: true,
  },
  
  // Reporting options
  reporting: {
    defaultFormat: 'console',
    includeContext: true,
    groupByMod: true,
    showSuccessMessage: true,
  },
  
  // Performance options
  performance: {
    enableCaching: true,
    cacheTimeout: 300000, // 5 minutes
    maxConcurrentOperations: 10,
    enableIncrementalValidation: true,
  },
  
  // Security options
  security: {
    enableInputSanitization: true,
    maxProcessingTime: 30000, // 30 seconds
    maxMemoryUsage: 512 * 1024 * 1024, // 512MB
  }
};
```

## Environment-Specific Configuration

### Development
```javascript
// validation.config.dev.js
export const devConfig = {
  ...baseConfig,
  validation: {
    ...baseConfig.validation,
    strictMode: false, // More permissive during development
  },
  reporting: {
    ...baseConfig.reporting,
    includeContext: true,
    showFixSuggestions: true,
  }
};
```

### Production
```javascript
// validation.config.prod.js  
export const prodConfig = {
  ...baseConfig,
  validation: {
    ...baseConfig.validation,
    strictMode: true, // Strict in production
  },
  security: {
    ...baseConfig.security,
    enableInputSanitization: true, // Always enabled
  }
};
```
```

### Troubleshooting Guide

```markdown
# docs/troubleshooting/common-issues.md

# Common Validation Issues

## Issue: "Circular dependency detected"

### Cause
Two or more mods depend on each other, creating a circular reference.

### Example
```
mod-a depends on mod-b
mod-b depends on mod-a
```

### Solution
1. Identify the circular reference in the validation report
2. Refactor one mod to remove the dependency
3. Consider creating a shared base mod for common functionality

## Issue: "Reference to undefined mod"

### Cause
A mod references content from another mod that doesn't exist or isn't loaded.

### Example
```json
// positioning mod references intimacy:kissing
{
  "conditions": [
    { "var": "intimacy:kissing.intensity" }
  ]
}
```

### Solutions
1. Add the missing dependency to mod-manifest.json:
```json
{
  "dependencies": ["intimacy"]
}
```

2. Or remove the invalid reference if not needed

## Issue: "Scope DSL parsing failed"

### Cause
Invalid syntax in .scope files

### Common Syntax Errors
- Missing colons in definitions: `modId scopeId := expression`
- Invalid JSON Logic in expressions
- Unmatched brackets or parentheses

### Solution
Check scope file syntax and validate JSON Logic expressions

## Issue: "Performance degradation during validation"

### Causes
- Large number of files to process
- Complex nested JSON structures  
- Insufficient system resources

### Solutions
1. Enable incremental validation
2. Increase memory limits in configuration
3. Use file pattern exclusions to reduce scope
4. Enable caching for repeated validations
```

### Violation Resolution: Positioning/Intimacy Case

#### Current Violation Analysis

```javascript
// docs/examples/positioning-intimacy-violation.md

# Positioning/Intimacy Violation Resolution

## Problem Analysis

The `positioning` mod contains references to `intimacy:kissing` content without declaring `intimacy` as a dependency.

### Specific Violations Found

1. **File**: `data/mods/positioning/rules/handle_get_up_from_furniture.rule.json`
   - **Line**: Condition checking `intimacy:kissing.intensity`
   - **Issue**: References intimacy mod without dependency declaration

2. **File**: `data/mods/positioning/actions/sit_down.json`
   - **Line**: Action result modifying `intimacy:kissing.position_preference`
   - **Issue**: Attempts to modify intimacy state without proper dependency

### Impact Assessment
- **Severity**: HIGH - Runtime failures possible
- **Risk**: Undefined behavior when intimacy mod not loaded
- **Affected Systems**: Positioning rules, furniture interactions
```

#### Resolution Implementation

```javascript
// Resolution step 1: Update positioning mod manifest
// File: data/mods/positioning/mod-manifest.json

{
  "id": "positioning",
  "version": "2.1.0",
  "name": "Positioning System",
  "description": "Handles entity positioning and furniture interactions",
  "dependencies": [
    "core",
    "intimacy"  // ← ADD THIS DEPENDENCY
  ],
  "loadOrder": 20,
  "compatibility": {
    "minEngineVersion": "1.0.0",
    "maxEngineVersion": "*"
  }
}
```

```javascript
// Resolution step 2: Add validation tests
// File: tests/integration/validation/positioningIntimacyResolution.test.js

describe('Positioning/Intimacy Violation Resolution', () => {
  it('should pass validation after dependency addition', async () => {
    // Arrange
    const validator = createValidator();
    
    // Act
    const violations = await validator.validateMod('positioning');
    
    // Assert
    const intimacyViolations = violations.filter(v => 
      v.referencedMod === 'intimacy'
    );
    
    expect(intimacyViolations).toHaveLength(0);
  });

  it('should maintain functional compatibility', async () => {
    // Test that positioning features still work after dependency fix
    const engine = createTestEngine(['core', 'intimacy', 'positioning']);
    
    const result = await engine.processRule('handle_get_up_from_furniture', {
      entity: 'test-actor',
      furniture: 'test-chair'
    });
    
    expect(result.success).toBe(true);
    expect(result.intimacyState).toBeDefined(); // Can access intimacy state
  });
});
```

#### Automated Resolution Script

```javascript
// scripts/resolvePositioningViolation.js

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

async function resolvePositioningViolation() {
  console.log('🔧 Resolving positioning/intimacy dependency violation...');
  
  try {
    // Step 1: Update manifest
    const manifestPath = join('data/mods/positioning/mod-manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    
    if (!manifest.dependencies.includes('intimacy')) {
      manifest.dependencies.push('intimacy');
      manifest.version = incrementPatchVersion(manifest.version);
      
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.log('✅ Updated positioning mod manifest');
    }
    
    // Step 2: Validate fix
    const validator = createValidator();
    const violations = await validator.validateMod('positioning');
    
    const intimacyViolations = violations.filter(v => v.referencedMod === 'intimacy');
    
    if (intimacyViolations.length === 0) {
      console.log('✅ Violation resolved successfully');
      console.log(`Remaining violations: ${violations.length}`);
    } else {
      console.error('❌ Violation not fully resolved');
      console.log('Remaining intimacy violations:', intimacyViolations);
    }
    
    // Step 3: Update documentation
    await updateResolutionDocumentation();
    
    console.log('🎉 Resolution complete!');
    
  } catch (error) {
    console.error('❌ Resolution failed:', error.message);
    process.exit(1);
  }
}

function incrementPatchVersion(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  return `${major}.${minor}.${patch + 1}`;
}

async function updateResolutionDocumentation() {
  const docContent = `
# Positioning/Intimacy Violation - RESOLVED

## Resolution Date
${new Date().toISOString()}

## Actions Taken
1. Added 'intimacy' to positioning mod dependencies
2. Incremented positioning mod version
3. Validated fix with integration tests
4. Updated documentation

## Validation Results
✅ All intimacy references now properly declared
✅ No runtime compatibility issues
✅ Integration tests passing

## Future Prevention
- Pre-commit validation hooks enabled
- CI/CD pipeline includes dependency validation
- Developer documentation updated with examples
  `;
  
  writeFileSync('docs/resolutions/positioning-intimacy-resolved.md', docContent);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  resolvePositioningViolation();
}
```

## Implementation Requirements

### Documentation Structure

```
docs/
├── validation/
│   ├── mod-dependency-validation.md      # Main documentation
│   ├── api-reference.md                  # Complete API docs
│   ├── architecture.md                   # System architecture
│   └── migration-guide.md                # Adoption guide
├── examples/
│   ├── basic-validation.js               # Simple usage
│   ├── cli-integration.js                # CLI examples
│   ├── update-manifest-integration.js    # UpdateManifest integration
│   └── positioning-intimacy-violation.md # Specific case study
├── configuration/
│   ├── validation-config.md              # Configuration options
│   ├── environment-configs.md            # Env-specific settings
│   └── performance-tuning.md             # Performance optimization
├── troubleshooting/
│   ├── common-issues.md                  # FAQ and solutions
│   ├── error-codes.md                    # Error reference
│   └── debugging-guide.md                # Debugging tips
└── resolutions/
    └── positioning-intimacy-resolved.md  # Violation resolution log
```

### Tutorial Series

```markdown
# docs/tutorials/

## Tutorial 1: Getting Started with Mod Validation
- Basic concepts
- Setting up validation
- Running first validation
- Understanding reports

## Tutorial 2: Integration with Existing Workflows  
- Adding to build scripts
- CI/CD integration
- Pre-commit hooks
- IDE integration

## Tutorial 3: Advanced Configuration
- Custom validation rules
- Performance tuning
- Security configuration
- Error handling customization

## Tutorial 4: Troubleshooting and Debugging
- Common issues and solutions
- Debugging validation failures
- Performance troubleshooting
- Security incident response
```

### Code Examples Repository

```javascript
// examples/validation-examples/
├── basic/
│   ├── simple-validation.js
│   ├── batch-validation.js
│   └── report-generation.js
├── advanced/
│   ├── custom-extractors.js
│   ├── plugin-development.js
│   └── performance-optimization.js
├── integration/
│   ├── webpack-plugin.js
│   ├── rollup-plugin.js
│   └── github-actions.yml
└── real-world/
    ├── large-project-setup.js
    ├── monorepo-validation.js
    └── multi-environment-config.js
```

## Testing Requirements

### Documentation Testing

```javascript
// tests/documentation/exampleValidation.test.js
describe('Documentation Examples', () => {
  it('should validate all code examples in documentation', async () => {
    const exampleFiles = await glob('docs/**/*.js');
    
    for (const file of exampleFiles) {
      const content = await readFile(file, 'utf8');
      
      // Syntax validation
      try {
        new Function(content); // Basic syntax check
      } catch (error) {
        fail(`Syntax error in ${file}: ${error.message}`);
      }
      
      // Runtime validation (if executable)
      if (content.includes('// @executable')) {
        const result = await executeExample(file);
        expect(result.success).toBe(true);
      }
    }
  });

  it('should validate API examples match actual implementation', async () => {
    const apiExamples = extractApiExamples('docs/validation/api-reference.md');
    
    for (const example of apiExamples) {
      const actualApi = await getApiSignature(example.className, example.methodName);
      expect(example.signature).toMatchApiSignature(actualApi);
    }
  });
});
```

### Resolution Verification

```javascript
// tests/integration/resolutions/positioningIntimacyResolution.test.js
describe('Positioning/Intimacy Resolution', () => {
  beforeAll(async () => {
    // Apply resolution
    await resolvePositioningViolation();
  });

  it('should completely resolve the violation', async () => {
    const validator = createValidator();
    const violations = await validator.validateMod('positioning');
    
    const intimacyViolations = violations.filter(v => 
      v.referencedMod === 'intimacy' && v.type === 'MISSING_DEPENDENCY'
    );
    
    expect(intimacyViolations).toHaveLength(0);
  });

  it('should maintain positioning mod functionality', async () => {
    const testBed = createModTestBed(['core', 'intimacy', 'positioning']);
    
    // Test furniture interaction with intimacy integration
    const result = await testBed.executeRule('handle_get_up_from_furniture', {
      entity: 'test-actor',
      furniture: 'test-bed',
      intimacyContext: { partner: 'test-partner' }
    });
    
    expect(result.success).toBe(true);
    expect(result.positionChanged).toBe(true);
    expect(result.intimacyStateUpdated).toBe(true);
  });

  it('should not introduce new violations', async () => {
    const validator = createValidator();
    const allViolations = await validator.validateAllMods();
    
    const newViolations = allViolations.filter(v => 
      v.introducedBy === 'positioning-intimacy-resolution'
    );
    
    expect(newViolations).toHaveLength(0);
  });
});
```

## Success Criteria

### Documentation Quality
- [ ] Complete API reference with examples for all public methods
- [ ] Step-by-step tutorials covering basic to advanced usage
- [ ] Configuration guide with all options documented
- [ ] Troubleshooting guide with common issues and solutions
- [ ] Migration guide for adopting the validation system

### Code Examples
- [ ] All examples executable and tested
- [ ] Examples cover 90% of common use cases
- [ ] Integration examples for popular build tools
- [ ] Real-world project examples included

### Violation Resolution
- [ ] Positioning/intimacy violation completely resolved
- [ ] No new violations introduced by the fix
- [ ] Functional compatibility maintained
- [ ] Resolution process documented for future reference

### Developer Experience
- [ ] Clear onboarding process (< 15 minutes to first validation)
- [ ] Helpful error messages with actionable suggestions
- [ ] IDE integration examples provided
- [ ] CLI tools intuitive and well-documented

### Maintenance
- [ ] Documentation versioned and maintained
- [ ] Examples automatically tested in CI
- [ ] Breaking changes clearly documented
- [ ] Migration paths provided for major updates

## Dependencies

- MODDEPVAL-001 through MODDEPVAL-012: All previous implementation tickets
- Current codebase analysis for violation resolution
- Existing documentation structure and standards

## Estimated Effort

- **Documentation Writing**: 3-4 days
- **Code Examples**: 2-3 days
- **Violation Resolution**: 1-2 days
- **Testing Documentation**: 1-2 days
- **Review and Polish**: 1 day
- **Total**: 8-12 days

## Notes

- Documentation should follow existing project documentation standards
- All code examples must be tested and maintained
- Resolution of positioning/intimacy violation should be backwards compatible
- Consider creating interactive documentation examples
- Documentation should be accessible to developers of all skill levels
- Include performance benchmarks and comparisons where relevant