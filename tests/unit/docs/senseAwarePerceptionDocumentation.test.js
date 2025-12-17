import fs from 'fs';
import path from 'path';

function extractSection(markdown, heading) {
  const start = markdown.indexOf(`## ${heading}`);
  if (start === -1) return null;

  const remainder = markdown.slice(start);
  const nextHeadingIndex = remainder
    .slice(`## ${heading}`.length)
    .search(/\n##\s+/);

  return nextHeadingIndex === -1
    ? remainder
    : remainder.slice(0, `## ${heading}`.length + nextHeadingIndex + 1);
}

function extractJsonCodeBlocks(markdown) {
  const blocks = [];
  const regex = /```json\s*([\s\S]*?)\s*```/g;
  let match = regex.exec(markdown);

  while (match) {
    blocks.push(match[1]);
    match = regex.exec(markdown);
  }

  return blocks;
}

describe('Sense-aware perception documentation', () => {
  it('keeps sensory affordance JSON examples syntactically valid', () => {
    const docPath = path.resolve(
      process.cwd(),
      'docs/modding/sense-aware-perception.md'
    );
    const markdown = fs.readFileSync(docPath, 'utf8');

    const section = extractSection(markdown, 'Sensory Affordance Components');
    expect(section).not.toBeNull();

    expect(section).toContain('anatomy:provides_sight');
    expect(section).toContain('anatomy:provides_hearing');
    expect(section).toContain('anatomy:provides_smell');

    const jsonBlocks = extractJsonCodeBlocks(section);
    expect(jsonBlocks.length).toBeGreaterThanOrEqual(2);

    const [crystalEyeRaw, sensoryTentacleRaw] = jsonBlocks;
    const crystalEye = JSON.parse(crystalEyeRaw);
    const sensoryTentacle = JSON.parse(sensoryTentacleRaw);

    expect(crystalEye.components).toHaveProperty('anatomy:provides_sight');
    expect(sensoryTentacle.components).toHaveProperty('anatomy:provides_sight');
    expect(sensoryTentacle.components).toHaveProperty('anatomy:provides_smell');
  });
});

