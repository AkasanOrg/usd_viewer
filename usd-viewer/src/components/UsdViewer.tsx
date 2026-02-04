import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import type { VirtualFile, ParseError } from '../types/virtualFileSystem';
import {
  type ParsedPrim,
  interpolateValue,
  interpolateVector3,
  getTimeRange,
} from '../parsers/usdaParser';
import { parseAndResolve } from '../parsers/referenceResolver';

interface PrimMeshProps {
  prim: ParsedPrim;
  currentFrame: number;
  parentPosition?: [number, number, number];
  parentRotation?: [number, number, number];
  parentScale?: [number, number, number];
}

function PrimMesh({
  prim,
  currentFrame,
  parentPosition = [0, 0, 0],
  parentRotation = [0, 0, 0],
  parentScale = [1, 1, 1],
}: PrimMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Get position from timeSamples or static value
  const primPosition = prim.positionTimeSamples
    ? interpolateVector3(prim.positionTimeSamples, currentFrame)
    : prim.position ?? [0, 0, 0];

  const position: [number, number, number] = [
    parentPosition[0] + primPosition[0],
    parentPosition[1] + primPosition[1],
    parentPosition[2] + primPosition[2],
  ];

  // Get rotation from timeSamples or static value
  const primRotation = prim.rotationTimeSamples
    ? interpolateVector3(prim.rotationTimeSamples, currentFrame)
    : prim.rotation ?? [0, 0, 0];

  const rotation: [number, number, number] = [
    parentRotation[0] + primRotation[0],
    parentRotation[1] + primRotation[1],
    parentRotation[2] + primRotation[2],
  ];

  // Get scale from timeSamples or static value
  const primScale = prim.scaleTimeSamples
    ? interpolateVector3(prim.scaleTimeSamples, currentFrame)
    : prim.scale ?? [1, 1, 1];

  const scale: [number, number, number] = [
    parentScale[0] * primScale[0],
    parentScale[1] * primScale[1],
    parentScale[2] * primScale[2],
  ];

  // Get color from timeSamples or static value
  const color = prim.colorTimeSamples
    ? interpolateVector3(prim.colorTimeSamples, currentFrame)
    : prim.color ?? [0.6, 0.6, 0.6];

  // Get radius from timeSamples or static value
  const radius = prim.radiusTimeSamples
    ? interpolateValue(prim.radiusTimeSamples, currentFrame)
    : prim.radius;

  // Get size from timeSamples or static value
  const size = prim.sizeTimeSamples
    ? interpolateValue(prim.sizeTimeSamples, currentFrame)
    : prim.size;

  // Get height from timeSamples or static value
  const height = prim.heightTimeSamples
    ? interpolateValue(prim.heightTimeSamples, currentFrame)
    : prim.height;

  const geometry = useMemo(() => {
    switch (prim.type) {
      case 'Sphere':
        return <sphereGeometry args={[radius ?? 1, 32, 32]} />;
      case 'Cube':
        const s = size ?? 1;
        return <boxGeometry args={[s, s, s]} />;
      case 'Cylinder':
        return (
          <cylinderGeometry args={[radius ?? 0.5, radius ?? 0.5, height ?? 1, 32]} />
        );
      case 'Cone':
        return <coneGeometry args={[radius ?? 0.5, height ?? 1, 32]} />;
      default:
        return null;
    }
  }, [prim.type, radius, size, height]);

  // Combine regular children and resolved children from references
  const allChildren = [
    ...(prim.children || []),
    ...(prim.resolvedChildren || []),
  ];

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {geometry && (
        <mesh ref={meshRef}>
          {geometry}
          <meshStandardMaterial color={new THREE.Color(color[0], color[1], color[2])} />
        </mesh>
      )}
      {allChildren.map((child, index) => (
        <PrimMesh key={`${child.name}-${index}`} prim={child} currentFrame={currentFrame} />
      ))}
    </group>
  );
}

function AutoRotateCamera() {
  useFrame(({ clock, camera }) => {
    if (!camera.userData.userInteracted) {
      const t = clock.getElapsedTime() * 0.2;
      camera.position.x = Math.sin(t) * 5;
      camera.position.z = Math.cos(t) * 5;
      camera.lookAt(0, 0, 0);
    }
  });
  return null;
}

interface SceneProps {
  prims: ParsedPrim[];
  currentFrame: number;
}

function Scene({ prims, currentFrame }: SceneProps) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <directionalLight position={[-10, -10, -5]} intensity={0.3} />

      {prims.map((prim, index) => (
        <PrimMesh key={`${prim.name}-${index}`} prim={prim} currentFrame={currentFrame} />
      ))}

      <Grid
        args={[20, 20]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#444444"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#666666"
        fadeDistance={30}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={true}
      />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.05}
        onStart={(e) => {
          if (e?.target) {
            (e.target as { object?: { userData: { userInteracted: boolean } } }).object!.userData.userInteracted = true;
          }
        }}
      />
      <AutoRotateCamera />
    </>
  );
}

interface TimelineControlsProps {
  isPlaying: boolean;
  currentFrame: number;
  startFrame: number;
  endFrame: number;
  fps: number;
  onPlay: () => void;
  onStop: () => void;
  onReset: () => void;
  onFrameChange: (frame: number) => void;
}

function TimelineControls({
  isPlaying,
  currentFrame,
  startFrame,
  endFrame,
  fps,
  onPlay,
  onStop,
  onReset,
  onFrameChange,
}: TimelineControlsProps) {
  const hasAnimation = endFrame > startFrame;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'rgba(30, 30, 40, 0.9)',
        padding: '8px 16px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
      }}
    >
      <button
        onClick={onReset}
        disabled={!hasAnimation}
        style={{
          background: hasAnimation ? '#4a4a5a' : '#3a3a4a',
          border: 'none',
          color: hasAnimation ? '#fff' : '#666',
          padding: '8px 12px',
          borderRadius: '4px',
          cursor: hasAnimation ? 'pointer' : 'not-allowed',
          fontSize: '14px',
        }}
        title="Reset"
      >
        ⏮
      </button>
      <button
        onClick={isPlaying ? onStop : onPlay}
        disabled={!hasAnimation}
        style={{
          background: hasAnimation ? '#4a9eff' : '#3a3a4a',
          border: 'none',
          color: hasAnimation ? '#fff' : '#666',
          padding: '8px 16px',
          borderRadius: '4px',
          cursor: hasAnimation ? 'pointer' : 'not-allowed',
          fontSize: '14px',
          minWidth: '50px',
        }}
        title={isPlaying ? 'Stop' : 'Play'}
      >
        {isPlaying ? '⏹' : '▶'}
      </button>
      <input
        type="range"
        min={startFrame}
        max={endFrame || 1}
        value={currentFrame}
        onChange={(e) => onFrameChange(parseFloat(e.target.value))}
        disabled={!hasAnimation}
        style={{
          width: '150px',
          cursor: hasAnimation ? 'pointer' : 'not-allowed',
        }}
      />
      <span
        style={{
          color: '#aaa',
          fontSize: '12px',
          minWidth: '80px',
          textAlign: 'center',
        }}
      >
        {hasAnimation ? `${currentFrame.toFixed(1)} / ${endFrame}` : 'No animation'}
      </span>
      <span
        style={{
          color: '#666',
          fontSize: '11px',
        }}
      >
        {fps} fps
      </span>
    </div>
  );
}

interface AnimationPlayerProps {
  isPlaying: boolean;
  startFrame: number;
  endFrame: number;
  fps: number;
  onFrameUpdate: (frame: number) => void;
  recordingMode?: boolean;
  onLoopComplete?: () => void;
}

function AnimationPlayer({
  isPlaying,
  startFrame,
  endFrame,
  fps,
  onFrameUpdate,
  recordingMode = false,
  onLoopComplete,
}: AnimationPlayerProps) {
  const frameRef = useRef(startFrame);
  const hasCompletedLoopRef = useRef(false);

  useEffect(() => {
    if (isPlaying) {
      hasCompletedLoopRef.current = false;
    }
  }, [isPlaying]);

  useFrame((_, delta) => {
    if (isPlaying && endFrame > startFrame) {
      frameRef.current += delta * fps;
      if (frameRef.current > endFrame) {
        if (recordingMode && !hasCompletedLoopRef.current) {
          hasCompletedLoopRef.current = true;
          frameRef.current = endFrame;
          onFrameUpdate(frameRef.current);
          onLoopComplete?.();
          return;
        }
        frameRef.current = startFrame;
      }
      onFrameUpdate(frameRef.current);
    }
  });

  useEffect(() => {
    if (!isPlaying) {
      frameRef.current = startFrame;
    }
  }, [isPlaying, startFrame]);

  return null;
}

interface UsdViewerProps {
  usdaContent: string;
  currentFilePath: string;
  files: Map<string, VirtualFile>;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  isRecording?: boolean;
  onRecordingComplete?: () => void;
  onAnimationInfo?: (info: {
    hasAnimation: boolean;
    startFrame: number;
    endFrame: number;
    currentFrame: number;
  }) => void;
  onErrors?: (errors: ParseError[]) => void;
  onPrimsChange?: (prims: ParsedPrim[]) => void;
}

export function UsdViewer({
  usdaContent,
  currentFilePath,
  files,
  onCanvasReady,
  isRecording = false,
  onRecordingComplete,
  onAnimationInfo,
  onErrors,
  onPrimsChange,
}: UsdViewerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [fps] = useState(24);

  const { prims, errors } = useMemo(() => {
    try {
      return parseAndResolve(usdaContent, currentFilePath, files);
    } catch (error) {
      console.error('Failed to parse USDA:', error);
      return { prims: [], errors: [] };
    }
  }, [usdaContent, currentFilePath, files]);

  // Report errors to parent
  useEffect(() => {
    onErrors?.(errors);
  }, [errors, onErrors]);

  // Report prims to parent
  useEffect(() => {
    onPrimsChange?.(prims);
  }, [prims, onPrimsChange]);

  const { startFrame, endFrame } = useMemo(() => getTimeRange(prims), [prims]);
  const hasAnimation = endFrame > startFrame;

  useEffect(() => {
    onAnimationInfo?.({
      hasAnimation,
      startFrame,
      endFrame,
      currentFrame,
    });
  }, [hasAnimation, startFrame, endFrame, currentFrame, onAnimationInfo]);

  useEffect(() => {
    setCurrentFrame(startFrame);
    setIsPlaying(false);
  }, [startFrame, usdaContent]);

  useEffect(() => {
    if (isRecording) {
      setCurrentFrame(startFrame);
      setIsPlaying(true);
    }
  }, [isRecording, startFrame]);

  const handlePlay = () => setIsPlaying(true);
  const handleStop = () => setIsPlaying(false);
  const handleReset = () => {
    setIsPlaying(false);
    setCurrentFrame(startFrame);
  };
  const handleFrameChange = (frame: number) => {
    setIsPlaying(false);
    setCurrentFrame(frame);
  };

  const handleLoopComplete = () => {
    setIsPlaying(false);
    onRecordingComplete?.();
  };

  const handleCanvasCreated = (state: { gl: THREE.WebGLRenderer }) => {
    onCanvasReady?.(state.gl.domElement);
  };

  return (
    <div style={{ width: '100%', height: '100%', background: '#1a1a2e', position: 'relative' }}>
      <Canvas
        camera={{ position: [3, 3, 3], fov: 50 }}
        style={{ width: '100%', height: '100%' }}
        onCreated={handleCanvasCreated}
      >
        <Scene prims={prims} currentFrame={currentFrame} />
        <AnimationPlayer
          isPlaying={isPlaying}
          startFrame={startFrame}
          endFrame={endFrame}
          fps={fps}
          onFrameUpdate={setCurrentFrame}
          recordingMode={isRecording}
          onLoopComplete={handleLoopComplete}
        />
      </Canvas>
      <TimelineControls
        isPlaying={isPlaying}
        currentFrame={currentFrame}
        startFrame={startFrame}
        endFrame={endFrame}
        fps={fps}
        onPlay={handlePlay}
        onStop={handleStop}
        onReset={handleReset}
        onFrameChange={handleFrameChange}
      />
    </div>
  );
}

export default UsdViewer;
