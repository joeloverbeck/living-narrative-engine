/**
 * @file CSS Variables Integration Test for Expression Diagnostics
 * @description Verifies that expression-diagnostics.css uses correct theme variables
 * from the default theme, ensuring proper styling consistency.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Expression Diagnostics CSS Variables', () => {
  let expressionDiagnosticsCss;
  let defaultThemeCss;
  let expressionsSimulatorCss;

  beforeAll(() => {
    const projectRoot = path.resolve(process.cwd());

    expressionDiagnosticsCss = fs.readFileSync(
      path.join(projectRoot, 'css/expression-diagnostics.css'),
      'utf-8'
    );

    defaultThemeCss = fs.readFileSync(
      path.join(projectRoot, 'css/themes/_default-theme.css'),
      'utf-8'
    );

    expressionsSimulatorCss = fs.readFileSync(
      path.join(projectRoot, 'css/expressions-simulator.css'),
      'utf-8'
    );
  });

  describe('Theme Variable Consistency', () => {
    it('should use --panel-bg-color for panel backgrounds (not --panel-bg)', () => {
      // The default theme defines --panel-bg-color
      expect(defaultThemeCss).toContain('--panel-bg-color');

      // expression-diagnostics.css should use --panel-bg-color
      // It should NOT use --panel-bg with dark fallback
      const usesCorrectVariable = expressionDiagnosticsCss.includes(
        'var(--panel-bg-color'
      );
      const usesWrongVariable = expressionDiagnosticsCss.includes(
        'var(--panel-bg,'
      );

      expect(usesCorrectVariable).toBe(true);
      expect(usesWrongVariable).toBe(false);
    });

    it('should use --border-color-subtle for borders (not --border-color)', () => {
      // The default theme defines --border-color-subtle
      expect(defaultThemeCss).toContain('--border-color-subtle');

      // expression-diagnostics.css should use --border-color-subtle
      const usesCorrectVariable = expressionDiagnosticsCss.includes(
        'var(--border-color-subtle'
      );

      expect(usesCorrectVariable).toBe(true);
    });

    it('should use --primary-text-color for main text (not --text-color)', () => {
      // The default theme defines --primary-text-color
      expect(defaultThemeCss).toContain('--primary-text-color');

      // expression-diagnostics.css should use --primary-text-color
      const usesCorrectVariable = expressionDiagnosticsCss.includes(
        'var(--primary-text-color'
      );

      expect(usesCorrectVariable).toBe(true);
    });

    it('should use --secondary-text-color for muted text (not --text-muted)', () => {
      // The default theme defines --secondary-text-color
      expect(defaultThemeCss).toContain('--secondary-text-color');

      // expression-diagnostics.css should use --secondary-text-color
      const usesCorrectVariable = expressionDiagnosticsCss.includes(
        'var(--secondary-text-color'
      );

      expect(usesCorrectVariable).toBe(true);
    });

    it('should use --input-bg-color for input backgrounds (not --input-bg)', () => {
      // The default theme defines --input-bg-color
      expect(defaultThemeCss).toContain('--input-bg-color');

      // expression-diagnostics.css should use --input-bg-color
      const usesCorrectVariable = expressionDiagnosticsCss.includes(
        'var(--input-bg-color'
      );
      const usesWrongVariable = expressionDiagnosticsCss.includes(
        'var(--input-bg,'
      );

      expect(usesCorrectVariable).toBe(true);
      expect(usesWrongVariable).toBe(false);
    });

    it('should use --button-bg-color for button backgrounds (not --button-bg)', () => {
      // The default theme defines --button-bg-color
      expect(defaultThemeCss).toContain('--button-bg-color');

      // expression-diagnostics.css should use --button-bg-color
      const usesCorrectVariable = expressionDiagnosticsCss.includes(
        'var(--button-bg-color'
      );
      const usesWrongVariable = expressionDiagnosticsCss.includes(
        'var(--button-bg,'
      );

      expect(usesCorrectVariable).toBe(true);
      expect(usesWrongVariable).toBe(false);
    });
  });

  describe('No Dark Fallback Values', () => {
    it('should not use dark hex colors as fallbacks (#1e1e1e)', () => {
      // Dark fallback indicating wrong theme assumption
      expect(expressionDiagnosticsCss).not.toContain('#1e1e1e');
    });

    it('should not use dark hex colors as fallbacks (#2a2a2a)', () => {
      expect(expressionDiagnosticsCss).not.toContain('#2a2a2a');
    });

    it('should not use dark hex colors as fallbacks (#333) in panel styles', () => {
      // This might be used for status-unknown, which is OK
      // But it shouldn't be used for panel backgrounds
      const panelRule = expressionDiagnosticsCss.match(
        /\.panel\s*\{[^}]*\}/gs
      );
      // Assert panel rule exists and doesn't contain #333
      expect(panelRule).not.toBeNull();
      expect(panelRule[0]).not.toContain('#333');
    });

    it('should not use dark hex colors as fallbacks (#444)', () => {
      expect(expressionDiagnosticsCss).not.toContain('#444');
    });

    it('should not use dark hex colors as fallbacks (#4a4a4a)', () => {
      expect(expressionDiagnosticsCss).not.toContain('#4a4a4a');
    });
  });

  describe('Consistency with Expressions Simulator', () => {
    it('should use same panel background variable as expressions-simulator', () => {
      // expressions-simulator uses --panel-bg-color
      expect(expressionsSimulatorCss).toContain('var(--panel-bg-color)');

      // expression-diagnostics should too
      expect(expressionDiagnosticsCss).toContain('var(--panel-bg-color');
    });

    it('should use same border variable as expressions-simulator', () => {
      // expressions-simulator uses --border-color-subtle
      expect(expressionsSimulatorCss).toContain('var(--border-color-subtle)');

      // expression-diagnostics should too
      expect(expressionDiagnosticsCss).toContain('var(--border-color-subtle');
    });
  });
});
