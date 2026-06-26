# Tik-a-Tuka

A 1v1 web-based dice battle game with real-time multiplayer support.

- **Client**: React + TypeScript + Vite
- **Server**: Node.js + Socket.IO
- **Live**: https://tikatuka-one.vercel.app

## How to Play

### Quick Start (Local Dev)

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

### Play with Friends (ngrok + Vercel)

1. Start the server locally:
   ```bash
   cd server && npm run build && node dist/server/src/index.js
   ```

2. Expose it with ngrok:
   ```bash
   ngrok http 3001
   ```

3. Go to https://tikatuka-one.vercel.app
4. Click **Server Settings** and paste the ngrok URL (e.g. `https://xxxx.ngrok-free.dev`)
5. Share the link — anyone can join with the same server URL

## Game Rules

Tik-a-Tuka is a 2-player dice strategy game played on a board of 3 lanes per player.

### Board
- Each player has 3 lanes, each with 3 dice slots
- Lanes are scored independently at game end

### Turn Flow
1. **Roll** — Roll a dice (1–6)
2. **Place or Counter**:
   - Place the dice in an empty slot on your board
   - If the opponent has a matching dice value in the same lane index, you can **counter** (alggagi) instead — removes their dice and rewards you a shield dice
   - You cannot place in a lane where the opponent has a matching dice (must counter there)
3. **Reroll (optional)** — Once per game, reroll and choose old or new value
4. **Shield Dice** — After a successful counter, place the shield dice on any empty slot on either board

### Scoring
- Each lane's score = sum of its dice values
- Win a lane by having a higher score than your opponent in that lane
- Win the game by winning more lanes (2 out of 3)
- In case of a tie in lane wins, the player with the higher total score wins

## Architecture

```
├── client/          React + Vite frontend (Socket.IO client)
├── server/          Node.js + Socket.IO game server
└── shared/          Shared TypeScript types and utilities
```

All game logic is **server-authoritative** — the server validates every action and maintains the canonical game state.

### Key Files

| File | Purpose |
|------|---------|
| `shared/types.ts` | Game state types, socket events, score utilities |
| `server/src/game/GameEngine.ts` | Pure game logic (roll, place, counter, shield, scoring) |
| `server/src/index.ts` | Socket.IO server, event handlers |
| `server/src/rooms/RoomManager.ts` | Room creation, random matchmaking |
| `client/src/components/GameBoard.tsx` | 3-lane board UI |
| `client/src/components/DiceRoller.tsx` | Dice roll with CSS animation |
| `client/src/components/Lobby.tsx` | Create/join room, server URL config |

## Deployment

The client is deployed on **Vercel** (static site). The server runs locally with an **ngrok** tunnel — no cloud hosting costs.

Server URL is configurable at runtime via the **Server Settings** panel in the lobby.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Backend**: Node.js, Socket.IO
- **Build**: Vite, TypeScript (project references)
- **Deploy**: Vercel (client), ngrok (server tunnel)
