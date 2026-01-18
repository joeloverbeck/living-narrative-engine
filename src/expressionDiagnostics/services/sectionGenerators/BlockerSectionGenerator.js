/**
 * @file BlockerSectionGenerator - Generates blocker analysis report sections
 */

import BlockerTreeTraversal from '../BlockerTreeTraversal.js';
import ReportDataExtractor from '../ReportDataExtractor.js';
import { SCOPE_METADATA } from '../../models/AnalysisScopeMetadata.js';
import { renderScopeMetadataHeader } from '../../utils/scopeMetadataRenderer.js';

class BlockerSectionGenerator {
  #formattingService;
  #treeTraversal;
  #dataExtractor;
  #prototypeSectionGenerator;
  #blockerCalculator;

  constructor({
    formattingService,
    treeTraversal = null,
    dataExtractor = null,
    prototypeSectionGenerator = null,
    blockerCalculator = null,
  } = {}) {
    if (!formattingService) {
      throw new Error('BlockerSectionGenerator requires formattingService');
    }

    this.#formattingService = formattingService;
    this.#treeTraversal = treeTraversal ?? new BlockerTreeTraversal();
    this.#dataExtractor = dataExtractor ?? new ReportDataExtractor();
    this.#prototypeSectionGenerator = prototypeSectionGenerator ?? null;
    this.#blockerCalculator = blockerCalculator;
  }

  /**
   * Generate the blocker analysis section.
   * @param {object[]} blockers
   * @param {number} sampleCount
   * @param {Map|null} axisConstraints - Axis constraints from expression prerequisites
   * @param {object[]|null} storedContexts - Stored simulation contexts for gate failure rate computation
   * @returns {string}
   */
  generateBlockerAnalysis(
    blockers,
    sampleCount,
    axisConstraints,
    storedContexts = null,
    populationSummary = null,
    storedPopulations = null,
    hasOrMoodConstraints = false,
    moodConstraints = [],
    gateCompatibility = null,
    simulationResult = null
  ) {
    if (!blockers || blockers.length === 0) {
      return `## Blocker Analysis

No blockers identified.

---
`;
    }

    const blockerSections = blockers.map((blocker) =>
      this.#generateBlockerSection(
        blocker,
        blocker.rank,
        sampleCount,
        axisConstraints,
        storedContexts,
        populationSummary,
        storedPopulations,
        hasOrMoodConstraints,
        moodConstraints,
        gateCompatibility
      )
    );

    const note = `
> **Note on Sole-Blocker N values**: Each clause's N represents samples where all *other* clauses passed (excluding itself). Different clauses have different "others" sets, so N naturally varies. This is correct behavior indicating which clause is the decisive blocker when others succeed.
`;

    const probabilityFunnel = this.#generateProbabilityFunnel({
      sampleCount,
      blockers,
      simulationResult,
    });

    const scopeHeader = renderScopeMetadataHeader(SCOPE_METADATA.BLOCKER_GLOBAL);

    // Generate core blocker summary if calculator is available
    const coreBlockerSummary = this.#generateCoreBlockerSection(simulationResult);

    const sections = [
      '## Blocker Analysis',
      'Signal: final (gate-clamped intensity).',
      '',
      scopeHeader,
      probabilityFunnel,
      coreBlockerSummary,
      blockerSections.join('\n'),
      note,
    ].filter((section) => typeof section === 'string' && section.trim().length > 0);

    return `${sections.join('\n')}`;
  }

  #generateProbabilityFunnel({ sampleCount, blockers, simulationResult }) {
    if (!Number.isFinite(sampleCount)) {
      return '';
    }

    const lines = ['### Probability Funnel'];

    lines.push(`- **Full sample**: ${this.#formattingService.formatCount(sampleCount)}`);

    const inRegimeSampleCount = simulationResult?.inRegimeSampleCount;
    const moodRate =
      Number.isFinite(inRegimeSampleCount) && sampleCount > 0
        ? inRegimeSampleCount / sampleCount
        : null;
    lines.push(
      `- **Mood-regime pass**: ${this.#formattingService.formatRateWithCounts(
        moodRate,
        inRegimeSampleCount,
        sampleCount
      )}`
    );

    const keyThresholds = this.#selectKeyThresholdClauses({
      blockers,
      clauseFailures: simulationResult?.clauseFailures,
      ablationImpact: simulationResult?.ablationImpact,
    });
    if (keyThresholds.length > 0) {
      for (const leaf of keyThresholds) {
        const gatePassCount = leaf.gatePassInRegimeCount;
        const inRegimeEvaluationCount = leaf.inRegimeEvaluationCount;
        const gatePassRate =
          Number.isFinite(gatePassCount) &&
          Number.isFinite(inRegimeEvaluationCount) &&
          inRegimeEvaluationCount > 0
            ? gatePassCount / inRegimeEvaluationCount
            : null;
        const label = this.#formattingService.formatFunnelClauseLabel(leaf);
        lines.push(
          `- **Gate pass | mood-pass (${label})**: ${this.#formattingService.formatRateWithCounts(
            gatePassRate,
            gatePassCount,
            inRegimeEvaluationCount
          )}`
        );
      }
    } else {
      lines.push('- **Gate pass | mood-pass**: N/A');
    }

    const orBlocks = this.#treeTraversal.collectOrBlocks(blockers);
    if (orBlocks.length > 0) {
      orBlocks.forEach((orNode, index) => {
        const useInRegime =
          Number.isFinite(orNode?.inRegimeEvaluationCount) &&
          orNode.inRegimeEvaluationCount > 0;
        const evaluationCount = useInRegime
          ? orNode.inRegimeEvaluationCount
          : orNode?.evaluationCount;
        const unionCount = useInRegime
          ? this.#treeTraversal.resolveOrUnionInRegimeCount(orNode)
          : this.#treeTraversal.resolveOrUnionCount(orNode);
        const unionRate =
          Number.isFinite(unionCount) &&
          Number.isFinite(evaluationCount) &&
          evaluationCount > 0
            ? unionCount / evaluationCount
            : null;
        lines.push(
          `- **OR union pass | mood-pass (OR Block #${
            index + 1
          })**: ${this.#formattingService.formatRateWithCounts(
            unionRate,
            unionCount,
            evaluationCount
          )}`
        );
      });
    } else {
      lines.push('- **OR union pass | mood-pass**: N/A');
    }

    const triggerCount = simulationResult?.triggerCount;
    const triggerRate =
      Number.isFinite(triggerCount) && sampleCount > 0
        ? triggerCount / sampleCount
        : null;
    lines.push(
      `- **Final trigger**: ${this.#formattingService.formatRateWithCounts(
        triggerRate,
        triggerCount,
        sampleCount
      )}`
    );

    return `${lines.join('\n')}\n`;
  }

  #selectKeyThresholdClauses({ blockers, clauseFailures, ablationImpact }) {
    const leafNodes = this.#treeTraversal.collectFunnelLeaves({ blockers, clauseFailures });
    const eligibleLeaves = leafNodes.filter(
      (leaf) =>
        leaf?.nodeType === 'leaf' &&
        Number.isFinite(leaf?.gatePassInRegimeCount) &&
        Number.isFinite(leaf?.inRegimeEvaluationCount)
    );

    if (eligibleLeaves.length === 0) {
      return [];
    }

    const leafByClauseId = new Map();
    for (const leaf of eligibleLeaves) {
      if (leaf.clauseId && !leafByClauseId.has(leaf.clauseId)) {
        leafByClauseId.set(leaf.clauseId, leaf);
      }
    }

    const impacts = Array.isArray(ablationImpact?.clauseImpacts)
      ? [...ablationImpact.clauseImpacts]
      : [];
    impacts.sort(
      (a, b) =>
        (b?.impact ?? 0) - (a?.impact ?? 0) ||
        String(a?.clauseId ?? '').localeCompare(String(b?.clauseId ?? ''))
    );

    const selected = [];
    for (const impact of impacts) {
      const leaf = leafByClauseId.get(impact?.clauseId);
      if (!leaf) continue;
      selected.push(leaf);
      if (selected.length >= 2) {
        break;
      }
    }

    if (selected.length > 0) {
      return selected;
    }

    return eligibleLeaves
      .map((leaf) => {
        const score =
          typeof leaf?.inRegimeFailureRate === 'number'
            ? leaf.inRegimeFailureRate
            : typeof leaf?.failureRate === 'number'
              ? leaf.failureRate
              : 0;
        return { leaf, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((entry) => entry.leaf);
  }

  #generateBlockerSection(
    blocker,
    rank,
    sampleCount,
    axisConstraints,
    storedContexts = null,
    populationSummary = null,
    storedPopulations = null,
    hasOrMoodConstraints = false,
    moodConstraints = [],
    gateCompatibility = null
  ) {
    const clauseDesc = blocker.clauseDescription ?? 'Unknown clause';
    const failureRate = blocker.failureRate ?? 0;
    const failureCount = Math.round(failureRate * sampleCount);
    const inRegimeFailureRate =
      blocker.inRegimeFailureRate ??
      blocker.hierarchicalBreakdown?.inRegimeFailureRate ??
      null;
    const inRegimeFailureCount =
      blocker.hierarchicalBreakdown?.inRegimeFailureCount ?? null;
    const inRegimeEvaluationCount =
      blocker.hierarchicalBreakdown?.inRegimeEvaluationCount ?? null;
    const severity = blocker.severity ?? 'unknown';

    // Extract condition details from hierarchicalBreakdown if available
    const hb = blocker.hierarchicalBreakdown ?? {};
    const redundantInRegime =
      blocker.redundantInRegime ?? hb.redundantInRegime ?? null;
    const redundancyStr = this.#formattingService.formatBooleanValue(redundantInRegime);
    const clampTrivialInRegime = this.#resolveClampTrivialInRegime({
      ...hb,
      clampTrivialInRegime:
        blocker.clampTrivialInRegime !== undefined
          ? blocker.clampTrivialInRegime
          : hb.clampTrivialInRegime,
    });
    const clampTrivialStr = this.#formattingService.formatClampTrivialLabel(clampTrivialInRegime);
    const globalFailStr = this.#formattingService.formatFailRate(
      failureRate,
      failureCount,
      sampleCount
    );
    const inRegimeFailStr = this.#formattingService.formatFailRate(
      inRegimeFailureRate,
      inRegimeFailureCount,
      inRegimeEvaluationCount
    );

    // For compound nodes (AND/OR), show compound type instead of trying to extract leaf fields
    let conditionLine;
    if (hb.isCompound) {
      const nodeType = (hb.nodeType ?? 'compound').toUpperCase();
      conditionLine = `**Condition**: Compound ${nodeType} block`;
    } else {
      const variablePath = hb.variablePath ?? 'unknown';
      const operator = hb.comparisonOperator ?? '?';
      const threshold = hb.thresholdValue ?? 'N/A';
      conditionLine = `**Condition**: \`${variablePath} ${operator} ${threshold}\``;
    }

    // Generate leaf breakdown section for compound nodes
    const leafBreakdown = this.#generateLeafBreakdown(blocker, sampleCount);
    const worstOffenderAnalysis = this.#generateWorstOffenderAnalysis(blocker, sampleCount);

    // Generate prototype math section for emotion/sexual threshold conditions
    const prototypeMath = this.#prototypeSectionGenerator?.generatePrototypeMathSection
      ? this.#prototypeSectionGenerator.generatePrototypeMathSection(
        blocker,
        axisConstraints,
        storedContexts,
        populationSummary,
        storedPopulations,
        hasOrMoodConstraints,
        moodConstraints,
        gateCompatibility
      )
      : '';

    const clauseAnchorId = this.#buildClauseAnchorId(hb.clauseId);
    const clauseAnchor = clauseAnchorId ? `<a id="${clauseAnchorId}"></a>\n` : '';

    return `### Blocker #${rank}: \`${clauseDesc}\`

${clauseAnchor}
${conditionLine}
**Fail% global**: ${globalFailStr}
**Fail% | mood-pass**: ${inRegimeFailStr}
**Severity**: ${severity}
**Redundant in regime**: ${redundancyStr}
**Clamp-trivial in regime**: ${clampTrivialStr}

${this.#generateFlags(blocker)}

${leafBreakdown}

${worstOffenderAnalysis}

${prototypeMath}

${this.#generateDistributionAnalysis(blocker)}

${this.#generateCeilingAnalysis(blocker)}

${this.#generateNearMissAnalysis(blocker)}

${this.#generateLastMileAnalysis(blocker)}

${this.#generateRecommendation(blocker)}

---
`;
  }

  #buildClauseAnchorId(clauseId) {
    if (!clauseId) {
      return null;
    }
    const token = String(clauseId)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return token ? `clause-${token}` : null;
  }

  #generateLeafBreakdown(blocker, sampleCount) {
    const hb = blocker.hierarchicalBreakdown ?? {};

    // Only generate for compound nodes with children
    if (!hb.isCompound || !hb.children || hb.children.length === 0) {
      return '';
    }

    // Build structured tree preserving AND/OR semantics
    const structured = this.#treeTraversal.buildStructuredTree(hb);
    if (!structured) {
      return '';
    }

    // Generate the structured breakdown
    return this.#generateStructuredBreakdown(structured, sampleCount);
  }

  #generateStructuredBreakdown(structured, sampleCount) {
    const sections = [];
    let rowIndex = 1;
    let orBlockIndex = 1;

    // For top-level AND, process each child
    if (structured.type === 'and') {
      const andLeaves = [];
      const orBlocks = [];

      for (const child of structured.children) {
        if (child.type === 'leaf') {
          andLeaves.push(child);
        } else if (child.type === 'or') {
          orBlocks.push(child);
        } else if (child.type === 'and') {
          // Nested AND - flatten its leaves into the main AND section
          for (const grandchild of child.children) {
            if (grandchild.type === 'leaf') {
              andLeaves.push(grandchild);
            } else if (grandchild.type === 'or') {
              orBlocks.push(grandchild);
            }
          }
        }
      }

      // Generate required AND conditions section
      if (andLeaves.length > 0) {
        const andSection = this.#generateConditionGroup(
          'Required Conditions (ALL must pass)',
          andLeaves,
          sampleCount,
          rowIndex,
          null // No combined pass rate for AND - they're all required
        );
        sections.push(andSection.markdown);
        rowIndex = andSection.nextRowIndex;
      }

      // Generate OR block sections
      for (const orBlock of orBlocks) {
        const orBlockTitle = `OR Block #${orBlockIndex}`;
        const orPassRate = this.#treeTraversal.calculateOrPassRate(orBlock.node);
        const orInRegimeFailureRate = this.#treeTraversal.calculateOrInRegimeFailureRate(
          orBlock.node
        );
        const orSection = this.#generateConditionGroup(
          `${orBlockTitle} (ANY ONE must pass)`,
          orBlock.children,
          sampleCount,
          rowIndex,
          orPassRate,
          orInRegimeFailureRate
        );

        // Add OR contribution breakdown after the table
        const contributionBreakdown = this.#generateOrContributionBreakdown(
          orBlockTitle,
          orBlock.children
        );
        const overlapBreakdown = this.#generateOrOverlapBreakdown(
          orBlockTitle,
          orBlock.node,
          orBlock.children
        );

        sections.push(orSection.markdown + contributionBreakdown + overlapBreakdown);
        rowIndex = orSection.nextRowIndex;
        orBlockIndex++;
      }
    } else if (structured.type === 'or') {
      // Top-level OR (less common)
      const orPassRate = this.#treeTraversal.calculateOrPassRate(structured.node);
      const orInRegimeFailureRate = this.#treeTraversal.calculateOrInRegimeFailureRate(
        structured.node
      );
      const orSection = this.#generateConditionGroup(
        'OR Block (ANY ONE must pass)',
        structured.children,
        sampleCount,
        rowIndex,
        orPassRate,
        orInRegimeFailureRate
      );

      // Add OR contribution breakdown after the table
      const contributionBreakdown = this.#generateOrContributionBreakdown(
        'OR Block',
        structured.children
      );
      const overlapBreakdown = this.#generateOrOverlapBreakdown(
        'OR Block',
        structured.node,
        structured.children
      );

      sections.push(orSection.markdown + contributionBreakdown + overlapBreakdown);
    }

    if (sections.length === 0) {
      return '';
    }

    return `#### Condition Breakdown

${sections.join('\n\n')}`;
  }

  #generateConditionGroup(
    title,
    children,
    sampleCount,
    startIndex,
    combinedPassRate,
    combinedInRegimeFailureRate = null
  ) {
    // For OR blocks, preserve nested AND structure for better readability
    // This helps users understand that conditions in a nested AND must ALL pass together
    const isOrBlock = combinedPassRate !== null;
    const entries = [];

    // Extract entries, preserving nested AND blocks as grouped units
    for (const child of children) {
      if (child.type === 'leaf') {
        entries.push({ type: 'leaf', node: child.node, groupLabel: null });
      } else if (child.type === 'and' && isOrBlock) {
        // Nested AND within OR - group these together
        const nestedLeaves = this.#treeTraversal.flattenLeaves(child.node);
        if (nestedLeaves.length > 0) {
          entries.push({
            type: 'grouped_and',
            leaves: nestedLeaves,
            groupLabel: `AND Group (${nestedLeaves.length} conditions - all must pass together)`,
          });
        }
      } else {
        // For other nested compounds, flatten
        const nestedLeaves = this.#treeTraversal.flattenLeaves(child.node);
        for (const leaf of nestedLeaves) {
          entries.push({ type: 'leaf', node: leaf, groupLabel: null });
        }
      }
    }

    if (entries.length === 0) {
      return { markdown: '', nextRowIndex: startIndex };
    }

    const includeGateMetrics = entries.some((entry) => {
      if (entry.type === 'leaf') {
        return this.#treeTraversal.isEmotionThresholdLeaf(entry.node);
      }
      if (entry.type === 'grouped_and') {
        return entry.leaves.some((leaf) => this.#treeTraversal.isEmotionThresholdLeaf(leaf));
      }
      return false;
    });

    const baseColumns = [
      '#',
      'Condition',
      'Fail% global',
      'Fail% \\| mood-pass',
      'Support',
      'Bound',
      'Threshold',
      'Gap',
      'Tunable',
      'Redundant (regime)',
      'Clamp-trivial (regime)',
      'Sole-Blocker Rate',
    ];
    const gateColumns = includeGateMetrics
      ? [
        'Gate pass (mood)',
        'Gate clamp (mood)',
        'Pass \\| gate (mood)',
        'Pass \\| mood (mood)',
      ]
      : [];
    const columns = baseColumns.concat(gateColumns);

    // Build header with appropriate columns
    // "Bound" column shows maxObserved for >= operators, minObserved for <= operators
    let header = `**${title}**\n\n`;
    header += `| ${columns.join(' | ')} |\n`;
    header += `|${columns.map(() => '---').join('|')}|`;

    // Generate rows with group labels for nested AND blocks
    const rows = [];
    let rowIndex = startIndex;

    for (const entry of entries) {
      if (entry.type === 'leaf') {
        // For OR blocks, mark leaves so last-mile shows N/A (OR alternatives aren't all required)
        rows.push(
          this.#generateLeafRow(
            entry.node,
            rowIndex,
            sampleCount,
            isOrBlock,
            includeGateMetrics
          )
        );
        rowIndex++;
      } else if (entry.type === 'grouped_and') {
        // Add a group marker row for nested AND blocks
        const emptyCells = columns.map(() => '');
        emptyCells[1] = `**${entry.groupLabel}**`;
        rows.push(`| ${emptyCells.join(' | ')} |`);
        // Add each leaf in the group with indentation
        // Note: Leaves inside a grouped AND within an OR are still OR alternatives
        // (the whole AND group is one alternative), so they also get isOrBlock=true
        for (const leaf of entry.leaves) {
          const leafRow = this.#generateLeafRow(
            leaf,
            rowIndex,
            sampleCount,
            isOrBlock,
            includeGateMetrics
          );
          // Add visual grouping indicator (└─) to the condition column
          const indentedRow = leafRow.replace(
            /\| (\d+) \| `([^`]+)`/,
            '| $1 | `└─ $2`'
          );
          rows.push(indentedRow);
          rowIndex++;
        }
      }
    }

    let footer = '';
    if (combinedPassRate !== null) {
      const combinedFailRate = 1 - combinedPassRate;
      const combinedFailStr = this.#formattingService.formatFailRate(combinedFailRate);
      const combinedInRegimeFailStr = this.#formattingService.formatFailRate(
        combinedInRegimeFailureRate
      );
      footer = `\n\n**Combined OR Block**: ${this.#formattingService.formatPercentage(combinedPassRate)} pass rate (Fail% global: ${combinedFailStr} | Fail% \\| mood-pass: ${combinedInRegimeFailStr})`;
    }

    return {
      markdown: `${header}\n${rows.join('\n')}${footer}`,
      nextRowIndex: rowIndex,
    };
  }

  #generateOrContributionBreakdown(orBlockTitle, children) {
    // Collect contribution data from all leaf children (or nested ANDs)
    const contributions = [];

    for (const child of children) {
      if (child.node) {
        const node = child.node;
        let desc = node.description ?? 'Unknown condition';
        if (child.type === 'and') {
          const leaves = this.#treeTraversal.flattenLeaves(node);
          desc = leaves.length > 0
            ? `(AND: ${leaves.map((l) => l.description ?? '?').join(' & ')})`
            : 'AND group';
        }
        contributions.push({
          description: desc,
          passRate: node.orPassRate,
          passCount: node.orPassCount ?? 0,
          exclusiveRate: node.orExclusivePassRate,
          exclusiveCount: node.orExclusivePassCount ?? 0,
          contributionRate: node.orContributionRate,
          contributionCount: node.orContributionCount ?? 0,
          successCount: node.orSuccessCount ?? 0,
        });
      }
    }

    // Filter to only those with contribution data
    const validContributions = contributions.filter(
      (c) => c.successCount > 0 || c.contributionCount > 0
    );

    if (validContributions.length === 0) {
      return '';
    }

    // Sort by pass rate descending, then contribution rate
    validContributions.sort((a, b) => {
      const rateA = a.passRate ?? 0;
      const rateB = b.passRate ?? 0;
      if (rateB !== rateA) return rateB - rateA;
      const contribA = a.contributionRate ?? 0;
      const contribB = b.contributionRate ?? 0;
      return contribB - contribA;
    });

    const totalSuccesses = validContributions[0]?.successCount ?? 0;
    if (totalSuccesses === 0) {
      return `\n\n**${orBlockTitle} OR Alternative Coverage**: No OR successes observed.`;
    }

    const header = `\n\n**${orBlockTitle} OR Alternative Coverage** (${totalSuccesses} total successes):`;
    const tableHeader = '| Alternative | P(alt passes \\| OR pass) | P(alt exclusively passes \\| OR pass) | First-pass share (order-dependent) |';
    const tableDivider = '|------------|---------------------------|------------------------------------|------------------------------------|';
    const rows = validContributions.map((c) => {
      const passRate =
        typeof c.passRate === 'number'
          ? this.#formattingService.formatPercentage(c.passRate)
          : 'N/A';
      const exclusiveRate =
        typeof c.exclusiveRate === 'number'
          ? this.#formattingService.formatPercentage(c.exclusiveRate)
          : 'N/A';
      const contributionRate =
        typeof c.contributionRate === 'number'
          ? this.#formattingService.formatPercentage(c.contributionRate)
          : 'N/A';
      const passCountStr = `${c.passCount}/${c.successCount}`;
      const exclusiveCountStr = `${c.exclusiveCount}/${c.successCount}`;
      const contribCountStr = `${c.contributionCount}/${c.successCount}`;
      return `| \`${c.description}\` | ${passRate} (${passCountStr}) | ${exclusiveRate} (${exclusiveCountStr}) | ${contributionRate} (${contribCountStr}) |`;
    });

    const note = '\n*First-pass share is order-dependent; use pass/exclusive rates for order-independent attribution.*';

    return `${header}\n\n${tableHeader}\n${tableDivider}\n${rows.join('\n')}${note}`;
  }

  #generateOrOverlapBreakdown(orBlockTitle, orNode, children) {
    if (!orNode) {
      return '';
    }

    const evaluationCount = orNode.evaluationCount;
    if (!Number.isFinite(evaluationCount) || evaluationCount <= 0) {
      return '';
    }

    const idToLabel = new Map();
    for (const child of children ?? []) {
      if (!child?.node) {
        continue;
      }
      let desc = child.node.description ?? 'Unknown condition';
      if (child.type === 'and') {
        const leaves = this.#treeTraversal.flattenLeaves(child.node);
        desc = leaves.length > 0
          ? `(AND: ${leaves.map((l) => l.description ?? '?').join(' & ')})`
          : 'AND group';
      }
      if (child.node.id) {
        idToLabel.set(child.node.id, desc);
      }
    }

    const childExclusiveCount = (children ?? []).reduce(
      (sum, child) => sum + (child?.node?.orExclusivePassCount ?? 0),
      0
    );

    const unionCount = Number.isFinite(orNode.orUnionPassCount)
      ? orNode.orUnionPassCount
      : evaluationCount - (orNode.failureCount ?? 0);
    const exclusiveCount = Number.isFinite(orNode.orBlockExclusivePassCount)
      ? orNode.orBlockExclusivePassCount
      : childExclusiveCount;
    const overlapCount = Math.max(0, unionCount - exclusiveCount);

    const formatRate = (count, denominator) => {
      if (!Number.isFinite(denominator) || denominator <= 0) {
        return 'N/A';
      }
      return `${this.#formattingService.formatPercentage(count / denominator)} (${this.#formattingService.formatCount(
        count
      )}/${this.#formattingService.formatCount(denominator)})`;
    };

    const formatTopPair = (pairs, denominator) => {
      if (!Array.isArray(pairs) || pairs.length === 0) {
        return 'None';
      }
      const topPair = pairs.reduce(
        (best, current) =>
          current.passCount > best.passCount ? current : best,
        pairs[0]
      );
      const leftLabel = idToLabel.get(topPair.leftId) ?? topPair.leftId ?? '?';
      const rightLabel = idToLabel.get(topPair.rightId) ?? topPair.rightId ?? '?';
      const rateStr = formatRate(topPair.passCount ?? 0, denominator);
      return `\`${leftLabel}\` + \`${rightLabel}\` ${rateStr}`;
    };

    const rows = [
      `| Global | ${formatRate(unionCount, evaluationCount)} | ${formatRate(
        exclusiveCount,
        evaluationCount
      )} | ${formatRate(overlapCount, evaluationCount)} | ${formatTopPair(
        orNode.orPairPassCounts,
        evaluationCount
      )} |`,
    ];

    const inRegimeEvaluationCount = orNode.inRegimeEvaluationCount;
    if (
      Number.isFinite(inRegimeEvaluationCount) &&
      inRegimeEvaluationCount > 0
    ) {
      const inRegimeUnionCount = Number.isFinite(
        orNode.orUnionPassInRegimeCount
      )
        ? orNode.orUnionPassInRegimeCount
        : inRegimeEvaluationCount - (orNode.inRegimeFailureCount ?? 0);
      const inRegimeExclusiveCount = Number.isFinite(
        orNode.orBlockExclusivePassInRegimeCount
      )
        ? orNode.orBlockExclusivePassInRegimeCount
        : 0;
      const inRegimeOverlapCount = Math.max(
        0,
        inRegimeUnionCount - inRegimeExclusiveCount
      );
      rows.push(
        `| Mood regime | ${formatRate(
          inRegimeUnionCount,
          inRegimeEvaluationCount
        )} | ${formatRate(
          inRegimeExclusiveCount,
          inRegimeEvaluationCount
        )} | ${formatRate(
          inRegimeOverlapCount,
          inRegimeEvaluationCount
        )} | ${formatTopPair(
          orNode.orPairPassInRegimeCounts,
          inRegimeEvaluationCount
        )} |`
      );
    }

    const header = `\n\n**${orBlockTitle} OR Overlap (absolute rates)**:`;
    const tableHeader =
      '| Population | Union (any pass) | Exclusive (exactly one) | Overlap (2+ pass) | Top overlap pair |';
    const tableDivider = '|------------|------------------|------------------------|-------------------|------------------|';

    return `${header}\n\n${tableHeader}\n${tableDivider}\n${rows.join('\n')}`;
  }

  #generateWorstOffenderAnalysis(blocker, _sampleCount) {
    // Use worstOffenders if available, otherwise extract from hierarchicalBreakdown
    let offenders = blocker.worstOffenders ?? [];
    const includeClampTrivial = blocker.includeClampTrivialOffenders === true;
    const leafByDescription = new Map();

    // If no worstOffenders, try to extract from hierarchicalBreakdown
    if (blocker.hierarchicalBreakdown) {
      const leaves = this.#treeTraversal.flattenLeaves(blocker.hierarchicalBreakdown);
      for (const leaf of leaves) {
        const desc = leaf.description ?? null;
        if (typeof desc === 'string' && !leafByDescription.has(desc)) {
          leafByDescription.set(desc, leaf);
        }
      }
      if (offenders.length === 0) {
        offenders = leaves.filter((l) => (l.failureRate ?? 0) > 0.1);
      }
    }

    if (leafByDescription.size > 0) {
      offenders = offenders.map((offender) => {
        const desc = offender.description ?? null;
        const matched = typeof desc === 'string' ? leafByDescription.get(desc) : null;
        return matched ? { ...matched, ...offender } : offender;
      });
    }

    if (!includeClampTrivial) {
      offenders = offenders.filter(
        (offender) => !this.#resolveClampTrivialInRegime(offender)
      );
    }

    // Always deduplicate offenders by description to avoid listing the same condition twice
    // (e.g., emotions.anger >= 0.4 appearing in both Required AND and OR blocks)
    // Keep the instance with the higher score (more relevant)
    // Apply 70% penalty (multiply by 0.3) for OR-child leaves since they are alternatives,
    // not bottlenecks - if ANY alternative in an OR passes, the OR passes
    const seen = new Map();
    for (const offender of offenders) {
      const desc = offender.description ?? 'Unknown';
      const isOrChild = offender.parentNodeType === 'or';
      const orPenalty = isOrChild ? 0.3 : 1.0;
      const baseScore =
        (offender.siblingConditionedFailRate ?? offender.lastMileFailRate ?? 0) *
          0.6 +
        (offender.failureRate ?? 0) * 0.4;
      const score = baseScore * orPenalty;
      if (!seen.has(desc) || seen.get(desc).score < score) {
        seen.set(desc, { offender, score, isOrChild });
      }
    }
    const uniqueOffenders = Array.from(seen.values()).map((v) => ({
      ...v.offender,
      isOrChild: v.isOrChild,
    }));

    // Take top 5 by weighted score: prioritize last-mile failure over marginal failure
    // Last-mile (60%) tells us "is this THE bottleneck?" - more actionable
    // Marginal (40%) provides baseline failure context
    // OR-child leaves get 70% penalty as they are alternatives, not true bottlenecks
    offenders = uniqueOffenders
      .sort((a, b) => {
        const isOrChildA = a.parentNodeType === 'or' || a.isOrChild;
        const isOrChildB = b.parentNodeType === 'or' || b.isOrChild;
        const orPenaltyA = isOrChildA ? 0.3 : 1.0;
        const orPenaltyB = isOrChildB ? 0.3 : 1.0;
        const scoreA =
          ((a.siblingConditionedFailRate ?? a.lastMileFailRate ?? 0) * 0.6 +
          (a.failureRate ?? 0) * 0.4) * orPenaltyA;
        const scoreB =
          ((b.siblingConditionedFailRate ?? b.lastMileFailRate ?? 0) * 0.6 +
          (b.failureRate ?? 0) * 0.4) * orPenaltyB;
        return scoreB - scoreA;
      })
      .slice(0, 5);

    if (offenders.length === 0) {
      return '';
    }

    const analyses = offenders.map((offender, index) => {
      const rank = index + 1;
      const desc = offender.description ?? 'Unknown';
      const failureRate = offender.failureRate ?? 0;
      const inRegimeFailureRate = offender.inRegimeFailureRate ?? null;
      const inRegimeFailureCount = offender.inRegimeFailureCount ?? null;
      const inRegimeEvaluationCount = offender.inRegimeEvaluationCount ?? null;
      // Prefer sibling-conditioned rate for leaves in compounds
      const lastMileRate =
        offender.siblingConditionedFailRate ?? offender.lastMileFailRate;
      const ceilingGap = offender.ceilingGap;
      const nearMissRate = offender.nearMissRate;
      const maxObserved = offender.maxObservedValue;
      const threshold = offender.thresholdValue;
      const isOrChild = offender.parentNodeType === 'or' || offender.isOrChild;

      let lines = [];
      const globalFailStr = this.#formattingService.formatFailRate(failureRate);
      const inRegimeFailStr = this.#formattingService.formatFailRate(
        inRegimeFailureRate,
        inRegimeFailureCount,
        inRegimeEvaluationCount
      );
      // Add OR-alternative annotation if this is inside an OR block
      const orAnnotation = isOrChild ? ' ⚠️ OR-alternative' : '';
      lines.push(
        `**#${rank}: \`${desc}\`**${orAnnotation} (Fail% global: ${globalFailStr} | Fail% \\| mood-pass: ${inRegimeFailStr}${typeof lastMileRate === 'number' ? `, ${this.#formattingService.formatPercentage(lastMileRate)} last-mile` : ''})`
      );

      // Add context note for OR alternatives
      if (isOrChild) {
        lines.push(
          `- ℹ️ This is an alternative within an OR block; other alternatives may cover this case`
        );
      }

      // Check for ceiling effect
      if (typeof ceilingGap === 'number' && ceilingGap > 0) {
        const maxStr = typeof maxObserved === 'number' ? this.#formattingService.formatNumber(maxObserved) : 'N/A';
        const threshStr = typeof threshold === 'number' ? this.#formattingService.formatNumber(threshold) : 'N/A';
        lines.push(
          `- ⚠️ **CEILING EFFECT**: Max observed (${maxStr}) never reaches threshold (${threshStr})`
        );
        lines.push(
          `- Recommendation: **adjust_upstream** - Modify prototypes/gates that produce this value`
        );
      } else if (typeof nearMissRate === 'number') {
        // Tunability-based recommendation
        if (nearMissRate > 0.1) {
          lines.push(
            `- Near-miss rate: ${this.#formattingService.formatPercentage(nearMissRate)} (high tunability)`
          );
          lines.push(
            `- Recommendation: **tune_threshold** - Small adjustment will significantly improve trigger rate`
          );
        } else if (nearMissRate >= 0.02) {
          lines.push(
            `- Near-miss rate: ${this.#formattingService.formatPercentage(nearMissRate)} (moderate tunability)`
          );
          lines.push(
            `- Recommendation: **tune_threshold** or **adjust_upstream** - Consider both options`
          );
        } else {
          lines.push(`- Values are far from threshold (low near-miss rate)`);
          lines.push(
            `- Recommendation: **adjust_upstream** - Review prototypes/generation rules`
          );
        }
      }

      return lines.join('\n');
    });

    return `#### Worst Offender Analysis\n\n${analyses.join('\n\n')}`;
  }

  #resolveClampTrivialInRegime(leaf) {
    if (!leaf) return null;
    if (typeof leaf.clampTrivialInRegime === 'boolean') {
      return leaf.clampTrivialInRegime;
    }

    const operator = leaf.comparisonOperator;
    if (operator !== '<=' && operator !== '<') {
      return null;
    }

    const gatePassRate = leaf.gatePassRateInRegime;
    const inRegimeMax = leaf.inRegimeMaxObservedValue;
    if (typeof gatePassRate !== 'number' || typeof inRegimeMax !== 'number') {
      return null;
    }

    return gatePassRate === 0 && inRegimeMax === 0;
  }

  #generateLeafRow(
    leaf,
    index,
    _sampleCount,
    isOrLeaf = false,
    includeGateMetrics = false
  ) {
    const description = leaf.description ?? 'Unknown';
    const failureRate = leaf.failureRate ?? 0;
    const inRegimeFailureRate = leaf.inRegimeFailureRate ?? null;
    const inRegimeFailureCount = leaf.inRegimeFailureCount ?? null;
    const inRegimeEvaluationCount = leaf.inRegimeEvaluationCount ?? null;
    const redundantInRegime = leaf.redundantInRegime ?? null;
    const clampTrivialInRegime = this.#resolveClampTrivialInRegime(leaf);
    const evaluationCount = leaf.evaluationCount ?? 0;
    const threshold = leaf.thresholdValue;
    const ceilingGap = leaf.ceilingGap;
    const nearMissRate = leaf.nearMissRate;

    // Select the appropriate observed bound based on operator type.
    // For >= and > operators: use maxObserved (we need high values)
    // For <= and < operators: use minObserved (we need low values)
    // This ensures the displayed bound matches what's used in Gap calculation.
    const operator = leaf.comparisonOperator;
    const isLowBound = operator === '<=' || operator === '<';
    const boundObserved = isLowBound
      ? leaf.minObservedValue
      : leaf.maxObservedValue;

    // For leaf nodes within compounds, prefer sibling-conditioned stats
    // (tracks when all OTHER leaves in the same compound passed)
    // Fall back to clause-level lastMileFailRate if sibling stats unavailable
    const siblingFailRate = leaf.siblingConditionedFailRate;
    const siblingsPassedCount = leaf.siblingsPassedCount ?? 0;
    const lastMileRate = leaf.lastMileFailRate;
    const othersPassedCount = leaf.othersPassedCount ?? 0;

    // Use sibling-conditioned rate if available (for leaves in compounds)
    // Otherwise fall back to clause-level last-mile rate
    const effectiveLastMileRate =
      typeof siblingFailRate === 'number' ? siblingFailRate : lastMileRate;
    const effectiveSupportCount =
      siblingsPassedCount > 0 ? siblingsPassedCount : othersPassedCount;

    // Format bound observed (max for >=, min for <=)
    const boundObsStr =
      typeof boundObserved === 'number'
        ? this.#formattingService.formatNumber(boundObserved)
        : '-';

    // Format threshold
    const thresholdStr =
      typeof threshold === 'number'
        ? this.#formattingService.formatNumber(threshold)
        : '-';

    const globalFailStr = this.#formattingService.formatFailRate(failureRate);
    const inRegimeFailStr = this.#formattingService.formatFailRate(
      inRegimeFailureRate,
      inRegimeFailureCount,
      inRegimeEvaluationCount
    );
    const redundantStr = this.#formattingService.formatBooleanValue(redundantInRegime);
    const clampTrivialStr = this.#formattingService.formatClampTrivialLabel(clampTrivialInRegime);

    // Format ceiling gap with indicator
    let gapStr = '-';
    if (typeof ceilingGap === 'number') {
      if (ceilingGap > 0) {
        gapStr = `+${this.#formattingService.formatNumber(ceilingGap)} [CEIL]`;
      } else {
        gapStr = this.#formattingService.formatNumber(ceilingGap);
      }
    }

    // Determine tunability from near-miss rate
    let tunabilityStr = '-';
    if (typeof nearMissRate === 'number') {
      if (nearMissRate > 0.1) {
        tunabilityStr = 'high';
      } else if (nearMissRate >= 0.02) {
        tunabilityStr = 'moderate';
      } else {
        tunabilityStr = 'low';
      }
    }

    // Format last-mile rate with N/A when no samples had all-siblings-pass
    // Include sample count (N) for statistical confidence assessment
    // For OR leaves, last-mile is conceptually meaningless (only one alternative needs to pass)
    let lastMileStr;
    if (isOrLeaf) {
      // OR alternatives are not "required" - only one needs to pass
      // Last-mile failure rate is meaningless for individual OR alternatives
      lastMileStr = 'N/A (OR alt)';
    } else if (typeof effectiveLastMileRate === 'number') {
      const pctStr = this.#formattingService.formatPercentage(effectiveLastMileRate);
      // Show N and add warning indicator when sample size is low
      if (effectiveSupportCount > 0) {
        const warning = effectiveSupportCount < 10 ? '⚠️' : '';
        lastMileStr = `${pctStr} (N=${effectiveSupportCount})${warning}`;
      } else {
        lastMileStr = pctStr;
      }
    } else if (effectiveSupportCount === 0) {
      lastMileStr = 'N/A';
    } else {
      lastMileStr = '-';
    }

    let gatePassStr = '';
    let gateClampStr = '';
    let passGivenGateStr = '';
    let passInRegimeStr = '';
    if (includeGateMetrics) {
      if (this.#treeTraversal.isEmotionThresholdLeaf(leaf)) {
        const inRegimePassCount =
          typeof inRegimeEvaluationCount === 'number' &&
          typeof inRegimeFailureCount === 'number'
            ? inRegimeEvaluationCount - inRegimeFailureCount
            : null;
        gatePassStr = this.#formattingService.formatRateWithCounts(
          leaf.gatePassRateInRegime ?? null,
          leaf.gatePassInRegimeCount ?? null,
          inRegimeEvaluationCount ?? null
        );
        gateClampStr = this.#formattingService.formatRateWithCounts(
          leaf.gateClampRateInRegime ?? null,
          leaf.gateFailInRegimeCount ?? null,
          inRegimeEvaluationCount
        );
        passGivenGateStr = this.#formattingService.formatRateWithCounts(
          leaf.passRateGivenGateInRegime ?? null,
          leaf.gatePassAndClausePassInRegimeCount ?? null,
          leaf.gatePassInRegimeCount ?? null
        );
        passInRegimeStr = this.#formattingService.formatRateWithCounts(
          leaf.inRegimePassRate ?? null,
          inRegimePassCount,
          inRegimeEvaluationCount ?? null
        );
      } else {
        gatePassStr = 'N/A';
        gateClampStr = 'N/A';
        passGivenGateStr = 'N/A';
        passInRegimeStr = 'N/A';
      }
    }

    const baseRow = `| ${index} | \`${description}\` | ${globalFailStr} | ${inRegimeFailStr} | ${evaluationCount} | ${boundObsStr} | ${thresholdStr} | ${gapStr} | ${tunabilityStr} | ${redundantStr} | ${clampTrivialStr} | ${lastMileStr} |`;
    if (!includeGateMetrics) {
      return baseRow;
    }

    return `${baseRow} ${gatePassStr} | ${gateClampStr} | ${passGivenGateStr} | ${passInRegimeStr} |`;
  }

  #generateFlags(blocker) {
    const flags = [];
    const adv = blocker.advancedAnalysis ?? {};
    const hb = blocker.hierarchicalBreakdown ?? {};

    // 1. Ceiling Effect (Critical)
    if (adv.ceilingAnalysis?.status === 'ceiling_detected') {
      flags.push('[CEILING]');
    }

    // 2. Decisive Blocker (High Priority)
    // Check advancedAnalysis.lastMileAnalysis.isDecisive OR isSingleClause
    if (adv.lastMileAnalysis?.isDecisive || hb.isSingleClause) {
      flags.push('[DECISIVE]');
    }

    // 3. High Tunability (Quick Wins) - nearMissRate > 0.10
    // Near-miss rate available at top level or in hierarchicalBreakdown
    const nearMissRate = hb.nearMissRate ?? blocker.nearMissRate;
    if (nearMissRate !== null && nearMissRate !== undefined && nearMissRate > 0.1) {
      flags.push('[TUNABLE]');
    }

    // 4. Low Tunability (Upstream Fix Required) - nearMissRate < 0.02
    if (nearMissRate !== null && nearMissRate !== undefined && nearMissRate < 0.02) {
      flags.push('[UPSTREAM]');
    }

    // 5. Heavy-Tailed Distribution - violationP50 < averageViolation * 0.5
    const avgViol = blocker.averageViolation;
    const p50 = hb.violationP50 ?? blocker.violationP50;
    if (
      p50 !== null &&
      p50 !== undefined &&
      avgViol !== null &&
      avgViol !== undefined &&
      p50 < avgViol * 0.5
    ) {
      flags.push('[OUTLIERS-SKEW]');
    }

    // 6. Severe Outliers Present - violationP90 > averageViolation * 2
    const p90 = hb.violationP90 ?? blocker.violationP90;
    if (
      p90 !== null &&
      p90 !== undefined &&
      avgViol !== null &&
      avgViol !== undefined &&
      p90 > avgViol * 2
    ) {
      flags.push('[SEVERE-TAIL]');
    }

    const flagsStr = flags.length > 0 ? flags.join(' ') : 'None';
    return `#### Flags
${flagsStr}`;
  }

  #generateDistributionAnalysis(blocker) {
    const hb = blocker.hierarchicalBreakdown ?? {};
    const adv = blocker.advancedAnalysis ?? {};

    // For compound nodes, aggregate from leaves
    if (hb.isCompound) {
      const leafStats = this.#aggregateLeafViolationStats(hb);
      if (leafStats) {
        const insight = leafStats.worstDescription
          ? `Worst violator: ${leafStats.worstDescription}`
          : 'See individual conditions for details';

        // Count top-level conditions (OR blocks count as 1 each)
        const topLevelCount = hb.children?.length ?? 0;
        const leafCountNote =
          leafStats.leafCount !== topLevelCount
            ? ` (${topLevelCount} top-level conditions; ${leafStats.leafCount} when OR blocks expanded)`
            : '';

        let lines = [
          `- **Compound Node**: Aggregated from ${leafStats.leafCount} leaf conditions${leafCountNote}`,
          `- **Highest Avg Violation**: ${this.#formattingService.formatNumber(leafStats.maxAvgViolation)} (from \`${leafStats.worstDescription}\`)`,
          `- **Highest P90 Violation**: ${this.#formattingService.formatNumber(leafStats.maxP90)}`,
        ];

        if (leafStats.maxP95 !== null) {
          lines.push(
            `- **Highest P95 Violation**: ${this.#formattingService.formatNumber(leafStats.maxP95)}`
          );
        }
        if (leafStats.maxP99 !== null) {
          lines.push(
            `- **Highest P99 Violation**: ${this.#formattingService.formatNumber(leafStats.maxP99)}`
          );
        }

        lines.push(`- **Interpretation**: ${insight}`);

        return `#### Distribution Analysis\n${lines.join('\n')}`;
      }

      return `#### Distribution Analysis
- **Compound Node**: Contains multiple conditions
- **Note**: See individual leaf conditions in breakdown above for violation statistics`;
    }

    // Standard leaf node distribution analysis
    const avgViol = blocker.averageViolation ?? 0;
    const p50 = hb.violationP50 ?? blocker.violationP50 ?? 0;
    const p90 = hb.violationP90 ?? blocker.violationP90 ?? 0;
    const p95 = hb.violationP95 ?? blocker.violationP95 ?? null;
    const p99 = hb.violationP99 ?? blocker.violationP99 ?? null;
    const observedMin = hb.observedMin ?? null;
    const observedMean = hb.observedMean ?? null;
    const insight =
      adv.percentileAnalysis?.insight ?? 'No distribution insight available.';

    // Build distribution lines
    let lines = [
      `- **Average Violation**: ${this.#formattingService.formatNumber(avgViol)}`,
      `- **Median (P50)**: ${this.#formattingService.formatNumber(p50)}`,
      `- **90th Percentile (P90)**: ${this.#formattingService.formatNumber(p90)}`,
    ];

    // Add p95/p99 if available
    if (p95 !== null) {
      lines.push(
        `- **95th Percentile (P95)**: ${this.#formattingService.formatNumber(p95)}`
      );
    }
    if (p99 !== null) {
      lines.push(
        `- **99th Percentile (P99)**: ${this.#formattingService.formatNumber(p99)}`
      );
    }

    // Add observed value statistics if available
    if (observedMin !== null || observedMean !== null) {
      lines.push('');
      lines.push('**Observed Value Distribution**:');
      if (observedMin !== null) {
        lines.push(
          `- **Min Observed**: ${this.#formattingService.formatNumber(observedMin)}`
        );
      }
      if (observedMean !== null) {
        lines.push(
          `- **Mean Observed**: ${this.#formattingService.formatNumber(observedMean)}`
        );
      }
    }

    lines.push(`- **Interpretation**: ${insight}`);

    return `#### Distribution Analysis\n${lines.join('\n')}`;
  }

  #aggregateLeafViolationStats(hb) {
    const leaves = this.#treeTraversal.flattenLeaves(hb);
    if (leaves.length === 0) return null;

    let maxAvgViolation = 0;
    let maxP90 = 0;
    let maxP95 = null;
    let maxP99 = null;
    let worstDescription = '';

    for (const leaf of leaves) {
      const avgViol = leaf.averageViolation ?? 0;
      const p90 = leaf.violationP90 ?? 0;
      const p95 = leaf.violationP95 ?? null;
      const p99 = leaf.violationP99 ?? null;

      if (avgViol > maxAvgViolation) {
        maxAvgViolation = avgViol;
        worstDescription = leaf.description ?? 'Unknown condition';
      }

      if (p90 > maxP90) {
        maxP90 = p90;
      }

      if (p95 !== null && (maxP95 === null || p95 > maxP95)) {
        maxP95 = p95;
      }

      if (p99 !== null && (maxP99 === null || p99 > maxP99)) {
        maxP99 = p99;
      }
    }

    return {
      leafCount: leaves.length,
      maxAvgViolation,
      maxP90,
      maxP95,
      maxP99,
      worstDescription,
    };
  }

  #generateCeilingAnalysis(blocker) {
    const hb = blocker.hierarchicalBreakdown ?? {};
    const adv = blocker.advancedAnalysis ?? {};

    // For compound nodes, find the worst ceiling issue among leaves
    if (hb.isCompound) {
      const ceilingData = this.#extractWorstCeilingFromLeaves(hb);

      if (ceilingData) {
        const achievableStr = ceilingData.gap > 0 ? 'UNREACHABLE' : 'achievable';
        return `#### Ceiling Analysis
- **Compound Node**: Contains ${ceilingData.totalLeaves} leaf conditions
- **Worst Ceiling Issue**: \`${ceilingData.description}\`
- **Max Observed**: ${this.#formattingService.formatNumber(ceilingData.maxObserved)}
- **Threshold**: ${this.#formattingService.formatNumber(ceilingData.threshold)}
- **Ceiling Gap**: ${this.#formattingService.formatNumber(ceilingData.gap)} (${achievableStr})
- **Insight**: ${ceilingData.insight}`;
      }

      // No ceiling issues found in leaves
      return `#### Ceiling Analysis
- **Compound Node**: Contains multiple conditions
- **Status**: No ceiling effects detected in leaf conditions
- **Insight**: All thresholds appear achievable based on observed values`;
    }

    // Standard leaf node ceiling analysis
    const threshold = hb.thresholdValue ?? 'N/A';
    const ceilingGap = hb.ceilingGap ?? blocker.ceilingGap ?? 0;
    const ceilingStatus = adv.ceilingAnalysis?.achievable;
    const achievableStr =
      ceilingStatus === true
        ? 'achievable'
        : ceilingStatus === false
          ? 'UNREACHABLE'
          : 'unknown';
    const insight =
      adv.ceilingAnalysis?.insight ?? 'No ceiling insight available.';

    // Select appropriate observed bound based on operator type
    // For >= and > operators: use maxObserved (we need high values to pass)
    // For <= and < operators: use minObserved (we need low values to pass)
    // Note: For single-leaf non-compound nodes, the leaf data may be in children[0]
    const leafNode = hb.children?.[0] ?? hb;
    const operator = hb.comparisonOperator ?? leafNode.comparisonOperator;
    const isLowBound = operator === '<=' || operator === '<';
    const observedVal = isLowBound
      ? (hb.minObservedValue ?? leafNode.minObservedValue ?? 'N/A')
      : (hb.maxObservedValue ?? leafNode.maxObservedValue ?? blocker.maxObserved ?? 'N/A');
    const boundLabel = isLowBound ? 'Min Observed' : 'Max Observed';

    return `#### Ceiling Analysis
- **${boundLabel}**: ${typeof observedVal === 'number' ? this.#formattingService.formatNumber(observedVal) : observedVal}
- **Threshold**: ${typeof threshold === 'number' ? this.#formattingService.formatNumber(threshold) : threshold}
- **Ceiling Gap**: ${this.#formattingService.formatNumber(ceilingGap)} (${achievableStr})
- **Insight**: ${insight}`;
  }

  #extractWorstCeilingFromLeaves(hb) {
    return this.#dataExtractor.extractWorstCeilingFromLeaves(
      hb,
      (node) => this.#treeTraversal.flattenLeaves(node)
    );
  }

  #generateNearMissAnalysis(blocker) {
    const hb = blocker.hierarchicalBreakdown ?? {};
    const adv = blocker.advancedAnalysis ?? {};

    // For compound nodes, find the leaf with highest tunability
    if (hb.isCompound) {
      const tunabilityData = this.#treeTraversal.findMostTunableLeaf(hb);

      if (tunabilityData) {
        return `#### Near-Miss Analysis
- **Compound Node**: Contains ${tunabilityData.leafCount} leaf conditions
- **Most Tunable Condition**: \`${tunabilityData.description}\`
- **Near-Miss Rate**: ${this.#formattingService.formatPercentage(tunabilityData.nearMissRate)} (epsilon: ${this.#formattingService.formatNumber(tunabilityData.epsilon)})
- **Tunability**: ${tunabilityData.tunability}
- **Insight**: Adjusting threshold for this condition offers the best chance of improving trigger rate`;
      }

      return `#### Near-Miss Analysis
- **Compound Node**: Contains multiple conditions
- **Note**: No near-miss data available; see individual leaf conditions for details`;
    }

    // Standard leaf node near-miss analysis
    const nearMissRate = hb.nearMissRate ?? blocker.nearMissRate ?? 0;
    const epsilon = hb.nearMissEpsilon ?? blocker.nearMissEpsilon ?? 0;
    const tunability = adv.nearMissAnalysis?.tunability ?? 'unknown';
    const insight =
      adv.nearMissAnalysis?.insight ?? 'No near-miss insight available.';

    return `#### Near-Miss Analysis
- **Near-Miss Rate**: ${this.#formattingService.formatPercentage(nearMissRate)} (epsilon: ${this.#formattingService.formatNumber(epsilon)})
- **Tunability**: ${tunability}
- **Insight**: ${insight}`;
  }

  #generateLastMileAnalysis(blocker) {
    const hb = blocker.hierarchicalBreakdown ?? {};
    const adv = blocker.advancedAnalysis ?? {};
    const lastMileStatus = adv.lastMileAnalysis?.status;

    // For compound nodes that are the only prerequisite
    if (hb.isCompound && lastMileStatus === 'compound_single_prereq') {
      const worstLastMile = this.#treeTraversal.findWorstLastMileLeaf(hb);

      if (worstLastMile) {
        return `#### Sole-Blocker Analysis
- **Compound Node**: This is the only prerequisite block
- **Most Decisive Condition**: \`${worstLastMile.description}\`
- **Sole-Blocker Rate**: ${this.#formattingService.formatPercentage(worstLastMile.lastMileFailRate)}
- **Insight**: This condition is the primary bottleneck among the leaf conditions`;
      }

      return `#### Sole-Blocker Analysis
- **Compound Node**: This is the only prerequisite block
- **Note**: Analyze individual leaf conditions to identify bottlenecks
- **Insight**: ${adv.lastMileAnalysis?.insight ?? 'See leaf conditions for sole-blocker analysis'}`;
    }

    // Standard last-mile analysis
    const lastMileFailRate =
      hb.lastMileFailRate ?? blocker.lastMileFailRate ?? 0;
    const othersPassedCount = hb.othersPassedCount ?? 0;
    const isDecisive = adv.lastMileAnalysis?.isDecisive ?? false;
    const insight =
      adv.lastMileAnalysis?.insight ?? 'No last-mile insight available.';

    return `#### Sole-Blocker Analysis
- **Sole-Blocker Rate**: ${this.#formattingService.formatPercentage(lastMileFailRate)}
- **Others Passed Count**: ${othersPassedCount}
- **Is Decisive**: ${isDecisive ? 'yes' : 'no'}
- **Insight**: ${insight}`;
  }

  #generateRecommendation(blocker) {
    const adv = blocker.advancedAnalysis ?? {};
    const rec = adv.recommendation ?? {};
    const action = rec.action ?? 'investigate';
    const priority = rec.priority ?? 'unknown';
    const message = rec.message ?? 'No specific recommendation available.';

    return `#### Recommendation
**Action**: ${action}
**Priority**: ${priority}
**Guidance**: ${message}`;
  }

  /**
   * Generate core blocker section using MinimalBlockerSetCalculator.
   * Returns empty string if no calculator is configured.
   *
   * @param {object|null} simulationResult - Monte Carlo simulation result
   * @returns {string} Formatted core blocker section or empty string
   */
  #generateCoreBlockerSection(simulationResult) {
    if (!this.#blockerCalculator || !simulationResult) {
      return '';
    }

    const clauses = simulationResult.clauseTracking ?? [];
    if (clauses.length === 0) {
      return '';
    }

    const result = this.#blockerCalculator.calculate(clauses, simulationResult);
    return this.#formatCoreBlockerSummary(result);
  }

  /**
   * Format core blocker summary for display.
   *
   * @param {object} blockerResult - MinimalBlockerSetCalculator result
   * @returns {string} Formatted markdown section
   */
  #formatCoreBlockerSummary(blockerResult) {
    const { coreBlockers, nonCoreConstraints } = blockerResult;

    if (coreBlockers.length === 0) {
      return '';
    }

    const lines = [];
    lines.push(`### Core Blockers (${coreBlockers.length})`);
    lines.push('');
    lines.push('*These clauses have the highest impact on trigger rate:*');
    lines.push('');

    for (let i = 0; i < coreBlockers.length; i++) {
      const blocker = coreBlockers[i];
      const rank = i + 1;

      lines.push(`**${rank}. ${blocker.clauseDescription || blocker.clauseId}**`);
      lines.push(
        `- Last-Mile Rate: ${this.#formattingService.formatPercentage(blocker.lastMileRate)}`
      );
      lines.push(
        `- Impact Score: ${this.#formattingService.formatPercentage(blocker.impactScore)}`
      );
      lines.push(
        `- Composite Score: ${this.#formattingService.formatNumber(blocker.compositeScore)}`
      );

      const insight = this.#generateBlockerInsight(blocker);
      if (insight) {
        lines.push(`- 💡 ${insight}`);
      }
      lines.push('');
    }

    if (nonCoreConstraints.length > 0) {
      lines.push(
        `*${nonCoreConstraints.length} non-core constraints with >95% pass rate*`
      );
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Generate actionable insight for a core blocker based on its metrics.
   *
   * @param {object} blocker - Core blocker information
   * @returns {string|null} Insight message or null if none applies
   */
  #generateBlockerInsight(blocker) {
    // High last-mile rate = this clause is the "final gatekeeper"
    if (blocker.lastMileRate > 0.8) {
      return 'Final gatekeeper - nearly always the last barrier to pass';
    }

    // High impact score = removing would significantly improve rate
    if (blocker.impactScore > 0.3) {
      return 'High impact - addressing this could significantly improve trigger rate';
    }

    // Moderate impact
    if (blocker.impactScore > 0.1) {
      return 'Meaningful contribution to blocking';
    }

    return null;
  }
}

export default BlockerSectionGenerator;
