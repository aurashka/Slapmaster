import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Flame, Smartphone, Moon, Sun, HelpCircle, X, ShieldAlert, Sparkles, Smile, Star, Code } from 'lucide-react';
import { GameMode, PlayerCustomization, PlayerAction } from './types';
import Menu from './components/Menu';
import Setup from './components/Setup';
import BoxingFight from './components/BoxingFight';
import SlappingDuel from './components/SlappingDuel';

export default function App() {
  const [activeView, setActiveView] = useState<GameMode>('menu');
  const [onlineSlot, setOnlineSlot] = useState<'local' | 'ai' | 'online_create' | 'online_join'>('local');
  const [gameSelection, setGameSelection] = useState<'boxing' | 'slap'>('boxing');

  // Player custom states
  const [p1State, setP1State] = useState<PlayerCustomization | null>(null);
  const [p2State, setP2State] = useState<PlayerCustomization | null>(null);
  const [roomId, setRoomId] = useState<string | undefined>(undefined);
  const [onlineSide, setOnlineSide] = useState<0 | 1 | undefined>(undefined);

  // How to play guide overlay toggle
  const [showGuide, setShowGuide] = useState<boolean>(false);

  // Transition helper triggers
  const handleSelectLocal = (mode: 'boxing' | 'slap') => {
    setGameSelection(mode);
    setOnlineSlot('local');
    setActiveView('setup');
  };

  const handleSelectAI = (mode: 'boxing' | 'slap') => {
    setGameSelection(mode);
    setOnlineSlot('ai');
    setActiveView('setup');
  };

  const handleSelectOnline = (mode: 'boxing' | 'slap') => {
    setGameSelection(mode);
    // Ask user if they wish to Create or Join a Room code
    const option = window.confirm(
      "ONLINE DUEL MULTIPLAYER\n\nClick 'OK' to CREATE a new 4-digit Room code.\nClick 'Cancel' to JOIN an existing joint Room code."
    );
    if (option) {
      setOnlineSlot('online_create');
    } else {
      setOnlineSlot('online_join');
    }
    setActiveView('setup');
  };

  const handleSetupComplete = (
    p1: PlayerCustomization, 
    p2: PlayerCustomization, 
    roomCode?: string, 
    side?: 0 | 1
  ) => {
    setP1State(p1);
    setP2State(p2);
    setRoomId(roomCode);
    setOnlineSide(side);
    
    // Diverge into active gameplay views
    if (gameSelection === 'boxing') {
      setActiveView('boxing_fight');
    } else {
      setActiveView('slapping_duel');
    }
  };

  const quitToMenu = () => {
    setP1State(null);
    setP2State(null);
    setRoomId(undefined);
    setOnlineSide(undefined);
    setActiveView('menu');
  };

  return (
    <div className="min-h-screen w-full bg-slate-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950 via-slate-950 to-black flex items-center justify-center p-0 md:p-6 text-white overflow-hidden scanlines">
      
      {/* Dynamic retro grid ambient backdrop for desktop view */}
      <div className="absolute inset-0 cyber-grid opacity-15 pointer-events-none hidden md:block" />

      {/* PHONE WRAPPER UNIT: Responsive phone container fit */}
      <div className="w-full h-screen md:h-[810px] md:max-w-[395px] md:rounded-[48px] md:border-[10px] md:border-slate-800 md:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden relative flex flex-col bg-slate-950 md:glow-red transition-all">
        
        {/* Simulated Top Notch/Island Speaker for desktop phone simulation */}
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-32 h-5 bg-slate-900 rounded-full z-45 flex items-center justify-center hidden md:flex">
          <div className="w-12 h-1 bg-slate-850 rounded-full" />
          <div className="w-2.5 h-2.5 bg-slate-950 rounded-full border border-slate-900 ml-2" />
        </div>

        {/* Core view router */}
        <div className="flex-grow w-full h-full overflow-hidden relative z-10 pt-2 pb-0 md:pt-6">
          <AnimatePresence mode="wait">
            {activeView === 'menu' && (
              <motion.div 
                key="menu-view"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="w-full h-full"
              >
                <Menu
                  onSelectLocal={handleSelectLocal}
                  onSelectAI={handleSelectAI}
                  onSelectOnline={handleSelectOnline}
                  onShowHowToPlay={() => setShowGuide(true)}
                />
              </motion.div>
            )}

            {activeView === 'setup' && (
              <motion.div 
                key="setup-view"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="w-full h-full"
              >
                <Setup
                  gameMode={gameSelection === 'boxing' ? 'boxing_fight' : 'slapping_duel'}
                  onlineSlot={onlineSlot}
                  onComplete={handleSetupComplete}
                  onBack={quitToMenu}
                />
              </motion.div>
            )}

            {activeView === 'boxing_fight' && p1State && p2State && (
              <motion.div 
                key="boxing-match"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full h-full"
              >
                <BoxingFight
                  p1={p1State}
                  p2={p2State}
                  roomId={roomId}
                  onlineSide={onlineSide}
                  onQuit={quitToMenu}
                  isVsAI={onlineSlot === 'ai'}
                />
              </motion.div>
            )}

            {activeView === 'slapping_duel' && p1State && p2State && (
              <motion.div 
                key="slapping-match"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full h-full"
              >
                <SlappingDuel
                  p1={p1State}
                  p2={p2State}
                  roomId={roomId}
                  onlineSide={onlineSide}
                  onQuit={quitToMenu}
                  isVsAI={onlineSlot === 'ai'}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* MULTIPAGE HOW TO PLAY DRAWER overlay popup */}
      <AnimatePresence>
        {showGuide && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm select-none"
          >
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-5 relative text-slate-100 max-h-[85vh] overflow-y-auto"
            >
              <button
                onClick={() => setShowGuide(false)}
                id="btn-close-howtoplay"
                className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-950 border border-slate-850 hover:bg-slate-900 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>

              <h2 className="text-xl font-black uppercase text-red-500 text-glow-red flex items-center gap-1.5 border-b border-slate-850 pb-2 mb-4">
                <HelpCircle className="w-5 h-5 text-red-500" />
                <span>Duel Arena Bible</span>
              </h2>

              <div className="space-y-4">
                
                {/* Section A */}
                <div className="space-y-1.5">
                  <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-yellow-500" />
                    <span>Combat Selfie Capture (Camera)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    You can capture three facial states: <b>Normal</b> 😐, <b>Attack</b> 😡, and <b>Hit</b> 😵. Face triggers dynamically morph onto your fighter's physical 2D head in real time as actions are performed on the pads!
                  </p>
                </div>

                {/* Section B */}
                <div className="space-y-1.5 border-t border-slate-850/40 pt-3">
                  <h3 className="text-xs font-black text-rose-500 uppercase tracking-wider">
                    🥊 Face-Off Boxing Rules
                  </h3>
                  <ul className="text-[11px] text-slate-400 space-y-1 list-disc list-inside leading-relaxed pl-1">
                    <li><b>Jabs (Left & Right)</b>: Throws punches towards center. Consumes 15 Energy.</li>
                    <li><b>Block</b>: Absorbs hits reducing damage by 85% but continuously drains blocks stamina. Stunned if stamina reaches nil!</li>
                    <li><b>Dodge</b>: Leans completely immune to hits for 200ms window, allowing fast counter setups.</li>
                  </ul>
                </div>

                {/* Section C */}
                <div className="space-y-1.5 border-t border-slate-850/40 pt-3">
                  <h3 className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                    🖐️ RG Slap Duel (Red Hands)
                  </h3>
                  <ul className="text-[11px] text-slate-400 space-y-1 list-disc list-inside leading-relaxed pl-1">
                    <li><b>Attacker role</b>: Can tap <i>Slap</i> or <i>Fake</i>.</li>
                    <li><b>Defender role</b>: Can tap <i>Pull Back (Dodge)</i>.</li>
                    <li>If attacker slaps and defender dodges in time, roles swap immediately!</li>
                    <li>If defender panics/dodges when attacker only <b>faked</b>, they suffer a False Dodge penalty strike. 3 strikes give attacker a free hit!</li>
                  </ul>
                </div>

                {/* Section D */}
                <div className="space-y-1.5 border-t border-slate-850/40 pt-3">
                  <h3 className="text-xs font-black text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>How Same-Phone Mode Works</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Sit face-to-face holding the phone between you. The Player Green (P2) controls are fully flipped 180 degrees so that they can see and tap comfortably from their end! Turn on 'Face to Face: ON' to activate this comfort layout.
                  </p>
                </div>

              </div>

              <button
                onClick={() => setShowGuide(false)}
                id="btn-understand-close"
                className="w-full mt-6 py-2.5 bg-red-650 hover:bg-red-650 text-white rounded-xl text-xs font-bold tracking-widest uppercase transition-all shadow shadow-red-950"
              >
                Got It! Play Now
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
