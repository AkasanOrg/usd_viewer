import type { VirtualFile, ParseError } from '../types/virtualFileSystem';
import { parseUsda, type ParsedPrim } from './usdaParser';
import { resolveRelativePath } from '../hooks/useVirtualFileSystem';

export interface ParseContext {
  currentFilePath: string;
  files: Map<string, VirtualFile>;
  visitedPaths: Set<string>;
  errors: ParseError[];
}

// Find a prim by its path (e.g., "/World/Cube")
function findPrimByPath(prims: ParsedPrim[], path: string): ParsedPrim | null {
  const segments = path.split('/').filter(Boolean);
  let current: ParsedPrim[] = prims;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const found = current.find((p) => p.name === segment);
    if (!found) return null;
    if (i === segments.length - 1) return found;
    current = found.children || [];
  }

  return null;
}

// Deep clone a prim (without circular references)
function clonePrim(prim: ParsedPrim): ParsedPrim {
  return {
    ...prim,
    active: prim.active,
    children: prim.children?.map(clonePrim),
    resolvedChildren: prim.resolvedChildren?.map(clonePrim),
  };
}

// Filter out inactive prims from the tree
function filterActivePrims(prims: ParsedPrim[]): ParsedPrim[] {
  return prims
    .filter((prim) => prim.active !== false) // Keep prims where active is undefined or true
    .map((prim) => ({
      ...prim,
      children: prim.children ? filterActivePrims(prim.children) : undefined,
      resolvedChildren: prim.resolvedChildren ? filterActivePrims(prim.resolvedChildren) : undefined,
    }));
}

// Resolve references and payloads for a single prim
function resolveReferencesForPrim(
  prim: ParsedPrim,
  context: ParseContext
): ParsedPrim {
  const resolved = { ...prim };

  // Process references
  if (prim.references?.length) {
    resolved.resolvedChildren = resolved.resolvedChildren || [];

    for (const ref of prim.references) {
      const absolutePath = resolveRelativePath(context.currentFilePath, ref.assetPath);

      // Circular reference detection
      if (context.visitedPaths.has(absolutePath)) {
        context.errors.push({
          type: 'circular_reference',
          message: `Circular reference detected: ${context.currentFilePath} -> ${absolutePath}`,
          filePath: context.currentFilePath,
        });
        continue;
      }

      // File existence check
      const referencedFile = context.files.get(absolutePath);
      if (!referencedFile) {
        context.errors.push({
          type: 'missing_file',
          message: `Referenced file not found: ${ref.assetPath} (resolved to ${absolutePath})`,
          filePath: context.currentFilePath,
        });
        continue;
      }

      // Skip inactive files
      if (!referencedFile.active) {
        continue;
      }

      // Parse the referenced file
      try {
        const parsedPrims = parseUsda(referencedFile.content);

        // Create new context for recursive resolution
        const newContext: ParseContext = {
          ...context,
          currentFilePath: absolutePath,
          visitedPaths: new Set([...context.visitedPaths, absolutePath]),
        };

        // Resolve references in the referenced file
        const resolvedPrims = resolveAllReferences(parsedPrims, newContext);

        // If a specific prim path is specified, find it
        if (ref.primPath) {
          const targetPrim = findPrimByPath(resolvedPrims, ref.primPath);
          if (targetPrim) {
            resolved.resolvedChildren.push(clonePrim(targetPrim));
          } else {
            context.errors.push({
              type: 'invalid_prim_path',
              message: `Prim path not found: ${ref.primPath} in ${ref.assetPath}`,
              filePath: context.currentFilePath,
            });
          }
        } else {
          // Add all root prims from referenced file
          resolved.resolvedChildren.push(...resolvedPrims.map(clonePrim));
        }
      } catch (error) {
        context.errors.push({
          type: 'parse_error',
          message: `Failed to parse referenced file: ${ref.assetPath} - ${error}`,
          filePath: context.currentFilePath,
        });
      }
    }
  }

  // Process payloads (same as references for now)
  if (prim.payloads?.length) {
    resolved.resolvedChildren = resolved.resolvedChildren || [];

    for (const payload of prim.payloads) {
      const absolutePath = resolveRelativePath(context.currentFilePath, payload.assetPath);

      // Circular reference detection
      if (context.visitedPaths.has(absolutePath)) {
        context.errors.push({
          type: 'circular_reference',
          message: `Circular payload detected: ${context.currentFilePath} -> ${absolutePath}`,
          filePath: context.currentFilePath,
        });
        continue;
      }

      // File existence check
      const payloadFile = context.files.get(absolutePath);
      if (!payloadFile) {
        context.errors.push({
          type: 'missing_file',
          message: `Payload file not found: ${payload.assetPath} (resolved to ${absolutePath})`,
          filePath: context.currentFilePath,
        });
        continue;
      }

      // Skip inactive files
      if (!payloadFile.active) {
        continue;
      }

      // Parse the payload file
      try {
        const parsedPrims = parseUsda(payloadFile.content);

        // Create new context for recursive resolution
        const newContext: ParseContext = {
          ...context,
          currentFilePath: absolutePath,
          visitedPaths: new Set([...context.visitedPaths, absolutePath]),
        };

        // Resolve references in the payload file
        const resolvedPrims = resolveAllReferences(parsedPrims, newContext);

        // If a specific prim path is specified, find it
        if (payload.primPath) {
          const targetPrim = findPrimByPath(resolvedPrims, payload.primPath);
          if (targetPrim) {
            resolved.resolvedChildren.push(clonePrim(targetPrim));
          } else {
            context.errors.push({
              type: 'invalid_prim_path',
              message: `Prim path not found: ${payload.primPath} in ${payload.assetPath}`,
              filePath: context.currentFilePath,
            });
          }
        } else {
          // Add all root prims from payload file
          resolved.resolvedChildren.push(...resolvedPrims.map(clonePrim));
        }
      } catch (error) {
        context.errors.push({
          type: 'parse_error',
          message: `Failed to parse payload file: ${payload.assetPath} - ${error}`,
          filePath: context.currentFilePath,
        });
      }
    }
  }

  // Recursively resolve children
  if (prim.children) {
    resolved.children = prim.children.map((child) =>
      resolveReferencesForPrim(child, context)
    );
  }

  return resolved;
}

// Resolve all references in a list of prims
export function resolveAllReferences(
  prims: ParsedPrim[],
  context: ParseContext
): ParsedPrim[] {
  return prims.map((prim) => resolveReferencesForPrim(prim, context));
}

// Main function to parse and resolve a USDA file with references
export function parseAndResolve(
  content: string,
  currentFilePath: string,
  files: Map<string, VirtualFile>
): { prims: ParsedPrim[]; errors: ParseError[] } {
  const errors: ParseError[] = [];

  try {
    const parsedPrims = parseUsda(content);

    const context: ParseContext = {
      currentFilePath,
      files,
      visitedPaths: new Set([currentFilePath]),
      errors,
    };

    const resolvedPrims = resolveAllReferences(parsedPrims, context);

    // Filter out inactive prims from composition
    const activePrims = filterActivePrims(resolvedPrims);

    return { prims: activePrims, errors };
  } catch (error) {
    errors.push({
      type: 'parse_error',
      message: `Failed to parse USDA: ${error}`,
      filePath: currentFilePath,
    });
    return { prims: [], errors };
  }
}
