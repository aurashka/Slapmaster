import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, RefreshCw, Home, Smartphone, Award, Star, ShieldAlert } from 'lucide-react';
import { PlayerCustomization } from '../types';
import { playSlapSound, playPunchSound, playHitSound, playFanfare, playDefeatSound, playCountdownBeep } from '../utils/audio';

interface SlappingDuelProps {
  p1: PlayerCustomization; // Red Fighter
  p2: PlayerCustomization; // Green Fighter
  roomId?: string;
  onlineSide?: 0 | 1; // null/undefined for local Same-Device or Vs AI
  onQuit: () => void;
}

export default function SlappingDuel({ p1, p2, roomId, onlineSide, onQuit }: SlappingDuelProps) {
  const isOnline = !!roomId;

  // 5 Lives / Hearts per player
  const [p1Hearts, setP1Hearts] = useState<number>(5);
  const [p2Hearts, setP2Hearts] = useState<number>(5);

  // Attacker index: 0 is P1/Red, 1 is P2/Green
  const [attackerIndex, setAttackerIndex] = useState<0 | 1>(0);

  // Penalty strikes for false-dodges (panicking on fakes)
  const [p1Penalties, setP1Penalties] = useState<number>(0);
  const [p2Penalties, setP2Penalties] = useState<number>(0);

  // Screen layout preferences
  const [rotateTopControls, setRotateTopControls] = useState<boolean>(true);

  // States
  const [p1State, setP1State] = useState<'idle' | 'slapping' | 'faking' | 'dodging' | 'hit' | 'missed'>('idle');
  const [p2State, setP2State] = useState<'idle' | 'slapping' | 'faking' | 'dodging' | 'hit' | 'missed'>('idle');

  const [message, setMessage] = useState<string>('MATCH READY!');
  const [winner, setWinner] = useState<PlayerCustomization | null>(null);
  const [countdown, setCountdown] = useState<number | null>(3);

  // Timing windows for dodging and networking
  const slapTimerRef = useRef<any>(null);
  const stateActive = countdown === null && !winner;
  const stateActiveRef = useRef<boolean>(false);
  stateActiveRef.current = stateActive;

  // Networking sync buffers
  const networkActionBuffer = useRef<'slap' | 'fake' | 'dodge' | 'idle'>('idle');
  const lobbyLastUpdate = useRef<number>(0);

  const timestampNow = () => Date.now();

  // Match Countdown on mount
  useEffect(() => {
    let timer: any;
    if (countdown !== null && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 900);
    } else if (countdown === 0) {
      timer = setTimeout(() => {
        setCountdown(null);
        // Randomly choose first attacker
        setAttackerIndex(Math.random() < 0.5 ? 0 : 1);
        setMessage('BATTLE COMMENCED!');
      }, 800);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // Online status synchronizer
  useEffect(() => {
    if (!isOnline) {
      // Offline local AI routine if opponent is a Bot
      if (onlineSide === undefined && p2.name.includes('Bot') || p2.name.includes('Giga')) {
        const aiInterval = setInterval(() => {
          if (!stateActiveRef.current) return;

          // AI Attacking loop
          if (attackerIndex === 1) {
            const rand = Math.random();
            if (rand < 0.18) {
              executeAISlapAction();
            } else if (rand < 0.32) {
              executeAIFakeAction();
            }
          }
        }, 1200);

        return () => clearInterval(aiInterval);
      }
      return;
    }

    // Polling sync endpoint
    const pollInterval = setInterval(async () => {
      const isHost = onlineSide === 0;
      const mySlot = onlineSide!;
      const myHearts = isHost ? p1Hearts : p2Hearts;
      const opponentLife = isHost ? p2Hearts : p1Hearts;

      try {
        const res = await fetch(`/api/rooms/${roomId}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerIndex: mySlot,
            health: myHearts, // Map lives directly to sync health slot
            energy: attackerIndex === mySlot ? 1 : 0, // Energy 1 indicates Attacker role
            action: networkActionBuffer.current,
            status: winner ? 'ended' : 'playing'
          })
        });

        if (res.ok) {
          const data = await res.json();
          lobbyLastUpdate.current = timestampNow();
          networkActionBuffer.current = 'idle';

          // Sync game states
          if (isHost) {
            if (data.p2) {
              setP2Hearts(data.p2.health);
              // Opponent actions sync
              if (data.p2.action === 'slap') {
                opponentsSlap(1, isHost);
              } else if (data.p2.action === 'fake') {
                opponentsFake(1, isHost);
              } else if (data.p2.action === 'dodge') {
                opponentsDodge(1, isHost);
              }
            }
          } else {
            if (data.p1) {
              setP1Hearts(data.p1.health);
              if (data.p1.action === 'slap') {
                opponentsSlap(0, isHost);
              } else if (data.p1.action === 'fake') {
                opponentsFake(0, isHost);
              } else if (data.p1.action === 'dodge') {
                opponentsDodge(0, isHost);
              }
            }
          }

          // Role coordination sync
          if (data.p1 && data.p2) {
            // Re-align roles according to master server coordinator (Host sets, Guest syncs)
            if (!isHost) {
              setAttackerIndex(data.p1.energy === 1 ? 0 : 1);
            }
          }

          if (data.status === 'ended' || data.p1?.health <= 0 || data.p2?.health <= 0) {
            if (data.p1?.health <= 0 && !winner) {
              triggerMatchWin(p2);
            } else if (data.p2?.health <= 0 && !winner) {
              triggerMatchWin(p1);
            }
          }
        }
      } catch (err) {
        console.error('Lobby synchronization failed', err);
      }
    }, 220);

    return () => clearInterval(pollInterval);
  }, [isOnline, p1Hearts, p2Hearts, attackerIndex, onlineSide, p1State, p2State, winner]);

  // Helper AI mechanisms
  const executeAISlapAction = () => {
    opponentsSlap(1, false);
  };

  const executeAIFakeAction = () => {
    opponentsFake(1, false);
  };

  // Synced opponent behaviors
  const opponentsSlap = (oppSlot: 0 | 1, isHost: boolean) => {
    if (oppSlot === 1 && p2State === 'slapping') return;
    if (oppSlot === 0 && p1State === 'slapping') return;

    if (oppSlot === 1) {
      setP2State('slapping');
      playPunchSound();
      
      // Hit evaluation window: did player 1 dodge in time?
      slapTimerRef.current = setTimeout(() => {
        setP2State('idle');
        if (p1State === 'dodging') {
          // Success dodge! Roles swap
          setP1State('idle');
          playPunchSound(); // missed swipe
          setMessage('DODGED! Roles swapped.');
          setAttackerIndex(0);
        } else {
          // HIT! Attacker retains role
          playSlapSound();
          setP1State('hit');
          setP1Hearts(prev => {
            const next = Math.max(0, prev - 1);
            if (next === 0) triggerMatchWin(p2);
            return next;
          });
          setMessage('SLAP LANDED! Red hits!');
          setTimeout(() => setP1State('idle'), 400);
        }
      }, 230);
    } else {
      setP1State('slapping');
      playPunchSound();
      
      slapTimerRef.current = setTimeout(() => {
        setP1State('idle');
        if (p2State === 'dodging') {
          setP2State('idle');
          playPunchSound();
          setMessage('DODGED! Roles swapped.');
          setAttackerIndex(1);
        } else {
          playSlapSound();
          setP2State('hit');
          setP2Hearts(prev => {
            const next = Math.max(0, prev - 1);
            if (next === 0) triggerMatchWin(p1);
            return next;
          });
          setMessage('SLAP LANDED! Green hits!');
          setTimeout(() => setP2State('idle'), 400);
        }
      }, 230);
    }
  };

  const opponentsFake = (oppSlot: 0 | 1, isHost: boolean) => {
    if (oppSlot === 1) {
      setP2State('faking');
      playPunchSound();
      setTimeout(() => {
        setP2State('idle');
        // Check if player Red fell for the fake!
        if (p1State === 'dodging') {
          setP1State('idle');
          playHitSound();
          setP1Penalties(prev => {
            const next = prev + 1;
            if (next >= 3) {
              // Free slap penalty trigger
              setFreeSlapDeal(1); // Player 2 gets free slapped!
              return 0;
            }
            setMessage('BAITED! False Dodge Penalty.');
            return next;
          });
        } else {
          setMessage('Calm read! Green faked.');
        }
      }, 220);
    } else {
      setP1State('faking');
      playPunchSound();
      setTimeout(() => {
        setP1State('idle');
        if (p2State === 'dodging') {
          setP2State('idle');
          playHitSound();
          setP2Penalties(prev => {
            const next = prev + 1;
            if (next >= 3) {
              setFreeSlapDeal(0);
              return 0;
            }
            setMessage('BAITED! False Dodge Penalty.');
            return next;
          });
        } else {
          setMessage('Calm read! Red faked.');
        }
      }, 220);
    }
  };

  const opponentsDodge = (oppSlot: 0 | 1, isHost: boolean) => {
    if (oppSlot === 1) {
      setP2State('dodging');
      setTimeout(() => setP2State('idle'), 450);
    } else {
      setP1State('dodging');
      setTimeout(() => setP1State('idle'), 450);
    }
  };

  const setFreeSlapDeal = (inflictorIdx: 0 | 1) => {
    playSlapSound();
    setMessage('PENALTY METED! FREE SMACK.');
    if (inflictorIdx === 0) {
      setP2State('hit');
      setP2Hearts(prev => {
        const next = Math.max(0, prev - 1);
        if (next === 0) triggerMatchWin(p1);
        return next;
      });
      setTimeout(() => setP2State('idle'), 400);
    } else {
      setP1State('hit');
      setP1Hearts(prev => {
        const next = Math.max(0, prev - 1);
        if (next === 0) triggerMatchWin(p2);
        return next;
      });
      setTimeout(() => setP1State('idle'), 400);
    }
  };

  const triggerMatchWin = (crownWinner: PlayerCustomization) => {
    setWinner(crownWinner);
    if ((onlineSide !== undefined && onlineSide === 0 && crownWinner.color === 'red') || 
        (onlineSide !== undefined && onlineSide === 1 && crownWinner.color === 'green') ||
        (onlineSide === undefined && crownWinner.color === 'red')) {
      playFanfare();
    } else {
      playDefeatSound();
    }
  };

  // Local Tapping actions
  const tapSlap = (playerIdx: 0 | 1) => {
    if (!stateActive || attackerIndex !== playerIdx) return;
    
    if (isOnline) {
      networkActionBuffer.current = 'slap';
    }

    if (playerIdx === 0) {
      setP1State('slapping');
      playPunchSound();
      
      // Slap lands in 200ms
      slapTimerRef.current = setTimeout(() => {
        setP1State('idle');
        
        // Did Player 2 dodge in time?
        if (p2State === 'dodging') {
          setP2State('idle');
          playPunchSound(); // miss swing
          setMessage('DODGED! Roles swapped.');
          setAttackerIndex(1); // Swap!
        } else {
          // Landed slap
          playSlapSound();
          setP2State('hit');
          setP2Hearts(prev => {
            const next = Math.max(0, prev - 1);
            if (next === 0) triggerMatchWin(p1);
            return next;
          });
          setMessage('SLAP LANDED! Red scores!');
          setTimeout(() => setP2State('idle'), 400);
        }
      }, 210);
    } else {
      setP2State('slapping');
      playPunchSound();

      slapTimerRef.current = setTimeout(() => {
        setP2State('idle');
        
        if (p1State === 'dodging') {
          setP1State('idle');
          playPunchSound();
          setMessage('DODGED! Roles swapped.');
          setAttackerIndex(0);
        } else {
          playSlapSound();
          setP1State('hit');
          setP1Hearts(prev => {
            const next = Math.max(0, prev - 1);
            if (next === 0) triggerMatchWin(p2);
            return next;
          });
          setMessage('SLAP LANDED! Green scores!');
          setTimeout(() => setP1State('idle'), 400);
        }
      }, 210);
    }
  };

  const tapFake = (playerIdx: 0 | 1) => {
    if (!stateActive || attackerIndex !== playerIdx) return;

    if (isOnline) {
      networkActionBuffer.current = 'fake';
    }

    if (playerIdx === 0) {
      setP1State('faking');
      playPunchSound();
      setTimeout(() => {
        setP1State('idle');
        if (p2State === 'dodging') {
          setP2State('idle');
          playHitSound(); // Alert clang
          setP2Penalties(prev => {
            const next = prev + 1;
            if (next >= 3) {
              setFreeSlapDeal(0);
              return 0;
            }
            setMessage('BAITED! Green false penalty!');
            return next;
          });
        } else {
          setMessage('Calm! Green stood still.');
        }
      }, 220);
    } else {
      setP2State('faking');
      playPunchSound();
      setTimeout(() => {
        setP2State('idle');
        if (p1State === 'dodging') {
          setP1State('idle');
          playHitSound();
          setP1Penalties(prev => {
            const next = prev + 1;
            if (next >= 3) {
              setFreeSlapDeal(1);
              return 0;
            }
            setMessage('BAITED! Red false penalty!');
            return next;
          });
        } else {
          setMessage('Calm! Red stood still.');
        }
      }, 220);
    }
  };

  const tapDodge = (playerIdx: 0 | 1) => {
    if (!stateActive || attackerIndex === playerIdx) return; // Attacker cannot dodge!

    if (isOnline) {
      networkActionBuffer.current = 'dodge';
    }

    if (playerIdx === 0) {
      setP1State('dodging');
      setTimeout(() => setP1State('idle'), 450);
    } else {
      setP2State('dodging');
      setTimeout(() => setP2State('idle'), 450);
    }
  };

  const renderHeadAvatar = (fighter: PlayerCustomization, state: string) => {
    if (fighter.avatarType === 'camera' && fighter.faces.normal) {
      let src = fighter.faces.normal;
      if ((state === 'slapping' || state === 'faking') && fighter.faces.attack) {
        src = fighter.faces.attack;
      } else if (state === 'hit' && fighter.faces.hit) {
        src = fighter.faces.hit;
      }
      return <img src={src} alt="Selfie" className="w-full h-full object-cover scale-x-[-1]" />;
    }

    // stock emojis fallbacks
    let emo = fighter.color === 'red' ? '😡' : '👽';
    if (state === 'slapping') emo = '💥';
    else if (state === 'hit') emo = '😵';
    else if (state === 'dodging') emo = '💨';

    return <span className="text-4xl">{emo}</span>;
  };

  const handleRematch = () => {
    setP1Hearts(5);
    setP2Hearts(5);
    setP1Penalties(0);
    setP2Penalties(0);
    setP1State('idle');
    setP2State('idle');
    setWinner(null);
    setCountdown(3);
    setMessage('MATCH READY!');
  };

  // Determine active view states
  const showActivePlayerControls = onlineSide === undefined || onlineSide === 0;
  const showOpponentPlayerControls = onlineSide === undefined || onlineSide === 1;

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-white font-sans overflow-hidden relative select-none">
      
      {/* HUD controls overlays */}
      <div className="absolute top-2 left-2 right-2 flex justify-between items-center z-30 pointer-events-none">
        <button
          onClick={onQuit}
          id="btn-quit-match-overlay"
          className="p-1 px-2.5 rounded-lg bg-black/60 border border-slate-905 pointer-events-auto text-[9px] font-bold text-slate-400 hover:text-white uppercase tracking-wider"
        >
          Quit
        </button>
        {isOnline && (
          <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-850 text-emerald-400 font-mono text-[9px] uppercase tracking-widest font-bold">
            ROOM: {roomId}
          </span>
        )}
        {!isOnline && onlineSide === undefined && (
          <button
            onClick={() => setRotateTopControls(!rotateTopControls)}
            id="btn-toggle-top-rotate-slap"
            className="p-1.5 rounded-lg bg-black/60 border border-slate-905 pointer-events-auto text-[9px] uppercase tracking-wider text-slate-400 hover:text-white font-bold flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Face to Face: {rotateTopControls ? 'ON' : 'OFF'}</span>
          </button>
        )}
      </div>

      {/* GAME arena floor split */}
      <div className="flex-grow flex flex-col justify-between p-4 py-8 relative">
        <div className="absolute inset-x-0 top-1/4 bottom-1/4 retro-grid-green opacity-20 pointer-events-none" />

        {/* GREEN PLAYER DISPLAY AREA (P2) */}
        <div className="w-full flex flex-col items-center">
          
          <div className={`w-full max-w-sm mb-4 leading-normal ${(!isOnline && rotateTopControls && onlineSide === undefined) ? 'transform rotate-180' : ''}`}>
            
            {/* Lives and roles headers */}
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-405 flex items-center gap-1">
                <span>{p2.name}</span>
                {attackerIndex === 1 && (
                  <span className="bg-emerald-950 border border-emerald-500 text-emerald-405 text-[8px] px-1 rounded animate-pulse">
                    SLAPPER
                  </span>
                )}
              </span>

              {/* Heart icons representing health */}
              <div className="flex space-x-0.5">
                {[...Array(5)].map((_, i) => (
                  <Heart
                    key={i}
                    className={`w-3.5 h-3.5 ${
                      i < p2Hearts ? 'text-emerald-400 fill-emerald-500' : 'text-slate-800'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Penalty strikes indicator */}
            <div className="flex justify-end space-x-1 mt-1">
              <span className="text-[8px] text-slate-500 font-mono">Panic dodging penalties:</span>
              <div className="flex space-x-0.5">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-2.5 h-2.5 rounded-full border border-slate-800 flex items-center justify-center text-[7px] font-black leading-none ${
                      i < p2Penalties ? 'bg-orange-600 text-white' : 'bg-slate-950 text-slate-700'
                    }`}
                  >
                    X
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Character head visualization */}
          <div className="relative">
            <div className={`w-20 h-20 rounded-full border-4 flex items-center justify-center overflow-hidden bg-slate-900 shadow-xl relative z-10 ${
              p2State === 'hit' ? 'border-yellow-400 animate-head-shake' : 'border-emerald-505'
            }`}>
              {renderHeadAvatar(p2, p2State)}
            </div>

            {/* Virtual Slapping indicator */}
            {p2State === 'dodging' && (
              <span className="absolute -bottom-2 inset-x-0 text-center text-[9px] font-mono font-bold bg-amber-950 text-amber-400 border border-amber-850 py-0.5 rounded uppercase tracking-wider">
                Dodged!
              </span>
            )}
          </div>

        </div>

        {/* INTERACTIVE HAND TRACKS (THE CORE FIST SHOWDOWN AT THE CENTER) */}
        <div className="relative flex-grow flex flex-col items-center justify-center my-6 h-56 max-w-sm mx-auto w-full">
          
          {/* Status text popup ticker */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/80 border border-slate-850 px-3.5 py-1.5 rounded-xl z-10 text-center shadow-lg shadow-black/80 pointer-events-none">
            <span className="text-[10px] font-black uppercase tracking-widest text-glow-red text-red-400 font-mono animate-pulse block">
              {message}
            </span>
            {attackerIndex === 0 ? (
              <span className="text-[8px] text-rose-500 font-bold block uppercase mt-0.5">Red Attacks 🥊</span>
            ) : (
              <span className="text-[8px] text-emerald-400 font-bold block uppercase mt-0.5">Green Attacks 🥊</span>
            )}
          </div>

          {/* Player Green Hand Element at top */}
          <motion.div
            className="absolute origin-top flex flex-col items-center"
            style={{ top: '10px' }}
            animate={{
              y: p2State === 'slapping' ? 95 : p2State === 'faking' ? 35 : p2State === 'dodging' ? -25 : 0,
              rotate: p2State === 'hit' ? [0, 15, -15, 0] : 0,
              opacity: p2State === 'hit' ? 0.75 : 1
            }}
            transition={{ type: 'spring', damping: 8, stiffness: 190 }}
          >
            {/* Custom vector shaped Green fighter hand */}
            <div className="w-16 h-20 bg-gradient-to-b from-emerald-500 to-emerald-700 hover:opacity-90 rounded-b-3xl border-2 border-emerald-450 shadow-md relative flex items-center justify-center">
              <span className="text-xl">🖐️</span>
              {/* Fake lines */}
              {p2State === 'faking' && <div className="absolute inset-0 bg-yellow-500/20 rounded-b-3xl border border-dashed border-yellow-500" />}
            </div>
            <span className="text-[9px] font-bold tracking-wider text-emerald-400 mt-1 uppercase font-mono">P2 Track</span>
          </motion.div>

          {/* Player Red Hand Element at bottom */}
          <motion.div
            className="absolute origin-bottom flex flex-col items-center"
            style={{ bottom: '10px' }}
            animate={{
              y: p1State === 'slapping' ? -95 : p1State === 'faking' ? -35 : p1State === 'dodging' ? 25 : 0,
              rotate: p1State === 'hit' ? [0, -15, 15, 0] : 0,
              opacity: p1State === 'hit' ? 0.75 : 1
            }}
            transition={{ type: 'spring', damping: 8, stiffness: 190 }}
          >
            <span className="text-[9px] font-bold tracking-wider text-rose-500 mb-1 uppercase font-mono">P1 Track</span>
            {/* Custom vector shaped Red fighter hand */}
            <div className="w-16 h-20 bg-gradient-to-t from-red-600 to-red-800 rounded-t-3xl border-2 border-red-500 shadow-md relative flex items-center justify-center">
              <span className="text-xl">🖐️</span>
              {p1State === 'faking' && <div className="absolute inset-0 bg-yellow-500/20 rounded-t-3xl border border-dashed border-yellow-500" />}
            </div>
          </motion.div>

        </div>

        {/* RED PLAYER DISPLAY AREA (P1) */}
        <div className="w-full flex flex-col items-center pb-2">
          
          <div className="relative">
            <div className={`w-20 h-20 rounded-full border-4 flex items-center justify-center overflow-hidden bg-slate-900 shadow-xl relative z-10 ${
              p1State === 'hit' ? 'border-yellow-400 animate-head-shake' : 'border-rose-500'
            }`}>
              {renderHeadAvatar(p1, p1State)}
            </div>

            {p1State === 'dodging' && (
              <span className="absolute -bottom-2 inset-x-0 text-center text-[9px] font-mono font-bold bg-amber-950 text-amber-400 border border-amber-850 py-0.5 rounded uppercase tracking-wider">
                Dodged!
              </span>
            )}
          </div>

          <div className="w-full max-w-sm mt-4 leading-normal">
            
            {/* Lives and roles headers */}
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-500 flex items-center gap-1">
                <span>{p1.name}</span>
                {attackerIndex === 0 && (
                  <span className="bg-rose-950 border border-rose-800 text-rose-400 text-[8px] px-1 rounded animate-pulse">
                    SLAPPER
                  </span>
                )}
              </span>

              {/* Heart icons representing health */}
              <div className="flex space-x-0.5">
                {[...Array(5)].map((_, i) => (
                  <Heart
                    key={i}
                    className={`w-3.5 h-3.5 ${
                      i < p1Hearts ? 'text-rose-500 fill-rose-600' : 'text-slate-800'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Penalty strikes indicator */}
            <div className="flex justify-start space-x-1 mt-1">
              <span className="text-[8px] text-slate-500 font-mono">Panic dodging penalties:</span>
              <div className="flex space-x-0.5">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-2.5 h-2.5 rounded-full border border-slate-800 flex items-center justify-center text-[7px] font-black leading-none ${
                      i < p1Penalties ? 'bg-orange-600 text-white' : 'bg-slate-950 text-slate-700'
                    }`}
                  >
                    X
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* SCREEN DUAL ACTION PANEL (BOTTOM HALF WITH PADS) */}
      <div className="h-56 w-full shrink-0 grid grid-rows-2 border-t border-slate-900 z-20 relative bg-slate-950">
        
        {/* PLAYER GREEN (TOP) CONTROLS PANEL */}
        <div className={`p-2 bg-slate-950 border-b border-slate-900/60 flex items-center justify-center relative select-none ${
          (!isOnline && rotateTopControls && onlineSide === undefined) ? 'transform rotate-180' : ''
        }`}>
          {!showOpponentPlayerControls && (
            <div className="absolute inset-0 bg-black/75 z-40 flex items-center justify-center border-b border-slate-850">
              <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase font-mono">
                Remote Fighter Control Window
              </span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 w-full max-w-sm h-full">
            {attackerIndex === 1 ? (
              /* If Green is Attacking: Slap and Fake */
              <>
                <button
                  onClick={() => tapFake(1)}
                  id="btn-p2-fake"
                  disabled={countdown !== null || winner !== null}
                  className="bg-yellow-950/40 hover:bg-yellow-900/10 border border-yellow-900/50 text-yellow-405 font-extrabold text-[10px] uppercase rounded-xl flex flex-col items-center justify-center px-1"
                >
                  <span>SLAP FAKE</span>
                  <span className="text-[7px] font-mono opacity-50">BAIT DODGER</span>
                </button>
                
                <button
                  onClick={() => tapSlap(1)}
                  id="btn-p2-slap"
                  disabled={countdown !== null || winner !== null}
                  className="col-span-2 bg-gradient-to-r from-emerald-600 to-teal-600 active:from-emerald-700 text-white font-extrabold text-xs uppercase rounded-xl flex flex-col items-center justify-center"
                >
                  <span className="text-sm">⚡ SLAP DUEL ⚡</span>
                  <span className="text-[8px] font-mono tracking-wider opacity-90">TAP TO LAND HIT</span>
                </button>
              </>
            ) : (
              /* If Green is Defending: Dodge */
              <button
                onClick={() => tapDodge(1)}
                id="btn-p2-sub-dodge"
                disabled={countdown !== null || winner !== null}
                className="col-span-3 bg-indigo-950 active:bg-indigo-900 border border-indigo-850 text-indigo-400 font-extrabold text-sm tracking-wider uppercase rounded-xl flex flex-col items-center justify-center"
              >
                <span className="text-lg">💨 PULL BACK 💨</span>
                <span className="text-[8px] font-mono opacity-60">TAP WITHIN 220ms WINDOW</span>
              </button>
            )}
          </div>
        </div>

        {/* PLAYER RED (BOTTOM) CONTROLS PANEL */}
        <div className="p-2 bg-slate-950 flex items-center justify-center relative select-none">
          {!showActivePlayerControls && (
            <div className="absolute inset-0 bg-black/75 z-40 flex items-center justify-center">
              <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase font-mono">
                Remote Fighter Control Window
              </span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 w-full max-w-sm h-full">
            {attackerIndex === 0 ? (
              /* If Red is Attacking */
              <>
                <button
                  onClick={() => tapFake(0)}
                  id="btn-p1-fake"
                  disabled={countdown !== null || winner !== null}
                  className="bg-yellow-950/40 hover:bg-yellow-905/10 border border-yellow-900/50 text-yellow-405 font-extrabold text-[10px] uppercase rounded-xl flex flex-col items-center justify-center px-1"
                >
                  <span>SLAP FAKE</span>
                  <span className="text-[7px] font-mono opacity-50">BAIT DODGER</span>
                </button>
                
                <button
                  onClick={() => tapSlap(0)}
                  id="btn-p1-slap"
                  disabled={countdown !== null || winner !== null}
                  className="col-span-2 bg-gradient-to-r from-red-650 to-rose-650 active:from-red-700 text-white font-extrabold text-xs uppercase rounded-xl flex flex-col items-center justify-center"
                >
                  <span className="text-sm">⚡ SLAP DUEL ⚡</span>
                  <span className="text-[8px] font-mono tracking-wider opacity-90">TAP TO LAND HIT</span>
                </button>
              </>
            ) : (
              /* If Red is Defending */
              <button
                onClick={() => tapDodge(0)}
                id="btn-p1-sub-dodge"
                disabled={countdown !== null || winner !== null}
                className="col-span-3 bg-indigo-950 active:bg-indigo-900 border border-indigo-850 text-indigo-405 font-extrabold text-sm tracking-wider uppercase rounded-xl flex flex-col items-center justify-center"
              >
                <span className="text-lg">💨 PULL BACK 💨</span>
                <span className="text-[8px] font-mono opacity-60">TAP WITHIN 220ms WINDOW</span>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* SHUTTER SLAP DUEL START COUNTDOWN OVERLAY */}
      <AnimatePresence>
        {countdown !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/90 z-50 flex flex-col items-center justify-center"
          >
            <div className="text-center font-mono select-none">
              <span className="text-xs tracking-widest text-slate-500 uppercase font-black block">HOT HANDS DUEL</span>
              <motion.span 
                key={countdown}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1.4, opacity: 1 }}
                className="text-7xl font-black text-rose-500 block my-4"
              >
                {countdown === 0 ? 'DUEL!' : countdown}
              </motion.span>
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider px-4 block">
                Do not blink! Quick dodge baited fakes or suffer a slap!
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MATCH WIN OVERLAY */}
      <AnimatePresence>
        {winner !== null && (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute inset-0 bg-slate-950/95 z-55 flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="absolute top-0 inset-x-0 bottom-0 retro-gridopacity-20 pointer-events-none" />

            <div className="relative z-10 w-full max-w-sm space-y-6">
              
              <div className="inline-flex py-1 px-3 bg-emerald-950 border border-emerald-800 rounded-full text-emerald-450 text-[10px] uppercase font-mono tracking-widest font-black animate-pulse">
                🏆 TOURNAMENT WINNER 🏆
              </div>

              <div>
                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-widest block font-mono">SLAP MASTER SUPREME</span>
                <h2 className="text-3xl font-black text-white px-2 mt-1 truncate">
                  {winner.name}
                </h2>
              </div>

              {/* Winner head decoration */}
              <div className={`mx-auto w-24 h-24 rounded-full border-4 flex items-center justify-center overflow-hidden bg-slate-900 shadow-2xl relative ${
                winner.color === 'red' ? 'border-red-500 shadow-red-950' : 'border-emerald-505 shadow-emerald-950'
              }`}>
                {renderHeadAvatar(winner, 'idle')}
                <div className="absolute top-1 right-1 bg-yellow-500 rounded-full p-1 border border-black shadow">
                  <Award className="w-3.5 h-3.5 text-black" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-8 pt-6 border-t border-slate-910">
                <button
                  onClick={onQuit}
                  id="btn-slap-gameover-home"
                  className="py-3 text-xs bg-slate-900 hover:bg-slate-850 text-slate-300 font-bold tracking-wider uppercase rounded-xl border border-slate-800 transition-all flex items-center justify-center space-x-1.5"
                >
                  <Home className="w-4 h-4" />
                  <span>Main Menu</span>
                </button>
                <button
                  onClick={handleRematch}
                  id="btn-slap-gameover-rematch"
                  className="py-3 text-xs bg-emerald-650 hover:bg-emerald-500 text-white font-bold tracking-wider uppercase rounded-xl transition-all shadow-lg shadow-emerald-950/50 flex items-center justify-center space-x-1.5"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Rematch</span>
                </button>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
