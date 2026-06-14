import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Play, Camera, ChevronRight, Hash, User, Shield, HelpCircle, Activity } from 'lucide-react';
import { PlayerCustomization } from '../types';
import CameraCapture from './CameraCapture';
import { RED_PRESETS, GREEN_PRESETS, BOT_PRESETS, DefaultAvatarPreset } from '../utils/avatars';
import { playCountdownBeep } from '../utils/audio';
import { db } from '../lib/firebase';
import { doc, setDoc, onSnapshot, getDoc, updateDoc, collection, query, where, limit } from 'firebase/firestore';

interface SetupProps {
  gameMode: 'boxing_fight' | 'slapping_duel';
  onlineSlot: 'local' | 'ai' | 'online_create' | 'online_join';
  onComplete: (p1: PlayerCustomization, p2: PlayerCustomization, roomId?: string, onlineSide?: 0 | 1) => void;
  onBack: () => void;
}

export default function Setup({ gameMode, onlineSlot, onComplete, onBack }: SetupProps) {
  // Setup steps
  // For 'local': Step 0 runs Player 1, Step 1 runs Player 2.
  // For others: Step 0 runs Player 1.
  const [currentStep, setCurrentStep] = useState<0 | 1>(0);
  const [showCamera, setShowCamera] = useState<boolean>(false);
  
  // Customization states loaded from LocalStorage
  const [p1Name, setP1Name] = useState<string>(() => localStorage.getItem('creadit_p1Name') || 'Fighter Red');
  const [p2Name, setP2Name] = useState<string>(() => localStorage.getItem('creadit_p2Name') || 'Fighter Green');
  
  const [p1SelectedPreset, setP1SelectedPreset] = useState<DefaultAvatarPreset>(() => {
    try {
      const saved = localStorage.getItem('creadit_p1SelectedPreset');
      return saved ? JSON.parse(saved) : RED_PRESETS[0];
    } catch {
      return RED_PRESETS[0];
    }
  });
  const [p2SelectedPreset, setP2SelectedPreset] = useState<DefaultAvatarPreset>(() => {
    try {
      const saved = localStorage.getItem('creadit_p2SelectedPreset');
      return saved ? JSON.parse(saved) : GREEN_PRESETS[0];
    } catch {
      return GREEN_PRESETS[0];
    }
  });
  
  const [p1Faces, setP1Faces] = useState<{ normal: string | null; attack: string | null; hit: string | null }>(() => {
    try {
      const saved = localStorage.getItem('creadit_p1Faces');
      return saved ? JSON.parse(saved) : { normal: null, attack: null, hit: null };
    } catch {
      return { normal: null, attack: null, hit: null };
    }
  });
  const [p2Faces, setP2Faces] = useState<{ normal: string | null; attack: string | null; hit: string | null }>(() => {
    try {
      const saved = localStorage.getItem('creadit_p2Faces');
      return saved ? JSON.parse(saved) : { normal: null, attack: null, hit: null };
    } catch {
      return { normal: null, attack: null, hit: null };
    }
  });

  // AI Boss preset selector (only if VS AI)
  const [selectedAIBoss, setSelectedAIBoss] = useState<DefaultAvatarPreset>(BOT_PRESETS[0]);

  // Online Room States
  const [enteredRoomId, setEnteredRoomId] = useState<string>('');
  const [lobbyRoomId, setLobbyRoomId] = useState<string | null>(null);
  const [isCreatingLobby, setIsCreatingLobby] = useState<boolean>(false);
  const [isJoiningLobby, setIsJoiningLobby] = useState<boolean>(false);
  const [onlineMessage, setOnlineMessage] = useState<string>('');
  const [onlineError, setOnlineError] = useState<string>('');
  const [activeRooms, setActiveRooms] = useState<any[]>([]);

  // Automatically persist customizations to localStorage upon updates
  useEffect(() => {
    localStorage.setItem('creadit_p1Name', p1Name);
  }, [p1Name]);

  useEffect(() => {
    localStorage.setItem('creadit_p2Name', p2Name);
  }, [p2Name]);

  useEffect(() => {
    localStorage.setItem('creadit_p1SelectedPreset', JSON.stringify(p1SelectedPreset));
  }, [p1SelectedPreset]);

  useEffect(() => {
    localStorage.setItem('creadit_p2SelectedPreset', JSON.stringify(p2SelectedPreset));
  }, [p2SelectedPreset]);

  useEffect(() => {
    localStorage.setItem('creadit_p1Faces', JSON.stringify(p1Faces));
  }, [p1Faces]);

  useEffect(() => {
    localStorage.setItem('creadit_p2Faces', JSON.stringify(p2Faces));
  }, [p2Faces]);

  // Read real-time active lobbies currently looking for opponents
  useEffect(() => {
    if (onlineSlot !== 'online_join') return;
    try {
      const q = query(collection(db, 'rooms'), where('status', '==', 'lobby'), limit(15));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const roomsList: any[] = [];
        snapshot.forEach((docSnap) => {
          roomsList.push({ id: docSnap.id, ...docSnap.data() });
        });
        setActiveRooms(roomsList);
      }, (err) => {
        console.error("Firestore active rooms listing failed:", err);
      });
      return () => unsubscribe();
    } catch (err) {
      console.error("Setup active lobby watcher error:", err);
    }
  }, [onlineSlot]);

  // Reactive Firestore state loop for host
  useEffect(() => {
    if (!lobbyRoomId || onlineSlot !== 'online_create') return;
    
    const docRef = doc(db, 'rooms', lobbyRoomId);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.p2) {
          playCountdownBeep(true);
          
          // Map opponent info
          const opponent: PlayerCustomization = {
            name: data.p2.displayName || 'Fighter Green',
            color: 'green',
            avatarType: data.p2.faces ? 'camera' : 'default',
            faces: data.p2.faces || { normal: null, attack: null, hit: null }
          };

          const self: PlayerCustomization = {
            name: p1Name,
            color: 'red',
            avatarType: p1Faces.normal ? 'camera' : 'default',
            faces: p1Faces
          };

          unsubscribe();
          onComplete(self, opponent, lobbyRoomId, 0);
        }
      }
    }, (error) => {
      console.error("Firestore onSnapshot error:", error);
    });

    return () => {
      unsubscribe();
    };
  }, [lobbyRoomId, p1Name, p1Faces, onlineSlot]);

  const handleCameraComplete = (faces: { normal: string | null; attack: string | null; hit: string | null }) => {
    if (currentStep === 0) {
      setP1Faces(faces);
    } else {
      setP2Faces(faces);
    }
    setShowCamera(false);
  };

  const handleNextStep = async () => {
    playCountdownBeep(true);

    if (onlineSlot === 'local' && currentStep === 0) {
      // Move to Player 2 local config
      setCurrentStep(1);
      return;
    }

    // Creating Online Room Match in Firestore
    if (onlineSlot === 'online_create') {
      setIsCreatingLobby(true);
      setOnlineError('');
      
      try {
        // Generate random unique 4-digit ID
        const generatedId = Math.floor(1000 + Math.random() * 9000).toString();
        const initFaces = p1Faces.normal ? p1Faces : null;

        const roomDocRef = doc(db, 'rooms', generatedId);
        
        await setDoc(roomDocRef, {
          id: generatedId,
          gameMode: gameMode,
          status: 'lobby',
          p1: {
            displayName: p1Name || 'Fighter Red',
            health: gameMode === 'boxing_fight' ? 100 : 5,
            energy: gameMode === 'boxing_fight' ? 100 : 1, // Attacker role starts with 1 for Host
            action: 'idle',
            score: 0,
            faces: initFaces,
            lastHitType: null,
            lastActive: Date.now()
          },
          p2: null,
          updatedAt: new Date().toISOString()
        });

        setLobbyRoomId(generatedId);
        setOnlineMessage(`Room ${generatedId} loaded. Hold tight...`);
      } catch (err: any) {
        console.error('Room create error', err);
        setOnlineError('Firebase unavailable. Choose Local instead!');
      } finally {
        setIsCreatingLobby(false);
      }
      return;
    }

    // Joining Existing Room Match inside Firestore
    if (onlineSlot === 'online_join') {
      if (!enteredRoomId.trim()) {
        setOnlineError('Please input a valid 4-digit Room code.');
        return;
      }
      
      setIsJoiningLobby(true);
      setOnlineError('');
      
      try {
        const joinFaces = p1Faces.normal ? p1Faces : null;
        const roomDocRef = doc(db, 'rooms', enteredRoomId.trim());
        const snapshot = await getDoc(roomDocRef);

        if (!snapshot.exists()) {
          setOnlineError('Fighter room not found. Double-check your 4-digit code.');
          setIsJoiningLobby(false);
          return;
        }

        const data = snapshot.data();
        if (data.status === 'playing' || data.p2) {
          setOnlineError('Room is already full! Max 2 players allowed.');
          setIsJoiningLobby(false);
          return;
        }

        const guestData = {
          displayName: p1Name || 'Fighter Green',
          health: gameMode === 'boxing_fight' ? 100 : 5,
          energy: gameMode === 'boxing_fight' ? 100 : 0, // Guest is defender first (energy 0)
          action: 'idle',
          score: 0,
          faces: joinFaces,
          lastHitType: null,
          lastActive: Date.now()
        };

        // Write guest details to P2
        await updateDoc(roomDocRef, {
          p2: guestData,
          status: 'playing',
          updatedAt: new Date().toISOString()
        });

        setOnlineMessage('Matched with Red Fighter! Preparing the arena...');

        const opponent: PlayerCustomization = {
          name: data.p1?.displayName || 'Fighter Red',
          color: 'red',
          avatarType: data.p1?.faces ? 'camera' : 'default',
          faces: data.p1?.faces || { normal: null, attack: null, hit: null }
        };

        const self: PlayerCustomization = {
          name: p1Name,
          color: 'green',
          avatarType: p1Faces.normal ? 'camera' : 'default',
          faces: p1Faces
        };

        onComplete(opponent, self, enteredRoomId.trim(), 1);
      } catch (err: any) {
        console.error('Room join error', err);
        setOnlineError('Online connection failed.');
      } finally {
        setIsJoiningLobby(false);
      }
      return;
    }

    // Local VS AI Finish
    if (onlineSlot === 'ai') {
      const p1: PlayerCustomization = {
        name: p1Name,
        color: 'red',
        avatarType: p1Faces.normal ? 'camera' : 'default',
        faces: p1Faces
      };

      const aiFighter: PlayerCustomization = {
        id: selectedAIBoss.id,
        name: selectedAIBoss.name,
        color: 'green',
        avatarType: 'default',
        faces: { normal: null, attack: null, hit: null },
        imageUrl: selectedAIBoss.imageUrl
      };

      onComplete(p1, aiFighter);
      return;
    }

    // Local same-phone both done finish
    if (onlineSlot === 'local') {
      const p1: PlayerCustomization = {
        name: p1Name,
        color: 'red',
        avatarType: p1Faces.normal ? 'camera' : 'default',
        faces: p1Faces
      };

      const p2: PlayerCustomization = {
        name: p2Name,
        color: 'green',
        avatarType: p2Faces.normal ? 'camera' : 'default',
        faces: p2Faces
      };

      onComplete(p1, p2);
    }
  };

  // Determine configuration details
  const activeSide = (onlineSlot === 'local' && currentStep === 1) ? 'green' : 'red';
  const customPreset = activeSide === 'red' ? p1SelectedPreset : p2SelectedPreset;
  const setCustomPreset = activeSide === 'red' ? setP1SelectedPreset : setP2SelectedPreset;
  const currentFaces = activeSide === 'red' ? p1Faces : p2Faces;
  const activePresetsList = activeSide === 'red' ? RED_PRESETS : GREEN_PRESETS;
  
  const getFighterAvatarUrl = (preset: DefaultAvatarPreset) => {
    return preset.emoji;
  };

  if (showCamera) {
    return (
      <CameraCapture
        player={{
          name: activeSide === 'red' ? p1Name : p2Name,
          color: activeSide,
          avatarType: 'camera',
          faces: currentFaces
        }}
        onCaptureComplete={handleCameraComplete}
        onCancel={() => setShowCamera(false)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-white font-sans overflow-y-auto select-none cyber-grid pb-4">
      
      {/* Upper Navigation Bar */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-slate-900 bg-slate-950 shrink-0">
        <button
          onClick={lobbyRoomId ? () => setLobbyRoomId(null) : onBack}
          id="btn-back-setup"
          className="p-1.5 rounded-full hover:bg-slate-900 text-slate-400 hover:text-white transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-xs uppercase tracking-widest text-slate-400 font-bold">
          {gameMode === 'boxing_fight' ? '🥊 Boxing Face-Off' : '🖐️ Slap Duel Setup'}
        </span>
        <div className="w-8" />
      </div>

      {lobbyRoomId && onlineSlot === 'online_create' ? (
        /* Online Lobby Waiting Screen */
        <div className="flex-grow flex flex-col items-center justify-center p-6 text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-red-600/10 rounded-full blur-2xl animate-pulse" />
            <div className="w-16 h-16 rounded-full border-4 border-solid border-red-500 border-t-red-950 animate-spin flex items-center justify-center relative z-10" />
          </div>

          <span className="text-xs text-red-500 font-bold uppercase tracking-widest font-mono">
            Waiting Room Established
          </span>

          <h2 className="text-3xl font-black text-white mt-1 border-b-2 border-red-950 pb-2">
            ROOM CODE
          </h2>

          <div className="text-glow-red text-center py-2 px-6 rounded-2xl bg-red-950/40 border border-red-800/40 my-4 shadow-xl">
            <span className="text-5xl font-black font-mono tracking-widest text-red-400">
              {lobbyRoomId}
            </span>
          </div>

          <p className="text-xs text-slate-400 max-w-xs mt-2 leading-relaxed">
            Give this 4-digit joining code to your friend! Tell them to open this website, click <b>Online Play</b> and enter the code.
          </p>

          <p className="mt-8 text-xs text-slate-500 animate-pulse flex items-center justify-center gap-1.5 font-mono">
            <Activity className="w-3.5 h-3.5" />
            <span>Establishing live channel...</span>
          </p>
        </div>
      ) : (
        /* Setup / Customization Stepper */
        <div className="flex-grow flex flex-col justify-between p-4">
          <div className="space-y-4">
            
            {/* Phase Instructions */}
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-900">
              <h2 className="text-xs font-black uppercase text-rose-500 tracking-wider">
                {onlineSlot === 'local' 
                  ? `Player ${currentStep + 1} Customs` 
                  : 'Fighter Customs'
                }
              </h2>
              <p className="text-[11px] text-slate-400 mt-1 font-medium leading-normal">
                {activeSide === 'red'
                  ? 'Configure the RED team member. Type your name, then capture awesome selfies!'
                  : 'Configure the GREEN team member. Type your name, then capture awesome selfies!'
                }
              </p>
            </div>

            {/* Name input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span>Competitor Name</span>
              </label>
              <input
                type="text"
                maxLength={14}
                value={activeSide === 'red' ? p1Name : p2Name}
                onChange={(e) => activeSide === 'red' ? setP1Name(e.target.value) : setP2Name(e.target.value)}
                placeholder={activeSide === 'red' ? 'Slammer Red' : 'Slapper Green'}
                className="w-full py-2.5 px-3 rounded-lg bg-slate-900 border border-slate-800 focus:border-red-500 outline-none text-xs font-bold text-white tracking-wide shadow-inner"
              />
            </div>

            {/* Online Room input if code join *only* */}
            {onlineSlot === 'online_join' && (
              <div className="space-y-3">
                <div className="space-y-1.5 p-3 rounded-xl bg-orange-950/20 border border-orange-900/40">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5 text-orange-500" />
                    <span>Enter 4-Digit Joining Code</span>
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={enteredRoomId}
                    onChange={(e) => setEnteredRoomId(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 5240"
                    className="w-full text-center py-2 px-3 rounded-lg bg-slate-950 border border-orange-900/50 focus:border-orange-500 outline-none text-lg font-black tracking-widest text-orange-300 font-mono shadow-inner"
                  />
                </div>

                {/* Active lobbies ticker view */}
                <div className="space-y-2 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                      Active Match Lobbies
                    </span>
                    <span className="text-[8px] text-slate-500 uppercase tracking-widest font-mono">Live list</span>
                  </div>

                  {activeRooms.filter(r => r.status === 'lobby').length === 0 ? (
                    <p className="text-[10px] text-slate-500 text-center py-3">
                      No active lobbies waiting. Ask a friend to host, or click Host Match!
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {activeRooms.filter(r => r.status === 'lobby').map((room) => (
                        <button
                          key={room.id}
                          type="button"
                          onClick={() => {
                            setEnteredRoomId(room.id);
                            playCountdownBeep(true);
                          }}
                          className={`w-full p-2 bg-slate-950 rounded-lg border text-left flex items-center justify-between transition-all ${
                            enteredRoomId === room.id
                              ? 'border-emerald-500 bg-emerald-950/20'
                              : 'border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <span className="text-[11px] font-black font-mono text-slate-200">
                              #ROOM {room.id}
                            </span>
                            <span className="text-[9px] text-slate-450 block font-bold capitalize">
                              🎮 {room.gameMode === 'boxing_fight' ? 'Boxing Fight' : 'Slap Duel'}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-bold text-emerald-450 block truncate max-w-[100px]">
                              👤 {room.p1?.displayName || 'Host'}
                            </span>
                            <span className="text-[8px] text-indigo-400 font-bold block uppercase tracking-wide">
                              Tap to Fill
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Avatar customization choice / Camera action */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Fighter Head Source
              </label>

              <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-900 flex flex-col items-center">
                
                {/* Active face bubble preview */}
                <div className={`relative w-24 h-24 rounded-full border-4 flex items-center justify-center overflow-hidden mb-3.5 shadow-2xl ${
                  activeSide === 'red' ? 'border-red-600 bg-red-950' : 'border-emerald-600 bg-emerald-950'
                }`}>
                  {currentFaces.normal ? (
                    <img 
                      src={currentFaces.normal} 
                      alt="Player Selfie" 
                      className="w-full h-full object-cover scale-x-[-1]" 
                    />
                  ) : (
                    <span className="text-5xl">{customPreset.emoji}</span>
                  )}

                  {/* Little camera icon overlay if captured */}
                  {currentFaces.normal && (
                    <div className="absolute bottom-1 right-1 p-1 rounded-full bg-slate-950 border border-slate-800">
                      <Camera className="w-3 h-3 text-emerald-400" />
                    </div>
                  )}
                </div>

                {/* Snapping actions */}
                <button
                  onClick={() => setShowCamera(true)}
                  id="btn-trigger-camera-flow"
                  className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-750 text-white rounded-lg border border-slate-700 text-xs font-bold tracking-wider uppercase flex items-center justify-center space-x-1.5 transition-all shadow"
                >
                  <Camera className="w-4 h-4 text-rose-500" />
                  <span>{currentFaces.normal ? 'Re-take Selfie' : 'Capture Selfie Face'}</span>
                </button>
                <p className="text-[9px] text-slate-500 text-center mt-1.5 max-w-xs leading-normal">
                  (Recommended) Capture normal, aggressive, and hurt snapshots for amazing interactive faces!
                </p>
              </div>
            </div>

            {/* Default Avatar Preset selector if no camera used */}
            {!currentFaces.normal && (
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Or select Stock Fighter Character
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {activePresetsList.map((preset) => (
                    <div
                      key={preset.id}
                      onClick={() => setCustomPreset(preset)}
                      className={`p-2.5 rounded-xl border-2 text-center cursor-pointer flex flex-col items-center justify-center relative transition-all ${
                        customPreset.id === preset.id
                          ? (activeSide === 'red' ? 'bg-red-950/20 border-red-500 scale-[1.03]' : 'bg-emerald-950/20 border-emerald-500 scale-[1.03]')
                          : 'bg-slate-900 border-slate-850 hover:border-slate-850 hover:bg-slate-850'
                      }`}
                    >
                      <span className="text-2xl mb-1">{preset.emoji}</span>
                      <span className="text-[9px] font-black tracking-wide text-slate-200 uppercase truncate max-w-full">
                        {preset.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* If VS AI opponent selection */}
            {onlineSlot === 'ai' && (
              <div className="space-y-2.5 p-3 rounded-xl bg-slate-900 border border-slate-850 mt-4">
                <label className="text-[10px] font-bold uppercase tracking-wider text-yellow-400 flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-yellow-500" />
                  <span>Select AI Opponent Level</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {BOT_PRESETS.map((bot) => (
                    <div
                      key={bot.id}
                      onClick={() => setSelectedAIBoss(bot)}
                      className={`p-2.5 rounded-xl border-2 text-center cursor-pointer flex flex-col items-center relative transition-all ${
                        selectedAIBoss.id === bot.id
                          ? 'bg-amber-950/40 border-amber-500 scale-[1.02]'
                          : 'bg-slate-950 border-slate-900 hover:border-slate-850'
                      }`}
                    >
                      <span className="text-2xl mb-1">{bot.emoji}</span>
                      <span className="text-[9px] font-bold text-slate-100 uppercase leading-none">
                        {bot.name}
                      </span>
                      <span className="text-[8px] text-amber-500 font-mono mt-1 font-bold block">
                        {bot.id === 'bot_easy' && 'EASY MODE'}
                        {bot.id === 'bot_hard' && 'HARD MODE'}
                        {bot.id === 'bot_nightmare' && 'NIGHTMARE MODE'}
                        {bot.id === 'bot_oneshot' && '☠️ ONESHOT FATAL ☠️'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error notifications */}
            {onlineError && (
              <div className="bg-red-950/80 border border-red-800 p-2.5 rounded-xl text-center">
                <span className="text-[10px] font-bold text-red-400 leading-normal">
                  ⚠️ {onlineError}
                </span>
              </div>
            )}

          </div>

          {/* Setup Actions Row footer */}
          <div className="mt-8 shrink-0">
            <button
              onClick={handleNextStep}
              id="btn-proceed-match"
              disabled={isCreatingLobby || isJoiningLobby}
              className={`w-full py-3.5 rounded-xl font-bold tracking-widest text-xs uppercase flex items-center justify-center space-x-1.5 transition-all shadow ${
                activeSide === 'red'
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-red-950/40 shadow-lg'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/40 shadow-lg'
              }`}
            >
              <span>
                {isCreatingLobby || isJoiningLobby
                  ? 'Synchronizing...'
                  : onlineSlot === 'local' && currentStep === 0
                  ? 'Setup Player 2'
                  : gameMode === 'boxing_fight'
                  ? 'Enter Arena'
                  : 'Start Slap Match'
                }
              </span>
              <ChevronRight className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
