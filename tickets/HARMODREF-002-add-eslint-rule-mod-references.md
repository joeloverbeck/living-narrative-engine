# HARMODREF-002: Add ESLint Rule to Prevent Hardcoded Mod References

**Priority:** P0 - CRITICAL
**Effort:** 1 hour
**Status:** Not Started
**Created:** 2025-11-15

## Report Reference

**Primary Source:** [reports/hardcoded-mod-references-analysis.md](../reports/hardcoded-mod-references-analysis.md)
**Section:** "P0: Critical Fixes" → "2. Add Linting Prevention"

**⚠️ IMPORTANT:** Read the full report section before implementing this ticket to understand the architectural principles being enforced.

## Problem Statement

Without automated enforcement, hardcoded mod references will continue to leak into production code. We need a custom ESLint rule that prevents non-core mod references in engine code while allowing legitimate use cases (mod loader, tests).

## Objectives

1. Create custom ESLint rule to detect hardcoded mod references
2. Allow only `core:*` references in production code
3. Exempt legitimate files (modLoader.js, test files)
4. Integrate with pre-commit hooks
5. Document exemption process

## Affected Files

### New Files
1. `scripts/eslint-rules/no-hardcoded-mod-references.js` (custom rule implementation)
2. `docs/development/eslint-exemptions.md` (exemption documentation)

### Modified Files
3. `eslint.config.mjs` (flat ESLint config in repo root)
4. `.githooks/pre-commit` (project uses git's native hooks, not Husky)
5. `package.json` (may need to add scripts)

## Implementation Steps

### 1. Create Custom ESLint Rule (30 minutes)

Create `scripts/eslint-rules/no-hardcoded-mod-references.js`:

```javascript
/**
 * @fileoverview ESLint rule to prevent hardcoded mod references in production code
 * Allows only 'core' mod references, with exemptions for specific files
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent hardcoded mod references in production code',
      category: 'Best Practices',
      recommended: true
    },
    messages: {
      hardcodedModReference: 'Hardcoded reference to non-core mod "{{modId}}" detected. Use Component Type Registry or plugin system instead.',
      useRegistry: 'Consider using ComponentTypeRegistry for "{{modId}}" component access.'
    },
    schema: [{
      type: 'object',
      properties: {
        allowedMods: {
          type: 'array',
          items: { type: 'string' },
          default: ['core']
        },
        allowedFiles: {
          type: 'array',
          items: { type: 'string' },
          default: []
        }
      },
      additionalProperties: false
    }]
  },

  create(context) {
    const options = context.options[0] || {};
    const allowedMods = options.allowedMods || ['core'];
    const allowedFiles = options.allowedFiles || [];

    const filename = context.getFilename();

    // Check if current file is exempted
    const isExempted = allowedFiles.some(pattern => {
      if (pattern.includes('**')) {
        // Handle glob patterns
        const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
        return regex.test(filename);
      }
      return filename.includes(pattern);
    });

    if (isExempted) {
      return {}; // Skip validation for exempted files
    }

    // Pattern: modId:identifier (e.g., "positioning:sitting")
    const modReferencePattern = /^([a-z_][a-z0-9_]*):([a-z_][a-z0-9_]*)$/i;

    return {
      Literal(node) {
        if (typeof node.value !== 'string') return;

        const match = node.value.match(modReferencePattern);
        if (!match) return;

        const modId = match[1];

        // Check if mod is allowed
        if (allowedMods.includes(modId)) return;

        context.report({
          node,
          messageId: 'hardcodedModReference',
          data: { modId }
        });
      },

      TemplateElement(node) {
        const value = node.value.cooked || node.value.raw;
        const match = value.match(modReferencePattern);
        if (!match) return;

        const modId = match[1];
        if (allowedMods.includes(modId)) return;

        context.report({
          node,
          messageId: 'hardcodedModReference',
          data: { modId }
        });
      }
    };
  }
};
```

### 2. Configure ESLint (10 minutes)

Update `eslint.config.mjs`:

```javascript
module.exports = {
  // ... existing configuration ...

  plugins: [
    // ... existing plugins ...
    'local-rules'
  ],

  rules: {
    // ... existing rules ...

    'local-rules/no-hardcoded-mod-references': ['error', {
      allowedMods: ['core'],
      allowedFiles: [
        'src/loaders/modsLoader.js',
        'src/loaders/ModManifestProcessor.js',
        'tests/**/*.js',
        'scripts/**/*.js'
      ]
    }]
  }
};
```

If using local custom rules, add to package.json:

```json
{
  "eslintConfig": {
    "rulesdir": ["scripts/eslint-rules"]
  }
}
```

Or install `eslint-plugin-local-rules`:

```bash
npm install --save-dev eslint-plugin-local-rules
```

### 3. Add Pre-Commit Hook Integration (10 minutes)

Project hooks live in `.githooks/`. Update `.githooks/pre-commit` to run the rule (or reuse existing logic that already shells out to `npm run lint`). If additional automation is needed specifically for mod reference checks, extend the script:

```bash
# Ensure ESLint runs the custom rule against staged files
git diff --cached --name-only --diff-filter=ACM | \
  grep -E '\.(js|mjs)$' | \
  xargs -r npx eslint --max-warnings=0
```

Or add to `package.json`:

```json
{
  "scripts": {
    "lint": "eslint src/ --ext .js",
    "lint:fix": "eslint src/ --ext .js --fix",
    "lint:staged": "lint-staged"
  },
  "lint-staged": {
    "src/**/*.js": [
      "eslint --fix",
      "git add"
    ]
  }
}
```

### 4. Document Exemption Process (5 minutes)

Create `docs/development/eslint-exemptions.md`:

```markdown
# ESLint Mod Reference Exemptions

## Rule: no-hardcoded-mod-references

This rule prevents hardcoded mod references in production code to maintain architecture purity.

## Requesting Exemptions

### Legitimate Exemptions

1. **Mod Loading Code** (`src/loaders/`)
   - Mod loader and manifest processor need to reference mod IDs
   - Already exempted by default

2. **Test Files** (`tests/`)
   - Tests can reference any mod for validation
   - Already exempted by default

3. **Build Scripts** (`scripts/`)
   - Build tooling may need mod references
   - Already exempted by default

### How to Request Exemption

1. Confirm the exemption is legitimate:
   - Cannot be solved with Component Type Registry
   - Cannot be solved with plugin architecture
   - Truly requires direct mod reference

2. Add file to `.eslintrc.js` allowedFiles array

3. Document reason in code comments:
   ```javascript
   // ESLint exemption: Direct mod reference needed for [specific reason]
   const modId = 'positioning:sitting';
   ```

4. Add note to this document explaining the exemption

### Current Exemptions

- `src/loaders/modLoader.js` - Loads mod definitions
- `src/loaders/modManifestProcessor.js` - Processes mod manifests
- `tests/**/*.js` - Test files validate mod behavior
- `scripts/**/*.js` - Build tooling
```

### 5. Run ESLint on Codebase (5 minutes)

```bash
# Run on entire codebase to see current violations
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Generate violation report
npm run lint -- --output-file eslint-report.txt
```

Expected violations at this stage: ~65+ from existing hardcoded references (HARMODREF-003 will audit these).

## Acceptance Criteria

- [ ] Custom ESLint rule `no-hardcoded-mod-references` created
- [ ] Rule correctly detects hardcoded non-core mod references
- [ ] Rule allows `core:*` references in all files
- [ ] Rule exempts `modLoader.js` and test files
- [ ] ESLint configuration updated with rule enabled
- [ ] Pre-commit hook integration complete (if using hooks)
- [ ] Exemption documentation created
- [ ] Full codebase lint runs without crashing
- [ ] Violation report generated for existing issues

## Dependencies

**Recommended (but not required):**
- HARMODREF-001 - Reduces initial violation count, makes output cleaner

## Testing Requirements

```bash
# Test rule detects violations
cat > test-violation.js << 'EOF'
const sitting = entityManager.getComponent(id, 'positioning:sitting');
EOF
npx eslint test-violation.js
# Should show error about 'positioning' mod reference
rm test-violation.js

# Test rule allows core references
cat > test-core.js << 'EOF'
const actor = entityManager.getComponent(id, 'core:actor');
EOF
npx eslint test-core.js
# Should pass without errors
rm test-core.js

# Test exemptions work
npx eslint tests/unit/some-test.js
# Should pass even with mod references

# Full test suite
npm run test:ci
```

## Integration Plan

### Phase 1: Create and Configure (This Ticket)
- Implement rule
- Configure ESLint
- Document exemptions

### Phase 2: Baseline Audit (HARMODREF-003)
- Generate complete violation report
- Categorize and prioritize violations

### Phase 3: Gradual Remediation (P1 Tickets)
- Fix violations through Component Type Registry
- Fix violations through plugin architecture

## Notes

- This ticket focuses on **prevention**, not fixing existing violations
- Existing violations will be addressed in subsequent tickets
- Consider making rule a warning initially, then error after cleanup
- Rule can be enhanced over time (e.g., suggest specific patterns)

## Success Metrics

After implementation:
- New hardcoded mod references blocked at commit time
- Developers guided toward correct patterns
- Architecture violations reduced to zero over time
