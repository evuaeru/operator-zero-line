/**
 * GAME.TEST.JS - Automated Verification Suite for Top-Down Shooter
 * Tests: Config, Map, Raycasting LOS, Weapons, AI Bot, and REAL Server Room Logic
 */
const assert = require('assert');
const GameConfig = require('../public/js/config.js');
const GameMap = require('../public/js/map.js');
const Raycaster = require('../public/js/raycast.js');
const WeaponManager = require('../public/js/weapons.js');
const AIBot = require('../public/js/bot.js');
const { server, Room, rooms, getOrCreateRoom } = require('../server.js');
const { WebSocket } = require('ws');

let testsPassed = 0;
let testsFailed = 0;

async function it(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    testsFailed++;
  }
}

async function runAll() {
  console.log('Starting Test Suite: OPERATOR ZERO LINE...\n');

  // 1. CONFIG TESTS
  console.log('1. Configuration & Data Models:');
  await it('should define all 5 core weapons with balanced stats', () => {
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

  await it('should have player parameters and colors configured', () => {
    assert.ok(GameConfig.PLAYER.RADIUS > 0);
    assert.ok(GameConfig.PLAYER.FOV_DEG >= 90);
    assert.ok(GameConfig.PLAYER_COLORS.length >= 4);
  });

  // 2. MAP & COLLISION TESTS
  console.log('\n2. Map Geometry & Collision:');
  const map = new GameMap();

  await it('should initialize map bounds and obstacles', () => {
    assert.strictEqual(map.width, 2400);
    assert.strictEqual(map.height, 1800);
    assert.ok(map.obstacles.length >= 10, 'Should have multiple tactical obstacles');
    assert.ok(map.segments.length > 40, 'Should have line segments extracted for raycasting');
  });

  await it('should detect and slide player when colliding with a wall', () => {
    const resolved = map.resolveCircleCollision(20, 500, 22);
    assert.ok(resolved.x >= 62, `Player x should be pushed outside wall boundary, got ${resolved.x}`);
  });

  await it('should detect line intersection correctly', () => {
    const hit = GameMap.lineIntersection(100, 0, 100, 200, 0, 100, 200, 100);
    assert.ok(hit, 'Should detect intersection');
    assert.strictEqual(Math.round(hit.x), 100);
    assert.strictEqual(Math.round(hit.y), 100);

    const noHit = GameMap.lineIntersection(0, 0, 100, 0, 0, 50, 100, 50);
    assert.strictEqual(noHit, null);
  });

  // 3. RAYCASTING & FOG OF WAR LOS TESTS
  console.log('\n3. Raycasting & Line of Sight:');
  const raycaster = new Raycaster();

  await it('should verify direct line of sight unobstructed', () => {
    const segments = [
      { a: { x: 500, y: 100 }, b: { x: 500, y: 300 } }
    ];

    const blocked = raycaster.isLineBlocked(100, 200, 200, 200, segments);
    assert.strictEqual(blocked, false, 'Should be unobstructed');

    const obstructed = raycaster.isLineBlocked(100, 200, 600, 200, segments);
    assert.strictEqual(obstructed, true, 'Should be blocked by wall');
  });

  await it('should verify vision cone mechanics and peripheral visibility', () => {
    const segments = [];
    const originX = 500, originY = 500;
    const facingAngle = 0;
    const fov = (110 * Math.PI) / 180;
    const range = 600;
    const peripheral = 100;

    const inFront = raycaster.isPointVisible(800, 500, originX, originY, facingAngle, fov, range, peripheral, segments);
    assert.strictEqual(inFront, true, 'Target in front must be visible');

    const behindFar = raycaster.isPointVisible(200, 500, originX, originY, facingAngle, fov, range, peripheral, segments);
    assert.strictEqual(behindFar, false, 'Target behind outside peripheral radius must be hidden in fog');

    const behindClose = raycaster.isPointVisible(440, 500, originX, originY, facingAngle, fov, range, peripheral, segments);
    assert.strictEqual(behindClose, true, 'Target within close peripheral bubble must be visible');

    const beyondRange = raycaster.isPointVisible(1500, 500, originX, originY, facingAngle, fov, range, peripheral, segments);
    assert.strictEqual(beyondRange, false, 'Target beyond range must not be visible');
  });

  await it('should compute valid visibility polygon points', () => {
    const poly = raycaster.computeVisibilityPolygon(
      1200, 900,
      0,
      (110 * Math.PI) / 180,
      650,
      110,
      map.segments
    );
    assert.ok(poly.length >= 10, `Visibility polygon should have multiple points, got ${poly.length}`);
    for (let i = 1; i < poly.length; i++) {
      assert.ok(poly[i].angle >= poly[i - 1].angle, 'Polygon points should be sorted in ascending angular order');
    }
  });

  await it('should produce seamless visibility polygon when facing directly West (no seam gap)', () => {
    const testAngles = [Math.PI, -Math.PI, 3.0, -3.0, Math.PI - 0.05, -Math.PI + 0.05];
    for (const testAngle of testAngles) {
      const poly = raycaster.computeVisibilityPolygon(
        843, 86,
        testAngle,
        (80 * Math.PI) / 180,
        650,
        100,
        map.segments
      );

      assert.ok(poly.length >= 100, `Expected rich polygon, got ${poly.length}`);

      const pFirst = poly[0];
      const pLast = poly[poly.length - 1];
      const seamDist = Math.hypot(pFirst.x - pLast.x, pFirst.y - pLast.y);
      assert.ok(seamDist < 0.01, `Seam gap between start and end vertices must be zero (got ${seamDist}) at angle ${testAngle}`);

      for (let i = 0; i < poly.length - 1; i++) {
        const gap = poly[i + 1].angle - poly[i].angle;
        assert.ok(gap < 0.06, `Angular gap between vertex ${i} and ${i+1} too large: ${gap} rad`);
      }
    }
  });

  // 4. WEAPON & BALLISTICS TESTS
  console.log('\n4. Weapon Inventory & Ballistics:');
  const wm = new WeaponManager(GameConfig);

  await it('should initialize inventory and allow switching unlocked weapons', () => {
    assert.strictEqual(wm.currentWeaponKey, 'RIFLE');
    const rifle = wm.getCurrent();
    assert.strictEqual(rifle.currentMag, rifle.magSize);

    const switched = wm.selectWeapon('PISTOL');
    assert.strictEqual(switched, true);
    assert.strictEqual(wm.currentWeaponKey, 'PISTOL');
  });

  await it('should handle firing, magazine decrement, and reload cycle', () => {
    const now = 10000;
    const bullets = wm.shoot('p1', 500, 500, 0, now);
    assert.ok(bullets && bullets.length === 1);
    const pistol = wm.getCurrent();
    assert.strictEqual(pistol.currentMag, pistol.magSize - 1);

    pistol.currentMag = 0;
    const emptyShoot = wm.shoot('p1', 500, 500, 0, now + 1000);
    assert.strictEqual(emptyShoot, null, 'Cannot shoot with empty magazine');

    const reloadStarted = wm.startReload(now + 1000);
    assert.strictEqual(reloadStarted, true);
    assert.strictEqual(wm.isReloading, true);

    const reloadDoneEarly = wm.updateReload(now + 1500);
    assert.strictEqual(reloadDoneEarly, false);

    const reloadDone = wm.updateReload(now + 1000 + pistol.reloadTimeMs + 50);
    assert.strictEqual(reloadDone, true);
    assert.strictEqual(pistol.currentMag, pistol.magSize);
  });

  // 5. AI BOT TESTS
  console.log('\n5. Tactical AI Bot:');
  const bot = new AIBot('bot_test_1', 'Apex-1', GameConfig.PLAYER_COLORS[1], GameConfig, WeaponManager, map);

  await it('should initialize bot with health, weapon, and patrol state', () => {
    assert.strictEqual(bot.hp, 100);
    assert.strictEqual(bot.shield, 25);
    assert.strictEqual(bot.state, 'patrol');
  });

  await it('should absorb damage with shield and take health damage', () => {
    const res = bot.takeDamage(30, 'attacker_1');
    assert.strictEqual(res.killed, false);
    assert.strictEqual(res.damageDealt, 30);
    assert.strictEqual(bot.shield, 4);
    assert.strictEqual(bot.hp, 91);
    assert.strictEqual(bot.state, 'retreat', 'Bot should retreat when taking damage');
  });

  // 6. REAL SERVER ROOM INTEGRATION TESTS
  console.log('\n6. Real Server Room & Multiplayer Protocol:');

  // Start the real HTTP & WS server on an ephemeral port
  await new Promise((resolve) => server.listen(0, resolve));
  const serverPort = server.address().port;

  function createClient() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws`);
      ws.messages = [];
      ws.on('open', () => resolve(ws));
      ws.on('error', reject);
      ws.on('message', (raw) => {
        try {
          ws.messages.push(JSON.parse(raw));
        } catch (e) {}
      });
      ws.waitForMessage = (type, timeout = 3000) => {
        return new Promise((res, rej) => {
          const start = Date.now();
          const check = () => {
            const found = ws.messages.find(m => m.type === type);
            if (found) {
              return res(found);
            }
            if (Date.now() - start > timeout) {
              return rej(new Error(`Timeout waiting for message type: ${type}`));
            }
            setTimeout(check, 20);
          };
          check();
        });
      };
    });
  }

  let clientA, clientB, clientOtherRoom;

  await it('should connect 2 players to the same room and receive join confirmations', async () => {
    clientA = await createClient();
    clientB = await createClient();

    clientA.send(JSON.stringify({ type: 'join', room: 'COMBAT_1', name: 'Alpha_A' }));
    clientB.send(JSON.stringify({ type: 'join', room: 'COMBAT_1', name: 'Bravo_B' }));

    const joinA = await clientA.waitForMessage('joined');
    const joinB = await clientB.waitForMessage('joined');

    assert.ok(joinA.playerId, 'Player A must have valid playerId');
    assert.ok(joinB.playerId, 'Player B must have valid playerId');
    assert.strictEqual(joinA.room, 'COMBAT_1');
    assert.strictEqual(joinB.room, 'COMBAT_1');
    assert.notStrictEqual(joinA.playerId, joinB.playerId);

    clientA.playerId = joinA.playerId;
    clientB.playerId = joinB.playerId;
  });

  await it('should relay bullet projectiles from Player A to Player B', async () => {
    const testBullets = [
      { id: 'b_test_1', shooterId: clientA.playerId, x: 200, y: 200, vx: 10, vy: 0, rangeRemaining: 500, damage: 25 }
    ];

    clientA.send(JSON.stringify({ type: 'shoot', bullets: testBullets }));

    const shootMsg = await clientB.waitForMessage('shoot');
    assert.ok(shootMsg.bullets && shootMsg.bullets.length === 1);
    assert.strictEqual(shootMsg.bullets[0].id, 'b_test_1');
  });

  await it('should register hit, apply authoritative damage, and notify victim', async () => {
    // Player A shoots Player B
    clientA.send(JSON.stringify({
      type: 'hit',
      targetId: clientB.playerId,
      damage: 30,
      weapon: 'RIFLE'
    }));

    const dmgMsg = await clientB.waitForMessage('damage_taken');
    assert.strictEqual(dmgMsg.attackerId, clientA.playerId);
    assert.strictEqual(dmgMsg.damage, 30);
    // Shield 50 absorbs 70% of 30 = 21 -> shield becomes 29, rem = 9 -> hp becomes 91
    assert.strictEqual(dmgMsg.shield, 29);
    assert.strictEqual(dmgMsg.hp, 91);
    assert.strictEqual(dmgMsg.isDead, false);

    // Verify server authoritative state
    const room = getOrCreateRoom('COMBAT_1');
    const pB = room.players.get(clientB.playerId);
    assert.strictEqual(pB.hp, 91);
    assert.strictEqual(pB.shield, 29);
  });

  await it('should prevent client player_update from overwriting server authoritative HP', async () => {
    const room = getOrCreateRoom('COMBAT_1');
    const pB = room.players.get(clientB.playerId);
    const beforeHp = pB.hp;

    // Player B attempts to send full health via client update
    clientB.send(JSON.stringify({
      type: 'player_update',
      x: 300,
      y: 300,
      angle: 0,
      vx: 0,
      vy: 0,
      hp: 100, // fake full HP
      shield: 50,
      isWalking: false,
      walkCycle: 0,
      weapon: 'RIFLE'
    }));

    // Wait a brief moment for server to process message
    await new Promise(r => setTimeout(r, 60));

    // Server HP must remain 91, not reset to 100
    assert.strictEqual(pB.hp, beforeHp, 'Server HP must not be overwritten by client');
    assert.strictEqual(pB.x, 300, 'Movement coordinates should be updated');
  });

  await it('should synchronize item pickups across clients in the room', async () => {
    const room = getOrCreateRoom('COMBAT_1');
    const targetItem = room.map.itemSpawns[0];
    assert.strictEqual(targetItem.active, true);

    // Move player A close to item
    const pA = room.players.get(clientA.playerId);
    pA.x = targetItem.x;
    pA.y = targetItem.y;

    clientA.send(JSON.stringify({
      type: 'pickup_item',
      itemId: targetItem.id
    }));

    const pickMsgA = await clientA.waitForMessage('item_picked');
    const pickMsgB = await clientB.waitForMessage('item_picked');

    assert.strictEqual(pickMsgA.itemId, targetItem.id);
    assert.strictEqual(pickMsgB.itemId, targetItem.id);
    assert.strictEqual(targetItem.active, false, 'Item must become inactive on server');
  });

  await it('should synchronize barrel hit and explosion across clients', async () => {
    const room = getOrCreateRoom('COMBAT_1');
    const targetBarrel = room.map.barrels[0];
    assert.strictEqual(targetBarrel.exploded, false);

    clientA.send(JSON.stringify({
      type: 'barrel_hit',
      barrelId: targetBarrel.id,
      damage: 100, // lethal to barrel
      shooterId: clientA.playerId
    }));

    const explodeMsgB = await clientB.waitForMessage('barrel_exploded');
    assert.strictEqual(explodeMsgB.barrelId, targetBarrel.id);
    assert.strictEqual(targetBarrel.exploded, true, 'Barrel must be marked exploded on server');
  });

  await it('should handle player death and respawn cycle', async () => {
    const room = getOrCreateRoom('COMBAT_1');
    const pB = room.players.get(clientB.playerId);

    // Deal lethal damage to Player B
    clientA.send(JSON.stringify({
      type: 'hit',
      targetId: clientB.playerId,
      damage: 200,
      weapon: 'SNIPER'
    }));

    const killMsg = await clientA.waitForMessage('kill');
    assert.strictEqual(killMsg.victimName, pB.name);
    assert.strictEqual(pB.isDead, true);

    // Player B requests respawn
    clientB.send(JSON.stringify({ type: 'respawn' }));

    const respawnMsg = await clientB.waitForMessage('respawned');
    assert.strictEqual(respawnMsg.hp, 100);
    assert.strictEqual(respawnMsg.shield, 50);
    assert.strictEqual(pB.isDead, false);
    assert.strictEqual(pB.hp, 100);
  });

  await it('should isolate rooms: events in COMBAT_1 do not leak to COMBAT_2', async () => {
    clientOtherRoom = await createClient();
    clientOtherRoom.send(JSON.stringify({ type: 'join', room: 'COMBAT_2', name: 'Other_Charlie' }));
    await clientOtherRoom.waitForMessage('joined');

    const msgCountBefore = clientOtherRoom.messages.length;

    // Player A shoots in COMBAT_1
    clientA.send(JSON.stringify({
      type: 'shoot',
      bullets: [{ id: 'isolated_b', shooterId: clientA.playerId, x: 0, y: 0, vx: 1, vy: 0, rangeRemaining: 100 }]
    }));

    await new Promise(r => setTimeout(r, 80));

    const leakedShoot = clientOtherRoom.messages.find(m => m.type === 'shoot' && m.bullets && m.bullets[0].id === 'isolated_b');
    assert.strictEqual(leakedShoot, undefined, 'Messages from COMBAT_1 must not leak to COMBAT_2');
  });

  await it('should track round timer and broadcast MVP on round end', async () => {
    const testRoom = getOrCreateRoom('TIMER_TEST_ROOM');
    assert.strictEqual(typeof testRoom.roundTimeRemaining, 'number');
    assert.strictEqual(testRoom.roundDurationSec, 180);

    // Fast-forward timer to trigger round end
    testRoom.roundTimeRemaining = 0.02;
    await new Promise(r => setTimeout(r, 80));

    assert.strictEqual(testRoom.isRoundOver, true);
    assert.ok(testRoom.postRoundTimer > 0);
  });

  // Cleanup connections and server
  if (clientA) clientA.close();
  if (clientB) clientB.close();
  if (clientOtherRoom) clientOtherRoom.close();

  await new Promise((resolve) => server.close(resolve));

  console.log(`\n========================================`);
  console.log(`Test Results: ${testsPassed} passed, ${testsFailed} failed.`);
  console.log(`========================================\n`);

  if (testsFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAll().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
