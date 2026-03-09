import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, Scan, AlertCircle, Sprout, Info, Settings, History, MapPin, Loader2, X, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { detectMushrooms, type DetectionResult } from './services/gemini';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [hasCameraAccess, setHasCameraAccess] = useState<boolean | null>(null);
  const [lastDetection, setLastDetection] = useState<DetectionResult | null>(null);
  const [history, setHistory] = useState<(DetectionResult & { id: string; timestamp: number })[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start camera
  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' },
          audio: false 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setHasCameraAccess(true);
        }
      } catch (err) {
        console.error("Camera access error:", err);
        setHasCameraAccess(false);
        setError("Camera access denied. Please enable camera permissions to use MycoVision.");
      }
    }
    startCamera();

    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
  }, []);

  const runDetection = useCallback(async () => {
    if (isProcessing || !isScanning) return;
    
    const frame = captureFrame();
    if (!frame) return;

    setIsProcessing(true);
    try {
      const result = await detectMushrooms(frame);
      if (result.found) {
        setLastDetection(result);
        setHistory(prev => [{ ...result, id: Math.random().toString(36).substr(2, 9), timestamp: Date.now() }, ...prev].slice(0, 10));
        
        // Play alert sound if found (optional, but good for UX)
        try {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audio.volume = 0.3;
          audio.play();
        } catch (e) { /* ignore audio errors */ }
      }
    } catch (err) {
      console.error("Detection loop error:", err);
    } finally {
      setIsProcessing(false);
    }
  }, [isScanning, isProcessing, captureFrame]);

  // Detection Loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isScanning) {
      interval = setInterval(runDetection, 3000); // Scan every 3 seconds
    }
    return () => clearInterval(interval);
  }, [isScanning, runDetection]);

  const toggleScanning = () => {
    setIsScanning(!isScanning);
    if (!isScanning) {
      setLastDetection(null);
    }
  };

  if (hasCameraAccess === false) {
    return (
      <div className="min-h-screen bg-[#151619] flex items-center justify-center p-6 text-white font-mono">
        <div className="max-w-md w-full bg-[#1c1d21] border border-red-500/30 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
          <h1 className="text-2xl font-bold tracking-tight">CAMERA ACCESS REQUIRED</h1>
          <p className="text-[#8E9299] leading-relaxed">
            MycoVision requires access to your camera to scan for mushrooms in real-time. 
            Please check your browser settings and refresh the page.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-4 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-all active:scale-95"
          >
            REFRESH PERMISSIONS
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-emerald-500/30 overflow-hidden flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-white/5 bg-black/50 backdrop-blur-xl flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.4)]">
            <Sprout className="w-5 h-5 text-black" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-widest uppercase">MycoVision</h1>
            <div className="flex items-center gap-1.5">
              <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", isScanning ? "bg-emerald-500" : "bg-red-500")} />
              <span className="text-[10px] text-white/40 uppercase tracking-tighter font-mono">
                {isScanning ? "System Active" : "System Standby"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <History className="w-5 h-5 text-white/60" />
          </button>
          <button className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <Settings className="w-5 h-5 text-white/60" />
          </button>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden flex flex-col md:flex-row">
        {/* Camera Viewport */}
        <div className="flex-1 relative bg-black overflow-hidden">
          <video 
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover opacity-80"
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* HUD Overlays */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Corners */}
            <div className="absolute top-8 left-8 w-12 h-12 border-t-2 border-l-2 border-white/20" />
            <div className="absolute top-8 right-8 w-12 h-12 border-t-2 border-r-2 border-white/20" />
            <div className="absolute bottom-8 left-8 w-12 h-12 border-b-2 border-l-2 border-white/20" />
            <div className="absolute bottom-8 right-8 w-12 h-12 border-b-2 border-r-2 border-white/20" />

            {/* Scanning Line */}
            <AnimatePresence>
              {isScanning && (
                <motion.div 
                  initial={{ top: '0%' }}
                  animate={{ top: '100%' }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  className="absolute left-0 right-0 h-px bg-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.8)] z-10"
                />
              )}
            </AnimatePresence>

            {/* Processing Indicator */}
            <AnimatePresence>
              {isProcessing && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-12 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full flex items-center gap-2"
                >
                  <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                  <span className="text-xs font-mono uppercase tracking-widest">Analyzing Frame...</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Detection Alert */}
          <AnimatePresence>
            {lastDetection && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="absolute bottom-24 left-6 right-6 md:left-auto md:right-8 md:w-80 bg-emerald-500 text-black p-5 rounded-2xl shadow-[0_20px_50px_rgba(16,185,129,0.3)] z-40"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-6 h-6" />
                    <span className="font-black uppercase tracking-tighter text-lg">Mushroom Spotted!</span>
                  </div>
                  <button onClick={() => setLastDetection(null)} className="p-1 hover:bg-black/10 rounded-full">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-bold uppercase opacity-60">Species</span>
                    <span className="font-bold">{lastDetection.name}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-bold uppercase opacity-60">Location</span>
                    <span className="font-bold">{lastDetection.location}</span>
                  </div>
                  <div className="pt-2 border-t border-black/10 mt-2">
                    <p className="text-[11px] font-medium leading-tight">
                      {lastDetection.edibility}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar / Controls */}
        <div className="w-full md:w-96 bg-[#0f0f0f] border-l border-white/5 p-6 flex flex-col gap-6">
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">Control Unit</h2>
            <button 
              onClick={toggleScanning}
              className={cn(
                "w-full py-6 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all active:scale-[0.98]",
                isScanning 
                  ? "bg-red-500/10 border border-red-500/50 text-red-500 shadow-[0_0_30px_rgba(239,68,68,0.1)]" 
                  : "bg-emerald-500 text-black shadow-[0_0_30px_rgba(16,185,129,0.2)]"
              )}
            >
              {isScanning ? <X className="w-8 h-8" /> : <Scan className="w-8 h-8" />}
              <span className="font-black uppercase tracking-widest text-sm">
                {isScanning ? "Stop Scanner" : "Start Hunting"}
              </span>
            </button>
          </div>

          <div className="flex-1 flex flex-col gap-4 min-h-0">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">Recent Findings</h2>
              <span className="text-[10px] font-mono text-white/20">{history.length} Total</span>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
              {history.length === 0 ? (
                <div className="h-32 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-white/20 gap-2">
                  <Sprout className="w-6 h-6" />
                  <span className="text-[10px] uppercase tracking-widest">No history yet</span>
                </div>
              ) : (
                history.map((item) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={item.id}
                    className="p-4 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer group"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-sm group-hover:text-emerald-400 transition-colors">{item.name}</span>
                      <span className="text-[10px] font-mono text-white/30">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-white/50 uppercase tracking-wider">
                      <MapPin className="w-3 h-3" />
                      <span>{item.location}</span>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-emerald-500">
              <Info className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Safety Protocol</span>
            </div>
            <p className="text-[10px] text-white/40 leading-relaxed italic">
              AI identification is for informational purposes only. Never consume wild mushrooms based on AI detection. Always consult a professional mycologist.
            </p>
          </div>
        </div>
      </main>

      {/* Mobile Nav / Status Bar */}
      <footer className="h-12 bg-black border-t border-white/5 flex items-center justify-between px-6 md:hidden">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-mono text-white/40 uppercase">GPS: Locked</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-mono text-white/40 uppercase">AI: Ready</span>
          </div>
        </div>
        <span className="text-[10px] font-mono text-white/20 uppercase">v1.0.4-stable</span>
      </footer>
    </div>
  );
}

