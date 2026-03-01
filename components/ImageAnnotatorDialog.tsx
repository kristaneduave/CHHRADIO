import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fabric } from 'fabric';
import { toastError } from '../utils/toast';

interface ImageAnnotatorDialogProps {
    imageSrc: string;
    onSave: (annotatedImageBase64: string) => void;
    onCancel: () => void;
}

export const ImageAnnotatorDialog: React.FC<ImageAnnotatorDialogProps> = ({
    imageSrc,
    onSave,
    onCancel,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fabricRef = useRef<fabric.Canvas | null>(null);

    const [activeTool, setActiveTool] = useState<'select' | 'freedraw' | 'arrow' | 'rect' | 'circle' | 'text'>('freedraw');
    const activeToolRef = useRef(activeTool);
    useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);

    const [activeColor, setActiveColor] = useState('#ef4444'); // Default Red
    const activeColorRef = useRef(activeColor);
    useEffect(() => { activeColorRef.current = activeColor; }, [activeColor]);

    const [strokeWidth, setStrokeWidth] = useState(3);
    const strokeWidthRef = useRef(strokeWidth);
    useEffect(() => { strokeWidthRef.current = strokeWidth; }, [strokeWidth]);

    const [fillOpacity, setFillOpacity] = useState(0); // 0 = transparent, 100 = solid
    const fillOpacityRef = useRef(fillOpacity);
    useEffect(() => { fillOpacityRef.current = fillOpacity; }, [fillOpacity]);

    const [globalOpacity, setGlobalOpacity] = useState(100);
    const globalOpacityRef = useRef(globalOpacity);
    useEffect(() => { globalOpacityRef.current = globalOpacity; }, [globalOpacity]);

    const [fontSize, setFontSize] = useState(24);
    const fontSizeRef = useRef(fontSize);
    useEffect(() => { fontSizeRef.current = fontSize; }, [fontSize]);

    const colors = [
        { label: 'Red', value: '#ef4444' },     // bg-red-500
        { label: 'Yellow', value: '#eab308' },  // bg-yellow-500
        { label: 'Cyan', value: '#06b6d4' },    // bg-cyan-500
        { label: 'Green', value: '#22c55e' },   // bg-green-500
        { label: 'White', value: '#ffffff' },
        { label: 'Black', value: '#000000' },
    ];

    useEffect(() => {
        if (!canvasRef.current || !containerRef.current) return;

        // Initialize Fabric
        const canvas = new fabric.Canvas(canvasRef.current, {
            isDrawingMode: true,
            selection: true,
        });
        fabricRef.current = canvas;

        // Configure free drawing brush
        canvas.freeDrawingBrush.color = activeColor;
        canvas.freeDrawingBrush.width = strokeWidth;

        // Load background image and fit to screen
        fabric.Image.fromURL(imageSrc, (img) => {
            if (!img || !containerRef.current) {
                toastError('Failed to load image for annotation');
                return;
            }

            const containerWidth = containerRef.current.clientWidth - 32; // padding
            const containerHeight = containerRef.current.clientHeight - 180; // space for toolbars

            const scale = Math.min(
                containerWidth / (img.width || 1),
                containerHeight / (img.height || 1),
                1 // don't scale up
            );

            const finalWidth = (img.width || 0) * scale;
            const finalHeight = (img.height || 0) * scale;

            canvas.setWidth(finalWidth);
            canvas.setHeight(finalHeight);

            img.set({
                scaleX: scale,
                scaleY: scale,
                originX: 'left',
                originY: 'top',
            });

            canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
        });

        // Handle interactive shape drawing (Arrow, Rect, Circle)
        let isDrawing = false;
        let shapeRef: fabric.Object | null = null;
        let lineRef: fabric.Line | null = null;
        let startPoint: { x: number; y: number } | null = null;

        canvas.on('mouse:down', (o) => {
            const currentTool = activeToolRef.current;

            // If user clicks an existing object while holding a shape tool, switch to select mode
            if (o.target && ['rect', 'circle', 'arrow'].includes(currentTool)) {
                setActiveTool('select');
                return;
            }

            const pointer = canvas.getPointer(o.e);
            isDrawing = true;
            startPoint = { x: pointer.x, y: pointer.y };

            const currentColor = activeColorRef.current;
            const currentStroke = strokeWidthRef.current;
            const currentOpacity = fillOpacityRef.current;
            const currentGlobalOpacity = globalOpacityRef.current;
            const currentFontSize = fontSizeRef.current;

            if (currentTool === 'text') {
                const text = new fabric.IText('Tap to edit', {
                    left: pointer.x,
                    top: pointer.y,
                    fontFamily: 'Nunito',
                    fill: currentColor,
                    fontSize: currentFontSize,
                    opacity: currentGlobalOpacity / 100,
                });
                canvas.add(text);
                canvas.setActiveObject(text);
                text.enterEditing();
                text.selectAll();
                setActiveTool('select'); // Auto-switch to select to edit text
                return;
            }

            if (currentTool === 'select' || currentTool === 'freedraw') return;

            const strokeStyle = {
                stroke: currentColor,
                strokeWidth: currentStroke,
                fill: currentOpacity > 0 ? currentColor : 'transparent',
                opacity: currentGlobalOpacity / 100,
                selectable: true,
            };

            if (currentTool === 'rect') {
                shapeRef = new fabric.Rect({
                    left: startPoint.x,
                    top: startPoint.y,
                    width: 0,
                    height: 0,
                    ...strokeStyle,
                    // Fabric handles stroke/fill opacity separately if we use rgba, 
                    // but for simplicity we'll just dim the whole object if they want a translucent box
                });
                canvas.add(shapeRef);
            } else if (currentTool === 'circle') {
                shapeRef = new fabric.Ellipse({
                    left: startPoint.x,
                    top: startPoint.y,
                    rx: 0,
                    ry: 0,
                    ...strokeStyle,
                });
                canvas.add(shapeRef);
            } else if (currentTool === 'arrow') {
                // Arrow is a line and a triangle
                const points = [startPoint.x, startPoint.y, startPoint.x, startPoint.y];
                lineRef = new fabric.Line(points, {
                    strokeWidth: currentStroke,
                    fill: currentColor,
                    stroke: currentColor,
                    originX: 'center',
                    originY: 'center',
                    selectable: false,
                    evented: false,
                    opacity: currentGlobalOpacity / 100,
                });

                const centerX = startPoint.x;
                const centerY = startPoint.y;

                shapeRef = new fabric.Triangle({
                    width: currentStroke * 4,
                    height: currentStroke * 4,
                    fill: currentColor,
                    left: centerX,
                    top: centerY,
                    originX: 'center',
                    originY: 'center',
                    selectable: false,
                    evented: false,
                    angle: 90,
                    opacity: currentGlobalOpacity / 100,
                });

                canvas.add(lineRef, shapeRef);
            }
        });

        canvas.on('mouse:move', (o) => {
            if (!isDrawing || !startPoint || !shapeRef) return;
            const pointer = canvas.getPointer(o.e);
            const currentTool = activeToolRef.current;

            if (currentTool === 'rect' && shapeRef instanceof fabric.Rect) {
                shapeRef.set({
                    width: Math.abs(pointer.x - startPoint.x),
                    height: Math.abs(pointer.y - startPoint.y),
                    left: Math.min(pointer.x, startPoint.x),
                    top: Math.min(pointer.y, startPoint.y),
                });
            } else if (currentTool === 'circle' && shapeRef instanceof fabric.Ellipse) {
                shapeRef.set({
                    rx: Math.abs(pointer.x - startPoint.x) / 2,
                    ry: Math.abs(pointer.y - startPoint.y) / 2,
                    left: Math.min(pointer.x, startPoint.x),
                    top: Math.min(pointer.y, startPoint.y),
                });
            } else if (currentTool === 'arrow' && shapeRef instanceof fabric.Triangle && lineRef) {
                lineRef.set({ x2: pointer.x, y2: pointer.y });

                const dx = pointer.x - startPoint.x;
                const dy = pointer.y - startPoint.y;
                const angle = Math.atan2(dy, dx) * 180 / Math.PI;

                shapeRef.set({
                    left: pointer.x,
                    top: pointer.y,
                    angle: angle + 90
                });
            }
            canvas.renderAll();
        });

        canvas.on('mouse:up', () => {
            isDrawing = false;

            if (activeToolRef.current === 'arrow' && shapeRef && lineRef) {
                // Group the arrow parts
                canvas.remove(lineRef, shapeRef);
                const group = new fabric.Group([lineRef, shapeRef], {
                    selectable: true,
                });
                canvas.add(group);
                shapeRef = null;
                lineRef = null;
            } else if (shapeRef) {
                shapeRef.setCoords();
                shapeRef = null;
            }
            startPoint = null;
        });

        return () => {
            canvas.dispose();
            fabricRef.current = null;
        };
    }, [imageSrc]); // Re-init if source changes

    // Helper to convert hex to rgba string
    const hexToRgba = (hex: string, opacity: number) => {
        let r = 0, g = 0, b = 0;
        if (hex.length === 4) {
            r = parseInt(hex[1] + hex[1], 16);
            g = parseInt(hex[2] + hex[2], 16);
            b = parseInt(hex[3] + hex[3], 16);
        } else if (hex.length === 7) {
            r = parseInt(hex.substring(1, 3), 16);
            g = parseInt(hex.substring(3, 5), 16);
            b = parseInt(hex.substring(5, 7), 16);
        }
        return `rgba(${r},${g},${b},${opacity / 100})`;
    };

    // Update canvas mode when tool or color changes
    useEffect(() => {
        if (!fabricRef.current) return;
        const canvas = fabricRef.current;

        canvas.isDrawingMode = activeTool === 'freedraw';
        canvas.selection = activeTool === 'select';

        // Update brush
        if (canvas.freeDrawingBrush) {
            canvas.freeDrawingBrush.color = hexToRgba(activeColor, globalOpacity);
            canvas.freeDrawingBrush.width = strokeWidth;
        }

        // Update currently selected object if in select mode
        const activeObj = canvas.getActiveObject();
        if (activeObj && activeTool === 'select') {
            if (activeObj.type === 'i-text' || activeObj.type === 'text') {
                activeObj.set({ fill: activeColor, fontSize, opacity: globalOpacity / 100 });
            } else if (activeObj.type === 'path') { // freedraw line
                activeObj.set({ stroke: activeColor, strokeWidth, opacity: globalOpacity / 100 });
            } else if (activeObj.type === 'group') { // arrow
                const items = (activeObj as fabric.Group).getObjects();
                items.forEach(item => {
                    item.set({ stroke: activeColor, fill: activeColor });
                });
                activeObj.set({ opacity: globalOpacity / 100 });
                if (strokeWidth !== (activeObj as any)._lastStrokeWidth) {
                    // Scaling arrows retroactively is complex in Fabric, so we just recolor for now
                    (activeObj as any)._lastStrokeWidth = strokeWidth;
                }
            } else { // rect, ellipse
                activeObj.set({
                    stroke: activeColor,
                    strokeWidth,
                    fill: fillOpacity > 0 ? activeColor : 'transparent',
                    opacity: globalOpacity / 100 // Global opacity controls the whole object
                });
            }
            canvas.renderAll();
        }

        // Default object controls visibility
        canvas.getObjects().forEach(obj => {
            obj.set('selectable', activeTool === 'select');
            obj.set('evented', activeTool === 'select');
        });

    }, [activeTool, activeColor, strokeWidth, globalOpacity, fillOpacity, fontSize]);

    const handleSave = () => {
        if (!fabricRef.current) return;
        // Discard active selection so bounding boxes aren't saved in the image
        fabricRef.current.discardActiveObject();
        fabricRef.current.renderAll();

        // Export to base64
        const dataUrl = fabricRef.current.toDataURL({
            format: 'jpeg',
            quality: 0.9,
            multiplier: 1 // Keep original canvas size
        });

        onSave(dataUrl);
    };

    const handleClearAll = () => {
        if (!fabricRef.current) return;
        if (window.confirm('Clear all annotations? This cannot be undone.')) {
            fabricRef.current.clear();
            // Need to re-set background because clear() removes it
            fabric.Image.fromURL(imageSrc, (img) => {
                const scale = fabricRef.current!.width! / (img.width || 1);
                img.set({ scaleX: scale, scaleY: scale, originX: 'left', originY: 'top' });
                fabricRef.current!.setBackgroundImage(img, fabricRef.current!.renderAll.bind(fabricRef.current!));
            });
        }
    };

    const handleDeleteSelected = () => {
        if (!fabricRef.current) return;
        const activeObjects = fabricRef.current.getActiveObjects();
        if (activeObjects.length) {
            fabricRef.current.discardActiveObject();
            activeObjects.forEach(function (object) {
                fabricRef.current!.remove(object);
            });
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-app flex flex-col pt-10 touch-none" style={{ touchAction: 'none' }} ref={containerRef}>
            {/* Top Header */}
            <div className="px-4 py-3 flex items-center justify-between bg-white/5 border-b border-white/10 shrink-0">
                <button onClick={onCancel} className="text-white flex items-center gap-1 opacity-70 hover:opacity-100 px-2 py-1">
                    <span className="material-icons text-xl">close</span>
                    <span className="text-sm font-bold uppercase">Cancel</span>
                </button>
                <span className="text-sm font-bold tracking-widest text-slate-300 uppercase">Annotate</span>
                <button onClick={handleSave} className="text-primary flex items-center gap-1 hover:brightness-125 px-2 py-1">
                    <span className="text-sm font-bold uppercase">Save</span>
                    <span className="material-icons text-xl">check</span>
                </button>
            </div>

            {/* Main Canvas Area */}
            <div className="flex-1 w-full bg-black/60 flex items-center justify-center overflow-hidden relative">
                <canvas ref={canvasRef} className="max-w-full shadow-2xl" />
            </div>

            {/* Bottom Toolbars Container */}
            <div className="shrink-0 bg-white/5 border-t border-white/10 pb-[max(1rem,env(safe-area-inset-bottom))]">

                {/* Properties Toolbar (Color & Stroke) */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 overflow-x-auto custom-scrollbar">
                    <div className="flex gap-2">
                        {colors.map(color => (
                            <button
                                key={color.value}
                                onClick={() => setActiveColor(color.value)}
                                className={`w-8 h-8 rounded-full border-2 transition-transform ${activeColor === color.value ? 'scale-110 border-white' : 'border-transparent hover:scale-105'}`}
                                style={{ backgroundColor: color.value }}
                                title={color.label}
                            />
                        ))}
                    </div>

                    <div className="flex items-center gap-4 ml-4 border-l border-white/10 pl-4">
                        <div className="flex flex-col gap-1 items-center">
                            <span className="material-icons text-slate-400 text-[10px] leading-none">line_weight</span>
                            <span className="text-[8px] font-bold text-slate-500 uppercase leading-none mb-1">Scale</span>
                            <input
                                type="range"
                                min="1"
                                max="10"
                                value={strokeWidth}
                                onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
                                className="w-16 accent-primary h-1"
                                title="Line Thickness"
                            />
                        </div>

                        <div className="flex flex-col gap-1 items-center justify-end h-full">
                            <span className="material-icons text-slate-400 text-[10px] leading-none mt-auto mb-1">format_size</span>
                            <span className="text-[8px] font-bold text-slate-500 uppercase leading-none mb-1">Font</span>
                            <input
                                type="range"
                                min="12"
                                max="72"
                                value={fontSize}
                                onChange={(e) => setFontSize(parseInt(e.target.value))}
                                className="w-16 accent-primary h-1"
                                title="Font Size"
                            />
                        </div>

                        <div className="flex flex-col gap-1 items-center justify-end h-full">
                            <span className="material-icons text-slate-400 text-[10px] leading-none mt-auto mb-1">opacity</span>
                            <span className="text-[8px] font-bold text-slate-500 uppercase leading-none mb-1">Opacity</span>
                            <input
                                type="range"
                                min="10"
                                max="100"
                                value={globalOpacity}
                                onChange={(e) => setGlobalOpacity(parseInt(e.target.value))}
                                className="w-16 accent-primary h-1"
                                title="Object Opacity"
                            />
                        </div>

                        <div className="flex flex-col gap-1 items-center justify-end h-full">
                            <span className="material-icons text-slate-400 text-[10px] leading-none mt-auto mb-1">format_color_fill</span>
                            <span className="text-[8px] font-bold text-slate-500 uppercase leading-none mb-1">Fill</span>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={fillOpacity}
                                onChange={(e) => setFillOpacity(parseInt(e.target.value))}
                                className="w-16 accent-primary h-1"
                                title="Fill Opacity"
                            />
                        </div>
                    </div>
                </div>

                {/* Tools Toolbar */}
                <div className="flex items-center justify-center gap-1 px-2 py-2 overflow-x-auto custom-scrollbar">
                    <ToolButton icon="near_me" label="Select" active={activeTool === 'select'} onClick={() => setActiveTool('select')} />
                    <div className="w-px h-8 bg-white/10 mx-1"></div>
                    <ToolButton icon="edit" label="Draw" active={activeTool === 'freedraw'} onClick={() => setActiveTool('freedraw')} />
                    <ToolButton icon="north_east" label="Arrow" active={activeTool === 'arrow'} onClick={() => setActiveTool('arrow')} />
                    <ToolButton icon="check_box_outline_blank" label="Box" active={activeTool === 'rect'} onClick={() => setActiveTool('rect')} />
                    <ToolButton icon="radio_button_unchecked" label="Circle" active={activeTool === 'circle'} onClick={() => setActiveTool('circle')} />
                    <ToolButton icon="title" label="Text" active={activeTool === 'text'} onClick={() => setActiveTool('text')} />
                    <div className="w-px h-8 bg-white/10 mx-1"></div>
                    <button
                        onClick={handleDeleteSelected}
                        className="flex flex-col items-center justify-center w-14 py-2 rounded-xl text-rose-400 hover:bg-white/5 transition-colors"
                        title="Delete Selected"
                    >
                        <span className="material-icons text-xl mb-1">delete</span>
                        <span className="text-[9px] font-bold uppercase">Del Obj</span>
                    </button>
                    <button
                        onClick={handleClearAll}
                        className="flex flex-col items-center justify-center w-14 py-2 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors"
                        title="Clear All"
                    >
                        <span className="material-icons text-xl mb-1">layers_clear</span>
                        <span className="text-[9px] font-bold uppercase">Clear</span>
                    </button>
                </div>

            </div>
        </div>,
        document.body
    );
};

// Helper Subcomponent
const ToolButton = ({ icon, label, active, onClick }: { icon: string, label: string, active: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center justify-center w-14 py-2 rounded-xl transition-colors ${active ? 'bg-primary/20 text-primary' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
    >
        <span className="material-icons text-xl mb-1">{icon}</span>
        <span className="text-[9px] font-bold uppercase">{label}</span>
    </button>
);
