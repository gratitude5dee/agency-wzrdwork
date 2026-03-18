import { useState, useEffect, useCallback, useRef, useMemo, Component, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

/* ─── WebGL Detection ─────────────────────────────────────────────── */

function isWebGLAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

/* ─── Error Boundary ──────────────────────────────────────────────── */

interface ErrorBoundaryProps {
  fallback: ReactNode;
  onError?: () => void;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class WebGLErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError?.();
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

/* ─── GLSL Shaders ────────────────────────────────────────────────── */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uTexture;
  uniform float uProgress;
  uniform float uDissolve;
  uniform float uBloom;
  uniform float uTime;
  varying vec2 vUv;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  vec2 fade(vec2 t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }

  float cnoise(vec2 P) {
    vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
    vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
    Pi = mod289(Pi);
    vec4 ix = Pi.xzxz;
    vec4 iy = Pi.yyww;
    vec4 fx = Pf.xzxz;
    vec4 fy = Pf.yyww;
    vec4 i = permute(permute(ix) + iy);
    vec4 gx = fract(i * (1.0 / 41.0)) * 2.0 - 1.0;
    vec4 gy = abs(gx) - 0.5;
    vec4 tx = floor(gx + 0.5);
    gx = gx - tx;
    vec2 g00 = vec2(gx.x, gy.x);
    vec2 g10 = vec2(gx.y, gy.y);
    vec2 g01 = vec2(gx.z, gy.z);
    vec2 g11 = vec2(gx.w, gy.w);
    vec4 norm = taylorInvSqrt(vec4(dot(g00,g00), dot(g01,g01), dot(g10,g10), dot(g11,g11)));
    g00 *= norm.x; g01 *= norm.y; g10 *= norm.z; g11 *= norm.w;
    float n00 = dot(g00, vec2(fx.x, fy.x));
    float n10 = dot(g10, vec2(fx.y, fy.y));
    float n01 = dot(g01, vec2(fx.z, fy.z));
    float n11 = dot(g11, vec2(fx.w, fy.w));
    vec2 fade_xy = fade(Pf.xy);
    vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
    float n_xy = mix(n_x.x, n_x.y, fade_xy.y);
    return 2.3 * n_xy;
  }

  void main() {
    float noiseScale = 4.0;
    float noiseVal = cnoise(vUv * noiseScale + uTime * 0.3);
    float dissolveEdge = smoothstep(uDissolve - 0.15, uDissolve + 0.05, (noiseVal + 1.0) * 0.5);
    float displaceAmount = (1.0 - uProgress) * 0.03;
    vec2 displacedUv = vUv + vec2(
      cnoise(vUv * 3.0 + uTime * 0.5) * displaceAmount,
      cnoise(vUv * 3.0 + uTime * 0.5 + 100.0) * displaceAmount
    );
    vec4 texColor = texture2D(uTexture, displacedUv);
    float edgeGlow = smoothstep(0.0, 0.15, dissolveEdge) * (1.0 - smoothstep(0.15, 0.4, dissolveEdge));
    vec3 glowColor = vec3(1.0, 0.45, 0.2);
    vec3 finalColor = mix(texColor.rgb, texColor.rgb + glowColor * 2.0, edgeGlow * uBloom);
    float alpha = texColor.a * dissolveEdge * uProgress;
    finalColor += glowColor * uBloom * 0.3 * texColor.a * dissolveEdge;
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

/* ─── Logo Plane Component ────────────────────────────────────────── */

interface LogoPlaneProps {
  phase: 'dark' | 'bloom' | 'reveal' | 'resolve';
}

function LogoPlane({ phase }: LogoPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const texture = useTexture('/wzrdtechlogo.png');
  const { viewport } = useThree();

  const uniforms = useMemo(
    () => ({
      uTexture: { value: texture },
      uProgress: { value: 0 },
      uDissolve: { value: 0 },
      uBloom: { value: 0 },
      uTime: { value: 0 },
    }),
    [texture],
  );

  const planeSize = useMemo(() => {
    const img = texture.image as { width: number; height: number } | undefined;
    const aspect = img ? img.width / img.height : 2;
    const maxW = viewport.width * 0.45;
    const maxH = viewport.height * 0.35;
    let w = maxW;
    let h = w / aspect;
    if (h > maxH) {
      h = maxH;
      w = h * aspect;
    }
    return [w, h] as const;
  }, [viewport.width, viewport.height, texture]);

  useFrame((_state, delta) => {
    uniforms.uTime.value += delta;

    let targetProgress = 0;
    let targetDissolve = 0;
    let targetBloom = 0;

    switch (phase) {
      case 'dark':
        targetProgress = 0;
        targetDissolve = 0;
        targetBloom = 0;
        break;
      case 'bloom':
        targetProgress = 0.3;
        targetDissolve = 0.15;
        targetBloom = 1.5;
        break;
      case 'reveal':
        targetProgress = 1;
        targetDissolve = 1;
        targetBloom = 0.8;
        break;
      case 'resolve':
        targetProgress = 1;
        targetDissolve = 1;
        targetBloom = 0;
        break;
    }

    const speed = 2.5;
    uniforms.uProgress.value += (targetProgress - uniforms.uProgress.value) * speed * delta;
    uniforms.uDissolve.value += (targetDissolve - uniforms.uDissolve.value) * speed * delta;
    uniforms.uBloom.value += (targetBloom - uniforms.uBloom.value) * speed * delta;
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[planeSize[0], planeSize[1]]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
      />
    </mesh>
  );
}

/* ─── Ambient Particles ───────────────────────────────────────────── */

function AmbientParticles({ phase }: { phase: string }) {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 120;

  const [positions, velocities] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 8;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 6;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 2;
      vel[i * 3] = (Math.random() - 0.5) * 0.01;
      vel[i * 3 + 1] = Math.random() * 0.01 + 0.002;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.005;
    }
    return [pos, vel];
  }, []);

  useFrame(() => {
    if (!pointsRef.current) return;
    const geo = pointsRef.current.geometry;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    const visible = phase !== 'dark';
    const speed = phase === 'bloom' ? 1.5 : 1;

    for (let i = 0; i < count; i++) {
      if (visible) {
        arr[i * 3] += velocities[i * 3] * speed;
        arr[i * 3 + 1] += velocities[i * 3 + 1] * speed;
        arr[i * 3 + 2] += velocities[i * 3 + 2] * speed;
      }
      if (arr[i * 3 + 1] > 3.5) {
        arr[i * 3 + 1] = -3.5;
        arr[i * 3] = (Math.random() - 0.5) * 8;
      }
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ff6b35" size={0.02} transparent opacity={phase === 'dark' ? 0 : 0.6} sizeAttenuation />
    </points>
  );
}

/* ─── Scene ───────────────────────────────────────────────────────── */

interface SceneProps {
  phase: 'dark' | 'bloom' | 'reveal' | 'resolve';
}

function Scene({ phase }: SceneProps) {
  const bloomIntensity = phase === 'bloom' ? 2.5 : phase === 'reveal' ? 1.2 : phase === 'resolve' ? 0.2 : 0;

  return (
    <>
      <color attach="background" args={['#000000']} />
      <ambientLight intensity={0.3} />
      <LogoPlane phase={phase} />
      <AmbientParticles phase={phase} />
      <EffectComposer>
        <Bloom intensity={bloomIntensity} luminanceThreshold={0.1} luminanceSmoothing={0.9} />
        <Vignette darkness={0.7} offset={0.3} />
      </EffectComposer>
    </>
  );
}

/* ─── Main CinematicIntro Component ───────────────────────────────── */

interface CinematicIntroProps {
  onComplete: () => void;
}

type Phase = 'dark' | 'bloom' | 'reveal' | 'resolve' | 'complete';

const CinematicIntro = ({ onComplete }: CinematicIntroProps) => {
  const [phase, setPhase] = useState<Phase>('dark');
  const [webglAvailable] = useState(() => isWebGLAvailable());

  useEffect(() => {
    if (!webglAvailable) {
      onComplete();
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setPhase('bloom'), 500));
    timers.push(setTimeout(() => setPhase('reveal'), 1800));
    timers.push(setTimeout(() => setPhase('resolve'), 3800));
    timers.push(
      setTimeout(() => {
        setPhase('complete');
        onComplete();
      }, 5000),
    );

    return () => timers.forEach(clearTimeout);
  }, [onComplete, webglAvailable]);

  useEffect(() => {
    const safety = setTimeout(() => {
      setPhase((prev) => {
        if (prev !== 'complete') {
          onComplete();
          return 'complete';
        }
        return prev;
      });
    }, 6000);
    return () => clearTimeout(safety);
  }, [onComplete]);

  const handleSkip = useCallback(() => {
    setPhase('complete');
    onComplete();
  }, [onComplete]);

  const handleWebGLError = useCallback(() => {
    setPhase('complete');
    onComplete();
  }, [onComplete]);

  if (!webglAvailable || phase === 'complete') return null;

  return (
    <motion.div
      className="fixed inset-0 z-[9999] cursor-pointer bg-black"
      onClick={handleSkip}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      <WebGLErrorBoundary
        fallback={<div className="flex h-full w-full items-center justify-center bg-black" />}
        onError={handleWebGLError}
      >
        <Canvas
          gl={{ antialias: true, alpha: false }}
          camera={{ position: [0, 0, 5], fov: 50 }}
          style={{ width: '100%', height: '100%' }}
          fallback={<div className="flex h-full w-full items-center justify-center bg-black" />}
        >
          <Scene phase={phase as Exclude<Phase, 'complete'>} />
        </Canvas>
      </WebGLErrorBoundary>

      <motion.p
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.3em] text-zinc-600"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.6 }}
      >
        Click anywhere to skip
      </motion.p>
    </motion.div>
  );
};

export default CinematicIntro;
