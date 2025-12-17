import { describe, it, expect } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';

describe('anatomy-creatures eye entities provide sight', () => {
  const eyeEntities = [
    {
      file: 'chicken_eye_amber_concentric.entity.json',
      subType: 'eye',
    },
    {
      file: 'feline_eye_abyssal_black_glow.entity.json',
      subType: 'eye',
    },
    {
      file: 'feline_eye_amber_slit.entity.json',
      subType: 'eye',
    },
    {
      file: 'feline_eye_gold_slit.entity.json',
      subType: 'eye',
    },
    {
      file: 'feline_eye_ice_blue_slit.entity.json',
      subType: 'eye',
    },
    {
      file: 'hyena_eye.entity.json',
      subType: 'eye',
    },
    {
      file: 'newt_eye.entity.json',
      subType: 'eye',
    },
    {
      file: 'toad_eye.entity.json',
      subType: 'eye',
    },
    {
      file: 'eldritch_baleful_eye.entity.json',
      subType: 'eldritch_baleful_eye',
    },
    {
      file: 'eldritch_compound_eye_stalk.entity.json',
      subType: 'eldritch_compound_eye_stalk',
    },
    {
      file: 'eldritch_sensory_stalk.entity.json',
      subType: 'eldritch_sensory_stalk',
    },
    {
      file: 'eldritch_surface_eye.entity.json',
      subType: 'eldritch_surface_eye',
    },
    {
      file: 'tortoise_eye.entity.json',
      subType: 'tortoise_eye',
    },
  ];

  const definitionsDir = path.join(
    process.cwd(),
    'data/mods/anatomy-creatures/entities/definitions'
  );

  it.each(eyeEntities)(
    'adds anatomy:provides_sight to $file (subType=$subType)',
    async ({ file, subType }) => {
      const content = await fs.readFile(path.join(definitionsDir, file), 'utf-8');
      const entity = JSON.parse(content);

      expect(entity.components).toHaveProperty('anatomy:part');
      expect(entity.components['anatomy:part']).toHaveProperty('subType', subType);

      expect(entity.components).toHaveProperty('anatomy:provides_sight');
      expect(entity.components['anatomy:provides_sight']).toEqual({});
    }
  );
});

