const {
  MODS_TO_AUDIT,
  buildSummaryStats,
  renderAuditMarkdown,
  renderSummaryMarkdown,
} = require('../../../scripts/audit-mod-references');

const createEmptyResults = () =>
  Object.fromEntries(MODS_TO_AUDIT.map((mod) => [mod.id, []]));

describe('audit-mod-references reporting helpers', () => {
  it('summarizes reference data and renders markdown tables', () => {
    const sampleResults = createEmptyResults();
    sampleResults.positioning.push(
      {
        file: 'src/logic/operationHandlers/demo.js',
        line: 12,
        snippet: "const ref = getComponent('positioning:sitting');",
        severity: 'Critical',
        approach: 'Registry',
      },
      {
        file: 'src/domUI/demo.js',
        line: 9,
        snippet: "const label = 'positioning:available_furniture';",
        severity: 'Medium',
        approach: 'Config',
      }
    );
    sampleResults.items.push({
      file: 'src/items/demo.js',
      line: 44,
      snippet: "entity.hasComponent('inventory:inventory')",
      severity: 'High',
      approach: 'Plugin',
    });

    const stats = buildSummaryStats(sampleResults);
    expect(stats.positioning.total).toBe(2);
    expect(stats.items.severity.High).toBe(1);

    const summaryMarkdown = renderSummaryMarkdown(stats);
    expect(summaryMarkdown).toContain('| positioning | 2 |');
    expect(summaryMarkdown).toContain('| items | 1 |');
    expect(summaryMarkdown).toMatch(/\*\*TOTAL\*\* \| \*\*3\*\*/);

    const auditMarkdown = renderAuditMarkdown(sampleResults, stats);
    expect(auditMarkdown).toContain('## Positioning Mod References');
    expect(auditMarkdown).toContain('src/logic/operationHandlers/demo.js');
    expect(auditMarkdown).toContain('| 44 | `entity.hasComponent');
  });
});
