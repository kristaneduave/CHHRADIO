import React, { useMemo } from 'react';
import { CurrentWorkstationStatus, Floor, WorkspacePlayer } from '../types';
import WorkstationNode from './WorkstationNode';

interface VirtualWorkspaceRendererProps {
    floor: Floor;
    workstations: CurrentWorkstationStatus[];
    currentUserId: string;
    players?: WorkspacePlayer[];
    onPinClick: (ws: CurrentWorkstationStatus) => void;
    onSetAreaPresence?: (floorId: string, x: number, y: number) => Promise<void>;
    occupiedWorkstation: CurrentWorkstationStatus | null;
    onCheckCurrentUserOccupancy: (workstationId: string) => Promise<boolean>;
    onRequestReleaseAndMove?: (intent: ReleaseAndMoveIntent) => void;
}

export interface ReleaseAndMoveIntent {
    workstationId: string;
    workstationLabel: string;
    targetFloorId: string;
    targetX: number;
    targetY: number;
}

const VirtualWorkspaceRenderer: React.FC<VirtualWorkspaceRendererProps> = ({
    workstations,
    currentUserId,
    onPinClick,
    occupiedWorkstation,
}) => {

    // Distribute workstations into quadrants
    const quadrants = useMemo(() => {
        const general: CurrentWorkstationStatus[] = [];
        const ct: CurrentWorkstationStatus[] = [];
        const mri: CurrentWorkstationStatus[] = [];
        const others: CurrentWorkstationStatus[] = [];

        workstations.forEach(ws => {
            const labelLower = ws.label.toLowerCase();
            if (labelLower.includes('ct') || labelLower.includes('cat')) {
                ct.push(ws);
            } else if (labelLower.includes('mr') || labelLower.includes('mri')) {
                mri.push(ws);
            } else if (labelLower.includes('gen') || labelLower.includes('dx') || labelLower.includes('x-ray') || labelLower.includes('ultrasound')) {
                general.push(ws);
            } else {
                others.push(ws);
            }
        });

        // If sorting failed (e.g., workstations don't have matching names), fallback: chunk them evenly
        if (general.length === 0 && ct.length === 0 && mri.length === 0 && others.length === 0 && workstations.length > 0) {
            const chunkSize = Math.ceil(workstations.length / 4);
            return {
                general: workstations.slice(0, chunkSize),
                ct: workstations.slice(chunkSize, chunkSize * 2),
                mri: workstations.slice(chunkSize * 2, chunkSize * 3),
                others: workstations.slice(chunkSize * 3),
            };
        }

        return { general, ct, mri, others };
    }, [workstations]);

    const renderQuadrant = (title: string, items: CurrentWorkstationStatus[], accentColor: string) => (
        <div className="flex flex-col h-full bg-[#0a1018] rounded-xl border border-white/5 overflow-hidden shadow-inner">
            <div className={`px-4 py-2 border-b border-white/5 bg-gradient-to-r from-white/[0.02] to-transparent`}>
                <h4 className={`text-xs font-bold uppercase tracking-wider ${accentColor} flex items-center justify-between`}>
                    {title}
                    <span className="text-white/40 text-[10px]">{items.length}</span>
                </h4>
            </div>
            <div className="flex-1 p-3 overflow-y-auto w-full">
                <div className="grid grid-cols-1 gap-2 h-max">
                    {items.map(ws => (
                        <WorkstationNode
                            key={ws.id}
                            workstation={ws}
                            currentUserId={currentUserId}
                            isSelected={occupiedWorkstation?.id === ws.id}
                            onClick={onPinClick}
                        />
                    ))}
                    {items.length === 0 && (
                        <div className="h-24 flex items-center justify-center text-xs text-slate-500 font-medium border border-dashed border-white/5 rounded-lg">
                            No workstations mapped
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="relative w-full h-full bg-[#030712] p-4 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full min-h-[500px]">
                {renderQuadrant("General Radiology", quadrants.general, "text-sky-400")}
                {renderQuadrant("CT", quadrants.ct, "text-emerald-400")}
                {renderQuadrant("MRI", quadrants.mri, "text-purple-400")}
                {renderQuadrant("Others", quadrants.others, "text-amber-400")}
            </div>
        </div>
    );
};

export default VirtualWorkspaceRenderer;
