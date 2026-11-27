'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import imageCompression from 'browser-image-compression';
import {
    ArrowLeft, Download, Loader2, RotateCcw, Repeat2,
    LayoutGrid, Sliders, Wand2, Palette, Crop,
    RotateCw, ZoomIn, ZoomOut, ArrowUp, ArrowDown, ArrowLeftIcon, ArrowRightIcon,
    Check, X, Hand, ChevronDown, ChevronUp, PanelRightClose, PanelRightOpen,
} from 'lucide-react';
import { CollageTemplate, SlotPosition } from '@/utils/templates';
import {
    PhotoEdits,
    DEFAULT_EDITS,
    FILTER_OPTIONS,
    FilterId,
    editsToCssFilter,
    effectivePhotoScale,
    basePhotoDimensions,
    normalizeRotation,
    clampOffsets,
    maxOffsetPct,
    CollageStyle,
    BACKGROUND_PRESETS,
    ASPECT_PRESETS,
} from '@/utils/photoEdits';

import { PhotoData } from '@/types/photo';
import type { ComparisonLabels, ExportOptions } from '@/utils/collageGenerator';
import ThemeToggle from '@/components/ThemeToggle';

interface CollageEditorProps {
    photos: PhotoData[];
    templates: CollageTemplate[];
    selectedTemplate: CollageTemplate;
    photoAssignments: Map<string, number>;
    selectedSlot: string | null;
    slotEdits: Map<string, PhotoEdits>;
    collageStyle: CollageStyle;
    outputAspectRatio: number | null;
    exportOptions: ExportOptions;
    comparisonLabels: ComparisonLabels;
    isSaving: boolean;
    onTemplateSelect: (template: CollageTemplate) => void;
    onSlotClick: (slotId: string) => void;
    onSwapSlots: (slotA: string, slotB: string) => void;
    onUpdateSlotEdits: (slotId: string, updates: Partial<PhotoEdits>) => void;
    onResetSlotEdits: (slotId: string) => void;
    onApplyEditToAll: (updates: Partial<PhotoEdits>) => void;
    onUpdateStyle: (updates: Partial<CollageStyle>) => void;
    onSetAspectRatio: (ratio: number | null) => void;
    onUpdateExportOptions: (updates: Partial<ExportOptions>) => void;
    onUpdateComparisonLabels: (updates: Partial<ComparisonLabels>) => void;
    onSave: () => void;
    onCancel: () => void;
}

type Tab = 'layouts' | 'adjust' | 'filters' | 'format' | 'style';
const TAB_ORDER: Tab[] = ['layouts', 'adjust', 'filters', 'format', 'style'];
const PREVIEW_REFERENCE_WIDTH = 448;
const BACKGROUND_SLOT: SlotPosition = { id: 'background', x: 0, y: 0, width: 100, height: 100 };

export default function CollageEditor({
    photos,
    templates,
    selectedTemplate,
    photoAssignments,
    selectedSlot,
    slotEdits,
    collageStyle,
    outputAspectRatio,
    exportOptions,
    comparisonLabels,
    isSaving,
    onTemplateSelect,
    onSlotClick,
    onSwapSlots,
    onUpdateSlotEdits,
    onResetSlotEdits,
    onApplyEditToAll,
    onUpdateStyle,
    onSetAspectRatio,
    onUpdateExportOptions,
    onUpdateComparisonLabels,
    onSave,
    onCancel,
}: CollageEditorProps) {
    const [tab, setTab] = useState<Tab>('layouts');
    const [toolsCollapsed, setToolsCollapsed] = useState(false);
    const [backgroundSelected, setBackgroundSelected] = useState(false);
    const [backgroundBusy, setBackgroundBusy] = useState(false);
    const [backgroundError, setBackgroundError] = useState<string | null>(null);
    const backgroundInputRef = useRef<HTMLInputElement>(null);
    const backgroundBusyRef = useRef(false);
    const background = collageStyle.backgroundImage;
    const updateBackground = (updates: Partial<PhotoEdits>) => {
        if (background) onUpdateStyle({ backgroundImage: { ...background, edits: { ...background.edits, ...updates } } });
    };
    const importBackground = async (file?: File) => {
        if (!file || backgroundBusyRef.current) return;
        if (!file.type.startsWith('image/') || file.size > 25 * 1024 * 1024) {
            setBackgroundError('Choose an image smaller than 25 MB.');
            return;
        }
        backgroundBusyRef.current = true;
        setBackgroundBusy(true);
        setBackgroundError(null);
        try {
            const compressed = await imageCompression(file, { maxSizeMB: 1.5, maxWidthOrHeight: 1920, useWebWorker: true, libURL: '/browser-image-compression.js' });
            onUpdateStyle({ backgroundImage: { photo: { file: compressed, previewUrl: URL.createObjectURL(compressed) }, edits: { ...DEFAULT_EDITS } } });
            setBackgroundSelected(true);
            setSwapSource(null);
            setTab('adjust');
        } catch {
            setBackgroundError('This image could not be opened. Try a JPEG, PNG or WebP.');
        } finally {
            backgroundBusyRef.current = false;
            setBackgroundBusy(false);
        }
    };
    // Slot currently "armed" to be swapped. Tapping another slot swaps them.
    const [swapSource, setSwapSource] = useState<string | null>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const [previewWidth, setPreviewWidth] = useState(PREVIEW_REFERENCE_WIDTH);

    const availableTemplates = useMemo(
        () => templates.filter((t) => t.slots.length === photos.length),
        [templates, photos.length]
    );

    const aspectRatio = outputAspectRatio ?? selectedTemplate.aspectRatio;
    const styleScale = previewWidth / PREVIEW_REFERENCE_WIDTH;

    const activeEdits: PhotoEdits = backgroundSelected && background ? background.edits : selectedSlot
        ? (slotEdits.get(selectedSlot) ?? DEFAULT_EDITS)
        : DEFAULT_EDITS;

    // Changing layout drops the armed state (slot IDs may differ).
    const handleTemplateSelect = useCallback((t: CollageTemplate) => {
        setSwapSource(null);
        onTemplateSelect(t);
    }, [onTemplateSelect]);

    // ----- stable per-slot callbacks (so EditableSlot can be memoized) -----
    const handleTap = useCallback((slotId: string) => {
        if (swapSource) {
            if (swapSource !== slotId) onSwapSlots(swapSource, slotId);
            setSwapSource(null);
            return;
        }
        onSlotClick(slotId);
        setBackgroundSelected(false);
    }, [swapSource, onSwapSlots, onSlotClick]);

    const handleLongPress = useCallback((slotId: string) => {
        // Arm this slot for swapping. Light haptic where supported.
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try { navigator.vibrate(12); } catch { /* ignore */ }
        }
        setSwapSource(slotId);
        onSlotClick(slotId);
        setBackgroundSelected(false);
    }, [onSlotClick]);

    const handleEditsChange = useCallback((slotId: string, updates: Partial<PhotoEdits>) => {
        onUpdateSlotEdits(slotId, updates);
    }, [onUpdateSlotEdits]);

    const armSwapFromButton = useCallback(() => {
        if (selectedSlot) setSwapSource(selectedSlot);
    }, [selectedSlot]);

    const cancelSwap = useCallback(() => setSwapSource(null), []);

    useEffect(() => {
        const element = previewRef.current;
        if (!element || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(([entry]) => {
            const borderWidth = entry.borderBoxSize?.[0]?.inlineSize ?? element.getBoundingClientRect().width;
            setPreviewWidth(borderWidth);
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    const handleTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const current = TAB_ORDER.indexOf(tab);
        const next = event.key === 'Home'
            ? 0
            : event.key === 'End'
                ? TAB_ORDER.length - 1
                : (current + (event.key === 'ArrowRight' ? 1 : -1) + TAB_ORDER.length) % TAB_ORDER.length;
        setTab(TAB_ORDER[next]);
        const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]');
        buttons[next]?.focus();
    };

    return (
        <div className="editor-shell flex h-dvh flex-col overflow-hidden bg-slate-100 text-slate-950 transition-colors dark:bg-slate-950 dark:text-white">
            <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/90">
                <button
                    onClick={onCancel}
                    className="-ml-1 flex min-h-10 items-center gap-2 rounded-full px-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                >
                    <ArrowLeft className="h-5 w-5" />
                    <span className="text-sm">Photos</span>
                </button>

                <div className="hidden text-center sm:block">
                    <p className="text-sm font-semibold text-slate-950 dark:text-white">Edit collage</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{photos.length} photos · {availableTemplates.length} layouts</p>
                </div>

                <div className="flex items-center gap-2">
                    <ThemeToggle />
                    <button
                        onClick={onSave}
                        disabled={isSaving || backgroundBusy}
                        className="flex min-h-10 items-center gap-2 rounded-full bg-blue-500 px-4 font-medium text-white transition hover:bg-blue-400 disabled:opacity-50 sm:px-5"
                    >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        <span>{isSaving ? 'Saving...' : 'Save'}</span>
                    </button>
                </div>
            </header>

            {swapSource && (
                <div className="flex shrink-0 items-center justify-center gap-2 bg-amber-400 px-4 py-2.5 text-sm font-medium text-slate-950" role="status">
                    <Repeat2 className="h-4 w-4" />
                    Tap another photo to swap
                    <button onClick={cancelSwap} className="ml-2 rounded-full bg-slate-950/10 px-2 py-0.5 font-semibold hover:bg-slate-950/20">
                        Cancel
                    </button>
                </div>
            )}

            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
                <section className="flex min-h-0 flex-1 flex-col items-center justify-start overflow-auto bg-slate-100 p-4 sm:p-6 md:justify-center dark:bg-slate-950" aria-label="Collage preview">
                    <div
                        ref={previewRef}
                        className="relative w-full max-w-md shrink-0 overflow-hidden shadow-2xl shadow-black/20 ring-1 ring-black/10 dark:shadow-black/30 dark:ring-white/10"
                        style={{
                            aspectRatio,
                            background: collageStyle.background,
                            padding: collageStyle.padding * styleScale,
                            borderRadius: collageStyle.cornerRadius * styleScale,
                        }}
                    >
                        {background && <div className={`absolute inset-0 ${backgroundSelected ? '' : 'pointer-events-none'}`}>
                            <EditableSlot slot={BACKGROUND_SLOT} slotNumber={0} photo={background.photo} edits={background.edits}
                                isSelected={backgroundSelected} isSwapSource={false} swapArmed={false} comparisonLabel={null}
                                slotBackground="transparent" cornerRadius={0} halfGap={0}
                                onTap={() => setBackgroundSelected(true)} onLongPress={() => setBackgroundSelected(true)}
                                onEditsChange={(_id, updates) => updateBackground(updates)} />
                        </div>}
                        <div className={`relative h-full w-full ${backgroundSelected && background ? 'pointer-events-none' : ''}`}>
                            {selectedTemplate.slots.map((slot, slotIndex) => {
                                const photoIndex = photoAssignments.get(slot.id);
                                const photo = photoIndex !== undefined ? photos[photoIndex] : null;
                                const isSelected = selectedSlot === slot.id && !swapSource && !backgroundSelected;
                                const edits = slotEdits.get(slot.id) ?? DEFAULT_EDITS;

                                return (
                                    <EditableSlot
                                        key={slot.id}
                                        slot={slot}
                                        slotNumber={slotIndex + 1}
                                        photo={photo}
                                        edits={edits}
                                        isSelected={isSelected}
                                        isSwapSource={swapSource === slot.id}
                                        swapArmed={!!swapSource && swapSource !== slot.id}
                                        comparisonLabel={comparisonLabels.enabled && slotIndex < 2
                                            ? (slotIndex === 0 ? comparisonLabels.left : comparisonLabels.right)
                                            : null}
                                        slotBackground={background ? 'transparent' : collageStyle.background}
                                        cornerRadius={collageStyle.cornerRadius * styleScale}
                                        halfGap={(collageStyle.gap * styleScale) / 2}
                                        onTap={handleTap}
                                        onLongPress={handleLongPress}
                                        onEditsChange={handleEditsChange}
                                    />
                                );
                            })}
                        </div>
                    </div>

                    <p className="mt-3 flex items-center gap-1.5 px-4 text-center text-[11px] text-slate-500 dark:text-slate-400">
                        <Hand className="h-3.5 w-3.5 shrink-0" />
                        <span className="md:hidden">Tap to select · Drag to move · Pinch to zoom · Hold to swap</span>
                        <span className="hidden md:inline">Click to select · Drag to move · Scroll or pinch to zoom · Right-click to swap</span>
                    </p>
                </section>

                <aside className={`flex shrink-0 flex-col border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] transition-[width] duration-200 dark:border-slate-700 dark:bg-slate-900 md:border-l md:border-t-0 md:pb-0 ${toolsCollapsed ? 'md:w-14' : 'md:w-[27rem]'}`} aria-label="Editing tools">
                    <button
                        type="button"
                        onClick={() => setToolsCollapsed((collapsed) => !collapsed)}
                        className={`flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100 dark:text-white dark:hover:bg-white/5 ${toolsCollapsed ? 'md:justify-center md:px-0' : ''}`}
                        aria-expanded={!toolsCollapsed}
                        aria-controls="editor-tools-content"
                        aria-label={`Editing tools: ${toolsCollapsed ? 'Show' : 'Hide'}`}
                    >
                        <span className={`items-center gap-2 ${toolsCollapsed ? 'flex md:hidden' : 'flex'}`}>
                            <Sliders className="h-4 w-4 text-blue-400" />
                            Editing tools
                        </span>
                        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                            <span className={toolsCollapsed ? 'md:hidden' : ''}>{toolsCollapsed ? 'Show' : 'Hide'}</span>
                            {toolsCollapsed
                                ? <ChevronUp className="h-4 w-4 md:hidden" aria-hidden="true" />
                                : <ChevronDown className="h-4 w-4 md:hidden" aria-hidden="true" />}
                            {toolsCollapsed
                                ? <PanelRightOpen className="hidden h-4 w-4 md:block" aria-hidden="true" />
                                : <PanelRightClose className="hidden h-4 w-4 md:block" aria-hidden="true" />}
                        </span>
                    </button>

                    <div id="editor-tools-content" className={`${toolsCollapsed ? 'hidden' : 'flex'} max-h-[42dvh] min-h-0 flex-col md:max-h-none md:flex-1`}>
                        <div className="shrink-0 space-y-2 border-t border-slate-200 p-3 dark:border-slate-700">
                            <label className="flex items-center gap-2 text-xs font-medium">
                                Edit layer
                                <select aria-label="Edit layer" className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                                    value={backgroundSelected && background ? 'background' : selectedSlot ?? ''}
                                    onChange={(event) => { setSwapSource(null); setBackgroundSelected(event.target.value === 'background'); if (event.target.value !== 'background') onSlotClick(event.target.value); }}>
                                    {!selectedSlot && <option value="" disabled>Choose a layer</option>}
                                    {selectedTemplate.slots.map((slot, index) => <option key={slot.id} value={slot.id}>Photo {index + 1}</option>)}
                                    {background && <option value="background">Background image</option>}
                                </select>
                            </label>
                            <div className="flex gap-2">
                                <button type="button" disabled={backgroundBusy} onClick={() => backgroundInputRef.current?.click()} className="min-h-10 flex-1 rounded-lg bg-slate-100 px-3 text-xs font-semibold dark:bg-slate-800">
                                    {backgroundBusy ? 'Opening image…' : background ? 'Replace background image' : 'Add background image'}
                                </button>
                                {background && <button type="button" disabled={backgroundBusy} onClick={() => { onUpdateStyle({ backgroundImage: undefined }); setBackgroundSelected(false); }} className="min-h-10 rounded-lg px-3 text-xs font-semibold" aria-label="Remove background image">Remove</button>}
                            </div>
                            <input ref={backgroundInputRef} type="file" accept="image/*" aria-label="Background image file" className="hidden" onChange={(event) => { void importBackground(event.target.files?.[0]); event.target.value = ''; }} />
                            {backgroundError && <p role="alert" className="text-xs text-red-500">{backgroundError}</p>}
                            {backgroundSelected && background && <p className="text-xs text-blue-500">Editing background · Drag the canvas to move; pinch or scroll to zoom. Use Style to reveal more with padding and gaps.</p>}
                        </div>
                        <div className="flex shrink-0 border-y border-slate-200 dark:border-slate-700 md:border-t-0" role="tablist" aria-label="Editing tools" onKeyDown={handleTabKeyDown}>
                            <TabButton tabId="layouts" active={tab === 'layouts'} onClick={() => setTab('layouts')} icon={<LayoutGrid className="h-5 w-5" />} label="Layouts" />
                            <TabButton tabId="adjust" active={tab === 'adjust'} onClick={() => setTab('adjust')} icon={<Sliders className="h-5 w-5" />} label="Adjust" />
                            <TabButton tabId="filters" active={tab === 'filters'} onClick={() => setTab('filters')} icon={<Wand2 className="h-5 w-5" />} label="Filters" />
                            <TabButton tabId="format" active={tab === 'format'} onClick={() => setTab('format')} icon={<Crop className="h-5 w-5" />} label="Format" />
                            <TabButton tabId="style" active={tab === 'style'} onClick={() => setTab('style')} icon={<Palette className="h-5 w-5" />} label="Style" />
                        </div>

                        <div id="editor-tool-panel" role="tabpanel" aria-labelledby={`editor-tab-${tab}`} className="min-h-0 overflow-y-auto md:flex-1">
                            {tab === 'layouts' && (
                                <LayoutsTab templates={availableTemplates} selectedTemplate={selectedTemplate} onTemplateSelect={handleTemplateSelect} />
                            )}
                            {tab === 'adjust' && (
                                <AdjustTab
                                    selectedSlot={backgroundSelected && background ? 'background' : selectedSlot}
                                    edits={activeEdits}
                                    onUpdate={(updates) => backgroundSelected ? updateBackground(updates) : selectedSlot && onUpdateSlotEdits(selectedSlot, updates)}
                                    onReset={() => backgroundSelected ? updateBackground(DEFAULT_EDITS) : selectedSlot && onResetSlotEdits(selectedSlot)}
                                    backgroundSelected={backgroundSelected}
                                    onArmSwap={armSwapFromButton}
                                    onApplyFitAll={(fitMode) => onApplyEditToAll({ fitMode, scale: 1, offsetX: 0, offsetY: 0 })}
                                />
                            )}
                            {tab === 'filters' && (
                                <FiltersTab
                                    selectedSlot={backgroundSelected && background ? 'background' : selectedSlot}
                                    selectedPhoto={backgroundSelected && background ? background.photo : selectedSlot ? photos[photoAssignments.get(selectedSlot) ?? -1] ?? null : null}
                                    currentFilter={activeEdits.filter}
                                    onPick={(filter) => backgroundSelected ? updateBackground({ filter }) : selectedSlot && onUpdateSlotEdits(selectedSlot, { filter })}
                                    onApplyAll={backgroundSelected ? undefined : (filter) => onApplyEditToAll({ filter })}
                                />
                            )}
                            {tab === 'format' && (
                                <FormatTab
                                    activeRatio={outputAspectRatio}
                                    onSelect={onSetAspectRatio}
                                    exportOptions={exportOptions}
                                    onUpdateExportOptions={onUpdateExportOptions}
                                    comparisonLabels={comparisonLabels}
                                    onUpdateComparisonLabels={onUpdateComparisonLabels}
                                />
                            )}
                            {tab === 'style' && <StyleTab style={collageStyle} onUpdate={onUpdateStyle} />}
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}

/* ============================== EditableSlot ============================== */

const TAP_SLOP = 8;          // px of movement still treated as a tap
const DRAG_THRESHOLD = 8;    // px before a press becomes a pan
const LONG_PRESS_MS = 400;   // hold time to arm a swap

interface EditableSlotProps {
    slot: SlotPosition;
    slotNumber: number;
    photo: PhotoData | null;
    edits: PhotoEdits;
    isSelected: boolean;
    isSwapSource: boolean;
    swapArmed: boolean; // some OTHER slot is armed → this slot is a swap target
    comparisonLabel: string | null;
    slotBackground: string;
    cornerRadius: number;
    halfGap: number;
    onTap: (slotId: string) => void;
    onLongPress: (slotId: string) => void;
    onEditsChange: (slotId: string, updates: Partial<PhotoEdits>) => void;
}

const EditableSlot = React.memo(function EditableSlot({
    slot, slotNumber, photo, edits, isSelected, isSwapSource, swapArmed,
    comparisonLabel, slotBackground, cornerRadius, halfGap,
    onTap, onLongPress, onEditsChange,
}: EditableSlotProps) {
    const innerRef = useRef<HTMLDivElement>(null);
    const imgAspectRef = useRef<number>(0);
    const [imgAspect, setImgAspect] = useState(0);
    const [slotSize, setSlotSize] = useState({ width: 0, height: 0 });

    const editsRef = useRef(edits);
    useEffect(() => { editsRef.current = edits; }, [edits]);

    const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
    const gestureRef = useRef<{
        mode: null | 'pan' | 'pinch';
        moved: boolean;
        longPressed: boolean;
        startX: number;
        startY: number;
        timer: number | null;
    }>({ mode: null, moved: false, longPressed: false, startX: 0, startY: 0, timer: null });

    const slotId = slot.id;

    const clearTimer = useCallback(() => {
        if (gestureRef.current.timer !== null) {
            window.clearTimeout(gestureRef.current.timer);
            gestureRef.current.timer = null;
        }
    }, []);

    const commitEditsChange = useCallback((updates: Partial<PhotoEdits>) => {
        editsRef.current = { ...editsRef.current, ...updates };
        onEditsChange(slotId, updates);
    }, [slotId, onEditsChange]);

    const getPannedOffsets = useCallback((e: PhotoEdits, dxPx: number, dyPx: number, scale = e.scale) => {
        const rect = innerRef.current?.getBoundingClientRect();
        if (!rect || rect.width === 0 || rect.height === 0) return null;
        const m = maxOffsetPct(imgAspectRef.current, rect.width, rect.height, scale, e.rotation, e.fitMode);
        return {
            offsetX: Math.max(-m.x, Math.min(m.x, e.offsetX + (dxPx / rect.width) * 100)),
            offsetY: Math.max(-m.y, Math.min(m.y, e.offsetY + (dyPx / rect.height) * 100)),
        };
    }, []);

    // Re-clamp stored offsets when overflow could change (zoom / image load /
    // slot resize) so panning never reveals empty space and zooming out brings
    // pushed-off edges back into view.
    const reclamp = useCallback(() => {
        const rect = innerRef.current?.getBoundingClientRect();
        if (!rect || !imgAspectRef.current) return;
        const e = editsRef.current;
        const clamped = clampOffsets(e, imgAspectRef.current, rect.width, rect.height);
        if (Math.abs(clamped.offsetX - e.offsetX) > 0.05 || Math.abs(clamped.offsetY - e.offsetY) > 0.05) {
            commitEditsChange(clamped);
        }
    }, [commitEditsChange]);

    useEffect(() => { reclamp(); }, [edits.scale, edits.rotation, edits.offsetX, edits.offsetY, reclamp]);

    useEffect(() => {
        const el = innerRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            setSlotSize((prev) => (
                Math.abs(prev.width - width) > 0.5 || Math.abs(prev.height - height) > 0.5
                    ? { width, height }
                    : prev
            ));
            reclamp();
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [reclamp]);

    useEffect(() => () => clearTimer(), [clearTimer]);

    const applyPan = (dxPx: number, dyPx: number) => {
        const e = editsRef.current;
        const offsets = getPannedOffsets(e, dxPx, dyPx);
        if (offsets) commitEditsChange(offsets);
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        const ptrs = pointersRef.current;
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (ptrs.size === 1) {
            gestureRef.current = { mode: null, moved: false, longPressed: false, startX: e.clientX, startY: e.clientY, timer: null };
            if (photo && e.pointerType === 'mouse' && e.button === 2) {
                gestureRef.current.longPressed = true;
                onLongPress(slotId);
                return;
            }
            if (photo) {
                gestureRef.current.timer = window.setTimeout(() => {
                    if (!gestureRef.current.moved && pointersRef.current.size === 1) {
                        gestureRef.current.longPressed = true;
                        onLongPress(slotId);
                    }
                }, LONG_PRESS_MS);
            }
        } else if (ptrs.size === 2) {
            clearTimer();
            gestureRef.current.mode = 'pinch';
        }
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const ptrs = pointersRef.current;
        if (!ptrs.has(e.pointerId)) return;
        const prev = ptrs.get(e.pointerId)!;
        const curr = { x: e.clientX, y: e.clientY };
        const g = gestureRef.current;

        if (ptrs.size >= 2) {
            // ---- pinch: zoom + pan (no rotation, to avoid accidental skew) ----
            g.mode = 'pinch';
            g.moved = true;
            clearTimer();
            let other: { x: number; y: number } | null = null;
            for (const [id, pos] of ptrs) { if (id !== e.pointerId) { other = pos; break; } }
            if (other && photo) {
                const oldDist = Math.hypot(other.x - prev.x, other.y - prev.y);
                const newDist = Math.hypot(other.x - curr.x, other.y - curr.y);
                if (oldDist > 1) {
                    const factor = newDist / oldDist;
                    const e0 = editsRef.current;
                    const newScale = Math.max(1, Math.min(3, e0.scale * factor));
                    const offsets = getPannedOffsets(e0, (curr.x - prev.x) / 2, (curr.y - prev.y) / 2, newScale);
                    commitEditsChange(offsets ? { scale: newScale, ...offsets } : { scale: newScale });
                }
            }
            ptrs.set(e.pointerId, curr);
            return;
        }

        // ---- single pointer ----
        if (g.longPressed) { ptrs.set(e.pointerId, curr); return; } // armed: ignore movement

        const totalDx = curr.x - g.startX;
        const totalDy = curr.y - g.startY;

        if (g.mode === null) {
            if (Math.abs(totalDx) + Math.abs(totalDy) < DRAG_THRESHOLD) {
                ptrs.set(e.pointerId, curr);
                return;
            }
            g.moved = true;
            clearTimer();
            g.mode = 'pan';
        }

        if (g.mode === 'pan' && photo) {
            applyPan(curr.x - prev.x, curr.y - prev.y);
        }
        ptrs.set(e.pointerId, curr);
    };

    const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
        const ptrs = pointersRef.current;
        const g = gestureRef.current;
        if (ptrs.has(e.pointerId)) ptrs.delete(e.pointerId);

        if (ptrs.size === 0) {
            clearTimer();
            const dist = Math.abs(e.clientX - g.startX) + Math.abs(e.clientY - g.startY);
            // A long-press already armed the swap; don't also treat the release
            // as a tap (which would immediately cancel it).
            if (!g.longPressed && !g.moved && dist < TAP_SLOP) {
                onTap(slotId);
            }
            gestureRef.current.mode = null;
            gestureRef.current.moved = false;
            gestureRef.current.longPressed = false;
        } else if (ptrs.size === 1) {
            // One finger lifted from a pinch — treat the remaining finger as a fresh, already-moved gesture.
            const remaining = [...ptrs.entries()][0];
            gestureRef.current = { mode: null, moved: true, longPressed: false, startX: remaining[1].x, startY: remaining[1].y, timer: null };
        }
    };

    const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
        if (!photo) return;
        event.preventDefault();
        const current = editsRef.current;
        const nextScale = Math.max(1, Math.min(3, current.scale * Math.exp(-event.deltaY * 0.002)));
        if (Math.abs(nextScale - current.scale) < 0.001) return;
        const offsets = getPannedOffsets(current, 0, 0, nextScale);
        commitEditsChange(offsets ? { scale: nextScale, ...offsets } : { scale: nextScale });
    };

    const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
        event.preventDefault();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        onTap(slotId);
    };

    const hasGeometry = imgAspect > 0 && slotSize.width > 0 && slotSize.height > 0;
    const base = hasGeometry
        ? basePhotoDimensions(imgAspect, slotSize.width, slotSize.height, edits.fitMode)
        : { width: 0, height: 0 };
    const baseWidth = base.width;
    const baseHeight = base.height;
    const displayScale = hasGeometry
        ? effectivePhotoScale(edits, imgAspect, slotSize.width, slotSize.height)
        : edits.scale;

    const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
        const target = event.currentTarget;
        if (target.naturalWidth && target.naturalHeight) {
            const nextAspect = target.naturalWidth / target.naturalHeight;
            imgAspectRef.current = nextAspect;
            setImgAspect(nextAspect);
            reclamp();
        }
    };

    return (
        <div
            data-slot-id={slot.id}
            className={`absolute transition-all duration-150 ${isSelected || isSwapSource ? 'z-10' : ''}`}
            style={{
                left: `${slot.x}%`,
                top: `${slot.y}%`,
                width: `${slot.width}%`,
                height: `${slot.height}%`,
                padding: halfGap,
            }}
        >
            <div
                ref={innerRef}
                role="button"
                tabIndex={0}
                aria-label={slotId === 'background' ? 'Position background image' : photo ? `Select photo slot ${slotNumber}` : `Empty photo slot ${slotNumber}`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                onWheel={handleWheel}
                onKeyDown={handleKeyDown}
                onContextMenu={handleContextMenu}
                className={`relative w-full h-full overflow-hidden bg-slate-200 transition-all select-none cursor-pointer
                    ${isSelected ? 'ring-4 ring-blue-500' : ''}
                    ${isSwapSource ? 'ring-4 ring-amber-400' : ''}
                    ${swapArmed ? 'ring-2 ring-amber-300/60' : ''}`}
                style={{
                    borderRadius: cornerRadius,
                    background: slotBackground,
                    touchAction: 'none',
                    WebkitUserSelect: 'none',
                }}
            >
                {photo ? (hasGeometry ? (
                    <div
                        className="pointer-events-none absolute h-0 w-0"
                        style={{
                            left: `calc(50% + ${edits.offsetX}%)`,
                            top: `calc(50% + ${edits.offsetY}%)`,
                        }}
                    >
                        <Image
                            src={photo.previewUrl}
                            alt=""
                            width={Math.max(1, Math.round(baseWidth))}
                            height={Math.max(1, Math.round(baseHeight))}
                            unoptimized
                            draggable={false}
                            onLoad={handleImageLoad}
                            style={{
                                position: 'absolute',
                                left: -baseWidth / 2,
                                top: -baseHeight / 2,
                                width: baseWidth,
                                height: baseHeight,
                                maxWidth: 'none',
                                filter: editsToCssFilter(edits),
                                transform: `scale(${displayScale}) rotate(${normalizeRotation(edits.rotation)}deg)`,
                                transformOrigin: 'center center',
                                willChange: 'transform, filter',
                            }}
                        />
                    </div>
                ) : (
                    <Image
                        src={photo.previewUrl}
                        alt=""
                        fill
                        unoptimized
                        className={`pointer-events-none ${edits.fitMode === 'contain' ? 'object-contain' : 'object-cover'}`}
                        sizes="(max-width: 768px) 100vw, 50vw"
                        draggable={false}
                        onLoad={handleImageLoad}
                    />
                )) : null}

                {comparisonLabel?.trim() && (
                    <span className="pointer-events-none absolute left-1/2 top-3 max-w-[calc(100%-1rem)] -translate-x-1/2 truncate rounded-full bg-slate-950/80 px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg backdrop-blur-sm">
                        {comparisonLabel.trim().slice(0, 24)}
                    </span>
                )}

                {/* Swap-target hint badge */}
                {swapArmed && photo && (
                    <span className="absolute inset-0 flex items-center justify-center bg-amber-400/10 pointer-events-none">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-400 text-slate-900 shadow-lg">
                            <Repeat2 className="w-4 h-4" />
                        </span>
                    </span>
                )}
            </div>
        </div>
    );
});

/* ============================== Tabs ============================== */

function TabButton({ tabId, active, onClick, icon, label }: {
    tabId: Tab; active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
    return (
        <button
            onClick={onClick}
            id={`editor-tab-${tabId}`}
            role="tab"
            aria-selected={active}
            aria-controls="editor-tool-panel"
            tabIndex={active ? 0 : -1}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors
                ${active ? 'border-b-2 border-blue-500 bg-blue-500/10 text-blue-600 dark:bg-slate-700/40 dark:text-blue-400' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'}`}
        >
            {icon}
            <span>{label}</span>
        </button>
    );
}

function LayoutsTab({
    templates, selectedTemplate, onTemplateSelect,
}: {
    templates: CollageTemplate[];
    selectedTemplate: CollageTemplate;
    onTemplateSelect: (t: CollageTemplate) => void;
}) {
    return (
        <div className="px-4 py-3">
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{templates.length} Layouts</p>
            <div className="grid grid-cols-4 gap-3">
                {templates.map((template) => {
                    const isSelected = template.id === selectedTemplate.id;
                    return (
                        <button
                            key={template.id}
                            onClick={() => onTemplateSelect(template)}
                            aria-label={template.name}
                            aria-pressed={isSelected}
                            className={`relative aspect-square rounded-xl overflow-hidden transition-all duration-150
                                ${isSelected
                                    ? 'ring-2 ring-blue-500 bg-blue-500/20'
                                    : 'bg-slate-200 opacity-80 hover:bg-slate-300 hover:opacity-100 dark:bg-slate-700 dark:hover:bg-slate-600'
                                }`}
                            title={template.name}
                        >
                            <div className="absolute inset-2 rounded-md bg-slate-400/60 dark:bg-slate-600/60">
                                {template.slots.map((s) => (
                                    <div
                                        key={s.id}
                                        className={`absolute rounded-[2px] ${isSelected ? 'bg-blue-400' : 'bg-slate-500 dark:bg-slate-400'}`}
                                        style={{
                                            left: `${s.x}%`,
                                            top: `${s.y}%`,
                                            width: `${Math.max(s.width - 4, 2)}%`,
                                            height: `${Math.max(s.height - 4, 2)}%`,
                                        }}
                                    />
                                ))}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function AdjustTab({
    selectedSlot, edits, onUpdate, onReset, onArmSwap, onApplyFitAll, backgroundSelected = false,
}: {
    backgroundSelected?: boolean;
    selectedSlot: string | null;
    edits: PhotoEdits;
    onUpdate: (updates: Partial<PhotoEdits>) => void;
    onReset: () => void;
    onArmSwap: () => void;
    onApplyFitAll: (fitMode: PhotoEdits['fitMode']) => void;
}) {
    if (!selectedSlot) {
        return (
            <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Tap a photo above to start editing.
            </div>
        );
    }

    const PAN_STEP = 5;
    const SCALE_STEP = 0.1;
    const ROT_STEP = 90;

    return (
        <div className="px-4 py-3 space-y-4">
            <div>
                <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Photo fit</p>
                    {!backgroundSelected && <button
                        onClick={() => onApplyFitAll(edits.fitMode)}
                        className="text-xs font-medium text-blue-400 hover:text-blue-300"
                    >
                        Apply to all
                    </button>}
                </div>
                <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="group" aria-label="Photo fit">
                    {([
                        { id: 'cover' as const, label: 'Fill', detail: 'Fill the frame' },
                        { id: 'contain' as const, label: 'Fit', detail: 'Show full photo' },
                    ]).map((option) => (
                        <button
                            key={option.id}
                            onClick={() => onUpdate({ fitMode: option.id, scale: 1, offsetX: 0, offsetY: 0 })}
                            aria-pressed={edits.fitMode === option.id}
                            className={`rounded-lg px-3 py-2 text-left transition ${edits.fitMode === option.id ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-600 dark:text-white' : 'text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'}`}
                        >
                            <span className="block text-sm font-semibold">{option.label}</span>
                            <span className="block text-[10px]">{option.detail}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                <QuickButton onClick={() => onUpdate({ rotation: normalizeRotation(edits.rotation - ROT_STEP) })} icon={<RotateCcw className="w-4 h-4" />} label="Rotate L" />
                <QuickButton onClick={() => onUpdate({ rotation: normalizeRotation(edits.rotation + ROT_STEP) })} icon={<RotateCw className="w-4 h-4" />} label="Rotate R" />
                <QuickButton onClick={() => onUpdate({ scale: Math.min(3, edits.scale + SCALE_STEP) })} icon={<ZoomIn className="w-4 h-4" />} label="Zoom +" />
                <QuickButton onClick={() => onUpdate({ scale: Math.max(1, edits.scale - SCALE_STEP) })} icon={<ZoomOut className="w-4 h-4" />} label="Zoom −" />
                <QuickButton onClick={() => onUpdate({ offsetY: edits.offsetY - PAN_STEP })} icon={<ArrowUp className="w-4 h-4" />} label="Up" />
                <QuickButton onClick={() => onUpdate({ offsetY: edits.offsetY + PAN_STEP })} icon={<ArrowDown className="w-4 h-4" />} label="Down" />
                <QuickButton onClick={() => onUpdate({ offsetX: edits.offsetX - PAN_STEP })} icon={<ArrowLeftIcon className="w-4 h-4" />} label="Left" />
                <QuickButton onClick={() => onUpdate({ offsetX: edits.offsetX + PAN_STEP })} icon={<ArrowRightIcon className="w-4 h-4" />} label="Right" />
            </div>

            <SliderRow label="Rotation" value={edits.rotation} min={-180} max={180} step={1} unit="°" onChange={(v) => onUpdate({ rotation: v })} />
            <SliderRow label="Zoom" value={edits.scale} min={1} max={3} step={0.01} format={(v) => `${v.toFixed(2)}x`} onChange={(v) => onUpdate({ scale: v })} />
            <SliderRow label="Brightness" value={edits.brightness} min={0.5} max={1.5} step={0.01} format={(v) => v.toFixed(2)} onChange={(v) => onUpdate({ brightness: v })} />
            <SliderRow label="Contrast" value={edits.contrast} min={0.5} max={1.5} step={0.01} format={(v) => v.toFixed(2)} onChange={(v) => onUpdate({ contrast: v })} />
            <SliderRow label="Saturation" value={edits.saturation} min={0} max={2} step={0.01} format={(v) => v.toFixed(2)} onChange={(v) => onUpdate({ saturation: v })} />
            <SliderRow label="Blur" value={edits.blur} min={0} max={6} step={0.1} unit="px" onChange={(v) => onUpdate({ blur: v })} />

            <div className="flex gap-2">
                {!backgroundSelected && <button
                    onClick={onArmSwap}
                    className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-900 text-sm font-semibold flex items-center justify-center gap-2"
                >
                    <Repeat2 className="w-4 h-4" />
                    Swap…
                </button>}
                <button
                    onClick={onReset}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-200 py-2.5 text-sm font-medium hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600"
                >
                    <RotateCcw className="w-4 h-4" />
                    Reset
                </button>
            </div>
        </div>
    );
}

function QuickButton({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-1.5 rounded-full bg-slate-200 px-3 py-2 text-xs hover:bg-slate-300 active:bg-slate-400 dark:bg-slate-700 dark:hover:bg-slate-600 dark:active:bg-slate-500"
        >
            {icon}
            <span>{label}</span>
        </button>
    );
}

function SliderRow({
    label, value, min, max, step, unit, format, onChange,
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    unit?: string;
    format?: (v: number) => string;
    onChange: (v: number) => void;
}) {
    const display = format ? format(value) : `${Math.round(value)}${unit ?? ''}`;
    return (
        <div>
            <div className="flex justify-between items-baseline mb-1">
                <span className="text-xs text-slate-700 dark:text-slate-300">{label}</span>
                <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">{display}</span>
            </div>
            <input
                type="range"
                aria-label={label}
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="w-full accent-blue-500 h-6"
            />
        </div>
    );
}

function FiltersTab({
    selectedSlot, selectedPhoto, currentFilter, onPick, onApplyAll,
}: {
    selectedSlot: string | null;
    selectedPhoto: PhotoData | null;
    currentFilter: FilterId;
    onPick: (filter: FilterId) => void;
    onApplyAll?: (filter: FilterId) => void;
}) {
    if (!selectedSlot || !selectedPhoto) {
        return (
            <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Tap a photo above to apply a filter.
            </div>
        );
    }

    return (
        <div className="px-4 py-3">
            <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Filters</p>
                {onApplyAll && <button
                    onClick={() => onApplyAll(currentFilter)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold shadow-sm transition-colors"
                >
                    <Check className="w-4 h-4" />
                    Apply to all
                </button>}
            </div>
            <div className="grid grid-cols-4 gap-3">
                {FILTER_OPTIONS.map((opt) => {
                    const isSelected = opt.id === currentFilter;
                    const previewEdits: PhotoEdits = { ...DEFAULT_EDITS, filter: opt.id };
                    return (
                        <button
                            key={opt.id}
                            onClick={() => onPick(opt.id)}
                            aria-pressed={isSelected}
                            className={`group flex flex-col items-center gap-1 transition-transform ${isSelected ? 'scale-[1.04]' : ''}`}
                        >
                            <div className={`relative aspect-square w-full overflow-hidden rounded-lg bg-slate-200 dark:bg-slate-700
                                ${isSelected ? 'ring-2 ring-blue-500' : 'ring-1 ring-slate-300 group-hover:ring-slate-500 dark:ring-slate-700'}`}>
                                <div className="absolute inset-0" style={{ filter: editsToCssFilter(previewEdits) }}>
                                    <Image src={selectedPhoto.previewUrl} alt="" fill unoptimized className="object-cover" sizes="80px" />
                                </div>
                            </div>
                            <span className={`text-[11px] ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>{opt.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function FormatTab({
    activeRatio, onSelect, exportOptions, onUpdateExportOptions, comparisonLabels, onUpdateComparisonLabels,
}: {
    activeRatio: number | null;
    onSelect: (ratio: number | null) => void;
    exportOptions: ExportOptions;
    onUpdateExportOptions: (updates: Partial<ExportOptions>) => void;
    comparisonLabels: ComparisonLabels;
    onUpdateComparisonLabels: (updates: Partial<ComparisonLabels>) => void;
}) {
    return (
        <div className="space-y-6 px-4 py-3">
            <div>
                <p className="mb-3 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Aspect ratio</p>
                <div className="grid grid-cols-2 gap-2.5">
                    {ASPECT_PRESETS.map((preset) => {
                        const isSelected = (preset.ratio ?? null) === activeRatio ||
                            (preset.ratio !== null && activeRatio !== null && Math.abs(preset.ratio - activeRatio) < 0.001);
                        const r = preset.ratio ?? 1;
                        const boxW = r >= 1 ? 34 : 34 * r;
                        const boxH = r >= 1 ? 34 / r : 34;
                        return (
                            <button
                                key={preset.id}
                                onClick={() => onSelect(preset.ratio)}
                                aria-pressed={isSelected}
                                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all
                                    ${isSelected
                                        ? 'border-blue-500 bg-blue-500/15'
                                        : 'border-slate-300 bg-slate-100 hover:border-slate-500 dark:border-slate-700 dark:bg-slate-700/40'}`}
                            >
                                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center">
                                    <span
                                        className={`block rounded-[3px] ${isSelected ? 'bg-blue-400' : 'bg-slate-500 dark:bg-slate-400'}`}
                                        style={{ width: boxW, height: boxH }}
                                    />
                                </span>
                                <span className="min-w-0">
                                    <span className={`block text-sm font-semibold ${isSelected ? 'text-blue-600 dark:text-blue-300' : 'text-slate-800 dark:text-slate-200'}`}>{preset.label}</span>
                                    <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">{preset.platform}</span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Export</p>
                <div className="grid grid-cols-2 gap-2">
                    {(['jpeg', 'png'] as const).map((format) => (
                        <button
                            key={format}
                            onClick={() => onUpdateExportOptions({ format })}
                            aria-pressed={exportOptions.format === format}
                            className={`rounded-xl border px-3 py-2.5 text-sm font-semibold uppercase transition ${exportOptions.format === format ? 'border-blue-500 bg-blue-500/15 text-blue-600 dark:text-blue-300' : 'border-slate-300 bg-slate-100 text-slate-700 hover:border-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}
                        >
                            {format === 'jpeg' ? 'JPG' : 'PNG'}
                        </button>
                    ))}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label="Export width">
                    {[1080, 2000, 4000].map((width) => (
                        <button
                            key={width}
                            onClick={() => onUpdateExportOptions({ width })}
                            aria-pressed={exportOptions.width === width}
                            className={`rounded-xl border px-2 py-2 text-xs font-medium transition ${exportOptions.width === width ? 'border-blue-500 bg-blue-500/15 text-blue-600 dark:text-blue-300' : 'border-slate-300 text-slate-500 hover:border-slate-500 dark:border-slate-700 dark:text-slate-400'}`}
                        >
                            {width === 1080 ? '1080 px' : width === 2000 ? '2000 px' : '4K'}
                        </button>
                    ))}
                </div>
                <p className="mt-2 text-[11px] leading-4 text-slate-500 dark:text-slate-400">Longest edge of the final image. Higher resolutions use more memory.</p>
            </div>

            <div className="border-t border-slate-200 pt-5 dark:border-slate-700">
                <label className="flex cursor-pointer items-center justify-between gap-4">
                    <span>
                        <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">Comparison labels</span>
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400">Add labels to the first two photos</span>
                    </span>
                    <input
                        type="checkbox"
                        checked={comparisonLabels.enabled}
                        onChange={(event) => onUpdateComparisonLabels({ enabled: event.target.checked })}
                        className="h-5 w-5 accent-blue-500"
                    />
                </label>
                {comparisonLabels.enabled && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                        <label className="text-xs text-slate-500 dark:text-slate-400">
                            First photo
                            <input
                                value={comparisonLabels.left}
                                maxLength={24}
                                onChange={(event) => onUpdateComparisonLabels({ left: event.target.value })}
                                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            />
                        </label>
                        <label className="text-xs text-slate-500 dark:text-slate-400">
                            Second photo
                            <input
                                value={comparisonLabels.right}
                                maxLength={24}
                                onChange={(event) => onUpdateComparisonLabels({ right: event.target.value })}
                                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            />
                        </label>
                    </div>
                )}
            </div>
        </div>
    );
}

function StyleTab({
    style, onUpdate,
}: {
    style: CollageStyle;
    onUpdate: (updates: Partial<CollageStyle>) => void;
}) {
    return (
        <div className="px-4 py-3 space-y-5">
            <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Background</p>
                <div className="flex gap-2 flex-wrap">
                    {BACKGROUND_PRESETS.map((preset) => {
                        const isSelected = style.background.toLowerCase() === preset.value.toLowerCase();
                        return (
                            <button
                                key={preset.value}
                                onClick={() => onUpdate({ background: preset.value })}
                                aria-label={`${preset.name} background`}
                                aria-pressed={isSelected}
                                className={`relative w-9 h-9 rounded-full border-2 transition-all
                                    ${isSelected ? 'scale-110 border-blue-500' : 'border-slate-300 hover:border-slate-500 dark:border-slate-600 dark:hover:border-slate-400'}`}
                                style={{ background: preset.value }}
                                title={preset.name}
                            >
                                {isSelected && (
                                    <Check className="w-4 h-4 absolute inset-0 m-auto" style={{ color: isLight(preset.value) ? '#000' : '#fff' }} />
                                )}
                            </button>
                        );
                    })}
                    <label className="relative flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-slate-400 hover:border-slate-600 dark:border-slate-500 dark:hover:border-slate-300">
                        <input
                            type="color"
                            aria-label="Custom background color"
                            value={style.background}
                            onChange={(e) => onUpdate({ background: e.target.value })}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        <Palette className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                    </label>
                </div>
            </div>

            <SliderRow label="Photo gap" value={style.gap} min={0} max={24} step={1} unit="px" onChange={(v) => onUpdate({ gap: v })} />
            <SliderRow label="Corner radius" value={style.cornerRadius} min={0} max={32} step={1} unit="px" onChange={(v) => onUpdate({ cornerRadius: v })} />
            <SliderRow label="Outer padding" value={style.padding} min={0} max={40} step={1} unit="px" onChange={(v) => onUpdate({ padding: v })} />

            <button
                onClick={() => onUpdate({ background: '#ffffff', gap: 6, cornerRadius: 4, padding: 0 })}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-200 py-2.5 text-sm font-medium hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
                <X className="w-4 h-4" />
                Reset style
            </button>
        </div>
    );
}

function isLight(hex: string): boolean {
    const m = hex.replace('#', '');
    if (m.length < 6) return true;
    const r = parseInt(m.slice(0, 2), 16);
    const g = parseInt(m.slice(2, 4), 16);
    const b = parseInt(m.slice(4, 6), 16);
    const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luma > 0.6;
}
