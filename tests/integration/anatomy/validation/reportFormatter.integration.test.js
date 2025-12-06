import { describe, it, expect } from '@jest/globals';
import { ValidationReport } from '../../../../src/anatomy/validation/ValidationReport.js';

const createRichReportResults = () => ({
  recipeId: 'Recipe & Entities "Alpha"',
  recipePath: '/mods/core/<alpha>/recipe.json',
  timestamp: '2024-06-01T12:34:56.789Z',
  errors: [
    {
      type: 'MISSING_FIELD',
      message: 'Missing "name", please review',
      location: { type: 'component', name: "core<'module'>" },
      componentId: 'component,with,comma',
      fix: 'Add "name" field',
      suggestion: 'Use & maintain defaults',
      context: {
        location: { type: 'scope', name: 'scope"Name"' },
      },
    },
  ],
  warnings: [
    {
      type: 'STYLE',
      message: 'Spacing issue, "warning"',
      location: { type: 'file', name: 'src/file.js' },
      suggestion: 'Adopt consistent spacing',
    },
  ],
  suggestions: [
    {
      type: 'IMPROVEMENT',
      message: 'Consider <upgrade> & "enhance"',
      location: { type: 'module', name: 'module&1' },
      suggestion: 'Introduce advanced format',
      reason: 'Supports better flows',
      impact: 'High',
    },
  ],
  passed: [
    { message: 'Rule base validated' },
    { message: 'Component structure ok' },
  ],
});

const parseCsvLine = (line) => {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
};

describe('ReportFormatter integration', () => {
  it('generates consistent HTML, Markdown, and CSV outputs using ValidationReport collaborators', () => {
    const report = new ValidationReport(createRichReportResults());
    const formatter = report.formatter();

    const html = formatter.toHTML();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain(
      '<title>Validation Report - Recipe &amp; Entities &quot;Alpha&quot;</title>'
    );
    expect(html).toContain(
      '<strong>Path:</strong> /mods/core/&lt;alpha&gt;/recipe.json'
    );
    expect(html).toContain('<div class="stat-value">1</div>');
    expect(html).toContain('Fix:</strong> Add &quot;name&quot; field');
    expect(html).toContain('Component:</strong> component,with,comma');
    expect(html).toContain(
      "Location:</strong> component 'core&lt;&#039;module&#039;&gt;'"
    );
    expect(html).toContain("Location:</strong> scope 'scope&quot;Name&quot;'");
    expect(html).toContain('Suggestion:</strong> Use &amp; maintain defaults');
    expect(html).toContain('⚠ Warnings');
    expect(html).toContain('💡 Suggestions');
    expect(html).toContain(
      'Consider &lt;upgrade&gt; &amp; &quot;enhance&quot;'
    );
    expect(html).toContain('Supports better flows');
    expect(html).toContain('Impact:</strong> High');

    const markdown = formatter.toMarkdown();
    expect(markdown).toContain(
      '# Validation Report: Recipe & Entities "Alpha"'
    );
    expect(markdown).toContain('## ✗ Errors');
    expect(markdown).toContain('**Message:** Missing "name", please review');
    expect(markdown).toContain("- **Location:** component 'core<'module'>'");
    expect(markdown).toContain('- **Component:** `component,with,comma`');
    expect(markdown).toContain('- **Fix:** Add "name" field');
    expect(markdown).toContain('- **Suggestion:** Use & maintain defaults');
    expect(markdown).toContain('### Warning 1');
    expect(markdown).toContain('### Suggestion 1');
    expect(markdown).toContain('- **Impact:** High');

    const csv = formatter.toCSV();
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe(
      'Severity,Type,Message,Location Type,Location Name,Component,Fix,Suggestion'
    );

    expect(parseCsvLine(lines[1])).toEqual([
      'Error',
      'MISSING_FIELD',
      'Missing "name", please review',
      'component',
      "core<'module'>",
      'component,with,comma',
      'Add "name" field',
      'Use & maintain defaults',
    ]);
    expect(parseCsvLine(lines[2])).toEqual([
      'Warning',
      'STYLE',
      'Spacing issue, "warning"',
      'file',
      'src/file.js',
      '',
      '',
      'Adopt consistent spacing',
    ]);
    expect(parseCsvLine(lines[3])).toEqual([
      'Suggestion',
      'IMPROVEMENT',
      'Consider <upgrade> & "enhance"',
      'module',
      'module&1',
      '',
      '',
      'Introduce advanced format',
    ]);
  });

  it('omits optional sections when the ValidationReport has no issues', () => {
    const report = new ValidationReport({
      recipeId: 'minimal-recipe',
      timestamp: '2024-01-01T00:00:00.000Z',
      errors: [],
      warnings: [],
      suggestions: [],
      passed: [],
    });
    const formatter = report.formatter();

    const html = formatter.toHTML();
    expect(html).not.toContain('✗ Errors');
    expect(html).not.toContain('⚠ Warnings');
    expect(html).not.toContain('💡 Suggestions');
    expect(html).toContain('Validation Report - minimal-recipe');
    expect(html).not.toContain('<strong>Path:</strong>');

    const markdown = formatter.toMarkdown();
    expect(markdown).not.toContain('## ✗ Errors');
    expect(markdown).not.toContain('## ⚠ Warnings');
    expect(markdown).not.toContain('## 💡 Suggestions');

    const csv = formatter.toCSV();
    expect(csv.trim()).toBe(
      'Severity,Type,Message,Location Type,Location Name,Component,Fix,Suggestion'
    );
  });
});
