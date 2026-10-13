// ---------- Setup ----------
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ec9e8);
scene.fog = new THREE.Fog(0x9ec9e8, 20, 110);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 200);
camera.rotation.order = 'YXZ';
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
container.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0x556b2f, 0.8));
const sun = new THREE.DirectionalLight(0xffffff, 0.6);
sun.position.set(30, 50, 20);
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(120, 120),
  new THREE.MeshLambertMaterial({ color: 0x7a8f4a })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// ---------- HUD ----------
const hud = document.createElement('div');
hud.id = 'hud';
document.body.appendChild(hud);
const banner = document.createElement('div');
banner.id = 'banner';
document.body.appendChild(banner);

// ---------- Map ----------
const HALF = 30;
const colliders = [];
const wallMeshes = [];
const wallMat = new THREE.MeshLambertMaterial({ color: 0xb08968 });
const crateMat = new THREE.MeshLambertMaterial({ color: 0x4a6fa5 });

function addWall(x, z, w, d, h = 2.2, mat = wallMat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, h / 2, z);
  scene.add(m);
  wallMeshes.push(m);
  colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
}

// Perimeter
addWall(0, -HALF, HALF * 2, 1, 4);
addWall(0, HALF, HALF * 2, 1, 4);
addWall(-HALF, 0, 1, HALF * 2, 4);
addWall(HALF, 0, 1, HALF * 2, 4);

// Interior "broken walls" / small structures (x, z, width, depth, height)
[
  [-10, -8, 8, 0.6, 2.2], [10, -8, 8, 0.6, 1.6], [0, -16, 0.6, 10, 2.2],
  [-15, 5, 0.6, 10, 1.4], [15, 5, 0.6, 10, 2.2], [0, 6, 10, 0.6, 1.5],
  [-8, 16, 6, 0.6, 2.2], [8, 16, 6, 0.6, 1.2], [-20, -20, 6, 0.6, 2.0],
  [20, -20, 6, 0.6, 1.6], [-22, -2, 4, 4, 2.5], [22, -2, 4, 4, 2.5]
].forEach(([x, z, w, d, h]) => addWall(x, z, w, d, h));

// ---------- Weapons ----------
const WEAPONS = {
  none:  null,
  pistol: { name: 'Pistol', damage: 25, rate: 0.35 },
  rifle:  { name: 'Rifle',  damage: 18, rate: 0.12 }
};
let weapon = WEAPONS.none;

// Weapon crate in front of the spawn
const crate = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 1), crateMat);
crate.position.set(0, 0.5, 21);
scene.add(crate);
let crateTaken = false;

// ---------- Player ----------
const player = { pos: new THREE.Vector3(0, 1.7, 25), yaw: 0, pitch: 0, health: 100, radius: 0.4 };
const SPEED = 5, SENS = 0.004;

function collides(x, z, r) {
  for (const c of colliders) {
    if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return true;
  }
  return false;
}
function tryMove(pos, dx, dz, r) {
  if (!collides(pos.x + dx, pos.z, r)) pos.x += dx;
  if (!collides(pos.x, pos.z + dz, r)) pos.z += dz;
}

// ---------- Bots ----------
const bots = [];
const botGeo = new THREE.BoxGeometry(0.8, 1.8, 0.8);
const botMat = new THREE.MeshLambertMaterial({ color: 0xc0392b });
for (let i = 0; i < 5; i++) {
  let x, z;
  do { x = (Math.random() - 0.5) * 50; z = -25 + Math.random() * 25; } while (collides(x, z, 1));
  const mesh = new THREE.Mesh(botGeo, botMat);
  mesh.position.set(x, 0.9, z);
  scene.add(mesh);
  bots.push({ mesh, health: 60, alive: true, shootTimer: Math.random() });
}

// ---------- Shrinking zone ----------
const ZONE_START = 43, ZONE_END = 8, ZONE_TIME = 120;
let zoneRadius = ZONE_START;
const zoneMesh = new THREE.Mesh(
  new THREE.CylinderGeometry(1, 1, 30, 64, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
);
zoneMesh.position.y = 15;
scene.add(zoneMesh);

// ---------- Match state ----------
let matchOver = false;
let elapsed = 0;
let fireCooldown = 0;
const raycaster = new THREE.Raycaster();
const tmp = new THREE.Vector3();

function endMatch(won) {
  matchOver = true;
  banner.textContent = won ? 'YOU WIN' : 'ELIMINATED';
  banner.style.display = 'block';
  // TODO (VATAR SDK): report result / settle wager here once keys + docs are available
  setTimeout(() => addEventListener('pointerdown', () => location.reload(), { once: true }), 800);
}

function shoot() {
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  const targets = [...wallMeshes, ...bots.filter(b => b.alive).map(b => b.mesh)];
  const hit = raycaster.intersectObjects(targets)[0];
  player.pitch += 0.01; // small recoil
  if (!hit) return;
  const bot = bots.find(b => b.mesh === hit.object);
  if (bot) {
    bot.health -= weapon.damage;
    if (bot.health <= 0) {
      bot.alive = false;
      scene.remove(bot.mesh);
      if (bots.every(b => !b.alive)) endMatch(true);
    }
  }
}

function botCanSee(bot) {
  tmp.copy(player.pos).sub(bot.mesh.position);
  const dist = tmp.length();
  raycaster.set(bot.mesh.position, tmp.normalize());
  const hit = raycaster.intersectObjects(wallMeshes)[0];
  return !hit || hit.distance > dist;
}

// ---------- Update ----------
function update(dt) {
  const inp = window.gameInput;

  // Look
  player.yaw -= inp.lookDX * SENS;
  player.pitch -= inp.lookDY * SENS;
  player.pitch = Math.max(-1.2, Math.min(1.2, player.pitch));
  inp.lookDX = 0; inp.lookDY = 0;

  // Move
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
  const mx = (rx * inp.moveX + fx * -inp.moveY) * SPEED * dt;
  const mz = (rz * inp.moveX + fz * -inp.moveY) * SPEED * dt;
  tryMove(player.pos, mx, mz, player.radius);

  camera.position.copy(player.pos);
  camera.rotation.set(player.pitch, player.yaw, 0);

  // Crate pickup
  if (!crateTaken && Math.hypot(player.pos.x - crate.position.x, player.pos.z - crate.position.z) < 1.8) {
    crateTaken = true;
    weapon = WEAPONS.rifle;
    scene.remove(crate);
  }

  // Shooting
  fireCooldown -= dt;
  if (inp.firing && weapon && fireCooldown <= 0) {
    fireCooldown = weapon.rate;
    shoot();
  }

  // Bots
  for (const bot of bots) {
    if (!bot.alive) continue;
    tmp.set(player.pos.x - bot.mesh.position.x, 0, player.pos.z - bot.mesh.position.z);
    const dist = tmp.length();
    tmp.normalize();
    if (dist > 8) tryMove(bot.mesh.position, tmp.x * 2.2 * dt, tmp.z * 2.2 * dt, 0.5);
    bot.mesh.lookAt(player.pos.x, 0.9, player.pos.z);
    bot.shootTimer -= dt;
    if (bot.shootTimer <= 0 && dist < 25 && botCanSee(bot)) {
      bot.shootTimer = 1;
      if (Math.random() < 0.35) player.health -= 8;
    }
  }

  // Zone
  elapsed += dt;
  zoneRadius = ZONE_START - (ZONE_START - ZONE_END) * Math.min(elapsed / ZONE_TIME, 1);
  zoneMesh.scale.set(zoneRadius, 1, zoneRadius);
  if (Math.hypot(player.pos.x, player.pos.z) > zoneRadius) player.health -= 5 * dt;

  if (player.health <= 0) endMatch(false);

  hud.innerHTML =
    `HP: ${Math.max(0, Math.ceil(player.health))}<br>` +
    `Weapon: ${weapon ? weapon.name : 'Go to the crate'}<br>` +
    `Enemies: ${bots.filter(b => b.alive).length}<br>` +
    `Zone: ${Math.ceil(zoneRadius)}m`;
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (!matchOver) update(dt);
  renderer.render(scene, camera);
}
requestAnimationFrame(loop);