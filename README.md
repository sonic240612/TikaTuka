# Tik-a-Tuka

A 1v1 real-time dice battle game. Roll, place, counter, and outscore your opponent.

- **Client**: React 18 + TypeScript + Vite
- **Server**: Node.js + Socket.IO
- **Live**: https://tikatuka-one.vercel.app

## Quick Start (Local Dev)

```bash
# Install dependencies
cd client && npm install
cd ../server && npm install

# Start server (terminal 1)
cd server && npm run dev

# Start client (terminal 2)
cd client && npm run dev
```

Open `http://localhost:5173` in two browser tabs to play against yourself.

## Game Rules

> 한국어 규칙 문서는 [Tik-a-Tuka_Rules.md](./Tik-a-Tuka_Rules.md)를 참고하세요.

Tik-a-Tuka is a 2-player dice strategy game played on a board of 3 lanes per player.

### Board
- Each player has 3 lanes with 3 dice slots each
- Lanes are scored independently at game end

### Turn Flow
1. **Roll** — Dice rolls automatically when it's your turn
2. **Place** — Place the dice in an empty slot on your board
3. **Counter** — If the opponent has a matching dice value in the same lane, counter removes their dice and rewards you a shield dice
4. **Reroll (optional)** — Once per game, reroll and keep the new or old value
5. **Shield Dice** — After a successful counter, place the shield dice on any empty slot on either board

### Scoring
- Each lane score = sum of its dice values
- Win a lane by having a higher score than your opponent in that lane
- Win the game by winning 2 out of 3 lanes (or total score if tied)

## Features

### Sound Effects
- 7 procedural SFX via Web Audio API (dice roll, dice place, dice reroll, counter fire/hit, shield place, victory/defeat)
- SFX ON/OFF toggle in game header

### Background Music
- Free jazz MP3 loops automatically during gameplay
- BGM ON/OFF toggle and independent volume slider

### Turn Timer
- 15 seconds per turn
- 60 seconds reserve per player
- Overtime mode deducts from reserve when exhausted

### Counter Animation
- Flying dice with 720° rotation and cubic-bezier arc
- Hit-effect radial flash at the destination lane
- Dice-off screen to decide first player

### Mobile Responsive
- Responsive layout at 640px, 480px, and 360px breakpoints
- Sidebar collapses below the board on small screens

## Architecture

```
├── client/          React + Vite frontend
├── server/          Node.js + Socket.IO game server
└── shared/          Shared TypeScript types and utilities
```

All game logic is **server-authoritative** — the server validates every action and maintains the canonical game state.

### Key Files

| File | Purpose |
|------|---------|
| `shared/types.ts` | Game state types, socket events, score utilities |
| `server/src/game/GameEngine.ts` | Pure game logic (roll, place, counter, shield, scoring) |
| `server/src/index.ts` | Socket.IO server, event handlers, turn timer |
| `server/src/rooms/RoomManager.ts` | Room creation, matchmaking |
| `client/src/components/GameBoard.tsx` | 3-lane board with counter animation |
| `client/src/components/DiceRoller.tsx` | Dice display with CSS animation |
| `client/src/components/TurnTimer.tsx` | Turn/reserve timer bar |
| `client/src/hooks/useAudio.ts` | SFX + BGM control hook |
| `client/src/utils/audio.ts` | Web Audio API sound synthesis + BGM playback |

## Deployment

- **Client**: Vercel (static site) → https://tikatuka-one.vercel.app
- **Server**: Render (Web Service) → https://tikatuka-server.onrender.com

Server URL is configurable at runtime via the **Server Settings** panel in the lobby.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Backend**: Node.js, Socket.IO
- **Build**: Vite, TypeScript (project references)
- **Audio**: Web Audio API (SFX), HTMLAudioElement (BGM)
- **Deploy**: Vercel (client), Render (server)
