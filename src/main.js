import * as THREE from 'three';

const WORLD = 80;
const START = new THREE.Vector3(0, 16, 54);
const FARM_START = new THREE.Vector3(0, 9, 49);
const RACE_START = new THREE.Vector3(-15, 8, 72);
const SPRAY_MIN_HEIGHT = 4;
const SPRAY_MAX_HEIGHT = 14;
const WALLS = [
  { id: 'north', label: 'С', x: 0, z: -1, rotation: Math.PI },
  { id: 'east', label: 'В', x: 1, z: 0, rotation: Math.PI / 2 },
  { id: 'south', label: 'Ю', x: 0, z: 1, rotation: 0 },
  { id: 'west', label: 'З', x: -1, z: 0, rotation: -Math.PI / 2 },
];
const SURFACES = [...WALLS, { id: 'roof', label: 'КР' }];
const SAMPLE_COUNT = 5;
const SCAN_BRUSH_RADIUS = 48;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb9cdd5);
scene.fog = new THREE.FogExp2(0xb9cdd5, 0.0055);

const container = document.querySelector('#scene');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.65;
container.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(65, container.clientWidth / container.clientHeight, 0.1, 500);
const ambient = new THREE.HemisphereLight(0xf1f7ff, 0x697b77, 2.3);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffe9cb, 3.1);
sun.position.set(-60, 100, -35);
scene.add(sun);

const material = (color, roughness = 0.9) => new THREE.MeshStandardMaterial({ color, roughness });
const grass = material(0x6c8975);
const blockMat = material(0x8faaa0);
const roadMat = material(0x495a65);
const sidewalkMat = material(0xa9b5b4);
const markingMat = new THREE.MeshBasicMaterial({ color: 0xe8e2c6 });
const roofMats = [material(0x586c78), material(0x778e99)];
const wallMats = [material(0xd3dbe0), material(0xe7e5d9), material(0xb6c8d1), material(0xc8d4db), material(0xd9d1c4)];
const windowMat = new THREE.MeshStandardMaterial({ color: 0x46637b, roughness: 0.35, metalness: 0.18 });
const darkDoorMat = material(0x344e5c, 0.45);
const treeMat = material(0x416f5b);
const trunkMat = material(0x695d48);
const collisionBoxes = [];
const pitchedRoofs = [];
const buildings = [];
const windows = [];
const cityProps = [];
const farmProps = [];
const sites = [
  { name: 'Корпус 01', x: -23, z: 12, w: 28, d: 27, h: 27, color: 0, type: 'gable' },
];

function box(w, h, d, mat, x, y, z, parent = scene) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function addObstacle(mesh, site) {
  mesh.userData.site = site;
  buildings.push(mesh);
}

function addSurface(site, mesh, group, face, width, height, valid = () => true) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const overlay = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      map: texture, transparent: true, opacity: 0.65, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2,
    }),
  );
  if (face === 'roof') {
    overlay.rotation.x = -Math.PI / 2;
    overlay.position.y = mesh.geometry.parameters.height / 2 + 0.035;
  } else {
    const wall = WALLS.find(item => item.id === face);
    overlay.rotation.y = wall.rotation;
    overlay.position.set(
      wall.x * (mesh.geometry.parameters.width / 2 + 0.14),
      0,
      wall.z * (mesh.geometry.parameters.depth / 2 + 0.14),
    );
  }
  mesh.add(overlay);
  const samples = [];
  for (let row = 0; row < SAMPLE_COUNT; row++) {
    for (let col = 0; col < SAMPLE_COUNT; col++) {
      const u = (col + 0.5) / SAMPLE_COUNT;
      const v = (row + 0.5) / SAMPLE_COUNT;
      if (valid(u, v)) samples.push({ u, v, done: false });
    }
  }
  const surface = { group, face, samples, canvas, texture, overlay, covered: 0 };
  site.surfaces.push(surface);
  mesh.userData.scanFaces ??= {};
  mesh.userData.scanFaces[face] = surface;
  return surface;
}

function addBoxSurfaces(site, mesh, { roof = false, validRoof } = {}) {
  const { width, height, depth } = mesh.geometry.parameters;
  for (const wall of WALLS) {
    addSurface(site, mesh, wall.id, wall.id, wall.x ? depth : width, height);
  }
  if (roof) addSurface(site, mesh, 'roof', 'roof', width, depth, validRoof);
}

function addRoofSurface(site, mesh, validRoof) {
  addSurface(site, mesh, 'roof', 'roof',
    mesh.geometry.parameters.width, mesh.geometry.parameters.depth, validRoof);
}

function addWindows(x, z, w, d, low, high, spacing = 3.5) {
  for (let level = low; level < high - 1; level += spacing) {
    for (let col = -2; col <= 2; col++) {
      windows.push([x + col * w * 0.17, level, z - d / 2 - 0.04, 1.75, 1.55, 0.07]);
      windows.push([x + col * w * 0.17, level, z + d / 2 + 0.04, 1.75, 1.55, 0.07]);
      windows.push([x - w / 2 - 0.04, level, z + col * d * 0.17, 0.07, 1.55, 1.75]);
      windows.push([x + w / 2 + 0.04, level, z + col * d * 0.17, 0.07, 1.55, 1.75]);
    }
  }
}

box(162, 0.4, 162, grass, 0, -0.28, 0);
box(15, 0.12, 154, sidewalkMat, 0, -0.02, 0);
box(12, 0.14, 154, roadMat, 0, 0.05, 0);
for (let z = -70; z <= 69; z += 11) box(0.15, 0.015, 4, markingMat, 0, 0.13, z);
for (const site of sites) {
  const { x, z, w, d, h } = site;
  box(w + 6, 0.22, d + 6, blockMat, x, 0.1, z);
  const building = box(w, h, d, wallMats[site.color], x, h / 2 + 0.22, z);
  site.mesh = building;
  site.surfaces = [];
  site.complete = false;
  addObstacle(building, site);
  addBoxSurfaces(site, building);
  collisionBoxes.push({ x, z, w: w + 0.5, d: d + 0.5, h: h + 0.56 });
  addWindows(x, z, w, d, 3.3, h);
  if (site.type === 'gable') {
    const rise = 6;
    const profile = new THREE.Shape();
    profile.moveTo(-w / 2, 0);
    profile.lineTo(w / 2, 0);
    profile.lineTo(0, rise);
    profile.closePath();
    for (const side of [-1, 1]) {
      const triangle = new THREE.Mesh(
        new THREE.ShapeGeometry(profile),
        new THREE.MeshStandardMaterial({ color: wallMats[site.color].color, side: THREE.DoubleSide }),
      );
      triangle.position.set(x, h + 0.22, z + side * d / 2);
      scene.add(triangle);
      addObstacle(triangle, site);
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const overlay = new THREE.Mesh(
        new THREE.ShapeGeometry(profile),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.65, depthWrite: false, side: THREE.DoubleSide }),
      );
      // ShapeGeometry uses the profile's dimensions for its UV coordinates.
      const uv = overlay.geometry.getAttribute('uv');
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, uv.getX(i) / w + 0.5, uv.getY(i) / rise);
      }
      overlay.position.z = side * 0.05;
      triangle.add(overlay);
      const samples = [];
      for (let row = 0; row < SAMPLE_COUNT; row++) {
        for (let col = 0; col < SAMPLE_COUNT; col++) {
          const u = (col + 0.5) / SAMPLE_COUNT;
          const v = (row + 0.5) / SAMPLE_COUNT;
          if (v < 1 - 2 * Math.abs(u - 0.5) - 0.04) samples.push({ u, v, done: false });
        }
      }
      const surface = { group: side < 0 ? 'north' : 'south', face: 'triangle', samples, canvas, texture, covered: 0 };
      site.surfaces.push(surface);
      triangle.userData.scanFaces = { triangle: surface };
    }
    pitchedRoofs.push({ x, z, w, d, h: h + 0.22, rise });
    const angle = Math.atan2(rise, w / 2);
    const slope = Math.hypot(w / 2, rise);
    for (const side of [-1, 1]) {
      const panel = box(slope + 0.5, 0.32, d + 0.8, roofMats[site.color],
        x + side * w / 4, h + 0.22 + rise / 2 + 0.17, z);
      panel.rotation.z = -side * angle;
      addObstacle(panel, site);
      addRoofSurface(site, panel);
    }
    box(5, 3.2, 0.12, darkDoorMat, x, 1.82, z + d / 2 + 0.055);
    box(7, 0.18, 0.38, roofMats[site.color], x, 4.1, z + d / 2 + 0.16);
  } else {
    const tiers = [
      { w: w - 6, d: d - 5, h: 8, base: h + 0.22 },
      { w: w - 15, d: d - 13, h: 6, base: h + 8.22 },
    ];
    const first = tiers[0];
    const groundCap = box(w + 0.7, 0.32, d + 0.7, roofMats[site.color], x, h + 0.38, z);
    addObstacle(groundCap, site);
    addRoofSurface(site, groundCap, (u, v) =>
      Math.abs((u - 0.5) * (w + 0.7)) > first.w / 2 + 0.1 ||
      Math.abs((v - 0.5) * (d + 0.7)) > first.d / 2 + 0.1);
    for (const [index, tier] of tiers.entries()) {
      const mass = box(tier.w, tier.h, tier.d, wallMats[site.color],
        x, tier.base + tier.h / 2, z);
      addObstacle(mass, site);
      addBoxSurfaces(site, mass);
      collisionBoxes.push({ x, z, w: tier.w, d: tier.d, h: tier.base + tier.h });
      const cap = box(tier.w + 0.7, 0.32, tier.d + 0.7, roofMats[site.color],
        x, tier.base + tier.h + 0.17, z);
      addObstacle(cap, site);
      const next = tiers[index + 1];
      addRoofSurface(site, cap, next
        ? (u, v) =>
          Math.abs((u - 0.5) * (tier.w + 0.7)) > next.w / 2 + 0.1 ||
          Math.abs((v - 0.5) * (tier.d + 0.7)) > next.d / 2 + 0.1
        : (u, v) =>
          Math.abs((u - 0.5) * (tier.w + 0.7) - 2) > 3.2 ||
          Math.abs((v - 0.5) * (tier.d + 0.7)) > 2.7);
      addWindows(x, z, tier.w, tier.d, tier.base + 2.3, tier.base + tier.h, 3.2);
    }
    const plant = box(6, 3, 5, roofMats[site.color], x + 2, h + 8.22 + 6 + 1.5, z);
    addObstacle(plant, site);
    addBoxSurfaces(site, plant, { roof: true });
    collisionBoxes.push({ x: x + 2, z, w: 6, d: 5, h: h + 8.22 + 9 });
    box(5.5, 3.2, 0.12, darkDoorMat, x, 1.82, z + d / 2 + 0.055);
    box(8, 0.24, 0.42, roofMats[site.color], x, 4.2, z + d / 2 + 0.18);
  }
}
const windowMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), windowMat, windows.length);
const instance = new THREE.Object3D();
windows.forEach(([x, y, z, w, h, d], index) => {
  instance.position.set(x, y, z);
  instance.scale.set(w, h, d);
  instance.updateMatrix();
  windowMesh.setMatrixAt(index, instance.matrix);
});
windowMesh.instanceMatrix.needsUpdate = true;
scene.add(windowMesh);

function paintScan(surface, u, v) {
  const ctx = surface.canvas.getContext('2d');
  const x = u * 256;
  const y = (1 - v) * 256;
  const gradient = ctx.createRadialGradient(x, y, 3, x, y, SCAN_BRUSH_RADIUS);
  gradient.addColorStop(0, 'rgba(30,110,245,0.72)');
  gradient.addColorStop(0.55, 'rgba(37,128,241,0.48)');
  gradient.addColorStop(1, 'rgba(37,128,241,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(x - SCAN_BRUSH_RADIUS, y - SCAN_BRUSH_RADIUS, SCAN_BRUSH_RADIUS * 2, SCAN_BRUSH_RADIUS * 2);
  surface.texture.needsUpdate = true;
  let changed = false;
  for (const sample of surface.samples) {
    if (!sample.done && Math.hypot(sample.u - u, sample.v - v) < SCAN_BRUSH_RADIUS / 256) {
      sample.done = true;
      surface.covered++;
      changed = true;
    }
  }
  return changed;
}

function tree(x, z, scale = 1, parent = scene, foliage = treeMat) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * scale, 0.2 * scale, 2.1 * scale, 5), trunkMat);
  trunk.position.set(x, 1.1 * scale, z);
  parent.add(trunk);
  const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25 * scale, 0), foliage);
  canopy.position.set(x, 2.8 * scale, z);
  parent.add(canopy);
}
for (let z = -70; z <= 70; z += 12) {
  const occupied = sites.some(s => Math.abs(z - s.z) < s.d / 2 + 3);
  if (!occupied && Math.abs(z - START.z) > 8) {
    tree(-9, z, 0.9);
    tree(9, z, 0.9);
  }
}

const parkingMat = material(0x657875);
const metalMat = material(0x466879, 0.42);
const containerMat = material(0x608797, 0.65);
const lampMat = new THREE.MeshBasicMaterial({ color: 0xf3e4ab });
box(33, 0.08, 38, parkingMat, 27, 0.04, 13);
for (const x of [16, 23, 30, 37]) {
  box(0.14, 0.018, 8, markingMat, x, 0.1, 22);
}
box(25, 0.018, 0.14, markingMat, 26.5, 0.1, 26);
for (const [x, z, paint] of [[19, 19, containerMat], [33, 18, wallMats[2]]]) {
  box(3.2, 1.45, 5.2, paint, x, 0.82, z);
  cityProps.push({ x, z, w: 3.2, d: 5.2, h: 1.6 });
  box(2.8, 0.9, 1.8, windowMat, x, 1.42, z - 1.4);
  for (const dx of [-1.5, 1.5]) {
    for (const dz of [-1.65, 1.65]) box(0.42, 0.55, 0.75, darkDoorMat, x + dx, 0.48, z + dz);
  }
}
const utilityYard = { x: 33, z: -34, w: 22, d: 16 };
box(utilityYard.w, 0.12, utilityYard.d, blockMat, utilityYard.x, 0.06, utilityYard.z);
for (const [x, z] of [[25, -36], [33, -36]]) {
  box(6, 2.6, 3.4, containerMat, x, 1.42, z);
  cityProps.push({ x, z, w: 6, d: 3.4, h: 2.8 });
  for (const offset of [-1.8, -0.6, 0.6, 1.8]) {
    box(0.06, 2.4, 3.46, metalMat, x + offset, 1.42, z);
  }
}
const lampPosts = [[8, 30], [8, -12], [8, -53], [-8, -38]];
for (const [x, z] of lampPosts) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 7.5, 8), metalMat);
  pole.position.set(x, 3.8, z);
  scene.add(pole);
  cityProps.push({ x, z, w: 0.4, d: 0.4, h: 7.6 });
  box(1.5, 0.2, 0.55, lampMat, x - (x > 0 ? 0.7 : -0.7), 7.5, z);
}
for (const x of [-60, 57]) {
  for (const z of [-60, -46, -19, 3, 34, 57]) {
    if (Math.abs(z - START.z) > 10) tree(x, z, 1.2 + (z % 3) * 0.05);
  }
}

const markerCanvas = document.createElement('canvas');
markerCanvas.width = 128;
markerCanvas.height = 128;
const markerCtx = markerCanvas.getContext('2d');
markerCtx.fillStyle = '#1b4770';
markerCtx.beginPath();
markerCtx.arc(64, 58, 38, 0, Math.PI * 2);
markerCtx.fill();
markerCtx.strokeStyle = '#ffffff';
markerCtx.lineWidth = 6;
markerCtx.stroke();
markerCtx.strokeStyle = '#65caff';
markerCtx.beginPath();
markerCtx.moveTo(64, 8);
markerCtx.lineTo(64, 30);
markerCtx.moveTo(64, 86);
markerCtx.lineTo(64, 109);
markerCtx.moveTo(14, 58);
markerCtx.lineTo(36, 58);
markerCtx.moveTo(92, 58);
markerCtx.lineTo(114, 58);
markerCtx.stroke();
markerCtx.beginPath();
markerCtx.arc(64, 58, 12, 0, Math.PI * 2);
markerCtx.stroke();
markerCtx.fillStyle = '#ffffff';
markerCtx.beginPath();
markerCtx.arc(64, 58, 4, 0, Math.PI * 2);
markerCtx.fill();
const targetMarker = new THREE.Sprite(new THREE.SpriteMaterial({
  map: new THREE.CanvasTexture(markerCanvas), transparent: true, depthWrite: false, fog: false, toneMapped: false,
}));
targetMarker.position.set(sites[0].x, sites[0].h + 9, sites[0].z + 6);
targetMarker.scale.set(6.5, 6.5, 1);
scene.add(targetMarker);
const targetIndicator = document.querySelector('#target-indicator');
targetIndicator.src = markerCanvas.toDataURL();

const padMat = material(0x233d57);
const ringMat = new THREE.MeshBasicMaterial({ color: 0x4a69ff, side: THREE.DoubleSide });
const pad = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 0.13, 32), padMat);
pad.position.set(0, 0.19, START.z);
scene.add(pad);
const ring = new THREE.Mesh(new THREE.RingGeometry(2.5, 2.65, 40), ringMat);
ring.rotation.x = -Math.PI / 2;
ring.position.set(0, 0.27, START.z);
scene.add(ring);
for (let i = 0; i < 4; i++) {
  const a = i * Math.PI / 2 + Math.PI / 4;
  box(0.45, 0.02, 0.9, ringMat, Math.cos(a) * 3.35, 0.28, START.z + Math.sin(a) * 3.35);
}

const cityGroup = new THREE.Group();
scene.add(cityGroup);
for (const object of [...scene.children]) {
  if (object !== cityGroup && object !== ambient && object !== sun) cityGroup.add(object);
}

const farmGroup = new THREE.Group();
farmGroup.visible = false;
scene.add(farmGroup);
const soil = material(0x6d7461);
const paths = material(0xb2a891);
const cropMaterial = new THREE.MeshStandardMaterial({ color: 0x638b4c, roughness: 0.94, side: THREE.DoubleSide });
box(162, 0.35, 162, material(0x899c78), 0, -0.25, 0, farmGroup);
box(7, 0.05, 116, paths, 36, 0.03, -12, farmGroup);
box(94, 0.05, 6, paths, 0, 0.03, 42, farmGroup);
const fields = [{ x: 0, z: -2, w: 33.8, d: 59.8, cols: 9, rows: 15, name: 'Поле 01', covered: 0, cells: [] }].map(field => {
  const { x } = field;
  box(field.w + 2, 0.12, field.d + 2, paths, x, 0.02, field.z, farmGroup);
  box(field.w, 0.15, field.d, soil, x, 0.11, field.z, farmGroup);
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 768;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  field.canvas = canvas;
  field.texture = texture;
  const wet = new THREE.Mesh(
    new THREE.PlaneGeometry(field.w, field.d),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.78, depthWrite: false }),
  );
  wet.rotation.x = -Math.PI / 2;
  wet.position.set(x, 0.22, field.z);
  farmGroup.add(wet);
  for (let row = 0; row < field.rows; row++) {
    for (let col = 0; col < field.cols; col++) {
      field.cells.push({
        x: x + (col + 0.5) * field.w / field.cols - field.w / 2,
        z: field.z + (row + 0.5) * field.d / field.rows - field.d / 2,
        done: false,
      });
    }
  }
  return field;
});
const cropRows = 36;
const cropCount = fields.reduce((sum, field) => sum + field.cols * cropRows, 0);
const crops = new THREE.InstancedMesh(new THREE.ConeGeometry(0.32, 0.95, 5), cropMaterial, cropCount);
const cropTransform = new THREE.Object3D();
let cropIndex = 0;
for (const field of fields) {
  for (let col = 0; col < field.cols; col++) {
    for (let row = 0; row < cropRows; row++) {
      cropTransform.position.set(
        field.x + (col + 0.5) * field.w / field.cols - field.w / 2,
        0.77,
        field.z + (row + 0.5) * field.d / cropRows - field.d / 2,
      );
      cropTransform.rotation.y = (row * 11 + col * 7) % 9 * 0.24;
      cropTransform.scale.setScalar(0.84 + ((row + col * 3) % 5) * 0.07);
      cropTransform.updateMatrix();
      crops.setMatrixAt(cropIndex++, cropTransform.matrix);
    }
  }
}
crops.instanceMatrix.needsUpdate = true;
farmGroup.add(crops);
const orchardLeaves = material(0x557755);
for (const x of [-66, -58, -50]) {
  for (const z of [-55, -42, -29, -16, -3, 10, 23]) {
    tree(x, z, 1.3, farmGroup, orchardLeaves);
  }
}
const greenhouseMat = new THREE.MeshStandardMaterial({
  color: 0xc9e4dc, roughness: 0.34, metalness: 0.18, transparent: true, opacity: 0.7,
});
const greenhouse = { x: 56, z: -36, w: 14, d: 27 };
box(greenhouse.w, 0.12, greenhouse.d, blockMat, greenhouse.x, 0.06, greenhouse.z, farmGroup);
box(greenhouse.w - 1, 4.5, greenhouse.d - 1, greenhouseMat, greenhouse.x, 2.35, greenhouse.z, farmGroup);
farmProps.push({ x: greenhouse.x, z: greenhouse.z, w: greenhouse.w, d: greenhouse.d, h: 4.8 });
for (const z of [-48, -41, -34, -27, -23]) {
  box(greenhouse.w + 0.2, 0.14, 0.14, metalMat, greenhouse.x, 4.7, z, farmGroup);
}
const tank = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 4.5, 20), containerMat);
tank.position.set(54, 2.3, 20);
farmGroup.add(tank);
farmProps.push({ x: 54, z: 20, w: 6.2, d: 6.2, h: 4.8 });
const tankTop = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.2, 20), metalMat);
tankTop.position.set(54, 4.65, 20);
farmGroup.add(tankTop);
box(4.5, 1.4, 2.8, containerMat, -33, 1.05, 43, farmGroup);
box(2.4, 1.7, 2.1, wallMats[0], -34, 2.1, 43, farmGroup);
farmProps.push({ x: -33, z: 43, w: 5.5, d: 3, h: 3.1 });
for (const x of [-35, -31]) {
  for (const z of [41.8, 44.2]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.35, 10), darkDoorMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.7, z);
    farmGroup.add(wheel);
  }
}
const farmPad = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 0.13, 32), padMat);
farmPad.position.set(0, 0.2, FARM_START.z);
farmGroup.add(farmPad);
const farmRing = new THREE.Mesh(new THREE.RingGeometry(2.5, 2.65, 40), ringMat);
farmRing.rotation.x = -Math.PI / 2;
farmRing.position.set(0, 0.29, FARM_START.z);
farmGroup.add(farmRing);

const raceGroup = new THREE.Group();
raceGroup.visible = false;
scene.add(raceGroup);
const raceGrass = material(0x628579);
const asphalt = material(0x364550, 0.95);
const curbWhite = material(0xe5e9e6);
const curbRed = material(0xec6b57);
const raceFence = material(0x819daa);
box(162, 0.4, 162, raceGrass, 0, -0.3, 0, raceGroup);
const raceCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0, 43), new THREE.Vector3(-34, 0, 38),
  new THREE.Vector3(-51, 0, 3), new THREE.Vector3(-39, 0, -39),
  new THREE.Vector3(0, 0, -53), new THREE.Vector3(39, 0, -39),
  new THREE.Vector3(51, 0, 3), new THREE.Vector3(34, 0, 38),
], true, 'catmullrom', 0.35);
const racePoints = raceCurve.getSpacedPoints(240);
function trackRibbon(offset, width, height, mat) {
  const vertices = [];
  const indices = [];
  for (const [index, point] of racePoints.entries()) {
    const tangent = raceCurve.getTangentAt(index / (racePoints.length - 1));
    const nx = -tangent.z;
    const nz = tangent.x;
    for (const side of [-1, 1]) {
      vertices.push(point.x + nx * (offset + side * width / 2), height, point.z + nz * (offset + side * width / 2));
    }
    if (index < racePoints.length - 1) {
      const base = index * 2;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  raceGroup.add(new THREE.Mesh(geometry, mat));
}
trackRibbon(0, 16, 0.02, asphalt);
trackRibbon(-7.65, 0.7, 0.055, curbWhite);
trackRibbon(7.65, 0.7, 0.055, curbWhite);
for (let i = 0; i < 48; i++) {
  const p = raceCurve.getPointAt(i / 48);
  const tangent = raceCurve.getTangentAt(i / 48);
  const stripe = box(0.6, 0.025, 2.5, i % 2 ? curbWhite : curbRed, p.x, 0.065, p.z, raceGroup);
  stripe.rotation.y = Math.atan2(-tangent.x, -tangent.z);
}
for (let i = 0; i < 30; i++) {
  const p = raceCurve.getPointAt(i / 30);
  const t = raceCurve.getTangentAt(i / 30);
  const side = i % 2 ? 1 : -1;
  const x = p.x - t.z * side * 13;
  const z = p.z + t.x * side * 13;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 2.5, 6), raceFence);
  post.position.set(x, 1.25, z);
  raceGroup.add(post);
  box(0.8, 0.8, 0.8, i % 3 ? curbWhite : curbRed, x, 0.4, z, raceGroup);
}
const raceProps = [];
for (const [x, z] of [[-66, -23], [64, -23]]) {
  box(11, 1.2, 28, asphalt, x, 0.63, z, raceGroup);
  box(11, 0.45, 28, curbWhite, x, 3.6, z, raceGroup);
  for (const dx of [-4.7, 4.7]) {
    for (const dz of [-12, 12]) box(0.38, 3.2, 0.38, raceFence, x + dx, 1.75, z + dz, raceGroup);
  }
  for (const level of [1.45, 2.3, 3.1]) {
    box(10, 0.26, 26, level === 2.3 ? curbRed : raceFence, x, level, z, raceGroup);
  }
  raceProps.push({ x, z, w: 11, d: 28, h: 3.9 });
}
for (const x of [-7, 7]) {
  box(0.5, 8, 0.6, raceFence, x, 4, 43, raceGroup);
  raceProps.push({ x, z: 43, w: 0.5, d: 0.6, h: 8 });
}
box(14.5, 1.1, 1.2, asphalt, 0, 8.1, 43, raceGroup);
for (let i = 0; i < 8; i++) box(1.7, 0.6, 0.08, i % 2 ? curbWhite : curbRed, -6 + i * 1.7, 8.13, 43.64, raceGroup);
const raceCars = [0xf05f49, 0x38a6e7].map((color, index) => {
  const model = new THREE.Group();
  const body = material(color, 0.35);
  box(2.25, 0.5, 4.1, body, 0, 0.62, 0, model);
  box(1.85, 0.5, 1.65, windowMat, 0, 1.08, -0.3, model);
  box(2.6, 0.12, 0.48, asphalt, 0, 1.08, 1.7, model);
  box(2.4, 0.11, 0.4, curbWhite, 0, 0.6, -2.1, model);
  for (const x of [-1.12, 1.12]) {
    for (const z of [-1.3, 1.3]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.25, 12), asphalt);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.5, z);
      model.add(wheel);
    }
  }
  model.userData = { progress: 0, captured: 0, name: `Болид 0${index + 1}` };
  raceGroup.add(model);
  return model;
});

let drone = new THREE.Group();
scene.add(drone);
const dark = material(0x233d57, 0.4);
const shell = material(0xe7ecf0, 0.42);
const accent = new THREE.MeshStandardMaterial({ color: 0x1f5bff, emissive: 0x173fbc, emissiveIntensity: 0.55 });
box(1.15, 0.3, 1.45, dark, 0, 0, 0, drone);
box(0.92, 0.16, 1.18, shell, 0, 0.22, 0, drone);
box(0.43, 0.13, 0.4, accent, 0, 0.32, -0.4, drone);
box(0.45, 0.27, 0.36, dark, 0, -0.28, -0.38, drone);
const propellers = [];
const rotorMat = new THREE.MeshBasicMaterial({ color: 0x233d57, transparent: true, opacity: 0.65, side: THREE.DoubleSide, depthWrite: false });
const rotorGeometry = new THREE.BoxGeometry(1.33, 0.015, 0.14);
for (const x of [-0.98, 0.98]) {
  for (const z of [-0.94, 0.94]) {
    const arm = box(1.44, 0.09, 0.12, dark, x * 0.5, 0.03, z * 0.5, drone);
    arm.rotation.y = x * z > 0 ? -Math.PI / 4 : Math.PI / 4;
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.22, 12), dark);
    motor.position.set(x, 0.14, z);
    drone.add(motor);
    const rotor = new THREE.Mesh(rotorGeometry, rotorMat);
    rotor.position.set(x, 0.29, z);
    drone.add(rotor);
    propellers.push(rotor);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), z < 0 ? accent : material(0xe97c5d));
    led.position.set(x, -0.05, z);
    drone.add(led);
  }
}
const inspectionDrone = drone;
const agricultureDrone = new THREE.Group();
agricultureDrone.visible = false;
scene.add(agricultureDrone);
const agriShell = material(0xe8ece2, 0.45);
const agriFrame = material(0x304657, 0.5);
const tankMat = material(0x5192c3, 0.46);
box(1.85, 0.42, 1.6, agriFrame, 0, 0, 0, agricultureDrone);
box(1.5, 0.42, 1.45, agriShell, 0, 0.32, 0, agricultureDrone);
box(1.28, 0.64, 1.18, tankMat, 0, -0.43, 0, agricultureDrone);
box(6.4, 0.09, 0.12, agriFrame, 0, -0.54, -0.38, agricultureDrone);
const agriPropellers = [];
for (const x of [-1.45, 1.45]) {
  for (const z of [-1.25, 1.25]) {
    box(1.8, 0.12, 0.16, agriFrame, x * 0.51, 0.03, z * 0.51, agricultureDrone).rotation.y =
      x * z > 0 ? -Math.PI / 4 : Math.PI / 4;
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.25, 12), agriFrame);
    motor.position.set(x, 0.17, z);
    agricultureDrone.add(motor);
    const rotor = new THREE.Mesh(rotorGeometry, rotorMat);
    rotor.position.set(x, 0.32, z);
    agricultureDrone.add(rotor);
    agriPropellers.push(rotor);
  }
}
const fpvDrone = new THREE.Group();
fpvDrone.visible = false;
scene.add(fpvDrone);
const fpvFrame = material(0x202b34, 0.48);
box(0.95, 0.18, 1.15, fpvFrame, 0, 0, 0, fpvDrone);
box(0.58, 0.13, 0.8, curbRed, 0, 0.13, 0, fpvDrone);
const fpvRotors = [];
for (const x of [-0.78, 0.78]) {
  for (const z of [-0.72, 0.72]) {
    box(1.05, 0.08, 0.12, fpvFrame, x / 2, 0, z / 2, fpvDrone).rotation.y = x * z > 0 ? -Math.PI / 4 : Math.PI / 4;
    const rotor = new THREE.Mesh(rotorGeometry, rotorMat);
    rotor.position.set(x, 0.2, z);
    fpvDrone.add(rotor);
    fpvRotors.push(rotor);
  }
}
const sprayGeometry = new THREE.BufferGeometry();
sprayGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(7 * 6), 3).setUsage(THREE.DynamicDrawUsage));
const sprayJets = new THREE.LineSegments(sprayGeometry, new THREE.LineBasicMaterial({
  color: 0x77c6fa, transparent: true, opacity: 0.65, depthWrite: false, toneMapped: false,
}));
sprayJets.visible = false;
scene.add(sprayJets);
const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.7, 24), new THREE.MeshBasicMaterial({ color: 0x1c334b, transparent: true, opacity: 0.27, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = 0.16;
scene.add(shadow);

const SCAN_RANGE = 38;
const scanRay = new THREE.Raycaster();
scanRay.far = SCAN_RANGE;
const scanOrigin = new THREE.Vector3();
const scanDirection = new THREE.Vector3();
const beamPositions = new Float32Array(9 * 6);
const beamGeometry = new THREE.BufferGeometry();
beamGeometry.setAttribute('position', new THREE.BufferAttribute(beamPositions, 3).setUsage(THREE.DynamicDrawUsage));
const beams = new THREE.LineSegments(beamGeometry, new THREE.LineBasicMaterial({
  color: 0x2485ff, transparent: true, opacity: 0.74, depthWrite: false, toneMapped: false,
}));
beams.visible = false;
scene.add(beams);
const keys = new Set();
const sticks = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 } };
let yaw = 0;
let paused = false;
let crashed = false;
let finished = false;
let scanning = false;
let briefingOpen = false;
let mission = 1;
let scanTimer = 0;
let bumpTime = 0;
let distanceTravelled = 0;
let throttle = 0.53;
let fpvYaw = 0;
let fpvPitch = 0;
let fpvRoll = 0;
let raceTime = 0;
let toastTimeout;
const velocity = new THREE.Vector3();
const clock = new THREE.Clock();
const desiredCamera = new THREE.Vector3();
const target = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const mini = document.querySelector('#minimap');
const mapCtx = mini.getContext('2d');
const app = document.querySelector('#app');
const overlay = document.querySelector('#result-overlay');
const briefing = document.querySelector('#briefing-overlay');
const scanButton = document.querySelector('#scan');
const missionRows = sites.map((site, index) => {
  const row = document.createElement('div');
  row.className = 'mission-row';
  row.innerHTML = `<div class="mission-building"><div class="mission-row-head"><span class="mission-name"><i></i>${site.name}</span><span class="percent">0%</span></div><div class="wall-progress">${SURFACES.map(group => `<span class="wall-meter" data-wall="${group.id}" title="${group.id === 'roof' ? 'Крыша' : `${group.label} фасад`}"><b>${group.label}</b><i><span></span></i></span>`).join('')}</div></div>`;
  document.querySelector('#mission-list').append(row);
  return row;
});
const farmRows = fields.map(field => {
  const row = document.createElement('div');
  row.className = 'mission-row';
  row.innerHTML = `<div class="mission-building"><div class="mission-row-head"><span class="mission-name"><i></i>${field.name}</span><span class="percent">0%</span></div><div class="field-progress"><span></span></div></div>`;
  row.hidden = true;
  document.querySelector('#mission-list').append(row);
  return row;
});
const raceRows = raceCars.map(car => {
  const row = document.createElement('div');
  row.className = 'mission-row';
  row.innerHTML = `<div class="mission-building"><div class="mission-row-head"><span class="mission-name"><i></i>${car.userData.name}</span><span class="percent">0%</span></div><div class="field-progress"><span></span></div></div>`;
  row.hidden = true;
  document.querySelector('#mission-list').append(row);
  return row;
});
const fpvReadout = document.querySelector('#fpv-readout');
const fpvThrottle = document.querySelector('#fpv-throttle');
const fpvTarget = document.querySelector('#fpv-target');
const fpvCameraPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.22);
const fpvForward = new THREE.Vector3();
const fpvUp = new THREE.Vector3();
const fpvProjection = new THREE.Vector3();

function updateMission() {
  if (mission === 3) return;
  if (mission === 2) {
    updateFarmMission();
    return;
  }
  let completed = 0;
  for (const [index, site] of sites.entries()) {
    const total = site.surfaces.reduce((sum, surface) => sum + surface.samples.length, 0);
    const covered = site.surfaces.reduce((sum, surface) => sum + surface.covered, 0);
    missionRows[index].querySelector('.percent').textContent = `${Math.round(covered / total * 100)}%`;
    for (const group of SURFACES) {
      const surfaces = site.surfaces.filter(surface => surface.group === group.id);
      const count = surfaces.reduce((sum, surface) => sum + surface.samples.length, 0);
      const done = surfaces.reduce((sum, surface) => sum + surface.covered, 0);
      const meter = missionRows[index].querySelector(`[data-wall="${group.id}"]`);
      const progress = Math.round(done / count * 100);
      meter.querySelector('i span').style.width = `${progress}%`;
      meter.classList.toggle('complete', progress === 100);
      meter.title = `${group.id === 'roof' ? 'Крыша' : `Фасад ${group.label}`}: ${progress}%`;
    }
    missionRows[index].classList.toggle('active', covered > 0 && !site.complete);
    missionRows[index].classList.toggle('complete', site.complete);
    if (site.complete) completed++;
  }
  document.querySelector('#mission-total').textContent = `${completed} / ${sites.length}`;
  if (completed === sites.length && !finished) {
    finished = true;
    setScanning(false);
    document.querySelector('#flight-status').textContent = 'МИССИЯ ВЫПОЛНЕНА';
    showResult(false);
  }
}

function updateFarmMission() {
  let complete = 0;
  fields.forEach((field, index) => {
    const progress = Math.round(field.covered / field.cells.length * 100);
    const row = farmRows[index];
    row.querySelector('.percent').textContent = field.covered > 0 && progress === 0 ? '<1%' : `${progress}%`;
    row.querySelector('.field-progress span').style.width = `${progress}%`;
    row.classList.toggle('active', field.covered > 0 && progress < 100);
    row.classList.toggle('complete', progress === 100);
    if (progress === 100) complete++;
  });
  document.querySelector('#mission-total').textContent = `${complete} / ${fields.length}`;
  if (complete === fields.length && !finished) {
    finished = true;
    setScanning(false);
    document.querySelector('#flight-status').textContent = 'МИССИЯ ВЫПОЛНЕНА';
    showResult(false);
  }
}

function updateRaceMission() {
  const allCaptured = raceCars.every(car => car.userData.captured >= 7);
  raceCars.forEach((car, index) => {
    const percent = Math.min(100, Math.floor(car.userData.captured / 7 * 100));
    raceRows[index].querySelector('.percent').textContent = `${percent}%`;
    raceRows[index].querySelector('.field-progress span').style.width = `${percent}%`;
    raceRows[index].classList.toggle('active', percent > 0 && percent < 100);
    raceRows[index].classList.toggle('complete', percent === 100);
  });
  document.querySelector('#mission-total').textContent = `${raceCars.filter(car => car.userData.captured >= 7).length} / ${raceCars.length}`;
  if (allCaptured && !finished) {
    finished = true;
    setScanning(false);
    document.querySelector('#flight-status').textContent = 'МИССИЯ ВЫПОЛНЕНА';
    showResult(false);
  }
}

function setScanning(value) {
  scanning = value && !crashed && !finished && !briefingOpen;
  app.classList.toggle('scanning', scanning);
  scanButton.setAttribute('aria-pressed', String(scanning));
  const action = mission === 1 ? 'ЛИДАР' : mission === 2 ? 'ПОЛИВ' : 'ЗАПИСЬ';
  document.querySelector('#scan-label').textContent = `${scanning ? 'ВЫКЛЮЧИТЬ' : 'ВКЛЮЧИТЬ'} ${action}`;
  document.querySelector('#scan-message').textContent = scanning ? `${action} АКТИВЕН` : `${action} ВЫКЛЮЧЕН`;
  beams.visible = scanning && !paused && mission === 1;
  sprayJets.visible = scanning && !paused && mission === 2;
  fpvReadout.classList.toggle('recording', scanning && mission === 3);
}

function showResult(isCrash) {
  overlay.hidden = false;
  overlay.classList.toggle('crashed', isCrash);
  document.querySelector('#result-kicker').textContent = isCrash ? 'ВЫЛЕТ ПРЕРВАН' : mission === 3 ? 'ВСЕ МИССИИ ЗАВЕРШЕНЫ' : `ЭТАП 0${mission} ЗАВЕРШЁН`;
  document.querySelector('#result-title').textContent = isCrash ? 'Дрон разбился' : mission === 1 ? 'Корпус обследован' : mission === 2 ? 'Поле полито' : 'Гонка снята';
  document.querySelector('#result-description').textContent = isCrash
    ? mission === 1
      ? `Обследовано ${sites.filter(site => site.complete).length} из ${sites.length} корпусов. Сильный удар вывел дрон из строя.`
      : mission === 2 ? `Полив прерван. Обработано ${Math.round(fields[0].covered / fields[0].cells.length * 100)}% поля.`
        : 'Съёмка прервана. Попробуйте удержать автомобили в кадре без столкновений.'
    : mission === 1
      ? `Обследование завершено. Далее — полив поля на агродроне.`
      : mission === 2 ? 'Всё поле обработано. Далее — FPV-съёмка автогонки.'
        : `Оба автомобиля сняты. Пройдено ${Math.round(distanceTravelled)} м.`;
  document.querySelector('#restart').textContent = isCrash ? 'ПОПРОБОВАТЬ СНОВА' : mission === 1 ? 'К ПОЛИВУ' : mission === 2 ? 'К ГОНКЕ' : 'ПРОЙТИ ЗАНОВО';
}

function showBriefing() {
  briefingOpen = true;
  setScanning(false);
  const first = mission === 1;
  document.querySelector('#briefing-kicker').textContent = first ? 'МИССИЯ 01 / ОБСЛЕДОВАНИЕ' : mission === 2 ? 'МИССИЯ 02 / СЕЛЬСКОЕ ХОЗЯЙСТВО' : 'МИССИЯ 03 / FPV-СЪЁМКА';
  document.querySelector('#briefing-title').textContent = first ? 'Обследование здания' : mission === 2 ? 'Полив поля' : 'Съёмка автогонки';
  document.querySelector('#briefing-lead').textContent = first
    ? 'Здравствуйте! Добро пожаловать в «АэрогениИ».'
    : mission === 2 ? 'Отличная работа! Теперь попробуйте себя в агросекторе.'
      : 'Теперь вы FPV-оператор на гоночной трассе.';
  document.querySelector('#briefing-context').textContent = first
    ? 'Оператор БПЛА — реальная профессия. Дроны применяют в строительстве, съёмке, картографии и мониторинге объектов. Освоить управление можно с нуля или развить навыки на очном и онлайн-обучении.'
    : mission === 2 ? 'Операторы агродронов работают с посевами и обрабатывают поля. Один дрон, разные задачи: именно за это профессию интересно осваивать.'
      : 'FPV-съёмка требует точного пилотирования и чувства кадра. Теперь камера находится на самом дроне: следите за двумя болидами и ведите их через повороты.';
  document.querySelector('#briefing-task').textContent = first
    ? 'Ваша задача: облететь корпус и просканировать лидаром все четыре фасада и крышу. Избегайте столкновений.'
    : mission === 2 ? 'Ваша задача: равномерно полить всё поле. Включите полив и держите высоту от 4 до 14 м.'
      : 'Снимите оба болида по 7 секунд: удерживайте каждый близко и в центре кадра. F — запись. W/S — наклон вперёд/назад, A/D — крен, Q/E — поворот, ПРОБЕЛ/SHIFT — тяга. На телефоне: левый стик — тяга/поворот, правый — наклон/крен.';
  briefing.hidden = false;
  document.querySelector('#briefing-start').focus();
}

function crash() {
  if (crashed) return;
  crashed = true;
  velocity.set(0, 0, 0);
  setScanning(false);
  drone.rotation.x = 0.42;
  drone.rotation.z = 0.65;
  scanButton.disabled = true;
  document.querySelector('#flight-status').textContent = 'АВАРИЯ';
  showResult(true);
}

function scanPulse() {
  scanOrigin.copy(drone.position).add(new THREE.Vector3(0, -0.15, -0.7).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw));
  const changed = new Set();
  let beamIndex = 0;
  for (let row = -2; row <= 2; row++) {
    for (let col = -4; col <= 4; col++) {
      scanDirection.set(Math.sin(col * 0.115), Math.sin(row * 0.24), -1).normalize();
      scanDirection.applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
      scanRay.set(scanOrigin, scanDirection);
      const hit = scanRay.intersectObjects(buildings, false)[0];
      if (row === 0) {
        const end = hit ? hit.point : scanOrigin.clone().addScaledVector(scanDirection, SCAN_RANGE);
        beamGeometry.attributes.position.setXYZ(beamIndex * 2, scanOrigin.x, scanOrigin.y, scanOrigin.z);
        beamGeometry.attributes.position.setXYZ(beamIndex * 2 + 1, end.x, end.y, end.z);
        beamIndex++;
      }
      if (!hit) continue;
      const site = hit.object.userData.site;
      if (site.complete) continue;
      const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      const face = hit.object.userData.scanFaces?.triangle
        ? 'triangle'
        : normal.y > 0.55 ? 'roof'
          : WALLS.find(wall => normal.x * wall.x + normal.z * wall.z > 0.85)?.id;
      const surface = hit.object.userData.scanFaces?.[face];
      if (!surface) continue;
      const local = hit.object.worldToLocal(hit.point.clone());
      const { width, height, depth } = hit.object.geometry.parameters || {};
      const u = face === 'triangle' ? local.x / site.w + 0.5
        : face === 'roof' ? local.x / width + 0.5
          : face === 'north' ? 0.5 - local.x / width
            : face === 'south' ? local.x / width + 0.5
              : face === 'east' ? 0.5 - local.z / depth : local.z / depth + 0.5;
      const v = face === 'triangle' ? local.y / 6
        : face === 'roof' ? 0.5 - local.z / depth : local.y / height + 0.5;
      if (u < 0 || u > 1 || v < 0 || v > 1) continue;
      if (paintScan(surface, u, v)) changed.add(site);
      if (site.surfaces.every(part => part.covered === part.samples.length)) {
        site.complete = true;
        showToast(`${site.name}: сканирование завершено`);
      }
    }
  }
  beamGeometry.attributes.position.needsUpdate = true;
  beamGeometry.computeBoundingSphere();
  if (changed.size) updateMission();
}

function irrigate(x, z) {
  let changed = false;
  for (const field of fields) {
    if (Math.abs(x - field.x) > field.w / 2 + 3 || Math.abs(z - field.z) > field.d / 2 + 3) continue;
    for (const cell of field.cells) {
      if (cell.done || Math.hypot(cell.x - x, cell.z - z) > 3.1) continue;
      cell.done = true;
      field.covered++;
      changed = true;
    }
    if (Math.abs(x - field.x) > field.w / 2 || Math.abs(z - field.z) > field.d / 2) continue;
    const px = (x - field.x) / field.w * field.canvas.width + field.canvas.width / 2;
    const py = (z - field.z) / field.d * field.canvas.height + field.canvas.height / 2;
    const ctx = field.canvas.getContext('2d');
    const shade = ctx.createRadialGradient(px, py, 4, px, py, 32);
    shade.addColorStop(0, 'rgba(49,141,185,0.72)');
    shade.addColorStop(0.65, 'rgba(72,164,200,0.52)');
    shade.addColorStop(1, 'rgba(72,164,200,0)');
    ctx.fillStyle = shade;
    ctx.fillRect(px - 32, py - 32, 64, 64);
    field.texture.needsUpdate = true;
  }
  if (changed) updateFarmMission();
}

function updateSpray() {
  const withinHeight = drone.position.y >= SPRAY_MIN_HEIGHT && drone.position.y <= SPRAY_MAX_HEIGHT;
  const overField = fields.some(field =>
    Math.abs(drone.position.x - field.x) <= field.w / 2 &&
    Math.abs(drone.position.z - field.z) <= field.d / 2);
  sprayJets.visible = scanning && !paused && !crashed && !finished && withinHeight && overField;
  if (!scanning) return;
  document.querySelector('#scan-message').textContent = !withinHeight
    ? drone.position.y > SPRAY_MAX_HEIGHT ? 'СНИЗЬТЕСЬ ДО 14 М' : 'ПОДНИМИТЕСЬ ДО 4 М'
    : overField ? 'ПОЛИВ АКТИВЕН' : 'ВНЕ ПОЛЯ';
  if (!sprayJets.visible) return;
  const position = sprayGeometry.attributes.position;
  for (let index = 0; index < 7; index++) {
    const offset = (index - 3) * 0.92;
    const start = new THREE.Vector3(offset, -0.62, -0.38).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw).add(drone.position);
    position.setXYZ(index * 2, start.x, start.y, start.z);
    position.setXYZ(index * 2 + 1, start.x + (index - 3) * 0.23, 0.25, start.z - 0.35);
  }
  position.needsUpdate = true;
  sprayGeometry.computeBoundingSphere();
}

function showToast(message) {
  const el = document.querySelector('#toast');
  el.textContent = message;
  el.classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.remove('visible'), 1800);
}

function reset(notify = true) {
  crashed = false;
  finished = false;
  paused = false;
  briefingOpen = false;
  briefing.hidden = true;
  app.classList.remove('paused');
  overlay.hidden = true;
  scanButton.disabled = false;
  setScanning(false);
  scanTimer = 0;
  keys.clear();
  if (mission === 1) {
    for (const site of sites) {
      for (const surface of site.surfaces) {
        surface.canvas.getContext('2d').clearRect(0, 0, 256, 256);
        surface.texture.needsUpdate = true;
        surface.covered = 0;
        for (const sample of surface.samples) sample.done = false;
      }
      site.complete = false;
    }
  } else if (mission === 2) {
    for (const field of fields) {
      field.canvas.getContext('2d').clearRect(0, 0, field.canvas.width, field.canvas.height);
      field.texture.needsUpdate = true;
      field.covered = 0;
      for (const cell of field.cells) cell.done = false;
    }
  } else {
    raceTime = 0;
    throttle = 0.53;
    fpvYaw = 0;
    fpvPitch = 0;
    fpvRoll = 0;
    for (const car of raceCars) car.userData.captured = 0;
    updateRaceCars(0);
  }
  if (mission === 3) updateRaceMission();
  else updateMission();
  drone.position.copy(mission === 1 ? START : mission === 2 ? FARM_START : RACE_START);
  velocity.set(0, 0, 0);
  distanceTravelled = 0;
  yaw = 0;
  drone.rotation.set(0, 0, 0);
  camera.position.set(0, mission === 1 ? 38 : mission === 2 ? 28 : 8, mission === 3 ? 60 : 74);
  document.querySelector('#flight-status').innerHTML = '<span class="live-dot"></span> В ПОЛЁТЕ';
  document.querySelector('#pause').title = 'Пауза';
  document.querySelector('#pause').setAttribute('aria-label', 'Пауза');
  if (notify) showBriefing();
}

function startAgriculture() {
  mission = 2;
  cityGroup.visible = false;
  farmGroup.visible = true;
  raceGroup.visible = false;
  inspectionDrone.visible = false;
  agricultureDrone.visible = true;
  fpvDrone.visible = false;
  drone = agricultureDrone;
  app.classList.add('agriculture');
  app.classList.remove('fpv');
  fpvReadout.hidden = true;
  missionRows.forEach(row => { row.hidden = true; });
  farmRows.forEach(row => { row.hidden = false; });
  raceRows.forEach(row => { row.hidden = true; });
  document.querySelector('#mode-name').textContent = 'ПОЛИВ';
  document.querySelector('#mission-heading-label').textContent = '02 / ПОЛИВ ПОЛЯ';
  document.querySelector('.mission-panel').setAttribute('aria-label', 'Задание по поливу поля');
  document.querySelector('#scan-range').textContent = '4–14 М';
  scanButton.title = 'Включить или выключить полив (F)';
  document.querySelector('#help-action').textContent = 'Полив';
  document.querySelector('.panel-title > span').textContent = 'ПОЛЕ 02';
  document.querySelector('.bottom-line > span').textContent = 'АЭРОГЕНИИ / ПОЛЕ 02';
  reset(false);
  showBriefing();
}

function startRace() {
  mission = 3;
  cityGroup.visible = false;
  farmGroup.visible = false;
  raceGroup.visible = true;
  inspectionDrone.visible = false;
  agricultureDrone.visible = false;
  fpvDrone.visible = true;
  drone = fpvDrone;
  app.classList.remove('agriculture');
  app.classList.add('fpv');
  fpvReadout.hidden = false;
  missionRows.forEach(row => { row.hidden = true; });
  farmRows.forEach(row => { row.hidden = true; });
  raceRows.forEach(row => { row.hidden = false; });
  document.querySelector('#mode-name').textContent = 'FPV-СЪЁМКА';
  document.querySelector('#mission-heading-label').textContent = '03 / СЪЁМКА ГОНКИ';
  document.querySelector('.mission-panel').setAttribute('aria-label', 'Задание по съёмке гонки');
  document.querySelector('#scan-range').textContent = 'ДО 45 М';
  scanButton.title = 'Начать или остановить запись (F)';
  document.querySelector('#help-move').textContent = 'Тангаж / крен';
  document.querySelector('#help-rise').textContent = 'Тяга';
  document.querySelector('#help-action').textContent = 'Запись';
  document.querySelector('#move-stick-label').textContent = 'ТЯГА / ПОВОРОТ';
  document.querySelector('#look-stick-label').textContent = 'ТАНГАЖ / КРЕН';
  document.querySelector('#move-stick').setAttribute('aria-label', 'Джойстик тяги и поворота');
  document.querySelector('#look-stick').setAttribute('aria-label', 'Джойстик тангажа и крена');
  document.querySelector('.panel-title > span').textContent = 'ТРАССА 03';
  document.querySelector('.bottom-line > span').textContent = 'АЭРОГЕНИИ / ТРАССА 03';
  reset(false);
  resize();
  showBriefing();
}

function restartFromBeginning() {
  mission = 1;
  cityGroup.visible = true;
  farmGroup.visible = false;
  raceGroup.visible = false;
  inspectionDrone.visible = true;
  agricultureDrone.visible = false;
  fpvDrone.visible = false;
  drone = inspectionDrone;
  app.classList.remove('agriculture');
  app.classList.remove('fpv');
  fpvReadout.hidden = true;
  missionRows.forEach(row => { row.hidden = false; });
  farmRows.forEach(row => { row.hidden = true; });
  raceRows.forEach(row => { row.hidden = true; });
  document.querySelector('#mode-name').textContent = 'ОБСЛЕДОВАНИЕ';
  document.querySelector('#mission-heading-label').textContent = '01 / ОБСЛЕДОВАНИЕ';
  document.querySelector('.mission-panel').setAttribute('aria-label', 'Задание по сканированию');
  document.querySelector('#scan-range').textContent = 'ДО 38 М';
  scanButton.title = 'Включить или выключить лидар (F)';
  document.querySelector('#help-move').textContent = 'Движение';
  document.querySelector('#help-rise').textContent = 'Высота';
  document.querySelector('#help-action').textContent = 'Лидар';
  document.querySelector('#move-stick-label').textContent = 'ДВИЖЕНИЕ';
  document.querySelector('#look-stick-label').textContent = 'ПОВОРОТ / ВЫСОТА';
  document.querySelector('#move-stick').setAttribute('aria-label', 'Джойстик движения');
  document.querySelector('#look-stick').setAttribute('aria-label', 'Джойстик поворота и высоты');
  document.querySelector('.panel-title > span').textContent = 'ПОЛИГОН 01';
  document.querySelector('.bottom-line > span').textContent = 'АЭРОГЕНИИ / ПОЛИГОН 01';
  reset(false);
  resize();
  showBriefing();
}

function togglePause() {
  if (crashed || finished || briefingOpen) return;
  paused = !paused;
  app.classList.toggle('paused', paused);
  beams.visible = scanning && !paused && mission === 1;
  sprayJets.visible = scanning && !paused && mission === 2;
  document.querySelector('#pause').title = paused ? 'Продолжить полёт' : 'Пауза';
  document.querySelector('#pause').setAttribute('aria-label', paused ? 'Продолжить полёт' : 'Пауза');
  document.querySelector('#flight-status').innerHTML = paused ? 'ПАУЗА' : '<span class="live-dot"></span> В ПОЛЁТЕ';
}

window.addEventListener('keydown', event => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  if (briefingOpen) return;
  keys.add(event.code);
  if (event.code === 'KeyP' && !event.repeat) togglePause();
  if (event.code === 'KeyR' && !event.repeat) reset();
  if (event.code === 'KeyF' && !event.repeat) setScanning(!scanning);
});
window.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', () => keys.clear());
document.querySelector('#pause').addEventListener('click', togglePause);
document.querySelector('#reset').addEventListener('click', () => reset());
document.querySelector('#restart').addEventListener('click', () => {
  if (!crashed && mission === 1) startAgriculture();
  else if (!crashed && mission === 2) startRace();
  else if (!crashed && mission === 3) restartFromBeginning();
  else reset();
});
document.querySelector('#briefing-start').addEventListener('click', () => {
  briefing.hidden = true;
  briefingOpen = false;
  keys.clear();
});
scanButton.addEventListener('click', () => setScanning(!scanning));
document.querySelector('#help-close').addEventListener('click', () => { document.querySelector('#help-panel').hidden = true; });

function setupStick(id, input) {
  const element = document.querySelector(id);
  const knob = element.querySelector('.stick-knob');
  let pointerId = null;
  function update(event) {
    const rect = element.getBoundingClientRect();
    const range = rect.width * 0.34;
    const dx = event.clientX - rect.left - rect.width / 2;
    const dy = event.clientY - rect.top - rect.height / 2;
    const factor = Math.min(1, range / (Math.hypot(dx, dy) || 1));
    input.x = dx * factor / range;
    input.y = dy * factor / range;
    knob.style.transform = `translate(calc(-50% + ${input.x * range}px), calc(-50% + ${input.y * range}px))`;
  }
  element.addEventListener('pointerdown', event => {
    if (pointerId !== null) return;
    pointerId = event.pointerId;
    element.setPointerCapture(pointerId);
    update(event);
  });
  element.addEventListener('pointermove', event => { if (event.pointerId === pointerId) update(event); });
  function release(event) {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    input.x = 0;
    input.y = 0;
    knob.style.transform = 'translate(-50%, -50%)';
  }
  element.addEventListener('pointerup', release);
  element.addEventListener('pointercancel', release);
  element.addEventListener('lostpointercapture', release);
}
setupStick('#move-stick', sticks.move);
setupStick('#look-stick', sticks.look);

function updateRaceCars(dt) {
  raceTime += dt;
  raceCars.forEach((car, index) => {
    const progress = (raceTime * (index ? 9.4 : 10.5) / raceCurve.getLength() + (index ? 0.005 : 0.045)) % 1;
    const point = raceCurve.getPointAt(progress);
    const tangent = raceCurve.getTangentAt(progress);
    const lane = index ? 2 : -2;
    car.position.set(point.x - tangent.z * lane, 0, point.z + tangent.x * lane);
    car.rotation.y = Math.atan2(-tangent.x, -tangent.z);
  });
}

function updateFpvFlight(dt) {
  const pitchInput = THREE.MathUtils.clamp(
    (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - sticks.look.y, -1, 1);
  const rollInput = THREE.MathUtils.clamp(
    (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + sticks.look.x, -1, 1);
  const yawInput = THREE.MathUtils.clamp(
    (keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0) + sticks.move.x, -1, 1);
  const thrustInput = THREE.MathUtils.clamp(
    (keys.has('Space') ? 1 : 0) - (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 1 : 0) - sticks.move.y, -1, 1);
  throttle = THREE.MathUtils.clamp(throttle + thrustInput * dt * 0.42, 0, 1);
  fpvThrottle.textContent = `${Math.round(throttle * 100)}%`;
  fpvYaw -= yawInput * dt * 1.8;
  const blend = 1 - Math.exp(-dt * 5);
  fpvPitch = THREE.MathUtils.lerp(fpvPitch, -pitchInput * 0.55, blend);
  fpvRoll = THREE.MathUtils.lerp(fpvRoll, -rollInput * 0.55, blend);
  drone.rotation.order = 'YXZ';
  drone.rotation.set(fpvPitch, fpvYaw, fpvRoll);
  fpvUp.set(0, 1, 0).applyQuaternion(drone.quaternion);
  velocity.addScaledVector(fpvUp, throttle * 30 * dt);
  velocity.y -= 15 * dt;
  velocity.x *= Math.exp(-dt * 0.45);
  velocity.z *= Math.exp(-dt * 0.45);
  velocity.y *= Math.exp(-dt * 0.65);
  velocity.clampLength(0, 29);
  const next = drone.position.clone().addScaledVector(velocity, dt);
  if (next.y < 1.4 || next.y > 47 || blocked(next.x, next.y, next.z) ||
    raceCars.some(car => next.distanceTo(car.position.clone().add(new THREE.Vector3(0, 1, 0))) < 2)) {
    crash();
    return;
  }
  distanceTravelled += Math.hypot(next.x - drone.position.x, next.z - drone.position.z);
  drone.position.copy(next);
  for (const rotor of fpvRotors) rotor.rotation.y += dt * 45;
}

function updateFpvCamera(dt) {
  const cockpit = new THREE.Vector3(0, 0.02, -1.12).applyQuaternion(drone.quaternion);
  camera.position.copy(drone.position).add(cockpit);
  camera.quaternion.copy(drone.quaternion).multiply(fpvCameraPitch);
  camera.updateMatrixWorld();
  if (paused || crashed || finished || briefingOpen) return;
  updateRaceCars(dt);
  let framed = null;
  for (const car of raceCars) {
    const aim = car.position.clone().add(new THREE.Vector3(0, 1.1, 0));
    const distance = aim.distanceTo(camera.position);
    fpvProjection.copy(aim).project(camera);
    if (distance > 7 && distance < 45 && fpvProjection.z > -1 && fpvProjection.z < 1 &&
      Math.abs(fpvProjection.x) < 0.55 && Math.abs(fpvProjection.y) < 0.55) {
      if (!framed || distance < framed.distance) framed = { car, distance };
      if (scanning && car.userData.captured < 7) car.userData.captured = Math.min(7, car.userData.captured + dt);
    }
  }
  fpvTarget.textContent = framed ? `${framed.car.userData.name.toUpperCase()} В КАДРЕ` : 'НАЙДИТЕ БОЛИД';
  document.querySelector('#scan-message').textContent = scanning
    ? framed ? 'ЗАПИСЬ ИДЁТ' : 'ДЕРЖИТЕ БОЛИД В КАДРЕ'
    : 'ЗАПИСЬ ВЫКЛЮЧЕНА';
  if (scanning) updateRaceMission();
}

function blocked(x, y, z) {
  if (Math.abs(x) > WORLD - 1 || Math.abs(z) > WORLD - 1) return true;
  const props = mission === 1 ? cityProps : mission === 2 ? farmProps : raceProps;
  if (props.some(prop => (
    Math.abs(x - prop.x) < prop.w / 2 + 1.15 &&
    Math.abs(z - prop.z) < prop.d / 2 + 1.15 &&
    y < prop.h + 1.3
  ))) return true;
  if (mission !== 1) return false;
  if (collisionBoxes.some(b => (
    Math.abs(x - b.x) < b.w / 2 + 1.15 &&
    Math.abs(z - b.z) < b.d / 2 + 1.15 &&
    y < b.h + 1.3
  ))) return true;
  return pitchedRoofs.some(roof => (
    Math.abs(x - roof.x) < roof.w / 2 + 1.15 &&
    Math.abs(z - roof.z) < roof.d / 2 + 1.15 &&
    y < roof.h + roof.rise * Math.max(0, 1 - Math.abs(x - roof.x) / (roof.w / 2)) + 1.6
  ));
}

function moveAxis(axis, amount) {
  const steps = Math.ceil(Math.abs(amount) / 0.3);
  if (!steps) return;
  const step = amount / steps;
  for (let index = 0; index < steps; index++) {
    const next = drone.position.clone();
    next[axis] += step;
    if (axis === 'y' && (next.y < 1.7 || next.y > 48)) {
      if (next.y < 1.7 && velocity.y < -4) crash();
      else velocity.y = 0;
      return;
    }
    if (blocked(next.x, next.y, next.z)) {
      if (Math.abs(velocity[axis]) >= 4) crash();
      else if (clock.elapsedTime - bumpTime > 1.6) {
        showToast('Препятствие рядом');
        bumpTime = clock.elapsedTime;
      }
      velocity[axis] = 0;
      return;
    }
    drone.position[axis] = next[axis];
  }
}

function drawMap() {
  const size = mini.width;
  const scale = size / (WORLD * 2);
  mapCtx.fillStyle = '#89a99a';
  mapCtx.fillRect(0, 0, size, size);
  if (mission === 3) {
    mapCtx.fillStyle = '#628579';
    mapCtx.fillRect(0, 0, size, size);
    mapCtx.strokeStyle = '#364550';
    mapCtx.lineWidth = 16 * scale;
    mapCtx.beginPath();
    racePoints.forEach((p, i) => {
      if (i === 0) mapCtx.moveTo((p.x + WORLD) * scale, (p.z + WORLD) * scale);
      else mapCtx.lineTo((p.x + WORLD) * scale, (p.z + WORLD) * scale);
    });
    mapCtx.closePath();
    mapCtx.stroke();
    mapCtx.lineWidth = 1;
    for (const [index, car] of raceCars.entries()) {
      mapCtx.fillStyle = index ? '#38a6e7' : '#f05f49';
      mapCtx.beginPath();
      mapCtx.arc((car.position.x + WORLD) * scale, (car.position.z + WORLD) * scale, 3.2, 0, Math.PI * 2);
      mapCtx.fill();
    }
  } else if (mission === 2) {
    mapCtx.fillStyle = '#b2a891';
    mapCtx.fillRect((36 - 3.5 + WORLD) * scale, (-70 + WORLD) * scale, 7 * scale, 116 * scale);
    mapCtx.fillRect((WORLD - 47) * scale, (42 - 3 + WORLD) * scale, 94 * scale, 6 * scale);
    for (const x of [-66, -58, -50]) {
      for (const z of [-55, -42, -29, -16, -3, 10, 23]) {
        mapCtx.fillStyle = '#426e53';
        mapCtx.beginPath();
        mapCtx.arc((x + WORLD) * scale, (z + WORLD) * scale, 2.1, 0, Math.PI * 2);
        mapCtx.fill();
      }
    }
    for (const [index, field] of fields.entries()) {
      const px = (field.x - field.w / 2 + WORLD) * scale;
      const py = (field.z - field.d / 2 + WORLD) * scale;
      mapCtx.fillStyle = '#6d7461';
      mapCtx.fillRect(px, py, field.w * scale, field.d * scale);
      mapCtx.fillStyle = '#5bb5da';
      for (const cell of field.cells) {
        if (!cell.done) continue;
        mapCtx.fillRect(
          (cell.x - field.w / (field.cols * 2) + WORLD) * scale,
          (cell.z - field.d / (field.rows * 2) + WORLD) * scale,
          field.w / field.cols * scale,
          field.d / field.rows * scale,
        );
      }
      mapCtx.strokeStyle = '#dbe4d5';
      mapCtx.lineWidth = 1.2;
      mapCtx.strokeRect(px, py, field.w * scale, field.d * scale);
      mapCtx.fillStyle = '#ffffff';
      mapCtx.font = 'bold 11px Arial';
      mapCtx.textAlign = 'center';
      mapCtx.textBaseline = 'middle';
      mapCtx.fillText(String(index + 1), (field.x + WORLD) * scale, (field.z + WORLD) * scale);
    }
    mapCtx.fillStyle = '#d9e8df';
    mapCtx.fillRect(
      (greenhouse.x - greenhouse.w / 2 + WORLD) * scale,
      (greenhouse.z - greenhouse.d / 2 + WORLD) * scale,
      greenhouse.w * scale, greenhouse.d * scale,
    );
    mapCtx.strokeStyle = '#557b83';
    mapCtx.strokeRect(
      (greenhouse.x - greenhouse.w / 2 + WORLD) * scale,
      (greenhouse.z - greenhouse.d / 2 + WORLD) * scale,
      greenhouse.w * scale, greenhouse.d * scale,
    );
    mapCtx.fillStyle = '#608797';
    mapCtx.beginPath();
    mapCtx.arc((54 + WORLD) * scale, (20 + WORLD) * scale, 3.1 * scale, 0, Math.PI * 2);
    mapCtx.fill();
    mapCtx.fillRect((-35.25 + WORLD) * scale, (41.5 + WORLD) * scale, 4.5 * scale, 3 * scale);
  } else {
    mapCtx.fillStyle = '#647584';
    mapCtx.fillRect((WORLD - 6) * scale, 0, 12 * scale, size);
    mapCtx.fillStyle = '#6d807d';
    mapCtx.fillRect((27 - 16.5 + WORLD) * scale, (13 - 19 + WORLD) * scale, 33 * scale, 38 * scale);
    mapCtx.fillStyle = '#9fb6b4';
    mapCtx.fillRect((utilityYard.x - utilityYard.w / 2 + WORLD) * scale,
      (utilityYard.z - utilityYard.d / 2 + WORLD) * scale,
      utilityYard.w * scale, utilityYard.d * scale);
    for (const prop of cityProps) {
      mapCtx.fillStyle = prop.h > 7 ? '#f3e4ab' : '#43687b';
      mapCtx.fillRect(
        (prop.x - prop.w / 2 + WORLD) * scale,
        (prop.z - prop.d / 2 + WORLD) * scale,
        Math.max(2, prop.w * scale), Math.max(2, prop.d * scale),
      );
    }
    for (const [index, site] of sites.entries()) {
      const px = (site.x - site.w / 2 + WORLD) * scale;
      const py = (site.z - site.d / 2 + WORLD) * scale;
      mapCtx.fillStyle = site.complete ? '#568fd5' : site.surfaces.some(surface => surface.covered) ? '#a9c9f0' : '#e7e8e5';
      mapCtx.fillRect(px, py, site.w * scale, site.d * scale);
      mapCtx.strokeStyle = '#233d57';
      mapCtx.lineWidth = 1.2;
      mapCtx.strokeRect(px, py, site.w * scale, site.d * scale);
      mapCtx.beginPath();
      mapCtx.moveTo((site.x + WORLD) * scale, py);
      mapCtx.lineTo((site.x + WORLD) * scale, py + site.d * scale);
      mapCtx.stroke();
      mapCtx.fillStyle = '#233d57';
      mapCtx.font = 'bold 11px Arial';
      mapCtx.textAlign = 'center';
      mapCtx.textBaseline = 'middle';
      mapCtx.fillText(String(index + 1), (site.x + WORLD) * scale, (site.z + WORLD) * scale);
    }
  }
  mapCtx.fillStyle = '#1f5bff';
  mapCtx.beginPath();
  const start = mission === 1 ? START : mission === 2 ? FARM_START : RACE_START;
  mapCtx.arc((start.x + WORLD) * scale, (start.z + WORLD) * scale, 3, 0, Math.PI * 2);
  mapCtx.fill();
  const x = (drone.position.x + WORLD) * scale;
  const y = (drone.position.z + WORLD) * scale;
  mapCtx.save();
  mapCtx.translate(x, y);
  mapCtx.rotate(-(mission === 3 ? fpvYaw : yaw));
  mapCtx.fillStyle = '#1f5bff';
  mapCtx.strokeStyle = '#fff';
  mapCtx.lineWidth = 1.5;
  mapCtx.beginPath();
  mapCtx.moveTo(0, -7);
  mapCtx.lineTo(5, 5);
  mapCtx.lineTo(0, 2);
  mapCtx.lineTo(-5, 5);
  mapCtx.closePath();
  mapCtx.fill();
  mapCtx.stroke();
  mapCtx.restore();
}

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (scanning && !paused) beams.material.opacity = 0.7 + 0.08 * Math.sin(clock.elapsedTime * 3);
  targetMarker.visible = mission === 1 && !sites[0].complete;
  targetMarker.position.y = sites[0].h + 9 + Math.sin(clock.elapsedTime * 2) * 0.28;
  if (mission === 3) {
    if (!briefingOpen && !paused && !crashed && !finished) updateFpvFlight(dt);
    updateFpvCamera(dt);
    shadow.position.set(drone.position.x, 0.16, drone.position.z);
    shadow.material.opacity = 0.27 * (1 - drone.position.y / 65);
    shadow.scale.setScalar(1 + drone.position.y * 0.035);
    targetIndicator.hidden = true;
    document.querySelector('#altitude').textContent = drone.position.y.toFixed(1);
    document.querySelector('#speed').textContent = Math.round(Math.hypot(velocity.x, velocity.z) * 3.6);
    document.querySelector('#distance').textContent = Math.round(distanceTravelled);
    document.querySelector('#coordinates').textContent = `${Math.round(drone.position.x)}, ${Math.round(drone.position.z)}`;
    drawMap();
    renderer.render(scene, camera);
    return;
  }
  if (!briefingOpen && !paused && !crashed && !finished) {
    const forward = THREE.MathUtils.clamp((keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - sticks.move.y, -1, 1);
    const strafe = THREE.MathUtils.clamp((keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0) + sticks.move.x, -1, 1);
    const turn = THREE.MathUtils.clamp((keys.has('KeyE') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyQ') || keys.has('ArrowLeft') ? 1 : 0) + sticks.look.x, -1, 1);
    const rise = THREE.MathUtils.clamp((keys.has('Space') ? 1 : 0) - (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 1 : 0) - sticks.look.y, -1, 1);
    yaw -= turn * dt * 1.55;
    const direction = new THREE.Vector3(strafe, 0, -forward);
    if (direction.lengthSq() > 1) direction.normalize();
    direction.applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
    const wanted = new THREE.Vector3(direction.x * 13, rise * 9, direction.z * 13);
    velocity.lerp(wanted, 1 - Math.exp(-dt * 4.2));
    const oldX = drone.position.x;
    const oldZ = drone.position.z;
    moveAxis('y', velocity.y * dt);
    if (!crashed) moveAxis('x', velocity.x * dt);
    if (!crashed) moveAxis('z', velocity.z * dt);
    distanceTravelled += Math.hypot(drone.position.x - oldX, drone.position.z - oldZ);
    if (!crashed) {
      drone.rotation.y = yaw;
      drone.rotation.x = THREE.MathUtils.lerp(drone.rotation.x, forward * 0.12, 1 - Math.exp(-dt * 4));
      drone.rotation.z = THREE.MathUtils.lerp(drone.rotation.z, -strafe * 0.14 - turn * 0.08, 1 - Math.exp(-dt * 4));
      for (const rotor of mission === 1 ? propellers : agriPropellers) rotor.rotation.y += dt * 36;
      if (mission === 2) updateSpray();
      if (scanning) {
        scanTimer += dt;
        if (scanTimer >= 0.13) {
          scanTimer = 0;
          if (mission === 1) scanPulse();
          else if (sprayJets.visible) irrigate(drone.position.x, drone.position.z);
        }
      }
    }
    shadow.position.set(drone.position.x, 0.16, drone.position.z);
    shadow.material.opacity = 0.27 * (1 - drone.position.y / 65);
    shadow.scale.setScalar(1 + drone.position.y * 0.035);
  }
  target.copy(drone.position).add(new THREE.Vector3(0, 0.6, 0));
  const cameraOffset = new THREE.Vector3(0, 22, 23).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
  desiredCamera.copy(target).add(cameraOffset);
  const rayDirection = desiredCamera.clone().sub(target);
  const rayDistance = rayDirection.length();
  raycaster.set(target, rayDirection.normalize());
  raycaster.far = rayDistance;
  const hit = mission === 1 ? raycaster.intersectObjects(buildings, false)[0] : null;
  if (hit) desiredCamera.copy(target).addScaledVector(rayDirection, Math.max(1.8, hit.distance - 0.6));
  camera.position.lerp(desiredCamera, 1 - Math.exp(-dt * 5.5));
  camera.lookAt(target.clone().add(new THREE.Vector3(0, 1, camera.aspect < 0.8 ? -12 : -17).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw)));
  targetIndicator.hidden = !targetMarker.visible || (container.clientWidth > 700 && container.clientHeight >= 550);
  if (!targetIndicator.hidden) {
    const projected = targetMarker.position.clone().project(camera);
    const width = container.clientWidth;
    const height = container.clientHeight;
    const x = THREE.MathUtils.clamp((projected.x + 1) * width / 2, 27, width - 27);
    let y = THREE.MathUtils.clamp((1 - projected.y) * height / 2, height < 550 ? 95 : 255, height < 550 ? height - 48 : height - 185);
    if (height >= 550 && x < 155 && y < 255) y = 255;
    targetIndicator.style.left = `${x}px`;
    targetIndicator.style.top = `${y}px`;
  }
  document.querySelector('#altitude').textContent = drone.position.y.toFixed(1);
  document.querySelector('#speed').textContent = Math.round(Math.hypot(velocity.x, velocity.z) * 3.6);
  document.querySelector('#distance').textContent = Math.round(distanceTravelled);
  document.querySelector('#coordinates').textContent = `${Math.round(drone.position.x)}, ${Math.round(drone.position.z)}`;
  const points = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'];
  document.querySelector('#heading').textContent = points[((Math.round(-yaw / (Math.PI / 4)) % 8) + 8) % 8];
  drawMap();
  renderer.render(scene, camera);
}

function resize() {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.fov = mission === 3 ? 88 : camera.aspect < 0.8 ? 72 : 65;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}
window.addEventListener('resize', resize);
if (new URLSearchParams(window.location.search).get('mission') === '2') {
  startAgriculture();
} else if (new URLSearchParams(window.location.search).get('mission') === '3') {
  startRace();
} else {
  reset(false);
  showBriefing();
}
frame();
