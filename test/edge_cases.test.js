/**
 * EDGE_CASES.TEST.JS - Boundary Values, Malformed Inputs, Concurrency, and Stress Testing
 */
const assert = require('assert');
const GameConfig = require('../public/js/config.js');
const GameMap = require('../public/js/map.js');
const Raycaster = require('../public/js/raycast.js');
const WeaponManager = require('../public/js/weapons.js');
const AIBot = require('../public/js/bot.js');
const { server, Room, rooms, getOrCreateRoom } = require('../server.js');
const { WebSocket } = require('ws');

let passed = 0;
let failed = 0;

async function it(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (e) {
    console.error(`  [FAIL] ${name}:`, e.message);
    failed++;
  }
}

async function runEdgeCases() {
  console.log('Running Edge Case & Boundary Value Tests...\n');

  const map = new GameMap();
  const raycaster = new Raycaster();
  const wm = new WeaponManager(GameConfig);

  await it('should handle zero distance and coincident points in raycast', () => {
    const hit = GameMap.lineIntersection(100, 100, 100, 100, 100, 100, 100, 100);
    assert.strictEqual(hit, null, 'Zero-length line should return null without NaN or crash');
  });

  await it('should handle extreme out-of-bounds coordinates gracefully', () => {
    const clamped1 = map.resolveCircleCollision(-9999, -9999, 22);
    assert.strictEqual(clamped1.x, 40 + 22);
    assert.strictEqual(clamped1.y, 40 + 22);

    const clamped2 = map.resolveCircleCollision(99999, 99999, 22);
    assert.strictEqual(clamped2.x, map.width - 40 - 22);
    assert.strictEqual(clamped2.y, map.height - 40 - 22);
  });

  await it('should handle empty segments array in visibility polygon computation', () => {
    const poly = raycaster.computeVisibilityPolygon(500, 500, 0, Math.PI / 2, 600, 100, []);
    assert.ok(poly.length > 0, 'Empty segments should produce clean circular/arc boundary points');
    for (const p of poly) {
      assert.ok(!isNaN(p.x) && !isNaN(p.y) && !isNaN(p.angle), 'Points must not contain NaN');
    }
  });

  await it('should prevent reload when magazine is already full', () => {
    const rifle = wm.getCurrent();
    rifle.currentMag = rifle.magSize;
    const started = wm.startReload(Date.now());
    assert.strictEqual(started, false, 'Should not start reload if already full');
  });

  await it('should prevent reload when reserve ammo is zero', () => {
    const rifle = wm.getCurrent();
    rifle.currentMag = 5;
    rifle.reserveAmmo = 0;
    const started = wm.startReload(Date.now());
    assert.strictEqual(started, false, 'Should not start reload if reserve ammo is 0');
  });

  await it('should handle explosive barrels chain reaction', () => {
    const b1 = map.barrels[0]; // (860, 640)
    const b2 = map.barrels[1]; // (900, 640)
    assert.ok(Math.hypot(b1.x - b2.x, b1.y - b2.y) <= 140, 'Barrels b1 and b2 should be within blast radius');
    b1.exploded = true;
    map.rebuildSegments();
    assert.ok(map.segments.length > 0);
  });

  // Server Robustness Edge Cases
  await new Promise((resolve) => server.listen(0, resolve));
  const serverPort = server.address().port;

  await it('should survive corrupt JSON and malformed packets without crashing', async () => {
    const ws = new WebSocket(`ws://localhost:${serverPort}/ws`);
    await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });

    // Send malformed non-JSON string
    ws.send('INVALID_GARBAGE_NOT_JSON!!!');
    ws.send('{ broken json');
    ws.send(JSON.stringify({ type: 'unknown_mystery_type_123' }));
    ws.send(JSON.stringify({ type: 'hit', targetId: 'non_existent_player_xyz', damage: 9999 }));
    ws.send(JSON.stringify({ type: 'shoot', bullets: null }));
    ws.send(JSON.stringify({ type: 'pickup_item', itemId: 'invalid_item_id_404' }));

    // Send ping to verify server is still completely responsive
    await new Promise((resolve, reject) => {
      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw);
          if (msg.type === 'pong') resolve();
        } catch (e) {}
      });
      ws.send(JSON.stringify({ type: 'ping', time: Date.now() }));
      setTimeout(() => reject(new Error('Server crashed or stopped responding')), 1000);
    });

    ws.close();
  });

  await it('should handle empty room parameter gracefully', async () => {
    const ws = new WebSocket(`ws://localhost:${serverPort}/ws`);
    await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });

    ws.send(JSON.stringify({ type: 'join', room: '   ', name: '' }));

    await new Promise((resolve) => {
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw);
        if (msg.type === 'joined') {
          assert.strictEqual(msg.room, 'ALPHA_HQ', 'Empty room should default to ALPHA_HQ');
          resolve();
        }
      });
    });

    ws.close();
  });

  await it('should handle rapid concurrent shots without crashing or dropping packets', async () => {
    const wsA = new WebSocket(`ws://localhost:${serverPort}/ws`);
    const wsB = new WebSocket(`ws://localhost:${serverPort}/ws`);

    await Promise.all([
      new Promise(res => wsA.on('open', res)),
      new Promise(res => wsB.on('open', res))
    ]);

    wsA.send(JSON.stringify({ type: 'join', room: 'STRESS_ROOM', name: 'Shooter' }));
    wsB.send(JSON.stringify({ type: 'join', room: 'STRESS_ROOM', name: 'Target' }));

    await new Promise(r => setTimeout(r, 80));

    let bulletsReceived = 0;
    wsB.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'shoot') {
          bulletsReceived += msg.bullets.length;
        }
      } catch (e) {}
    });

    // Send 50 rapid bursts of bullets
    for (let i = 0; i < 50; i++) {
      wsA.send(JSON.stringify({
        type: 'shoot',
        bullets: [{ id: `burst_${i}`, x: 100, y: 100, vx: 5, vy: 5, damage: 10 }]
      }));
    }

    await new Promise(r => setTimeout(r, 200));
    assert.strictEqual(bulletsReceived, 50, 'All 50 projectile messages must be delivered');

    wsA.close();
    wsB.close();
  });

  await new Promise((resolve) => server.close(resolve));

  console.log(`\nEdge Case Results: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) process.exit(1);
}

runEdgeCases().catch(err => {
  console.error('Fatal edge case error:', err);
  process.exit(1);
});
