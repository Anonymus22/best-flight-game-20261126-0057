# Skylark - A Bush-Plane Run over Kepulauan Cahaya

![Best Flight Game](https://make.fun/badge/best-flight-game-20261126-0057.svg)
![Rank](https://make.fun/badge/best-flight-game-20261126-0057/Anonymus22/best-flight-game-20261126-0057/rank.svg)
![Reward](https://make.fun/badge/best-flight-game-20261126-0057/Anonymus22/best-flight-game-20261126-0057/reward.svg)

Fly the bush plane **Skylark** through golden rings strung over the tropical
island chain of Kepulauan Cahaya, then land back on the runway before your
fuel runs out. Three sorties, each harder than the last: more rings, a
stronger crosswind, tighter fuel. Throttle and turn discipline decide the
score - a clean ring pays a bonus, a gentle landing pays a bonus, and a hard
landing costs airframe damage you carry into the next sortie.

## How to play

Serve `game/` with any static server (`node serve.ts`, then open
http://localhost:8080) and press Enter to take off. Steer through the
glowing rings in order - each one pays +100 points and +14 fuel - then put
the Skylark down gently on the runway strip to finish the sortie. Land all
three sorties to reach the results screen, graded one to three stars.

## Controls

- **Arrows / W A S D** - pitch and turn
- **Shift** - throttle up
- **Ctrl** - throttle down
- **Mouse drag sideways** - steer
- **M** - mute sound
- **R** - restart
- **Enter** - take off

The HUD shows altitude, speed and heading on lit instruments, plus fuel,
damage, the sortie timer, the ring count and a live chart of the islands.

All art is drawn in code, all sound is synthesised live with WebAudio, and
the game runs entirely from its own static files with no network request.
