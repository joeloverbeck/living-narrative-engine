# HARMODREF-003: Audit and Document Remaining Non-Core References

**Priority:** P0 - CRITICAL
**Effort:** 2 hours
**Status:** Not Started
**Created:** 2025-11-15

## Report Reference

**Primary Source:** [reports/hardcoded-mod-references-analysis.md](../reports/hardcoded-mod-references-analysis.md)
**Section:** "🟡 Non-Core Mod Hardcoding (HIGH PRIORITY)" - Overview

**⚠️ IMPORTANT:** Read the full report before implementing to understand the complete scope of violations and their architectural implications.

## Problem Statement

The initial report identified 65+ non-core mod references throughout the codebase. We need a comprehensive, actionable audit that catalogs every violation, categorizes them by severity and refactoring approach, and serves as the foundation for P1/P2 refactoring efforts.

## Objectives

1. Create exhaustive catalog of all non-core mod references
2. Categorize by mod (positioning, items, affection, violence, clothing)
3. Assign severity levels (Critical/High/Medium)
4. Map to refactoring approaches (Registry/Plugin/Config)
5. Generate tracking tickets for major categories
6. Optional: Create automated audit script for future validation

## Affected Files

### New Files
1. `docs/architecture/hardcoded-references-audit.md` - Main audit document
2. `scripts/audit-mod-references.js` - Optional automated audit script
3. `docs/architecture/hardcoded-references-summary.md` - Summary statistics

## Implementation Steps

### 1. Comprehensive Search (30 minutes)

Search for all mod reference patterns in production code:

```bash
# Positioning mod references (~100 currently detected via `rg -o "positioning:" src | wc -l`)
grep -rn "positioning:" src/ --include="*.js" | grep -v node_modules > audit-positioning.txt

# Items mod references (~95 currently detected via `rg -o "items:" src | wc -l`)
grep -rn "items:" src/ --include="*.js" | grep -v node_modules > audit-items.txt

# Affection mod references (currently **0** in src — keep this verification to confirm the count stays at zero)
grep -rn "affection:" src/ --include="*.js" | grep -v node_modules > audit-affection.txt

# Violence mod references (currently **0** in src — keep this verification to confirm the count stays at zero)
grep -rn "violence:" src/ --include="*.js" | grep -v node_modules > audit-violence.txt

# Clothing mod references (~98 currently detected via `rg -o "clothing:" src | wc -l`)
grep -rn "clothing:" src/ --include="*.js" | grep -v node_modules > audit-clothing.txt

# Combine all
cat audit-*.txt > audit-all-references.txt
```

### 2. Create Structured Audit Document (60 minutes)

Create `docs/architecture/hardcoded-references-audit.md`:

```markdown
# Hardcoded Mod References - Complete Audit

**Generated:** 2025-11-15
**Scope:** Production source code in src/
**Methodology:** Grep pattern matching + manual categorization
**Total Violations:** [COUNT]

---

## Summary Statistics

| Mod | Total Refs | Critical | High | Medium | Registry Candidates | Plugin Candidates |
|-----|------------|----------|------|--------|---------------------|-------------------|
| positioning | [COUNT] | [COUNT] | [COUNT] | [COUNT] | [COUNT] | [COUNT] |
| items | [COUNT] | [COUNT] | [COUNT] | [COUNT] | [COUNT] | [COUNT] |
| affection | [COUNT] | [COUNT] | [COUNT] | [COUNT] | [COUNT] | [COUNT] |
| violence | [COUNT] | [COUNT] | [COUNT] | [COUNT] | [COUNT] | [COUNT] |
| clothing | [COUNT] | [COUNT] | [COUNT] | [COUNT] | [COUNT] | [COUNT] |
| **TOTAL** | **[COUNT]** | **[COUNT]** | **[COUNT]** | **[COUNT]** | **[COUNT]** | **[COUNT]** |

---

## Positioning Mod References

> Reality check (2025-02-15): `rg -o "positioning:" src | wc -l` currently returns **100** occurrences across production `src/` files.
> Most hits come from the closeness operation handlers (`establish*/remove*Closeness`, `mergeClosenessCircle`, `autoMoveClosenessPartners`, `breakClosenessWithTarget`, etc.) and services such as `closenessCircleService.js` and the positioning operators.
> The audit must catalogue *each* of those files rather than assuming only a single handler is affected.

### Operation Handlers (Component Type Registry Candidates)

#### 🔴 CRITICAL: establishSittingClosenessHandler.js
**File:** `src/logic/operationHandlers/establishSittingClosenessHandler.js`
**Lines:** 23-25, 34-36
**Pattern:** Hardcoded `positioning:sitting` component access
**Severity:** Critical - Cannot use alternative sitting systems
**Refactoring:** Component Type Registry
**Effort:** 2 hours
**Ticket:** HARMODREF-013

```javascript
// Current violation
const sittingComponent = this.#entityManager.getComponent(
  actorId,
  'positioning:sitting'  // ❌ HARDCODED
);
```

**Recommended Fix:**
```javascript
// Use Component Type Registry
const sittingComponent = this.#componentTypeRegistry.getComponentOfCategory(
  this.#entityManager,
  actorId,
  'sitting'
);
```

---

Document each of the following confirmed handlers/services with their exact component IDs and event names so the registry rollout has precise scope:

- `src/logic/operationHandlers/removeSittingClosenessHandler.js`
- `src/logic/operationHandlers/establishLyingClosenessHandler.js`
- `src/logic/operationHandlers/removeLyingClosenessHandler.js`
- `src/logic/operationHandlers/removeFromClosenessCircleHandler.js`
- `src/logic/operationHandlers/breakClosenessWithTargetHandler.js`
- `src/logic/operationHandlers/autoMoveClosenessPartnersHandler.js`
- `src/logic/operationHandlers/mergeClosenessCircleHandler.js`
- `src/logic/services/closenessCircleService.js`

Each entry should specify which `'positioning:*'` component IDs are being read/written so HARMODREF-010 through -015 can prioritize them.

### Action Pipeline (Data-Driven Candidates)

#### 🟡 HIGH: targetResolutionService.js
**File:** `src/actions/targetResolutionService.js`
**Lines:** 122-190 (three debug blocks)
**Pattern:** Direct comparisons to `actionId === 'positioning:sit_down'` and `scopeName === 'positioning:available_furniture'` baked into tracing/logging.
**Severity:** High - Couples the entire target resolution pipeline to a single mod's action and scope, preventing other mods from enabling equivalent diagnostics.
**Refactoring:** Load debug targets from action metadata or injectable tracing policies so any mod can opt in without editing core code.
**Effort:** 1 day
**Ticket:** HARMODREF-016

[...]

### Scope DSL (Plugin Architecture Candidates)

#### 🔴 CRITICAL: stepResolver.js
**File:** `src/scopeDsl/nodes/stepResolver.js`
**Lines:** 118-141
**Pattern:** Diagnostic logging assumes `'positioning:closeness'` will exist on every components object, reinforcing positioning-specific scopes during DSL evaluation.
**Severity:** Critical - Scope DSL introspection is leaking positioning-specific knowledge rather than staying mod-agnostic.
**Refactoring:** Introduce plugin-aware component inspectors so diagnostics enumerate whatever components are present without hardcoding namespace strings.
**Effort:** 3 days
**Ticket:** HARMODREF-017

[...]

---

## Items Mod References

> Reality check (2025-02-15): `rg -o "items:" src | wc -l` currently reports **95** occurrences in production code. The majority live inside the container/ inventory operation handlers and GOAP refinement logic. Capture every file in the audit so we can scope registry vs. plugin migrations.

### Container System (Component Type Registry Candidates)

#### 🔴 CRITICAL: openContainerHandler.js
**File:** `src/logic/operationHandlers/openContainerHandler.js`
**Lines:** 45-50
**Pattern:** Hardcoded `items:container` and `items:locked` access
**Severity:** Critical - Cannot create alternative container systems
**Refactoring:** Component Type Registry
**Effort:** 2 hours

[...]

### Inventory Validation (Plugin Architecture Candidates)

#### 🔴 CRITICAL: validateInventoryCapacityHandler.js
**File:** `src/logic/operationHandlers/validateInventoryCapacityHandler.js`
**Lines:** 67-72
**Pattern:** Hardcoded weight-based inventory validation
**Severity:** Critical - Forces weight-based system
**Refactoring:** Plugin Architecture (Capacity Validators)
**Effort:** 2 weeks
**Ticket:** HARMODREF-023

[...]

---

## Affection Mod References

> Reality check (2025-02-15): `rg -rn "affection:" src --include="*.js"` returns **0** matches. All affection namespaced entities currently live in tests and mod fixtures, not in production `src/` files.

#### ✅ VERIFIED: No production references (keep auditing for regressions)
**Action:** Document the zero-count finding in the audit and keep the grep in the validation checklist so future contributions don't reintroduce unwanted coupling. No code changes are required for HARMODREF-003 beyond capturing the verification evidence.

---

## Violence Mod References

> Reality check (2025-02-15): `rg -rn "violence:" src --include="*.js"` also returns **0** matches and there is no `eventBusRecursionGuard.js` file in the repo. The original assumption was incorrect.

#### ✅ VERIFIED: No production references (keep auditing for regressions)
**Action:** Capture the zero-count evidence in the audit deliverable. Future regressions should be caught by the validation commands already listed in this ticket.

---

## Clothing Mod References

> Reality check (2025-02-15): `rg -o "clothing:" src | wc -l` reports **98** occurrences in production files. The most tangible hardcoding happens inside the clothing-specific logic operators rather than the anatomy description service.

#### 🟡 HIGH: isSocketCoveredOperator.js
**File:** `src/logic/operators/isSocketCoveredOperator.js`
**Lines:** 76-205
**Pattern:** Direct references to `'clothing:equipment'`, `'clothing:slot_metadata'`, and coverage-mapping semantics are embedded directly into the operator, preventing non-clothing mods from reusing the operator infrastructure.
**Severity:** High - Couples logical socket coverage checks to a single mod's component schema.
**Refactoring:** Extract slot coverage queries behind injectable strategies or a registry so alternative equipment systems can integrate.
**Effort:** 1 day

#### 🟢 MEDIUM: hasClothingInSlotLayerOperator.js
**File:** `src/logic/operators/hasClothingInSlotLayerOperator.js`
**Lines:** ~70-110
**Pattern:** Hardcoded `'clothing:equipment'` lookups plus assumptions about clothing layers.
**Severity:** Medium - Still enforce the clothing component schema but easier to abstract once the coverage operator moves to a plugin.
**Refactoring:** Same registry/plugin approach as above.

Capture both operators (and any other `'clothing:*'` references surfaced by the grep output) inside the audit table so HARMODREF-018 can scope the clothing cleanup accurately.

---

## Refactoring Strategy Matrix

### Component Type Registry Approach
**Best For:** Operation handlers with component access
**Effort:** Low-Medium per handler
**Total Candidates:** ~30 handlers

| File | Mod | Component | Effort | Ticket |
|------|-----|-----------|--------|--------|
| establishSittingClosenessHandler.js | positioning | sitting | 2h | HARMODREF-013 |
| [... more handlers ...] |

### Plugin Architecture Approach
**Best For:** Complex system integrations
**Effort:** High (requires infrastructure)
**Total Candidates:** ~5 systems

| System | Mod | Plugin Type | Effort | Ticket |
|--------|-----|-------------|--------|--------|
| Scope DSL Relationships | positioning | RelationshipResolver | 3 days | HARMODREF-017 |
| Inventory Validation | items | CapacityValidator | 2 weeks | HARMODREF-023 |
| [... more systems ...] |

### Configuration Parameters Approach
**Best For:** Simple behavioral switches
**Effort:** Low per instance
**Total Candidates:** ~10 instances

| File | Pattern | Solution | Effort |
|------|---------|----------|--------|
| targetResolutionService.js | Sit_down-only diagnostics | Load debug targets from action metadata | 1 day |
| [... more instances ...] |

---

## Priority Roadmap

### Phase 1: P0 Foundation (Week 1)
- ✅ Remove p_erotica debug code (HARMODREF-001)
- ✅ Add ESLint prevention (HARMODREF-002)
- ✅ Complete this audit (HARMODREF-003)

### Phase 2: P1 Component Registry (Weeks 2-7)
- Design and implement Component Type Registry (HARMODREF-010, 011, 012)
- Refactor positioning handlers (HARMODREF-013, 014)
- Refactor items handlers (HARMODREF-015)
- Refactor validation stage (HARMODREF-016)

### Phase 3: P1 Scope DSL (Week 8)
- Refactor SlotAccessResolver (HARMODREF-017)

### Phase 4: P1 Remaining (Week 9-10)
- Affection/violence/clothing cleanup (HARMODREF-018)
- Documentation and validation (HARMODREF-030, 031)

### Phase 5: P2 Plugin Architecture (Weeks 11-24)
- Design plugin system (HARMODREF-020)
- Implement infrastructure (HARMODREF-021)
- Migrate systems to plugins (HARMODREF-022, 023, 024)
- Review core mod references (HARMODREF-025)

---

## Validation

Run these commands to verify audit completeness:

```bash
# Count total violations
grep -r "positioning:\|items:\|affection:\|violence:\|clothing:" src/ --include="*.js" | wc -l

# Should match audit count

# Verify no missed mods
grep -rE "[a-z_]+:[a-z_]+" src/ --include="*.js" | grep -v "core:" | grep -v "positioning:\|items:\|affection:\|violence:\|clothing:" | head -20
```

---

## Next Actions

1. Review audit for completeness
2. Validate counts match grep output
3. Prioritize tickets based on severity
4. Begin P1 refactoring with Component Type Registry
```

### 3. Optional: Create Automated Audit Script (30 minutes)

Create `scripts/audit-mod-references.js`:

```javascript
#!/usr/bin/env node

/**
 * Automated audit script for hardcoded mod references
 * Generates structured report of violations
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MODS_TO_AUDIT = ['positioning', 'items', 'affection', 'violence', 'clothing'];
const SOURCE_DIR = 'src';

function grepModReferences(modId) {
  try {
    const output = execSync(
      `grep -rn "${modId}:" ${SOURCE_DIR} --include="*.js"`,
      { encoding: 'utf-8' }
    );
    return output.trim().split('\n').filter(Boolean);
  } catch (err) {
    // grep returns non-zero when no matches
    return [];
  }
}

function parseReference(line) {
  const match = line.match(/^(.+):(\d+):(.+)$/);
  if (!match) return null;

  return {
    file: match[1],
    line: parseInt(match[2], 10),
    content: match[3].trim()
  };
}

function generateReport() {
  const results = {};
  let totalCount = 0;

  console.log('Auditing hardcoded mod references...\n');

  for (const modId of MODS_TO_AUDIT) {
    console.log(`Scanning for ${modId} references...`);
    const references = grepModReferences(modId);
    results[modId] = references.map(parseReference).filter(Boolean);
    totalCount += results[modId].length;
    console.log(`  Found ${results[modId].length} references`);
  }

  console.log(`\nTotal violations: ${totalCount}\n`);

  // Generate markdown report
  let markdown = `# Hardcoded Mod References Audit\n\n`;
  markdown += `**Generated:** ${new Date().toISOString()}\n`;
  markdown += `**Total Violations:** ${totalCount}\n\n`;
  markdown += `## Summary\n\n`;
  markdown += `| Mod | Count |\n`;
  markdown += `|-----|-------|\n`;

  for (const modId of MODS_TO_AUDIT) {
    markdown += `| ${modId} | ${results[modId].length} |\n`;
  }

  markdown += `\n## Detailed References\n\n`;

  for (const modId of MODS_TO_AUDIT) {
    markdown += `### ${modId} Mod\n\n`;

    const byFile = {};
    results[modId].forEach(ref => {
      if (!byFile[ref.file]) byFile[ref.file] = [];
      byFile[ref.file].push(ref);
    });

    Object.entries(byFile).forEach(([file, refs]) => {
      markdown += `#### ${file}\n\n`;
      refs.forEach(ref => {
        markdown += `- Line ${ref.line}: \`${ref.content}\`\n`;
      });
      markdown += `\n`;
    });
  }

  return markdown;
}

// Generate and save report
const report = generateReport();
const outputPath = 'docs/architecture/hardcoded-references-audit-automated.md';
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, report);
console.log(`Report saved to ${outputPath}`);
```

Make executable:
```bash
chmod +x scripts/audit-mod-references.js
```

### 4. Generate Summary Statistics (10 minutes)

Run audit and create summary:

```bash
# Run automated audit (if created)
node scripts/audit-mod-references.js

# Or manual count
echo "## Violation Counts" > docs/architecture/hardcoded-references-summary.md
echo "" >> docs/architecture/hardcoded-references-summary.md
echo "| Mod | Count |" >> docs/architecture/hardcoded-references-summary.md
echo "|-----|-------|" >> docs/architecture/hardcoded-references-summary.md

for mod in positioning items affection violence clothing; do
  count=$(grep -r "${mod}:" src/ --include="*.js" | wc -l)
  echo "| $mod | $count |" >> docs/architecture/hardcoded-references-summary.md
done
```

## Acceptance Criteria

- [ ] Complete audit document created in `docs/architecture/hardcoded-references-audit.md`
- [ ] All 65+ references cataloged with file, line, pattern, severity
- [ ] References categorized by mod (positioning, items, affection, violence, clothing)
- [ ] Severity levels assigned (Critical/High/Medium)
- [ ] Refactoring approaches mapped (Registry/Plugin/Config)
- [ ] Summary statistics match grep verification
- [ ] Audit serves as actionable basis for P1/P2 tickets
- [ ] Optional: Automated audit script created and functional
- [ ] Summary document generated

## Dependencies

**None** - Independent audit task

**Recommended Before:**
- HARMODREF-001 - Reduces noise from p_erotica references

## Testing Requirements

```bash
# Verify audit completeness
AUDIT_COUNT=$(grep -c "^####" docs/architecture/hardcoded-references-audit.md)
GREP_COUNT=$(grep -r "positioning:\|items:\|affection:\|violence:\|clothing:" src/ --include="*.js" | wc -l)

echo "Audit entries: $AUDIT_COUNT"
echo "Grep matches: $GREP_COUNT"
# Counts should be close (audit may group multiple refs per file)

# Run automated audit (if created)
node scripts/audit-mod-references.js
diff docs/architecture/hardcoded-references-audit.md docs/architecture/hardcoded-references-audit-automated.md
```

## Deliverables

1. **Main Audit Document** - Complete catalog with categorization
2. **Summary Statistics** - Counts and distribution
3. **Automated Script** (Optional) - Repeatable audit generation
4. **Ticket References** - Links to specific HARMODREF tickets for each category

## Next Steps After Completion

1. Review audit with team
2. Validate priority assignments
3. Begin HARMODREF-010 (Component Type Registry design)
4. Use audit as reference for all P1/P2 refactoring tickets

## Notes

- This audit is the **foundation** for all subsequent refactoring work
- Keep audit updated as violations are fixed
- Re-run automated script periodically to track progress
- Audit format should be actionable - developers can jump straight to fixes
