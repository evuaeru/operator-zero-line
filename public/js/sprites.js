/**
 * SPRITES.JS - High-Fidelity Tactical Asset & Sprite Generator
 * Generates custom crisp top-down soldier sprites, weapons, props, decals, and textures
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SpriteRenderer = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class SpriteRenderer {
    constructor() {
      this.cache = new Map();
      this.bloodDecals = [];
      this.bulletHoles = [];
      this.shellCasings = [];
      this.initCommonSprites();
    }

    createCanvas(w, h) {
      if (typeof document === 'undefined') return null;
      const cvs = document.createElement('canvas');
      cvs.width = w;
      cvs.height = h;
      return cvs;
    }

    initCommonSprites() {
      if (typeof document === 'undefined') return;
      this.cacheFloorTile();
      this.cacheCrate();
      this.cacheCrateStack();
      this.cacheBarrel();
      this.cacheExplodedBarrel();
      this.cacheTechConsole();
      this.cacheSandbag();
      this.cacheMuzzleFlashes();
    }

    /* =========================================================================
       ENVIRONMENT & PROPS SPRITES
       ========================================================================= */

    cacheFloorTile() {
      const size = 120;
      const cvs = this.createCanvas(size, size);
      const ctx = cvs.getContext('2d');

      // Base bunker tile
      ctx.fillStyle = '#11151c';
      ctx.fillRect(0, 0, size, size);

      // Tile grid border
      ctx.strokeStyle = '#1a2230';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, size - 2, size - 2);

      // Sub-grid lines
      ctx.strokeStyle = '#151c27';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size);
      ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2);
      ctx.stroke();

      // Corner rivets / bolts
      ctx.fillStyle = '#2a3447';
      const r = 2;
      const pad = 8;
      [[pad, pad], [size - pad, pad], [pad, size - pad], [size - pad, size - pad]].forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      });

      this.cache.set('floor_tile', cvs);
    }

    cacheCrate() {
      const size = 80;
      const cvs = this.createCanvas(size, size);
      const ctx = cvs.getContext('2d');

      // Drop shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(4, 4, size - 4, size - 4);

      // Crate body (Tactical Olive / Steel)
      const grad = ctx.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0, '#3f4e3c');
      grad.addColorStop(1, '#273325');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      // Steel reinforcement bevels
      ctx.strokeStyle = '#1a2219';
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, size - 4, size - 4);

      // Diagonal cross bracing
      ctx.strokeStyle = '#4e614a';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(10, 10); ctx.lineTo(size - 10, size - 10);
      ctx.moveTo(size - 10, 10); ctx.lineTo(10, size - 10);
      ctx.stroke();

      // Metal corner brackets
      ctx.fillStyle = '#1c241b';
      const cs = 14;
      ctx.fillRect(0, 0, cs, cs);
      ctx.fillRect(size - cs, 0, cs, cs);
      ctx.fillRect(0, size - cs, cs, cs);
      ctx.fillRect(size - cs, size - cs, cs, cs);

      // Corner rivets
      ctx.fillStyle = '#8ca387';
      [[4, 4], [size - 6, 4], [4, size - 6], [size - 6, size - 6]].forEach(([x, y]) => {
        ctx.fillRect(x, y, 3, 3);
      });

      // Warning Stencil
      ctx.fillStyle = '#eab308';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SUPPLY', size / 2, size / 2 + 3);

      this.cache.set('crate', cvs);
    }

    cacheCrateStack() {
      const w = 140, h = 80;
      const cvs = this.createCanvas(w, h);
      const ctx = cvs.getContext('2d');

      // Drop shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(6, 6, w - 6, h - 6);

      // Large shipping container
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#1e293b');
      grad.addColorStop(0.5, '#334155');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Corrugated ridges
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      for (let x = 12; x < w - 10; x += 12) {
        ctx.beginPath();
        ctx.moveTo(x, 4);
        ctx.lineTo(x, h - 4);
        ctx.stroke();
      }

      // Outer heavy metal border
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, w - 4, h - 4);

      // Hazard Caution stripes along top edge
      ctx.save();
      ctx.beginPath();
      ctx.rect(4, 4, w - 8, 12);
      ctx.clip();
      ctx.fillStyle = '#eab308';
      ctx.fillRect(4, 4, w - 8, 12);
      ctx.fillStyle = '#0f172a';
      for (let x = -20; x < w + 20; x += 14) {
        ctx.beginPath();
        ctx.moveTo(x, 4);
        ctx.lineTo(x + 10, 4);
        ctx.lineTo(x + 2, 16);
        ctx.lineTo(x - 8, 16);
        ctx.fill();
      }
      ctx.restore();

      this.cache.set('crate_stack', cvs);
    }

    cacheBarrel() {
      const r = 20;
      const size = (r + 4) * 2;
      const cvs = this.createCanvas(size, size);
      const ctx = cvs.getContext('2d');
      const cx = size / 2, cy = size / 2;

      // Drop shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.arc(cx + 3, cy + 3, r, 0, Math.PI * 2);
      ctx.fill();

      // Red explosive barrel body
      const grad = ctx.createRadialGradient(cx - 5, cy - 5, 2, cx, cy, r);
      grad.addColorStop(0, '#ef4444');
      grad.addColorStop(0.7, '#b91c1c');
      grad.addColorStop(1, '#7f1d1d');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // Steel reinforcement ribs
      ctx.strokeStyle = '#450a0a';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Inner rim
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r - 5, 0, Math.PI * 2);
      ctx.stroke();

      // Biohazard / Explosive triangle logo
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 7);
      ctx.lineTo(cx + 6, cy + 4);
      ctx.lineTo(cx - 6, cy + 4);
      ctx.closePath();
      ctx.fill();

      // Center exclamation point
      ctx.fillStyle = '#000000';
      ctx.fillRect(cx - 1, cy - 4, 2, 4);
      ctx.fillRect(cx - 1, cy + 1, 2, 2);

      this.cache.set('barrel', cvs);
    }

    cacheExplodedBarrel() {
      const r = 24;
      const size = r * 2;
      const cvs = this.createCanvas(size, size);
      const ctx = cvs.getContext('2d');
      const cx = size / 2, cy = size / 2;

      // Charred, torn metal rim on ground
      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      ctx.arc(cx, cy, r - 4, 0, Math.PI * 2);
      ctx.fill();

      // Jagged metal edges
      ctx.strokeStyle = '#3f3f46';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2;
        const dist = r - 5 + (i % 2 === 0 ? 3 : -3);
        const x = cx + Math.cos(ang) * dist;
        const y = cy + Math.sin(ang) * dist;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();

      // Scorched ash inside
      const ashGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, r - 6);
      ashGrad.addColorStop(0, '#451a03');
      ashGrad.addColorStop(0.6, '#1c1917');
      ashGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ashGrad;
      ctx.fill();

      this.cache.set('barrel_exploded', cvs);
    }

    cacheTechConsole() {
      const w = 120, h = 80;
      const cvs = this.createCanvas(w, h);
      const ctx = cvs.getContext('2d');

      // Console chassis
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      ctx.strokeRect(1, 1, w - 2, h - 2);

      // Glowing radar / monitor screens
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(10, 10, 45, 60);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1;
      ctx.strokeRect(10, 10, 45, 60);

      // Waveform / Radar sweep
      ctx.beginPath();
      ctx.arc(32, 40, 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(32, 40); ctx.lineTo(44, 30);
      ctx.stroke();

      // Secondary Tactical Screen
      ctx.fillStyle = '#172554';
      ctx.fillRect(65, 10, 45, 60);
      ctx.strokeStyle = '#38bdf8';
      ctx.strokeRect(65, 10, 45, 60);

      // Server LED indicators
      ctx.fillStyle = '#ef4444'; ctx.fillRect(15, 62, 3, 3);
      ctx.fillStyle = '#10b981'; ctx.fillRect(22, 62, 3, 3);
      ctx.fillStyle = '#38bdf8'; ctx.fillRect(29, 62, 3, 3);

      this.cache.set('tech_console', cvs);
    }

    cacheSandbag() {
      const w = 140, h = 40;
      const cvs = this.createCanvas(w, h);
      const ctx = cvs.getContext('2d');

      // Canvas fabric texture
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#78716c');
      grad.addColorStop(0.5, '#a8a29e');
      grad.addColorStop(1, '#57534e');
      ctx.fillStyle = grad;

      // Rounded sandbag segments
      for (let x = 6; x < w - 20; x += 32) {
        ctx.beginPath();
        ctx.roundRect(x, 4, 34, h - 8, 8);
        ctx.fill();
        ctx.strokeStyle = '#44403c';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Stitching
        ctx.strokeStyle = '#292524';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 17, 8);
        ctx.lineTo(x + 17, h - 8);
        ctx.stroke();
      }

      this.cache.set('sandbag', cvs);
    }

    cacheMuzzleFlashes() {
      const size = 64;
      const cvs = this.createCanvas(size, size);
      const ctx = cvs.getContext('2d');
      const cx = size / 2, cy = size / 2;

      // Radial burst
      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 28);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.2, '#fef08a');
      grad.addColorStop(0.6, '#f97316');
      grad.addColorStop(1, 'rgba(239, 68, 68, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, 28, 0, Math.PI * 2);
      ctx.fill();

      // Sharp starburst spikes
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(ang) * 30, cy + Math.sin(ang) * 30);
        ctx.lineTo(cx + Math.cos(ang + 0.2) * 8, cy + Math.sin(ang + 0.2) * 8);
        ctx.closePath();
        ctx.fill();
      }

      this.cache.set('muzzle_flash', cvs);
    }

    /* =========================================================================
       DYNAMIC CHARACTER (SOLDIER) RENDERING
       ========================================================================= */

    /**
     * Render a tactical soldier with animated legs, armor, helmet, visor glow, and weapon
     */
    renderSoldier(ctx, x, y, angle, colorData, weaponConfig, walkCycle, isShooting, isDead) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      if (isDead) {
        // Dead operator on floor
        this.renderCorpse(ctx, colorData);
        ctx.restore();
        return;
      }

      // 1. Soft Character Drop Shadow
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 4, 22, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 2. Animated Tactical Boots (Legs)
      this.renderLegs(ctx, walkCycle);

      // 3. Tactical Body Armor / Vest
      this.renderTorso(ctx, colorData);

      // 4. Arms & Hands holding weapon
      this.renderArmsAndWeapon(ctx, colorData, weaponConfig, isShooting);

      // 5. Tactical Ops-Core Helmet, Headset, and Glowing Visor
      this.renderHelmet(ctx, colorData);

      ctx.restore();
    }

    renderLegs(ctx, walkCycle) {
      const legStride = Math.sin(walkCycle) * 9;
      const legWidth = 15;
      const legHeight = 7;

      ctx.fillStyle = '#1e293b'; // Tactical pants
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;

      // Left leg
      ctx.save();
      ctx.translate(-legStride - 4, -10);
      ctx.beginPath();
      ctx.roundRect(-legWidth / 2, -legHeight / 2, legWidth, legHeight, 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#090d16';
      ctx.fillRect(legWidth / 2 - 3, -legHeight / 2, 3, legHeight);
      ctx.restore();

      // Right leg
      ctx.save();
      ctx.translate(legStride - 4, 10);
      ctx.beginPath();
      ctx.roundRect(-legWidth / 2, -legHeight / 2, legWidth, legHeight, 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#090d16';
      ctx.fillRect(legWidth / 2 - 3, -legHeight / 2, 3, legHeight);
      ctx.restore();
    }

    renderTorso(ctx, colorData) {
      const primary = colorData.primary || '#2563eb';
      const secondary = colorData.secondary || '#1d4ed8';

      // Shoulder armor pads
      ctx.fillStyle = secondary;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;

      // Left shoulder
      ctx.beginPath();
      ctx.roundRect(-8, -19, 14, 8, 3);
      ctx.fill();
      ctx.stroke();

      // Right shoulder
      ctx.beginPath();
      ctx.roundRect(-8, 11, 14, 8, 3);
      ctx.fill();
      ctx.stroke();

      // Tactical Vest Body
      const vestGrad = ctx.createLinearGradient(-14, 0, 14, 0);
      vestGrad.addColorStop(0, secondary);
      vestGrad.addColorStop(0.5, primary);
      vestGrad.addColorStop(1, secondary);
      ctx.fillStyle = vestGrad;
      ctx.beginPath();
      ctx.roundRect(-12, -13, 24, 26, 6);
      ctx.fill();
      ctx.stroke();

      // Tactical vest webbing / molle pouches
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-4, -8, 10, 5);
      ctx.fillRect(-4, 3, 10, 5);

      // Radio antenna on left shoulder
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-4, -12);
      ctx.lineTo(-12, -18);
      ctx.stroke();
    }

    renderArmsAndWeapon(ctx, colorData, weapon, isShooting) {
      const recoilOffset = isShooting ? -(weapon.recoilKick || 3) : 0;

      ctx.save();
      ctx.translate(recoilOffset, 0);

      // Draw Weapon Model
      this.renderWeaponModel(ctx, weapon, isShooting);

      // Draw Tactical Operator Hands / Gloves gripping the weapon
      ctx.fillStyle = '#334155'; // Glove body
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;

      // Left hand (foregrip / barrel hold)
      ctx.beginPath();
      ctx.arc(18, 4, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Right hand (trigger hold)
      ctx.beginPath();
      ctx.arc(8, 7, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Forearm links to shoulders
      ctx.strokeStyle = colorData.primary || '#2563eb';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, -14); ctx.lineTo(18, 4); // Left arm
      ctx.moveTo(0, 14);  ctx.lineTo(8, 7);   // Right arm
      ctx.stroke();

      ctx.restore();
    }

    renderWeaponModel(ctx, weapon, isShooting) {
      const wId = (weapon && weapon.id) || 'rifle';

      ctx.save();
      ctx.translate(6, 6); // Weapon position relative to operator center

      if (wId === 'pistol') {
        // Compact Tactical Handgun
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, -2, 18, 4);
        ctx.fillStyle = '#64748b'; // Slide
        ctx.fillRect(6, -1.5, 12, 3);
      } else if (wId === 'smg') {
        // Compact Submachine Gun (Vector style)
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-4, -3, 26, 6);
        ctx.fillStyle = '#38bdf8'; // Cyan accent
        ctx.fillRect(4, -2, 4, 4);
        // Curved Magazine
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(8, 2, 10, 4);
      } else if (wId === 'shotgun') {
        // Heavy Shotgun with Pump
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-2, -3, 28, 6);
        // Dual barrel / tube
        ctx.fillStyle = '#475569';
        ctx.fillRect(12, -2.5, 16, 5);
        // Orange pump grip
        ctx.fillStyle = '#ea580c';
        ctx.fillRect(14, -3.5, 8, 7);
      } else if (wId === 'sniper') {
        // High-Precision AMR Rifle
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-6, -3, 38, 6);
        // Long heavy fluted barrel
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(16, -1.5, 26, 3);
        // Muzzle brake
        ctx.fillStyle = '#334155';
        ctx.fillRect(38, -3, 6, 6);
        // Scope mount
        ctx.fillStyle = '#c084fc';
        ctx.fillRect(4, -2, 10, 4);
      } else {
        // M4A1 Assault Rifle
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-4, -2.5, 30, 5);
        // Receiver & Handguard
        ctx.fillStyle = '#334155';
        ctx.fillRect(4, -2, 16, 4);
        // Curved 30-round STANAG mag
        ctx.fillStyle = '#64748b';
        ctx.fillRect(6, 2, 8, 3);
        // Barrel & Flash hider
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(20, -1.5, 12, 3);
      }

      // Laser Sight beam if equipped
      if (weapon && weapon.laser) {
        ctx.save();
        ctx.strokeStyle = 'rgba(216, 70, 239, 0.75)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(38, 0);
        ctx.lineTo(420, 0);
        ctx.stroke();

        // Target laser dot
        ctx.fillStyle = '#f43f5e';
        ctx.shadowColor = '#f43f5e';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(420, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Muzzle flash on firing
      if (isShooting) {
        const flashCvs = this.cache.get('muzzle_flash');
        if (flashCvs) {
          const barrelTipX = wId === 'sniper' ? 44 : (wId === 'shotgun' ? 30 : 28);
          ctx.save();
          ctx.translate(barrelTipX, 0);
          ctx.rotate(Math.random() * Math.PI);
          ctx.drawImage(flashCvs, -16, -16, 32, 32);
          ctx.restore();
        }
      }

      ctx.restore();
    }

    renderHelmet(ctx, colorData) {
      const visorColor = colorData.visor || '#38bdf8';

      // Ballistic Ops-Core Helmet
      const helmetGrad = ctx.createRadialGradient(-2, 0, 2, 0, 0, 12);
      helmetGrad.addColorStop(0, '#334155');
      helmetGrad.addColorStop(0.8, '#1e293b');
      helmetGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = helmetGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Tactical Headset / Ear Protectors
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-4, -13, 8, 3);
      ctx.fillRect(-4, 10, 8, 3);

      // Glowing Tactical Visor / NVG Goggles
      ctx.save();
      ctx.fillStyle = visorColor;
      ctx.shadowColor = visorColor;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.roundRect(6, -6, 4, 12, 2);
      ctx.fill();
      ctx.restore();
    }

    renderCorpse(ctx, colorData) {
      // Blood pool under dead soldier
      ctx.fillStyle = 'rgba(153, 27, 27, 0.7)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 26, 20, 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Slumped soldier body
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(-10, -12, 20, 24, 6);
      ctx.fill();

      // Helmet knocked askew
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(6, 8, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    /* =========================================================================
       DECALS & EFFECTS (BLOOD, CASINGS, BULLET HOLES)
       ========================================================================= */

    addBloodDecal(x, y) {
      if (this.bloodDecals.length > 80) this.bloodDecals.shift();
      const drops = [];
      const numDrops = 5 + Math.floor(Math.random() * 6);
      for (let i = 0; i < numDrops; i++) {
        const dist = 5 + Math.random() * 25;
        const ang = Math.random() * Math.PI * 2;
        drops.push({
          dx: Math.cos(ang) * dist,
          dy: Math.sin(ang) * dist,
          r: 1.5 + Math.random() * 3.5
        });
      }
      this.bloodDecals.push({
        x: x,
        y: y,
        mainRadius: 8 + Math.random() * 10,
        drops: drops,
        alpha: 0.8
      });
    }

    addShellCasing(x, y, angle, type) {
      if (this.shellCasings.length > 50) this.shellCasings.shift();
      const ejectAngle = angle + (Math.PI / 2) + (Math.random() * 0.4 - 0.2);
      const speed = 2 + Math.random() * 2;
      this.shellCasings.push({
        x: x,
        y: y,
        vx: Math.cos(ejectAngle) * speed,
        vy: Math.sin(ejectAngle) * speed,
        angle: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.4,
        type: type || 'brass',
        lifetime: 300 // frames
      });
    }

    updateShellCasings() {
      for (let i = this.shellCasings.length - 1; i >= 0; i--) {
        const sc = this.shellCasings[i];
        sc.x += sc.vx;
        sc.y += sc.vy;
        sc.vx *= 0.88; // friction
        sc.vy *= 0.88;
        sc.angle += sc.vRot;
        sc.vRot *= 0.9;
        sc.lifetime--;
        if (sc.lifetime <= 0) {
          this.shellCasings.splice(i, 1);
        }
      }
    }

    renderDecals(ctx, viewX, viewY, viewW, viewH) {
      // 1. Render permanent blood splatters (World coordinates)
      ctx.save();
      for (let i = 0; i < this.bloodDecals.length; i++) {
        const b = this.bloodDecals[i];
        if (b.x < viewX - 50 || b.x > viewX + viewW + 50 || b.y < viewY - 50 || b.y > viewY + viewH + 50) continue;

        ctx.fillStyle = `rgba(136, 19, 19, ${b.alpha})`;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.mainRadius, 0, Math.PI * 2);
        ctx.fill();

        for (let j = 0; j < b.drops.length; j++) {
          const d = b.drops[j];
          ctx.beginPath();
          ctx.arc(b.x + d.dx, b.y + d.dy, d.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // 2. Render spent brass shell casings (World coordinates)
      ctx.save();
      for (let i = 0; i < this.shellCasings.length; i++) {
        const sc = this.shellCasings[i];
        if (sc.x < viewX - 20 || sc.x > viewX + viewW + 20 || sc.y < viewY - 20 || sc.y > viewY + viewH + 20) continue;

        ctx.save();
        ctx.translate(sc.x, sc.y);
        ctx.rotate(sc.angle);
        ctx.fillStyle = sc.type === 'shotgun' ? '#dc2626' : '#eab308';
        ctx.fillRect(-1.5, -3, 3, 6);
        ctx.strokeStyle = '#713f12';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(-1.5, -3, 3, 6);
        ctx.restore();
      }
      ctx.restore();
    }

    /* =========================================================================
       WORLD MAP DRAWING
       ========================================================================= */

    renderMap(ctx, map, viewX, viewY, viewW, viewH) {
      // 1. Tiled floor background (World coordinates)
      const floorCvs = this.cache.get('floor_tile');
      if (floorCvs) {
        const tileSize = floorCvs.width;
        const startX = Math.floor(viewX / tileSize) * tileSize;
        const startY = Math.floor(viewY / tileSize) * tileSize;

        for (let x = startX; x < viewX + viewW + tileSize; x += tileSize) {
          for (let y = startY; y < viewY + viewH + tileSize; y += tileSize) {
            if (x >= 0 && x < map.width && y >= 0 && y < map.height) {
              ctx.drawImage(floorCvs, x, y);
            }
          }
        }
      }

      // 2. Render Obstacles (World coordinates)
      for (let i = 0; i < map.obstacles.length; i++) {
        const obs = map.obstacles[i];
        if (obs.x + obs.w < viewX - 50 || obs.x > viewX + viewW + 50 ||
            obs.y + obs.h < viewY - 50 || obs.y > viewY + viewH + 50) continue;

        if (obs.type === 'crate') {
          const crateCvs = this.cache.get('crate');
          if (crateCvs) {
            ctx.drawImage(crateCvs, 0, 0, crateCvs.width, crateCvs.height, obs.x, obs.y, obs.w, obs.h);
          }
        } else if (obs.type === 'crate_stack') {
          const stackCvs = this.cache.get('crate_stack');
          if (stackCvs) {
            ctx.drawImage(stackCvs, 0, 0, stackCvs.width, stackCvs.height, obs.x, obs.y, obs.w, obs.h);
          }
        } else if (obs.type === 'sandbag') {
          const sandbagCvs = this.cache.get('sandbag');
          if (sandbagCvs) {
            ctx.drawImage(sandbagCvs, 0, 0, sandbagCvs.width, sandbagCvs.height, obs.x, obs.y, obs.w, obs.h);
          }
        } else if (obs.type === 'tech_console') {
          const consoleCvs = this.cache.get('tech_console');
          if (consoleCvs) {
            ctx.drawImage(consoleCvs, 0, 0, consoleCvs.width, consoleCvs.height, obs.x, obs.y, obs.w, obs.h);
          }
        } else {
          // Reinforced Wall (Boundary or Interior)
          ctx.save();
          // Wall drop shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.fillRect(obs.x + 5, obs.y + 5, obs.w, obs.h);

          // Wall fill
          const wallGrad = ctx.createLinearGradient(obs.x, obs.y, obs.x + obs.w, obs.y + obs.h);
          wallGrad.addColorStop(0, '#1e293b');
          wallGrad.addColorStop(1, '#0f172a');
          ctx.fillStyle = wallGrad;
          ctx.fillRect(obs.x, obs.y, obs.w, obs.h);

          // Wall border / bevel
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 2;
          ctx.strokeRect(obs.x + 1, obs.y + 1, obs.w - 2, obs.h - 2);

          // Inner hazard or tech stripe if wall is large enough
          if (obs.w >= 80 && obs.h >= 24) {
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(obs.x + 10, obs.y + obs.h / 2);
            ctx.lineTo(obs.x + obs.w - 10, obs.y + obs.h / 2);
            ctx.stroke();
          }

          ctx.restore();
        }
      }

      // 3. Render Barrels (World coordinates)
      for (let i = 0; i < map.barrels.length; i++) {
        const b = map.barrels[i];
        if (b.x + 30 < viewX || b.x - 30 > viewX + viewW ||
            b.y + 30 < viewY || b.y - 30 > viewY + viewH) continue;

        const barrelKey = b.exploded ? 'barrel_exploded' : 'barrel';
        const barrelCvs = this.cache.get(barrelKey);
        if (barrelCvs) {
          ctx.drawImage(barrelCvs, b.x - barrelCvs.width / 2, b.y - barrelCvs.height / 2);
        }
      }

      // 4. Render Item Pickups (World coordinates)
      for (let i = 0; i < map.itemSpawns.length; i++) {
        const item = map.itemSpawns[i];
        if (!item.active) continue;
        if (item.x + 30 < viewX || item.x - 30 > viewX + viewW ||
            item.y + 30 < viewY || item.y - 30 > viewY + viewH) continue;

        this.renderItemPickup(ctx, item.x, item.y, item);
      }
    }

    renderItemPickup(ctx, x, y, item) {
      const now = performance.now();
      const floatY = Math.sin(now * 0.004) * 3;
      const pulse = 1 + Math.sin(now * 0.006) * 0.15;

      ctx.save();
      ctx.translate(x, y + floatY);

      // Glowing Aura
      const color = item.type === 'medkit' ? '#22c55e' :
                    item.type === 'shield' ? '#06b6d4' :
                    item.type === 'ammo'   ? '#eab308' : '#c084fc';

      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 12 * pulse;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 16 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Item icon background badge
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();

      // Icon symbol
      ctx.fillStyle = color;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      let label = '+';
      if (item.type === 'shield') label = 'S';
      else if (item.type === 'ammo') label = 'A';
      else if (item.type === 'weapon') label = 'W';

      ctx.fillText(label, 0, 0);

      ctx.restore();
    }
  }

  return SpriteRenderer;
}));

