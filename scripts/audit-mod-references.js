#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(PROJECT_ROOT, 'src');
const DOCS_DIR = path.join(PROJECT_ROOT, 'docs', 'architecture');
const AUDIT_DOC_PATH = path.join(DOCS_DIR, 'hardcoded-references-audit.md');
const SUMMARY_DOC_PATH = path.join(DOCS_DIR, 'hardcoded-references-summary.md');

const MODS_TO_AUDIT = [
  { id: 'positioning', label: 'Positioning' },
  { id: 'items', label: 'Items' },
  { id: 'affection', label: 'Affection' },
  { id: 'violence', label: 'Violence' },
  { id: 'clothing', label: 'Clothing' },
];

const SEVERITY_RULES = [
  {
    severity: 'Critical',
    approach: 'Registry',
    test: (filePath) => /operationHandlers|services|engine/.test(filePath),
  },
  {
    severity: 'High',
    approach: 'Plugin',
    test: (filePath) =>
      /systems|managers|rules|controllers|routes/.test(filePath),
  },
  {
    severity: 'Medium',
    approach: 'Config',
    test: () => true,
  },
];

/**
 *
 * @param dirPath
 */
function walkDirectory(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  let files = [];
  entries.forEach((entry) => {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
      return;
    }

    const resolved = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(walkDirectory(resolved));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(resolved);
    }
  });
  return files;
}

/**
 *
 * @param filePath
 */
function determineSeverity(filePath) {
  const matchedRule = SEVERITY_RULES.find((rule) => rule.test(filePath));
  return matchedRule || SEVERITY_RULES[SEVERITY_RULES.length - 1];
}

/**
 *
 */
function collectReferences() {
  const files = walkDirectory(SRC_DIR);
  const results = Object.fromEntries(MODS_TO_AUDIT.map((mod) => [mod.id, []]));

  files.forEach((filePath) => {
    const relativePath = path.relative(PROJECT_ROOT, filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);

    MODS_TO_AUDIT.forEach((mod) => {
      if (!content.includes(`${mod.id}:`)) {
        return;
      }

      lines.forEach((line, index) => {
        if (!line.includes(`${mod.id}:`)) {
          return;
        }

        const rule = determineSeverity(relativePath);
        results[mod.id].push({
          file: relativePath,
          line: index + 1,
          snippet: line.trim().replace(/`/g, '\\`'),
          severity: rule.severity,
          approach: rule.approach,
        });
      });
    });
  });

  return results;
}

/**
 *
 * @param results
 */
function buildSummaryStats(results) {
  const stats = {};
  MODS_TO_AUDIT.forEach((mod) => {
    const entries = results[mod.id];
    const severityCounts = { Critical: 0, High: 0, Medium: 0 };
    const approachCounts = { Registry: 0, Plugin: 0, Config: 0 };

    entries.forEach((entry) => {
      severityCounts[entry.severity] += 1;
      approachCounts[entry.approach] += 1;
    });

    stats[mod.id] = {
      total: entries.length,
      severity: severityCounts,
      approach: approachCounts,
    };
  });
  return stats;
}

/**
 *
 * @param results
 * @param stats
 */
function renderAuditMarkdown(results, stats) {
  const totalViolations = MODS_TO_AUDIT.reduce(
    (sum, mod) => sum + stats[mod.id].total,
    0
  );
  let markdown = '# Hardcoded Mod References - Complete Audit\n\n';
  markdown += `**Generated:** ${new Date().toISOString()}\n`;
  markdown += '**Scope:** Production source code in `src/`\n';
  markdown +=
    '**Methodology:** Automated scan using `scripts/audit-mod-references.js`\n';
  markdown += `**Total Violations:** ${totalViolations}\n\n`;
  markdown += '---\n\n';
  markdown += '## Summary Statistics\n\n';
  markdown +=
    '| Mod | Total Refs | Critical | High | Medium | Registry Candidates | Plugin Candidates | Config Candidates |\n';
  markdown +=
    '|-----|------------|----------|------|--------|---------------------|-------------------|-------------------|\n';

  MODS_TO_AUDIT.forEach((mod) => {
    const modStats = stats[mod.id];
    markdown += `| ${mod.id} | ${modStats.total} | ${modStats.severity.Critical} | ${modStats.severity.High} | ${modStats.severity.Medium} | ${modStats.approach.Registry} | ${modStats.approach.Plugin} | ${modStats.approach.Config} |\n`;
  });

  markdown += '| **TOTAL** | ';
  const totalCritical = MODS_TO_AUDIT.reduce(
    (sum, mod) => sum + stats[mod.id].severity.Critical,
    0
  );
  const totalHigh = MODS_TO_AUDIT.reduce(
    (sum, mod) => sum + stats[mod.id].severity.High,
    0
  );
  const totalMedium = MODS_TO_AUDIT.reduce(
    (sum, mod) => sum + stats[mod.id].severity.Medium,
    0
  );
  const totalRegistry = MODS_TO_AUDIT.reduce(
    (sum, mod) => sum + stats[mod.id].approach.Registry,
    0
  );
  const totalPlugin = MODS_TO_AUDIT.reduce(
    (sum, mod) => sum + stats[mod.id].approach.Plugin,
    0
  );
  const totalConfig = MODS_TO_AUDIT.reduce(
    (sum, mod) => sum + stats[mod.id].approach.Config,
    0
  );
  markdown += `**${totalViolations}** | **${totalCritical}** | **${totalHigh}** | **${totalMedium}** | **${totalRegistry}** | **${totalPlugin}** | **${totalConfig}** |\n`;
  markdown += '\n---\n\n';

  MODS_TO_AUDIT.forEach((mod) => {
    markdown += `## ${mod.label} Mod References\n\n`;
    const entries = results[mod.id];
    if (entries.length === 0) {
      markdown += '_No references detected in current scan._\n\n';
      return;
    }

    const grouped = entries.reduce((acc, entry) => {
      if (!acc[entry.file]) {
        acc[entry.file] = [];
      }
      acc[entry.file].push(entry);
      return acc;
    }, {});

    Object.keys(grouped)
      .sort()
      .forEach((file) => {
        markdown += `### ${file}\n\n`;
        markdown += '| Line | Snippet | Severity | Refactoring Approach |\n';
        markdown += '|------|---------|----------|---------------------|\n';
        grouped[file]
          .sort((a, b) => a.line - b.line)
          .forEach((entry) => {
            markdown += `| ${entry.line} | \`${entry.snippet}\` | ${entry.severity} | ${entry.approach} |\n`;
          });
        markdown += '\n';
      });
  });

  return markdown;
}

/**
 *
 * @param stats
 */
function renderSummaryMarkdown(stats) {
  let markdown = '# Hardcoded Mod References - Summary\n\n';
  markdown += `**Generated:** ${new Date().toISOString()}\n\n`;
  markdown += '| Mod | Count |\n';
  markdown += '|-----|-------|\n';
  MODS_TO_AUDIT.forEach((mod) => {
    markdown += `| ${mod.id} | ${stats[mod.id].total} |\n`;
  });
  const total = MODS_TO_AUDIT.reduce(
    (sum, mod) => sum + stats[mod.id].total,
    0
  );
  markdown += `| **TOTAL** | **${total}** |\n`;
  return markdown;
}

/**
 *
 */
function ensureDocsDirectory() {
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
  }
}

/**
 *
 * @param auditMarkdown
 * @param summaryMarkdown
 */
function writeAuditFiles(auditMarkdown, summaryMarkdown) {
  ensureDocsDirectory();
  fs.writeFileSync(AUDIT_DOC_PATH, auditMarkdown);
  fs.writeFileSync(SUMMARY_DOC_PATH, summaryMarkdown);
}

/**
 *
 */
function main() {
  const results = collectReferences();
  const stats = buildSummaryStats(results);
  const auditMarkdown = renderAuditMarkdown(results, stats);
  const summaryMarkdown = renderSummaryMarkdown(stats);
  writeAuditFiles(auditMarkdown, summaryMarkdown);
  console.log(`Audit saved to ${path.relative(PROJECT_ROOT, AUDIT_DOC_PATH)}`);
  console.log(
    `Summary saved to ${path.relative(PROJECT_ROOT, SUMMARY_DOC_PATH)}`
  );
}

if (require.main === module) {
  main();
}

module.exports = {
  MODS_TO_AUDIT,
  collectReferences,
  buildSummaryStats,
  renderAuditMarkdown,
  renderSummaryMarkdown,
};
