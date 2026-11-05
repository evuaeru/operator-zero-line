/**
 * NETWORK.JS - Real-Time WebSocket Client & Room Synchronization
 * Seamlessly manages multiplayer rooms, state syncing, and offline fallback
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NetworkManager = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class NetworkManager {
    constructor() {
      this.socket = null;
      this.connected = false;
      this.isOfflineMode = false;
      this.playerId = null;
      this.roomId = null;
      this.ping = 0;
      this.lastPingSent = 0;

      // Remote entities
      this.remotePlayers = new Map();
      this.serverBullets = [];
      this.killFeed = [];
      this.chatMessages = [];

      // Callbacks
      this.onJoinedRoom = null;
      this.onKillEvent = null;
      this.onChatEvent = null;
    }

    init(roomCode, playerName, playerColor, onJoined) {
      this.roomId = roomCode || 'ALPHA_HQ';
      this.onJoinedRoom = onJoined;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host || 'localhost:3000';
      const wsUrl = `${protocol}//${host}/ws`;

      try {
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
          this.connected = true;
          this.isOfflineMode = false;
          // Send join message
          this.send({
            type: 'join',
            room: this.roomId,
            name: playerName,
            color: playerColor
          });

          // Start ping heartbeat
          this.startPingLoop();
        };

        this.socket.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.socket.onerror = (err) => {
          console.warn('WebSocket connection failed, switching to offline / bot match mode.', err);
          this.enableOfflineMode();
        };

        this.socket.onclose = () => {
          this.connected = false;
          if (!this.isOfflineMode) {
            console.log('WebSocket closed. Entering offline bot mode.');
            this.enableOfflineMode();
          }
        };
      } catch (e) {
        console.warn('Cannot establish WebSocket:', e);
        this.enableOfflineMode();
      }
    }

    enableOfflineMode() {
      this.isOfflineMode = true;
      this.connected = false;
      this.playerId = 'local_operator';
      if (this.onJoinedRoom) {
        this.onJoinedRoom({
          playerId: this.playerId,
          room: this.roomId,
          offline: true
        });
      }
    }

    startPingLoop() {
      setInterval(() => {
        if (this.connected && this.socket.readyState === WebSocket.OPEN) {
          this.lastPingSent = performance.now();
          this.send({ type: 'ping', time: this.lastPingSent });
        }
      }, 2000);
    }

    send(data) {
      if (this.connected && this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(data));
      }
    }

    sendPlayerInput(player) {
      if (!this.connected) return;

      this.send({
        type: 'player_update',
        x: Math.round(player.x * 10) / 10,
        y: Math.round(player.y * 10) / 10,
        angle: Math.round(player.angle * 100) / 100,
        vx: Math.round(player.vx * 10) / 10,
        vy: Math.round(player.vy * 10) / 10,
        hp: player.hp,
        shield: player.shield,
        isWalking: player.isWalking,
        walkCycle: player.walkCycle,
        weapon: player.weaponManager.currentWeaponKey,
        isDead: player.isDead
      });
    }

    sendShoot(bulletArray) {
      if (!this.connected) return;
      this.send({
        type: 'shoot',
        bullets: bulletArray
      });
    }

    sendHit(targetId, damage, weaponType) {
      if (!this.connected) return;
      this.send({
        type: 'hit',
        targetId: targetId,
        damage: damage,
        weapon: weaponType
      });
    }

    sendChat(text) {
      if (!text || text.trim() === '') return;
      if (this.connected) {
        this.send({ type: 'chat', text: text.trim() });
      } else {
        // Local chat echo
        this.chatMessages.push({ sender: 'You', text: text.trim(), time: Date.now() });
      }
    }

    toggleBots() {
      if (this.connected) {
        this.send({ type: 'bot_toggle' });
      }
    }

    handleMessage(raw) {
      try {
        const msg = JSON.parse(raw);

        switch (msg.type) {
          case 'joined':
            this.playerId = msg.playerId;
            this.roomId = msg.room;
            if (this.onJoinedRoom) {
              this.onJoinedRoom(msg);
            }
            break;

          case 'pong':
            this.ping = Math.round(performance.now() - this.lastPingSent);
            break;

          case 'state':
            this.syncGameState(msg);
            break;

          case 'kill':
            this.killFeed.unshift(msg);
            if (this.killFeed.length > 5) this.killFeed.pop();
            if (this.onKillEvent) this.onKillEvent(msg);
            break;

          case 'chat':
            this.chatMessages.push(msg);
            if (this.chatMessages.length > 20) this.chatMessages.shift();
            if (this.onChatEvent) this.onChatEvent(msg);
            break;
        }
      } catch (err) {
        console.error('Failed to parse network message', err);
      }
    }

    syncGameState(msg) {
      // Sync players
      const activeIds = new Set();
      for (const p of msg.players) {
        if (p.id === this.playerId) continue; // Don't override local prediction directly
        activeIds.add(p.id);

        if (!this.remotePlayers.has(p.id)) {
          this.remotePlayers.set(p.id, {
            ...p,
            targetX: p.x,
            targetY: p.y,
            targetAngle: p.angle
          });
        } else {
          const rp = this.remotePlayers.get(p.id);
          // Set target for smooth interpolation
          rp.targetX = p.x;
          rp.targetY = p.y;
          rp.targetAngle = p.angle;
          rp.hp = p.hp;
          rp.shield = p.shield;
          rp.isWalking = p.isWalking;
          rp.walkCycle = p.walkCycle;
          rp.isShooting = p.isShooting;
          rp.weapon = p.weapon;
          rp.isDead = p.isDead;
          rp.kills = p.kills;
          rp.deaths = p.deaths;
          rp.colorData = p.colorData || rp.colorData;
          rp.name = p.name;
        }
      }

      // Remove disconnected players
      for (const id of this.remotePlayers.keys()) {
        if (!activeIds.has(id)) {
          this.remotePlayers.delete(id);
        }
      }

      // Sync active items & barrels
      if (msg.items && window.currentMap) {
        for (let i = 0; i < msg.items.length; i++) {
          if (window.currentMap.itemSpawns[i]) {
            window.currentMap.itemSpawns[i].active = msg.items[i].active;
          }
        }
      }

      if (msg.barrels && window.currentMap) {
        for (let i = 0; i < msg.barrels.length; i++) {
          if (window.currentMap.barrels[i]) {
            window.currentMap.barrels[i].exploded = msg.barrels[i].exploded;
          }
        }
      }
    }

    /**
     * Smoothly interpolate remote players toward their target coordinates
     */
    interpolateRemotePlayers(dt) {
      const lerpFactor = Math.min(1.0, 14.0 * dt);

      for (const rp of this.remotePlayers.values()) {
        rp.x += (rp.targetX - rp.x) * lerpFactor;
        rp.y += (rp.targetY - rp.y) * lerpFactor;

        // Angle interpolation
        let diff = rp.targetAngle - rp.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        rp.angle += diff * lerpFactor;
      }
    }
  }

  return NetworkManager;
}));
