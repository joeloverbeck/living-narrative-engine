/**
 * @file reportGeneratorFactory.test - Unit tests for report generator factory
 */

import { describe, it, expect } from '@jest/globals';
import { createReportGenerator } from '../../../../src/expressionDiagnostics/services/reportGeneratorFactory.js';
import standardSimulationResult from '../../../fixtures/expressionDiagnostics/snapshotFixtures/standardSimulationResult.json';
import standardBlockersFixture from '../../../fixtures/expressionDiagnostics/snapshotFixtures/standardBlockers.json';

const logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

describe('reportGeneratorFactory', () => {
  it('throws when logger is missing', () => {
    expect(() => createReportGenerator({})).toThrow(
      'createReportGenerator requires logger'
    );
  });

  it('creates a report generator that can produce a report', () => {
    const generator = createReportGenerator({ logger });
    const report = generator.generate({
      expressionName: 'test:factory_report',
      simulationResult: JSON.parse(JSON.stringify(standardSimulationResult)),
      blockers: JSON.parse(JSON.stringify(standardBlockersFixture.blockers)),
      summary: 'Factory unit test',
    });

    expect(typeof report).toBe('string');
    expect(report).toContain('# Monte Carlo Analysis Report');
  });
});
