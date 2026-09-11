import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import type { ArchitectureRelationship, RiskLevel } from '../../../types/analysis';

export interface TypedRiskEdgeData {
  relationship: ArchitectureRelationship;
  riskLevel: RiskLevel;
  isHighlighted: boolean;
  isDimmed: boolean;
  color: string;
}

export const TypedRiskEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}) => {
  const edgeData = data as unknown as TypedRiskEdgeData | undefined;
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const rel = edgeData?.relationship;
  const riskLevel = edgeData?.riskLevel || 'LOW';
  const isHighlighted = edgeData?.isHighlighted ?? false;
  const isDimmed = edgeData?.isDimmed ?? false;

  const isCritical = riskLevel === 'CRITICAL';
  const isHigh = riskLevel === 'HIGH';
  const isRiskElevated = isCritical || isHigh;

  // Refined edge stroke color for Light Mode
  let strokeColor = '#94a3b8'; // crisp slate-400 base
  if (isHighlighted) {
    strokeColor = '#7c3aed'; // bold violet-600
  } else if (isCritical) {
    strokeColor = '#e11d48'; // rose-600
  } else if (isHigh) {
    strokeColor = '#ea580c'; // amber-600
  } else if (rel?.type === 'USES') {
    strokeColor = '#059669'; // emerald-600
  }

  const strokeWidth = isHighlighted ? 2.5 : isRiskElevated ? 2 : 1.5;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        className={isRiskElevated && !isDimmed ? 'animated-risk-edge' : ''}
        style={{
          ...style,
          stroke: strokeColor,
          strokeWidth,
          opacity: isDimmed ? 0.35 : isHighlighted ? 1 : 0.85,
          transition: 'stroke 0.2s, stroke-width 0.2s, opacity 0.2s',
        }}
      />

      <EdgeLabelRenderer>
        <div
          onClick={(e) => {
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent('traceiq-edge-select', { detail: { edgeId: id } }));
          }}
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-mono shadow-xs backdrop-blur-xs transition-all duration-200 cursor-pointer select-none ${
            isDimmed ? 'opacity-35 scale-90' : 'opacity-100 scale-100'
          } ${
            isHighlighted
              ? 'bg-violet-50 text-violet-700 border-violet-300 ring-2 ring-violet-200 font-semibold shadow-xs'
              : isCritical
              ? 'bg-rose-50 text-rose-700 border-rose-300 ring-2 ring-rose-100 font-semibold shadow-xs'
              : isHigh
              ? 'bg-amber-50 text-amber-700 border-amber-300 ring-2 ring-amber-100 font-semibold shadow-xs'
              : 'bg-white text-slate-600 border-slate-200 shadow-2xs hover:border-violet-300'
          }`}
          title={`Click to inspect dependency: ${rel?.source || ''} → ${rel?.target || ''}`}
        >
          <span className="font-semibold tracking-tight">{rel?.type || 'CALLS'}</span>
          {isRiskElevated && (
            <span className={`w-1.5 h-1.5 rounded-full ${isCritical ? 'bg-rose-500 animate-ping' : 'bg-amber-500'}`} />
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};
