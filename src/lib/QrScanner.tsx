import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Camera, Sparkles } from "lucide-react";
import { useZxing, type BarcodeFormat } from "react-zxing";
import { cn } from "./utils";

interface QrScannerProps {
    active: boolean;
    onScan: (value: string) => void;
    className?: string;
}

function playBeep() {
    const AudioContextCtor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const audioContext = new AudioContextCtor();
    const gain = audioContext.createGain();
    const startedAt = audioContext.currentTime;

    // Pleasant dual-tone chime
    const osc1 = audioContext.createOscillator();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(1200, startedAt);
    osc1.frequency.exponentialRampToValueAtTime(1600, startedAt + 0.06);

    const gain1 = audioContext.createGain();
    gain1.gain.setValueAtTime(0.0001, startedAt);
    gain1.gain.exponentialRampToValueAtTime(0.12, startedAt + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.0001, startedAt + 0.22);

    osc1.connect(gain1);
    gain1.connect(audioContext.destination);
    osc1.start(startedAt);
    osc1.stop(startedAt + 0.24);

    const osc2 = audioContext.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1800, startedAt + 0.06);
    osc2.frequency.exponentialRampToValueAtTime(2200, startedAt + 0.12);

    const gain2 = audioContext.createGain();
    gain2.gain.setValueAtTime(0.0001, startedAt + 0.06);
    gain2.gain.exponentialRampToValueAtTime(0.1, startedAt + 0.09);
    gain2.gain.exponentialRampToValueAtTime(0.0001, startedAt + 0.28);

    osc2.connect(gain2);
    gain2.connect(audioContext.destination);
    osc2.start(startedAt + 0.06);
    osc2.stop(startedAt + 0.3);

    osc1.onended = () => { void audioContext.close(); };
}

export function QrScanner({ active, onScan, className }: QrScannerProps) {
    const [flashKey, setFlashKey] = useState(0);
    const [particleKey, setParticleKey] = useState(0);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const lastScanRef = useRef<{ value: string; ts: number }>({ value: "", ts: 0 });

    const constraints = useMemo<MediaStreamConstraints>(
        () => ({
            video: {
                facingMode: { ideal: "environment" },
                width: { ideal: 1280 },
                height: { ideal: 720 },
            },
            audio: false,
        }),
        []
    );

    const formats = useMemo<BarcodeFormat[]>(() => ["qr_code"], []);

    const handleScan = (value: string) => {
        const normalized = value.trim();
        if (!normalized) return;

        const now = Date.now();
        const previous = lastScanRef.current;
        if (previous.value === normalized && now - previous.ts < 1500) return;

        lastScanRef.current = { value: normalized, ts: now };
        setFlashKey(now);
        setParticleKey(now);
        playBeep();
        onScan(normalized);
    };

    const { ref } = useZxing({
        paused: !active,
        constraints,
        formats,
        timeBetweenDecodingAttempts: 120,
        onDecodeResult(result) {
            handleScan(result.rawValue);
        },
        onError(err) {
            setError(err instanceof Error ? err.message : "Camera access failed");
        },
    });

    return (
        <div className={cn("w-full", className)}>
            <style>{`
                @keyframes qr-scan-line {
                    0%   { top: -4%; opacity: 0; }
                    10%  { opacity: 1; }
                    85%  { opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                }

                @keyframes qr-scan-flash {
                    0%   { opacity: 0; }
                    30%  { opacity: 0.5; }
                    100% { opacity: 0; }
                }

                @keyframes qr-pulse-ring {
                    0%   { transform: scale(1); opacity: 0.6; }
                    100% { transform: scale(1.4); opacity: 0; }
                }

                @keyframes qr-corner-breathe {
                    0%, 100% { border-color: rgb(110 231 183 / 0.5); }
                    50%      { border-color: rgb(110 231 183 / 1); }
                }

                @keyframes qr-particle-up {
                    0%   { transform: translateY(0) scale(1); opacity: 1; }
                    100% { transform: translateY(-60px) scale(0); opacity: 0; }
                }

                @keyframes qr-ripple-out {
                    0%   { transform: scale(0.3); opacity: 0.7; }
                    100% { transform: scale(2.5); opacity: 0; }
                }

                @keyframes qr-status-fade {
                    0%   { opacity: 0; transform: translateY(8px); }
                    100% { opacity: 1; transform: translateY(0); }
                }

                .live-rec-dot {
                    display: inline-block;
                    width: 7px;
                    height: 7px;
                    border-radius: 50%;
                    background: #ef4444;
                    box-shadow: 0 0 6px #ef4444, 0 0 12px #ef444466;
                    animation: qr-live-pulse 2s ease-in-out infinite;
                }

                @keyframes qr-live-pulse {
                    0%, 100% { opacity: 1; }
                    50%      { opacity: 0.3; }
                }
            `}</style>

            <div className="relative overflow-hidden rounded-2xl border border-emerald-200/30 bg-slate-950 shadow-[0_8px_40px_rgba(0,0,0,0.4),0_0_0_1px_rgba(16,185,129,0.08)_inset]">
                <div className="relative aspect-[4/3] sm:aspect-video">
                    {/* ── Video layer ──────────────────────────────────── */}
                    <video
                        ref={ref}
                        muted
                        autoPlay
                        playsInline
                        onCanPlay={() => setReady(true)}
                        className={cn(
                            "absolute inset-0 h-full w-full object-cover transition-all duration-500",
                            ready ? "opacity-100 scale-100" : "opacity-40 scale-105 blur-sm"
                        )}
                    />

                    {/* ── Vignette + tint overlay ─────────────────────── */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(2,6,23,0.55)_100%)]" />
                    <div className={cn(
                        "absolute inset-0 transition-opacity duration-700",
                        active ? "bg-emerald-400/[0.03]" : "bg-slate-950/30"
                    )} />

                    {/* ── Ready / camera-starting transition ──────────── */}
                    {!ready && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-4 text-white/70">
                                <div className="relative">
                                    <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                                        <Camera className="w-6 h-6 animate-pulse" />
                                    </div>
                                    <div
                                        className="absolute inset-0 rounded-2xl border border-white/20"
                                        style={{ animation: "qr-pulse-ring 1.8s ease-out infinite" }}
                                    />
                                </div>
                                <p className="text-sm font-medium">Starting camera…</p>
                            </div>
                        </div>
                    )}

                    {/* ── Scan frame ──────────────────────────────────── */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        {/* Live badge */}
                        {ready && (
                            <div
                                className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md border border-white/10"
                                style={{ animation: "qr-status-fade 0.5s ease-out" }}
                            >
                                <span className="live-rec-dot" />
                                Live
                            </div>
                        )}

                        {/* Scan frame container */}
                        <div className="relative h-[min(68vw,15rem)] w-[min(68vw,15rem)]">
                            {/* Outer glow ring */}
                            {active && (
                                <div
                                    className="absolute -inset-3 rounded-[2rem] border border-emerald-400/10"
                                    style={{ animation: "qr-pulse-ring 3s ease-out infinite" }}
                                />
                            )}

                            {/* Frame */}
                            <div className="relative h-full w-full rounded-3xl border border-white/20 bg-transparent shadow-[0_0_0_9999px_rgba(2,6,23,0.22)]">
                                {/* Corner brackets */}
                                <div
                                    className="absolute left-0 top-0 h-9 w-9 rounded-tl-3xl border-l-[3px] border-t-[3px] border-emerald-300"
                                    style={{ animation: active ? "qr-corner-breathe 2s ease-in-out infinite" : "none" }}
                                />
                                <div
                                    className="absolute right-0 top-0 h-9 w-9 rounded-tr-3xl border-r-[3px] border-t-[3px] border-emerald-300"
                                    style={{ animation: active ? "qr-corner-breathe 2s ease-in-out 0.5s infinite" : "none" }}
                                />
                                <div
                                    className="absolute bottom-0 left-0 h-9 w-9 rounded-bl-3xl border-b-[3px] border-l-[3px] border-emerald-300"
                                    style={{ animation: active ? "qr-corner-breathe 2s ease-in-out 1s infinite" : "none" }}
                                />
                                <div
                                    className="absolute bottom-0 right-0 h-9 w-9 rounded-br-3xl border-b-[3px] border-r-[3px] border-emerald-300"
                                    style={{ animation: active ? "qr-corner-breathe 2s ease-in-out 1.5s infinite" : "none" }}
                                />

                                {/* Scanning line */}
                                {active && (
                                    <div className="absolute inset-x-3 overflow-hidden" style={{ top: 0, bottom: 0 }}>
                                        <div
                                            className="absolute left-0 right-0 h-[2px]"
                                            style={{ animation: "qr-scan-line 2.4s ease-in-out infinite" }}
                                        >
                                            <div className="h-full w-full bg-gradient-to-r from-transparent via-emerald-300 to-transparent shadow-[0_0_18px_4px_rgba(110,231,183,0.5)]" />
                                        </div>
                                    </div>
                                )}

                                {/* Scan flash */}
                                {flashKey > 0 && (
                                    <div
                                        key={`flash-${flashKey}`}
                                        className="absolute inset-0 rounded-3xl bg-emerald-300/20"
                                        style={{ animation: "qr-scan-flash 500ms ease-out" }}
                                    />
                                )}

                                {/* Ripple on scan */}
                                {flashKey > 0 && (
                                    <div
                                        key={`ripple-${flashKey}`}
                                        className="absolute left-1/2 top-1/2 w-16 h-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-emerald-300/60"
                                        style={{ animation: "qr-ripple-out 0.8s ease-out forwards" }}
                                    />
                                )}

                                {/* Particle burst on scan */}
                                {particleKey > 0 && (
                                    <div key={`particles-${particleKey}`} className="absolute inset-0 pointer-events-none">
                                        {Array.from({ length: 8 }).map((_, i) => {
                                            const angle = (i / 8) * 360;
                                            const rad = (angle * Math.PI) / 180;
                                            const tx = Math.cos(rad) * 40;
                                            const ty = Math.sin(rad) * 40;
                                            return (
                                                <div
                                                    key={i}
                                                    className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full bg-emerald-300"
                                                    style={{
                                                        animation: "qr-particle-up 0.7s ease-out forwards",
                                                        animationDelay: `${i * 0.04}s`,
                                                        transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px))`,
                                                    }}
                                                />
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Bottom hint */}
                        {ready && active && (
                            <div
                                className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-full bg-black/45 px-4 py-2 text-xs text-white/80 backdrop-blur-md border border-white/10"
                                style={{ animation: "qr-status-fade 0.5s ease-out" }}
                            >
                                <Sparkles className="w-3 h-3 text-emerald-300" />
                                <span>Hold QR inside the frame</span>
                            </div>
                        )}
                    </div>

                    {/* ── Error overlay ────────────────────────────────── */}
                    {error && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/85 px-6 text-center backdrop-blur-sm z-20">
                            <div className="max-w-sm rounded-2xl border border-red-200/30 bg-white/95 p-6 text-slate-900 shadow-2xl">
                                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500 ring-1 ring-red-100">
                                    <AlertTriangle className="h-5 w-5" />
                                </div>
                                <h3 className="text-sm font-semibold text-slate-900">Camera unavailable</h3>
                                <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{error}</p>
                                <button
                                    onClick={() => setError(null)}
                                    className="mt-4 w-full rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
