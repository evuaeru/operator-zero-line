# OPERATOR: ZERO LINE

Tactical HTML5 Top-Down Shooter featuring a dynamic **Fog of War / 2D Line of Sight (LOS)** mechanic, custom procedural sprites and visual effects, and real-time room-based multiplayer ("mabar").

---

## 🎮 Features

1. **Dynamic Fog of War & 2D Line of Sight**:
   - 115° forward field-of-view cone with smooth angular falloff and volumetric dust lighting.
   - 360° close-proximity personal bubble (110px) so you notice sounds/threats right behind you.
   - Persistent exploration memory shroud: unexplored areas are pitch black, visited areas stay mapped but dimmed.
   - Enemies outside direct line of sight or behind cover are completely hidden from sight, making corner-checking and stealth vital.

2. **Custom Sprites & High-Detail Visuals**:
   - Tactical soldier models with Ops-Core helmets, glowing NVG/visors, ballistic vests, pouches, and hands gripping weapons.
   - Realistic animated walking cycles (sinusoidal boot movement with foot tread).
   - 5 unique weapon sprites: **M9 Tactical Pistol**, **Vector-9 SMG**, **M4A1 CQB Rifle**, **SPAS-12 Shotgun**, and **AWP Covert Sniper** (with active laser sight).
   - Multi-stage muzzle flashes, dynamic shell ejection (spent brass bouncing and settling with friction), permanent blood splatters, and bullet wall sparks.
   - Destructible explosive hazard barrels that detonate in chain reactions.
   - Floating combat damage numbers and responsive hitmarkers.

3. **Multiplayer Mabar System**:
   - Shareable room links: friends can join immediately using `http://<HOST_IP>:3000/?room=ROOM_NAME`.
   - One-click **"📋 COPY INVITE LINK"** button in HUD.
   - Real-time WebSocket synchronization at 30 ticks/second with client-side interpolation.
   - In-game squad chat (press `[Enter]` to chat).
   - Tactical scoreboard (hold `[Tab]`).
   - Bot support: host can toggle AI bots to practice solo or fill squads.

4. **Web Audio Synthesizer**:
   - 100% zero external audio file dependencies. Instant procedural audio for gunshots, reloads, footsteps, hitmarker ticks, and explosions.

---

## 🚀 How to Run

### Method 1: Double-Click
Double-click [`start_game.bat`](file:///E:/Dokumen/topdown_shooter_game/start_game.bat). It starts the server and opens your browser at `http://localhost:3000`.

### Method 2: Terminal
```bash
cd E:\Dokumen\topdown_shooter_game
npm start
```
Then open your browser at:
`http://localhost:3000`

### Mabar with Friends on the Same Wi-Fi / LAN:
Find your local IP address (e.g., `192.168.1.50`) by running `ipconfig`.
Share this URL with your friends:
`http://192.168.1.50:3000/?room=SQUAD1`

---

## 🕹️ Controls

| Action | Key / Control |
|---|---|
| **Move** | `W`, `A`, `S`, `D` / Arrow Keys |
| **Aim** | Mouse Pointer |
| **Shoot** | `Left Click` |
| **Flashlight Toggle** | `F` |
| **Reload** | `R` |
| **Tactical Sprint** | `Shift` / `Space` |
| **Select Weapons** | `1`, `2`, `3`, `4`, `5` or `Mouse Wheel` |
| **Scoreboard** | `Tab` (Hold) |
| **In-game Chat** | `Enter` |

---

## 🧪 Testing

Run automated unit and integration tests:
```bash
cd E:\Dokumen\topdown_shooter_game
npm test
```
All 19 test cases verify collision geometry, raycasting LOS sorting, ballistics, AI state machine, and WebSocket room synchronization.
