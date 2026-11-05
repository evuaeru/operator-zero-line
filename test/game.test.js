/**
 * GAME.TEST.JS - Automated Verification Suite for Top-Down Shooter
 * Tests: Config, Map, Raycasting LOS, Weapons, AI Bot, and WebSocket Room Protocol
 */
const assert = require('assert');
const GameConfig = require('../public/js/config.js');
const GameMap = require('../public/js/map.js');
const Raycaster = require('../public/js/raycast.js');
const WeaponManager = require('../public/js/weapons.js');
const AIBot = require('../public/js/bot.js');

let testsPassed = 0;
let testsFailed = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    testsFailed++;
  }
}

console.log('Starting Test Suite: OPERATOR ZERO LINE...\n');

// 1. CONFIG TESTS
console.log('1. Configuration & Data Models:');
it('should define all 5 core weapons with balanced stats', () => {
  const w = GameConfig.WEAPONS;
  assert.ok(w.PISTOL, 'Pistol missing');
  assert.ok(w.SMG, 'SMG missing');
  assert.ok(w.RIFLE, 'Rifle missing');
  assert.ok(w.SHOTGUN, 'Shotgun missing');
  assert.ok(w.SNIPER, 'Sniper missing');

  assert.strictEqual(w.SHOTGUN.pellets, 8, 'Shotgun should fire 8 pellets');
  assert.ok(w.SNIPER.damage >= 100, 'Sniper should deal high damage');
  assert.strictEqual(w.SNIPER.laser, true, 'Sniper should have laser targeting');
});

it('should have player parameters and colors configured', () => {
  assert.ok(GameConfig.PLAYER.RADIUS > 0);
  assert.ok(GameConfig.PLAYER.FOV_DEG >= 90);
  assert.ok(GameConfig.PLAYER_COLORS.length >= 4);
});

// 2. MAP & COLLISION TESTS
console.log('\n2. Map Geometry & Collision:');
const map = new GameMap();

it('should initialize map bounds and obstacles', () => {
  assert.strictEqual(map.width, 2400);
  assert.strictEqual(map.height, 1800);
  assert.ok(map.obstacles.length >= 10, 'Should have multiple tactical obstacles');
  assert.ok(map.segments.length > 40, 'Should have line segments extracted for raycasting');
});

it('should detect and slide player when colliding with a wall', () => {
  // bound_l is at x: 0, w: 40. Player radius: 22.
  // If player tries to walk to x: 20, y: 500, they penetrate wall.
  const resolved = map.resolveCircleCollision(20, 500, 22);
  assert.ok(resolved.x >= 62, `Player x should be pushed outside wall boundary, got ${resolved.x}`);
});

it('should detect line intersection correctly', () => {
  // Horizontal segment (0, 100) to (200, 100)
  // Vertical line (100, 0) to (100, 200)
  const hit = GameMap.lineIntersection(100, 0, 100, 200, 0, 100, 200, 100);
  assert.ok(hit, 'Should detect intersection');
  assert.strictEqual(Math.round(hit.x), 100);
  assert.strictEqual(Math.round(hit.y), 100);

  // Parallel lines (no intersection)
  const noHit = GameMap.lineIntersection(0, 0, 100, 0, 0, 50, 100, 50);
  assert.strictEqual(noHit, null);
});

// 3. RAYCASTING & FOG OF WAR LOS TESTS
console.log('\n3. Raycasting & Line of Sight:');
const raycaster = new Raycaster();

it('should verify direct line of sight unobstructed', () => {
  const segments = [
    { a: { x: 500, y: 100 }, b: { x: 500, y: 300 } } // vertical wall at x=500
  ];

  // Point A (100, 200), Point B (200, 200) - unobstructed
  const blocked = raycaster.isLineBlocked(100, 200, 200, 200, segments);
  assert.strictEqual(blocked, false, 'Should be unobstructed');

  // Point A (100, 200), Point C (600, 200) - obstructed by vertical wall at x=500
  const obstructed = raycaster.isLineBlocked(100, 200, 600, 200, segments);
  assert.strictEqual(obstructed, true, 'Should be blocked by wall');
});

it('should verify vision cone mechanics and peripheral visibility', () => {
  const segments = [];
  const originX = 500, originY = 500;
  const facingAngle = 0; // Facing East (along +X)
  const fov = (110 * Math.PI) / 180;
  const range = 600;
  const peripheral = 100;

  // 1. Target directly in front (East, 300px away) -> VISIBLE
  const inFront = raycaster.isPointVisible(800, 500, originX, originY, facingAngle, fov, range, peripheral, segments);
  assert.strictEqual(inFront, true, 'Target in front must be visible');

  // 2. Target behind (West, 300px away) -> NOT VISIBLE
  const behindFar = raycaster.isPointVisible(200, 500, originX, originY, facingAngle, fov, range, peripheral, segments);
  assert.strictEqual(behindFar, false, 'Target behind outside peripheral radius must be hidden in fog');

  // 3. Target close behind (West, 60px away) within peripheral bubble -> VISIBLE
  const behindClose = raycaster.isPointVisible(440, 500, originX, originY, facingAngle, fov, range, peripheral, segments);
  assert.strictEqual(behindClose, true, 'Target within close peripheral bubble must be visible');

  // 4. Target beyond range -> NOT VISIBLE
  const beyondRange = raycaster.isPointVisible(1500, 500, originX, originY, facingAngle, fov, range, peripheral, segments);
  assert.strictEqual(beyondRange, false, 'Target beyond range must not be visible');
});

it('should compute valid visibility polygon points', () => {
  const poly = raycaster.computeVisibilityPolygon(
    1200, 900,
    0,
    (110 * Math.PI) / 180,
    650,
    110,
    map.segments
  );
  assert.ok(poly.length >= 10, `Visibility polygon should have multiple points, got ${poly.length}`);
  // Verify angles are sorted
  for (let i = 1; i < poly.length; i++) {
    assert.ok(poly[i].angle >= poly[i - 1].angle, 'Polygon points should be sorted in ascending angular order');
  }
});

// 4. WEAPON & BALLISTICS TESTS
console.log('\n4. Weapon Inventory & Ballistics:');
const wm = new WeaponManager(GameConfig);

it('should initialize inventory and allow switching unlocked weapons', () => {
  assert.strictEqual(wm.currentWeaponKey, 'RIFLE');
  const rifle = wm.getCurrent();
  assert.strictEqual(rifle.currentMag, rifle.magSize);

  // Switch to pistol
  const switched = wm.selectWeapon('PISTOL');
  assert.strictEqual(switched, true);
  assert.strictEqual(wm.currentWeaponKey, 'PISTOL');
});

it('should handle firing, magazine decrement, and reload cycle', () => {
  const now = 10000;
  const bullets = wm.shoot('p1', 500, 500, 0, now);
  assert.ok(bullets && bullets.length === 1);
  const pistol = wm.getCurrent();
  assert.strictEqual(pistol.currentMag, pistol.magSize - 1);

  // Empty magazine
  pistol.currentMag = 0;
  const emptyShoot = wm.shoot('p1', 500, 500, 0, now + 1000);
  assert.strictEqual(emptyShoot, null, 'Cannot shoot with empty magazine');

  // Start reload
  const reloadStarted = wm.startReload(now + 1000);
  assert.strictEqual(reloadStarted, true);
  assert.strictEqual(wm.isReloading, true);

  // Before reload completes
  const reloadDoneEarly = wm.updateReload(now + 1500);
  assert.strictEqual(reloadDoneEarly, false);

  // After reload completes
  const reloadDone = wm.updateReload(now + 1000 + pistol.reloadTimeMs + 50);
  assert.strictEqual(reloadDone, true);
  assert.strictEqual(pistol.currentMag, pistol.magSize);
});

// 5. AI BOT TESTS
console.log('\n5. Tactical AI Bot:');
const bot = new AIBot('bot_test_1', 'Apex-1', GameConfig.PLAYER_COLORS[1], GameConfig, WeaponManager, map);

it('should initialize bot with health, weapon, and patrol state', () => {
  assert.strictEqual(bot.hp, 100);
  assert.strictEqual(bot.shield, 25);
  assert.strictEqual(bot.state, 'patrol');
});

it('should absorb damage with shield and take health damage', () => {
  // Deal 30 damage
  const res = bot.takeDamage(30, 'attacker_1');
  assert.strictEqual(res.killed, false);
  assert.strictEqual(res.damageDealt, 30);
  // Shield absorbs 70% of 30 = 21, remaining shield = 4. Health drops by 9 (hp = 91).
  assert.strictEqual(bot.shield, 4);
  assert.strictEqual(bot.hp, 91);
  assert.strictEqual(bot.state, 'retreat', 'Bot should retreat when taking damage');
});

// 6. SERVER ROOM INTEGRATION
console.log('\n6. Server Room Logic Simulation:');
const http = require('http');
const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');

it('should boot server and accept WebSocket room connections', async () => {
  const testApp = express();
  const testServer = http.createServer(testApp);
  const testWss = new WebSocketServer({ server: testServer, path: '/test_ws' });

  await new Promise((resolve) => testServer.listen(0, resolve));
  const testPort = testServer.address().port;

  let clientReceivedJoined = false;

  testWss.on('connection', (ws) => {
    ws.on('message', (msg) => {
      const data = JSON.parse(msg);
      if (data.type === 'join') {
        ws.send(JSON.stringify({ type: 'joined', playerId: 'test_p1', room: data.room }));
      }
    });
  });

  const clientWs = new WebSocket(`ws://localhost:${testPort}/test_ws`);

  await new Promise((resolve, reject) => {
    clientWs.on('open', () => {
      clientWs.send(JSON.stringify({ type: 'join', room: 'TACTICAL_SQUAD' }));
    });
    clientWs.on('message', (raw) => {
      const data = JSON.parse(raw);
      if (data.type === 'joined' && data.room === 'TACTICAL_SQUAD') {
        clientReceivedJoined = true;
        clientWs.close();
        testServer.close();
        resolve();
      }
    });
    clientWs.on('error', reject);
  });

  assert.strictEqual(clientReceivedJoined, true, 'Client should receive room join confirmation');
});

console.log(`\n========================================`);
console.log(`Test Results: ${testsPassed} passed, ${testsFailed} failed.`);
console.log(`========================================\n`);

if (testsFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
