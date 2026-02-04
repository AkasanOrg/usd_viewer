import { useState } from 'react';
import type { ParsedPrim } from '../../parsers/usdaParser';
import './StageHierarchy.css';

interface PrimItemProps {
  prim: ParsedPrim;
  depth: number;
  selectedPrim: string | null;
  onSelect: (path: string) => void;
  parentPath: string;
}

function getPrimIcon(type: ParsedPrim['type']): { icon: string; className: string } {
  switch (type) {
    case 'Xform':
      return { icon: '⊕', className: 'xform' };
    case 'Sphere':
      return { icon: '●', className: 'sphere' };
    case 'Cube':
      return { icon: '■', className: 'cube' };
    case 'Cylinder':
      return { icon: '⬭', className: 'cylinder' };
    case 'Cone':
      return { icon: '▲', className: 'cone' };
    case 'Reference':
      return { icon: '↗', className: 'reference' };
    default:
      return { icon: '○', className: '' };
  }
}

// Component to show unresolved reference info
function UnresolvedRefItem({
  assetPath,
  primPath,
  type,
  depth,
}: {
  assetPath: string;
  primPath?: string;
  type: 'ref' | 'payload';
  depth: number;
}) {
  return (
    <div
      className="prim-item unresolved"
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <span className="prim-expand" />
      <span className={`prim-icon ${type === 'ref' ? 'reference' : 'reference'}`}>
        {type === 'ref' ? '↗' : '↓'}
      </span>
      <span className="prim-info">
        <span className="prim-name unresolved-name">{assetPath}</span>
        <span className="prim-type">
          {primPath ? `${type} → ${primPath}` : type}
        </span>
      </span>
      <span className="prim-badge unresolved">unresolved</span>
    </div>
  );
}

function PrimItem({
  prim,
  depth,
  selectedPrim,
  onSelect,
  parentPath,
}: PrimItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const primPath = `${parentPath}/${prim.name}`;
  const allChildren = [
    ...(prim.children || []),
    ...(prim.resolvedChildren || []),
  ];
  const hasReferences = (prim.references?.length ?? 0) > 0;
  const hasPayloads = (prim.payloads?.length ?? 0) > 0;

  // Check if references are unresolved (has references but no resolvedChildren from them)
  const unresolvedRefs = prim.references?.filter(() => {
    // If there are references but no resolvedChildren, they're unresolved
    return (prim.resolvedChildren?.length ?? 0) === 0;
  }) ?? [];

  const unresolvedPayloads = prim.payloads?.filter(() => {
    return (prim.resolvedChildren?.length ?? 0) === 0;
  }) ?? [];

  const hasChildren = allChildren.length > 0 || unresolvedRefs.length > 0 || unresolvedPayloads.length > 0;

  const { icon, className } = getPrimIcon(prim.type);

  const handleClick = () => {
    onSelect(primPath);
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="prim-item-container">
      <div
        className={`prim-item ${primPath === selectedPrim ? 'selected' : ''}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
      >
        <span
          className={`prim-expand ${hasChildren ? 'expandable' : ''}`}
          onClick={hasChildren ? handleExpandClick : undefined}
        >
          {hasChildren ? (isExpanded ? '▼' : '▶') : ''}
        </span>
        <span className={`prim-icon ${className}`}>{icon}</span>
        <span className="prim-info">
          <span className="prim-name">{prim.name}</span>
          <span className="prim-type">{prim.type}</span>
        </span>
        {hasReferences && <span className="prim-badge ref">ref</span>}
        {hasPayloads && <span className="prim-badge payload">payload</span>}
      </div>
      {hasChildren && isExpanded && (
        <div className="prim-children">
          {/* Show unresolved references */}
          {unresolvedRefs.map((ref, index) => (
            <UnresolvedRefItem
              key={`unresolved-ref-${index}`}
              assetPath={ref.assetPath}
              primPath={ref.primPath}
              type="ref"
              depth={depth + 1}
            />
          ))}
          {/* Show unresolved payloads */}
          {unresolvedPayloads.map((payload, index) => (
            <UnresolvedRefItem
              key={`unresolved-payload-${index}`}
              assetPath={payload.assetPath}
              primPath={payload.primPath}
              type="payload"
              depth={depth + 1}
            />
          ))}
          {/* Show resolved children */}
          {allChildren.map((child, index) => (
            <PrimItem
              key={`${child.name}-${index}`}
              prim={child}
              depth={depth + 1}
              selectedPrim={selectedPrim}
              onSelect={onSelect}
              parentPath={primPath}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface StageHierarchyProps {
  prims: ParsedPrim[];
  selectedPrim?: string | null;
  onPrimSelect?: (path: string) => void;
}

export function StageHierarchy({
  prims,
  selectedPrim = null,
  onPrimSelect,
}: StageHierarchyProps) {
  const handleSelect = (path: string) => {
    onPrimSelect?.(path);
  };

  return (
    <div className="stage-hierarchy">
      <div className="stage-hierarchy-header">
        <span className="stage-hierarchy-title">STAGE HIERARCHY</span>
      </div>
      <div className="stage-hierarchy-content">
        {prims.length === 0 ? (
          <div className="stage-hierarchy-empty">No prims</div>
        ) : (
          prims.map((prim, index) => (
            <PrimItem
              key={`${prim.name}-${index}`}
              prim={prim}
              depth={0}
              selectedPrim={selectedPrim}
              onSelect={handleSelect}
              parentPath=""
            />
          ))
        )}
      </div>
    </div>
  );
}
