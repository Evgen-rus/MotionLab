import {ease, lerp, phase} from './shot-motion.mjs';

export function cameraRig(camera, shots) {
  if (!shots.length) throw new Error('Add at least one camera pose');
  if (shots.some((pose, index) => index > 0 && pose.at <= shots[index - 1].at)) {
    throw new Error('Order camera poses by strictly increasing time');
  }
  const defaultFov = camera.fov;
  const vector = (a, b, progress) => a.map((value, index) => lerp(value, b[index], progress));
  return time => {
    const next = shots.findIndex(pose => pose.at > time);
    const from = shots[next === -1 ? shots.length - 1 : Math.max(0, next - 1)];
    const to = shots[next] ?? from;
    const p = from === to ? 0 : ease(phase(time, from.at, to.at));
    camera.position.set(...vector(from.position, to.position, p));
    camera.lookAt(...vector(from.target, to.target, p));
    if (defaultFov !== undefined) {
      camera.fov = lerp(from.fov ?? defaultFov, to.fov ?? defaultFov, p);
      camera.updateProjectionMatrix();
    }
  };
}

// Angles are in radians. The direction and target are calculated from authored poses.
export function orbitPose(at, {azimuth, elevation, distance, target = [0, 0, 0], fov}) {
  const horizontal = Math.cos(elevation) * distance;
  return {at, target, fov, position: [
    target[0] + Math.sin(azimuth) * horizontal,
    target[1] + Math.sin(elevation) * distance,
    target[2] + Math.cos(azimuth) * horizontal,
  ]};
}

// Optional lit device with a separate, unlit CanvasTexture so its UI stays readable.
export function productStage(THREE, {width, height, canvas, finish = 0x294652, backgroundLight = 0xa7cadd}) {
  const scene = new THREE.Scene();
  const device = new THREE.Group();
  scene.add(device);
  const depth = 0.13;
  const radius = Math.min(width, height) * 0.036;
  const left = -width / 2;
  const bottom = -height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(left + radius, bottom);
  shape.lineTo(-left - radius, bottom);
  shape.quadraticCurveTo(-left, bottom, -left, bottom + radius);
  shape.lineTo(-left, -bottom - radius);
  shape.quadraticCurveTo(-left, -bottom, -left - radius, -bottom);
  shape.lineTo(left + radius, -bottom);
  shape.quadraticCurveTo(left, -bottom, left, -bottom - radius);
  shape.lineTo(left, bottom + radius);
  shape.quadraticCurveTo(left, bottom, left + radius, bottom);
  const body = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.03, bevelThickness: 0.028, curveSegments: 8}),
    new THREE.MeshStandardMaterial({color: finish, metalness: 0.56, roughness: 0.29}),
  );
  body.position.z = -depth / 2;
  device.add(body);

  const screen = new THREE.CanvasTexture(canvas);
  screen.colorSpace = THREE.SRGBColorSpace;
  screen.anisotropy = 4;
  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(width - 0.16, height - 0.16),
    new THREE.MeshBasicMaterial({map: screen, toneMapped: false}),
  );
  surface.position.z = depth / 2 + 0.03;
  device.add(surface);

  scene.add(new THREE.HemisphereLight(backgroundLight, 0x27333e, 1.7));
  const lighting = [
    [0xffe7bc, 3.1, [-4, 4, 3]],
    [0x9ac5ff, 2.1, [4, 0.5, 2]],
    [0xecfafc, 3.0, [2, 3, -3]],
  ];
  for (const [color, intensity, position] of lighting) {
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(...position);
    scene.add(light);
  }
  return {scene, device, screen, surface};
}

// Project a screen-local point (-.5 to .5) for a correctly placed overlay or peel-off card.
export function screenPosition(THREE, surface, camera, [u, v], [width, height]) {
  const {width: screenWidth, height: screenHeight} = surface.geometry.parameters;
  const position = new THREE.Vector3(u * screenWidth, v * screenHeight, 0);
  surface.localToWorld(position).project(camera);
  return [(position.x + 1) * width / 2, (1 - position.y) * height / 2];
}
