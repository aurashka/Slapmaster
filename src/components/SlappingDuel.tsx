import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, RefreshCw, Home, Smartphone, Award, Star, ShieldAlert } from 'lucide-react';
import { PlayerCustomization } from '../types';
import { playSlapSound, playPunchSound, playHitSound, playFanfare, playDefeatSound, playCountdownBeep } from '../utils/audio';
import { db } from '../lib/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';

interface SlappingDuelProps {
  p1: PlayerCustomization; // Red Fighter
  p2: PlayerCustomization; // Green Fighter
  roomId?: string;
  onlineSide?: 0 | 1; // null/undefined for local Same-Device or Vs AI
  onQuit: () => void;
  isVsAI?: boolean;
}

export default function SlappingDuel({ p1, p2, roomId, onlineSide, onQuit, isVsAI }: SlappingDuelProps) {
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

  // Ticker and combat logs
  const [combatLogs, setCombatLogs] = useState<{ id: string; text: string; color: string }[]>([]);

  // Timing windows for dodging and networking
  const slapTimerRef = useRef<any>(null);
  const stateActive = countdown === null && !winner;
  const stateActiveRef = useRef<boolean>(false);
  stateActiveRef.current = stateActive;

  // Networking sync buffers
  const networkActionBuffer = useRef<'slap' | 'fake' | 'dodge' | 'idle'>('idle');
  const lobbyLastUpdate = useRef<number>(0);

  const timestampNow = () => Date.now();

  const addLog = (text: string, type: 'hit' | 'dodge' | 'block' | 'action' | 'penalty') => {
    let color = 'text-slate-450';
    if (type === 'hit') color = 'text-rose-500 font-extrabold';
    else if (type === 'dodge') color = 'text-orange-400 font-bold';
    else if (type === 'block') color = 'text-sky-400 font-bold';
    else if (type === 'penalty') color = 'text-yellow-500 font-semibold';
    else if (type === 'action') color = 'text-emerald-400 font-bold';

    setCombatLogs(prev => [
      { id: Math.random().toString(), text, color },
      ...prev.slice(0, 4)
    ]);
  };

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
        addLog("🔔 SLAPPING DUEL STARTED!", "penalty");
      }, 800);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // Online status synchronizer
  useEffect(() => {
    if (!isOnline) {
      // Offline local AI routine if opponent is a Bot
      const isOpponentAI = isVsAI || (onlineSide === undefined && (p2.name.includes('Bot') || p2.id?.startsWith('bot_')));
      if (isOpponentAI) {
        let actionInterval = 1100;
        let fakeRatio = 0.35;
        let slapRatio = 0.55;
        let reactionDelay = 380;

        const botIdStr = p2.id || '';
        const botNameStr = p2.name.toLowerCase();
        const isEasy = botIdStr === 'bot_easy' || botNameStr.includes('easy');
        const isHard = botIdStr === 'bot_hard' || botNameStr.includes('hard');
        const isNightmare = botIdStr === 'bot_nightmare' || botNameStr.includes('nightmare');
        const isOneshot = botIdStr === 'bot_oneshot' || botNameStr.includes('oneshot');

        if (isEasy) {
          actionInterval = 1350;
          fakeRatio = 0.20;
          slapRatio = 0.35;
          reactionDelay = 480;
        } else if (isHard) {
          actionInterval = 750;
          fakeRatio = 0.30;
          slapRatio = 0.60;
          reactionDelay = 320;
        } else if (isNightmare) {
          actionInterval = 480;
          fakeRatio = 0.40;
          slapRatio = 0.80; // extremely active
          reactionDelay = 220;
        } else if (isOneshot) {
          actionInterval = 580;
          fakeRatio = 0.35;
          slapRatio = 0.70;
          reactionDelay = 260;
        }
        
        const aiInterval = setInterval(() => {
          if (!stateActiveRef.current) return;

          // AI Attacking loop (smarter and faster combo triggers)
          if (attackerIndex === 1) {
            const rand = Math.random();
            if (rand < fakeRatio) {
              executeAIFakeAction();
              // Baited combo slap follow-up shortly after fake
              setTimeout(() => {
                if (stateActiveRef.current && attackerIndex === 1) {
                  executeAISlapAction();
                }
              }, reactionDelay);
            } else if (rand < fakeRatio + slapRatio) {
              executeAISlapAction();
            }
          }
        }, actionInterval);

        return () => clearInterval(aiInterval);
      }
      return;
    }

    // Bidirectional Live Firestore room subscription
    const docRef = doc(db, 'rooms', roomId!);
    let lastHandledOpponentTimestamp = 0;

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (!docSnap.exists() || !stateActiveRef.current) return;
      const data = docSnap.data();

      const isHost = onlineSide === 0;
      const oppKey = isHost ? 'p2' : 'p1';
      const oppData = data[oppKey];

      if (oppData) {
        // Synchronize remote life/hearts
        if (isHost) {
          setP2Hearts(oppData.health);
        } else {
          setP1Hearts(oppData.health);
        }

        // Fire remote animations on action detection
        if (oppData.action && oppData.action !== 'idle' && oppData.lastActive > lastHandledOpponentTimestamp) {
          lastHandledOpponentTimestamp = oppData.lastActive;

          const oppIndex = isHost ? 1 : 0;
          addLog(`⚡ ${isHost ? p2.name : p1.name} triggered ${oppData.action.toUpperCase()}!`, 'action');

          if (oppData.action === 'slap') {
            opponentsSlap(oppIndex, isHost);
          } else if (oppData.action === 'fake') {
            opponentsFake(oppIndex, isHost);
          } else if (oppData.action === 'dodge') {
            opponentsDodge(oppIndex, isHost);
          }
        }
      }

      // Synchronize role alignment (Host energy determines attacker role)
      if (data.p1) {
        const expectedAttacker = data.p1.energy === 1 ? 0 : 1;
        if (attackerIndex !== expectedAttacker) {
          setAttackerIndex(expectedAttacker);
        }
      }

      // Sync termination conditions
      if (data.status === 'ended' || (data.p1 && data.p1.health <= 0) || (data.p2 && data.p2.health <= 0)) {
        if (data.p1?.health <= 0 && !winner) {
          triggerMatchWin(p2);
        } else if (data.p2?.health <= 0 && !winner) {
          triggerMatchWin(p1);
        }
      }
    });

    return () => unsubscribe();
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
      addLog(`👋 ${p2.name} slapped!`, 'action');
      
      // Hit evaluation window: did player 1 dodge in time?
      slapTimerRef.current = setTimeout(() => {
        setP2State('idle');
        if (p1State === 'dodging') {
          // Success dodge! Roles swap
          setP1State('idle');
          playPunchSound(); // missed swipe
          setMessage('DODGED! Roles swapped.');
          addLog(`💨 ${p1.name} dodged ${p2.name}! Role swapped!`, 'dodge');
          setAttackerIndex(0);
        } else {
          // HIT! Attacker retains role
          playSlapSound();
          setP1State('hit');
          addLog(`💥 ${p2.name} slapped ${p1.name} hard!`, 'hit');
          setP1Hearts(prev => {
            const next = Math.max(0, prev - 1);
            if (next === 0) triggerMatchWin(p2);
            return next;
          });
          setMessage('SLAP LANDED! Green hits!');
          setTimeout(() => setP1State('idle'), 400);
        }
      }, 230);
    } else {
      setP1State('slapping');
      playPunchSound();
      addLog(`👋 ${p1.name} slapped!`, 'action');
      
      slapTimerRef.current = setTimeout(() => {
        setP1State('idle');
        if (p2State === 'dodging') {
          setP2State('idle');
          playPunchSound();
          setMessage('DODGED! Roles swapped.');
          addLog(`💨 ${p2.name} dodged ${p1.name}! Role swapped!`, 'dodge');
          setAttackerIndex(1);
        } else {
          playSlapSound();
          setP2State('hit');
          addLog(`💥 ${p1.name} slapped ${p2.name} hard!`, 'hit');
          setP2Hearts(prev => {
            const next = Math.max(0, prev - 1);
            if (next === 0) triggerMatchWin(p1);
            return next;
          });
          setMessage('SLAP LANDED! Red hits!');
          setTimeout(() => setP2State('idle'), 400);
        }
      }, 230);
    }
  };

  const opponentsFake = (oppSlot: 0 | 1, isHost: boolean) => {
    if (oppSlot === 1) {
      setP2State('faking');
      playPunchSound();
      addLog(`👀 ${p2.name} made a FAKE slap bait!`, 'action');
      setTimeout(() => {
        setP2State('idle');
        // Check if player Red fell for the fake!
        if (p1State === 'dodging') {
          setP1State('idle');
          playHitSound();
          setP1Penalties(prev => {
            const next = prev + 1;
            addLog(`⚠️ ${p1.name} baited! Panic penalties: ${next}/3`, 'penalty');
            if (next >= 3) {
              // Free slap penalty trigger
              setFreeSlapDeal(1); // Player 2 gets free slapped!
              return 0;
            }
            setMessage('BAITED! False Dodge Penalty.');
            return next;
          });
        } else {
          setMessage('Calm read! Red stood still.');
        }
      }, 220);
    } else {
      setP1State('faking');
      playPunchSound();
      addLog(`👀 ${p1.name} made a FAKE slap bait!`, 'action');
      setTimeout(() => {
        setP1State('idle');
        if (p2State === 'dodging') {
          setP2State('idle');
          playHitSound();
          setP2Penalties(prev => {
            const next = prev + 1;
            addLog(`⚠️ ${p2.name} baited! Panic penalties: ${next}/3`, 'penalty');
            if (next >= 3) {
              setFreeSlapDeal(0);
              return 0;
            }
            setMessage('BAITED! False Dodge Penalty.');
            return next;
          });
        } else {
          setMessage('Calm read! Green stood still.');
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
      addLog(`💥 FREE SMACK landed on ${p2.name}!`, 'hit');
      setP2Hearts(prev => {
        const next = Math.max(0, prev - 1);
        if (next === 0) triggerMatchWin(p1);
        return next;
      });
      setTimeout(() => setP2State('idle'), 400);
    } else {
      setP1State('hit');
      addLog(`💥 FREE SMACK landed on ${p1.name}!`, 'hit');
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
    addLog(`🏆 CHAMPION CROWNED: ${crownWinner.name}!`, 'penalty');
    if ((onlineSide !== undefined && onlineSide === 0 && crownWinner.color === 'red') || 
        (onlineSide !== undefined && onlineSide === 1 && crownWinner.color === 'green') ||
        (onlineSide === undefined && crownWinner.color === 'red')) {
      playFanfare();
    } else {
      playDefeatSound();
    }
  };

  // Symmetrical Firestore state synchronizer
  useEffect(() => {
    if (!isOnline || !roomId || winner) return;

    const isHost = onlineSide === 0;
    const docRef = doc(db, 'rooms', roomId);

    if (isHost) {
      updateDoc(docRef, {
        'p1.health': p1Hearts,
        'p1.energy': attackerIndex === 0 ? 1 : 0,
        'p1.lastActive': Date.now()
      }).catch(() => {});
    } else {
      updateDoc(docRef, {
        'p2.health': p2Hearts,
        'p2.energy': attackerIndex === 1 ? 1 : 0,
        'p2.lastActive': Date.now()
      }).catch(() => {});
    }
  }, [p1Hearts, p2Hearts, attackerIndex, isOnline, winner]);

  // Local Tapping actions
  const tapSlap = (playerIdx: 0 | 1) => {
    if (!stateActive || attackerIndex !== playerIdx) return;
    
    if (isOnline) {
      const docRef = doc(db, 'rooms', roomId!);
      if (onlineSide === 0) {
        updateDoc(docRef, {
          'p1.action': 'slap',
          'p1.lastActive': Date.now()
        }).catch(() => {});
      } else {
        updateDoc(docRef, {
          'p2.action': 'slap',
          'p2.lastActive': Date.now()
        }).catch(() => {});
      }
    }

    if (playerIdx === 0) {
      setP1State('slapping');
      playPunchSound();
      addLog(`👋 ${p1.name} initiated slap!`, 'action');

      // AI reaction triggers as defender if VS AI
      const opponentIsBot = isVsAI || (onlineSide === undefined && (p2.name.includes('Bot') || p2.id?.startsWith('bot_')));
      if (opponentIsBot && p2State === 'idle') {
        let reactChance = 0.40;
        let reactDelay = 130;

        const botIdStr = p2.id || '';
        const botNameStr = p2.name.toLowerCase();
        const isEasy = botIdStr === 'bot_easy' || botNameStr.includes('easy');
        const isHard = botIdStr === 'bot_hard' || botNameStr.includes('hard');
        const isNightmare = botIdStr === 'bot_nightmare' || botNameStr.includes('nightmare');
        const isOneshot = botIdStr === 'bot_oneshot' || botNameStr.includes('oneshot');

        if (isEasy) {
          reactChance = 0.18;
          reactDelay = 160;
        } else if (isHard) {
          reactChance = 0.55;
          reactDelay = 95;
        } else if (isNightmare) {
          reactChance = 0.85;
          reactDelay = 60;
        } else if (isOneshot) {
          reactChance = 0.92;
          reactDelay = 40;
        }

        if (Math.random() < reactChance) {
          setTimeout(() => {
            if (stateActiveRef.current && attackerIndex === 0) {
              setP2State('dodging');
              setTimeout(() => setP2State('idle'), 450);
            }
          }, reactDelay);
        }
      }
      
      // Slap lands in 200ms
      slapTimerRef.current = setTimeout(() => {
        setP1State('idle');
        
        // Did Player 2 dodge in time?
        if (p2State === 'dodging') {
          setP2State('idle');
          playPunchSound(); // miss swing
          setMessage('DODGED! Roles swapped.');
          addLog(`💨 ${p2.name} dodged ${p1.name}! Roles swapped!`, 'dodge');
          setAttackerIndex(1); // Swap!
        } else {
          // Landed slap
          playSlapSound();
          setP2State('hit');
          addLog(`💥 ${p1.name} hit ${p2.name}!`, 'hit');
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
      addLog(`👋 ${p2.name} initiated slap!`, 'action');

      slapTimerRef.current = setTimeout(() => {
        setP2State('idle');
        
        if (p1State === 'dodging') {
          setP1State('idle');
          playPunchSound();
          setMessage('DODGED! Roles swapped.');
          addLog(`💨 ${p1.name} dodged ${p2.name}! Roles swapped!`, 'dodge');
          setAttackerIndex(0);
        } else {
          playSlapSound();
          setP1State('hit');
          let damage = 1;
          if (isVsAI || p2.id?.startsWith('bot_')) {
            const botId = p2.id || '';
            if (botId === 'bot_oneshot') {
              damage = 5; // Direct defeat instantly!
            }
          }
          addLog(`💥 ${p2.name} hit ${p1.name} for ${damage} HP!`, 'hit');
          setP1Hearts(prev => {
            const next = Math.max(0, prev - damage);
            if (next === 0) triggerMatchWin(p2);
            return next;
          });
          setMessage(damage === 5 ? '⚡ FATAL ONE-SHOT BY THE BOT! ⚡' : 'SLAP LANDED! Green scores!');
          setTimeout(() => setP1State('idle'), 400);
        }
      }, 210);
    }
  };

  const tapFake = (playerIdx: 0 | 1) => {
    if (!stateActive || attackerIndex !== playerIdx) return;

    if (isOnline) {
      const docRef = doc(db, 'rooms', roomId!);
      if (onlineSide === 0) {
        updateDoc(docRef, {
          'p1.action': 'fake',
          'p1.lastActive': Date.now()
        }).catch(() => {});
      } else {
        updateDoc(docRef, {
          'p2.action': 'fake',
          'p2.lastActive': Date.now()
        }).catch(() => {});
      }
    }

    if (playerIdx === 0) {
      setP1State('faking');
      playPunchSound();
      addLog(`👀 ${p1.name} made a faked jab!`, 'action');

      // AI reaction triggers as defender if VS AI
      const opponentIsBot = isVsAI || (onlineSide === undefined && (p2.name.includes('Bot') || p2.id?.startsWith('bot_')));
      if (opponentIsBot && p2State === 'idle') {
        let baitChance = 0.40;

        const botIdStr = p2.id || '';
        const botNameStr = p2.name.toLowerCase();
        const isEasy = botIdStr === 'bot_easy' || botNameStr.includes('easy');
        const isHard = botIdStr === 'bot_hard' || botNameStr.includes('hard');
        const isNightmare = botIdStr === 'bot_nightmare' || botNameStr.includes('nightmare');
        const isOneshot = botIdStr === 'bot_oneshot' || botNameStr.includes('oneshot');

        if (isEasy) {
          baitChance = 0.65;
        } else if (isHard) {
          baitChance = 0.30;
        } else if (isNightmare) {
          baitChance = 0.15;
        } else if (isOneshot) {
          baitChance = 0.08;
        }

        if (Math.random() < baitChance) {
          setTimeout(() => {
            if (stateActiveRef.current && attackerIndex === 0) {
              setP2State('dodging');
              setTimeout(() => setP2State('idle'), 450);
            }
          }, 80);
        }
      }

      setTimeout(() => {
        setP1State('idle');
        if (p2State === 'dodging') {
          setP2State('idle');
          playHitSound(); // Alert clang
          setP2Penalties(prev => {
            const next = prev + 1;
            addLog(`⚠️ ${p2.name} baited by fake! Penalties: ${next}/3`, 'penalty');
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
      addLog(`👀 ${p2.name} faked slap!`, 'action');

      setTimeout(() => {
        setP2State('idle');
        if (p1State === 'dodging') {
          setP1State('idle');
          playHitSound();
          setP1Penalties(prev => {
            const next = prev + 1;
            addLog(`⚠️ ${p1.name} baited by fake! Penalties: ${next}/3`, 'penalty');
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
      const docRef = doc(db, 'rooms', roomId!);
      if (onlineSide === 0) {
        updateDoc(docRef, {
          'p1.action': 'dodge',
          'p1.lastActive': Date.now()
        }).catch(() => {});
      } else {
        updateDoc(docRef, {
          'p2.action': 'dodge',
          'p2.lastActive': Date.now()
        }).catch(() => {});
      }
    }

    if (playerIdx === 0) {
      setP1State('dodging');
      addLog(`💨 ${p1.name} pulled back!`, 'dodge');
      setTimeout(() => {
        setP1State('idle');
        if (isOnline && onlineSide === 0) {
          updateDoc(doc(db, 'rooms', roomId!), { 'p1.action': 'idle' }).catch(() => {});
        }
      }, 450);
    } else {
      setP2State('dodging');
      addLog(`💨 ${p2.name} pulled back!`, 'dodge');
      setTimeout(() => {
        setP2State('idle');
        if (isOnline && onlineSide === 1) {
          updateDoc(doc(db, 'rooms', roomId!), { 'p2.action': 'idle' }).catch(() => {});
        }
      }, 450);
    }
  };

  const renderHeadAvatar = (fighter: PlayerCustomization, state: string) => {
    if (fighter.imageUrl) {
      return (
        <div className="relative w-full h-full">
          <img src={fighter.imageUrl} alt="AI Fighter Portrait" className={`w-full h-full object-cover transition-all ${state === 'hit' ? 'brightness-50 saturate-150 border-2 border-red-500 animate-pulse' : ''}`} />
          {state === 'dodging' && (
            <div className="absolute inset-0 bg-teal-500/30 flex items-center justify-center text-xs">💨</div>
          )}
          {state === 'slapping' && (
            <div className="absolute inset-x-0 bottom-0 bg-emerald-600/30 text-[8px] font-mono leading-tight font-extrabold text-white text-center">HIT</div>
          )}
        </div>
      );
    }

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
    setCombatLogs([]);
    setMessage('MATCH READY!');
    addLog("🔔 REMATCH REMBRANDT - ROUND 1", "penalty");
  };

  // Determine active view states
  const showActivePlayerControls = onlineSide === undefined || onlineSide === 0;
  const showOpponentPlayerControls = (onlineSide === undefined || onlineSide === 1) && !isVsAI;
  const isLocalSamePhone = !isOnline && onlineSide === undefined && !isVsAI;

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-white font-sans overflow-hidden relative select-none justify-between">
      
      {/* 1. TOP CONTROL BAR FOR SAME PHONE LOCAL - ROTATED 180 */}
      {isLocalSamePhone && (
        <div className={`p-2 bg-slate-950 border-b border-indigo-950/40 flex items-center justify-center shrink-0 z-20 ${
          rotateTopControls ? 'transform rotate-180' : ''
        }`}>
          <div className="grid grid-cols-3 gap-1.5 w-full max-w-sm">
            {attackerIndex === 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => tapFake(1)}
                  disabled={countdown !== null || winner !== null}
                  className="bg-yellow-950/40 hover:bg-yellow-900/10 border border-yellow-900/50 text-yellow-405 font-black text-[9px] py-3.5 uppercase rounded-xl flex flex-col items-center justify-center px-1"
                >
                  <span>SLAP FAKE</span>
                  <span className="text-[7px] font-mono opacity-50">BAIT DODGER</span>
                </button>
                <button
                  type="button"
                  onClick={() => tapSlap(1)}
                  disabled={countdown !== null || winner !== null}
                  className="col-span-2 bg-gradient-to-r from-emerald-600 to-teal-650 text-white font-black text-xs py-3.5 uppercase rounded-xl flex flex-col items-center justify-center"
                >
                  <span className="text-xs">👋 SLAP DUEL 👋</span>
                  <span className="text-[7px] font-mono opacity-80">TAP LAND HIT</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => tapDodge(1)}
                disabled={countdown !== null || winner !== null}
                className="col-span-3 bg-indigo-950 active:bg-indigo-900 border border-indigo-850 text-indigo-400 font-extrabold text-sm py-3.5 uppercase rounded-xl flex flex-col items-center justify-center"
              >
                <span className="text-xs">💨 PULL BACK 💨</span>
                <span className="text-[7px] font-mono opacity-60">TAP WITHIN 220ms WINDOW</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. MAIN ARENA CONTAINER */}
      <div className="flex-grow flex flex-col justify-between p-4 py-8 relative overflow-hidden">
        
        {/* UPPER HUD CONTROLS OVERLAY */}
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
          {isLocalSamePhone && (
            <button
              onClick={() => setRotateTopControls(!rotateTopControls)}
              id="btn-toggle-top-rotate-slap"
              className="p-1.5 rounded-lg bg-black/60 border border-slate-905 pointer-events-auto text-[8px] uppercase tracking-wider text-slate-400 hover:text-white font-bold flex items-center gap-1"
            >
              <RefreshCw className="w-2.5 h-2.5" />
              <span>Rotate P2: {rotateTopControls ? 'ON' : 'OFF'}</span>
            </button>
          )}
        </div>

        <div className="absolute inset-x-0 top-1/4 bottom-1/4 retro-grid-green opacity-20 pointer-events-none" />

        {/* GREEN PLAYER DISPLAY AREA (P2) */}
        <div className="w-full flex flex-col items-center">
          
          <div className={`w-full max-w-sm mb-4 leading-normal ${isLocalSamePhone && rotateTopControls ? 'transform rotate-180' : ''}`}>
            
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
                      i < p2Hearts ? 'text-emerald-400 fill-emerald-505' : 'text-slate-850'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Penalty strikes indicator */}
            <div className="flex justify-start space-x-1 mt-1">
              <span className="text-[8px] text-slate-555 font-mono">Panic dodging penalties:</span>
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

          {/* Character visual ring */}
          <div className="relative mt-2">
            {p2State === 'slapping' && (
              <motion.div 
                initial={{ scale: 0.8 }}
                animate={{ scale: 1.3, y: 15 }}
                className="absolute -bottom-4 z-20 text-3xl"
              >
                💥
              </motion.div>
            )}

            <div className={`w-16 h-16 rounded-full border-4 flex items-center justify-center overflow-hidden bg-slate-900 shadow-xl ${
              p2State === 'hit' ? 'border-yellow-405 animate-head-shake' : 'border-emerald-500'
            }`}>
              {renderHeadAvatar(p2, p2State)}
            </div>

            {p2State === 'dodging' && (
              <span className="absolute -bottom-2 inset-x-0 text-center text-[9px] font-mono font-bold bg-amber-950 text-amber-400 border border-amber-850 py-0.5 rounded uppercase tracking-wider">
                Dodged!
              </span>
            )}
          </div>

        </div>

        {/* COMBAT REVOLVING TICKER LOG HISTORY */}
        <div className="w-full flex justify-center py-2 pointer-events-none relative z-11">
          <div className="w-64 bg-slate-900/90 border border-slate-800/80 rounded-xl p-1.5 px-3 flex flex-col items-center justify-center shadow-lg">
            {combatLogs.length === 0 ? (
              <span className="text-[8px] text-slate-500 uppercase tracking-widest font-mono animate-pulse">👋 Ready to Slap! 👋</span>
            ) : (
              <div className="w-full space-y-0.5 text-center">
                {combatLogs.slice(0, 3).map((log) => (
                  <div key={log.id} className={`text-[9px] uppercase font-mono tracking-tight leading-3 truncate ${log.color}`}>
                    {log.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RED PLAYER DISPLAY AREA (P1) */}
        <div className="w-full flex flex-col items-center">
          
          <div className="relative mb-2">
            {p1State === 'slapping' && (
              <motion.div 
                initial={{ scale: 0.8 }}
                animate={{ scale: 1.3, y: -15 }}
                className="absolute -top-4 z-20 text-3xl"
              >
                💥
              </motion.div>
            )}

            <div className={`w-16 h-16 rounded-full border-4 flex items-center justify-center overflow-hidden bg-slate-900 shadow-xl ${
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
                      i < p1Hearts ? 'text-rose-500 fill-rose-600' : 'text-slate-850'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Penalty strikes indicator */}
            <div className="flex justify-start space-x-1 mt-1">
              <span className="text-[8px] text-slate-555 font-mono">Panic dodging penalties:</span>
              <div className="flex space-x-0.5">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-2.5 h-2.5 rounded-full border border-slate-800 flex items-center justify-center text-[7px] font-black leading-none ${
                      i < p1Penalties ? 'bg-orange-600 text-white' : 'bg-slate-950 text-slate-705'
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

      {/* 3. CONTROL PADS SPANELS SPLIT-GRID */}
      <div className={`w-full shrink-0 ${isLocalSamePhone ? 'p-2 bg-slate-950 border-t border-slate-900' : 'h-52 grid grid-rows-2 border-t border-slate-900 bg-slate-950 relative z-20'}`}>
        
        {/* PLAYER GREEN (TOP) CONTROLS PANEL */}
        {!isLocalSamePhone && (
          <div className="p-2 bg-slate-950 border-b border-slate-900/60 flex items-center justify-center relative select-none">
            {!showOpponentPlayerControls && (
              <div className="absolute inset-0 bg-black/75 z-40 flex items-center justify-center border-b border-slate-850">
                <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase font-mono">
                  Remote Fighter Control Window
                </span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 w-full max-w-sm h-full">
              {attackerIndex === 1 ? (
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
                    className="col-span-2 bg-gradient-to-r from-emerald-600 to-teal-650 active:from-emerald-700 text-white font-extrabold text-xs uppercase rounded-xl flex flex-col items-center justify-center"
                  >
                    <span className="text-sm">⚡ SLAP DUEL ⚡</span>
                    <span className="text-[8px] font-mono tracking-wider opacity-90">TAP TO LAND HIT</span>
                  </button>
                </>
              ) : (
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
        )}

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
                Do not blink! Quick dodge fakes or suffer a slap!
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
            <div className="absolute top-0 inset-x-0 bottom-0 retro-grid opacity-20 pointer-events-none" />

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
                winner.color === 'red' ? 'border-red-500 shadow-red-950' : 'border-emerald-500 shadow-emerald-950'
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
