/**
 * MAP.JS - Tactical Arena Geometry, Obstacles, Barrels, and Collision
 * Compatible with Browser and Node.js
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GameMap = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class GameMap {
    constructor() {
      this.width = 2400;
      this.height = 1800;

      // Static wall rectangles [x, y, w, h, styleType]
      this.obstacles = [
        // Outer boundaries
        { id: 'bound_t', x: 0, y: 0, w: 2400, h: 40, type: 'wall' },
        { id: 'bound_b', x: 0, y: 1760, w: 2400, h: 40, type: 'wall' },
        { id: 'bound_l', x: 0, y: 0, w: 40, h: 1800, type: 'wall' },
        { id: 'bound_r', x: 2360, y: 0, w: 40, h: 1800, type: 'wall' },

        // Central Command Center (1000, 700 to 1400, 1100) with 4 wide doorways
        { id: 'cc_nw_h', x: 960, y: 680, w: 160, h: 30, type: 'wall' },
        { id: 'cc_ne_h', x: 1280, y: 680, w: 160, h: 30, type: 'wall' },
        { id: 'cc_sw_h', x: 960, y: 1100, w: 160, h: 30, type: 'wall' },
        { id: 'cc_se_h', x: 1280, y: 1100, w: 160, h: 30, type: 'wall' },
        { id: 'cc_w_t', x: 960, y: 710, w: 30, h: 120, type: 'wall' },
        { id: 'cc_w_b', x: 960, y: 970, w: 30, h: 130, type: 'wall' },
        { id: 'cc_e_t', x: 1410, y: 710, w: 30, h: 120, type: 'wall' },
        { id: 'cc_e_b', x: 1410, y: 970, w: 30, h: 130, type: 'wall' },

        // Command Console in Center (cover)
        { id: 'console_c', x: 1140, y: 860, w: 120, h: 80, type: 'tech_console' },

        // West Armory / Warehouse (x: 140 - 750, y: 200 - 800)
        { id: 'arm_w_1', x: 140, y: 380, w: 260, h: 30, type: 'wall' },
        { id: 'arm_w_2', x: 500, y: 380, w: 260, h: 30, type: 'wall' },
        { id: 'arm_c_1', x: 240, y: 180, w: 80, h: 120, type: 'crate_stack' },
        { id: 'arm_c_2', x: 420, y: 180, w: 80, h: 120, type: 'crate_stack' },
        { id: 'arm_c_3', x: 600, y: 180, w: 80, h: 120, type: 'crate_stack' },
        { id: 'arm_w_vert', x: 730, y: 410, w: 30, h: 360, type: 'wall' },

        // South-West Reactor Room (x: 160 - 750, y: 1050 - 1650)
        { id: 'react_w_top', x: 160, y: 1050, w: 320, h: 30, type: 'wall' },
        { id: 'react_core', x: 380, y: 1280, w: 140, h: 140, type: 'reactor' },
        { id: 'react_c_1', x: 200, y: 1480, w: 90, h: 60, type: 'crate' },
        { id: 'react_c_2', x: 620, y: 1200, w: 70, h: 140, type: 'crate_stack' },

        // North Tactical Chokepoint & Pillars
        { id: 'n_pillar_1', x: 920, y: 320, w: 60, h: 60, type: 'pillar' },
        { id: 'n_pillar_2', x: 1420, y: 320, w: 60, h: 60, type: 'pillar' },
        { id: 'n_cover_1', x: 1110, y: 220, w: 180, h: 40, type: 'sandbag' },
        { id: 'n_wall_top', x: 1000, y: 40, w: 400, h: 30, type: 'wall' },

        // East Laboratory Complex (x: 1650 - 2260, y: 200 - 900)
        { id: 'lab_w_vert', x: 1640, y: 160, w: 30, h: 420, type: 'wall' },
        { id: 'lab_w_h', x: 1640, y: 580, w: 460, h: 30, type: 'wall' },
        { id: 'lab_desk_1', x: 1800, y: 300, w: 160, h: 60, type: 'tech_console' },
        { id: 'lab_desk_2', x: 2050, y: 300, w: 160, h: 60, type: 'tech_console' },
        { id: 'lab_c_1', x: 1840, y: 720, w: 80, h: 80, type: 'crate' },
        { id: 'lab_c_2', x: 2020, y: 720, w: 80, h: 80, type: 'crate' },

        // South-East Cargo Bay & Storage
        { id: 'se_w_1', x: 1560, y: 1200, w: 30, h: 420, type: 'wall' },
        { id: 'se_w_2', x: 1720, y: 1360, w: 420, h: 30, type: 'wall' },
        { id: 'se_c_big_1', x: 1850, y: 1100, w: 140, h: 80, type: 'crate_stack' },
        { id: 'se_c_big_2', x: 2060, y: 1100, w: 140, h: 80, type: 'crate_stack' },
        { id: 'se_c_3', x: 1880, y: 1520, w: 100, h: 100, type: 'crate' },

        // South Chokepoint & Barricades
        { id: 's_barr_1', x: 1040, y: 1450, w: 140, h: 40, type: 'sandbag' },
        { id: 's_barr_2', x: 1220, y: 1450, w: 140, h: 40, type: 'sandbag' },
        { id: 's_pillar', x: 1170, y: 1600, w: 60, h: 60, type: 'pillar' }
      ];

      // Explosive hazard barrels [id, x, y, radius, hp, maxHp]
      this.barrels = [
        { id: 'b1', x: 860, y: 640, r: 20, hp: 35, exploded: false },
        { id: 'b2', x: 900, y: 640, r: 20, hp: 35, exploded: false },
        { id: 'b3', x: 1500, y: 640, r: 20, hp: 35, exploded: false },
        { id: 'b4', x: 300, y: 1010, r: 20, hp: 35, exploded: false },
        { id: 'b5', x: 340, y: 1010, r: 20, hp: 35, exploded: false },
        { id: 'b6', x: 1600, y: 1140, r: 20, hp: 35, exploded: false },
        { id: 'b7', x: 1640, y: 1140, r: 20, hp: 35, exploded: false },
        { id: 'b8', x: 1140, y: 1380, r: 20, hp: 35, exploded: false },
        { id: 'b9', x: 1240, y: 1380, r: 20, hp: 35, exploded: false },
        { id: 'b10', x: 2160, y: 670, r: 20, hp: 35, exploded: false }
      ];

      // Item Spawn Points
      this.itemSpawns = [
        { id: 'sp_med_1', x: 1200, y: 740, type: 'medkit', respawnTime: 20000, active: true },
        { id: 'sp_shd_1', x: 1200, y: 1020, type: 'shield', respawnTime: 25000, active: true },
        { id: 'sp_ammo_1', x: 200, y: 240, type: 'ammo', respawnTime: 15000, active: true },
        { id: 'sp_ammo_2', x: 2200, y: 240, type: 'ammo', respawnTime: 15000, active: true },
        { id: 'sp_ammo_3', x: 2200, y: 1650, type: 'ammo', respawnTime: 15000, active: true },
        { id: 'sp_ammo_4', x: 200, y: 1650, type: 'ammo', respawnTime: 15000, active: true },
        { id: 'sp_wpn_shotgun', x: 480, y: 600, type: 'weapon', weapon: 'SHOTGUN', respawnTime: 30000, active: true },
        { id: 'sp_wpn_sniper', x: 1980, y: 440, type: 'weapon', weapon: 'SNIPER', respawnTime: 35000, active: true },
        { id: 'sp_wpn_smg', x: 1950, y: 1450, type: 'weapon', weapon: 'SMG', respawnTime: 25000, active: true },
        { id: 'sp_wpn_rifle', x: 450, y: 1500, type: 'weapon', weapon: 'RIFLE', respawnTime: 30000, active: true }
      ];

      // Player Spawn Points
      this.spawnPoints = [
        { x: 160, y: 160, angle: 0.78 },
        { x: 2240, y: 160, angle: 2.35 },
        { x: 160, y: 1640, angle: -0.78 },
        { x: 2240, y: 1640, angle: -2.35 },
        { x: 1200, y: 180, angle: 1.57 },
        { x: 1200, y: 1620, angle: -1.57 },
        { x: 600, y: 900, angle: 0 },
        { x: 1800, y: 900, angle: 3.14 }
      ];

      // Pre-extract segments for fast 2D raycasting & visibility
      this.segments = this.extractSegments();
    }

    extractSegments() {
      const segs = [];

      // Extract 4 edges for each obstacle box
      for (const obs of this.obstacles) {
        const x1 = obs.x;
        const y1 = obs.y;
        const x2 = obs.x + obs.w;
        const y2 = obs.y + obs.h;

        segs.push({ a: { x: x1, y: y1 }, b: { x: x2, y: y1 }, obstacleId: obs.id });
        segs.push({ a: { x: x2, y: y1 }, b: { x: x2, y: y2 }, obstacleId: obs.id });
        segs.push({ a: { x: x2, y: y2 }, b: { x: x1, y: y2 }, obstacleId: obs.id });
        segs.push({ a: { x: x1, y: y2 }, b: { x: x1, y: y1 }, obstacleId: obs.id });
      }

      // Add barrels as small 4-edge boxes for raycasting
      for (const b of this.barrels) {
        if (b.exploded) continue;
        const r = b.r;
        segs.push({ a: { x: b.x - r, y: b.y - r }, b: { x: b.x + r, y: b.y - r } });
        segs.push({ a: { x: b.x + r, y: b.y - r }, b: { x: b.x + r, y: b.y + r } });
        segs.push({ a: { x: b.x + r, y: b.y + r }, b: { x: b.x - r, y: b.y + r } });
        segs.push({ a: { x: b.x - r, y: b.y + r }, b: { x: b.x - r, y: b.y - r } });
      }

      return segs;
    }

    rebuildSegments() {
      this.segments = this.extractSegments();
    }

    getRandomSpawnPoint() {
      const idx = Math.floor(Math.random() * this.spawnPoints.length);
      const sp = this.spawnPoints[idx];
      // Add slight jitter
      return {
        x: sp.x + (Math.random() * 60 - 30),
        y: sp.y + (Math.random() * 60 - 30),
        angle: sp.angle
      };
    }

    /**
     * Resolve circle collision with obstacles (Sliding collision)
     */
    resolveCircleCollision(circleX, circleY, radius) {
      let resolvedX = circleX;
      let resolvedY = circleY;

      // 1. Clamp within map boundaries (40px wall thickness)
      const minX = 40 + radius;
      const maxX = this.width - 40 - radius;
      const minY = 40 + radius;
      const maxY = this.height - 40 - radius;

      resolvedX = Math.max(minX, Math.min(resolvedX, maxX));
      resolvedY = Math.max(minY, Math.min(resolvedY, maxY));

      // 2. Check interior obstacles (skip the 4 outer boundary walls)
      for (const obs of this.obstacles) {
        if (obs.id.startsWith('bound_')) continue;

        const closestX = Math.max(obs.x, Math.min(resolvedX, obs.x + obs.w));
        const closestY = Math.max(obs.y, Math.min(resolvedY, obs.y + obs.h));

        const distX = resolvedX - closestX;
        const distY = resolvedY - closestY;
        const distSq = distX * distX + distY * distY;

        if (distSq < radius * radius) {
          const dist = Math.sqrt(distSq);
          if (dist === 0) {
            // Inside obstacle, push towards nearest edge
            const dLeft = resolvedX - obs.x;
            const dRight = (obs.x + obs.w) - resolvedX;
            const dTop = resolvedY - obs.y;
            const dBottom = (obs.y + obs.h) - resolvedY;
            const minD = Math.min(dLeft, dRight, dTop, dBottom);
            if (minD === dLeft) resolvedX = obs.x - radius;
            else if (minD === dRight) resolvedX = obs.x + obs.w + radius;
            else if (minD === dTop) resolvedY = obs.y - radius;
            else resolvedY = obs.y + obs.h + radius;
          } else {
            const overlap = radius - dist;
            resolvedX += (distX / dist) * overlap;
            resolvedY += (distY / dist) * overlap;
          }
        }
      }

      // 3. Check unexploded barrels
      for (const b of this.barrels) {
        if (b.exploded) continue;
        const dx = resolvedX - b.x;
        const dy = resolvedY - b.y;
        const minDistance = radius + b.r;
        const distSq = dx * dx + dy * dy;

        if (distSq < minDistance * minDistance && distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const overlap = minDistance - dist;
          resolvedX += (dx / dist) * overlap;
          resolvedY += (dy / dist) * overlap;
        }
      }

      // Re-clamp just in case pushing from an obstacle pushed towards boundary
      resolvedX = Math.max(minX, Math.min(resolvedX, maxX));
      resolvedY = Math.max(minY, Math.min(resolvedY, maxY));

      return { x: resolvedX, y: resolvedY };
    }

    /**
     * Check if a line segment intersects any map obstacle
     */
    isLineBlocked(x1, y1, x2, y2) {
      for (const seg of this.segments) {
        if (GameMap.lineIntersection(x1, y1, x2, y2, seg.a.x, seg.a.y, seg.b.x, seg.b.y)) {
          return true;
        }
      }
      return false;
    }

    static lineIntersection(p0_x, p0_y, p1_x, p1_y, p2_x, p2_y, p3_x, p3_y) {
      const s1_x = p1_x - p0_x;
      const s1_y = p1_y - p0_y;
      const s2_x = p3_x - p2_x;
      const s2_y = p3_y - p2_y;

      const denom = -s2_x * s1_y + s1_x * s2_y;
      if (Math.abs(denom) < 0.000001) return null;

      const s = (-s1_y * (p0_x - p2_x) + s1_x * (p0_y - p2_y)) / denom;
      const t = ( s2_x * (p0_y - p2_y) - s2_y * (p0_x - p2_x)) / denom;

      if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
        return {
          x: p0_x + (t * s1_x),
          y: p0_y + (t * s1_y),
          param: t
        };
      }
      return null;
    }
  }

  return GameMap;
}));
