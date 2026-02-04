import * as THREE from 'three';
import type { UsdReference } from '../types/virtualFileSystem';

export type TimeSamples<T> = Map<number, T>;

export interface ParsedPrim {
  type: 'Sphere' | 'Cube' | 'Cylinder' | 'Cone' | 'Xform' | 'Reference';
  name: string;
  active?: boolean; // USD active flag - false means excluded from composition
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
  // Reference/Payload support
  references?: UsdReference[];
  payloads?: UsdReference[];
  // Resolved children from references
  resolvedChildren?: ParsedPrim[];
}

// Interpolation functions
export function interpolateValue(timeSamples: TimeSamples<number>, frame: number): number {
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

export function interpolateVector3(
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

export function getTimeRange(prims: ParsedPrim[]): { startFrame: number; endFrame: number } {
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
    prim.resolvedChildren?.forEach(collectTimes);
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

// Parse reference/payload from metadata
// Supports: references = @./path.usda@ or references = @./path.usda@</PrimPath>
function parseAssetReference(metadata: string): UsdReference | null {
  // Pattern: @path@</primPath> or just @path@
  const match = metadata.match(/@([^@]+)@(?:<([^>]+)>)?/);
  if (match) {
    return {
      assetPath: match[1],
      primPath: match[2] || undefined,
    };
  }
  return null;
}

// Parse def statement with metadata (references, payloads, active)
function parseDefStatement(line: string): {
  type: string;
  name: string;
  active?: boolean;
  references?: UsdReference[];
  payloads?: UsdReference[];
} | null {
  // Match various def patterns:
  // def Xform "Name" { }
  // def "Name" ( references = @./file.usda@ ) { }
  // def Xform "Name" ( references = @./file.usda@ ) { }
  // def Xform "Name" ( active = false ) { }
  const defMatch = line.match(/^def\s+(?:(\w+)\s+)?"([^"]+)"(?:\s*\(([^)]*)\))?/);
  if (!defMatch) return null;

  const [, primType, primName, metadata] = defMatch;
  const result: {
    type: string;
    name: string;
    active?: boolean;
    references?: UsdReference[];
    payloads?: UsdReference[];
  } = {
    type: primType || 'Xform',
    name: primName,
  };

  if (metadata) {
    // Parse active flag
    const activeMatch = metadata.match(/active\s*=\s*(true|false)/);
    if (activeMatch) {
      result.active = activeMatch[1] === 'true';
    }

    // Parse references
    const referencesMatch = metadata.match(/references\s*=\s*(@[^@]+@(?:<[^>]+>)?)/);
    if (referencesMatch) {
      const ref = parseAssetReference(referencesMatch[1]);
      if (ref) {
        result.references = [ref];
      }
    }

    // Parse payloads
    const payloadMatch = metadata.match(/payload\s*=\s*(@[^@]+@(?:<[^>]+>)?)/);
    if (payloadMatch) {
      const payload = parseAssetReference(payloadMatch[1]);
      if (payload) {
        result.payloads = [payload];
      }
    }
  }

  return result;
}

// Parse multiline metadata block starting from a given line index
function parseMultilineMetadata(
  lines: string[],
  startIndex: number
): { metadata: string; endIndex: number } {
  let metadata = '';
  let parenDepth = 0;
  let i = startIndex;

  while (i < lines.length) {
    const line = lines[i];
    for (const char of line) {
      if (char === '(') parenDepth++;
      else if (char === ')') parenDepth--;
    }
    metadata += line + '\n';
    if (parenDepth === 0) break;
    i++;
  }

  return { metadata, endIndex: i };
}

export function parseUsda(content: string): ParsedPrim[] {
  const prims: ParsedPrim[] = [];
  const stack: { prim: ParsedPrim; indent: number }[] = [];

  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    const indent = line.length - trimmed.length;

    // Check if this is a def statement with multiline metadata
    const defStartMatch = trimmed.match(/^def\s+(?:(\w+)\s+)?"([^"]+)"\s*\(/);
    if (defStartMatch && !trimmed.includes(')')) {
      // Multiline metadata - collect all lines until closing paren
      const { metadata, endIndex } = parseMultilineMetadata(lines, i);
      i = endIndex;

      const defInfo = parseDefStatement(metadata.replace(/\n/g, ' '));
      if (defInfo) {
        const newPrim: ParsedPrim = {
          type: defInfo.type as ParsedPrim['type'],
          name: defInfo.name,
          active: defInfo.active,
          children: [],
          references: defInfo.references,
          payloads: defInfo.payloads,
        };

        while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
          stack.pop();
        }

        if (stack.length > 0) {
          stack[stack.length - 1].prim.children?.push(newPrim);
        } else {
          prims.push(newPrim);
        }

        stack.push({ prim: newPrim, indent });
      }
      continue;
    }

    // Match def statements with optional metadata (single line)
    const defInfo = parseDefStatement(trimmed);
    if (defInfo) {
      const newPrim: ParsedPrim = {
        type: defInfo.type as ParsedPrim['type'],
        name: defInfo.name,
        active: defInfo.active,
        children: [],
        references: defInfo.references,
        payloads: defInfo.payloads,
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
