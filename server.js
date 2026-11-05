/**
 * SERVER.JS - High-Performance Real-Time Multiplayer Room Server
 * Express + WebSocket Room Management & State Synchronization
 */
const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');

// Import shared modules
const GameConfig = require('./public/js/config.js');
const GameMap = require('./public/js/map.js');
const WeaponManager = require('./public/js/weapons.js');
const AIBot = require('./public/js/bot.js');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const PORT = process.env.PORT || GameConfig.SERVER_PORT || 3000;

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Fallback route for room query URLs
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Room Manager
class Room {
  constructor(id) {
    this.id = id;
    this.clients = new Set(); // WebSocket instances
    this.players = new Map(); // id -> PlayerState
    this.bots = [];           // Array of AIBot
    this.map = new GameMap();
    this.bullets = [];
    this.killFeed = [];
    this.tickInterval = null;
    this.lastTickTime = Date.now();

    this.startLoop();
  }

  startLoop() {
    const tickMs = 1000 / GameConfig.TICK_RATE;
    this.tickInterval = setInterval(() => {
      this.tick();
    }, tickMs);
  }

  stopLoop() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  addClient(ws, playerData) {
    this.clients.add(ws);
    const sp = this.map.getRandomSpawnPoint();

    const pState = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      name: playerData.name || 'Operator',
      colorData: playerData.color || GameConfig.PLAYER_COLORS[0],
      x: sp.x,
      y: sp.y,
      vx: 0,
      vy: 0,
      angle: sp.angle,
      hp: GameConfig.PLAYER.MAX_HP,
      shield: GameConfig.PLAYER.MAX_SHIELD,
      kills: 0,
      deaths: 0,
      score: 0,
      weapon: 'RIFLE',
      isShooting: false,
      isWalking: false,
      walkCycle: 0,
      isDead: false,
      respawnTimer: 0
    };

    this.players.set(pState.id, pState);
    ws.playerId = pState.id;
    ws.roomId = this.id;

    // Send confirmation to client
    ws.send(JSON.stringify({
      type: 'joined',
      playerId: pState.id,
      room: this.id,
      spawn: sp
    }));

    // Broadcast join chat notification
    this.broadcast({
      type: 'chat',
      sender: 'HQ',
      text: `${pState.name} entered the combat zone.`,
      time: Date.now()
    });
  }

  removeClient(ws) {
    this.clients.delete(ws);
    if (ws.playerId && this.players.has(ws.playerId)) {
      const p = this.players.get(ws.playerId);
      this.players.delete(ws.playerId);
      this.broadcast({
        type: 'chat',
        sender: 'HQ',
        text: `${p.name} disconnected.`,
        time: Date.now()
      });
    }

    // If room is empty, clear bots and stop loop
    if (this.clients.size === 0) {
      this.stopLoop();
      rooms.delete(this.id);
    }
  }

  toggleBots() {
    if (this.bots.length > 0) {
      this.bots = [];
      this.broadcast({
        type: 'chat',
        sender: 'HQ',
        text: 'Tactical AI bots deactivated.',
        time: Date.now()
      });
    } else {
      const botNames = ['Apex-01', 'Ghost-02', 'Shadow-03'];
      for (let i = 0; i < 3; i++) {
        const col = GameConfig.PLAYER_COLORS[(i + 2) % GameConfig.PLAYER_COLORS.length];
        const bot = new AIBot('sbot_' + (i + 1), botNames[i], col, GameConfig, WeaponManager, this.map);
        bot.respawn(this.map.getRandomSpawnPoint());
        this.bots.push(bot);
      }
      this.broadcast({
        type: 'chat',
        sender: 'HQ',
        text: '3 Tactical AI bots deployed to arena.',
        time: Date.now()
      });
    }
  }

  broadcast(data, excludeWs = null) {
    const raw = JSON.stringify(data);
    for (const client of this.clients) {
      if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
        client.send(raw);
      }
    }
  }

  tick() {
    const now = Date.now();
    const dt = (now - this.lastTickTime) / 1000;
    this.lastTickTime = now;

    // 1. Update bots
    const allEnts = [...this.players.values(), ...this.bots];
    for (const bot of this.bots) {
      const bullets = bot.update(allEnts, this.map, now, dt);
      if (bullets && bullets.length > 0) {
        this.broadcast({ type: 'shoot', bullets: bullets });
      }
    }

    // 2. Prepare and broadcast state snapshot
    const playerSnapshots = [];
    for (const p of this.players.values()) {
      playerSnapshots.push({
        id: p.id,
        name: p.name,
        colorData: p.colorData,
        x: p.x,
        y: p.y,
        angle: p.angle,
        hp: p.hp,
        shield: p.shield,
        kills: p.kills,
        deaths: p.deaths,
        score: p.score,
        weapon: p.weapon,
        isShooting: p.isShooting,
        isWalking: p.isWalking,
        walkCycle: p.walkCycle,
        isDead: p.isDead
      });
    }

    // Include bots in players array
    for (const b of this.bots) {
      playerSnapshots.push({
        id: b.id,
        name: b.name,
        colorData: b.colorData,
        x: b.x,
        y: b.y,
        angle: b.angle,
        hp: b.hp,
        shield: b.shield,
        kills: b.kills,
        deaths: b.deaths,
        score: b.score,
        weapon: b.weaponManager.currentWeaponKey,
        isShooting: b.isShooting,
        isWalking: b.isWalking,
        walkCycle: b.walkCycle,
        isDead: b.isDead
      });
    }

    // Items active state
    const itemsState = this.map.itemSpawns.map(it => ({ id: it.id, active: it.active }));
    const barrelsState = this.map.barrels.map(b => ({ id: b.id, exploded: b.exploded }));

    this.broadcast({
      type: 'state',
      players: playerSnapshots,
      items: itemsState,
      barrels: barrelsState
    });
  }
}

const rooms = new Map();

function getOrCreateRoom(roomId) {
  const cleanId = (roomId || 'ALPHA_HQ').trim().toUpperCase();
  if (!rooms.has(cleanId)) {
    rooms.set(cleanId, new Room(cleanId));
  }
  return rooms.get(cleanId);
}

// WebSocket Connection Router
wss.on('connection', (ws) => {
  ws.isAlive = true;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'join': {
          const room = getOrCreateRoom(data.room);
          room.addClient(ws, data);
          break;
        }

        case 'player_update': {
          if (!ws.roomId || !rooms.has(ws.roomId)) return;
          const room = rooms.get(ws.roomId);
          const p = room.players.get(ws.playerId);
          if (p) {
            p.x = data.x;
            p.y = data.y;
            p.angle = data.angle;
            p.vx = data.vx;
            p.vy = data.vy;
            p.hp = data.hp;
            p.shield = data.shield;
            p.isWalking = data.isWalking;
            p.walkCycle = data.walkCycle;
            p.weapon = data.weapon;
            p.isDead = data.isDead;
          }
          break;
        }

        case 'shoot': {
          if (!ws.roomId || !rooms.has(ws.roomId)) return;
          const room = rooms.get(ws.roomId);
          // Broadcast projectile burst to all other players in room
          room.broadcast({ type: 'shoot', bullets: data.bullets }, ws);
          break;
        }

        case 'hit': {
          if (!ws.roomId || !rooms.has(ws.roomId)) return;
          const room = rooms.get(ws.roomId);
          const attacker = room.players.get(ws.playerId);

          // Check if target is a player
          let target = room.players.get(data.targetId);
          // Or bot
          if (!target) {
            target = room.bots.find(b => b.id === data.targetId);
          }

          if (target && !target.isDead) {
            const hitResult = target.takeDamage ? target.takeDamage(data.damage, ws.playerId) : null;
            if (!hitResult && typeof target.hp === 'number') {
              // Direct player state update
              let rem = data.damage;
              if (target.shield > 0) {
                const abs = Math.min(target.shield, rem * 0.7);
                target.shield -= abs;
                rem -= abs;
              }
              target.hp -= rem;
              if (target.hp <= 0) {
                target.hp = 0;
                target.isDead = true;
                target.deaths++;
                if (attacker) {
                  attacker.kills++;
                  attacker.score += 100;
                  room.broadcast({
                    type: 'kill',
                    killerName: attacker.name,
                    victimName: target.name,
                    weapon: data.weapon || 'RIFLE'
                  });
                }
              }
            } else if (hitResult && hitResult.killed) {
              if (attacker) {
                attacker.kills++;
                attacker.score += 100;
                room.broadcast({
                  type: 'kill',
                  killerName: attacker.name,
                  victimName: target.name,
                  weapon: data.weapon || 'RIFLE'
                });
              }
            }
          }
          break;
        }

        case 'chat': {
          if (!ws.roomId || !rooms.has(ws.roomId)) return;
          const room = rooms.get(ws.roomId);
          const p = room.players.get(ws.playerId);
          const senderName = p ? p.name : 'Unknown';
          room.broadcast({
            type: 'chat',
            sender: senderName,
            text: data.text,
            time: Date.now()
          });
          break;
        }

        case 'bot_toggle': {
          if (!ws.roomId || !rooms.has(ws.roomId)) return;
          const room = rooms.get(ws.roomId);
          room.toggleBots();
          break;
        }

        case 'ping': {
          ws.send(JSON.stringify({ type: 'pong', time: data.time }));
          break;
        }
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    if (ws.roomId && rooms.has(ws.roomId)) {
      rooms.get(ws.roomId).removeClient(ws);
    }
  });
});

// Start HTTP & WS Server
server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` OPERATOR: ZERO LINE Tactical Multiplayer Server Active`);
  console.log(` Local URL: http://localhost:${PORT}`);
  console.log(` Room Link Example: http://localhost:${PORT}/?room=SQUAD1`);
  console.log(`=======================================================`);
});
