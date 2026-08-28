"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Cpu,
  AlertTriangle,
  Zap,
  Loader2,
  Maximize,
} from "lucide-react";

export default function AiVisionDiagnostics({
  onClose,
}: {
  machineId: string;
  onClose: () => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Simulate camera feed
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "environment" } })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(() =>
          console.warn(
            "Camera access denied/unavailable, using simulation mode.",
          ),
        );
    }
  }, []);

  const triggerGeminiAnalysis = () => {
    setScanning(true);
    // Simulating a call to the Gemini Omni-Flash / Live API
    setTimeout(() => {
      setScanning(false);
      setAnalysis({
        diagnosis: "Thermal degradation detected on Spindle Bearing B-402.",
        confidence: 98.4,
        action: "Recommend immediate swap. Estimated downtime: 45 mins.",
        partRequired: "SKF-7014-CE/HCP4A",
      });
    }, 3500);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-[0_0_80px_rgba(59,130,246,0.15)] flex flex-col md:flex-row">
        {/* Left: Camera Feed */}
        <div className="relative flex-1 bg-black min-h-[400px]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover opacity-60"
          />
          {/* Overlay UI */}
          <div className="absolute inset-0 border-[6px] border-black/20 pointer-events-none" />
          <div className="absolute top-6 left-6 right-6 flex justify-between items-start pointer-events-none">
            <div className="bg-black/50 backdrop-blur px-3 py-1.5 rounded-lg border border-white/10 text-white font-mono text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              LIVE FEED
            </div>
            <div className="bg-blue-500/20 backdrop-blur px-3 py-1.5 rounded-lg border border-blue-500/30 text-blue-300 font-mono text-xs flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5" />
              GEMINI OMNI-FLASH
            </div>
          </div>

          {/* Scanner Reticle */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className={`w-48 h-48 border-2 ${scanning ? "border-blue-400 animate-pulse" : "border-white/30"} rounded-2xl relative transition-colors`}
            >
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-blue-500" />
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-blue-500" />
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-blue-500" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-blue-500" />

              {scanning && (
                <motion.div
                  initial={{ top: 0 }}
                  animate={{ top: "100%" }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  className="absolute left-0 right-0 h-0.5 bg-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.8)]"
                />
              )}
            </div>
          </div>
        </div>

        {/* Right: AI Analysis Panel */}
        <div className="w-full md:w-96 bg-slate-900 border-l border-slate-800 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black text-white flex items-center gap-2">
              <Camera className="w-5 h-5 text-blue-400" />
              Vision AI
            </h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <Maximize className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            {!analysis && !scanning && (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-slate-800 mx-auto flex items-center justify-center border border-slate-700">
                  <Camera className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-sm text-slate-400">
                  Point the camera at the machine fault and initiate Gemini
                  Vision analysis.
                </p>
                <button
                  onClick={triggerGeminiAnalysis}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4" /> Analyze Fault
                </button>
              </div>
            )}

            {scanning && (
              <div className="text-center space-y-4">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto" />
                <p className="text-sm font-bold text-blue-400 animate-pulse uppercase tracking-widest">
                  Processing Frames...
                </p>
                <p className="text-xs text-slate-500 font-mono">
                  Model: gemini-1.5-pro-vision
                </p>
              </div>
            )}

            <AnimatePresence>
              {analysis && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                      <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                        Fault Detected
                      </span>
                    </div>
                    <p className="text-white text-sm font-medium leading-relaxed">
                      {analysis.diagnosis}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-slate-800 border border-slate-700">
                      <span className="block text-[10px] text-slate-400 uppercase">
                        Confidence
                      </span>
                      <span className="block text-lg font-mono font-bold text-emerald-400">
                        {analysis.confidence}%
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-800 border border-slate-700">
                      <span className="block text-[10px] text-slate-400 uppercase">
                        Part Match
                      </span>
                      <span className="block text-xs font-mono font-bold text-white mt-1">
                        {analysis.partRequired}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800 space-y-3">
                    <button className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-lg shadow-rose-600/20 transition-all flex items-center justify-center gap-2">
                      <Wrench className="w-4 h-4" /> Generate Job Card
                    </button>
                    <button
                      onClick={() => setAnalysis(null)}
                      className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all"
                    >
                      Scan Again
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

// Missing Wrench import for the button
import { Wrench } from "lucide-react";
