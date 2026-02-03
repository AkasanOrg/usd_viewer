import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';

type TimeSamples<T> = Map<number, T>;

interface ParsedPrim {
  type: 'Sphere' | 'Cube' | 'Cylinder' | 'Cone' | 'Xform';
  name: string;
  radius?: number;
  radiusTimeSamples?: TimeSamples<number>;
  size?: number;
  sizeTimeSamples?: TimeSamples<number>;
  height?: number;
  heightTimeSamples?: TimeSamples<number>;
  color?: [number, number, number];
  colorTimeSamples?: TimeSamples<[number, number, number]>;
  position?: [number, number, number];
  positionTimeSamples?: TimeSamples<[number, number, number]>;
  rotation?: [number, number, number];
  rotationTimeSamples?: TimeSamples<[number, number, number]>;
  scale?: [number, number, number];
  scaleTimeSamples?: TimeSamples<[number, number, number]>;
  children?: ParsedPrim[];
}

function interpolateValue(timeSamples: TimeSamples<number>, frame: number): number {
  const times = Array.from(timeSamples.keys()).sort((a, b) => a - b);
  if (times.length === 0) return 0;
  if (frame <= times[0]) return timeSamples.get(times[0])!;
  if (frame >= times[times.length - 1]) return timeSamples.get(times[times.length - 1])!;

  for (let i = 0; i < times.length - 1; i++) {
    if (frame >= times[i] && frame <= times[i + 1]) {
      const t = (frame - times[i]) / (times[i + 1] - times[i]);
      const v0 = timeSamples.get(times[i])!;
      const v1 = timeSamples.get(times[i + 1])!;
      return v0 + (v1 - v0) * t;
    }
  }
  return timeSamples.get(times[0])!;
}

function interpolateVector3(
  timeSamples: TimeSamples<[number, number, number]>,
  frame: number
): [number, number, number] {
  const times = Array.from(timeSamples.keys()).sort((a, b) => a - b);
  if (times.length === 0) return [0, 0, 0];
  if (frame <= times[0]) return timeSamples.get(times[0])!;
  if (frame >= times[times.length - 1]) return timeSamples.get(times[times.length - 1])!;

  for (let i = 0; i < times.length - 1; i++) {
    if (frame >= times[i] && frame <= times[i + 1]) {
      const t = (frame - times[i]) / (times[i + 1] - times[i]);
      const v0 = timeSamples.get(times[i])!;
      const v1 = timeSamples.get(times[i + 1])!;
      return [
        v0[0] + (v1[0] - v0[0]) * t,
        v0[1] + (v1[1] - v0[1]) * t,
        v0[2] + (v1[2] - v0[2]) * t,
      ];
    }
  }
  return timeSamples.get(times[0])!;
}

function getTimeRange(prims: ParsedPrim[]): { startFrame: number; endFrame: number } {
  let minFrame = Infinity;
  let maxFrame = -Infinity;

  function collectTimes(prim: ParsedPrim) {
    const allTimeSamples = [
      prim.radiusTimeSamples,
      prim.sizeTimeSamples,
      prim.heightTimeSamples,
      prim.colorTimeSamples,
      prim.positionTimeSamples,
      prim.rotationTimeSamples,
      prim.scaleTimeSamples,
    ];

    for (const ts of allTimeSamples) {
      if (ts) {
        for (const time of ts.keys()) {
          minFrame = Math.min(minFrame, time);
          maxFrame = Math.max(maxFrame, time);
        }
      }
    }

    prim.children?.forEach(collectTimes);
  }

  prims.forEach(collectTimes);

  if (minFrame === Infinity) {
    return { startFrame: 0, endFrame: 0 };
  }
  return { startFrame: minFrame, endFrame: maxFrame };
}

function parseTimeSamplesScalar(content: string, startIndex: number): { samples: TimeSamples<number>; endIndex: number } {
  const samples = new Map<number, number>();
  let i = startIndex;
  const lines = content.split('\n');

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === '}') break;

    const sampleMatch = line.match(/^([\d.-]+)\s*:\s*([\d.-]+),?$/);
    if (sampleMatch) {
      const time = parseFloat(sampleMatch[1]);
      const value = parseFloat(sampleMatch[2]);
      samples.set(time, value);
    }
    i++;
  }

  return { samples, endIndex: i };
}

function parseTimeSamplesVector3(
  content: string,
  startIndex: number,
  convertToRadians = false
): { samples: TimeSamples<[number, number, number]>; endIndex: number } {
  const samples = new Map<number, [number, number, number]>();
  let i = startIndex;
  const lines = content.split('\n');

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === '}') break;

    const sampleMatch = line.match(/^([\d.-]+)\s*:\s*\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\),?$/);
    if (sampleMatch) {
      const time = parseFloat(sampleMatch[1]);
      let values: [number, number, number] = [
        parseFloat(sampleMatch[2]),
        parseFloat(sampleMatch[3]),
        parseFloat(sampleMatch[4]),
      ];
      if (convertToRadians) {
        values = [
          THREE.MathUtils.degToRad(values[0]),
          THREE.MathUtils.degToRad(values[1]),
          THREE.MathUtils.degToRad(values[2]),
        ];
      }
      samples.set(time, values);
    }
    i++;
  }

  return { samples, endIndex: i };
}

function parseUsda(content: string): ParsedPrim[] {
  const prims: ParsedPrim[] = [];
  const stack: { prim: ParsedPrim; indent: number }[] = [];

  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    const indent = line.length - trimmed.length;

    // Match def statements
    const defMatch = trimmed.match(/^def\s+(\w+)\s+"([^"]+)"/);
    if (defMatch) {
      const [, primType, primName] = defMatch;
      const newPrim: ParsedPrim = {
        type: primType as ParsedPrim['type'],
        name: primName,
        children: [],
      };

      // Pop stack to find parent
      while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }

      if (stack.length > 0) {
        stack[stack.length - 1].prim.children?.push(newPrim);
      } else {
        prims.push(newPrim);
      }

      stack.push({ prim: newPrim, indent });
      continue;
    }

    // Parse attributes for current prim
    if (stack.length > 0) {
      const currentPrim = stack[stack.length - 1].prim;

      // Radius with timeSamples
      const radiusTimeSamplesMatch = trimmed.match(/(?:double|float)\s+radius\.timeSamples\s*=\s*\{/);
      if (radiusTimeSamplesMatch) {
        const { samples, endIndex } = parseTimeSamplesScalar(content, i + 1);
        currentPrim.radiusTimeSamples = samples;
        i = endIndex;
        continue;
      }

      // Radius
      const radiusMatch = trimmed.match(/(?:double|float)\s+radius\s*=\s*([\d.]+)/);
      if (radiusMatch) {
        currentPrim.radius = parseFloat(radiusMatch[1]);
      }

      // Size with timeSamples
      const sizeTimeSamplesMatch = trimmed.match(/(?:double|float)\s+size\.timeSamples\s*=\s*\{/);
      if (sizeTimeSamplesMatch) {
        const { samples, endIndex } = parseTimeSamplesScalar(content, i + 1);
        currentPrim.sizeTimeSamples = samples;
        i = endIndex;
        continue;
      }

      // Size
      const sizeMatch = trimmed.match(/(?:double|float)\s+size\s*=\s*([\d.]+)/);
      if (sizeMatch) {
        currentPrim.size = parseFloat(sizeMatch[1]);
      }

      // Height with timeSamples
      const heightTimeSamplesMatch = trimmed.match(/(?:double|float)\s+height\.timeSamples\s*=\s*\{/);
      if (heightTimeSamplesMatch) {
        const { samples, endIndex } = parseTimeSamplesScalar(content, i + 1);
        currentPrim.heightTimeSamples = samples;
        i = endIndex;
        continue;
      }

      // Height
      const heightMatch = trimmed.match(/(?:double|float)\s+height\s*=\s*([\d.]+)/);
      if (heightMatch) {
        currentPrim.height = parseFloat(heightMatch[1]);
      }

      // Color
      const colorMatch = trimmed.match(/color3f\[\]\s+primvars:displayColor\s*=\s*\[\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)\s*\]/);
      if (colorMatch) {
        currentPrim.color = [
          parseFloat(colorMatch[1]),
          parseFloat(colorMatch[2]),
          parseFloat(colorMatch[3]),
        ];
      }

      // Translation with timeSamples
      const translateTimeSamplesMatch = trimmed.match(/double3\s+xformOp:translate\.timeSamples\s*=\s*\{/);
      if (translateTimeSamplesMatch) {
        const { samples, endIndex } = parseTimeSamplesVector3(content, i + 1);
        currentPrim.positionTimeSamples = samples;
        i = endIndex;
        continue;
      }

      // Translation/Position
      const translateMatch = trimmed.match(/double3\s+xformOp:translate\s*=\s*\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)/);
      if (translateMatch) {
        currentPrim.position = [
          parseFloat(translateMatch[1]),
          parseFloat(translateMatch[2]),
          parseFloat(translateMatch[3]),
        ];
      }

      // Rotation with timeSamples
      const rotateTimeSamplesMatch = trimmed.match(/float3\s+xformOp:rotateXYZ\.timeSamples\s*=\s*\{/);
      if (rotateTimeSamplesMatch) {
        const { samples, endIndex } = parseTimeSamplesVector3(content, i + 1, true);
        currentPrim.rotationTimeSamples = samples;
        i = endIndex;
        continue;
      }

      // Rotation
      const rotateMatch = trimmed.match(/float3\s+xformOp:rotateXYZ\s*=\s*\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)/);
      if (rotateMatch) {
        currentPrim.rotation = [
          THREE.MathUtils.degToRad(parseFloat(rotateMatch[1])),
          THREE.MathUtils.degToRad(parseFloat(rotateMatch[2])),
          THREE.MathUtils.degToRad(parseFloat(rotateMatch[3])),
        ];
      }

      // Scale with timeSamples
      const scaleTimeSamplesMatch = trimmed.match(/float3\s+xformOp:scale\.timeSamples\s*=\s*\{/);
      if (scaleTimeSamplesMatch) {
        const { samples, endIndex } = parseTimeSamplesVector3(content, i + 1);
        currentPrim.scaleTimeSamples = samples;
        i = endIndex;
        continue;
      }

      // Scale
      const scaleMatch = trimmed.match(/float3\s+xformOp:scale\s*=\s*\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)/);
      if (scaleMatch) {
        currentPrim.scale = [
          parseFloat(scaleMatch[1]),
          parseFloat(scaleMatch[2]),
          parseFloat(scaleMatch[3]),
        ];
      }
    }
  }

  return prims;
}

interface PrimMeshProps {
  prim: ParsedPrim;
  currentFrame: number;
  parentPosition?: [number, number, number];
  parentRotation?: [number, number, number];
  parentScale?: [number, number, number];
}

function PrimMesh({ prim, currentFrame, parentPosition = [0, 0, 0], parentRotation = [0, 0, 0], parentScale = [1, 1, 1] }: PrimMeshProps) {
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
        return <cylinderGeometry args={[radius ?? 0.5, radius ?? 0.5, height ?? 1, 32]} />;
      case 'Cone':
        return <coneGeometry args={[radius ?? 0.5, height ?? 1, 32]} />;
      default:
        return null;
    }
  }, [prim.type, radius, size, height]);

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {geometry && (
        <mesh ref={meshRef}>
          {geometry}
          <meshStandardMaterial color={new THREE.Color(color[0], color[1], color[2])} />
        </mesh>
      )}
      {prim.children?.map((child, index) => (
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
        {hasAnimation
          ? `${currentFrame.toFixed(1)} / ${endFrame}`
          : 'No animation'}
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
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  isRecording?: boolean;
  onRecordingComplete?: () => void;
  onAnimationInfo?: (info: { hasAnimation: boolean; startFrame: number; endFrame: number; currentFrame: number }) => void;
}

export function UsdViewer({
  usdaContent,
  onCanvasReady,
  isRecording = false,
  onRecordingComplete,
  onAnimationInfo,
}: UsdViewerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [fps] = useState(24);

  const prims = useMemo(() => {
    try {
      return parseUsda(usdaContent);
    } catch (error) {
      console.error('Failed to parse USDA:', error);
      return [];
    }
  }, [usdaContent]);

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
