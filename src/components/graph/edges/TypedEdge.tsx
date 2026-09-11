import React, { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
} from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import type { ArchitectureRelationship } from '../../../types/architecture';

export interface TypedEdgeData {
  relationship: ArchitectureRelationship;
  isHighlighted?: boolean;
  isDimmed?: boolean;
  color?: string;
}

export const TypedEdge: React.FC<EdgeProps> = memo(
  ({
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
    const [edgePath, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });

    const edgeData = data as unknown as TypedEdgeData | undefined;
    const rel = edgeData?.relationship;
    const isHighlighted = edgeData?.isHighlighted ?? false;
    const isDimmed = edgeData?.isDimmed ?? false;
    const color = edgeData?.color || '#2563eb';

    const typeBadgeBg =
      rel?.type === 'CALLS'
        ? 'bg-blue-50/95 text-blue-700 border-blue-300 shadow-2xs'
        : rel?.type === 'USES'
        ? 'bg-emerald-50/95 text-emerald-700 border-emerald-300 shadow-2xs'
        : rel?.type === 'DEPENDS_ON'
        ? 'bg-purple-50/95 text-purple-700 border-purple-300 shadow-2xs'
        : 'bg-amber-50/95 text-amber-700 border-amber-300 shadow-2xs';

    return (
      <>
        <BaseEdge
          id={id}
          path={edgePath}
          markerEnd={markerEnd}
          style={{
            ...style,
            stroke: color,
            strokeWidth: isHighlighted ? 3 : 1.75,
            opacity: isDimmed ? 0.38 : 1,
            transition: 'stroke-width 0.2s ease, opacity 0.2s ease',
          }}
        />
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              zIndex: isHighlighted ? 20 : 5,
            }}
            className={`transition-all duration-150 ${isDimmed ? 'opacity-40' : 'opacity-100'}`}
          >
            <div
              className={`px-2.5 py-0.5 rounded-full border font-mono text-[10px] font-bold tracking-wide flex items-center gap-1 cursor-default backdrop-blur-xs select-none ${typeBadgeBg} ${
                isHighlighted ? 'ring-2 ring-blue-500/40 shadow-sm scale-105 !opacity-100' : ''
              }`}
              title={rel?.description || `${rel?.source} ${rel?.type} ${rel?.target} (${rel?.protocol})`}
            >
              <span>{rel?.type || 'CALLS'}</span>
            </div>
          </div>
        </EdgeLabelRenderer>
      </>
    );
  }
);
