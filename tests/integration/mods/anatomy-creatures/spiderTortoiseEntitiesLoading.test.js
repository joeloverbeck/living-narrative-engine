import { describe, it, expect } from '@jest/globals';
import path from 'path';
import fs from 'fs';

const loadEntity = (fileName) => {
  const fullPath = path.resolve(
    process.cwd(),
    'data/mods/anatomy-creatures/entities/definitions',
    fileName
  );
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
};

describe('anatomy-creatures spider entities', () => {
  const spiderEntities = [
    'spider_abdomen.entity.json',
    'spider_cephalothorax.entity.json',
    'spider_leg.entity.json',
    'spider_pedipalp.entity.json',
    'spider_spinneret.entity.json'
  ];

  it.each(spiderEntities)('loads %s with updated id', (fileName) => {
    const entity = loadEntity(fileName);
    const baseName = fileName.replace('.entity.json', '');
    expect(entity.id).toBe(`anatomy-creatures:${baseName}`);
    expect(entity.components).toBeDefined();
    expect(entity.components['anatomy:part']).toBeDefined();
  });

  it('spider_cephalothorax has correct socket structure', () => {
    const entity = loadEntity('spider_cephalothorax.entity.json');
    expect(entity.components['anatomy:sockets']).toBeDefined();
    expect(entity.components['anatomy:sockets'].sockets).toBeInstanceOf(Array);
    expect(entity.components['anatomy:sockets'].sockets.length).toBeGreaterThan(0);
  });
});

describe('anatomy-creatures tortoise entities', () => {
  const tortoiseEntities = [
    'tortoise_arm.entity.json',
    'tortoise_beak.entity.json',
    'tortoise_carapace.entity.json',
    'tortoise_eye.entity.json',
    'tortoise_foot.entity.json',
    'tortoise_hand.entity.json',
    'tortoise_head.entity.json',
    'tortoise_leg.entity.json',
    'tortoise_plastron.entity.json',
    'tortoise_tail.entity.json',
    'tortoise_torso_with_shell.entity.json'
  ];

  it.each(tortoiseEntities)('loads %s with updated id', (fileName) => {
    const entity = loadEntity(fileName);
    const baseName = fileName.replace('.entity.json', '');
    expect(entity.id).toBe(`anatomy-creatures:${baseName}`);
    expect(entity.components).toBeDefined();
    expect(entity.components['anatomy:part']).toBeDefined();
  });

  it('tortoise_head has correct socket structure for eyes and beak', () => {
    const entity = loadEntity('tortoise_head.entity.json');
    expect(entity.components['anatomy:sockets']).toBeDefined();
    const sockets = entity.components['anatomy:sockets'].sockets;
    expect(sockets).toBeInstanceOf(Array);

    const socketIds = sockets.map(s => s.id);
    expect(socketIds).toContain('left_eye');
    expect(socketIds).toContain('right_eye');
    expect(socketIds).toContain('beak_mount');
  });

  it('tortoise_torso_with_shell has shell mount sockets', () => {
    const entity = loadEntity('tortoise_torso_with_shell.entity.json');
    expect(entity.components['anatomy:sockets']).toBeDefined();
    const sockets = entity.components['anatomy:sockets'].sockets;

    const socketIds = sockets.map(s => s.id);
    expect(socketIds).toContain('carapace_mount');
    expect(socketIds).toContain('plastron_mount');
  });
});
