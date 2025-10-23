import { describe, it, expect } from '@jest/globals';

// The module only defines typedefs and a marker export used to keep bundlers
// from tree-shaking the file. Importing it ensures the typedef-only module is
// executed so Istanbul can record coverage for the statements and lines.
describe('formatActionTypedefs module coverage', () => {
  it('exports the coverage marker to keep typedefs reachable', async () => {
    const module = await import(
      '../../../../src/actions/formatters/formatActionTypedefs.js'
    );

    expect(module).toHaveProperty('__formatActionTypedefs', true);
  });
});
