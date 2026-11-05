/**
 * BOT.JS - Tactical AI Bot Operator
 * Capable of running both server-side for multiplayer and client-side for offline practice
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AIBot = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class AIBot {
    constructor(id, name, colorData, GameConfig, WeaponManager, GameMap) {
      this.id = id;
      this.name = name;
      this.colorData = colorData;
      this.config = GameConfig;
      this.isBot = true;

      // Position
      this.x = 800;
      this.y = 800;
      this.vx = 0;
      this.vy = 0;
      this.angle = 0;
      this.targetAngle = 0;
      this.radius = GameConfig.PLAYER.RADIUS;

      // Stats
      this.hp = GameConfig.PLAYER.MAX_HP;
      this.maxHp = GameConfig.PLAYER.MAX_HP;
      this.shield = 25;
      this.maxShield = GameConfig.PLAYER.MAX_SHIELD;

      // Vision
      this.visionAngle = (GameConfig.PLAYER.FOV_DEG * Math.PI) / 180;
      this.visionRange = 550; // slightly shorter than human for fairness
      this.peripheralRadius = GameConfig.PLAYER.PERIPHERAL_RADIUS;

      // AI States: 'patrol', 'hunt', 'combat', 'retreat'
      this.state = 'patrol';
      this.target = null;
      this.waypoint = null;
      this.stateTimer = 0;
      this.strafeDir = 1;
      this.shootCooldown = 0;

      // Walk animation
      this.walkCycle = 0;
      this.isWalking = false;
      this.isShooting = false;
      this.isDead = false;
      this.respawnTimer = 0;

      // Weapons
      this.weaponManager = new WeaponManager(GameConfig);
      // Give bot random primary weapon
      const wKeys = ['RIFLE', 'SMG', 'SHOTGUN'];
      const chosen = wKeys[Math.floor(Math.random() * wKeys.length)];
      this.weaponManager.unlockWeapon(chosen);
      this.weaponManager.selectWeapon(chosen);

      this.kills = 0;
      this.deaths = 0;
      this.score = 0;
    }

    respawn(spawnPoint) {
      this.x = spawnPoint.x;
      this.y = spawnPoint.y;
      this.angle = spawnPoint.angle;
      this.vx = 0;
      this.vy = 0;
      this.hp = this.maxHp;
      this.shield = 25;
      this.isDead = false;
      this.respawnTimer = 0;
      this.state = 'patrol';
      this.target = null;
      this.waypoint = null;
      this.weaponManager.initInventory();
    }

    takeDamage(amount, attackerId) {
      if (this.isDead) return { damageDealt: 0, killed: false };

      let rem = amount;
      if (this.shield > 0) {
        const absorb = Math.min(this.shield, rem * 0.7);
        this.shield -= absorb;
        rem -= absorb;
      }
      this.hp -= rem;

      // If attacked from behind/out of sight, turn towards attacker
      this.state = 'retreat';
      this.stateTimer = 60; // 1 second panic/reposition

      if (this.hp <= 0) {
        this.hp = 0;
        this.isDead = true;
        this.deaths++;
        this.respawnTimer = this.config.PLAYER.RESPAWN_DELAY_MS;
        return { damageDealt: amount, killed: true, attackerId: attackerId };
      }

      return { damageDealt: amount, killed: false };
    }

    update(allPlayers, map, now, dt = 1 / 30) {
      this.isShooting = false;

      if (this.isDead) {
        if (this.respawnTimer > 0) {
          this.respawnTimer -= dt * 1000;
          if (this.respawnTimer <= 0) {
            this.respawn(map.getRandomSpawnPoint());
          }
        }
        return null;
      }

      // Update reload
      this.weaponManager.updateReload(now);
      const currW = this.weaponManager.getCurrent();
      if (currW.currentMag <= 0) {
        this.weaponManager.startReload(now);
      }

      // 1. Scan for closest visible enemy
      let closestEnemy = null;
      let closestDistSq = Infinity;

      for (const p of allPlayers) {
        if (p.id === this.id || p.isDead) continue;

        const dx = p.x - this.x;
        const dy = p.y - this.y;
        const dSq = dx * dx + dy * dy;

        // Check if within bot vision
        if (dSq < this.visionRange * this.visionRange) {
          // Check line of sight
          if (!map.isLineBlocked(this.x, this.y, p.x, p.y)) {
            // Check cone angle
            const angToTarget = Math.atan2(dy, dx);
            let diff = Math.abs(angToTarget - this.angle);
            while (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI);

            if (diff < this.visionAngle / 2 || dSq < this.peripheralRadius * this.peripheralRadius) {
              if (dSq < closestDistSq) {
                closestDistSq = dSq;
                closestEnemy = p;
              }
            }
          }
        }
      }

      // 2. State Machine Transitions
      if (this.hp < 30 && this.state !== 'retreat') {
        this.state = 'retreat';
      } else if (closestEnemy) {
        this.state = 'combat';
        this.target = closestEnemy;
      } else if (this.state === 'combat' && !closestEnemy) {
        this.state = 'hunt';
        this.stateTimer = 90;
      }

      // 3. State Behavior
      let targetX = this.x;
      let targetY = this.y;
      let moveSpeed = this.config.PLAYER.SPEED * 0.85;
      let bulletsCreated = null;

      if (this.state === 'combat' && this.target) {
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.hypot(dx, dy);

        // Turn towards target smoothly
        this.targetAngle = Math.atan2(dy, dx);
        this.smoothTurn(dt);

        // Strafe around enemy
        const perpX = -Math.sin(this.angle) * this.strafeDir;
        const perpY = Math.cos(this.angle) * this.strafeDir;

        // Maintain distance (don't hug too close or back off)
        let fwdX = 0, fwdY = 0;
        if (dist > 350) {
          fwdX = Math.cos(this.angle);
          fwdY = Math.sin(this.angle);
        } else if (dist < 180) {
          fwdX = -Math.cos(this.angle);
          fwdY = -Math.sin(this.angle);
        }

        targetX = this.x + (perpX * 0.7 + fwdX) * moveSpeed;
        targetY = this.y + (perpY * 0.7 + fwdY) * moveSpeed;

        // Change strafe direction occasionally
        if (Math.random() < 0.02) this.strafeDir *= -1;

        // Fire weapon in tactical bursts
        if (this.weaponManager.canShoot(now)) {
          // Check line of sight before firing
          if (!map.isLineBlocked(this.x, this.y, this.target.x, this.target.y)) {
            // Small bot aim inaccuracy
            const aimSpread = (Math.random() - 0.5) * 0.08;
            bulletsCreated = this.weaponManager.shoot(this.id, this.x, this.y, this.angle + aimSpread, now);
            this.isShooting = true;
          }
        }
      } else if (this.state === 'retreat') {
        // Find nearest medkit or run away
        if (!this.waypoint) {
          this.waypoint = this.findNearestHealth(map) || map.getRandomSpawnPoint();
        }
        const dx = this.waypoint.x - this.x;
        const dy = this.waypoint.y - this.y;
        this.targetAngle = Math.atan2(dy, dx);
        this.smoothTurn(dt);

        targetX = this.x + Math.cos(this.angle) * moveSpeed * 1.1;
        targetY = this.y + Math.sin(this.angle) * moveSpeed * 1.1;

        if (Math.hypot(dx, dy) < 40) {
          this.waypoint = null;
          this.state = 'patrol';
        }
      } else {
        // Patrol waypoint logic
        if (!this.waypoint || Math.hypot(this.waypoint.x - this.x, this.waypoint.y - this.y) < 50) {
          this.waypoint = map.getRandomSpawnPoint();
        }

        const dx = this.waypoint.x - this.x;
        const dy = this.waypoint.y - this.y;
        this.targetAngle = Math.atan2(dy, dx);
        this.smoothTurn(dt);

        targetX = this.x + Math.cos(this.angle) * moveSpeed * 0.7;
        targetY = this.y + Math.sin(this.angle) * moveSpeed * 0.7;
      }

      // 4. Collision and Position Resolution
      const resolved = map.resolveCircleCollision(targetX, targetY, this.radius);
      const movedDist = Math.hypot(resolved.x - this.x, resolved.y - this.y);

      if (movedDist > 0.5) {
        this.isWalking = true;
        this.walkCycle += 0.2;
      } else {
        this.isWalking = false;
        // If stuck on obstacle during patrol, pick new waypoint
        if (Math.random() < 0.04) {
          this.waypoint = map.getRandomSpawnPoint();
        }
      }

      this.x = resolved.x;
      this.y = resolved.y;

      return bulletsCreated;
    }

    smoothTurn(dt) {
      let diff = this.targetAngle - this.angle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.angle += diff * Math.min(1.0, 8.0 * dt);
    }

    findNearestHealth(map) {
      let nearest = null;
      let minDist = Infinity;
      for (const item of map.itemSpawns) {
        if (item.active && (item.type === 'medkit' || item.type === 'shield')) {
          const d = Math.hypot(item.x - this.x, item.y - this.y);
          if (d < minDist) {
            minDist = d;
            nearest = item;
          }
        }
      }
      return nearest;
    }
  }

  return AIBot;
}));
