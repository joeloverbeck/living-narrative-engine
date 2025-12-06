# HARMODREF-031: Create Automated Architecture Validation Suite

**Priority:** P1 - HIGH
**Effort:** 1 week
**Status:** Not Started

## Report Reference

[reports/hardcoded-mod-references-analysis.md](../reports/hardcoded-mod-references-analysis.md) - "📊 Success Metrics"

## Problem Statement

Create automated validation suite that continuously monitors for architectural violations and enforces the modding-first philosophy.

## Deliverables

### 1. Architecture Validator

**File:** `scripts/validation/architecture-validator.js`

- Verify Component Type Registry usage
- Verify plugin architecture compliance
- Check mod manifest completeness
- Generate violation reports

### 2. Hardcoded Reference Detector

**File:** `scripts/validation/hardcoded-references-detector.js`

- Scan for non-core mod references
- Report violations with file/line/severity
- Configurable exemptions

### 3. CI/CD Integration

**File:** `.github/workflows/architecture-validation.yml`

- Run on every PR
- Block merges with P0/P1 violations
- Generate reports

### 4. NPM Scripts

```json
{
  "scripts": {
    "validate:architecture": "node scripts/validation/architecture-validator.js",
    "validate:mod-references": "node scripts/validation/hardcoded-references-detector.js"
  }
}
```

### 5. Success Metrics Tracking

- Count hardcoded references over time
- Track architectural compliance percentage
- Generate monthly reports

## Acceptance Criteria

- [ ] Hardcoded reference detector implemented
- [ ] Architecture validator implemented
- [ ] CI/CD integration complete
- [ ] NPM scripts created
- [ ] Success metrics tracking operational
- [ ] Validation reports generated

## Dependencies

HARMODREF-002 (ESLint rule as reference)
