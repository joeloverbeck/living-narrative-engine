# DEABRADET-008: DeadBranchSectionGenerator

## Description

Create a section generator that renders dead branch findings to markdown following existing section generator patterns.

## Files to Create

- `src/expressionDiagnostics/services/sectionGenerators/DeadBranchSectionGenerator.js`
- `tests/unit/expressionDiagnostics/services/sectionGenerators/DeadBranchSectionGenerator.test.js`

## Files to Modify

- `src/expressionDiagnostics/services/sectionGenerators/index.js` - Add export
- `src/dependencyInjection/tokens/tokens-diagnostics.js` - Add `IDeadBranchSectionGenerator` token
- `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` - Add registration

## Out of Scope

- MonteCarloReportGenerator integration (DEABRADET-009)
- RecommendationEngine integration (DEABRADET-010)

## Implementation Details

### DeadBranchSectionGenerator.js

```javascript
/**
 * @file DeadBranchSectionGenerator - Renders dead branch findings to markdown
 * @see specs/dead-branch-detection.md
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

class DeadBranchSectionGenerator {
  #formattingService;
  #logger;

  constructor({ formattingService, logger = null }) {
    if (!formattingService) {
      throw new Error('DeadBranchSectionGenerator requires formattingService');
    }
    this.#formattingService = formattingService;
    this.#logger = logger;
  }

  /**
   * Generate the dead branch analysis section.
   * @param {object} params
   * @param {import('../../models/DeadBranchFindings.js').DeadBranchFindings} params.findings
   * @param {string} params.expressionId
   * @returns {string} Markdown string
   */
  generate({ findings, expressionId }) {
    if (!findings?.orBlocks?.length) {
      return '';
    }

    const sections = [];
    sections.push('## Dead Branch Analysis\n');

    for (const orBlock of findings.orBlocks) {
      sections.push(this.#renderOrBlock(orBlock));
    }

    if (findings.collapsedOrBlocks > 0) {
      sections.push(this.#renderCollapsedWarning(findings.collapsedOrBlocks));
    }

    return sections.join('\n');
  }

  #renderOrBlock(orBlock) {
    const lines = [];
    lines.push(`### OR Block: ${orBlock.id}\n`);
    lines.push(`**Population**: ${orBlock.population} | **Support**: ${orBlock.support}\n`);

    // Alternative Liveness Table
    lines.push('| Alternative | Pass (mood) | Status | Why |');
    lines.push('|-------------|-------------|--------|-----|');

    for (const alt of orBlock.alternatives) {
      lines.push(this.#renderAlternativeRow(alt));
    }

    lines.push('');

    // Dead Branch Evidence Blocks
    const deadAlternatives = orBlock.alternatives.filter(a => a.status === 'DEAD_BRANCH');
    for (const alt of deadAlternatives) {
      lines.push(this.#renderDeadBranchEvidence(alt));
    }

    if (orBlock.effectiveAlternativeCount === 1) {
      lines.push('> ⚠️ **OR collapses to single path in this regime**\n');
    }

    return lines.join('\n');
  }

  #renderAlternativeRow(alt) {
    const passInfo = `${this.#formattingService.formatPercentage(alt.passRate)} (${alt.passCount}/${alt.support})`;
    const statusBadge = this.#getStatusBadge(alt.status);
    const why = this.#getWhySummary(alt);
    const altDesc = alt.clauseRefs.join(' AND ');

    return `| ${altDesc} | ${passInfo} | ${statusBadge} | ${why} |`;
  }

  #getStatusBadge(status) {
    switch (status) {
      case 'ACTIVE': return '🟢 ACTIVE';
      case 'RARE': return '🟡 RARE';
      case 'UNOBSERVED': return '⚪ UNOBSERVED';
      case 'DEAD_BRANCH': return '❌ DEAD_BRANCH';
      default: return status;
    }
  }

  #getWhySummary(alt) {
    if (alt.status !== 'DEAD_BRANCH' || !alt.deadEvidence?.length) {
      return alt.status === 'RARE' ? 'low probability tail' : '-';
    }
    const evidence = alt.deadEvidence[0];
    if (evidence.type === 'CLAMP_IMPOSSIBLE') {
      return `gate clamp (gatePassRate=0)`;
    }
    return `${evidence.clauseRef.split('.').pop()} max=${evidence.observedBound} < ${evidence.threshold}`;
  }

  #renderDeadBranchEvidence(alt) {
    const lines = [];
    lines.push(`#### Dead Branch Evidence: ${alt.clauseRefs.join(' AND ')}\n`);

    for (const evidence of alt.deadEvidence) {
      lines.push(`**Proof**: ${evidence.type} - ${this.#getProofDescription(evidence)}`);
      lines.push(`- observedBound = ${evidence.observedBound}`);
      lines.push(`- threshold = ${evidence.threshold}`);
      lines.push(`- gap = ${evidence.gap.toFixed(2)}`);
      if (evidence.gatePassRate !== undefined) {
        lines.push(`- gatePassRate = ${evidence.gatePassRate}`);
      }
      lines.push('');
    }

    if (alt.limitingConstraints?.length) {
      lines.push('**Limiting Constraints**:');
      for (const constraint of alt.limitingConstraints) {
        lines.push(`- ${constraint.explanation}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  #getProofDescription(evidence) {
    switch (evidence.type) {
      case 'CEILING': return 'maxObserved < threshold';
      case 'FLOOR': return 'minObserved > threshold';
      case 'CLAMP_IMPOSSIBLE': return 'gatePassRate=0 clamps to 0';
      default: return evidence.type;
    }
  }

  #renderCollapsedWarning(count) {
    return `\n> ⚠️ **${count} OR block(s) collapse to single path** - consider simplifying logic or adjusting regime constraints.\n`;
  }
}

export default DeadBranchSectionGenerator;
```

### Output Format (from spec)

**Alternative Liveness Table**:
| Alternative | Pass (mood) | Status | Why |
|-------------|-------------|--------|-----|
| emotions.moral_outrage >= 0.6 | 1.33% (6/452) | 🟡 RARE | gate clamp 89% + threshold tail |
| (emotions.rage >= 0.45 AND moodAxes.affiliation >= 10) | 0.00% (0/452) | ❌ DEAD_BRANCH | rage max=0.26 < 0.45 |

**Expandable Dead Branch Evidence**:
```markdown
#### Dead Branch Evidence: emotions.rage >= 0.45

**Proof**: CEILING - maxObserved < threshold
- observedBound = 0.26
- threshold = 0.45
- gap = 0.19

**Limiting Constraints**:
- moodAxes.arousal <= 45 + rage weight +0.95 ⇒ capped arousal prevents rage reaching 0.45
```

## Acceptance Criteria

### Tests That Must Pass

1. **Constructor validation**:
   - Throws if `formattingService` is missing
   - Accepts null `logger`

2. **Empty findings**:
   - `generate({ findings: null })` returns empty string
   - `generate({ findings: { orBlocks: [] } })` returns empty string

3. **Single OR block with mixed statuses**:
   - Contains table header row
   - Contains row for each alternative
   - DEAD_BRANCH alternative has ❌ badge
   - RARE alternative has 🟡 badge
   - ACTIVE alternative has 🟢 badge

4. **DEAD_BRANCH with full evidence**:
   - Contains "Dead Branch Evidence" section
   - Shows proof type (CEILING/FLOOR/CLAMP_IMPOSSIBLE)
   - Shows observedBound, threshold, gap
   - Shows limiting constraints when present

5. **Collapsed OR block warning**:
   - Shows warning when effectiveAlternativeCount === 1
   - Warning contains ⚠️ emoji

6. **Format validation**:
   - Output is valid markdown
   - Table has correct column count
   - No trailing whitespace issues

### Invariants That Must Remain True

1. **Spec invariant safety/UX 1**: Only output for OR blocks with dead branches
2. **Spec invariant safety/UX 2**: Stable wording from evidence fields
3. Output format matches spec exactly
4. Uses formattingService for percentage formatting
5. Existing section generator tests continue to pass
6. `npm run typecheck` passes
7. `npx eslint src/expressionDiagnostics/services/sectionGenerators/DeadBranchSectionGenerator.js` passes

## Dependencies

- DEABRADET-001 (DeadEvidence, LimitingConstraint model types)
- DEABRADET-002 (Alternative model type)
- DEABRADET-003 (OrBlock, DeadBranchFindings model types)

## Estimated Diff Size

~180 lines of source code + ~250 lines of tests + ~15 lines DI/exports = ~445 lines total
