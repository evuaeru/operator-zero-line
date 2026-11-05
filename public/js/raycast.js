/**
 * RAYCAST.JS - 2D Field of View, Line of Sight, and Dynamic Fog of War
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Raycaster = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class Raycaster {
    constructor() {
      // Reusable arrays to minimize garbage collection
      this.points = [];
      this.angles = [];
      this.explorationCanvas = null;
      this.explorationCtx = null;
      this.lastExplorationUpdate = 0;
    }

    initExploration(width, height) {
      if (typeof document !== 'undefined') {
        this.explorationCanvas = document.createElement('canvas');
        // Use 1/4 resolution for fast blur and lightweight memory footprint
        this.scale = 0.25;
        this.explorationCanvas.width = Math.ceil(width * this.scale);
        this.explorationCanvas.height = Math.ceil(height * this.scale);
        this.explorationCtx = this.explorationCanvas.getContext('2d');
        // Fill exploration with opaque black (unexplored)
        this.explorationCtx.fillStyle = 'rgba(0, 0, 0, 1)';
        this.explorationCtx.fillRect(0, 0, this.explorationCanvas.width, this.explorationCanvas.height);
      }
    }

    /**
     * Compute 2D visibility polygon from origin (ox, oy)
     */
    computeVisibilityPolygon(ox, oy, facingAngle, fovRad, range, peripheralRadius, segments) {
      const halfFov = fovRad / 2;
      const taper = 0.25;

      // Distance helper for any given angle
      function getMaxDist(ang) {
        let diff = Math.abs(ang - facingAngle);
        while (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI);
        if (diff <= halfFov) {
          return range;
        } else if (diff <= halfFov + taper) {
          const t = 1 - (diff - halfFov) / taper;
          return peripheralRadius + (range - peripheralRadius) * t;
        }
        return peripheralRadius;
      }

      const rawAngles = [];

      // 1. Uniform circular rays covering full 360 degrees (180 samples = 2 deg precision)
      const CIRCLE_SAMPLES = 180;
      for (let i = 0; i <= CIRCLE_SAMPLES; i++) {
        rawAngles.push(-Math.PI + (i / CIRCLE_SAMPLES) * 2 * Math.PI);
      }

      // 2. Cone boundary critical transition angles
      const keyAngles = [
        facingAngle - halfFov,
        facingAngle + halfFov,
        facingAngle - halfFov - taper,
        facingAngle + halfFov + taper
      ];
      for (let i = 0; i < keyAngles.length; i++) {
        rawAngles.push(keyAngles[i]);
      }

      // 3. Segment endpoints that fall within sight range
      const rangeSq = (range + 50) * (range + 50);
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];

        // Check point A
        const dxA = seg.a.x - ox;
        const dyA = seg.a.y - oy;
        if (dxA * dxA + dyA * dyA <= rangeSq) {
          const angA = Math.atan2(dyA, dxA);
          rawAngles.push(angA - 0.0001, angA, angA + 0.0001);
        }

        // Check point B
        const dxB = seg.b.x - ox;
        const dyB = seg.b.y - oy;
        if (dxB * dxB + dyB * dyB <= rangeSq) {
          const angB = Math.atan2(dyB, dxB);
          rawAngles.push(angB - 0.0001, angB, angB + 0.0001);
        }
      }

      // Normalize all angles to [-PI, PI]
      const angles = [];
      for (let i = 0; i < rawAngles.length; i++) {
        const a = Math.atan2(Math.sin(rawAngles[i]), Math.cos(rawAngles[i]));
        angles.push(a);
      }

      // Explicitly ensure both -PI and +PI boundaries exist for seamless West closure
      angles.push(-Math.PI, Math.PI);

      // Cast rays for all gathered angles
      const hits = [];
      for (let i = 0; i < angles.length; i++) {
        const ang = angles[i];
        const maxDist = getMaxDist(ang);
        const rdx = Math.cos(ang);
        const rdy = Math.sin(ang);
        const rayEnd = { x: ox + rdx * maxDist, y: oy + rdy * maxDist };

        let closestT = 1.0;
        let hitX = rayEnd.x;
        let hitY = rayEnd.y;

        // Check ray against all segments
        for (let j = 0; j < segments.length; j++) {
          const s = segments[j];
          const hit = Raycaster.raySegmentIntersection(ox, oy, rayEnd.x, rayEnd.y, s.a.x, s.a.y, s.b.x, s.b.y);
          if (hit && hit.t < closestT) {
            closestT = hit.t;
            hitX = hit.x;
            hitY = hit.y;
          }
        }

        hits.push({
          x: hitX,
          y: hitY,
          angle: ang
        });
      }

      // Sort hits by angle around (ox, oy)
      hits.sort((p1, p2) => p1.angle - p2.angle);

      // Remove near-duplicate consecutive angles
      const filteredHits = [];
      for (let i = 0; i < hits.length; i++) {
        if (i === 0 || Math.abs(hits[i].angle - hits[i - 1].angle) > 0.00002) {
          filteredHits.push(hits[i]);
        }
      }

      return filteredHits;
    }

    /**
     * Check if a specific target (tx, ty) is visible from player eye
     */
    isPointVisible(tx, ty, ox, oy, facingAngle, fovRad, range, peripheralRadius, segments) {
      const dx = tx - ox;
      const dy = ty - oy;
      const distSq = dx * dx + dy * dy;

      // In close 360-degree peripheral radius
      if (distSq <= peripheralRadius * peripheralRadius) {
        // Quick line-of-sight check to ensure no wall between them
        return !this.isLineBlocked(ox, oy, tx, ty, segments);
      }

      // Beyond vision range
      if (distSq > range * range) return false;

      // Check field of view cone
      const targetAngle = Math.atan2(dy, dx);
      let diff = Math.abs(targetAngle - facingAngle);
      while (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI);

      if (diff > fovRad / 2) return false;

      // Line of sight blocked by wall?
      return !this.isLineBlocked(ox, oy, tx, ty, segments);
    }

    isLineBlocked(x1, y1, x2, y2, segments) {
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (Raycaster.raySegmentIntersection(x1, y1, x2, y2, seg.a.x, seg.a.y, seg.b.x, seg.b.y)) {
          return true;
        }
      }
      return false;
    }

    /**
     * Fast 2D ray-segment intersection
     */
    static raySegmentIntersection(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y) {
      const s1x = p1x - p0x;
      const s1y = p1y - p0y;
      const s2x = p3x - p2x;
      const s2y = p3y - p2y;

      const denom = -s2x * s1y + s1x * s2y;
      if (Math.abs(denom) < 0.000001) return null;

      const s = (-s1y * (p0x - p2x) + s1x * (p0y - p2y)) / denom;
      const t = ( s2x * (p0y - p2y) - s2y * (p0x - p2x)) / denom;

      if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
        return {
          x: p0x + (t * s1x),
          y: p0y + (t * s1y),
          t: t
        };
      }
      return null;
    }

    /**
     * Stamp current visibility polygon into persistent exploration map
     */
    updateExploration(poly, now) {
      if (!this.explorationCtx || poly.length < 3) return;
      if (now - this.lastExplorationUpdate < 30) return; // Responsive ~33 fps stamp rate
      this.lastExplorationUpdate = now;

      const ctx = this.explorationCtx;
      const s = this.scale;

      ctx.save();
      // Cut out explored area using destination-out with 100% clearing inside direct LOS
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, 1.0)';

      ctx.beginPath();
      ctx.moveTo(poly[0].x * s, poly[0].y * s);
      for (let i = 1; i < poly.length; i++) {
        ctx.lineTo(poly[i].x * s, poly[i].y * s);
      }
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    /**
     * Render the tactical Fog of War and vision cone onto viewport canvas
     */
    renderFogOfWar(ctx, player, poly, viewX, viewY, viewW, viewH, mapW, mapH, flashlightOn) {
      if (poly.length < 3) return;

      ctx.save();

      // 1. Draw exploration shroud (fog of war memory) across world
      if (this.explorationCanvas) {
        ctx.save();
        ctx.globalAlpha = 0.90; // Unexplored territory is impenetrable black
        ctx.drawImage(
          this.explorationCanvas,
          0, 0, this.explorationCanvas.width, this.explorationCanvas.height,
          0, 0, mapW, mapH
        );
        ctx.restore();
      }

      // 2. Tactical Darkness Mask outside current direct Line-of-Sight
      // Darkens all areas of the camera viewport that are not inside the vision polygon
      ctx.save();
      ctx.beginPath();
      // Outer rect covering the current camera viewport in world space
      ctx.rect(viewX - 20, viewY - 20, viewW + 40, viewH + 40);
      // Inner visibility polygon cutout
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) {
        ctx.lineTo(poly[i].x, poly[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(7, 10, 16, 0.72)';
      ctx.fill('evenodd');
      ctx.restore();

      // 3. Volumetric Vision Cone / Flashlight Illumination
      ctx.save();
      const coneGrad = ctx.createRadialGradient(player.x, player.y, 20, player.x, player.y, player.visionRange);
      if (flashlightOn) {
        coneGrad.addColorStop(0, 'rgba(235, 245, 255, 0.16)');
        coneGrad.addColorStop(0.4, 'rgba(215, 235, 255, 0.07)');
        coneGrad.addColorStop(0.8, 'rgba(180, 210, 240, 0.02)');
        coneGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        coneGrad.addColorStop(0, 'rgba(180, 220, 255, 0.05)');
        coneGrad.addColorStop(0.6, 'rgba(120, 160, 220, 0.015)');
        coneGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }

      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) {
        ctx.lineTo(poly[i].x, poly[i].y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.restore();
    }
  }

  return Raycaster;
}));
