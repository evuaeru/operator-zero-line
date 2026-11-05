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

    // Match Round Timer & State
    this.roundDurationSec = 180;
    this.roundTimeRemaining = this.roundDurationSec;
    this.isRoundOver = false;
    this.postRoundTimer = 0;

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

    // 0. Update Round Timer
    if (!this.isRoundOver) {
      this.roundTimeRemaining = Math.max(0, this.roundTimeRemaining - dt);
      if (this.roundTimeRemaining <= 0) {
        this.isRoundOver = true;
        this.postRoundTimer = 10;
        const all = [...this.players.values(), ...this.bots];
        all.sort((a, b) => (b.score || 0) - (a.score || 0) || (b.kills || 0) - (a.kills || 0));
        const mvp = all[0] || null;
        this.broadcast({
          type: 'round_end',
          mvp: mvp ? { id: mvp.id, name: mvp.name, kills: mvp.kills, deaths: mvp.deaths, score: mvp.score } : null,
          leaderboard: all.map(p => ({ id: p.id, name: p.name, kills: p.kills, deaths: p.deaths, score: p.score })),
          duration: 10
        });
      }
    } else {
      this.postRoundTimer -= dt;
      if (this.postRoundTimer <= 0) {
        this.isRoundOver = false;
        this.roundTimeRemaining = this.roundDurationSec;
        for (const p of this.players.values()) {
          const sp = this.map.getRandomSpawnPoint();
          p.x = sp.x; p.y = sp.y; p.hp = GameConfig.PLAYER.MAX_HP; p.shield = GameConfig.PLAYER.MAX_SHIELD; p.isDead = false;
        }
        for (const b of this.bots) {
          b.respawn(this.map.getRandomSpawnPoint());
        }
        this.broadcast({ type: 'round_start', timeRemaining: this.roundDurationSec });
      }
    }

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
      barrels: barrelsState,
      roundTime: Math.ceil(this.roundTimeRemaining),
      isRoundOver: this.isRoundOver
    });
  }
}

const rooms = new Map();

function getOrCreateRoom(roomId) {
  const trimmed = typeof roomId === 'string' ? roomId.trim().toUpperCase() : '';
  const cleanId = trimmed !== '' ? trimmed : 'ALPHA_HQ';
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
          if (p && !p.isDead) {
            p.x = data.x;
            p.y = data.y;
            p.angle = data.angle;
            p.vx = data.vx;
            p.vy = data.vy;
            p.isWalking = data.isWalking;
            p.walkCycle = data.walkCycle;
            p.weapon = data.weapon;
          }
          break;
        }

        case 'respawn': {
          if (!ws.roomId || !rooms.has(ws.roomId)) return;
          const room = rooms.get(ws.roomId);
          const p = room.players.get(ws.playerId);
          if (p) {
            const sp = room.map.getRandomSpawnPoint();
            p.x = sp.x;
            p.y = sp.y;
            p.angle = sp.angle;
            p.hp = GameConfig.PLAYER.MAX_HP;
            p.shield = GameConfig.PLAYER.MAX_SHIELD;
            p.isDead = false;
            ws.send(JSON.stringify({
              type: 'respawned',
              spawn: sp,
              hp: p.hp,
              shield: p.shield
            }));
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
          let targetWs = null;
          if (target) {
            for (const c of room.clients) {
              if (c.playerId === target.id) {
                targetWs = c;
                break;
              }
            }
          }

          // Or bot
          let isBot = false;
          if (!target) {
            target = room.bots.find(b => b.id === data.targetId);
            if (target) isBot = true;
          }

          if (target && !target.isDead) {
            const hitResult = isBot && target.takeDamage ? target.takeDamage(data.damage, ws.playerId) : null;
            if (!isBot && typeof target.hp === 'number') {
              // Direct player state update on authoritative server
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

              // Notify the victim immediately of damage taken
              if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                targetWs.send(JSON.stringify({
                  type: 'damage_taken',
                  damage: data.damage,
                  attackerId: ws.playerId,
                  hp: target.hp,
                  shield: target.shield,
                  isDead: target.isDead
                }));
              }
            } else if (isBot && hitResult && hitResult.killed) {
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

        case 'pickup_item': {
          if (!ws.roomId || !rooms.has(ws.roomId)) return;
          const room = rooms.get(ws.roomId);
          const p = room.players.get(ws.playerId);
          if (!p || p.isDead) return;

          const item = room.map.itemSpawns.find(it => it.id === data.itemId);
          if (item && item.active) {
            const dist = Math.hypot(p.x - item.x, p.y - item.y);
            if (dist < 140) {
              item.active = false;
              setTimeout(() => {
                item.active = true;
              }, item.respawnTime || 20000);

              if (item.type === 'medkit') {
                p.hp = Math.min(GameConfig.PLAYER.MAX_HP, p.hp + 50);
              } else if (item.type === 'shield') {
                p.shield = Math.min(GameConfig.PLAYER.MAX_SHIELD, p.shield + 50);
              }

              room.broadcast({
                type: 'item_picked',
                itemId: item.id,
                playerId: ws.playerId,
                itemType: item.type,
                weapon: item.weapon
              });
            }
          }
          break;
        }

        case 'barrel_hit': {
          if (!ws.roomId || !rooms.has(ws.roomId)) return;
          const room = rooms.get(ws.roomId);
          const barrel = room.map.barrels.find(b => b.id === data.barrelId);
          if (barrel && !barrel.exploded) {
            barrel.hp -= data.damage;
            if (barrel.hp <= 0) {
              barrel.exploded = true;
              room.map.rebuildSegments();

              room.broadcast({
                type: 'barrel_exploded',
                barrelId: barrel.id,
                x: barrel.x,
                y: barrel.y,
                shooterId: data.shooterId
              });

              // Apply explosion splash damage to entities
              const blastR = 140;
              const maxDmg = 90;
              const attacker = room.players.get(data.shooterId);

              for (const c of room.clients) {
                const targetPlayer = room.players.get(c.playerId);
                if (!targetPlayer || targetPlayer.isDead) continue;
                const d = Math.hypot(targetPlayer.x - barrel.x, targetPlayer.y - barrel.y);
                if (d < blastR) {
                  const dmg = Math.round(maxDmg * (1 - d / blastR));
                  let rem = dmg;
                  if (targetPlayer.shield > 0) {
                    const abs = Math.min(targetPlayer.shield, rem * 0.7);
                    targetPlayer.shield -= abs;
                    rem -= abs;
                  }
                  targetPlayer.hp -= rem;
                  if (targetPlayer.hp <= 0) {
                    targetPlayer.hp = 0;
                    targetPlayer.isDead = true;
                    targetPlayer.deaths++;
                    if (attacker && attacker.id !== targetPlayer.id) {
                      attacker.kills++;
                      attacker.score += 100;
                    }
                    room.broadcast({
                      type: 'kill',
                      killerName: attacker ? attacker.name : 'Explosive Barrel',
                      victimName: targetPlayer.name,
                      weapon: 'BARREL'
                    });
                  }
                  if (c.readyState === WebSocket.OPEN) {
                    c.send(JSON.stringify({
                      type: 'damage_taken',
                      damage: dmg,
                      attackerId: data.shooterId,
                      hp: targetPlayer.hp,
                      shield: targetPlayer.shield,
                      isDead: targetPlayer.isDead
                    }));
                  }
                }
              }

              for (const bot of room.bots) {
                if (bot.isDead) continue;
                const d = Math.hypot(bot.x - barrel.x, bot.y - barrel.y);
                if (d < blastR) {
                  const dmg = Math.round(maxDmg * (1 - d / blastR));
                  const hitRes = bot.takeDamage(dmg, data.shooterId);
                  if (hitRes && hitRes.killed && attacker) {
                    attacker.kills++;
                    attacker.score += 100;
                    room.broadcast({
                      type: 'kill',
                      killerName: attacker.name,
                      victimName: bot.name,
                      weapon: 'BARREL'
                    });
                  }
                }
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

// Start HTTP & WS Server only if not loaded as module in tests
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` OPERATOR: ZERO LINE Tactical Multiplayer Server Active`);
    console.log(` Local URL: http://localhost:${PORT}`);
    console.log(` Room Link Example: http://localhost:${PORT}/?room=SQUAD1`);
    console.log(`=======================================================`);
  });
}

module.exports = { app, server, Room, rooms, getOrCreateRoom };
