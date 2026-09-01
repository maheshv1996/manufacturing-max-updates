"use client";

import { useState, useEffect } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { soundFx } from "@/lib/soundFx";

export default function SoundToggle() {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setMuted(soundFx.isMuted());
  }, []);

  const handleToggle = () => {
    const nextMuted = soundFx.toggleMute();
    setMuted(nextMuted);
    if (!nextMuted) {
      soundFx.playSuccess();
    }
  };

  return (
    <button
      onClick={handleToggle}
      className="p-1.5 text-text-2 hover:text-cyan-400 hover:bg-surface-3 rounded-control transition-colors cursor-pointer"
      title={muted ? "Sound Effects Muted (Click to Enable)" : "Sound Effects Active (Click to Mute)"}
      aria-label="Toggle Industrial Audio Feedback"
    >
      {muted ? (
        <VolumeX className="w-4 h-4 text-slate-500" />
      ) : (
        <Volume2 className="w-4 h-4 text-cyan-400" />
      )}
    </button>
  );
}
