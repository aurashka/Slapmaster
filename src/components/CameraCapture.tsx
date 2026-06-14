import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, Check, AlertCircle, Smile, Flame, Skull } from 'lucide-react';
import { PlayerCustomization } from '../types';
import { playCameraSnapSound, playCountdownBeep } from '../utils/audio';

interface CameraCaptureProps {
  player: PlayerCustomization;
  onCaptureComplete: (faces: { normal: string | null; attack: string | null; hit: string | null }) => void;
  onCancel: () => void;
}

export default function CameraCapture({ player, onCaptureComplete, onCancel }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [activeStep, setActiveStep] = useState<'normal' | 'attack' | 'hit'>('normal');
  
  const [captured, setCaptured] = useState<{
    normal: string | null;
    attack: string | null;
    hit: string | null;
  }>({ normal: null, attack: null, hit: null });

  const [recordingFace, setRecordingFace] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Start back-camera/front-camera stream
  useEffect(() => {
    let active = true;

    async function startCamera() {
      try {
        setHasPermission(null);
        // Request front camera specifically for mobile selfies
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 320 } },
          audio: false
        });
        
        if (active) {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          setHasPermission(true);
        }
      } catch (err: any) {
        console.error('Camera access error:', err);
        if (active) {
          setHasPermission(false);
          setErrorMessage(err.message || 'Unable to access camera. Check permissions or try another browser.');
        }
      }
    }

    startCamera();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Countdown timer for shutter snap
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      executeMockCapture();
      return;
    }

    const timer = setTimeout(() => {
      playCountdownBeep(false);
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  const triggerCapture = () => {
    if (recordingFace) return;
    playCountdownBeep(false);
    setCountdown(3);
  };

  const executeMockCapture = () => {
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const size = Math.min(video.videoWidth || 320, video.videoHeight || 320);
      canvas.width = 240;
      canvas.height = 240;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Crop video into a square centered
        const sourceX = ((video.videoWidth || size) - size) / 2;
        const sourceY = ((video.videoHeight || size) - size) / 2;
        
        // Horizontal reverse for mirrored screen representation
        ctx.translate(240, 0);
        ctx.scale(-1, 1);
        
        ctx.drawImage(
          video,
          sourceX, sourceY, size, size,
          0, 0, 240, 240
        );

        // Filter / overlay decoration per facial state
        if (activeStep === 'attack') {
          // Add a subtle reddish flame outline
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 10;
          ctx.strokeRect(5, 5, 230, 230);
        } else if (activeStep === 'hit') {
          // Add subtle bruising shadows
          ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
          ctx.fillRect(0, 0, 240, 240);
          ctx.strokeStyle = '#eab308';
          ctx.lineWidth = 10;
          ctx.strokeRect(5, 5, 230, 230);
        }

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        playCameraSnapSound();
        
        setCaptured(prev => {
          const updated = { ...prev, [activeStep]: dataUrl };
          
          // Move automatically to the next step
          if (activeStep === 'normal') {
            setActiveStep('attack');
          } else if (activeStep === 'attack') {
            setActiveStep('hit');
          }
          
          return updated;
        });
      }
    } catch (e) {
      console.error('Snapshot failed', e);
    }
  };

  const handleDone = () => {
    onCaptureComplete(captured);
  };

  const designStepHeader = () => {
    switch (activeStep) {
      case 'normal':
        return {
          title: 'Step 1: Normal Face',
          subtitle: 'Look neutral, casual or cocky 😐',
          icon: <Smile className="w-6 h-6 text-blue-400" />
        };
      case 'attack':
        return {
          title: 'Step 2: Attack Face',
          subtitle: 'Make your best battle roar or tough punch face! 😡',
          icon: <Flame className="w-6 h-6 text-red-500 animate-pulse" />
        };
      case 'hit':
        return {
          title: 'Step 3: KO / Hit Face',
          subtitle: 'Act knocked out or dazed! 😵',
          icon: <Skull className="w-6 h-6 text-yellow-500" />
        };
    }
  };

  const stepMeta = designStepHeader();

  return (
    <div className="flex flex-col items-center justify-between h-full w-full bg-slate-950 p-4 text-white font-sans">
      
      {/* Header text */}
      <div className="text-center w-full mt-2">
        <h3 className="text-sm uppercase tracking-widest font-bold text-slate-400">
          Character Setup
        </h3>
        <span className={`inline-block px-3 py-1 mt-1 rounded text-xs font-bold ${
          player.color === 'red' ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
        }`}>
          {player.color === 'red' ? 'P1 Red Fighter' : 'P2 Green Fighter'} Selfie Capture
        </span>
      </div>

      {hasPermission === null && (
        <div className="flex flex-col items-center justify-center flex-grow py-8 text-center px-4">
          <div className="w-12 h-12 border-4 border-slate-700 border-t-red-500 rounded-full animate-spin mb-4" />
          <p className="text-sm font-medium text-slate-300">Requesting Camera Access...</p>
          <p className="text-xs text-slate-500 mt-2 max-w-xs">
            Please approve camera requests in your mobile browser to play with your actual faces overlayed on fighters.
          </p>
        </div>
      )}

      {hasPermission === false && (
        <div className="flex flex-col items-center justify-center flex-grow py-8 text-center px-6">
          <div className="bg-red-950/40 p-4 rounded-full border border-red-800/30 mb-4">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <p className="text-sm font-bold text-red-400">Camera Rejected / Unavailable</p>
          <p className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed">
            {errorMessage || 'Your browser did not allow camera utilization.'}
          </p>
          <p className="text-xs text-yellow-400 mt-4 max-w-xs bg-yellow-950/20 p-2 border border-yellow-800/30 rounded">
            Don't worry! We will automatically apply an awesome customized retro fighter illustration instead.
          </p>
          <button
            onClick={onCancel}
            id="btn-skip-camera"
            className="mt-6 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-bold tracking-wider uppercase transition-all"
          >
            Use Default Avatar
          </button>
        </div>
      )}

      {hasPermission === true && (
        <div className="flex-grow flex flex-col items-center justify-center w-full max-w-sm py-4">
          {/* Instructions Step Box */}
          <div className="bg-slate-900 border border-slate-850 p-3 rounded-xl w-full mb-4 flex items-center space-x-3 shadow-lg shadow-black/40">
            <div className="p-2 bg-slate-950 rounded-lg shrink-0">
              {stepMeta.icon}
            </div>
            <div className="text-left">
              <h4 className="text-xs font-bold text-white uppercase tracking-wide">{stepMeta.title}</h4>
              <p className="text-[11px] text-slate-400 font-medium leading-tight">{stepMeta.subtitle}</p>
            </div>
          </div>

          {/* Camera Frame Viewport */}
          <div className="relative w-56 h-56 rounded-full border-4 border-slate-800 bg-slate-900 overflow-hidden shadow-2xl flex items-center justify-center mb-6">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute w-full h-full object-cover scale-x-[-1]"
            />

            {/* Simulated target circle outline */}
            <div className="absolute inset-4 rounded-full border-2 border-dashed border-white/20 pointer-events-none" />

            {/* Shutter flash overlay when photo gets taken */}
            {countdown === 0 && (
              <div className="absolute inset-0 bg-white animate-ping" />
            )}

            {/* Countdown overlay */}
            {countdown !== null && countdown > 0 && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="text-6xl font-black text-yellow-400 animate-bounce">
                  {countdown}
                </span>
              </div>
            )}
          </div>

          {/* Captured Micro Previews */}
          <div className="grid grid-cols-3 gap-3 w-full px-2 max-w-xs mb-4">
            <div 
              onClick={() => setActiveStep('normal')}
              className={`flex flex-col items-center p-2 rounded-lg border-2 cursor-pointer transition-all ${
                activeStep === 'normal' 
                  ? 'bg-slate-900 border-blue-500' 
                  : captured.normal ? 'bg-slate-900 border-slate-800' : 'bg-slate-950 border-slate-900 hover:border-slate-800'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-slate-950 overflow-hidden border border-slate-800 flex items-center justify-center mb-1">
                {captured.normal ? (
                  <img src={captured.normal} alt="Normal" className="w-full h-full object-cover" />
                ) : (
                  <Smile className="w-5 h-5 text-slate-600" />
                )}
              </div>
              <span className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">😐 Normal</span>
            </div>

            <div 
              onClick={() => setActiveStep('attack')}
              className={`flex flex-col items-center p-2 rounded-lg border-2 cursor-pointer transition-all ${
                activeStep === 'attack' 
                  ? 'bg-slate-900 border-red-500' 
                  : captured.attack ? 'bg-slate-900 border-slate-800' : 'bg-slate-950 border-slate-900 hover:border-slate-800'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-slate-950 overflow-hidden border border-slate-800 flex items-center justify-center mb-1">
                {captured.attack ? (
                  <img src={captured.attack} alt="Attack" className="w-full h-full object-cover" />
                ) : (
                  <Flame className="w-5 h-5 text-slate-600" />
                )}
              </div>
              <span className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">😡 Attack</span>
            </div>

            <div 
              onClick={() => setActiveStep('hit')}
              className={`flex flex-col items-center p-2 rounded-lg border-2 cursor-pointer transition-all ${
                activeStep === 'hit' 
                  ? 'bg-slate-900 border-yellow-500' 
                  : captured.hit ? 'bg-slate-900 border-slate-800' : 'bg-slate-950 border-slate-900 hover:border-slate-800'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-slate-950 overflow-hidden border border-slate-800 flex items-center justify-center mb-1">
                {captured.hit ? (
                  <img src={captured.hit} alt="Hit" className="w-full h-full object-cover" />
                ) : (
                  <Skull className="w-5 h-5 text-slate-600" />
                )}
              </div>
              <span className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">😵 Hit</span>
            </div>
          </div>
        </div>
      )}

      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Bottom Actions Row */}
      {hasPermission === true && (
        <div className="flex flex-col w-full max-w-sm gap-2 pb-2">
          {/* Snap trigger */}
          <button
            onClick={triggerCapture}
            id="btn-take-snapshot"
            disabled={countdown !== null}
            className={`w-full py-3 rounded-xl font-bold tracking-widest text-xs uppercase flex items-center justify-center space-x-2 transition-all ${
              countdown !== null 
                ? 'bg-slate-850 text-slate-600 border border-slate-800 shadow-none cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white shadow-lg shadow-red-950/50 hover:shadow-red-600/20'
            }`}
          >
            <Camera className="w-4 h-4 shrink-0" />
            <span>{countdown !== null ? `Snapping in ${countdown}...` : `Snap Pic`}</span>
          </button>

          {/* Proceed and Switch buttons */}
          <div className="grid grid-cols-2 gap-2 mt-1">
            <button
              onClick={onCancel}
              id="btn-cancel-capture"
              className="py-2.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-900 text-[10px] font-bold tracking-wider uppercase text-slate-400 transition-all"
            >
              Skip / Use Default
            </button>
            <button
              onClick={handleDone}
              id="btn-confirm-capture"
              disabled={!captured.normal && !captured.attack && !captured.hit}
              className={`py-2.5 rounded-xl flex items-center justify-center space-x-1 text-[10px] font-bold tracking-wider uppercase transition-all ${
                (captured.normal || captured.attack || captured.hit)
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                  : 'bg-slate-900 border border-slate-850 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>Continue</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
