"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";
import { useDeviceTier } from "@/lib/motion";

interface ThreeHeroProps {
  dimmed?: boolean;
}

const ParticleField = ({ dimmed }: { dimmed?: boolean }) => {
  const pointsRef = useRef<THREE.Points>(null);

  // Responsive particle count — deliberately conservative so the canvas
  // stays smooth on office laptops with weak/software WebGL.
  const [particleCount, setParticleCount] = useState(700);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);

  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    setParticleCount(isMobile ? 250 : 700);

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) =>
      setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", listener);

    // Freeze the render loop while the tab is hidden (saves GPU + battery).
    const onVisibility = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      mediaQuery.removeEventListener("change", listener);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const [positions] = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const initPos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      // Create a cylinder-like / machine-like distribution
      const theta = Math.random() * 2 * Math.PI;
      const y = (Math.random() - 0.5) * 4;
      const r = 1.5 + Math.random() * 0.5;

      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);

      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      initPos[i * 3] = x;
      initPos[i * 3 + 1] = y;
      initPos[i * 3 + 2] = z;
    }
    return [pos, initPos];
  }, [particleCount]);

  // Mouse tracking for parallax
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (prefersReducedMotion) return;
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -(e.clientY / window.innerHeight) * 2 + 1,
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [prefersReducedMotion]);

  useFrame((_state, delta) => {
    if (!pointsRef.current || prefersReducedMotion || tabHidden) return;

    // Slow rotation
    pointsRef.current.rotation.y += delta * 0.1;
    pointsRef.current.rotation.x += delta * 0.05;

    // Parallax effect
    pointsRef.current.position.x = THREE.MathUtils.lerp(
      pointsRef.current.position.x,
      mousePosition.x * 0.5,
      0.1,
    );
    pointsRef.current.position.y = THREE.MathUtils.lerp(
      pointsRef.current.position.y,
      mousePosition.y * 0.5,
      0.1,
    );
  });

  return (
    <Points
      ref={pointsRef}
      positions={positions}
      stride={3}
      frustumCulled={false}
    >
      <PointMaterial
        transparent
        color={dimmed ? "#3b82f6" : "#60a5fa"}
        size={0.05}
        sizeAttenuation={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        opacity={dimmed ? 0.3 : 0.8}
      />
    </Points>
  );
};

// Graceful degradation: if WebGL is unavailable (blocked driver, software
// renderer that fails, headless browser), render nothing — the static mesh
// gradient backdrop behind the canvas keeps the gateway looking intentional.
function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl2") || canvas.getContext("webgl"))
    );
  } catch {
    return false;
  }
}

export default function ThreeHero({ dimmed = false }: ThreeHeroProps) {
  const tier = useDeviceTier();
  if (typeof window !== "undefined" && (!hasWebGL() || tier === "low"))
    return null;

  return (
    <div className="absolute inset-0 z-0 pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 60 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, powerPreference: "high-performance" }}
      >
        <ParticleField dimmed={dimmed} />
      </Canvas>
    </div>
  );
}
