# ANASYSIMP-019-04: Create Migration Utilities

**Phase:** 2 (Integration)
**Timeline:** 1 day
**Status:** Not Started
**Dependencies:** ANASYSIMP-019-01
**Parent:** ANASYSIMP-019 (Schema-Driven Validation Generation)

## Overview

Create migration utilities to help analyze existing component schemas and generate appropriate `validationRules` sections. These tools will semi-automate the process of migrating 100+ component schemas to use the new validation system.

## Objectives

1. Create schema analysis tool to identify migration candidates
2. Create `validationRules` generator for enum properties
3. Create validation rule suggestion tool
4. Create batch migration script
5. Create consistency validation tool
6. Provide migration report and recommendations
7. Support dry-run mode for safety

## Technical Details

### 1. Schema Analyzer

**File to Create:** `scripts/migration/analyzeComponentSchemas.js`

```javascript
#!/usr/bin/env node

/**
 * @file Analyzes component schemas to identify migration candidates
 * Generates report of schemas that could benefit from validationRules
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

/**
 * Analyzes component schemas for migration opportunities
 */
class SchemaAnalyzer {
  constructor() {
    this.results = {
      total: 0,
      withEnum: 0,
      withValidationRules: 0,
      candidates: [],
      alreadyMigrated: [],
    };
  }

  /**
   * Analyzes all component schemas
   */
  async analyze() {
    console.log('Analyzing component schemas...\n');

    const schemaFiles = await glob('data/mods/**/components/*.component.json');

    for (const filePath of schemaFiles) {
      this.analyzeSchema(filePath);
    }

    this.printReport();
  }

  /**
   * Analyzes a single schema file
   */
  analyzeSchema(filePath) {
    this.results.total++;

    const content = fs.readFileSync(filePath, 'utf8');
    const schema = JSON.parse(content);

    // Check if already has validationRules
    if (schema.validationRules) {
      this.results.alreadyMigrated.push({
        filePath,
        schemaId: schema.id,
      });
      this.results.withValidationRules++;
      return;
    }

    // Check if has enum properties (migration candidate)
    const enumProps = this.findEnumProperties(schema);

    if (enumProps.length > 0) {
      this.results.withEnum++;
      this.results.candidates.push({
        filePath,
        schemaId: schema.id,
        enumProperties: enumProps,
        suggestedRules: this.generateSuggestedRules(enumProps),
      });
    }
  }

  /**
   * Finds properties with enum constraints
   */
  findEnumProperties(schema) {
    const enumProps = [];

    if (!schema.dataSchema || !schema.dataSchema.properties) {
      return enumProps;
    }

    for (const [propName, propSchema] of Object.entries(
      schema.dataSchema.properties
    )) {
      if (propSchema.enum) {
        enumProps.push({
          name: propName,
          type: propSchema.type,
          enum: propSchema.enum,
          valueCount: propSchema.enum.length,
        });
      }
    }

    return enumProps;
  }

  /**
   * Generates suggested validation rules
   */
  generateSuggestedRules(enumProps) {
    const propertyName = enumProps[0].name;
    const validValues = enumProps[0].enum;

    return {
      generateValidator: true,
      errorMessages: {
        invalidEnum: `Invalid ${propertyName}: {{value}}. Valid options: {{validValues}}`,
        missingRequired: `${propertyName} is required`,
      },
      suggestions: {
        enableSimilarity: true,
        maxDistance: 3,
        maxSuggestions: 3,
      },
    };
  }

  /**
   * Prints analysis report
   */
  printReport() {
    console.log('='.repeat(70));
    console.log('COMPONENT SCHEMA MIGRATION ANALYSIS');
    console.log('='.repeat(70));
    console.log();
    console.log(`Total schemas: ${this.results.total}`);
    console.log(`Already migrated: ${this.results.withValidationRules}`);
    console.log(`Migration candidates (with enums): ${this.results.withEnum}`);
    console.log(
      `No migration needed: ${this.results.total - this.results.withEnum - this.results.withValidationRules}`
    );
    console.log();

    if (this.results.candidates.length > 0) {
      console.log('MIGRATION CANDIDATES:');
      console.log('-'.repeat(70));

      for (const candidate of this.results.candidates) {
        console.log();
        console.log(`Schema: ${candidate.schemaId}`);
        console.log(`File: ${candidate.filePath}`);
        console.log(`Enum properties: ${candidate.enumProperties.length}`);

        for (const prop of candidate.enumProperties) {
          console.log(`  - ${prop.name}: ${prop.valueCount} values`);
        }
      }

      console.log();
      console.log('-'.repeat(70));
      console.log(
        `Run "node scripts/migration/generateValidationRules.js" to generate rules`
      );
    }

    console.log();
  }

  /**
   * Exports results to JSON
   */
  exportResults(outputPath) {
    fs.writeFileSync(outputPath, JSON.stringify(this.results, null, 2));
    console.log(`Results exported to: ${outputPath}`);
  }
}

// Run analyzer
const analyzer = new SchemaAnalyzer();
analyzer.analyze().then(() => {
  analyzer.exportResults('migration-analysis.json');
});
```

### 2. Validation Rules Generator

**File to Create:** `scripts/migration/generateValidationRules.js`

```javascript
#!/usr/bin/env node

/**
 * @file Generates validationRules for component schemas
 * Can run in dry-run mode or apply changes directly
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

/**
 * Generates and applies validation rules to schemas
 */
class ValidationRulesGenerator {
  constructor(options = {}) {
    this.dryRun = options.dryRun ?? true;
    this.modified = [];
    this.skipped = [];
  }

  /**
   * Generates validation rules for all eligible schemas
   */
  async generate(schemaPattern = 'data/mods/**/components/*.component.json') {
    console.log(`Mode: ${this.dryRun ? 'DRY RUN' : 'APPLY CHANGES'}\n`);

    const schemaFiles = await glob(schemaPattern);

    for (const filePath of schemaFiles) {
      this.processSchema(filePath);
    }

    this.printSummary();
  }

  /**
   * Processes a single schema file
   */
  processSchema(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const schema = JSON.parse(content);

    // Skip if already has validationRules
    if (schema.validationRules) {
      this.skipped.push({
        filePath,
        reason: 'Already has validationRules',
      });
      return;
    }

    // Skip if no enum properties
    const enumProps = this.findEnumProperties(schema);
    if (enumProps.length === 0) {
      this.skipped.push({
        filePath,
        reason: 'No enum properties',
      });
      return;
    }

    // Generate validation rules
    const validationRules = this.generateRules(schema, enumProps);

    // Apply or preview
    if (this.dryRun) {
      console.log(`[DRY RUN] Would update: ${filePath}`);
      console.log(JSON.stringify(validationRules, null, 2));
      console.log();
    } else {
      schema.validationRules = validationRules;
      fs.writeFileSync(filePath, JSON.stringify(schema, null, 2) + '\n');
      console.log(`[UPDATED] ${filePath}`);
    }

    this.modified.push({
      filePath,
      schemaId: schema.id,
      rules: validationRules,
    });
  }

  /**
   * Finds properties with enum constraints
   */
  findEnumProperties(schema) {
    const enumProps = [];

    if (!schema.dataSchema?.properties) {
      return enumProps;
    }

    for (const [propName, propSchema] of Object.entries(
      schema.dataSchema.properties
    )) {
      if (propSchema.enum) {
        enumProps.push({ name: propName, schema: propSchema });
      }
    }

    return enumProps;
  }

  /**
   * Generates validation rules based on schema
   */
  generateRules(schema, enumProps) {
    const firstProp = enumProps[0];
    const propertyName = firstProp.name;

    // Capitalize first letter for error messages
    const propertyLabel =
      propertyName.charAt(0).toUpperCase() + propertyName.slice(1);

    return {
      generateValidator: true,
      errorMessages: {
        invalidEnum: `Invalid ${propertyName}: {{value}}. Valid options: {{validValues}}`,
        missingRequired: `${propertyLabel} is required`,
        invalidType: `Invalid type for ${propertyName}: expected {{expected}}, got {{actual}}`,
      },
      suggestions: {
        enableSimilarity: true,
        maxDistance: 3,
        maxSuggestions: 3,
      },
    };
  }

  /**
   * Prints summary of changes
   */
  printSummary() {
    console.log('='.repeat(70));
    console.log('VALIDATION RULES GENERATION SUMMARY');
    console.log('='.repeat(70));
    console.log();
    console.log(`Mode: ${this.dryRun ? 'DRY RUN' : 'APPLIED'}`);
    console.log(`Schemas modified: ${this.modified.length}`);
    console.log(`Schemas skipped: ${this.skipped.length}`);
    console.log();

    if (this.dryRun && this.modified.length > 0) {
      console.log(
        'Run with --apply flag to apply changes: node scripts/migration/generateValidationRules.js --apply'
      );
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const apply = args.includes('--apply');

// Run generator
const generator = new ValidationRulesGenerator({ dryRun: !apply });
generator.generate();
```

### 3. Consistency Validator

**File to Create:** `scripts/migration/validateMigration.js`

```javascript
#!/usr/bin/env node

/**
 * @file Validates migrated schemas for consistency
 * Checks that validationRules are properly formatted
 */

import fs from 'fs';
import { glob } from 'glob';

class MigrationValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  async validate() {
    console.log('Validating migrated schemas...\n');

    const schemaFiles = await glob('data/mods/**/components/*.component.json');

    for (const filePath of schemaFiles) {
      this.validateSchema(filePath);
    }

    this.printReport();
  }

  validateSchema(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const schema = JSON.parse(content);

    if (!schema.validationRules) {
      return; // Not migrated, skip
    }

    const rules = schema.validationRules;

    // Check required properties
    if (rules.generateValidator === undefined) {
      this.warnings.push({
        file: filePath,
        message: 'Missing generateValidator flag',
      });
    }

    // Check error messages
    if (!rules.errorMessages) {
      this.errors.push({
        file: filePath,
        message: 'Missing errorMessages section',
      });
    }

    // Check template variables
    if (rules.errorMessages?.invalidEnum) {
      const template = rules.errorMessages.invalidEnum;
      if (!template.includes('{{value}}') || !template.includes('{{validValues}}')) {
        this.errors.push({
          file: filePath,
          message: 'invalidEnum template missing required variables',
        });
      }
    }

    // Check suggestions config
    if (!rules.suggestions) {
      this.warnings.push({
        file: filePath,
        message: 'Missing suggestions section',
      });
    }
  }

  printReport() {
    console.log('='.repeat(70));
    console.log('MIGRATION VALIDATION REPORT');
    console.log('='.repeat(70));
    console.log();
    console.log(`Errors: ${this.errors.length}`);
    console.log(`Warnings: ${this.warnings.length}`);
    console.log();

    if (this.errors.length > 0) {
      console.log('ERRORS:');
      for (const error of this.errors) {
        console.log(`  ❌ ${error.file}`);
        console.log(`     ${error.message}`);
      }
      console.log();
    }

    if (this.warnings.length > 0) {
      console.log('WARNINGS:');
      for (const warning of this.warnings) {
        console.log(`  ⚠️  ${warning.file}`);
        console.log(`     ${warning.message}`);
      }
      console.log();
    }

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✅ All migrated schemas are valid!');
    }
  }
}

const validator = new MigrationValidator();
validator.validate();
```

### 4. Package Scripts

**File to Update:** `package.json`

Add migration scripts:

```json
{
  "scripts": {
    "migrate:analyze": "node scripts/migration/analyzeComponentSchemas.js",
    "migrate:generate": "node scripts/migration/generateValidationRules.js",
    "migrate:generate:apply": "node scripts/migration/generateValidationRules.js --apply",
    "migrate:validate": "node scripts/migration/validateMigration.js"
  }
}
```

## Files to Create

- [ ] `scripts/migration/analyzeComponentSchemas.js`
- [ ] `scripts/migration/generateValidationRules.js`
- [ ] `scripts/migration/validateMigration.js`
- [ ] `tests/unit/scripts/migration/schemaAnalyzer.test.js`
- [ ] `tests/unit/scripts/migration/validationRulesGenerator.test.js`

## Files to Update

- [ ] `package.json` - Add migration scripts

## Testing Requirements

### Unit Tests

**File:** `tests/unit/scripts/migration/schemaAnalyzer.test.js`

Test cases:
- Analyze schema with enum properties
- Analyze schema without enum properties
- Analyze schema with existing validationRules
- Generate suggested rules
- Export analysis results

**File:** `tests/unit/scripts/migration/validationRulesGenerator.test.js`

Test cases:
- Generate rules for schema with enums
- Skip schema without enums
- Skip schema with existing rules
- Dry-run mode (no file changes)
- Apply mode (file changes)
- Generate appropriate error messages
- Generate appropriate suggestions config

**Coverage Target:** 85% branches, 90% functions/lines

### Integration Tests

**File:** `tests/integration/migration/schemasMigration.integration.test.js`

Test cases:
- Analyze real component schemas
- Generate rules for test schemas
- Validate generated rules
- Round-trip test (analyze → generate → validate)

## Acceptance Criteria

- [ ] Schema analyzer identifies migration candidates
- [ ] Rules generator creates appropriate validationRules
- [ ] Dry-run mode works without modifying files
- [ ] Apply mode correctly updates schema files
- [ ] Consistency validator catches malformed rules
- [ ] Migration report provides clear guidance
- [ ] Package scripts configured for easy use
- [ ] All tests pass
- [ ] Documentation for migration process
- [ ] ESLint passes
- [ ] TypeScript type checking passes

## Usage Examples

```bash
# Step 1: Analyze current schemas
npm run migrate:analyze
# Output: migration-analysis.json

# Step 2: Preview changes (dry-run)
npm run migrate:generate

# Step 3: Apply changes
npm run migrate:generate:apply

# Step 4: Validate migration
npm run migrate:validate

# Verify schemas still validate
npm run validate
```

## Success Metrics

- ✅ Analyzer identifies 100+ component schemas
- ✅ Generator correctly creates validationRules for enum properties
- ✅ Dry-run prevents accidental changes
- ✅ Validator catches formatting errors
- ✅ Migration completes without breaking existing schemas
- ✅ Generated rules match manual examples

## Implementation Notes

### Safety Measures

1. **Dry-run by default:** Prevents accidental changes
2. **Backup recommended:** Suggest git commit before migration
3. **Validation step:** Catch issues before they cause problems
4. **Incremental migration:** Can migrate one mod at a time

### Error Message Templates

Use sensible defaults based on property names:
- Capitalize property name for user-facing messages
- Include {{value}} and {{validValues}} placeholders
- Keep messages concise and helpful

### Suggestion Configuration

Default settings work for most cases:
- `maxDistance: 3` - Catches most typos
- `maxSuggestions: 3` - Enough options without overwhelming
- `enableSimilarity: true` - Most helpful feature

## Related Tickets

- **Parent:** ANASYSIMP-019 (Schema-Driven Validation Generation)
- **Depends on:** ANASYSIMP-019-01 (Extend component.schema.json)
- **Supports:** ANASYSIMP-019-05 (Pilot with Descriptor Components)
- **Supports:** ANASYSIMP-019-08 (Gradual Rollout)

## References

- **Component Schemas:** `data/mods/*/components/*.component.json`
- **Body Descriptor Registry:** `src/anatomy/registries/bodyDescriptorRegistry.js` (reference)
- **Migration Best Practices:** To be documented in this ticket
