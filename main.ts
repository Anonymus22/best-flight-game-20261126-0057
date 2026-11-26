// Skylark hand-in program (Node 22, standard library only).
//
// The repository holds the game under game/, its screenshots under
// screenshots/ and the kit's dossier library under vendor/. This
// program copies game/ and screenshots/ into the output directory
// and writes /output/dossier.json with buildDossier, the summary the
// judge reads. It writes the same bytes on every run.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');
if (!existsSync(gameDir)) throw new Error('game/ is missing from the repository');
if (!existsSync(join(gameDir, 'index.html'))) throw new Error('game/index.html is missing');

mkdirSync(outputDir, { recursive: true });
cpSync(gameDir, join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });
}

// The scorer's own caps: only text_max_bytes shapes the dossier's
// bytes; the rest refuse an entry the scorer would refuse (more than
// 4 screenshots or one over 256 KiB; more than 993 files in game/ or
// 48 MiB of game files in all, or a path under game/ over 1000 bytes).
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
console.log('Skylark handed in: dossier.json is ' + dossier.length + ' bytes');
