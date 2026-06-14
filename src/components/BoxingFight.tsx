import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Sparkles, Zap, Heart, RotateCcw, Home, RefreshCw, Smartphone } from 'lucide-react';
import { PlayerCustomization, PlayerAction } from '../types';
import { playPunchSound, playHitSound, playBlockSound, playFanfare, playDefeatSound } from '../utils/audio';
import { db } from '../lib/firebase';
import { doc, onSnapshot, updateDoc, getDoc } from 'firebase/firestore';

interface BoxingFightProps {
  p1: PlayerCustomization; // Red Fighter
  p2: PlayerCustomization; // Green Fighter
  roomId?: string;
  onlineSide?: 0 | 1; // 0 for Red, 1 for Green
  onQuit: () => void;
  isVsAI?: boolean;
}

interface ComicBurst {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
}

export default function BoxingFight({ p1, p2, roomId, onlineSide, onQuit, isVsAI }: BoxingFightProps) {
  const isOnline = !!roomId;
  
  // Players battle states
  const p2MaxHealth = useMemo(() => {
    if (isVsAI || p2.id?.startsWith('bot_')) {
      const botId = p2.id || '';
      const botNameStr = p2.name.toLowerCase();
      if (botId === 'bot_easy' || botNameStr.includes('easy')) return 120; // Easy starts with 120 (harder!)
      if (botId === 'bot_hard' || botNameStr.includes('hard')) return 160; // Hard starts with 160
      if (botId === 'bot_nightmare' || botNameStr.includes('nightmare')) return 220; // Nightmare starts with 220
      if (botId === 'bot_oneshot' || botNameStr.includes('oneshot')) return 100; // Oneshot starts with 100
    }
    return 100;
  }, [p2.id, p2.name, isVsAI]);

  const [p1Health, setP1Health] = useState<number>(100);
  const [p2Health, setP2Health] = useState<number>(p2MaxHealth);
  
  const [p1Stamina, setP1Stamina] = useState<number>(100);
  const [p2Stamina, setP2Stamina] = useState<number>(100);

  const [p1Action, setP1Action] = useState<PlayerAction>('idle');
  const [p2Action, setP2Action] = useState<PlayerAction>('idle');

  const [winner, setWinner] = useState<PlayerCustomization | null>(null);
  const [countdown, setCountdown] = useState<number | null>(3);
  const [activeBursts, setActiveBursts] = useState<ComicBurst[]>([]);

  // Ticker and combat logs
  const [combatLogs, setCombatLogs] = useState<{ id: string; text: string; color: string }[]>([]);

  // Tracks human player punches to detect excessive button spamming
  const p1PunchTimestamps = useRef<number[]>([]);

  // Stun states (block broken)
  const [p1Stunned, setP1Stunned] = useState<boolean>(false);
  const [p2Stunned, setP2Stunned] = useState<boolean>(false);

  // Layout preference: Flipped top controls for local play
  const [rotateTopControls, setRotateTopControls] = useState<boolean>(true);

  // Keep a reference of match state to avoid closure traps in tickers
  const matchActive = countdown === null && !winner;
  const matchActiveRef = useRef<boolean>(false);
  matchActiveRef.current = matchActive;

  // Sync buffers
  const localActionBuffer = useRef<PlayerAction>('idle');
  const lobbyLastUpdate = useRef<number>(0);

  // Comic text candidates
  const COMIC_PHRASE = ['KO!', 'SLAM!', 'BAM!', 'POW!', 'SLAP!', 'WHACK!', 'CRACK!'];

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

  // Match countdown on mount
  useEffect(() => {
    let timer: any;
    if (countdown !== null && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 900);
    } else if (countdown === 0) {
      timer = setTimeout(() => {
        setCountdown(null);
        addLog("🔔 ROUND 1 - FIGHT!", "penalty");
      }, 800);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // Online polling and state updater
  useEffect(() => {
    if (!isOnline) {
      // Offline local AI loop
      const isOpponentAI = isVsAI || (onlineSide === undefined && (p2.name.includes('Bot') || p2.id?.startsWith('bot_')));
      if (isOpponentAI) {
        let actionInterval = 420;

        const botIdStr = p2.id || '';
        const botNameStr = p2.name.toLowerCase();
        const isEasy = botIdStr === 'bot_easy' || botNameStr.includes('easy');
        const isHard = botIdStr === 'bot_hard' || botNameStr.includes('hard');
        const isNightmare = botIdStr === 'bot_nightmare' || botNameStr.includes('nightmare');
        const isOneshot = botIdStr === 'bot_oneshot' || botNameStr.includes('oneshot');

        if (isEasy) {
          actionInterval = 550; // slightly more active than before, but leaves open windows
        } else if (isHard) {
          actionInterval = 320; // fast and aggressive
        } else if (isNightmare) {
          actionInterval = 190; // extremely active
        } else if (isOneshot) {
          actionInterval = 210; // very active, fatal damage
        }
        
        const aiInterval = setInterval(() => {
          if (!matchActiveRef.current || p2Stunned) return;
          
          const rand = Math.random();
          // Strategic stamina check
          if (p2Stamina < 20) {
            // Low stamina - defensive strategies to recover stamina
            p2PerformAction(rand < 0.65 ? 'block' : 'dodge');
            return;
          }

          if (isNightmare || isOneshot) {
            // Nightmare & Oneshot ultra instinct behaviors
            if (p1Action.startsWith('punch')) {
              // React to player's active punched attacks
              p2PerformAction(Math.random() < 0.45 ? 'dodge' : 'block');
              return;
            }
            if (rand < 0.60) {
              // Rapid hook sequence
              p2PerformAction('punch_left');
              setTimeout(() => {
                if (matchActiveRef.current && !p2Stunned && p2Stamina > 20) {
                  p2PerformAction('punch_right');
                }
              }, 100);
            } else if (rand < 0.85) {
              // Dodge and punish sequence!
              p2PerformAction('dodge');
              setTimeout(() => {
                if (matchActiveRef.current && !p2Stunned && p2Stamina > 20) {
                  p2PerformAction(Math.random() < 0.5 ? 'punch_left' : 'punch_right');
                }
              }, 180);
            } else {
              p2PerformAction('block');
            }
          } else if (isHard) {
            // Hard strategic combo behaviors
            if (rand < 0.40) {
              p2PerformAction('punch_right');
            } else if (rand < 0.70) {
              p2PerformAction('punch_left');
              setTimeout(() => {
                if (matchActiveRef.current && !p2Stunned && p2Stamina > 20) {
                  p2PerformAction('punch_right');
                }
              }, 150);
            } else if (rand < 0.88) {
              p2PerformAction('block');
            } else {
              p2PerformAction('dodge');
            }
          } else {
            // Easy strategic actions - simple, reactive
            if (rand < 0.38) {
              p2PerformAction(Math.random() < 0.5 ? 'punch_left' : 'punch_right');
            } else if (rand < 0.55) {
              p2PerformAction('block');
            } else if (rand < 0.65) {
              p2PerformAction('dodge');
            }
          }
        }, actionInterval);
        
        return () => clearInterval(aiInterval);
      }
      return;
    }

    // Bidirectional Firestore game status synchronization
    const docRef = doc(db, 'rooms', roomId!);
    let lastHandledOpponentTimestamp = 0;

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (!docSnap.exists() || !matchActiveRef.current) return;
      const data = docSnap.data();

      const isHost = onlineSide === 0;

      // Retrieve keys for sync variables
      const oppKey = isHost ? 'p2' : 'p1';
      const oppData = data[oppKey];

      if (oppData) {
        // Sync opponent status variables
        if (isHost) {
          setP2Health(oppData.health);
          setP2Stamina(oppData.energy);
          setP2Action(oppData.action as PlayerAction);
        } else {
          setP1Health(oppData.health);
          setP1Stamina(oppData.energy);
          setP1Action(oppData.action as PlayerAction);
        }

        // Process incoming punches only if it's a freshly registered action
        if (oppData.action && oppData.action.startsWith('punch') && oppData.lastActive > lastHandledOpponentTimestamp) {
          lastHandledOpponentTimestamp = oppData.lastActive;

          const myAction = isHost ? p1Action : p2Action;
          const myStamina = isHost ? p1Stamina : p2Stamina;
          const myHealth = isHost ? p1Health : p2Health;

          addLog(`⚡ ${isHost ? p2.name : p1.name} threw JAB!`, 'action');

          if (myAction === 'dodge') {
            playPunchSound(); // Swing and miss
            addLog(`💨 ${isHost ? p1.name : p2.name} dodged!`, 'dodge');
          } else if (myAction === 'block') {
            playBlockSound();
            addLog(`🛡️ ${isHost ? p1.name : p2.name} blocked!`, 'block');
            const nextStam = Math.max(0, myStamina - 18);
            if (isHost) {
              setP1Stamina(nextStam);
              updateDoc(docRef, {
                'p1.energy': nextStam,
                'p1.lastActive': Date.now()
              });
            } else {
              setP2Stamina(nextStam);
              updateDoc(docRef, {
                'p2.energy': nextStam,
                'p2.lastActive': Date.now()
              });
            }
          } else {
            // Hit lands
            playHitSound();
            addBurst(!isHost);

            const nextHealth = Math.max(0, myHealth - 10);
            addLog(`💥 ${isHost ? p2.name : p1.name} landed HIT!`, 'hit');

            if (isHost) {
              setP1Health(nextHealth);
              setP1Action('hit');
              updateDoc(docRef, {
                'p1.health': nextHealth,
                'p1.action': 'hit',
                'p1.lastActive': Date.now()
              });

              if (nextHealth === 0) {
                updateDoc(docRef, { status: 'ended' });
                triggerMatchWin(p2);
              }
              setTimeout(() => {
                setP1Action('idle');
                updateDoc(docRef, { 'p1.action': 'idle' });
              }, 250);
            } else {
              setP2Health(nextHealth);
              setP2Action('hit');
              updateDoc(docRef, {
                'p2.health': nextHealth,
                'p2.action': 'hit',
                'p2.lastActive': Date.now()
              });

              if (nextHealth === 0) {
                updateDoc(docRef, { status: 'ended' });
                triggerMatchWin(p1);
              }
              setTimeout(() => {
                setP2Action('idle');
                updateDoc(docRef, { 'p2.action': 'idle' });
              }, 250);
            }
          }
        }
      }

      // Check ended status
      if (data.status === 'ended' || (data.p1 && data.p1.health <= 0) || (data.p2 && data.p2.health <= 0)) {
        if (data.p1?.health <= 0 && !winner) {
          triggerMatchWin(p2);
        } else if (data.p2?.health <= 0 && !winner) {
          triggerMatchWin(p1);
        }
      }
    });

    return () => unsubscribe();
  }, [isOnline, p1Health, p2Health, p1Stamina, p2Stamina, onlineSide, winner, p1Action, p2Action]);

  // Stamina passive replication/recovery ticker
  useEffect(() => {
    const staminaTicker = setInterval(() => {
      if (!matchActiveRef.current) return;
      
      setP1Stamina(prev => {
        if (p1Action === 'block') return Math.max(0, prev - 2.5); // block drains
        if (p1Stunned) return Math.min(100, prev + 2.0);
        return Math.min(100, prev + 4.5);
      });

      setP2Stamina(prev => {
        if (p2Action === 'block') return Math.max(0, prev - 2.5);
        if (p2Stunned) return Math.min(100, prev + 2.0);
        return Math.min(100, prev + 4.5);
      });
    }, 100);

    return () => clearInterval(staminaTicker);
  }, [p1Action, p2Action, p1Stunned, p2Stunned]);

  // Check stun conditions
  useEffect(() => {
    if (p1Stamina <= 0 && !p1Stunned) {
      setP1Stunned(true);
      setP1Action('idle');
      addLog(`💫 ${p1.name}'s block was BROKEN (Stunned)!`, 'penalty');
      // Stun recovery
      setTimeout(() => {
        setP1Stunned(false);
        setP1Stamina(60);
      }, 1500);
    }
  }, [p1Stamina, p1Stunned]);

  useEffect(() => {
    if (p2Stamina <= 0 && !p2Stunned) {
      setP2Stunned(true);
      setP2Action('idle');
      addLog(`💫 ${p2.name}'s block was BROKEN (Stunned)!`, 'penalty');
      // Stun recovery
      setTimeout(() => {
        setP2Stunned(false);
        setP2Stamina(60);
      }, 1500);
    }
  }, [p2Stamina, p2Stunned]);

  const timestampNow = () => Date.now();

  const addBurst = (isRedTarget: boolean) => {
    const text = COMIC_PHRASE[Math.floor(Math.random() * COMIC_PHRASE.length)];
    const id = Math.random().toString();
    const burst: ComicBurst = {
      id,
      text,
      x: isRedTarget ? 130 + Math.random() * 40 : 130 + Math.random() * 40,
      y: isRedTarget ? 140 + Math.random() * 40 : 220 + Math.random() * 40,
      color: isRedTarget ? 'text-red-500 border-red-500 animate-pulse' : 'text-emerald-400 border-emerald-500 animate-pulse'
    };
    
    setActiveBursts(prev => [...prev, burst]);
    setTimeout(() => {
      setActiveBursts(prev => prev.filter(b => b.id !== id));
    }, 550);
  };

  // Combat Execution Rules (Local Mode)
  const processFistImpact = (attacker: 0 | 1) => {
    if (!matchActiveRef.current) return;

    if (attacker === 0) {
      // Player 1 (Red) punches Player 2 (Green)
      if (p2Action === 'dodge') {
        playPunchSound(); // Air swing
        addLog(`💨 ${p2.name} dodged ${p1.name}'s hook!`, 'dodge');
        return;
      }
      if (p2Action === 'block') {
        playBlockSound();
        addLog(`🛡️ ${p2.name} blocked ${p1.name}!`, 'block');
        
        let blockCost = 18;
        if (isVsAI || p2.id?.startsWith('bot_')) {
          const botIdStr = p2.id || '';
          if (botIdStr === 'bot_hard') blockCost = 13;
          else if (botIdStr === 'bot_nightmare') blockCost = 8;
          else if (botIdStr === 'bot_oneshot') blockCost = 5;
        }
        setP2Stamina(prev => Math.max(0, prev - blockCost));
        return;
      }
      
      // Real landing
      playHitSound();
      addBurst(true);
      setP2Action('hit');
      
      let playerDamage = 10;
      if (isVsAI || p2.id?.startsWith('bot_')) {
        const botIdStr = p2.id || '';
        const botNameStr = p2.name.toLowerCase();
        const isEasy = botIdStr === 'bot_easy' || botNameStr.includes('easy');
        const isHard = botIdStr === 'bot_hard' || botNameStr.includes('hard');
        const isNightmare = botIdStr === 'bot_nightmare' || botNameStr.includes('nightmare');
        const isOneshot = botIdStr === 'bot_oneshot' || botNameStr.includes('oneshot');

        if (isEasy) {
          playerDamage = 11; // normal
        } else if (isHard) {
          playerDamage = 7.5; // Armor Mode reduces player punch impact
        } else if (isNightmare) {
          playerDamage = 5.5; // Heavy Boss Armor
        } else if (isOneshot) {
          playerDamage = 10;
        }
      }
      
      addLog(`💥 ${p1.name} hit ${p2.name} for ${Math.round(playerDamage)} dmg!`, 'hit');
      setP2Health(prev => {
        const next = Math.max(0, prev - playerDamage);
        if (next === 0) triggerMatchWin(p1);
        return next;
      });
      setTimeout(() => setP2Action('idle'), 250);
    } else {
      // Player 2 (Green) punches Player 1 (Red)
      if (p1Action === 'dodge') {
        playPunchSound();
        addLog(`💨 ${p1.name} dodged ${p2.name}'s hook!`, 'dodge');
        return;
      }
      if (p1Action === 'block') {
        playBlockSound();
        addLog(`🛡️ ${p1.name} blocked ${p2.name}!`, 'block');
        setP1Stamina(prev => Math.max(0, prev - 18));
        return;
      }

      // Real landing
      playHitSound();
      addBurst(false);
      setP1Action('hit');
      let damage = 10;
      if (isVsAI || p2.id?.startsWith('bot_')) {
        const botId = p2.id || '';
        const botNameStr = p2.name.toLowerCase();
        if (botId === 'bot_easy' || botNameStr.includes('easy')) damage = 8;
        else if (botId === 'bot_hard' || botNameStr.includes('hard')) damage = 14;
        else if (botId === 'bot_nightmare' || botNameStr.includes('nightmare')) damage = 22; // Extreme heavy strike
        else if (botId === 'bot_oneshot' || botNameStr.includes('oneshot')) damage = 100; // Absolute One-Shot fatal power!
      }
      addLog(`💥 ${p2.name} hit ${p1.name} for ${damage} dmg!`, 'hit');
      setP1Health(prev => {
        const next = Math.max(0, prev - damage);
        if (next === 0) triggerMatchWin(p2);
        return next;
      });
      setTimeout(() => setP1Action('idle'), 250);
    }
  };

  const triggerMatchWin = (crownWinner: PlayerCustomization) => {
    setWinner(crownWinner);
    addLog(`🏆 MATCH OVER! WINNER: ${crownWinner.name}!`, 'penalty');
    if ((onlineSide !== undefined && onlineSide === 0 && crownWinner.color === 'red') || 
        (onlineSide !== undefined && onlineSide === 1 && crownWinner.color === 'green') ||
        (onlineSide === undefined && crownWinner.color === 'red')) {
      playFanfare();
    } else {
      playDefeatSound();
    }
  };

  // Action methods
  const p1PerformAction = (act: PlayerAction) => {
    if (!matchActive || p1Stunned) return;

    // Stamina constraints for punches and dodge
    if (act.startsWith('punch') && p1Stamina < 15) {
      playBlockSound();
      return; 
    }
    if (act === 'dodge' && p1Stamina < 20) {
      playBlockSound();
      return;
    }

    setP1Action(act);
    const cost = act.startsWith('punch') ? 15 : act === 'dodge' ? 20 : 0;
    const nextStam = Math.max(0, p1Stamina - cost);
    setP1Stamina(nextStam);

    addLog(`🔴 ${p1.name} performed ${act === 'dodge' ? 'lean dodge' : act === 'block' ? 'block' : 'jab'}`, 'action');

    // AI reactive triggers if P1 punches and playing VS AI
    const opponentIsBot = isVsAI || (onlineSide === undefined && (p2.name.includes('Bot') || p2.id?.startsWith('bot_')));
    if (act.startsWith('punch') && opponentIsBot && !p2Stunned && p2Action === 'idle') {
      const nowTime = Date.now();
      if (!p1PunchTimestamps.current) {
        p1PunchTimestamps.current = [];
      }
      p1PunchTimestamps.current = p1PunchTimestamps.current.filter(t => nowTime - t < 1400);
      p1PunchTimestamps.current.push(nowTime);
      const isSpamming = p1PunchTimestamps.current.length >= 3;

      let reactionChance = 0.50;
      let reactionDelay = 130;
      
      const botIdStr = p2.id || '';
      const botNameStr = p2.name.toLowerCase();
      const isEasy = botIdStr === 'bot_easy' || botNameStr.includes('easy');
      const isHard = botIdStr === 'bot_hard' || botNameStr.includes('hard');
      const isNightmare = botIdStr === 'bot_nightmare' || botNameStr.includes('nightmare');
      const isOneshot = botIdStr === 'bot_oneshot' || botNameStr.includes('oneshot');

      if (isEasy) {
        reactionChance = isSpamming ? 0.70 : 0.28;
        reactionDelay = isSpamming ? 95 : 160;
      } else if (isHard) {
        reactionChance = isSpamming ? 0.92 : 0.65;
        reactionDelay = isSpamming ? 40 : 95;
      } else if (isNightmare) {
        reactionChance = isSpamming ? 0.98 : 0.88;
        reactionDelay = isSpamming ? 20 : 65;
      } else if (isOneshot) {
        reactionChance = isSpamming ? 0.99 : 0.92;
        reactionDelay = isSpamming ? 10 : 40;
      }

      if (isSpamming) {
        addLog(`⚡ ${p2.name} ACTIVE COUNTER: ANTI-SPAM EVASION!`, 'dodge');
      }

      if (Math.random() < reactionChance) {
        setTimeout(() => {
          if (matchActiveRef.current && !p2Stunned) {
            const defense = Math.random() < 0.40 ? 'block' : 'dodge';
            p2PerformAction(defense);
          }
        }, reactionDelay); // micro reflex speed delay
      }
    }

    if (isOnline && onlineSide === 0) {
      const docRef = doc(db, 'rooms', roomId!);
      updateDoc(docRef, {
        p1: {
          displayName: p1.name,
          faces: p1.faces,
          health: p1Health,
          energy: nextStam,
          action: act,
          lastActive: Date.now()
        }
      }).catch(err => console.error("Firestore action write failed:", err));
    }

    if (act.startsWith('punch')) {
      playPunchSound();
      // Try hit logic (local offline play immediately, online waits for synchronization)
      if (!isOnline) {
        processFistImpact(0);
      }
      // Return to idle
      setTimeout(() => {
        setP1Action('idle');
        if (isOnline && onlineSide === 0) {
          updateDoc(doc(db, 'rooms', roomId!), { 'p1.action': 'idle' }).catch(() => {});
        }
      }, 200);
    } else if (act === 'dodge') {
      setTimeout(() => {
        setP1Action('idle');
        if (isOnline && onlineSide === 0) {
          updateDoc(doc(db, 'rooms', roomId!), { 'p1.action': 'idle' }).catch(() => {});
        }
      }, 220);
    } else if (act === 'block') {
      // Block is held or triggers simple duration
      setTimeout(() => {
        setP1Action('idle');
        if (isOnline && onlineSide === 0) {
          updateDoc(doc(db, 'rooms', roomId!), { 'p1.action': 'idle' }).catch(() => {});
        }
      }, 450);
    }
  };

  const p2PerformAction = (act: PlayerAction) => {
    if (!matchActive || p2Stunned) return;

    if (act.startsWith('punch') && p2Stamina < 15) return;
    if (act === 'dodge' && p2Stamina < 20) return;

    setP2Action(act);
    const cost = act.startsWith('punch') ? 15 : act === 'dodge' ? 20 : 0;
    const nextStam = Math.max(0, p2Stamina - cost);
    setP2Stamina(nextStam);

    addLog(`🟢 ${p2.name} performed ${act === 'dodge' ? 'lean dodge' : act === 'block' ? 'block' : 'jab'}`, 'action');

    if (isOnline && onlineSide === 1) {
      const docRef = doc(db, 'rooms', roomId!);
      updateDoc(docRef, {
        p2: {
          displayName: p2.name,
          faces: p2.faces,
          health: p2Health,
          energy: nextStam,
          action: act,
          lastActive: Date.now()
        }
      }).catch(err => console.error("Firestore action write failed:", err));
    }

    if (act.startsWith('punch')) {
      playPunchSound();
      if (!isOnline) {
        processFistImpact(1);
      }
      setTimeout(() => {
        setP2Action('idle');
        if (isOnline && onlineSide === 1) {
          updateDoc(doc(db, 'rooms', roomId!), { 'p2.action': 'idle' }).catch(() => {});
        }
      }, 200);
    } else if (act === 'dodge') {
      setTimeout(() => {
        setP2Action('idle');
        if (isOnline && onlineSide === 1) {
          updateDoc(doc(db, 'rooms', roomId!), { 'p2.action': 'idle' }).catch(() => {});
        }
      }, 220);
    } else if (act === 'block') {
      setTimeout(() => {
        setP2Action('idle');
        if (isOnline && onlineSide === 1) {
          updateDoc(doc(db, 'rooms', roomId!), { 'p2.action': 'idle' }).catch(() => {});
        }
      }, 450);
    }
  };

  const designHeadAvatar = (fighter: PlayerCustomization, action: PlayerAction) => {
    // If the opponent is a Bot / has a beautiful unsplash combat preset background
    if (fighter.imageUrl) {
      return (
        <div className="relative w-full h-full">
          <img src={fighter.imageUrl} alt="AI Fighter Portrait" className={`w-full h-full object-cover transition-all ${action === 'hit' ? 'brightness-50 saturate-150 border-2 border-red-500 animate-pulse' : ''}`} />
          {action === 'block' && (
            <div className="absolute inset-0 bg-blue-500/30 flex items-center justify-center font-bold text-xs">🛡️</div>
          )}
          {action.startsWith('punch') && (
            <div className="absolute inset-x-0 bottom-0 bg-red-600/30 text-[8px] font-mono leading-tight font-extrabold text-white text-center">HIT</div>
          )}
        </div>
      );
    }

    if (fighter.avatarType === 'camera' && fighter.faces.normal) {
      let src = fighter.faces.normal;
      if (action.startsWith('punch') && fighter.faces.attack) {
        src = fighter.faces.attack;
      } else if (action === 'hit' && fighter.faces.hit) {
        src = fighter.faces.hit;
      }
      return <img src={src} alt="Face Photo" className="w-full h-full object-cover scale-x-[-1]" />;
    }

    // Default stock presets representation
    const isRed = fighter.color === 'red';
    let emoji = isRed ? '😡' : '👽';
    if (action.startsWith('punch')) emoji = '🦁';
    else if (action === 'hit') emoji = '😵';
    else if (action === 'block') emoji = '🛡️';

    return <span className="text-4xl">{emoji}</span>;
  };

  const handleRematch = () => {
    setP1Health(100);
    setP2Health(p2MaxHealth);
    setP1Stamina(100);
    setP2Stamina(100);
    setP1Action('idle');
    setP2Action('idle');
    setWinner(null);
    setCountdown(3);
    setCombatLogs([]);
    addLog("🔔 REMATCH REMBRANDT - ROUND 1", "penalty");
  };

  const showActivePlayerControls = onlineSide === undefined || onlineSide === 0;
  const showOpponentPlayerControls = (onlineSide === undefined || onlineSide === 1) && !isVsAI;
  const isLocalSamePhone = !isOnline && onlineSide === undefined && !isVsAI;

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-white font-sans overflow-hidden relative select-none justify-between">
      
      {/* 1. TOP MIRRORED PAD - ONLY IF SAME PHONE LOCAL */}
      {isLocalSamePhone && (
        <div className={`p-2 bg-slate-950 border-b border-indigo-950/40 flex items-center justify-center shrink-0 z-20 ${
          rotateTopControls ? 'transform rotate-180' : ''
        }`}>
          <div className="grid grid-cols-4 gap-1.5 w-full max-w-sm">
            <button
              onTouchStart={() => p2PerformAction('dodge')}
              onClick={() => p2PerformAction('dodge')}
              id="btn-p2-dodge"
              disabled={countdown !== null || p2Stunned || winner !== null}
              className="bg-emerald-950/50 hover:bg-emerald-900/20 border border-emerald-950/50 text-emerald-400 font-extrabold text-[9px] py-3 uppercase rounded-xl flex flex-col items-center justify-center"
            >
              <span>DODGE</span>
              <span className="text-[7px] font-mono opacity-50">LEAN</span>
            </button>
            <button
              onTouchStart={() => p2PerformAction('punch_left')}
              onClick={() => p2PerformAction('punch_left')}
              id="btn-p2-left"
              disabled={countdown !== null || p2Stunned || winner !== null}
              className="bg-gradient-to-b from-emerald-600 to-emerald-700 text-white font-extrabold text-[9px] py-3 uppercase rounded-xl flex flex-col items-center justify-center border-b-2 border-emerald-800"
            >
              <span>JAB L</span>
              <span className="text-[6px] font-mono opacity-80">(15 EN)</span>
            </button>
            <button
              onTouchStart={() => p2PerformAction('punch_right')}
              onClick={() => p2PerformAction('punch_right')}
              id="btn-p2-right"
              disabled={countdown !== null || p2Stunned || winner !== null}
              className="bg-gradient-to-b from-emerald-600 to-emerald-700 text-white font-extrabold text-[9px] py-3 uppercase rounded-xl flex flex-col items-center justify-center border-b-2 border-emerald-800"
            >
              <span>JAB R</span>
              <span className="text-[6px] font-mono opacity-80">(15 EN)</span>
            </button>
            <button
              onTouchStart={() => p2PerformAction('block')}
              onClick={() => p2PerformAction('block')}
              id="btn-p2-block"
              disabled={countdown !== null || p2Stunned || winner !== null}
              className="bg-sky-950/60 hover:bg-sky-905 border border-sky-900/40 text-sky-450 font-extrabold text-[9px] py-3 uppercase rounded-xl flex flex-col items-center justify-center"
            >
              <Shield className="w-3 h-3 mb-0.5" />
              <span>BLOCK</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. MATCH PLAYGROUND INTERACTIVE FLOOR CONTAINER */}
      <div className="flex-grow flex flex-col justify-between p-4 py-8 relative overflow-hidden">
        
        {/* UPPER FIXED HUD CONTROLS */}
        <div className="absolute top-2 left-2 right-2 flex justify-between items-center z-30 pointer-events-none">
          <button
            onClick={onQuit}
            id="btn-quit-match-overlay"
            className="p-1 px-2.5 rounded-lg bg-black/60 border border-slate-905 pointer-events-auto text-[9px] font-bold text-slate-400 hover:text-white uppercase tracking-wider"
          >
            Quit
          </button>
          {isOnline && (
            <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-400 font-mono text-[9px] uppercase tracking-widest font-bold">
              ROOM: {roomId}
            </span>
          )}
          {isLocalSamePhone && (
            <button
              onClick={() => setRotateTopControls(!rotateTopControls)}
              id="btn-toggle-top-rotate"
              className="p-1 rounded-lg bg-black/60 border border-slate-905 pointer-events-auto text-[8px] uppercase tracking-wider text-slate-400 hover:text-white font-bold flex items-center gap-1"
            >
              <RefreshCw className="w-2.5 h-2.5" />
              <span>Rotate P2: {rotateTopControls ? 'ON' : 'OFF'}</span>
            </button>
          )}
        </div>

        <div className="absolute inset-x-0 top-1/4 bottom-1/4 retro-grid opacity-20 pointer-events-none" />

        {/* TOP PLAYER GAUGE & CHARACTER PANEL */}
        <div className="w-full flex flex-col items-center">
          {/* Top Player Labels & Health Bar */}
          <div className={`w-full max-w-sm mb-3.5 transition-all ${isLocalSamePhone && rotateTopControls ? 'transform rotate-180' : ''}`}>
            <div className="flex justify-between items-end mb-1">
              <span className="text-[10px] font-extrabold tracking-wider text-emerald-450 uppercase flex items-center gap-1">
                <Smartphone className="w-3 h-3" />
                <span>{p2.name}</span>
              </span>
              <span className="text-xs font-black text-emerald-450 font-mono">
                {p2Health}%
              </span>
            </div>
            
            <div className="h-2 w-full bg-slate-900 border border-slate-800 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-emerald-500" 
                animate={{ width: `${p2Health}%` }}
                transition={{ duration: 0.15 }}
              />
            </div>

            <div className="h-1 w-full bg-slate-900 border-x border-b border-slate-800 rounded-b-full overflow-hidden flex">
              <motion.div 
                className={`h-full ${p2Stunned ? 'bg-amber-500 animate-pulse' : 'bg-blue-500'}`}
                animate={{ width: `${p2Stamina}%` }}
                transition={{ duration: 0.05 }}
              />
            </div>
          </div>

          {/* Top Animated Fighter Figure Body */}
          <motion.div 
            className="relative"
            animate={{
              y: p2Action === 'punch_left' || p2Action === 'punch_right' ? 38 : p2Action === 'hit' ? -12 : 0,
              x: p2Action === 'dodge' ? -35 : 0,
              rotate: p2Action === 'hit' ? -8 : 0
            }}
            transition={{ type: 'spring', damping: 11, stiffness: 180 }}
          >
            {p2Action === 'block' && (
              <div className="absolute inset-0 rounded-full border-4 border-dashed border-emerald-500 animate-spin opacity-80" />
            )}

            <div className={`w-16 h-16 rounded-full border-4 flex items-center justify-center overflow-hidden bg-slate-900 shadow-xl ${
              p2Action === 'hit' ? 'border-yellow-400 animate-head-shake' : 'border-emerald-500 shadow-emerald-950/20'
            }`}>
              {designHeadAvatar(p2, p2Action)}
            </div>

            {p2Action === 'punch_left' && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1.2 }} className="absolute -bottom-4 -left-2 w-6 h-6 rounded-full bg-emerald-600 border border-white flex items-center justify-center font-bold text-xs shadow-lg">🥊</motion.div>
            )}
            {p2Action === 'punch_right' && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1.2 }} className="absolute -bottom-4 -right-2 w-6 h-6 rounded-full bg-emerald-600 border border-white flex items-center justify-center font-bold text-xs shadow-lg">🥊</motion.div>
            )}
            {p2Stunned && <span className="absolute -bottom-4 inset-x-0 text-center text-xs animate-bounce">💫😵💫</span>}
          </motion.div>
        </div>

        {/* REVOLVING CENTER ACTION LOGS TAPE TICKER */}
        <div className="absolute inset-x-0 bottom-[40%] top-[40%] z-5 pointer-events-none flex flex-col items-center justify-center">
          <div className="w-56 p-1.5 px-3 bg-black/75 border border-slate-900 rounded-xl space-y-0.5 text-center shadow-lg">
            {combatLogs.length === 0 ? (
              <span className="text-[8px] text-slate-500 font-mono uppercase tracking-widest block py-1.5 animate-pulse">Waiting action</span>
            ) : (
              combatLogs.slice(0, 3).map((log) => (
                <div key={log.id} className={`text-[8.5px] uppercase font-mono tracking-tight truncate ${log.color}`}>
                  {log.text}
                </div>
              ))
            )}
          </div>
        </div>

        {/* MID SCREEN HIT COMIC VFX FLOATER */}
        <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
          <AnimatePresence>
            {activeBursts.map((burst) => (
              <motion.div
                key={burst.id}
                initial={{ scale: 0.2, rotate: -25, opacity: 0 }}
                animate={{ scale: 1.4, rotate: Math.random() * 20 - 10, opacity: 1 }}
                exit={{ scale: 1.8, opacity: 0 }}
                className={`absolute px-4 py-2 border-4 bg-slate-950 rounded-xl font-black text-2xl uppercase font-mono tracking-widest ${burst.color} glow-red`}
                style={{ top: `${burst.y}px` }}
              >
                {burst.text}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* BOTTOM PLAYER GAUGE & CHARACTER PANEL */}
        <div className="w-full flex flex-col items-center">
          <motion.div 
            className="relative"
            animate={{
              y: p1Action === 'punch_left' || p1Action === 'punch_right' ? -38 : p1Action === 'hit' ? 12 : 0,
              x: p1Action === 'dodge' ? 35 : 0,
              rotate: p1Action === 'hit' ? 8 : 0
            }}
            transition={{ type: 'spring', damping: 11, stiffness: 180 }}
          >
            {p1Action === 'block' && (
              <div className="absolute inset-0 rounded-full border-4 border-dashed border-red-500 animate-spin opacity-80" />
            )}

            <div className={`w-16 h-16 rounded-full border-4 flex items-center justify-center overflow-hidden bg-slate-900 shadow-xl ${
              p1Action === 'hit' ? 'border-yellow-400 animate-head-shake' : 'border-red-500 shadow-red-950/20'
            }`}>
              {designHeadAvatar(p1, p1Action)}
            </div>

            {p1Action === 'punch_left' && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1.2 }} className="absolute -top-4 -left-2 w-6 h-6 rounded-full bg-red-600 border border-white flex items-center justify-center font-bold text-xs shadow-lg">🥊</motion.div>
            )}
            {p1Action === 'punch_right' && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1.2 }} className="absolute -top-4 -right-2 w-6 h-6 rounded-full bg-red-600 border border-white flex items-center justify-center font-bold text-xs shadow-lg">🥊</motion.div>
            )}
            {p1Stunned && <span className="absolute -top-4 inset-x-0 text-center text-xs animate-bounce">💫😵💫</span>}
          </motion.div>

          {/* Bottom Player Labels & Health Bar */}
          <div className="w-full max-w-sm mt-3.5 leading-normal">
            <div className="flex justify-between items-end mb-1">
              <span className="text-[10px] font-extrabold tracking-wider text-rose-500 uppercase flex items-center gap-1">
                <Smartphone className="w-3 h-3" />
                <span>{p1.name}</span>
              </span>
              <span className="text-xs font-black text-rose-500 font-mono">
                {p1Health}%
              </span>
            </div>
            
            <div className="h-2.5 w-full bg-slate-900 border border-slate-800 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-red-500" 
                animate={{ width: `${p1Health}%` }}
                transition={{ duration: 0.15 }}
              />
            </div>

            <div className="h-1.5 w-full bg-slate-900 border-x border-b border-slate-800 rounded-b-full overflow-hidden flex">
              <motion.div 
                className={`h-full ${p1Stunned ? 'bg-amber-500 animate-pulse' : 'bg-blue-500'}`}
                animate={{ width: `${p1Stamina}%` }}
                transition={{ duration: 0.05 }}
              />
            </div>
          </div>
        </div>

      </div>

      {/* 3. SCREEN PANELS SPLIT-GRID FOR ACTION BUTTON CONTROLS (only if NOT same phone split) */}
      <div className={`w-full shrink-0 ${isLocalSamePhone ? 'p-2 bg-slate-950 border-t border-slate-900' : isVsAI ? 'h-26 border-t border-slate-900 z-20 relative bg-slate-950' : 'h-52 grid grid-rows-2 border-t border-slate-900 z-20 relative bg-slate-950'}`}>
        
        {/* PLAYER GREEN (TOP) CONTROLS ROW */}
        {!isLocalSamePhone && !isVsAI && (
          <div className="p-2 bg-slate-950 border-b border-slate-900/60 flex items-center justify-center select-none relative">
            {!showOpponentPlayerControls && (
              <div className="absolute inset-0 bg-black/75 z-40 flex items-center justify-center border-b border-slate-850">
                <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase font-mono">
                  Remote Fighter Control Window
                </span>
              </div>
            )}

            <div className="grid grid-cols-4 gap-2 w-full max-w-sm h-full">
              <button
                onTouchStart={() => p2PerformAction('dodge')}
                onClick={() => p2PerformAction('dodge')}
                id="btn-p2-dodge"
                disabled={countdown !== null || p2Stunned || winner !== null}
                className="bg-emerald-950/40 hover:bg-emerald-900/10 border border-emerald-900/30 text-emerald-400 font-extrabold text-[10px] uppercase rounded-xl flex flex-col items-center justify-center"
              >
                <span>DODGE</span>
                <span className="text-[8px] font-mono opacity-60">LEAN</span>
              </button>

              <button
                onTouchStart={() => p2PerformAction('punch_left')}
                onClick={() => p2PerformAction('punch_left')}
                id="btn-p2-left"
                disabled={countdown !== null || p2Stunned || winner !== null}
                className="bg-gradient-to-b from-emerald-600 to-emerald-700 active:from-emerald-700 text-white font-extrabold text-[10px] uppercase rounded-xl flex flex-col items-center justify-center border-b-2 border-emerald-800"
              >
                <span>JAB L</span>
                <span className="text-[7px] font-mono opacity-80">(15 EN)</span>
              </button>

              <button
                onTouchStart={() => p2PerformAction('punch_right')}
                onClick={() => p2PerformAction('punch_right')}
                id="btn-p2-right"
                disabled={countdown !== null || p2Stunned || winner !== null}
                className="bg-gradient-to-b from-emerald-600 to-emerald-700 active:from-emerald-700 text-white font-extrabold text-[10px] uppercase rounded-xl flex flex-col items-center justify-center border-b-2 border-emerald-800"
              >
                <span>JAB R</span>
                <span className="text-[7px] font-mono opacity-80">(15 EN)</span>
              </button>

              <button
                onTouchStart={() => p2PerformAction('block')}
                onClick={() => p2PerformAction('block')}
                id="btn-p2-block"
                disabled={countdown !== null || p2Stunned || winner !== null}
                className="bg-sky-950 active:bg-sky-900 border border-sky-850 text-sky-400 font-extrabold text-[10px] uppercase rounded-xl flex flex-col items-center justify-center"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>BLOCK</span>
              </button>
            </div>
          </div>
        )}

        {/* PLAYER RED (BOTTOM) CONTROLS ROW */}
        <div className="p-2 bg-slate-950 flex items-center justify-center select-none relative">
          {!showActivePlayerControls && (
            <div className="absolute inset-0 bg-black/75 z-40 flex items-center justify-center">
              <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase font-mono">
                Remote Fighter Control Window
              </span>
            </div>
          )}

          <div className="grid grid-cols-4 gap-2 w-full max-w-sm h-full">
            <button
              onTouchStart={() => p1PerformAction('dodge')}
              onClick={() => p1PerformAction('dodge')}
              id="btn-p1-dodge"
              disabled={countdown !== null || p1Stunned || winner !== null}
              className="bg-red-950/40 hover:bg-red-900/10 border border-red-900/30 text-rose-405 font-extrabold text-[10px] uppercase rounded-xl flex flex-col items-center justify-center py-2.5"
            >
              <span>DODGE</span>
              <span className="text-[8px] font-mono opacity-60">LEAN</span>
            </button>

            <button
              onTouchStart={() => p1PerformAction('punch_left')}
              onClick={() => p1PerformAction('punch_left')}
              id="btn-p1-left"
              disabled={countdown !== null || p1Stunned || winner !== null}
              className="bg-gradient-to-b from-red-600 to-red-700 active:from-red-700 text-white font-extrabold text-[10px] uppercase rounded-xl flex flex-col items-center justify-center py-2.5 border-b-2 border-red-800"
            >
              <span>JAB L</span>
              <span className="text-[7px] font-mono opacity-80">(15 EN)</span>
            </button>

            <button
              onTouchStart={() => p1PerformAction('punch_right')}
              onClick={() => p1PerformAction('punch_right')}
              id="btn-p1-right"
              disabled={countdown !== null || p1Stunned || winner !== null}
              className="bg-gradient-to-b from-red-600 to-red-700 active:from-red-700 text-white font-extrabold text-[10px] uppercase rounded-xl flex flex-col items-center justify-center py-2.5 border-b-2 border-red-800"
            >
              <span>JAB R</span>
              <span className="text-[7px] font-mono opacity-80">(15 EN)</span>
            </button>

            <button
              onTouchStart={() => p1PerformAction('block')}
              onClick={() => p1PerformAction('block')}
              id="btn-p1-block"
              disabled={countdown !== null || p1Stunned || winner !== null}
              className="bg-sky-950 active:bg-sky-900 border border-sky-850 text-sky-400 font-extrabold text-[10px] uppercase rounded-xl flex flex-col items-center justify-center py-2.5"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>BLOCK</span>
            </button>
          </div>
        </div>

      </div>

      {/* SHUTTER INTRO COUNTDOWN OVERLAY */}
      <AnimatePresence>
        {countdown !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/90 z-50 flex flex-col items-center justify-center"
          >
            <div className="text-center font-mono select-none">
              <span className="text-sm tracking-widest text-slate-500 uppercase font-black block">READY ROUND 1</span>
              <motion.span 
                key={countdown}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1.4, opacity: 1 }}
                className="text-7xl font-black text-rose-500 block my-4"
              >
                {countdown === 0 ? 'FIGHT!' : countdown}
              </motion.span>
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Tap your buttons! Dodge hits!</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GAME OVER MATCH OVERLAY PANEL */}
      <AnimatePresence>
        {winner !== null && (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute inset-0 bg-slate-950/95 z-55 flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="absolute top-0 inset-x-0 bottom-0 retro-grid opacity-20 pointer-events-none" />

            <div className="relative z-10 w-full max-w-sm space-y-6">
              
              <div className="inline-flex py-1 px-3 bg-rose-950 border border-rose-800 rounded-full text-rose-400 text-[10px] uppercase font-mono tracking-widest font-black animate-pulse">
                🏆 TOURNAMENT RESULTS 🏆
              </div>

              <div>
                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-widest block font-mono">FINISH KO WINNER</span>
                <h2 className="text-3xl font-black text-white px-2 mt-1 truncate">
                  {winner.name}
                </h2>
              </div>

              {/* Character head visualization */}
              <div className={`mx-auto w-24 h-24 rounded-full border-4 flex items-center justify-center overflow-hidden bg-slate-900 shadow-2xl ${
                winner.color === 'red' ? 'border-red-500 shadow-red-950' : 'border-emerald-500 shadow-emerald-950'
              }`}>
                {designHeadAvatar(winner, 'idle')}
              </div>

              <div className="grid grid-cols-2 gap-2 mt-8 pt-6 border-t border-slate-910">
                <button
                  onClick={onQuit}
                  id="btn-gameover-home"
                  className="py-3 text-xs bg-slate-900 hover:bg-slate-850 text-slate-300 font-bold tracking-wider uppercase rounded-xl border border-slate-800 transition-all flex items-center justify-center space-x-1.5"
                >
                  <Home className="w-4 h-4" />
                  <span>Main Menu</span>
                </button>
                <button
                  onClick={handleRematch}
                  id="btn-gameover-rematch"
                  className="py-3 text-xs bg-red-600 hover:bg-red-500 text-white font-bold tracking-wider uppercase rounded-xl transition-all shadow-lg shadow-red-950/50 flex items-center justify-center space-x-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
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
