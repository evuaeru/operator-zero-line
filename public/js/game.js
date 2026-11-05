/**
 * GAME.JS - Main Game Loop, Camera, Pipeline Rendering, and Collision
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Game = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class Game {
    constructor(canvas, config, map, raycaster, sprites, sounds, particles, network) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.config = config;
      this.map = map;
      this.raycaster = raycaster;
      this.sprites = sprites;
      this.sounds = sounds;
      this.particles = particles;
      this.network = network;

      window.currentMap = this.map;

      // Camera
      this.camera = { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };

      // Input state
      this.input = {
        keys: {},
        moveX: 0,
        moveY: 0,
        screenMouseX: 0,
        screenMouseY: 0,
        worldMouseX: 0,
        worldMouseY: 0,
        mouseDown: false,
        rightDown: false,
        toggleFlashlight: false,
        showScoreboard: false
      };

      // Entities
      this.player = null;
      this.localBots = [];
      this.bullets = [];

      // Loop & Timing
      this.lastTime = performance.now();
      this.running = false;

      // Match Round Timer & State
      this.roundDurationSec = 180; // 3 minutes per round
      this.roundTimeRemaining = this.roundDurationSec;
      this.isMatchOver = false;
      this.nextRoundInterval = null;

      this.initEvents();
      this.resizeCanvas();
    }

    resizeCanvas() {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      this.camera.w = this.canvas.width;
      this.camera.h = this.canvas.height;
    }

    initEvents() {
      window.addEventListener('resize', () => this.resizeCanvas());

      window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        this.input.keys[e.code] = true;
        if (e.code === 'KeyF') this.input.toggleFlashlight = true;
        if (e.code === 'Tab') {
          e.preventDefault();
          this.input.showScoreboard = true;
        }
        this.updateMovementInput();
      });

      window.addEventListener('keyup', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        this.input.keys[e.code] = false;
        if (e.code === 'Tab') {
          e.preventDefault();
          this.input.showScoreboard = false;
        }
        this.updateMovementInput();
      });

      window.addEventListener('mousemove', (e) => {
        this.input.screenMouseX = e.clientX;
        this.input.screenMouseY = e.clientY;
        this.updateWorldMouse();
      });

      window.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.button === 0) this.input.mouseDown = true;
        if (e.button === 2) this.input.rightDown = true;
        if (this.sounds) this.sounds.resume();
      });

      window.addEventListener('mouseup', (e) => {
        if (e.button === 0) this.input.mouseDown = false;
        if (e.button === 2) this.input.rightDown = false;
      });

      window.addEventListener('wheel', (e) => {
        if (!this.player) return;
        if (e.deltaY > 0) this.player.weaponManager.selectNextWeapon();
        else this.player.weaponManager.selectPrevWeapon();
      });

      // Disable context menu for right click aim/flashlight
      window.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    updateMovementInput() {
      let mx = 0;
      let my = 0;
      if (this.input.keys['KeyW'] || this.input.keys['ArrowUp']) my -= 1;
      if (this.input.keys['KeyS'] || this.input.keys['ArrowDown']) my += 1;
      if (this.input.keys['KeyA'] || this.input.keys['ArrowLeft']) mx -= 1;
      if (this.input.keys['KeyD'] || this.input.keys['ArrowRight']) mx += 1;
      this.input.moveX = mx;
      this.input.moveY = my;
    }

    updateWorldMouse() {
      this.input.worldMouseX = this.input.screenMouseX + this.camera.x;
      this.input.worldMouseY = this.input.screenMouseY + this.camera.y;
    }

    start(playerInstance) {
      this.player = playerInstance;
      const sp = this.map.getRandomSpawnPoint();
      this.player.respawn(sp);

      // Setup network event handlers
      this.network.onShootEvent = (remoteBullets) => {
        if (!remoteBullets || remoteBullets.length === 0) return;
        this.bullets.push(...remoteBullets);

        const firstB = remoteBullets[0];
        const shooter = this.network.remotePlayers.get(firstB.shooterId);
        if (shooter) {
          const dist = Math.hypot(shooter.x - this.player.x, shooter.y - this.player.y);
          if (dist < 1200) {
            const wpn = this.config.WEAPONS[shooter.weapon] || this.config.WEAPONS['RIFLE'];
            this.sounds.playGunshot(wpn.sound);
          }
          this.sprites.addShellCasing(shooter.x, shooter.y, shooter.angle, shooter.weapon);
          shooter.isShooting = true;
          setTimeout(() => { shooter.isShooting = false; }, 80);
        }
      };

      this.network.onDamageTakenEvent = (msg) => {
        if (!this.player) return;
        this.player.hp = msg.hp;
        this.player.shield = msg.shield;
        this.particles.addBloodBurst(this.player.x, this.player.y, Math.random() * Math.PI * 2);
        this.sprites.addBloodDecal(this.player.x, this.player.y);
        this.particles.addDamageNumber(this.player.x, this.player.y, msg.damage, msg.damage > 70);
        this.particles.addScreenShake(8);
        this.sounds.playHitmarker();

        if (msg.isDead) {
          this.player.isDead = true;
          this.player.respawnTimer = this.config.PLAYER.RESPAWN_DELAY_MS;
        }
      };

      this.network.onItemPickedEvent = (msg) => {
        const item = this.map.itemSpawns.find(it => it.id === msg.itemId);
        if (item) {
          item.active = false;
          if (msg.playerId === this.player.id) {
            if (msg.itemType === 'medkit') this.player.heal(50);
            else if (msg.itemType === 'shield') this.player.addShield(50);
            else if (msg.itemType === 'ammo') this.player.weaponManager.addAmmo(0.6);
            else if (msg.itemType === 'weapon' && msg.weapon) this.player.weaponManager.unlockWeapon(msg.weapon);
            if (this.sounds) this.sounds.playPickup();
          }
        }
      };

      this.network.onBarrelExplodedEvent = (msg) => {
        const barrel = this.map.barrels.find(b => b.id === msg.barrelId);
        if (barrel) {
          barrel.exploded = true;
          this.particles.addExplosion(msg.x, msg.y, 140);
          this.sounds.playExplosion();
          this.map.rebuildSegments();
        }
      };

      this.network.onRespawnedEvent = (msg) => {
        if (!this.player) return;
        this.player.x = msg.spawn.x;
        this.player.y = msg.spawn.y;
        this.player.angle = msg.spawn.angle;
        this.player.hp = msg.hp;
        this.player.shield = msg.shield;
        this.player.isDead = false;
        this.player.respawnTimer = 0;
      };

      this.network.onRoundEndEvent = (msg) => {
        this.triggerMatchEnd(msg.mvp, msg.leaderboard);
      };

      this.network.onRoundStartEvent = (msg) => {
        this.resetMatchForNextRound();
      };

      this.network.onLocalStatsSync = (stats) => {
        if (!this.player) return;
        this.player.kills = stats.kills;
        this.player.deaths = stats.deaths;
        this.player.score = stats.score;
        if (stats.isDead && !this.player.isDead) {
          this.player.isDead = true;
          this.player.hp = 0;
          this.player.respawnTimer = this.config.PLAYER.RESPAWN_DELAY_MS;
        }
      };

      // Initialize raycaster exploration canvas
      this.raycaster.initExploration(this.map.width, this.map.height);

      // If offline mode or single player, spawn 3 tactical bots
      if (this.network.isOfflineMode) {
        this.spawnOfflineBots(3);
      }

      // Update HUD Room Code
      const roomEl = document.getElementById('hud-room-code');
      if (roomEl) {
        roomEl.textContent = this.network.isOfflineMode ? 'ROOM: TRAINING' : `ROOM: ${this.network.roomId || 'SQUAD1'}`;
      }

      this.running = true;
      this.lastTime = performance.now();
      requestAnimationFrame((t) => this.gameLoop(t));
    }

    spawnOfflineBots(count = 3) {
      this.localBots = [];
      const botNames = ['Spectre-1', 'Viper-02', 'Ghost-X', 'Hunter-9'];
      for (let i = 0; i < count; i++) {
        const color = this.config.PLAYER_COLORS[(i + 1) % this.config.PLAYER_COLORS.length];
        const bot = new window.AIBot('bot_' + (i + 1), botNames[i % botNames.length], color, this.config, window.WeaponManager, this.map);
        bot.respawn(this.map.getRandomSpawnPoint());
        this.localBots.push(bot);
      }
    }

    gameLoop(now) {
      if (!this.running) return;

      const dt = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;

      this.update(dt, now);
      this.render(now);

      requestAnimationFrame((t) => this.gameLoop(t));
    }

    update(dt, now) {
      if (!this.player) return;

      this.updateWorldMouse();

      // 0. Update Match Round Timer
      if (!this.isMatchOver) {
        if (this.network.isOfflineMode) {
          this.roundTimeRemaining = Math.max(0, this.roundTimeRemaining - dt);
        } else if (this.network.serverRoundTime !== null && this.network.serverRoundTime !== undefined) {
          this.roundTimeRemaining = this.network.serverRoundTime;
        } else {
          this.roundTimeRemaining = Math.max(0, this.roundTimeRemaining - dt);
        }

        const min = Math.floor(this.roundTimeRemaining / 60);
        const sec = Math.floor(this.roundTimeRemaining % 60);
        const timerEl = document.getElementById('hud-timer');
        if (timerEl) {
          timerEl.textContent = `⏱️ ${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
          if (this.roundTimeRemaining < 30) {
            timerEl.classList.add('warning');
          } else {
            timerEl.classList.remove('warning');
          }
        }

        if (this.roundTimeRemaining <= 0) {
          this.triggerMatchEnd();
        }
      }

      // 1. Update Player
      this.player.update(this.input, this.map, this.sounds, now, dt, this.network);

      // Handle Shooting (Disabled during Match Over)
      if (this.input.mouseDown && !this.player.isDead && !this.isMatchOver) {
        const newBullets = this.player.weaponManager.shoot(
          this.player.id,
          this.player.x,
          this.player.y,
          this.player.angle,
          now
        );

        if (newBullets && newBullets.length > 0) {
          this.player.isShooting = true;
          this.bullets.push(...newBullets);
          this.network.sendShoot(newBullets);

          // Eject brass casing
          const currW = this.player.weaponManager.getCurrent();
          this.sprites.addShellCasing(this.player.x, this.player.y, this.player.angle, currW.id);

          // Play weapon sound
          this.sounds.playGunshot(currW.sound);

          // Add subtle camera recoil shake
          this.particles.addScreenShake(currW.recoilKick * 0.4);
        }
      } else {
        this.player.isShooting = false;
      }

      // 2. Update Offline Bots (if in offline/practice mode)
      if (this.network.isOfflineMode) {
        const allEntities = [this.player, ...this.localBots];
        for (const bot of this.localBots) {
          const botBullets = bot.update(allEntities, this.map, now, dt);
          if (botBullets && botBullets.length > 0) {
            this.bullets.push(...botBullets);
            const bw = bot.weaponManager.getCurrent();
            this.sprites.addShellCasing(bot.x, bot.y, bot.angle, bw.id);
            // Play distant sound if in proximity
            const dist = Math.hypot(bot.x - this.player.x, bot.y - this.player.y);
            if (dist < 1000) {
              this.sounds.playGunshot(bw.sound);
            }
          }
        }
      }

      // 3. Update Remote Players (interpolation)
      this.network.interpolateRemotePlayers(dt);

      // 4. Send local player state to server
      this.network.sendPlayerInput(this.player);

      // 5. Update Projectiles / Bullets
      this.updateBullets(dt);

      // 6. Update Decals, Particles & Effects
      this.sprites.updateShellCasings();
      this.particles.update();

      // 7. Update Camera (Smooth tracking with mouse lookahead)
      this.updateCamera(dt);
    }

    updateCamera(dt) {
      // Lookahead towards crosshair
      const lookFactor = 0.18;
      const targetCamX = this.player.x - this.camera.w / 2 + (this.input.screenMouseX - this.camera.w / 2) * lookFactor;
      const targetCamY = this.player.y - this.camera.h / 2 + (this.input.screenMouseY - this.camera.h / 2) * lookFactor;

      const camLerp = Math.min(1.0, 10.0 * dt);
      this.camera.x += (targetCamX - this.camera.x) * camLerp;
      this.camera.y += (targetCamY - this.camera.y) * camLerp;

      // Clamp camera within map bounds
      this.camera.x = Math.max(0, Math.min(this.camera.x, this.map.width - this.camera.w));
      this.camera.y = Math.max(0, Math.min(this.camera.y, this.map.height - this.camera.h));
    }

    updateBullets(dt) {
      const timeScale = Math.min(Math.max(dt * 60, 0.1), 3.0);
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        b.prevX = b.x;
        b.prevY = b.y;

        b.x += b.vx * timeScale;
        b.y += b.vy * timeScale;

        const distTravelled = Math.hypot(b.vx, b.vy) * timeScale;
        b.rangeRemaining -= distTravelled;

        if (b.rangeRemaining <= 0) {
          this.bullets.splice(i, 1);
          continue;
        }

        // Check Wall Collision
        let hitWall = false;
        for (const seg of this.map.segments) {
          const hit = window.GameMap.lineIntersection(b.prevX, b.prevY, b.x, b.y, seg.a.x, seg.a.y, seg.b.x, seg.b.y);
          if (hit) {
            this.particles.addWallSparks(hit.x, hit.y);
            hitWall = true;
            break;
          }
        }

        if (hitWall) {
          this.bullets.splice(i, 1);
          continue;
        }

        // Check Explosive Barrels
        let hitBarrel = false;
        for (const barrel of this.map.barrels) {
          if (barrel.exploded) continue;
          const d = Math.hypot(b.x - barrel.x, b.y - barrel.y);
          if (d < barrel.r + 4) {
            barrel.hp -= b.damage;
            this.particles.addWallSparks(b.x, b.y);
            if (!this.network.isOfflineMode) {
              this.network.sendBarrelHit(barrel.id, b.damage, b.shooterId);
            }
            if (barrel.hp <= 0) {
              barrel.exploded = true;
              this.particles.addExplosion(barrel.x, barrel.y, 140);
              this.sounds.playExplosion();
              this.map.rebuildSegments();

              // Damage all nearby entities
              this.applyExplosionDamage(barrel.x, barrel.y, 140, 90, b.shooterId);
            }
            hitBarrel = true;
            break;
          }
        }

        if (hitBarrel) {
          this.bullets.splice(i, 1);
          continue;
        }

        // Check Entity Collision (Local player, Bots, Remote Players)
        // Check if hitting local player (from enemy/bot)
        if (b.shooterId !== this.player.id && !this.player.isDead) {
          const d = Math.hypot(b.x - this.player.x, b.y - this.player.y);
          if (d < this.player.radius) {
            const hitResult = this.player.takeDamage(b.damage, b.shooterId);
            this.particles.addBloodBurst(b.x, b.y, Math.atan2(b.vy, b.vx));
            this.sprites.addBloodDecal(this.player.x, this.player.y);
            this.particles.addDamageNumber(this.player.x, this.player.y, b.damage);
            this.particles.addScreenShake(7);

            this.bullets.splice(i, 1);
            continue;
          }
        }

        // Check if bullet from local player hit bots or remote players
        if (b.shooterId === this.player.id) {
          let hitEnemy = false;

          // Check Bots
          for (const bot of this.localBots) {
            if (bot.isDead) continue;
            const d = Math.hypot(b.x - bot.x, b.y - bot.y);
            if (d < bot.radius) {
              const res = bot.takeDamage(b.damage, this.player.id);
              this.particles.addBloodBurst(b.x, b.y, Math.atan2(b.vy, b.vx));
              this.sprites.addBloodDecal(bot.x, bot.y);
              this.particles.addDamageNumber(bot.x, bot.y, b.damage, b.damage > 80);
              this.particles.triggerHitmarker(b.damage > 80);
              this.sounds.playHitmarker();

              if (res.killed) {
                this.player.kills++;
                this.player.score += 100;
                this.network.killFeed.unshift({
                  killerName: this.player.name,
                  victimName: bot.name,
                  weapon: b.weaponType,
                  time: performance.now()
                });
                if (this.network.killFeed.length > 5) {
                  this.network.killFeed.pop();
                }
              }

              hitEnemy = true;
              break;
            }
          }

          // Check Remote Players
          if (!hitEnemy && !this.network.isOfflineMode) {
            for (const rp of this.network.remotePlayers.values()) {
              if (rp.isDead) continue;
              const d = Math.hypot(b.x - rp.x, b.y - rp.y);
              if (d < this.player.radius) {
                this.network.sendHit(rp.id, b.damage, b.weaponType);
                this.particles.addBloodBurst(b.x, b.y, Math.atan2(b.vy, b.vx));
                this.sprites.addBloodDecal(rp.x, rp.y);
                this.particles.addDamageNumber(rp.x, rp.y, b.damage, b.damage > 80);
                this.particles.triggerHitmarker(b.damage > 80);
                this.sounds.playHitmarker();
                hitEnemy = true;
                break;
              }
            }
          }

          if (hitEnemy) {
            this.bullets.splice(i, 1);
            continue;
          }
        }
      }
    }

    applyExplosionDamage(exX, exY, radius, maxDmg, attackerId) {
      const entities = [this.player, ...this.localBots, ...Array.from(this.network.remotePlayers.values())];
      for (const ent of entities) {
        if (!ent || ent.isDead) continue;
        const d = Math.hypot(ent.x - exX, ent.y - exY);
        if (d < radius) {
          const falloff = 1 - (d / radius);
          const dmg = maxDmg * falloff;
          ent.takeDamage(dmg, attackerId);
          this.particles.addBloodBurst(ent.x, ent.y, Math.atan2(ent.y - exY, ent.x - exX));
          this.sprites.addBloodDecal(ent.x, ent.y);
          this.particles.addDamageNumber(ent.x, ent.y, dmg, true);
        }
      }
    }

    render(now) {
      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;

      // 1. Clear Frame
      ctx.fillStyle = '#0a0d14';
      ctx.fillRect(0, 0, w, h);

      // 2. Camera Shake Offset
      let shakeX = 0, shakeY = 0;
      if (this.particles.screenShake > 0) {
        shakeX = (Math.random() - 0.5) * this.particles.screenShake;
        shakeY = (Math.random() - 0.5) * this.particles.screenShake;
      }

      ctx.save();
      ctx.translate(-this.camera.x + shakeX, -this.camera.y + shakeY);

      // 3. Render Map floor & obstacles
      this.sprites.renderMap(ctx, this.map, this.camera.x, this.camera.y, this.camera.w, this.camera.h);

      // 4. Render Decals (Blood splatters, brass shells)
      this.sprites.renderDecals(ctx, this.camera.x, this.camera.y, this.camera.w, this.camera.h);

      // 5. Compute Line-Of-Sight & Fog-Of-War Visibility Polygon
      const poly = this.raycaster.computeVisibilityPolygon(
        this.player.x,
        this.player.y,
        this.player.angle,
        this.player.visionAngle,
        this.player.visionRange,
        this.player.peripheralRadius,
        this.map.segments
      );

      // Stamp exploration shroud
      this.raycaster.updateExploration(poly, now);

      // 6. Render Bullets Tracers
      this.renderBullets(ctx);

      // 7. Render Particles & Explosions
      this.particles.render(ctx, this.camera.x, this.camera.y, this.camera.w, this.camera.h);

      // 8. Render Enemies & Bots (Subject to Line of Sight Fog of War!)
      this.renderEnemies(ctx, poly);

      // 9. Render Local Player
      this.sprites.renderSoldier(
        ctx,
        this.player.x,
        this.player.y,
        this.player.angle,
        this.player.colorData,
        this.player.weaponManager.getCurrent(),
        this.player.walkCycle,
        this.player.isShooting,
        this.player.isDead
      );

      // 10. Render Fog of War Shroud & Vision Volumetrics
      this.raycaster.renderFogOfWar(
        ctx,
        this.player,
        poly,
        this.camera.x,
        this.camera.y,
        this.camera.w,
        this.camera.h,
        this.map.width,
        this.map.height,
        this.player.flashlightOn
      );

      ctx.restore();

      // 11. Render HUD, Crosshair, and Overlays
      this.renderHUD(ctx, w, h);
    }

    renderBullets(ctx) {
      ctx.save();
      for (let i = 0; i < this.bullets.length; i++) {
        const b = this.bullets[i];

        // Tracer beam line
        ctx.strokeStyle = b.trailColor || '#facc15';
        ctx.lineWidth = b.weaponType === 'sniper' ? 3.5 : (b.weaponType === 'shotgun' ? 2 : 2.5);
        ctx.beginPath();
        ctx.moveTo(b.prevX, b.prevY);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        // Glowing bullet head
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.weaponType === 'sniper' ? 3.5 : 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    renderEnemies(ctx, poly) {
      const allEnemies = this.network.isOfflineMode
        ? this.localBots
        : Array.from(this.network.remotePlayers.values());

      for (const enemy of allEnemies) {
        if (!enemy) continue;

        // Check if enemy is within Line of Sight
        const isVisible = this.raycaster.isPointVisible(
          enemy.x,
          enemy.y,
          this.player.x,
          this.player.y,
          this.player.angle,
          this.player.visionAngle,
          this.player.visionRange,
          this.player.peripheralRadius,
          this.map.segments
        );

        // If not in direct LOS, hide completely (Tactical Fog of War)
        if (!isVisible && !enemy.isDead) continue;

        const wpn = this.config.WEAPONS[enemy.weapon] || this.config.WEAPONS['RIFLE'];
        this.sprites.renderSoldier(
          ctx,
          enemy.x,
          enemy.y,
          enemy.angle,
          enemy.colorData || this.config.PLAYER_COLORS[1],
          wpn,
          enemy.walkCycle || 0,
          enemy.isShooting,
          enemy.isDead
        );

        // Name tag & HP bar above head if alive
        if (!enemy.isDead) {
          ctx.save();
          ctx.font = 'bold 11px sans-serif';
          ctx.fillStyle = '#f8fafc';
          ctx.textAlign = 'center';
          ctx.fillText(enemy.name || 'Opponent', enemy.x, enemy.y - 28);

          // Mini HP Bar
          const barW = 34, barH = 4;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.fillRect(enemy.x - barW / 2, enemy.y - 24, barW, barH);
          ctx.fillStyle = '#ef4444';
          const hpPct = Math.max(0, enemy.hp / this.config.PLAYER.MAX_HP);
          ctx.fillRect(enemy.x - barW / 2, enemy.y - 24, barW * hpPct, barH);
          ctx.restore();
        }
      }
    }

    renderHUD(ctx, w, h) {
      // 1. Crosshair & Hitmarker
      this.renderCrosshair(ctx);
      this.particles.renderHitmarker(ctx, this.input.screenMouseX, this.input.screenMouseY);

      // 2. Health & Shield Bars (Bottom-Left)
      this.renderStatusBars(ctx, h);

      // 3. Ammo & Weapon Info (Bottom-Right)
      this.renderWeaponHUD(ctx, w, h);

      // 4. Tactical Radar / Minimap (Top-Right)
      this.renderMinimap(ctx, w);

      // 5. Kill Feed (Top-Left)
      this.renderKillFeed(ctx);

      // 6. Scoreboard Overlay (TAB)
      if (this.input.showScoreboard) {
        this.renderScoreboard(ctx, w, h);
      }

      // 7. Death Screen Overlay
      if (this.player && this.player.isDead) {
        this.renderDeathScreen(ctx, w, h);
      }
    }

    renderCrosshair(ctx) {
      const mx = this.input.screenMouseX;
      const my = this.input.screenMouseY;
      const currW = this.player ? this.player.weaponManager.getCurrent() : null;
      const spread = currW ? currW.spread * 120 : 6;

      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;

      // Center dot
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(mx, my, 2, 0, Math.PI * 2);
      ctx.fill();

      // Dynamic reticle lines
      const len = 7;
      ctx.beginPath();
      ctx.moveTo(mx - spread - len, my); ctx.lineTo(mx - spread, my); // Left
      ctx.moveTo(mx + spread, my); ctx.lineTo(mx + spread + len, my); // Right
      ctx.moveTo(mx, my - spread - len); ctx.lineTo(mx, my - spread); // Top
      ctx.moveTo(mx, my + spread); ctx.lineTo(mx, my + spread + len); // Bottom
      ctx.stroke();

      ctx.restore();
    }

    renderStatusBars(ctx, h) {
      const baseX = 30;
      const baseY = h - 65;
      const barW = 220;
      const barH = 14;

      ctx.save();
      // Background panel
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(baseX - 10, baseY - 35, barW + 20, 80, 8);
      ctx.fill();
      ctx.stroke();

      // Shield Bar
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(baseX, baseY - 20, barW, 8);
      const shieldPct = Math.max(0, this.player.shield / this.player.maxShield);
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(baseX, baseY - 20, barW * shieldPct, 8);

      // Health Bar
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(baseX, baseY - 4, barW, barH);
      const hpPct = Math.max(0, this.player.hp / this.player.maxHp);
      const hpColor = hpPct > 0.5 ? '#22c55e' : (hpPct > 0.25 ? '#eab308' : '#ef4444');
      ctx.fillStyle = hpColor;
      ctx.fillRect(baseX, baseY - 4, barW * hpPct, barH);

      // Stamina Bar
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(baseX, baseY + 16, barW, 5);
      const stPct = Math.max(0, this.player.stamina / this.player.maxStamina);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(baseX, baseY + 16, barW * stPct, 5);

      // Text Labels
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'left';
      ctx.fillText(`HP: ${Math.round(this.player.hp)} / ${this.player.maxHp}`, baseX, baseY + 8);
      ctx.fillText(`SHIELD: ${Math.round(this.player.shield)}`, baseX + 130, baseY + 8);

      ctx.restore();
    }

    renderWeaponHUD(ctx, w, h) {
      const currW = this.player.weaponManager.getCurrent();
      const baseX = w - 240;
      const baseY = h - 65;

      ctx.save();
      // Panel
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(baseX - 10, baseY - 35, 220, 80, 8);
      ctx.fill();
      ctx.stroke();

      // Weapon Name
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = currW.color || '#38bdf8';
      ctx.textAlign = 'right';
      ctx.fillText(currW.name, w - 40, baseY - 12);

      // Ammo Numbers
      ctx.font = 'bold 24px monospace';
      ctx.fillStyle = currW.currentMag > 0 ? '#f8fafc' : '#ef4444';
      ctx.fillText(`${currW.currentMag}`, w - 105, baseY + 18);

      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`/ ${currW.reserveAmmo}`, w - 40, baseY + 18);

      // Reloading indicator
      if (this.player.weaponManager.isReloading) {
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = '#f59e0b';
        ctx.textAlign = 'center';
        ctx.fillText('RELOADING...', baseX + 100, baseY + 36);
      }

      ctx.restore();
    }

    renderMinimap(ctx, screenW) {
      const mapW = 160;
      const mapH = 120;
      const pad = 20;
      const rx = screenW - mapW - pad;
      const ry = pad;

      ctx.save();
      // Minimap background frame
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.fillRect(rx, ry, mapW, mapH);
      ctx.strokeRect(rx, ry, mapW, mapH);

      const scaleX = mapW / this.map.width;
      const scaleY = mapH / this.map.height;

      // Draw explored shroud on minimap
      if (this.raycaster.explorationCanvas) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.drawImage(this.raycaster.explorationCanvas, rx, ry, mapW, mapH);
        ctx.restore();
      }

      // Draw Wall Outlines
      ctx.fillStyle = '#475569';
      for (const obs of this.map.obstacles) {
        ctx.fillRect(rx + obs.x * scaleX, ry + obs.y * scaleY, obs.w * scaleX, obs.h * scaleY);
      }

      // Draw Player icon
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(rx + this.player.x * scaleX, ry + this.player.y * scaleY, 3, 0, Math.PI * 2);
      ctx.fill();

      // Vision cone arc on radar
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rx + this.player.x * scaleX, ry + this.player.y * scaleY);
      const halfFov = this.player.visionAngle / 2;
      ctx.arc(
        rx + this.player.x * scaleX,
        ry + this.player.y * scaleY,
        22,
        this.player.angle - halfFov,
        this.player.angle + halfFov
      );
      ctx.closePath();
      ctx.stroke();

      ctx.restore();
    }

    renderKillFeed(ctx) {
      const feed = this.network.killFeed;
      const now = performance.now();
      ctx.save();
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'left';

      // Purge entries older than 6 seconds
      for (let i = feed.length - 1; i >= 0; i--) {
        if (feed[i].time && (now - feed[i].time > 6000)) {
          feed.splice(i, 1);
        }
      }

      const displayCount = Math.min(feed.length, 5);
      for (let i = 0; i < displayCount; i++) {
        const k = feed[i];
        const age = k.time ? now - k.time : 0;
        let alpha = 1.0;
        if (age > 4500) {
          alpha = Math.max(0, 1 - (age - 4500) / 1500);
        }

        ctx.globalAlpha = alpha;
        const y = 30 + i * 26;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(20, y - 16, 300, 24);

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(20, y - 16, 300, 24);

        ctx.fillStyle = '#38bdf8';
        ctx.fillText(k.killerName, 28, y);

        ctx.fillStyle = '#ef4444';
        ctx.fillText(` [${(k.weapon || 'RIFLE').toUpperCase()}] `, 135, y);

        ctx.fillStyle = '#f87171';
        ctx.fillText(k.victimName, 225, y);
      }
      ctx.restore();
    }

    renderScoreboard(ctx, w, h) {
      ctx.save();
      const sbW = 640;
      const sbH = 410;
      const rx = w / 2 - sbW / 2;
      const ry = h / 2 - sbH / 2;

      // Dark cyber glass panel
      ctx.fillStyle = 'rgba(10, 15, 29, 0.95)';
      ctx.fillRect(rx, ry, sbW, sbH);

      // Glowing Cyan border
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(rx, ry, sbW, sbH);

      // Inner tactical corner frame
      ctx.strokeStyle = 'rgba(2, 132, 199, 0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(rx + 6, ry + 6, sbW - 12, sbH - 12);

      // Title & Room Code Header
      ctx.font = 'bold 20px monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'center';
      const roomLabel = (this.network.roomId && this.network.roomId !== 'null') ? this.network.roomId : 'OFFLINE TRAINING';
      ctx.fillText(`TACTICAL SCOREBOARD • ${roomLabel}`, w / 2, ry + 36);

      // Round Timer in Scoreboard
      const min = Math.floor(this.roundTimeRemaining / 60);
      const sec = Math.floor(this.roundTimeRemaining % 60);
      const timeStr = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = this.roundTimeRemaining < 30 ? '#ef4444' : '#fbbf24';
      ctx.fillText(`ROUND TIME REMAINING: ${timeStr}`, w / 2, ry + 60);

      // Table Header row
      ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
      ctx.fillRect(rx + 16, ry + 78, sbW - 32, 28);
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'left';
      ctx.fillText('RANK', rx + 28, ry + 96);
      ctx.fillText('OPERATOR', rx + 95, ry + 96);
      ctx.fillText('KILLS', rx + 300, ry + 96);
      ctx.fillText('DEATHS', rx + 380, ry + 96);
      ctx.fillText('K/D', rx + 460, ry + 96);
      ctx.fillText('SCORE', rx + 535, ry + 96);

      // Players sorted by score, then kills
      const list = [this.player, ...this.localBots, ...Array.from(this.network.remotePlayers.values())];
      list.sort((a, b) => (b.score || 0) - (a.score || 0) || (b.kills || 0) - (a.kills || 0));

      for (let i = 0; i < Math.min(list.length, 7); i++) {
        const p = list[i];
        const rowY = ry + 130 + i * 34;
        const isMe = p.id === this.player.id;

        // Row background
        if (isMe) {
          ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
          ctx.fillRect(rx + 16, rowY - 20, sbW - 32, 30);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1;
          ctx.strokeRect(rx + 16, rowY - 20, sbW - 32, 30);
        } else if (i % 2 === 0) {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.5)';
          ctx.fillRect(rx + 16, rowY - 20, sbW - 32, 30);
        }

        // Rank styling (1st Gold, 2nd Silver, 3rd Bronze)
        let rankColor = '#94a3b8';
        let rankLabel = `#${i + 1}`;
        if (i === 0) { rankColor = '#fbbf24'; rankLabel = '👑 1st'; }
        else if (i === 1) { rankColor = '#e2e8f0'; rankLabel = '🥈 2nd'; }
        else if (i === 2) { rankColor = '#fb923c'; rankLabel = '🥉 3rd'; }

        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = rankColor;
        ctx.textAlign = 'left';
        ctx.fillText(rankLabel, rx + 28, rowY);

        ctx.fillStyle = isMe ? '#38bdf8' : (p.colorData ? p.colorData.hex : '#f8fafc');
        ctx.fillText((p.name || 'Unknown') + (isMe ? ' (YOU)' : ''), rx + 95, rowY);

        ctx.fillStyle = '#f8fafc';
        ctx.fillText(`${p.kills || 0}`, rx + 310, rowY);
        ctx.fillText(`${p.deaths || 0}`, rx + 390, rowY);

        const kd = (p.deaths || 0) > 0 ? (p.kills / p.deaths).toFixed(1) : (p.kills || 0).toFixed(1);
        ctx.fillText(`${kd}`, rx + 465, rowY);

        ctx.fillStyle = '#fbbf24';
        ctx.fillText(`${p.score || 0}`, rx + 540, rowY);
      }

      // Footer
      ctx.font = 'italic 11px monospace';
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'center';
      ctx.fillText('[TAB] Close Scoreboard • [Enter] Squad Chat', w / 2, ry + sbH - 16);

      ctx.restore();
    }

    triggerMatchEnd(serverMvp = null, serverLeaderboard = null) {
      if (this.isMatchOver) return;
      this.isMatchOver = true;

      // Determine leaderboard
      let list = [];
      if (serverLeaderboard && serverLeaderboard.length > 0) {
        list = serverLeaderboard;
      } else {
        list = [this.player, ...this.localBots, ...Array.from(this.network.remotePlayers.values())];
        list.sort((a, b) => (b.score || 0) - (a.score || 0) || (b.kills || 0) - (a.kills || 0));
      }

      const mvp = serverMvp || list[0] || this.player;

      // Populate MVP Card in DOM
      const nameEl = document.getElementById('mvp-player-name');
      const titleEl = document.getElementById('mvp-player-title');
      const killsEl = document.getElementById('mvp-stat-kills');
      const deathsEl = document.getElementById('mvp-stat-deaths');
      const kdEl = document.getElementById('mvp-stat-kd');
      const scoreEl = document.getElementById('mvp-stat-score');
      const bodyEl = document.getElementById('match-leaderboard-body');
      const modalEl = document.getElementById('match-end-modal');

      if (nameEl) nameEl.textContent = mvp.name || 'Operator';
      if (titleEl) {
        if ((mvp.kills || 0) >= 15) titleEl.textContent = '★ APEX PREDATOR ★';
        else if ((mvp.kills || 0) >= 8) titleEl.textContent = '★ SHARPSHOOTER ★';
        else titleEl.textContent = '★ COMBAT SPECIALIST ★';
      }
      if (killsEl) killsEl.textContent = mvp.kills || 0;
      if (deathsEl) deathsEl.textContent = mvp.deaths || 0;
      if (kdEl) {
        const kd = (mvp.deaths || 0) > 0 ? ((mvp.kills || 0) / mvp.deaths).toFixed(2) : ((mvp.kills || 0)).toFixed(2);
        kdEl.textContent = kd;
      }
      if (scoreEl) scoreEl.textContent = mvp.score || 0;

      // Populate Leaderboard
      if (bodyEl) {
        bodyEl.innerHTML = '';
        list.forEach((p, idx) => {
          const tr = document.createElement('tr');
          if (idx === 0) tr.className = 'rank-1';
          else if (idx === 1) tr.className = 'rank-2';
          else if (idx === 2) tr.className = 'rank-3';

          if (p.id === this.player.id) tr.classList.add('is-local-player');

          const kd = (p.deaths || 0) > 0 ? ((p.kills || 0) / p.deaths).toFixed(1) : (p.kills || 0).toFixed(1);
          tr.innerHTML = `
            <td>${idx === 0 ? '👑 1st' : (idx === 1 ? '🥈 2nd' : (idx === 2 ? '🥉 3rd' : `#${idx + 1}`))}</td>
            <td>${p.name || 'Unknown'}${p.id === this.player.id ? ' (YOU)' : ''}</td>
            <td>${p.kills || 0}</td>
            <td>${p.deaths || 0}</td>
            <td>${kd}</td>
            <td>${p.score || 0}</td>
          `;
          bodyEl.appendChild(tr);
        });
      }

      if (modalEl) modalEl.classList.remove('hidden');

      // Countdown 10s for next round
      let count = 10;
      const countEl = document.getElementById('next-round-countdown');
      if (this.nextRoundInterval) clearInterval(this.nextRoundInterval);
      this.nextRoundInterval = setInterval(() => {
        count--;
        if (countEl) countEl.textContent = `NEXT ROUND IN ${count}s...`;
        if (count <= 0) {
          clearInterval(this.nextRoundInterval);
          this.resetMatchForNextRound();
        }
      }, 1000);

      const btnNext = document.getElementById('btn-next-round');
      if (btnNext) {
        btnNext.onclick = () => {
          if (this.nextRoundInterval) clearInterval(this.nextRoundInterval);
          this.resetMatchForNextRound();
        };
      }
    }

    resetMatchForNextRound() {
      const modalEl = document.getElementById('match-end-modal');
      if (modalEl) modalEl.classList.add('hidden');

      this.roundTimeRemaining = this.roundDurationSec;
      this.isMatchOver = false;

      // Respawn player
      const sp = this.map.getRandomSpawnPoint();
      this.player.respawn(sp);

      // Respawn local bots
      for (const bot of this.localBots) {
        bot.respawn(this.map.getRandomSpawnPoint());
      }

      // Clear bullets
      this.bullets = [];
    }

    renderDeathScreen(ctx, w, h) {
      ctx.save();
      ctx.fillStyle = 'rgba(185, 28, 28, 0.35)';
      ctx.fillRect(0, 0, w, h);

      ctx.font = 'bold 36px monospace';
      ctx.fillStyle = '#ef4444';
      ctx.textAlign = 'center';
      ctx.fillText('OPERATOR DOWN', w / 2, h / 2 - 20);

      const secLeft = Math.ceil(this.player.respawnTimer / 1000);
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(`RESPAWNING IN ${secLeft}s...`, w / 2, h / 2 + 25);

      ctx.restore();
    }
  }

  return Game;
}));
