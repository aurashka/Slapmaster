import React from 'react';
import { motion } from 'motion/react';
import { Flame, Sparkles, Smartphone, Users, Monitor, HelpCircle } from 'lucide-react';
import { GameMode } from '../types';

interface MenuProps {
  onSelectLocal: (mode: 'boxing' | 'slap') => void;
  onSelectAI: (mode: 'boxing' | 'slap') => void;
  onSelectOnline: (mode: 'boxing' | 'slap') => void;
  onShowHowToPlay: () => void;
}

export default function Menu({ onSelectLocal, onSelectAI, onSelectOnline, onShowHowToPlay }: MenuProps) {
  return (
    <div className="flex flex-col items-center justify-between h-full w-full bg-slate-950 p-5 text-white overflow-y-auto cyber-grid select-none">
      
      {/* Title Header with Glowing Neon Vibe */}
      <div className="text-center mt-6 w-full shrink-0">
        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-red-950/40 border border-red-800/30 text-red-500 font-mono text-[10px] uppercase tracking-wider mb-2 animate-pulse">
          <Sparkles className="w-3 h-3 text-red-500" />
          <span>Phone Duel Arena</span>
        </div>
        
        <h1 className="text-4xl font-extrabold tracking-tighter uppercase text-slate-100 flex flex-col leading-none">
          <span className="text-glow-red text-red-500 font-black">SLAM</span>
          <span className="text-glow-green text-emerald-400 text-3xl font-black mt-1">& SLAP</span>
        </h1>
        <p className="text-[11px] text-slate-400 mt-2 font-medium bg-slate-900/60 p-1.5 border border-slate-850 rounded">
          Red vs Green Face-Off Challenge
        </p>
      </div>

      {/* Mode Selection Grid */}
      <div className="flex-grow w-full flex flex-col justify-center space-y-4 my-6">
        
        {/* GAME TYPE A: FIGHTING FIGHT */}
        <div className="bg-slate-900/80 border-2 border-red-900/40 rounded-2xl p-4 shadow-xl shadow-black/60 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-600/5 rounded-full blur-xl pointer-events-none" />
          
          <div className="flex items-center space-x-2.5 mb-1.5">
            <div className="p-1.5 bg-red-950 rounded-lg border border-red-800/40">
              <Flame className="w-4 h-4 text-red-500" />
            </div>
            <h3 className="text-sm font-bold tracking-wider text-red-400 uppercase">Face-Off Boxing</h3>
            <span className="ml-auto inline-block bg-red-900/40 text-red-300 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase font-mono border border-red-800/20">
              Action
            </span>
          </div>
          
          <p className="text-[11px] text-slate-400 mb-3.5 leading-tight">
            Attack, block and dodge with your faces overlayed on boxers! Exhaust opponents to achieve a KO.
          </p>

          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => onSelectLocal('boxing')}
              id="btn-boxing-local"
              className="py-2.5 px-1 bg-gradient-to-b from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-xl text-[9px] font-extrabold uppercase tracking-wider flex flex-col items-center justify-center gap-1 shadow-lg shadow-red-950/40 transition-all border-b-2 border-red-900 active:translate-y-0.5"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Same Phone</span>
            </button>
            <button
              onClick={() => onSelectAI('boxing')}
              id="btn-boxing-ai"
              className="py-2.5 px-1 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-750 hover:border-slate-700 rounded-xl text-[9px] font-extrabold uppercase tracking-wider flex flex-col items-center justify-center gap-1 transition-all active:translate-y-0.5"
            >
              <Monitor className="w-3.5 h-3.5 text-slate-400" />
              <span>Vs AI Robot</span>
            </button>
            <button
              onClick={() => onSelectOnline('boxing')}
              id="btn-boxing-online"
              className="py-2.5 px-1 bg-slate-900 hover:bg-slate-850 text-emerald-400 border border-emerald-900/40 rounded-xl text-[9px] font-extrabold uppercase tracking-wider flex flex-col items-center justify-center gap-1 transition-all active:translate-y-0.5 relative"
            >
              <div className="absolute -top-1 right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
              <Users className="w-3.5 h-3.5" />
              <span>Online Play</span>
            </button>
          </div>
        </div>

        {/* GAME TYPE B: RED HANDS SLAP GAME */}
        <div className="bg-slate-900/80 border-2 border-emerald-950/80 rounded-2xl p-4 shadow-xl shadow-black/60 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-600/5 rounded-full blur-xl pointer-events-none" />
          
          <div className="flex items-center space-x-2.5 mb-1.5">
            <div className="p-1.5 bg-emerald-950 rounded-lg border border-emerald-800/30">
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <h3 className="text-sm font-bold tracking-wider text-emerald-400 uppercase">RG Slap Duel</h3>
            <span className="ml-auto inline-block bg-emerald-950 text-emerald-300 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase font-mono border border-emerald-800/20">
              Speed
            </span>
          </div>
          
          <p className="text-[11px] text-slate-400 mb-3.5 leading-tight">
            Classic "Hot Hands" timing Duel! Slap fast, bait early dodges, and trigger funny reaction-shot facial expressions.
          </p>

          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => onSelectLocal('slap')}
              id="btn-slap-local"
              className="py-2.5 px-1 bg-gradient-to-b from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-xl text-[9px] font-extrabold uppercase tracking-wider flex flex-col items-center justify-center gap-1 shadow-lg shadow-emerald-950/40 transition-all border-b-2 border-emerald-900 active:translate-y-0.5"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Same Phone</span>
            </button>
            <button
              onClick={() => onSelectAI('slap')}
              id="btn-slap-ai"
              className="py-2.5 px-1 bg-slate-800 hover:bg-slate-755 text-slate-200 border border-slate-750 hover:border-slate-700 rounded-xl text-[9px] font-extrabold uppercase tracking-wider flex flex-col items-center justify-center gap-1 transition-all active:translate-y-0.5"
            >
              <Monitor className="w-3.5 h-3.5 text-slate-400" />
              <span>Vs AI Robot</span>
            </button>
            <button
              onClick={() => onSelectOnline('slap')}
              id="btn-slap-online"
              className="py-2.5 px-1 bg-slate-900 hover:bg-slate-850 text-emerald-400 border border-emerald-900/40 rounded-xl text-[9px] font-extrabold uppercase tracking-wider flex flex-col items-center justify-center gap-1 transition-all active:translate-y-0.5 relative"
            >
              <div className="absolute -top-1 right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
              <Users className="w-3.5 h-3.5" />
              <span>Online Play</span>
            </button>
          </div>
        </div>

      </div>

      {/* Bottom info and navigation action links */}
      <div className="w-full shrink-0 flex flex-col items-center space-y-2 mt-auto">
        <button
          onClick={onShowHowToPlay}
          id="btn-how-to-play"
          className="flex items-center space-x-1 py-1.5 px-3 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-[10px] font-bold tracking-wider uppercase transition-all"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Rules / Gameplay Guide</span>
        </button>
        
        <span className="text-[9px] text-slate-600 font-mono tracking-wider">
          v1.4.0 (Red vs Green Edition)
        </span>
      </div>

    </div>
  );
}
