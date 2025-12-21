import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import fs from 'fs';
import { TestBedClass } from '../../../common/entities/testBed.js';

describe('Blockers - Ancient Iron Grate Definition', () => {
  let testBed;

  beforeEach(() => {
    testBed = new TestBedClass();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('validates mechanisms:openable component data against schema', () => {
    const instancePath = path.resolve(
      process.cwd(),
      'data/mods/dredgers/entities/instances/ancient_iron_grate_segment_a_to_b.entity.json'
    );
    const entityInstance = JSON.parse(fs.readFileSync(instancePath, 'utf8'));

    const openable = entityInstance.componentOverrides['mechanisms:openable'];
    expect(openable).toBeDefined();

    const result = testBed.validateAgainstSchema(openable, 'mechanisms:openable');
    expect(result.isValid).toBe(true);
  });
});
