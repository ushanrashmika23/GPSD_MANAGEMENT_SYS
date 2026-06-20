import { useMemo, useRef, useState } from "react";
import { AlertTriangle, ScanLine, Sparkles, Zap } from "lucide-react";
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
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const startedAt = audioContext.currentTime;

    oscillator.type = "sine";
    oscillator.frequency.value = 880;

    gain.gain.setValueAtTime(0.0001, startedAt);
    gain.gain.exponentialRampToValueAtTime(0.16, startedAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startedAt + 0.18);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(startedAt);
    oscillator.stop(startedAt + 0.22);

    oscillator.onended = () => {
        void audioContext.close();
    };
}

export function QrScanner({ active, onScan, className }: QrScannerProps) {
    const [flashKey, setFlashKey] = useState(0);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const lastScanRef = useRef<{ value: string; ts: number }>({ value: "", ts: 0 });

    const constraints = useMemo<MediaStreamConstraints>(
        () => ({
            video: {
                facingMode: { ideal: "environment" },
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
        if (previous.value === normalized && now - previous.ts < 1200) return;

        lastScanRef.current = { value: normalized, ts: now };
        setFlashKey(now);
        playBeep();
        onScan(normalized);
    };

    const { ref } = useZxing({
        paused: !active,
        constraints,
        formats,
        timeBetweenDecodingAttempts: 140,
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
				@keyframes scan-line {
					0% { transform: translateY(-110%); opacity: 0; }
					12% { opacity: 1; }
					50% { opacity: 1; }
					100% { transform: translateY(110%); opacity: 0; }
				}

				@keyframes scan-flash {
					0% { opacity: 0; }
					12% { opacity: 1; }
					100% { opacity: 0; }
				}
			`}</style>

            <div className="relative overflow-hidden rounded-2xl border border-emerald-200/70 bg-slate-950 shadow-[0_18px_60px_rgba(15,23,42,0.24)]">
                <div className="relative aspect-[4/3] sm:aspect-video">
                    <video
                        ref={ref}
                        muted
                        autoPlay
                        playsInline
                        onCanPlay={() => setReady(true)}
                        className={cn(
                            "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
                            active ? "opacity-100" : "opacity-70"
                        )}
                    />

                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.14),transparent_42%),linear-gradient(to_bottom,rgba(2,6,23,0.1),rgba(2,6,23,0.55))]" />
                    <div className="absolute inset-0 border border-white/10" />

                    {active && (
                        <div className="absolute inset-0 bg-emerald-400/8 animate-pulse" />
                    )}

                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="absolute right-3 top-3 flex items-center gap-2 rounded-full bg-black/45 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                            <span className="live-rec-dot" />	Live
                        </div>
                        <div className="relative h-[min(72vw,16rem)] w-[min(72vw,16rem)] rounded-3xl border border-white/25 bg-transparent shadow-[0_0_0_9999px_rgba(2,6,23,0.18)]">
                            <div className="absolute left-0 top-0 h-8 w-8 rounded-tl-3xl border-l-4 border-t-4 border-emerald-300" />
                            <div className="absolute right-0 top-0 h-8 w-8 rounded-tr-3xl border-r-4 border-t-4 border-emerald-300" />
                            <div className="absolute left-0 bottom-0 h-8 w-8 rounded-bl-3xl border-b-4 border-l-4 border-emerald-300" />
                            <div className="absolute right-0 bottom-0 h-8 w-8 rounded-br-3xl border-b-4 border-r-4 border-emerald-300" />

                            <div
                                className="absolute inset-x-5 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent via-emerald-300 to-transparent"
                                style={{ animation: active ? "scan-line 2.1s linear infinite" : "none" }}
                            />

                            {/* <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 rounded-2xl border border-white/20 bg-slate-950/35 px-4 py-3 text-center backdrop-blur-sm">
								<div className="flex items-center gap-2 text-white">
									<ScanLine className="h-4 w-4 text-emerald-300" />
									<span className="text-sm font-semibold">Scan inside the frame</span>
								</div>
								<p className="text-[11px] leading-4 text-white/70">
									Keep the QR steady. The camera stays open after every read.
								</p>
							</div>

							<div className="absolute left-3 top-3 rounded-full bg-black/45 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
								{ready ? "Live camera" : "Starting camera"}
							</div> */}

                            {/* <div className="absolute right-3 top-3 flex items-center gap-2 rounded-full bg-black/45 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                                <span className="live-rec-dot" />	Live
                            </div> */}


                            {/* <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
								<div className="rounded-2xl bg-black/45 px-3 py-2 text-left backdrop-blur-sm">
									<div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/55">
										<Zap className="h-3.5 w-3.5 text-emerald-300" />
										Active scan
									</div>
									<p className="mt-1 text-xs text-white/85">Beep feedback plays on every valid scan.</p>
								</div>

								<div className="rounded-2xl bg-black/45 px-3 py-2 backdrop-blur-sm">
									<div className="flex items-center gap-2 text-xs text-white/85">
										<Sparkles className="h-3.5 w-3.5 text-emerald-300" />
										Camera stays open
									</div>
								</div>
							</div> */}

                            {flashKey > 0 && (
                                <div
                                    key={flashKey}
                                    className="absolute inset-0 bg-emerald-300/25"
                                    style={{ animation: "scan-flash 420ms ease-out" }}
                                />
                            )}
                        </div>
                    </div>

                    {error && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 px-4 text-center backdrop-blur-sm">
                            <div className="max-w-sm rounded-2xl border border-red-200/50 bg-white/95 p-4 text-slate-900 shadow-xl">
                                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                                    <AlertTriangle className="h-5 w-5" />
                                </div>
                                <h3 className="text-sm font-semibold">Camera unavailable</h3>
                                <p className="mt-1 text-sm text-slate-600">{error}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
