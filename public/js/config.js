/**
 * CONFIG.JS - Shared Game Constants & Data Models
 * Compatible with both Browser and Node.js
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GameConfig = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const GameConfig = {
    SERVER_PORT: 3000,
    TICK_RATE: 30, // 30 FPS server simulation
    SNAPSHOT_HISTORY_MS: 100,

    PLAYER: {
      RADIUS: 22,
      SPEED: 4.0,
      SPRINT_SPEED: 6.2,
      MAX_STAMINA: 100,
      STAMINA_DRAIN: 35, // per second
      STAMINA_RECOVER: 25, // per second
      MAX_HP: 100,
      MAX_SHIELD: 50,
      FOV_DEG: 115, // Field of view in degrees
      VISION_RANGE: 680, // Pixels
      PERIPHERAL_RADIUS: 110, // 360 degree close proximity vision
      FLASHLIGHT_RANGE: 820,
      FLASHLIGHT_ANGLE_DEG: 75,
      RESPAWN_DELAY_MS: 3000
    },

    WEAPONS: {
      PISTOL: {
        id: 'pistol',
        name: 'M9 TACTICAL',
        damage: 24,
        fireRateMs: 280,
        bulletSpeed: 22,
        spread: 0.035,
        magSize: 15,
        reserveAmmo: 90,
        reloadTimeMs: 1200,
        pellets: 1,
        bulletRange: 700,
        color: '#facc15',
        trailColor: 'rgba(250, 204, 21, 0.6)',
        recoilKick: 4,
        sound: 'pistol',
        laser: false,
        slot: 1
      },
      SMG: {
        id: 'smg',
        name: 'VECTOR-9',
        damage: 18,
        fireRateMs: 85,
        bulletSpeed: 24,
        spread: 0.075,
        magSize: 35,
        reserveAmmo: 210,
        reloadTimeMs: 1400,
        pellets: 1,
        bulletRange: 650,
        color: '#38bdf8',
        trailColor: 'rgba(56, 189, 248, 0.6)',
        recoilKick: 2.5,
        sound: 'smg',
        laser: false,
        slot: 2
      },
      RIFLE: {
        id: 'rifle',
        name: 'M4A1 CQB',
        damage: 34,
        fireRateMs: 135,
        bulletSpeed: 28,
        spread: 0.038,
        magSize: 30,
        reserveAmmo: 180,
        reloadTimeMs: 1800,
        pellets: 1,
        bulletRange: 900,
        color: '#fb923c',
        trailColor: 'rgba(251, 146, 60, 0.7)',
        recoilKick: 5,
        sound: 'rifle',
        laser: false,
        slot: 3
      },
      SHOTGUN: {
        id: 'shotgun',
        name: 'SPAS-12',
        damage: 17, // per pellet (x8 pellets = up to 136 dmg at point blank)
        fireRateMs: 780,
        bulletSpeed: 20,
        spread: 0.17,
        magSize: 8,
        reserveAmmo: 48,
        reloadTimeMs: 2200,
        pellets: 8,
        bulletRange: 480,
        color: '#f87171',
        trailColor: 'rgba(248, 113, 113, 0.6)',
        recoilKick: 12,
        sound: 'shotgun',
        laser: false,
        slot: 4
      },
      SNIPER: {
        id: 'sniper',
        name: 'AWP COVERT',
        damage: 110, // One-shot kill on unarmored targets
        fireRateMs: 1300,
        bulletSpeed: 38,
        spread: 0.005,
        magSize: 5,
        reserveAmmo: 25,
        reloadTimeMs: 2500,
        pellets: 1,
        bulletRange: 1400,
        color: '#c084fc',
        trailColor: 'rgba(192, 132, 252, 0.85)',
        recoilKick: 16,
        sound: 'sniper',
        laser: true,
        slot: 5
      }
    },

    ITEM_TYPES: {
      MEDKIT: { type: 'medkit', name: 'Nano Medkit', healAmount: 50, color: '#22c55e', icon: '+' },
      SHIELD: { type: 'shield', name: 'Tactical Kevlar', shieldAmount: 50, color: '#06b6d4', icon: 'S' },
      AMMO: { type: 'ammo', name: 'Ammo Cache', color: '#eab308', icon: 'A' },
      WEAPON_DROP: { type: 'weapon', name: 'Military Crate', color: '#a855f7', icon: 'W' }
    },

    PLAYER_COLORS: [
      { id: 'blue', name: 'Ghost Blue', primary: '#2563eb', secondary: '#1d4ed8', visor: '#38bdf8' },
      { id: 'red', name: 'Crimson Ops', primary: '#dc2626', secondary: '#b91c1c', visor: '#f87171' },
      { id: 'green', name: 'Viper Green', primary: '#16a34a', secondary: '#15803d', visor: '#4ade80' },
      { id: 'purple', name: 'Void Purple', primary: '#9333ea', secondary: '#7e22ce', visor: '#c084fc' },
      { id: 'orange', name: 'Apex Orange', primary: '#ea580c', secondary: '#c2410c', visor: '#fb923c' },
      { id: 'black', name: 'Shadow Black', primary: '#374151', secondary: '#1f2937', visor: '#67e8f9' }
    ]
  };

  return GameConfig;
}));
