# ANASYSIMP-019-08: Gradual Rollout

**Phase:** 4 (Documentation & Rollout)
**Timeline:** 1-2 days
**Status:** Not Started
**Dependencies:** ANASYSIMP-019-06 (GO decision), ANASYSIMP-019-07 (Documentation)
**Parent:** ANASYSIMP-019 (Schema-Driven Validation Generation)

## Overview

Execute a gradual rollout of schema-driven validation generation across all remaining descriptor components (80+ schemas). This rollout will be incremental, monitored, and include automated validation at each step.

## Objectives

1. Migrate remaining descriptor components (80+)
2. Automate bulk migration where appropriate
3. Monitor for issues during rollout
4. Validate all migrations
5. Update validation tests
6. Measure overall impact
7. Provide rollout status reporting
8. Create post-rollout review

## Technical Details

### 1. Rollout Strategy

**Phased Approach:**

#### Phase A: Descriptor Mods (20-30 schemas)
- `data/mods/descriptors/components/`
- All descriptor components (texture, color, shape, etc.)

#### Phase B: Core Mod (10-20 schemas)
- `data/mods/core/components/`
- Core component schemas with enums

#### Phase C: Feature Mods (30-40 schemas)
- `data/mods/positioning/components/`
- `data/mods/clothing/components/`
- `data/mods/items/components/`
- Feature-specific components with enums

#### Phase D: Specialty Mods (10-20 schemas)
- `data/mods/*/components/`
- Remaining mods with enum-based components

### 2. Automated Migration Script

**File to Create:** `scripts/migration/rolloutMigration.js`

```javascript
#!/usr/bin/env node

/**
 * @file Executes gradual rollout of validation rules migration
 * Processes mods in phases with validation at each step
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { execSync } from 'child_process';

class RolloutMigration {
  constructor() {
    this.phases = {
      A: ['data/mods/descriptors/components/*.component.json'],
      B: ['data/mods/core/components/*.component.json'],
      C: [
        'data/mods/positioning/components/*.component.json',
        'data/mods/clothing/components/*.component.json',
        'data/mods/items/components/*.component.json',
      ],
      D: ['data/mods/*/components/*.component.json'],
    };

    this.stats = {
      total: 0,
      migrated: 0,
      skipped: 0,
      failed: 0,
    };
  }

  /**
   * Executes the rollout
   */
  async execute(phaseName = null) {
    console.log('='.repeat(70));
    console.log('GRADUAL ROLLOUT MIGRATION');
    console.log('='.repeat(70));
    console.log();

    const phases = phaseName
      ? { [phaseName]: this.phases[phaseName] }
      : this.phases;

    for (const [phase, patterns] of Object.entries(phases)) {
      await this.executePhase(phase, patterns);
    }

    this.printSummary();
  }

  /**
   * Executes a single phase
   */
  async executePhase(phaseName, patterns) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`PHASE ${phaseName}`);
    console.log('='.repeat(70));

    const files = [];
    for (const pattern of patterns) {
      const matches = await glob(pattern);
      files.push(...matches);
    }

    // Remove duplicates
    const uniqueFiles = [...new Set(files)];

    console.log(`Found ${uniqueFiles.length} schemas in phase ${phaseName}\n`);

    let phaseStats = { migrated: 0, skipped: 0, failed: 0 };

    for (const filePath of uniqueFiles) {
      const result = this.migrateSchema(filePath);
      phaseStats[result]++;
      this.stats[result]++;
      this.stats.total++;
    }

    console.log(`\nPhase ${phaseName} complete:`);
    console.log(`  Migrated: ${phaseStats.migrated}`);
    console.log(`  Skipped: ${phaseStats.skipped}`);
    console.log(`  Failed: ${phaseStats.failed}`);

    // Validate after each phase
    console.log('\nValidating schemas...');
    try {
      execSync('npm run validate', { stdio: 'inherit' });
      console.log('✅ Validation passed');
    } catch (error) {
      console.error('❌ Validation failed');
      throw new Error(`Phase ${phaseName} validation failed`);
    }

    // Run tests after each phase
    console.log('\nRunning tests...');
    try {
      execSync('npm run test:ci', { stdio: 'inherit' });
      console.log('✅ Tests passed');
    } catch (error) {
      console.error('❌ Tests failed');
      throw new Error(`Phase ${phaseName} tests failed`);
    }

    // Git commit after successful phase
    console.log('\nCommitting changes...');
    try {
      execSync(`git add ${uniqueFiles.join(' ')}`, { stdio: 'inherit' });
      execSync(
        `git commit -m "feat: migrate phase ${phaseName} to validationRules"`,
        { stdio: 'inherit' }
      );
      console.log('✅ Changes committed');
    } catch (error) {
      console.warn('⚠️  Git commit failed (may be no changes)');
    }
  }

  /**
   * Migrates a single schema
   */
  migrateSchema(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const schema = JSON.parse(content);

      // Skip if already has validationRules
      if (schema.validationRules) {
        return 'skipped';
      }

      // Skip if no enum properties
      if (!this.hasEnumProperties(schema)) {
        return 'skipped';
      }

      // Generate and apply validation rules
      schema.validationRules = this.generateValidationRules(schema);

      // Write back to file
      fs.writeFileSync(filePath, JSON.stringify(schema, null, 2) + '\n');

      console.log(`✅ ${filePath}`);
      return 'migrated';
    } catch (error) {
      console.error(`❌ ${filePath}: ${error.message}`);
      return 'failed';
    }
  }

  /**
   * Checks if schema has enum properties
   */
  hasEnumProperties(schema) {
    if (!schema.dataSchema?.properties) {
      return false;
    }

    return Object.values(schema.dataSchema.properties).some(
      (prop) => prop.enum
    );
  }

  /**
   * Generates validation rules for a schema
   */
  generateValidationRules(schema) {
    const properties = schema.dataSchema.properties || {};
    const firstEnumProp = Object.keys(properties).find(
      (key) => properties[key].enum
    );

    const propName = firstEnumProp || 'value';
    const propLabel = propName.charAt(0).toUpperCase() + propName.slice(1);

    return {
      generateValidator: true,
      errorMessages: {
        invalidEnum: `Invalid ${propName}: {{value}}. Valid options: {{validValues}}`,
        missingRequired: `${propLabel} is required`,
        invalidType: `Invalid type for ${propName}: expected {{expected}}, got {{actual}}`,
      },
      suggestions: {
        enableSimilarity: true,
        maxDistance: 3,
        maxSuggestions: 3,
      },
    };
  }

  /**
   * Prints rollout summary
   */
  printSummary() {
    console.log('\n' + '='.repeat(70));
    console.log('ROLLOUT SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total schemas processed: ${this.stats.total}`);
    console.log(`✅ Migrated: ${this.stats.migrated}`);
    console.log(`⏭️  Skipped: ${this.stats.skipped}`);
    console.log(`❌ Failed: ${this.stats.failed}`);
    console.log();

    if (this.stats.failed === 0) {
      console.log('🎉 Rollout completed successfully!');
    } else {
      console.log('⚠️  Rollout completed with errors. Review failed schemas.');
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const phase = args.find((arg) => /^[A-D]$/.test(arg)) || null;

// Execute rollout
const rollout = new RolloutMigration();
rollout.execute(phase).catch((error) => {
  console.error('Rollout failed:', error.message);
  process.exit(1);
});
```

### 3. Rollout Status Tracking

**File to Create:** `scripts/migration/rolloutStatus.js`

```javascript
#!/usr/bin/env node

/**
 * @file Reports current rollout status
 */

import { glob } from 'glob';
import fs from 'fs';

async function reportStatus() {
  const allSchemas = await glob('data/mods/**/components/*.component.json');

  let withValidationRules = 0;
  let withEnums = 0;
  let total = allSchemas.length;

  const byMod = {};

  for (const filePath of allSchemas) {
    const content = fs.readFileSync(filePath, 'utf8');
    const schema = JSON.parse(content);

    const modName = filePath.split('/')[2]; // Extract mod name

    if (!byMod[modName]) {
      byMod[modName] = { total: 0, migrated: 0, withEnums: 0 };
    }

    byMod[modName].total++;

    if (schema.validationRules) {
      withValidationRules++;
      byMod[modName].migrated++;
    }

    if (hasEnumProperties(schema)) {
      withEnums++;
      byMod[modName].withEnums++;
    }
  }

  console.log('='.repeat(70));
  console.log('ROLLOUT STATUS');
  console.log('='.repeat(70));
  console.log();
  console.log(`Total schemas: ${total}`);
  console.log(`With validationRules: ${withValidationRules} (${percent(withValidationRules, total)}%)`);
  console.log(`With enums (candidates): ${withEnums}`);
  console.log(`Remaining candidates: ${withEnums - withValidationRules}`);
  console.log();

  console.log('BY MOD:');
  console.log('-'.repeat(70));

  for (const [mod, stats] of Object.entries(byMod)) {
    const progress = stats.withEnums > 0
      ? `${stats.migrated}/${stats.withEnums}`
      : 'N/A';

    console.log(`${mod.padEnd(20)} ${progress.padEnd(10)} (${stats.total} total)`);
  }
}

function hasEnumProperties(schema) {
  if (!schema.dataSchema?.properties) {
    return false;
  }

  return Object.values(schema.dataSchema.properties).some((prop) => prop.enum);
}

function percent(value, total) {
  return ((value / total) * 100).toFixed(1);
}

reportStatus();
```

### 4. Package Scripts

**File to Update:** `package.json`

Add rollout scripts:

```json
{
  "scripts": {
    "rollout:status": "node scripts/migration/rolloutStatus.js",
    "rollout:phase": "node scripts/migration/rolloutMigration.js",
    "rollout:all": "node scripts/migration/rolloutMigration.js",
    "rollout:phase-a": "node scripts/migration/rolloutMigration.js A",
    "rollout:phase-b": "node scripts/migration/rolloutMigration.js B",
    "rollout:phase-c": "node scripts/migration/rolloutMigration.js C",
    "rollout:phase-d": "node scripts/migration/rolloutMigration.js D"
  }
}
```

### 5. Post-Rollout Review

**File to Create:** `docs/validation/rollout-review.md`

```markdown
# Rollout Review

## Rollout Date
[Date]

## Schemas Migrated
- Total: X
- Descriptors: Y
- Core: Z
- Features: A
- Specialty: B

## Issues Encountered
[List any issues found during rollout]

## Performance Impact
[Measured performance changes]

## Developer Feedback
[Feedback received post-rollout]

## Lessons Learned
[Key takeaways]

## Recommendations
[Future improvements]
```

## Files to Create

- [ ] `scripts/migration/rolloutMigration.js`
- [ ] `scripts/migration/rolloutStatus.js`
- [ ] `docs/validation/rollout-review.md`
- [ ] `tests/integration/validation/fullRolloutValidation.test.js`

## Files to Update

- [ ] `package.json` - Add rollout scripts
- [ ] 80+ component schemas - Add validationRules

## Testing Requirements

### Pre-Rollout Tests

- [ ] All pilot schemas validate correctly
- [ ] Migration utilities work as expected
- [ ] Rollout script executes without errors (dry-run)

### Post-Rollout Tests

**File:** `tests/integration/validation/fullRolloutValidation.test.js`

- Validate all migrated schemas
- Test error messages for representative schemas
- Measure overall validation performance
- Verify no regressions in existing tests

**Coverage Target:** Maintain 80%+ overall coverage

## Acceptance Criteria

- [ ] All phases (A-D) completed successfully
- [ ] 80+ schemas migrated
- [ ] All schemas validate correctly
- [ ] All tests pass
- [ ] No performance regressions
- [ ] Git history clean (one commit per phase)
- [ ] Rollout review documented
- [ ] Status tracking shows 100% completion
- [ ] No critical issues found
- [ ] ESLint passes
- [ ] TypeScript type checking passes

## Rollout Procedure

### Day 1: Descriptors & Core (Phases A & B)

```bash
# Check current status
npm run rollout:status

# Phase A: Descriptors (20-30 schemas)
npm run rollout:phase-a
# Validates and tests after phase
# Commits changes

# Phase B: Core (10-20 schemas)
npm run rollout:phase-b
# Validates and tests after phase
# Commits changes

# Check status
npm run rollout:status
```

### Day 2: Features & Specialty (Phases C & D)

```bash
# Phase C: Features (30-40 schemas)
npm run rollout:phase-c
# Validates and tests after phase
# Commits changes

# Phase D: Specialty (10-20 schemas)
npm run rollout:phase-d
# Validates and tests after phase
# Commits changes

# Final status check
npm run rollout:status
# Should show 100% completion

# Final validation
npm run validate
npm run test:ci
```

### Post-Rollout

```bash
# Document review
# Update docs/validation/rollout-review.md

# Create summary commit
git add docs/validation/rollout-review.md
git commit -m "docs: complete validationRules rollout review"

# Push to remote
git push origin <branch>
```

## Monitoring During Rollout

### Validation Checks
- Run `npm run validate` after each phase
- Ensure all schemas pass validation
- Fix any validation errors before proceeding

### Test Suite
- Run `npm run test:ci` after each phase
- Ensure all tests pass
- Investigate and fix any test failures

### Performance
- Monitor validation times
- Check memory usage
- Ensure no significant degradation

### Git History
- One commit per phase
- Clear commit messages
- Easy to review and revert if needed

## Success Metrics

- ✅ 100% of eligible schemas migrated
- ✅ Zero validation errors
- ✅ All tests passing
- ✅ Performance maintained (< 10% overhead)
- ✅ No critical bugs reported
- ✅ Clean git history

## Risk Mitigation

### Validation Failures
- **Mitigation:** Validate after each phase
- **Rollback:** Revert specific phase with git

### Test Failures
- **Mitigation:** Test after each phase
- **Rollback:** Revert and fix issues

### Performance Issues
- **Mitigation:** Measure after each phase
- **Solution:** Optimize or disable for affected schemas

### Merge Conflicts
- **Mitigation:** Work on dedicated branch
- **Solution:** Coordinate with team, rebase if needed

## Rollback Plan

### Phase-Level Rollback

```bash
# Rollback specific phase
git log --oneline  # Find phase commit
git revert <commit-hash>
```

### Full Rollback

```bash
# Revert all phases
git log --oneline --grep="migrate phase"
git revert <commit-range>

# Or restore from backup branch
git checkout main -- data/mods/
```

## Post-Rollout Actions

1. **Update Documentation**
   - Mark rollout as complete
   - Document any issues found
   - Update metrics

2. **Team Communication**
   - Announce completion
   - Share review document
   - Gather feedback

3. **Monitoring**
   - Watch for bug reports
   - Monitor performance
   - Track developer questions

4. **Future Improvements**
   - Document lessons learned
   - Identify optimization opportunities
   - Plan next enhancements

## Related Tickets

- **Parent:** ANASYSIMP-019 (Schema-Driven Validation Generation)
- **Depends on:** ANASYSIMP-019-06 (GO decision)
- **Depends on:** ANASYSIMP-019-07 (Documentation)
- **Completes:** ANASYSIMP-019 (Full implementation)

## References

- **Migration Utilities:** `scripts/migration/`
- **Documentation:** `docs/validation/`
- **Component Schemas:** `data/mods/*/components/`
