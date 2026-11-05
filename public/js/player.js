/**
 * PLAYER.JS - Local Player Entity, Controller, Physics, and Input
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Player = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class Player {
    constructor(id, name, colorData, GameConfig, WeaponManager) {
      this.id = id || 'player_' + Math.floor(Math.random() * 10000);
      this.name = name || 'Operator';
      this.colorData = colorData || GameConfig.PLAYER_COLORS[0];
      this.config = GameConfig;

      // Position & Physics
      this.x = 400;
      this.y = 400;
      this.vx = 0;
      this.vy = 0;
      this.angle = 0;
      this.radius = GameConfig.PLAYER.RADIUS;

      // Stats
      this.hp = GameConfig.PLAYER.MAX_HP;
      this.maxHp = GameConfig.PLAYER.MAX_HP;
      this.shield = GameConfig.PLAYER.MAX_SHIELD;
      this.maxShield = GameConfig.PLAYER.MAX_SHIELD;
      this.stamina = GameConfig.PLAYER.MAX_STAMINA;
      this.maxStamina = GameConfig.PLAYER.MAX_STAMINA;

      // Vision
      this.visionAngle = (GameConfig.PLAYER.FOV_DEG * Math.PI) / 180;
      this.visionRange = GameConfig.PLAYER.VISION_RANGE;
      this.peripheralRadius = GameConfig.PLAYER.PERIPHERAL_RADIUS;
      this.flashlightOn = true;

      // Animation & State
      this.walkCycle = 0;
      this.isWalking = false;
      this.isSprinting = false;
      this.isShooting = false;
      this.isDead = false;
      this.respawnTimer = 0;

      // Weapons
      this.weaponManager = new WeaponManager(GameConfig);

      // Score
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
      this.shield = this.maxShield;
      this.stamina = this.maxStamina;
      this.isDead = false;
      this.respawnTimer = 0;
      this.weaponManager.initInventory();
    }

    takeDamage(amount, attackerId) {
      if (this.isDead) return { damageDealt: 0, killed: false };

      let remainingDmg = amount;

      // Shield absorbs up to 70% of damage
      if (this.shield > 0) {
        const shieldAbsorb = Math.min(this.shield, remainingDmg * 0.7);
        this.shield -= shieldAbsorb;
        remainingDmg -= shieldAbsorb;
      }

      this.hp -= remainingDmg;

      if (this.hp <= 0) {
        this.hp = 0;
        this.isDead = true;
        this.deaths++;
        this.respawnTimer = this.config.PLAYER.RESPAWN_DELAY_MS;
        return { damageDealt: amount, killed: true, attackerId: attackerId };
      }

      return { damageDealt: amount, killed: false };
    }

    heal(amount) {
      this.hp = Math.min(this.maxHp, this.hp + amount);
    }

    addShield(amount) {
      this.shield = Math.min(this.maxShield, this.shield + amount);
    }

    update(inputState, map, soundManager, now, dt = 1 / 60, network = null) {
      if (this.isDead) {
        if (this.respawnTimer > 0) {
          this.respawnTimer -= dt * 1000;
          if (this.respawnTimer <= 0) {
            if (network && !network.isOfflineMode) {
              network.sendRespawn();
            } else {
              const sp = map.getRandomSpawnPoint();
              this.respawn(sp);
            }
          }
        }
        return;
      }

      // 1. Aim direction towards cursor in world space
      const dx = inputState.worldMouseX - this.x;
      const dy = inputState.worldMouseY - this.y;
      this.angle = Math.atan2(dy, dx);

      // 2. Sprint and Stamina
      this.isSprinting = (inputState.keys['ShiftLeft'] || inputState.keys['ShiftRight'] || inputState.keys['Space']) &&
                         (inputState.moveX !== 0 || inputState.moveY !== 0) &&
                         this.stamina > 10;

      if (this.isSprinting) {
        this.stamina = Math.max(0, this.stamina - this.config.PLAYER.STAMINA_DRAIN * dt);
      } else {
        this.stamina = Math.min(this.maxStamina, this.stamina + this.config.PLAYER.STAMINA_RECOVER * dt);
      }

      const moveSpeed = this.isSprinting ? this.config.PLAYER.SPRINT_SPEED : this.config.PLAYER.SPEED;

      // 3. Movement vector
      let mx = inputState.moveX;
      let my = inputState.moveY;
      const len = Math.hypot(mx, my);

      if (len > 0) {
        mx /= len;
        my /= len;
        this.vx = mx * moveSpeed;
        this.vy = my * moveSpeed;
        this.isWalking = true;
        this.walkCycle += this.isSprinting ? 0.35 : 0.22;

        if (soundManager) {
          soundManager.playFootstep();
        }
      } else {
        this.vx *= 0.7;
        this.vy *= 0.7;
        this.isWalking = false;
      }

      // 4. Collision resolution against map obstacles
      const targetX = this.x + this.vx;
      const targetY = this.y + this.vy;
      const resolved = map.resolveCircleCollision(targetX, targetY, this.radius);

      this.x = resolved.x;
      this.y = resolved.y;

      // 5. Reload update
      if (this.weaponManager.updateReload(now)) {
        // Reload completed
      }

      // Check reload key
      if (inputState.keys['KeyR']) {
        if (this.weaponManager.startReload(now) && soundManager) {
          soundManager.playReload();
        }
      }

      // Check weapon slot keys (1 - 5)
      if (inputState.keys['Digit1']) this.weaponManager.selectWeapon('PISTOL');
      if (inputState.keys['Digit2']) this.weaponManager.selectWeapon('SMG');
      if (inputState.keys['Digit3']) this.weaponManager.selectWeapon('RIFLE');
      if (inputState.keys['Digit4']) this.weaponManager.selectWeapon('SHOTGUN');
      if (inputState.keys['Digit5']) this.weaponManager.selectWeapon('SNIPER');

      // Check flashlight toggle (F key)
      if (inputState.toggleFlashlight) {
        this.flashlightOn = !this.flashlightOn;
        inputState.toggleFlashlight = false;
      }

      // 6. Check Item pickups
      for (let i = 0; i < map.itemSpawns.length; i++) {
        const item = map.itemSpawns[i];
        if (!item.active) continue;

        const dist = Math.hypot(this.x - item.x, this.y - item.y);
        if (dist < this.radius + 18) {
          if (network && !network.isOfflineMode) {
            network.sendPickupItem(item.id);
          } else {
            if (item.type === 'medkit' && this.hp < this.maxHp) {
              this.heal(50);
              item.active = false;
              setTimeout(() => { item.active = true; }, item.respawnTime);
              if (soundManager) soundManager.playPickup();
            } else if (item.type === 'shield' && this.shield < this.maxShield) {
              this.addShield(50);
              item.active = false;
              setTimeout(() => { item.active = true; }, item.respawnTime);
              if (soundManager) soundManager.playPickup();
            } else if (item.type === 'ammo') {
              this.weaponManager.addAmmo(0.6);
              item.active = false;
              setTimeout(() => { item.active = true; }, item.respawnTime);
              if (soundManager) soundManager.playPickup();
            } else if (item.type === 'weapon' && item.weapon) {
              this.weaponManager.unlockWeapon(item.weapon);
              item.active = false;
              setTimeout(() => { item.active = true; }, item.respawnTime);
              if (soundManager) soundManager.playPickup();
            }
          }
        }
      }
    }
  }

  return Player;
}));
