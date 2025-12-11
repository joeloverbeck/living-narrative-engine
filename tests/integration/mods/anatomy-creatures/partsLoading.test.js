import { describe, it, expect } from '@jest/globals';
import path from 'path';
import fs from 'fs';

const loadPart = (fileName) => {
  const fullPath = path.resolve(
    process.cwd(),
    'data/mods/anatomy-creatures/parts',
    fileName
  );
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
};

describe('anatomy-creatures parts', () => {
  it('loads amphibian_core with updated id', () => {
    const part = loadPart('amphibian_core.part.json');
    expect(part.id).toBe('anatomy-creatures:amphibian_core');
    expect(part.library).toBe('anatomy:humanoid_slots');
    expect(part.slots.left_arm.$use).toBe('standard_arm');
  });

  it('loads mustelid_core with updated id', () => {
    const part = loadPart('mustelid_core.part.json');
    expect(part.id).toBe('anatomy-creatures:mustelid_core');
    expect(part.library).toBe('anatomy:humanoid_slots');
    expect(part.slots.left_leg.$use).toBe('standard_leg');
  });
});
