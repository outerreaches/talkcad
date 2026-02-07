import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport, Line } from '@react-three/drei';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { useRenderStore, useSettingsStore } from '../store';

function decodeBase64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function Viewport() {
  const { stlData, stats, isRendering, errors, setCaptureViewport } = useRenderStore();
  const { meshDisplayMode, meshColor, setMeshDisplayMode, showAxisGizmo, setShowAxisGizmo, cameraMode, setCameraMode } = useSettingsStore();

  // Store the gl context reference for viewport capture
  const glRef = useRef<THREE.WebGLRenderer | null>(null);

  // Register capture function when gl is available
  const captureViewport = useCallback((): string | null => {
    const gl = glRef.current;
    if (!gl) return null;
    try {
      // Get the canvas data as base64 PNG (strip the data URL prefix)
      // The canvas is already rendered by R3F's animation loop
      const dataUrl = gl.domElement.toDataURL('image/png');
      return dataUrl.replace(/^data:image\/png;base64,/, '');
    } catch (e) {
      console.error('Failed to capture viewport:', e);
      return null;
    }
  }, []);

  // Register/unregister capture function
  useEffect(() => {
    setCaptureViewport(captureViewport);
    return () => setCaptureViewport(null);
  }, [captureViewport, setCaptureViewport]);

  // NOTE: OrbitControls from drei is typed against three-stdlib. Keep this as `any` to avoid
  // forcing a direct dependency/type import here.
  const controlsRef = useRef<any>(null);

  // Always compute geometry via hooks (even if we early-return) to preserve hook order.
  const geometryOrError = useMemo((): { geometry: THREE.BufferGeometry | null; error?: string } => {
    if (!stlData) return { geometry: null };
    try {
      const bytes = decodeBase64ToBytes(stlData);
      const loader = new STLLoader();
      const geom = loader.parse(bytes.buffer as ArrayBuffer);
      geom.computeBoundingSphere();
      return { geometry: geom };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return { geometry: null, error: msg };
    }
  }, [stlData]);

  useEffect(() => {
    if (!geometryOrError.geometry) return;
    return () => geometryOrError.geometry?.dispose();
  }, [geometryOrError.geometry]);

  if (errors.length > 0) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-900 p-4">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-red-400 font-medium mb-2">Render Error</p>
          <pre className="text-xs text-zinc-400 bg-zinc-800 p-3 rounded overflow-auto max-h-40 text-left">
            {errors.join('\n')}
          </pre>
        </div>
      </div>
    );
  }

  if (isRendering) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-900">
        <div className="text-center">
          <div className="w-8 h-8 mx-auto mb-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-400 text-sm">Rendering...</p>
        </div>
      </div>
    );
  }

  if (!stlData) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-900 text-zinc-500">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          <p>No preview</p>
          <p className="text-sm mt-1">Generate or render code to see preview</p>
        </div>
      </div>
    );
  }

  if (geometryOrError.error) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-900 p-4">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-red-400 font-medium mb-2">Preview Error</p>
          <pre className="text-xs text-zinc-400 bg-zinc-800 p-3 rounded overflow-auto max-h-40 text-left">
            {geometryOrError.error}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full relative viewport-canvas">
      <Canvas
        key={cameraMode} // Force remount when camera mode changes
        orthographic={cameraMode === 'orthographic'}
        camera={
          cameraMode === 'orthographic'
            ? { position: [100, 100, 100], zoom: 5, near: 0.1, far: 10000 }
            : { position: [100, 100, 100], fov: 50, near: 0.1, far: 10000 }
        }
        gl={{ antialias: true, preserveDrawingBuffer: true }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.4} />
          <directionalLight position={[10, 10, 5]} intensity={0.8} />
          <directionalLight position={[-10, -10, -5]} intensity={0.3} />

          {geometryOrError.geometry && (
            <STLModel
              geometry={geometryOrError.geometry}
              wireframe={meshDisplayMode === 'wireframe'}
              color={meshColor}
            />
          )}
          <AutoFitView geometry={geometryOrError.geometry} controlsRef={controlsRef} />

          <OrbitControls
            ref={controlsRef}
            makeDefault
            enableDamping
            dampingFactor={0.05}
            minDistance={10}
            maxDistance={1000}
          />

          <Grid
            infiniteGrid
            fadeDistance={500}
            fadeStrength={5}
            cellSize={10}
            cellThickness={0.5}
            cellColor="#3f3f46"
            sectionSize={50}
            sectionThickness={1}
            sectionColor="#52525b"
          />

          {/* Axis lines at origin - X (red), Y (green), Z (blue) */}
          {showAxisGizmo && <AxisLines />}

          {/* Coordinate system gizmo (bottom-left corner) */}
          {showAxisGizmo && (
            <GizmoHelper alignment="bottom-left" margin={[60, 60]}>
              <GizmoViewport
                axisColors={['#ef4444', '#22c55e', '#3b82f6']}
                labelColor="white"
              />
            </GizmoHelper>
          )}

          {/* Capture gl reference for viewport screenshots */}
          <GlCapture glRef={glRef} />
        </Suspense>
      </Canvas>

      {/* Stats overlay */}
      {stats && (
        <div className="absolute bottom-3 left-3 text-xs text-zinc-400 bg-zinc-800/90 px-2 py-1.5 rounded">
          <span>
            {stats.dimensions.x.toFixed(1)} × {stats.dimensions.y.toFixed(1)} × {stats.dimensions.z.toFixed(1)} mm
          </span>
          <span className="mx-2 text-zinc-600">|</span>
          <span className={stats.manifold ? 'text-green-400' : 'text-red-400'}>
            {stats.manifold ? '✓ Manifold' : '✗ Not manifold'}
          </span>
          <span className="mx-2 text-zinc-600">|</span>
          <span>{stats.triangles.toLocaleString()} tris</span>
        </div>
      )}

      {/* View controls hint */}
      <div className="absolute bottom-3 right-3 text-xs text-zinc-500">
        Orbit: drag | Pan: right-drag | Zoom: scroll
      </div>

      {/* View controls */}
      <div className="absolute top-3 right-3 flex gap-2">
        {/* Camera mode toggle */}
        <button
          onClick={() => setCameraMode(cameraMode === 'perspective' ? 'orthographic' : 'perspective')}
          className="px-2 py-1.5 text-xs bg-zinc-800/90 hover:bg-zinc-700/90 text-zinc-300 rounded flex items-center gap-1.5 transition-colors"
          title={cameraMode === 'perspective' ? 'Switch to orthographic' : 'Switch to perspective'}
        >
          {cameraMode === 'perspective' ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Persp
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              Ortho
            </>
          )}
        </button>

        {/* Axis toggle */}
        <button
          onClick={() => setShowAxisGizmo(!showAxisGizmo)}
          className={`px-2 py-1.5 text-xs rounded flex items-center gap-1.5 transition-colors ${
            showAxisGizmo
              ? 'bg-zinc-700/90 text-zinc-200'
              : 'bg-zinc-800/90 hover:bg-zinc-700/90 text-zinc-400'
          }`}
          title={showAxisGizmo ? 'Hide axes' : 'Show axes'}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21l5-5 5 5M12 16V3M3 12l9 4 9-4" />
          </svg>
          XYZ
        </button>

        {/* Wireframe/Solid toggle */}
        <button
          onClick={() => setMeshDisplayMode(meshDisplayMode === 'solid' ? 'wireframe' : 'solid')}
          className="px-2 py-1.5 text-xs bg-zinc-800/90 hover:bg-zinc-700/90 text-zinc-300 rounded flex items-center gap-1.5 transition-colors"
          title={meshDisplayMode === 'solid' ? 'Switch to wireframe' : 'Switch to solid'}
        >
          {meshDisplayMode === 'solid' ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              Solid
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
              Wire
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function AutoFitView({
  geometry,
  controlsRef,
}: {
  geometry: THREE.BufferGeometry | null;
  controlsRef: React.RefObject<any>;
}) {
  const { camera } = useThree();
  const didFitRef = useRef(false);

  useEffect(() => {
    if (!geometry) {
      didFitRef.current = false;
      return;
    }
    if (didFitRef.current) return;

    geometry.computeBoundingSphere();
    const sphere = geometry.boundingSphere;
    if (!sphere || !Number.isFinite(sphere.radius) || sphere.radius <= 0) {
      return;
    }

    const center = sphere.center.clone();
    const radius = sphere.radius;

    // Position camera so the model is comfortably in view
    const distance = Math.max(20, radius * 2.5);
    camera.position.set(center.x + distance, center.y + distance, center.z + distance);
    camera.near = Math.max(0.1, radius / 100);
    camera.far = Math.max(camera.far, radius * 100);
    camera.updateProjectionMatrix();

    const controls = controlsRef.current;
    if (controls) {
      controls.target.copy(center);
      controls.update();
    } else {
      camera.lookAt(center);
    }

    didFitRef.current = true;
  }, [camera, controlsRef, geometry]);

  return null;
}

interface STLModelProps {
  geometry: THREE.BufferGeometry;
  wireframe?: boolean;
  color?: string;
}

function STLModel({ geometry, wireframe = false, color = '#60a5fa' }: STLModelProps) {
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={color}
        metalness={0.1}
        roughness={0.6}
        flatShading
        wireframe={wireframe}
      />
    </mesh>
  );
}

/** Colored axis lines at origin: X=red, Y=green, Z=blue */
function AxisLines() {
  const axisLength = 200;
  return (
    <group>
      {/* X axis - Red */}
      <Line
        points={[[-axisLength, 0, 0], [axisLength, 0, 0]]}
        color="#ef4444"
        lineWidth={1.5}
        transparent
        opacity={0.7}
      />
      {/* Y axis - Green */}
      <Line
        points={[[0, -axisLength, 0], [0, axisLength, 0]]}
        color="#22c55e"
        lineWidth={1.5}
        transparent
        opacity={0.7}
      />
      {/* Z axis - Blue */}
      <Line
        points={[[0, 0, -axisLength], [0, 0, axisLength]]}
        color="#3b82f6"
        lineWidth={1.5}
        transparent
        opacity={0.7}
      />
    </group>
  );
}

/** Captures the WebGL renderer reference for viewport screenshots */
function GlCapture({ glRef }: { glRef: React.MutableRefObject<THREE.WebGLRenderer | null> }) {
  const { gl } = useThree();

  useEffect(() => {
    glRef.current = gl;
    return () => {
      glRef.current = null;
    };
  }, [gl, glRef]);

  return null;
}
