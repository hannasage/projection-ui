import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export interface NeonTubesOptions {
  colors: string[];
  light: boolean;
  onFrame?: () => void;
  onError?: (error: unknown) => void;
}

export interface NeonTubes {
  move(x: number, y: number): void;
  resize(width: number, height: number): void;
  setPalette(colors: string[], light: boolean): void;
  start(): void;
  stop(): void;
  dispose(): void;
}

/** An original, pointer-passive optical sculpture. All coordinates are hero-local. */
export function createNeonTubes(canvas: HTMLCanvasElement, options: NeonTubesOptions): NeonTubes {
  const cleanup: (() => void)[] = [];
  let ready = false;
  function release() {
    const failures: unknown[] = [];
    while (cleanup.length) {
      try { cleanup.pop()!(); } catch (error) { failures.push(error); }
    }
    return failures;
  }
  try {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: false, powerPreference: 'low-power' });
  cleanup.push(() => renderer.forceContextLoss(), () => renderer.dispose(), () => renderer.renderLists.dispose());
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  cleanup.push(() => scene.clear());
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
  camera.position.set(0, 0, 17);
  const sculpture = new THREE.Group();
  sculpture.rotation.z = -0.22;
  scene.add(sculpture);
  const key = new THREE.DirectionalLight(0xffffff, 2);
  key.position.set(-3, 5, 8);
  const rim = new THREE.DirectionalLight(0xddeeff, 1.6);
  rim.position.set(5, -2, 3);
  scene.add(key, rim, new THREE.HemisphereLight(0xffffff, 0x15152c, 0.7));

  const segments = 112;
  const sides = 10;
  const centers = Array.from({ length: segments + 1 }, () => new THREE.Vector3());
  const tangents = Array.from({ length: segments + 1 }, () => new THREE.Vector3());
  const normals = Array.from({ length: segments + 1 }, () => new THREE.Vector3());
  const binormals = Array.from({ length: segments + 1 }, () => new THREE.Vector3());
  const scratch = new THREE.Vector3();
  const axis = new THREE.Vector3(0, 0, 1);
  const materials: THREE.MeshPhysicalMaterial[] = [];
  const tubes: { geometry: THREE.BufferGeometry; positions: Float32Array; normals: Float32Array; tube: number; kind: number }[] = [];
  for (let tube = 0; tube < 4; tube++) {
    for (let kind = 0; kind < 3; kind++) {
      const geometry = new THREE.BufferGeometry();
      cleanup.push(() => geometry.dispose());
      const positions = new Float32Array((segments + 1) * sides * 3);
      const normalArray = new Float32Array(positions.length);
      const indices: number[] = [];
      for (let s = 0; s < segments; s++) for (let r = 0; r < sides; r++) {
        const a = s * sides + r, b = s * sides + (r + 1) % sides;
        indices.push(a, b, a + sides, b, b + sides, a + sides);
      }
      geometry.setIndex(indices);
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute('normal', new THREE.BufferAttribute(normalArray, 3).setUsage(THREE.DynamicDrawUsage));
      const material = new THREE.MeshPhysicalMaterial({ color: 0xffffff, emissive: 0xffffff, metalness: kind === 0 ? 0.62 : 0.15, roughness: kind === 0 ? 0.2 : 0.32, clearcoat: 1, clearcoatRoughness: 0.12 });
      cleanup.push(() => material.dispose());
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      sculpture.add(mesh);
      materials.push(material);
      tubes.push({ geometry, positions, normals: normalArray, tube, kind });
    }
  }
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  target.samples = Math.min(4, renderer.capabilities.maxSamples);
  let composerOwnsTarget = false;
  cleanup.push(() => { if (!composerOwnsTarget) target.dispose(); });
  const composer = new EffectComposer(renderer, target);
  composerOwnsTarget = true;
  cleanup.push(() => composer.dispose());
  composer.renderToScreen = false;
  const renderPass = new RenderPass(scene, camera);
  cleanup.push(() => renderPass.dispose());
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.4, 0.55, 0.35);
  cleanup.push(() => bloom.dispose());
  composer.addPass(renderPass);
  composer.addPass(bloom);
  const base = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  base.samples = Math.min(4, renderer.capabilities.maxSamples);
  cleanup.push(() => base.dispose());
  const compositeScene = new THREE.Scene();
  cleanup.push(() => compositeScene.clear());
  const compositeCamera = new THREE.Camera();
  const compositeMaterial = new THREE.ShaderMaterial({
    uniforms: { base: { value: base.texture }, optical: { value: composer.readBuffer.texture }, lightMode: { value: options.light ? 1 : 0 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `uniform sampler2D base; uniform sampler2D optical; uniform float lightMode; varying vec2 vUv;
      void main(){
        vec4 body=texture2D(base,vUv); vec3 total=texture2D(optical,vUv).rgb;
        vec3 halo=max(total-body.rgb,vec3(0.));
        float energy=max(halo.r,max(halo.g,halo.b));
        float alpha=max(body.a,clamp(energy*mix(.65,1.35,lightMode),0.,.92));
        float edge=smoothstep(0.,.08,vUv.x)*smoothstep(0.,.08,1.-vUv.x)*smoothstep(0.,.08,vUv.y)*smoothstep(0.,.08,1.-vUv.y);
        gl_FragColor=vec4((body.rgb+halo)/max(alpha,.001),alpha*edge);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    depthTest: false, depthWrite: false, transparent: true, blending: THREE.NoBlending,
  });
  cleanup.push(() => compositeMaterial.dispose());
  const quadGeometry = new THREE.PlaneGeometry(2, 2);
  cleanup.push(() => quadGeometry.dispose());
  compositeScene.add(new THREE.Mesh(quadGeometry, compositeMaterial));
  let width = 1, height = 1, running = false, disposed = false, raf = 0, lastTime = 0, elapsed = 0;
  let targetX = 0, targetY = 0, currentX = 0, currentY = 0, lastMove = -Infinity;
  function setPalette(colors: string[], light: boolean) {
    if (disposed) return;
    try {
    const palette = colors.length ? colors : ['#C9F53A', '#38D9FF', '#B56AFF'];
    materials.forEach((material, i) => {
      const kind = i % 3;
      material.color.set(kind === 1 ? '#ffffff' : palette[Math.floor(i / 3) % palette.length]);
      material.emissive.copy(material.color);
      material.emissiveIntensity = kind === 1 ? (light ? 0.4 : 0.8) : kind === 2 ? (light ? 0.6 : 1.1) : (light ? 0.3 : 0.65);
    });
    bloom.strength = light ? 0.25 : 0.4;
    compositeMaterial.uniforms.lightMode.value = light ? 1 : 0;
    if (!running && !disposed) renderStill();
    } catch (error) { fail(error); }
  }
  function updateGeometry(time: number) {
    for (let tube = 0; tube < 4; tube++) {
      const phase = tube * 1.61;
      for (let s = 0; s <= segments; s++) {
        const u = s / segments, a = (u - 0.5) * Math.PI * 2.45;
        centers[s].set(
          Math.sin(a + phase * 0.25 + Math.sin(time * 0.26 + a * 0.5) * 0.3) * (3.4 + tube * 0.13) + (u - 0.5) * 1.4 + currentX * Math.sin(u * Math.PI) * (0.25 + tube * 0.1),
          Math.cos(a * 0.87 + phase + time * 0.15) * 1.5 + Math.sin(a * 1.7 + phase * 0.4 - time * 0.2) * 0.65 - currentY * Math.sin(u * Math.PI) * (0.2 + tube * 0.08),
          Math.sin(a * 1.12 + phase + time * 0.17) * 2.2 + Math.cos(a * 2 + phase) * 0.35,
        );
      }
      for (let s = 0; s <= segments; s++) {
        tangents[s].subVectors(centers[Math.min(segments, s + 1)], centers[Math.max(0, s - 1)]).normalize();
        if (s === 0) normals[s].crossVectors(tangents[s], axis).normalize();
        else {
          normals[s].copy(normals[s - 1]);
          scratch.copy(tangents[s]).multiplyScalar(normals[s].dot(tangents[s]));
          normals[s].sub(scratch).normalize();
        }
        binormals[s].crossVectors(tangents[s], normals[s]).normalize();
      }
      for (let kind = 0; kind < 3; kind++) {
        const item = tubes[tube * 3 + kind];
        for (let s = 0; s <= segments; s++) {
          const u = s / segments, taper = Math.pow(Math.sin(Math.PI * u), 0.45);
          const radius = (kind === 0 ? 0.06 + tube * 0.005 : kind === 1 ? 0.007 : 0.012) * taper + 0.001;
          const offset = kind === 1 ? (0.063 + tube * 0.005) * taper : kind === 2 ? 0.31 * taper : 0;
          const twist = kind === 2 ? u * 7 + phase : -0.8;
          const ox = Math.cos(twist) * offset, oy = Math.sin(twist) * offset;
          for (let r = 0; r < sides; r++) {
            const angle = r / sides * Math.PI * 2, nx = Math.cos(angle), ny = Math.sin(angle);
            const index = (s * sides + r) * 3;
            for (let c = 0; c < 3; c++) {
              const n = normals[s].getComponent(c), b = binormals[s].getComponent(c);
              item.positions[index + c] = centers[s].getComponent(c) + n * (nx * radius + ox) + b * (ny * radius + oy);
              item.normals[index + c] = n * nx + b * ny;
            }
          }
        }
        item.geometry.attributes.position.needsUpdate = true;
        item.geometry.attributes.normal.needsUpdate = true;
      }
    }
  }
  function frame(now: number) {
    if (!running || disposed) return;
    try {
    const dt = Math.min((now - lastTime) / 1000 || 0.016, 0.05);
    lastTime = now; elapsed += dt;
    const idle = now - lastMove > 1800;
    const x = idle ? Math.sin(elapsed * 0.38) * 0.45 : targetX;
    const y = idle ? Math.cos(elapsed * 0.29) * 0.35 : targetY;
    const damping = 1 - Math.exp(-dt * 4.5);
    currentX += (x - currentX) * damping; currentY += (y - currentY) * damping;
    sculpture.rotation.y = currentX * 0.32;
    sculpture.rotation.x = currentY * 0.23;
    sculpture.position.set(currentX * 1.8, -currentY * 1.5, 0);
    updateGeometry(elapsed);
    renderStill(dt);
    if (running && !disposed) raf = requestAnimationFrame(frame);
    } catch (error) { fail(error); }
  }
  function renderStill(dt = 0) {
    if (disposed) return;
    renderer.setRenderTarget(base); renderer.clear(); renderer.render(scene, camera);
    composer.render(dt);
    compositeMaterial.uniforms.optical.value = composer.readBuffer.texture;
    renderer.setRenderTarget(null); renderer.clear(); renderer.render(compositeScene, compositeCamera);
    options.onFrame?.();
  }
  function stop() { running = false; cancelAnimationFrame(raf); raf = 0; }
  function dispose() {
    if (disposed) return;
    stop(); disposed = true;
    const failures = release();
    if (failures.length) throw new AggregateError(failures, 'Neon tube cleanup failed');
  }
  function fail(error: unknown) {
    if (!ready) throw error;
    if (disposed) return;
    let reported = error;
    try { dispose(); } catch (cleanupError) { reported = new AggregateError([error, cleanupError], 'Neon tube rendering and cleanup failed'); }
    if (options.onError) options.onError(reported);
    else throw reported;
  }
  updateGeometry(0);
  setPalette(options.colors, options.light);
  ready = true;
  return {
    move(x: number, y: number) { targetX = THREE.MathUtils.clamp(x / width * 2 - 1, -1, 1); targetY = THREE.MathUtils.clamp(y / height * 2 - 1, -1, 1); lastMove = performance.now(); },
    resize(w: number, h: number) {
      if (disposed) return;
      try {
      width = Math.max(1, w); height = Math.max(1, h);
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      renderer.setPixelRatio(dpr); renderer.setSize(width, height, false);
      composer.setPixelRatio(dpr); composer.setSize(width, height); base.setSize(Math.round(width * dpr), Math.round(height * dpr));
      camera.aspect = width / height; camera.position.z = Math.max(17, 9 / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect)); camera.updateProjectionMatrix();
      if (!running) renderStill();
      } catch (error) { fail(error); }
    },
    setPalette,
    start() { if (running || disposed) return; running = true; lastTime = performance.now(); raf = requestAnimationFrame(frame); },
    stop,
    dispose,
  };
  } catch (error) {
    const failures = release();
    if (failures.length) throw new AggregateError([error, ...failures], 'Neon tube initialization and cleanup failed', { cause: error });
    throw error;
  }
}
