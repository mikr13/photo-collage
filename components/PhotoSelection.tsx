'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ImagePlus, Loader2, Plus, Sparkles, X } from 'lucide-react';

import { PhotoData } from '@/types/photo';
import ThemeToggle from '@/components/ThemeToggle';

interface PhotoSelectionProps {
    photos: PhotoData[];
    maxPhotos: number;
    onAddPhotos: () => void;
    onDropPhotos: (files: File[]) => void;
    onRemovePhoto: (index: number) => void;
    onGroupIt: () => void;
    onBack: () => void;
    isProcessing?: boolean;
    processingProgress?: { current: number; total: number };
    importNotice?: string | null;
}

export default function PhotoSelection({
    photos,
    maxPhotos,
    onAddPhotos,
    onDropPhotos,
    onRemovePhoto,
    onGroupIt,
    onBack,
    isProcessing = false,
    processingProgress = { current: 0, total: 0 },
    importNotice = null,
}: PhotoSelectionProps) {
    const [isDragging, setIsDragging] = useState(false);
    const canAddMore = photos.length < maxPhotos;
    const canGroupIt = photos.length >= 2;

    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragging(false);
        if (!canAddMore || isProcessing) return;
        const files = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith('image/'));
        if (files.length) onDropPhotos(files);
    };

    return (
        <main
            className="relative flex min-h-dvh flex-col bg-[#f7f8fb] text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-50"
            onDragEnter={(event) => { event.preventDefault(); if (canAddMore) setIsDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false);
            }}
            onDrop={handleDrop}
        >
            {isProcessing && (
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-slate-950/70 backdrop-blur-sm" role="status" aria-live="polite">
                    <Loader2 className="h-10 w-10 animate-spin text-white" />
                    <div className="text-center">
                        <p className="text-base font-semibold text-white">Preparing your photos</p>
                        <p className="mt-1 text-sm text-slate-300">
                            {processingProgress.current} of {processingProgress.total}
                        </p>
                    </div>
                </div>
            )}

            {isDragging && (
                <div className="pointer-events-none fixed inset-3 z-40 flex items-center justify-center rounded-[2rem] border-2 border-dashed border-indigo-500 bg-indigo-50/95 backdrop-blur-sm dark:bg-slate-900/95">
                    <div className="text-center text-indigo-700 dark:text-indigo-300">
                        <ImagePlus className="mx-auto h-10 w-10" />
                        <p className="mt-3 font-semibold">Drop photos to add them</p>
                    </div>
                </div>
            )}

            <header inert={isProcessing ? true : undefined} className="border-b border-slate-200/80 bg-white/80 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80">
                <div className="app-bar mx-auto flex w-full max-w-5xl items-center">
                    <button onClick={onBack} aria-label="Back to home" className="-ml-2 rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white">
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div className="ml-2 flex-1">
                        <h1 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">Choose your photos</h1>
                        <p className="hidden text-xs text-slate-500 sm:block dark:text-slate-400">Pick the moments you want in one frame</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {photos.length} / {maxPhotos}
                        </span>
                        <ThemeToggle />
                    </div>
                </div>
            </header>

            <section inert={isProcessing ? true : undefined} className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10">
                <div className="mb-6">
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Build your set</h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Add 2 to {maxPhotos} photos. You can adjust each crop in the next step.</p>
                </div>

                {importNotice && (
                    <p className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:bg-amber-400/10 dark:text-amber-200" role="alert">
                        {importNotice}
                    </p>
                )}

                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-4 md:grid-cols-5">
                    {photos.map((photo, index) => (
                        <div key={photo.previewUrl} className="group relative aspect-square overflow-hidden rounded-2xl bg-slate-200 shadow-sm ring-1 ring-slate-900/5 dark:bg-slate-800 dark:ring-white/10">
                            <Image src={photo.previewUrl} alt={`Selected photo ${index + 1}`} fill unoptimized className="object-cover" sizes="(max-width: 640px) 33vw, 180px" />
                            <button
                                onClick={() => onRemovePhoto(index)}
                                aria-label={`Remove photo ${index + 1}`}
                                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-950/65 text-white backdrop-blur-sm transition hover:bg-red-500"
                            >
                                <X className="h-4 w-4" />
                            </button>
                            <span className="absolute bottom-2 left-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-950/65 px-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                                {index + 1}
                            </span>
                        </div>
                    ))}

                    {canAddMore && (
                        <button
                            onClick={onAddPhotos}
                            aria-label="Add photos"
                            className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white/50 text-slate-500 transition hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400 dark:hover:border-indigo-400 dark:hover:bg-indigo-400/10 dark:hover:text-indigo-300"
                        >
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                                <Plus className="h-5 w-5" />
                            </span>
                            <span className="text-xs font-semibold">Add photos</span>
                        </button>
                    )}
                </div>

                {photos.length === 0 && (
                    <button
                        onClick={onAddPhotos}
                        className="mt-3 flex min-h-64 w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-300 bg-white/60 px-6 text-center transition hover:border-indigo-400 hover:bg-indigo-50/70 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-indigo-400 dark:hover:bg-indigo-400/10"
                    >
                        <ImagePlus className="h-9 w-9 text-indigo-500" />
                        <span className="mt-4 text-base font-semibold text-slate-800 dark:text-slate-200">Choose photos or drop them here</span>
                        <span className="mt-1 text-sm text-slate-500 dark:text-slate-400">JPG, PNG, WebP, and other browser-supported images</span>
                    </button>
                )}

                {photos.length === 1 && (
                    <p className="mt-5 text-sm font-medium text-amber-700 dark:text-amber-300" role="status">Add one more photo to continue.</p>
                )}
            </section>

            <footer inert={isProcessing ? true : undefined} className="sticky bottom-0 border-t border-slate-200/80 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90">
                <div className="app-bar app-bar-safe-bottom mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
                    <p className="hidden text-sm text-slate-500 sm:block dark:text-slate-400">Your originals are never uploaded.</p>
                    <button
                        onClick={onGroupIt}
                        disabled={!canGroupIt}
                        className="ml-auto flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none sm:w-auto dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                    >
                        <Sparkles className="h-4 w-4" />
                        Create collage
                    </button>
                </div>
            </footer>
        </main>
    );
}
