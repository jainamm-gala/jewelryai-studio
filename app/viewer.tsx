"use client";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  Component,
  type ReactNode,
} from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  Lightformer,
  ContactShadows,
  Grid,
} from "@react-three/drei";
import * as THREE from "three";
import type { Design, ModelData, MeshData } from "./types";
import { MATERIALS } from "./types";

export const VIEWS = [
  "Perspective",
  "Front",
  "Back",
  "Left",
  "Right",
  "Top",
  "Bottom",
  "Section",
] as const;
export type View = (typeof VIEWS)[number];
const CAMERAS: Record<View, [number, number, number]> = {
  Perspective: [34, 25, 36],
  Front: [0, 4, 48],
  Back: [0, 4, -48],
  Left: [-48, 4, 0],
  Right: [48, 4, 0],
  Top: [0, 52, 0.01],
  Bottom: [0, -52, 0.01],
  Section: [30, 15, 42],
};
function useMesh(data: MeshData) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(data.positions, 3),
    );
    g.setIndex(data.indices);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }, [data]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}
function Ring({
  model,
  design,
  wireframe,
  ghost = false,
  section = false,
  thumbnail = false,
}: {
  model: ModelData;
  design: Design;
  wireframe: boolean;
  ghost?: boolean;
  section?: boolean;
  thumbnail?: boolean;
}) {
  const metal = useMesh(model.metal),
    stone = useMesh(model.stone);
  const color =
    MATERIALS.find((m) => m.id === design.material)?.color || "#d7b66c";
  const gemColors = {
    diamond: "#e2f1ff",
    emerald: "#0a936a",
    sapphire: "#3549ad",
    ruby: "#be3158",
  };
  const planes = useMemo(
    () => (section ? [new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)] : []),
    [section],
  );
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.5, 0]}>
      <mesh geometry={metal} castShadow receiveShadow>
        <meshStandardMaterial
          color={ghost ? "#a89bf6" : color}
          metalness={thumbnail ? 0.35 : 1}
          roughness={0.24}
          wireframe={wireframe || ghost}
          transparent={ghost}
          opacity={ghost ? 0.3 : 1}
          clippingPlanes={planes}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh geometry={stone} castShadow>
        <meshPhysicalMaterial
          color={ghost ? "#a89bf6" : gemColors[design.stone.type]}
          metalness={0}
          roughness={0.05}
          transmission={ghost || thumbnail || wireframe ? 0 : 0.48}
          thickness={1.5}
          ior={2.42}
          clearcoat={1}
          envMapIntensity={1.8}
          flatShading
          wireframe={wireframe || ghost}
          transparent={ghost}
          opacity={ghost ? 0.25 : 1}
          clippingPlanes={planes}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
function CameraRig({
  view,
  reset,
  orthographic,
}: {
  view: View;
  reset: number;
  orthographic: boolean;
}) {
  const controls = useRef<any>(null);
  const { camera, invalidate } = useThree();
  useEffect(() => {
    camera.position.set(...CAMERAS[view]);
    camera.up.set(0, 1, 0);
    if (view === "Top" || view === "Bottom") camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    controls.current?.target.set(0, 0, 0);
    controls.current?.update();
    invalidate();
  }, [camera, view, reset, orthographic, invalidate]);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      minDistance={20}
      maxDistance={110}
      enableDamping
      dampingFactor={0.12}
    />
  );
}
class ViewerBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="viewer-fallback">
        The 3D viewer needs WebGL. CAD generation, measurements and exports
        remain available.
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function Viewer({
  model,
  design,
  view,
  wireframe,
  grid,
  orthographic,
  reset,
  compare,
  thumbnail = false,
}: {
  model: ModelData;
  design: Design;
  view: View;
  wireframe?: boolean;
  grid?: boolean;
  orthographic?: boolean;
  reset?: number;
  compare?: { model: ModelData; design: Design } | null;
  thumbnail?: boolean;
}) {
  return (
    <ViewerBoundary>
      <Canvas
        key={orthographic ? "ortho" : "persp"}
        frameloop="demand"
        dpr={thumbnail ? 1 : [1, 1.75]}
        shadows={!thumbnail}
        orthographic={orthographic}
        camera={
          orthographic
            ? {
                position: CAMERAS[view],
                zoom: thumbnail ? 2 : 15,
                near: 0.1,
                far: 300,
              }
            : {
                position: CAMERAS[view],
                fov: thumbnail ? 40 : 36,
                near: 0.1,
                far: 300,
              }
        }
        gl={{
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: true,
          localClippingEnabled: true,
        }}
      >
        <ambientLight intensity={thumbnail ? 2 : 0.45} />
        <directionalLight
          position={[10, 25, 15]}
          intensity={3.5}
          color="#fff5de"
        />
        <directionalLight
          position={[-20, 8, -10]}
          intensity={2.5}
          color="#c6c0ff"
        />
        <Suspense fallback={null}>
          {!thumbnail && (
            <Environment resolution={128}>
              <Lightformer
                form="rect"
                intensity={4}
                position={[0, 15, -15]}
                scale={[25, 15, 1]}
                rotation={[Math.PI / 3, 0, 0]}
              />
              <Lightformer
                form="rect"
                intensity={5}
                position={[-15, 5, 0]}
                scale={[20, 4, 1]}
                rotation={[0, Math.PI / 2, 0]}
              />
              <Lightformer
                form="ring"
                intensity={4}
                position={[15, 10, 15]}
                scale={12}
                target={[0, 0, 0]}
              />
            </Environment>
          )}
          <Ring
            model={model}
            design={design}
            wireframe={!!wireframe}
            section={view === "Section"}
            thumbnail={thumbnail}
          />
          {compare && (
            <Ring
              model={compare.model}
              design={compare.design}
              wireframe
              ghost
            />
          )}
          {!thumbnail && (
            <ContactShadows
              position={[
                0,
                -(design.innerDiameterMm / 2 + design.shank.thicknessMm) - 2.7,
                0,
              ]}
              opacity={0.4}
              scale={65}
              blur={2.5}
              far={24}
              frames={1}
              color="#000000"
            />
          )}
          {grid && !thumbnail && (
            <Grid
              position={[0, -13.4, 0]}
              args={[80, 80]}
              cellSize={2}
              sectionSize={10}
              cellColor="#242331"
              sectionColor="#3c374f"
              cellThickness={0.5}
              sectionThickness={0.7}
              fadeDistance={85}
              infiniteGrid
            />
          )}
        </Suspense>
        {!thumbnail && (
          <CameraRig
            view={view}
            reset={reset || 0}
            orthographic={!!orthographic}
          />
        )}
      </Canvas>
    </ViewerBoundary>
  );
}
