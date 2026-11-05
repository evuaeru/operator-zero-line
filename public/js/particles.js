/**
 * PARTICLES.JS - Visual FX: Bullet Tracers, Wall Sparks, Blood Bursts, Explosions & Floating Damage Numbers
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ParticleSystem = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class ParticleSystem {
    constructor() {
      this.particles = [];
      this.damageNumbers = [];
      this.explosions = [];
      this.screenShake = 0;
      this.hitmarkerTimer = 0;
      this.hitmarkerCrit = false;
    }

    addScreenShake(intensity) {
      this.screenShake = Math.min(this.screenShake + intensity, 25);
    }

    triggerHitmarker(isCrit = false) {
      this.hitmarkerTimer = 10; // frames
      this.hitmarkerCrit = isCrit;
    }

    addDamageNumber(x, y, damage, isCrit = false) {
      this.damageNumbers.push({
        x: x + (Math.random() * 20 - 10),
        y: y - 20,
        text: Math.round(damage).toString() + (isCrit ? '!' : ''),
        color: isCrit ? '#ef4444' : '#f8fafc',
        size: isCrit ? 18 : 14,
        alpha: 1.0,
        vy: -1.8,
        life: 45
      });
    }

    addWallSparks(x, y, normalAngle) {
      const count = 6 + Math.floor(Math.random() * 6);
      const baseAng = normalAngle !== undefined ? normalAngle : Math.random() * Math.PI * 2;

      for (let i = 0; i < count; i++) {
        const spread = (Math.random() - 0.5) * 1.5;
        const ang = baseAng + spread;
        const speed = 2 + Math.random() * 5;
        this.particles.push({
          x: x,
          y: y,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed,
          size: 1.5 + Math.random() * 2,
          color: Math.random() > 0.3 ? '#fef08a' : '#fb923c',
          alpha: 1.0,
          decay: 0.05 + Math.random() * 0.04
        });
      }
    }

    addBloodBurst(x, y, hitAngle) {
      const count = 12 + Math.floor(Math.random() * 8);
      const exitAngle = hitAngle + Math.PI; // Spray out back

      for (let i = 0; i < count; i++) {
        const spread = (Math.random() - 0.5) * 1.8;
        const ang = exitAngle + spread;
        const speed = 1.5 + Math.random() * 6;
        this.particles.push({
          x: x,
          y: y,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed,
          size: 2 + Math.random() * 3,
          color: Math.random() > 0.4 ? '#dc2626' : '#991b1b',
          alpha: 1.0,
          decay: 0.03 + Math.random() * 0.03
        });
      }
    }

    addExplosion(x, y, radius = 120) {
      this.addScreenShake(18);
      this.explosions.push({
        x: x,
        y: y,
        maxRadius: radius,
        radius: 8,
        growth: 14,
        alpha: 1.0
      });

      // Heavy fire & smoke particles
      for (let i = 0; i < 35; i++) {
        const ang = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 8;
        this.particles.push({
          x: x,
          y: y,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed,
          size: 6 + Math.random() * 12,
          color: i % 3 === 0 ? '#ea580c' : (i % 3 === 1 ? '#f59e0b' : '#374151'),
          alpha: 0.9,
          decay: 0.02 + Math.random() * 0.02,
          friction: 0.92
        });
      }
    }

    update() {
      // Screen shake decay
      if (this.screenShake > 0.1) {
        this.screenShake *= 0.88;
      } else {
        this.screenShake = 0;
      }

      if (this.hitmarkerTimer > 0) {
        this.hitmarkerTimer--;
      }

      // Update particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.friction) {
          p.vx *= p.friction;
          p.vy *= p.friction;
        }
        p.alpha -= p.decay;
        if (p.alpha <= 0) {
          this.particles.splice(i, 1);
        }
      }

      // Update explosions
      for (let i = this.explosions.length - 1; i >= 0; i--) {
        const ex = this.explosions[i];
        ex.radius += ex.growth;
        ex.growth *= 0.85;
        ex.alpha -= 0.04;
        if (ex.alpha <= 0 || ex.radius >= ex.maxRadius) {
          this.explosions.splice(i, 1);
        }
      }

      // Update floating damage numbers
      for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
        const dn = this.damageNumbers[i];
        dn.y += dn.vy;
        dn.vy *= 0.95;
        dn.life--;
        if (dn.life < 15) {
          dn.alpha = dn.life / 15;
        }
        if (dn.life <= 0) {
          this.damageNumbers.splice(i, 1);
        }
      }
    }

    render(ctx, viewX, viewY, viewW, viewH) {
      // 1. Render Explosions (World coordinates)
      ctx.save();
      for (let i = 0; i < this.explosions.length; i++) {
        const ex = this.explosions[i];
        if (ex.x + ex.radius < viewX || ex.x - ex.radius > viewX + viewW ||
            ex.y + ex.radius < viewY || ex.y - ex.radius > viewY + viewH) continue;

        // Shockwave ring
        ctx.strokeStyle = `rgba(251, 146, 60, ${ex.alpha})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, ex.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Core flash
        const coreGrad = ctx.createRadialGradient(ex.x, ex.y, 0, ex.x, ex.y, ex.radius * 0.7);
        coreGrad.addColorStop(0, `rgba(255, 255, 255, ${ex.alpha})`);
        coreGrad.addColorStop(0.3, `rgba(245, 158, 11, ${ex.alpha * 0.8})`);
        coreGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, ex.radius * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 2. Render Particles (World coordinates)
      ctx.save();
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        if (p.x < viewX - 20 || p.x > viewX + viewW + 20 || p.y < viewY - 20 || p.y > viewY + viewH + 20) continue;

        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 3. Render Floating Damage Numbers (World coordinates)
      ctx.save();
      for (let i = 0; i < this.damageNumbers.length; i++) {
        const dn = this.damageNumbers[i];
        if (dn.x < viewX - 40 || dn.x > viewX + viewW + 40 || dn.y < viewY - 40 || dn.y > viewY + viewH + 40) continue;

        ctx.globalAlpha = Math.max(0, dn.alpha);
        ctx.font = `bold ${dn.size}px monospace`;
        ctx.fillStyle = dn.color;
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 4;
        ctx.textAlign = 'center';
        ctx.fillText(dn.text, dn.x, dn.y);
      }
      ctx.restore();
    }

    renderHitmarker(ctx, screenCenterX, screenCenterY) {
      if (this.hitmarkerTimer <= 0) return;

      const alpha = this.hitmarkerTimer / 10;
      const size = 10;
      const gap = 4;

      ctx.save();
      ctx.strokeStyle = this.hitmarkerCrit ? `rgba(239, 68, 68, ${alpha})` : `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = 2;

      // 4 diagonal tick marks
      const cx = screenCenterX;
      const cy = screenCenterY;

      ctx.beginPath();
      // Top-Left
      ctx.moveTo(cx - gap, cy - gap); ctx.lineTo(cx - gap - size, cy - gap - size);
      // Top-Right
      ctx.moveTo(cx + gap, cy - gap); ctx.lineTo(cx + gap + size, cy - gap - size);
      // Bottom-Left
      ctx.moveTo(cx - gap, cy + gap); ctx.lineTo(cx - gap - size, cy + gap + size);
      // Bottom-Right
      ctx.moveTo(cx + gap, cy + gap); ctx.lineTo(cx + gap + size, cy + gap + size);
      ctx.stroke();

      ctx.restore();
    }
  }

  return ParticleSystem;
}));
