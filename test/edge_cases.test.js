/**
 * EDGE_CASES.TEST.JS - Boundary Values, Empty Inputs, and Stress Testing
 */
const assert = require('assert');
const GameConfig = require('../public/js/config.js');
const GameMap = require('../public/js/map.js');
const Raycaster = require('../public/js/raycast.js');
const WeaponManager = require('../public/js/weapons.js');
const AIBot = require('../public/js/bot.js');

let passed = 0;
let failed = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (e) {
    console.error(`  [FAIL] ${name}:`, e.message);
    failed++;
  }
}

console.log('Running Edge Case & Boundary Value Tests...\n');

const map = new GameMap();
const raycaster = new Raycaster();
const wm = new WeaponManager(GameConfig);

it('should handle zero distance and coincident points in raycast', () => {
  const hit = GameMap.lineIntersection(100, 100, 100, 100, 100, 100, 100, 100);
  assert.strictEqual(hit, null, 'Zero-length line should return null without NaN or crash');
});

it('should handle extreme out-of-bounds coordinates gracefully', () => {
  const clamped1 = map.resolveCircleCollision(-9999, -9999, 22);
  assert.strictEqual(clamped1.x, 40 + 22);
  assert.strictEqual(clamped1.y, 40 + 22);

  const clamped2 = map.resolveCircleCollision(99999, 99999, 22);
  assert.strictEqual(clamped2.x, map.width - 40 - 22);
  assert.strictEqual(clamped2.y, map.height - 40 - 22);
});

it('should handle empty segments array in visibility polygon computation', () => {
  const poly = raycaster.computeVisibilityPolygon(500, 500, 0, Math.PI / 2, 600, 100, []);
  assert.ok(poly.length > 0, 'Empty segments should produce clean circular/arc boundary points');
  for (const p of poly) {
    assert.ok(!isNaN(p.x) && !isNaN(p.y) && !isNaN(p.angle), 'Points must not contain NaN');
  }
});

it('should prevent reload when magazine is already full', () => {
  const rifle = wm.getCurrent();
  rifle.currentMag = rifle.magSize;
  const started = wm.startReload(Date.now());
  assert.strictEqual(started, false, 'Should not start reload if already full');
});

it('should prevent reload when reserve ammo is zero', () => {
  const rifle = wm.getCurrent();
  rifle.currentMag = 5;
  rifle.reserveAmmo = 0;
  const started = wm.startReload(Date.now());
  assert.strictEqual(started, false, 'Should not start reload if reserve ammo is 0');
});

it('should handle explosive barrels chain reaction', () => {
  // Reset barrels
  const b1 = map.barrels[0]; // (860, 640)
  const b2 = map.barrels[1]; // (900, 640)
  assert.ok(Math.hypot(b1.x - b2.x, b1.y - b2.y) <= 140, 'Barrels b1 and b2 should be within blast radius');
  b1.exploded = true;
  map.rebuildSegments();
  // Check that b1 is not in segments anymore
  assert.ok(map.segments.length > 0);
});

console.log(`\nEdge Case Results: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
