// Walking inside the world built from their picture (server/marble.mjs: World Labs' Marble).
// three.js draws the scene and Spark draws the world itself: soft coloured points, about a hundred
// thousand of them, which a TV can draw. World Labs keeps worlds as cameras see them, y down and z
// ahead, so each is turned over to stand upright (as the Dream Canvas, an earlier prototype, did).
// They start where the picture was taken and walk with the remote: ▲ ▼ a step forward or back, ◀ ▶ a
// turn, each eased, so a held button walks on. A world built from one picture is whole only near
// where it was taken, so they may walk a little way from it and no further.
//
// Loaded only when someone walks inside (main.js realWalkLib): served, as a module beside the
// page's own, three.js and Spark found by the page's import map; packed into one file, it is kept
// in the page as text and read only then, so it costs the TV nothing until it is wanted.
import * as THREE from 'three';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';
import { EASE, stepFor } from './steps.js';

// the part of the screen's pixels it draws: all of them, unless the TV can't keep up, and then
// two thirds, scaled up to fill it (judged on its first `TRIAL` frames: too many slower than 20 a
// second)
const SHARP = 1, SOFT = 0.66, TRIAL = 60;

export function createRealWalk(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#05060d');
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 500);
  scene.add(new SparkRenderer({ renderer }));
  let world = null, want = { x: 0, z: 0, yaw: 0 }, at = { ...want }, last = 0, frames = 0, slow = 0, sharp = SHARP;
  const fit = () => {
    const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
    renderer.setSize(Math.round(w * sharp), Math.round(h * sharp), false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const frame = (t) => {
    const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
    last = t;
    if (dt > 1 / 20) slow++;
    const k = 1 - Math.exp(-dt / EASE);
    at = { x: at.x + (want.x - at.x) * k, z: at.z + (want.z - at.z) * k, yaw: at.yaw + (want.yaw - at.yaw) * k };
    camera.position.set(at.x, 0, at.z);
    camera.rotation.set(0, at.yaw, 0);
    renderer.render(scene, camera);
    frames++;
    if (frames === TRIAL && sharp === SHARP && slow > TRIAL / 3) { sharp = SOFT; fit(); }
  };
  return {
    // the world's file (`bytes`, a Uint8Array, as `type` 'spz' or 'ply'), and its own measure of a
    // metre if it gives one, so walking feels like walking. Resolves once it stands there.
    async open({ bytes, type = 'spz', scale = null }) {
      container.append(renderer.domElement);
      fit();
      world = new SplatMesh({ fileBytes: bytes, fileType: type });
      world.quaternion.set(1, 0, 0, 0);
      if (scale > 0.01 && scale < 100) world.scale.setScalar(scale);
      scene.add(world);
      await world.initialized;
      want = { x: 0, z: 0, yaw: 0 }; at = { ...want }; last = 0; frames = 0; slow = 0;
      renderer.setAnimationLoop(frame);
    },
    // a button pressed: true if it moved them
    press(button) {
      const next = world && stepFor(want, button);
      if (!next) return false;
      want = next;
      return true;
    },
    close() {
      renderer.setAnimationLoop(null);
      if (world) { scene.remove(world); world.dispose(); world = null; }
      renderer.domElement.remove();
    },
    dispose() { this.close(); renderer.dispose(); },
    get state() { return { open: !!world, at: { ...at }, want: { ...want }, frames, slow, sharp }; },
  };
}
