'use client';

import Image from 'next/image';
import { ArrowUpRight, ImagePlus, Loader2, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import type { PhotoData } from '@/types/photo';
import { BACKGROUND_PRESETS, type CollageStyle } from '@/utils/photoEdits';

export function InspectorSection({ title, description, action, children }: {
    title: string; description?: string; action?: ReactNode; children: ReactNode;
}) {
    return <section className="inspector-section">
        <div className="inspector-section-heading">
            <div><h3>{title}</h3>{description && <p>{description}</p>}</div>
            {action}
        </div>
        {children}
    </section>;
}

export function SliderRow({ label, value, min, max, step, unit, format, onChange }: {
    label: string; value: number; min: number; max: number; step: number; unit?: string;
    format?: (value: number) => string; onChange: (value: number) => void;
}) {
    const precision = step < 1 ? (String(step).split('.')[1]?.length ?? 0) : 0;
    return <div className="inspector-slider">
        <div className="inspector-slider-heading">
            <span>{label}</span>
            <div className="inspector-number">
                <input key={value} type="number" aria-label={`${label} value`} min={min} max={max} step={step}
                    defaultValue={Number(value.toFixed(precision))}
                    onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                    onBlur={(event) => {
                        const parsed = Number(event.target.value);
                        const next = event.target.value.trim() && Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : value;
                        event.target.value = String(next);
                        onChange(Number(next.toFixed(precision)));
                    }} />
                <span aria-hidden="true">{unit ?? (format ? '×' : '')}</span>
            </div>
        </div>
        <input type="range" aria-label={label} min={min} max={max} step={step} value={value}
            aria-valuetext={format ? format(value) : `${value}${unit ?? ''}`}
            style={{ '--range-progress': `${((value - min) / (max - min)) * 100}%` } as CSSProperties}
            onChange={(event) => onChange(Number(event.target.value))} />
    </div>;
}

export function LayerPicker({ layers, active, onSelect }: {
    layers: { id: string; label: string; photo: PhotoData | null }[];
    active: string | null; onSelect: (id: string) => void;
}) {
    const listRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const list = listRef.current;
        const selected = list?.querySelector('[aria-pressed="true"]');
        if (!list || !selected) return;
        const bounds = list.getBoundingClientRect();
        const item = selected.getBoundingClientRect();
        if (item.left < bounds.left) list.scrollLeft -= bounds.left - item.left;
        else if (item.right > bounds.right) list.scrollLeft += item.right - bounds.right;
    }, [active]);
    return <div className="inspector-layers" role="group" aria-label="Edit layer">
        <div className="inspector-eyebrow">Selected layer</div>
        <div ref={listRef} className="inspector-layer-list">
            {layers.map((layer) => <button key={layer.id} type="button" aria-pressed={active === layer.id}
                aria-label={`Edit ${layer.label.toLowerCase()}`} onClick={() => onSelect(layer.id)} className="inspector-layer">
                <span className="inspector-layer-thumb">{layer.photo && <Image src={layer.photo.previewUrl} alt="" fill unoptimized sizes="28px" className="object-cover" />}</span>
                <span>{layer.label}</span>
            </button>)}
        </div>
    </div>;
}

export function StyleInspector({ style, onUpdate, busy, error, onUpload, onEditBackground, onRemoveBackground }: {
    style: CollageStyle; onUpdate: (updates: Partial<CollageStyle>) => void; busy: boolean;
    error: string | null; onUpload: () => void; onEditBackground: () => void; onRemoveBackground: () => void;
}) {
    const background = style.backgroundImage;
    return <div className="inspector-stack">
        <InspectorSection title="Background" description="The canvas behind your photos">
            {background ? <div className="inspector-image-card">
                <div className="inspector-image-summary">
                    <span className="inspector-background-thumb"><Image src={background.photo.previewUrl} alt="Background preview" fill unoptimized sizes="44px" className="object-cover" /></span>
                    <div className="min-w-0 flex-1"><p className="inspector-card-title">Image background</p><p className="inspector-card-detail">{background.edits.fitMode === 'contain' ? 'Fit to canvas' : 'Fill canvas'}</p></div>
                    <button className="inspector-icon-button" disabled={busy} onClick={onUpload} aria-label="Replace background image" title="Replace image">{busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}</button>
                    <button className="inspector-icon-button inspector-danger" disabled={busy} onClick={onRemoveBackground} aria-label="Remove background image" title="Remove image"><Trash2 /></button>
                </div>
                <button className="inspector-edit-background" onClick={onEditBackground}>Adjust background <ArrowUpRight size={14} /></button>
            </div> : <button className="inspector-upload" disabled={busy} onClick={onUpload} aria-label="Add background image">
                <span className="inspector-upload-icon">{busy ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}</span>
                <span><strong>{busy ? 'Opening image…' : 'Add an image'}</strong><small>Choose a background from your device</small></span>
                <span className="inspector-upload-plus">+</span>
            </button>}
            {error && <p role="alert" className="mt-2 text-xs text-red-500">{error}</p>}
            <div className="inspector-color-heading"><span>{background ? 'Base color' : 'Canvas color'}</span><label className="inspector-color-value"><input type="color" aria-label="Custom background color" value={style.background} onChange={(event) => onUpdate({ background: event.target.value })} /><span>{style.background.toUpperCase()}</span></label></div>
            <div className="inspector-swatches" role="group" aria-label="Canvas colors">
                {BACKGROUND_PRESETS.map((preset) => <button key={preset.value} type="button" title={preset.name} aria-label={`${preset.name} background`}
                    aria-pressed={style.background.toLowerCase() === preset.value.toLowerCase()} onClick={() => onUpdate({ background: preset.value })}>
                    <span style={{ background: preset.value }} />
                </button>)}
            </div>
        </InspectorSection>
        <InspectorSection title="Spacing & shape" description="Give your composition room to breathe">
            <SliderRow label="Photo gap" value={style.gap} min={0} max={24} step={1} unit="px" onChange={(gap) => onUpdate({ gap })} />
            <SliderRow label="Corner radius" value={style.cornerRadius} min={0} max={32} step={1} unit="px" onChange={(cornerRadius) => onUpdate({ cornerRadius })} />
            <SliderRow label="Outer padding" value={style.padding} min={0} max={40} step={1} unit="px" onChange={(padding) => onUpdate({ padding })} />
        </InspectorSection>
        <div className="inspector-footer"><button className="inspector-text-button" onClick={() => onUpdate({ background: '#ffffff', gap: 6, cornerRadius: 4, padding: 0 })}><RotateCcw size={13} /> Reset style</button></div>
    </div>;
}
