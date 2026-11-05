/**
 * WEAPONS.JS - Ballistics, Inventory, Ammo, and Shooting Logic
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.WeaponManager = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class WeaponManager {
    constructor(GameConfig) {
      this.config = GameConfig;
      this.weapons = {};
      this.currentWeaponKey = 'RIFLE';
      this.lastFireTime = 0;
      this.isReloading = false;
      this.reloadEndTime = 0;

      this.initInventory();
    }

    initInventory() {
      const keys = Object.keys(this.config.WEAPONS);
      for (const k of keys) {
        const w = this.config.WEAPONS[k];
        this.weapons[k] = {
          ...w,
          currentMag: w.magSize,
          reserveAmmo: w.reserveAmmo,
          unlocked: k === 'PISTOL' || k === 'RIFLE' // Start with Pistol and Rifle
        };
      }
    }

    getCurrent() {
      return this.weapons[this.currentWeaponKey];
    }

    selectWeapon(key) {
      if (this.weapons[key] && this.weapons[key].unlocked && this.currentWeaponKey !== key) {
        this.currentWeaponKey = key;
        this.isReloading = false;
        return true;
      }
      return false;
    }

    selectNextWeapon() {
      const keys = Object.keys(this.weapons);
      const currIdx = keys.indexOf(this.currentWeaponKey);
      for (let i = 1; i < keys.length; i++) {
        const nextIdx = (currIdx + i) % keys.length;
        const nextKey = keys[nextIdx];
        if (this.weapons[nextKey].unlocked) {
          this.selectWeapon(nextKey);
          break;
        }
      }
    }

    selectPrevWeapon() {
      const keys = Object.keys(this.weapons);
      const currIdx = keys.indexOf(this.currentWeaponKey);
      for (let i = 1; i < keys.length; i++) {
        const prevIdx = (currIdx - i + keys.length) % keys.length;
        const prevKey = keys[prevIdx];
        if (this.weapons[prevKey].unlocked) {
          this.selectWeapon(prevKey);
          break;
        }
      }
    }

    unlockWeapon(key) {
      if (this.weapons[key]) {
        this.weapons[key].unlocked = true;
        this.weapons[key].reserveAmmo += this.weapons[key].magSize * 2;
        this.selectWeapon(key);
      }
    }

    addAmmo(amountPercent = 0.5) {
      for (const k in this.weapons) {
        const w = this.weapons[k];
        const gain = Math.ceil(w.magSize * 2 * amountPercent);
        w.reserveAmmo += gain;
      }
    }

    startReload(now) {
      const w = this.getCurrent();
      if (this.isReloading || w.currentMag >= w.magSize || w.reserveAmmo <= 0) return false;

      this.isReloading = true;
      this.reloadEndTime = now + w.reloadTimeMs;
      return true;
    }

    updateReload(now) {
      if (!this.isReloading) return false;

      if (now >= this.reloadEndTime) {
        const w = this.getCurrent();
        const needed = w.magSize - w.currentMag;
        const actual = Math.min(needed, w.reserveAmmo);
        w.currentMag += actual;
        w.reserveAmmo -= actual;
        this.isReloading = false;
        return true; // Completed
      }
      return false;
    }

    canShoot(now) {
      if (this.isReloading) return false;
      const w = this.getCurrent();
      if (w.currentMag <= 0) return false;
      if (now - this.lastFireTime < w.fireRateMs) return false;
      return true;
    }

    /**
     * Creates projectiles for the current weapon
     */
    shoot(shooterId, originX, originY, angle, now) {
      if (!this.canShoot(now)) return null;

      const w = this.getCurrent();
      this.lastFireTime = now;
      w.currentMag--;

      // Origin of barrel tip (offset from player center)
      const barrelOffsetDist = 32;
      const barrelLateralOffset = 6;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const spawnX = originX + cosA * barrelOffsetDist - sinA * barrelLateralOffset;
      const spawnY = originY + sinA * barrelOffsetDist + cosA * barrelLateralOffset;

      const bullets = [];
      const numPellets = w.pellets || 1;

      for (let i = 0; i < numPellets; i++) {
        // Calculate spread
        const spreadOffset = (Math.random() - 0.5) * w.spread * 2;
        const bulletAngle = angle + spreadOffset;
        const speed = w.bulletSpeed + (Math.random() * 2 - 1);

        bullets.push({
          id: shooterId + '_' + now + '_' + i,
          shooterId: shooterId,
          x: spawnX,
          y: spawnY,
          prevX: spawnX,
          prevY: spawnY,
          vx: Math.cos(bulletAngle) * speed,
          vy: Math.sin(bulletAngle) * speed,
          damage: w.damage,
          rangeRemaining: w.bulletRange,
          color: w.color,
          trailColor: w.trailColor,
          sound: w.sound,
          weaponType: w.id
        });
      }

      return bullets;
    }
  }

  return WeaponManager;
}));
