import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, Shield, Trophy, Flame, Play, Bot, Smartphone, Eye } from 'lucide-react';
import { playFanfare } from '../utils/audio';

interface SplashProps {
  onEnter: () => void;
}

export default function Splash({ onEnter }: SplashProps) {
  const handleStart = () => {
    playFanfare();
    onEnter();
  };

  return (
    <div className="flex flex-col items-center justify-between h-full w-full bg-slate-950 p-6 text-white overflow-y-auto relative select-none">
      
      {/* Visual background grid accents */}
      <div className="absolute inset-0 retro-grid opacity-10 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/20 via-transparent to-red-950/20 pointer-events-none" />

      {/* Header Badge */}
      <div className="mt-4 text-center z-10 shrink-0">
        <div className="inline-flex items-center space-x-1 px-3 py-1 rounded-full bg-indigo-950/50 border border-indigo-500/30 text-indigo-400 font-mono text-[9px] uppercase tracking-widest animate-pulse">
          <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
          <span>Premium Official Launch</span>
        </div>
      </div>

      {/* HIGH FIDELITY CUSTOM LOGO */}
      <div className="flex-grow flex flex-col items-center justify-center py-6 z-10 w-full">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 100 }}
          className="relative w-44 h-44 flex items-center justify-center"
        >
          {/* Animated Background Neon Rings */}
          <div className="absolute inset-2 rounded-full border border-dashed border-red-500/20 animate-spin" style={{ animationDuration: '30s' }} />
          <div className="absolute inset-4 rounded-full border border-dashed border-emerald-500/20 animate-reverse-spin" style={{ animationDuration: '24s' }} />
          
          {/* Glowing Red Shield Ring (Left) */}
          <div className="absolute left-4 w-28 h-28 rounded-full bg-red-600/10 border-2 border-red-500/40 flex items-center justify-center glow-red animate-pulse">
            <span className="text-3xl filter drop-shadow">🥊</span>
          </div>

          {/* Glowing Green Slap Ring (Right) */}
          <div className="absolute right-4 w-28 h-28 rounded-full bg-emerald-600/10 border-2 border-emerald-400/40 flex items-center justify-center glow-green animate-pulse" style={{ animationDelay: '0.15s' }}>
            <span className="text-3xl filter drop-shadow">👋</span>
          </div>

          {/* Colliding shockwave glow center */}
          <div className="absolute w-12 h-12 rounded-full bg-amber-500/20 border border-amber-400/30 flex items-center justify-center glow-amber">
            <Flame className="w-6 h-6 text-amber-400 animate-bounce" />
          </div>

          {/* Tech decorative target lines */}
          <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-800/60" />
          <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-slate-800/60" />
        </motion.div>

        {/* LOGO TYPOGRAPHY */}
        <div className="text-center mt-3">
          <h1 className="text-5xl font-black tracking-tighter uppercase text-slate-100 flex flex-col leading-none">
            <span className="text-glow-red text-red-500 font-extrabold tracking-tight">SLAM</span>
            <span className="text-glow-green text-emerald-400 font-extrabold mt-1 text-4xl">& SLAP</span>
          </h1>
          <div className="h-0.5 w-24 bg-gradient-to-r from-red-500 to-emerald-400 mx-auto mt-2" />
        </div>
      </div>

      {/* GAME DETAILS PANEL */}
      <div className="w-full shrink-0 bg-slate-900/90 border border-slate-850 rounded-2xl p-4.5 mb-5 z-10 shadow-2xl shadow-black relative overflow-hidden max-w-sm">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/10 to-transparent pointer-events-none" />
        
        <h3 className="text-[11px] font-mono uppercase tracking-wider text-slate-400 text-center mb-3">
          ⚡ Battle Action features & rules ⚡
        </h3>
        
        <div className="space-y-2.5">
          {/* Feature 1 */}
          <div className="flex items-start space-x-2.5">
            <div className="p-1 bg-red-950/80 border border-red-800/30 rounded-lg shrink-0 text-red-400 mt-0.5">
              <Flame className="w-3.5 h-3.5" />
            </div>
            <div>
              <h4 className="text-[11px] font-bold text-slate-200 uppercase leading-snug">Face-Off Boxing Arena</h4>
              <p className="text-[10px] text-slate-400 leading-normal mt-0.5">
                Dynamic punches, timing guards, block stamina meters, and reactive dodge actions.
              </p>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="flex items-start space-x-2.5">
            <div className="p-1 bg-emerald-950/80 border border-emerald-800/30 rounded-lg shrink-0 text-emerald-400 mt-0.5">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <h4 className="text-[11px] font-bold text-slate-200 uppercase leading-snug">RG Slap Duel Timing</h4>
              <p className="text-[10px] text-slate-400 leading-normal mt-0.5">
                The classic hot hands action! Execute slaps, trigger fakes, and bait fast pull-backs.
              </p>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="flex items-start space-x-2.5">
            <div className="p-1 bg-blue-950/80 border border-blue-800/30 rounded-lg shrink-0 text-blue-400 mt-0.5">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div>
              <h4 className="text-[11px] font-bold text-slate-200 uppercase leading-snug">4 Adaptive Smart AI Levels</h4>
              <p className="text-[10px] text-slate-400 leading-normal mt-0.5">
                Battle Easy, Hard, Nightmare, or the fatal, fast <b>ONE-SHOT DIFFICULTY</b> featuring supercharged speeds and one-hit lethal slams!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* LAUNCH TRIGGER BUTTON */}
      <div className="w-full shrink-0 flex flex-col items-center space-y-3 z-10 mb-2">
        <button
          onClick={handleStart}
          id="btn-launch-game"
          className="w-full max-w-sm py-3.5 bg-gradient-to-r from-red-650 via-indigo-700 to-emerald-650 text-white rounded-2xl text-xs font-black tracking-widest uppercase transition-all shadow-xl active:translate-y-0.5 active:shadow-[0_2px_10px_rgba(0,0,0,0.8)] focus:outline-none flex items-center justify-center gap-2 border border-white/20 animate-pulse"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Tap to Enter Arena</span>
        </button>

        <p className="text-[9px] text-slate-500 font-mono uppercase tracking-widest text-center">
          © SLAM & SLAP DUEL • NO EMULATOR REQUIRED
        </p>
      </div>

    </div>
  );
}
