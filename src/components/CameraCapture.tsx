import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, Check, AlertCircle, Smile, Flame, Skull, Upload, Loader2 } from 'lucide-react';
import { PlayerCustomization } from '../types';
import { playCameraSnapSound, playCountdownBeep } from '../utils/audio';
import { uploadToImgBB } from '../utils/imgbb';

interface CameraCaptureProps {
  player: PlayerCustomization;
  onCaptureComplete: (faces: { normal: string | null; attack: string | null; hit: string | null }) => void;
  onCancel: () => void;
}

export default function CameraCapture({ player, onCaptureComplete, onCancel }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [activeStep, setActiveStep] = useState<'normal' | 'attack' | 'hit'>('normal');
  
  const [captured, setCaptured] = useState<{
    normal: string | null;
    attack: string | null;
    hit: string | null;
  }>({ normal: null, attack: null, hit: null });

  const [countdown, setCountdown] = useState<number | null>(null);
  
  // Custom states for ImgBB gallery selection & uploading
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string>('');

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
          setErrorMessage(err.message || 'Unable to access camera.');
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
    if (isUploading || countdown !== null) return;
    playCountdownBeep(false);
    setCountdown(3);
  };

  const executeMockCapture = async () => {
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
        
        setIsUploading(true);
        setUploadError('');

        try {
          // Upload to ImgBB
          const cdnUrl = await uploadToImgBB(dataUrl);
          setCaptured(prev => {
            const updated = { ...prev, [activeStep]: cdnUrl };
            
            // Move automatically to the next step
            if (activeStep === 'normal') {
              setActiveStep('attack');
            } else if (activeStep === 'attack') {
              setActiveStep('hit');
            }
            
            return updated;
          });
        } catch (err: any) {
          console.error(err);
          setUploadError('Failed to upload snapped photo to ImgBB. Please try again.');
        } finally {
          setIsUploading(false);
        }
      }
    } catch (e) {
      console.error('Snapshot failed', e);
    }
  };

  // Gallery File upload triggers
  const triggerFileSelect = () => {
    if (isUploading) return;
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file.');
      return;
    }

    setIsUploading(true);
    setUploadError('');

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = async () => {
          try {
            const canvas = canvasRef.current;
            if (!canvas) {
              setIsUploading(false);
              return;
            }
            canvas.width = 240;
            canvas.height = 240;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              // Center-cover square crop
              const minDim = Math.min(img.width, img.height);
              const sx = (img.width - minDim) / 2;
              const sy = (img.height - minDim) / 2;
              
              ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 240, 240);

              // Apply face-type overlays matching camera output
              if (activeStep === 'attack') {
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 10;
                ctx.strokeRect(5, 5, 230, 230);
              } else if (activeStep === 'hit') {
                ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
                ctx.fillRect(0, 0, 240, 240);
                ctx.strokeStyle = '#eab308';
                ctx.lineWidth = 10;
                ctx.strokeRect(5, 5, 230, 230);
              }

              const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
              playCameraSnapSound();

              const cdnUrl = await uploadToImgBB(croppedDataUrl);
              setCaptured(prev => {
                const updated = { ...prev, [activeStep]: cdnUrl };
                
                if (activeStep === 'normal') {
                  setActiveStep('attack');
                } else if (activeStep === 'attack') {
                  setActiveStep('hit');
                }
                return updated;
              });
            }
          } catch (err: any) {
            console.error('ImgBB processing/upload failed', err);
            setUploadError('ImgBB Upload failed. Check your internet or try again.');
          } finally {
            setIsUploading(false);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (e) {
      console.error(e);
      setUploadError('Failed to parse file.');
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (isUploading) return;
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isUploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
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
    <div className="flex flex-col items-center justify-between h-full w-full bg-slate-950 p-4 text-white font-sans relative">
      
      {/* Hidden processing elements */}
      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Header text */}
      <div className="text-center w-full mt-2 shrink-0">
        <h3 className="text-sm uppercase tracking-widest font-bold text-slate-400">
          Competitor Facemorphing
        </h3>
        <span className={`inline-block px-3 py-1 mt-1 rounded text-xs font-bold ${
          player.color === 'red' ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
        }`}>
          {player.color === 'red' ? 'P1 Red Fighter' : 'P2 Green Fighter'} Selfie Setup
        </span>
      </div>

      {/* Main interactive setup area */}
      <div className="flex-grow flex flex-col items-center justify-center w-full max-w-sm py-3 overflow-y-auto">
        
        {/* Step instruction box */}
        <div className="bg-slate-900 border border-slate-850 p-3 rounded-xl w-full mb-3 flex items-center space-x-3 shadow-lg shadow-black/40">
          <div className="p-2 bg-slate-950 rounded-lg shrink-0">
            {stepMeta.icon}
          </div>
          <div className="text-left">
            <h4 className="text-xs font-bold text-white uppercase tracking-wide">{stepMeta.title}</h4>
            <p className="text-[11px] text-slate-400 font-medium leading-tight">{stepMeta.subtitle}</p>
          </div>
        </div>

        {/* DRAG AND DROP WRAPPER ZONE around preview frames */}
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`w-full p-4 rounded-3xl border-2 border-dashed transition-all flex flex-col items-center justify-center min-h-[300px] relative ${
            isDragging 
              ? 'border-red-500 bg-red-950/20 scale-[1.01]' 
              : 'border-slate-800 bg-slate-900/20 hover:border-slate-700'
          }`}
        >
          {/* Active Visualizer Loading/Snap overlay */}
          {isUploading && (
            <div className="absolute inset-0 bg-slate-950/90 z-20 flex flex-col items-center justify-center rounded-3xl p-4 text-center">
              <Loader2 className="w-10 h-10 text-red-500 animate-spin mb-3" />
              <p className="text-sm font-bold text-slate-200">Processing & Uploading...</p>
              <p className="text-xs text-slate-500 mt-1">Uploading character face to ImgBB CDN hosting...</p>
            </div>
          )}

          {/* Camera Frame / Gallery Fallback frame */}
          <div className="relative w-48 h-48 rounded-full border-4 border-slate-800 bg-slate-950 overflow-hidden shadow-2xl flex items-center justify-center mb-4">
            {hasPermission === true ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute w-full h-full object-cover scale-x-[-1]"
              />
            ) : (
              /* No-camera visual icon */
              <div className="text-center p-3 flex flex-col items-center text-slate-500">
                <Upload className="w-8 h-8 text-slate-600 mb-1 animate-bounce" />
                <span className="text-[10px] font-bold text-slate-400">DROP OR CLICK GALLERY</span>
              </div>
            )}

            {/* Target circle decorator */}
            <div className="absolute inset-4 rounded-full border-2 border-dashed border-white/10 pointer-events-none" />

            {/* Shutter flash */}
            {countdown === 0 && (
              <div className="absolute inset-0 bg-white animate-ping" />
            )}

            {/* Countdown indicator */}
            {countdown !== null && countdown > 0 && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
                <span className="text-5xl font-black text-yellow-400 animate-bounce">
                  {countdown}
                </span>
              </div>
            )}
          </div>

          {/* Interactive Drag & Drop / Upload Trigger Label */}
          <button
            onClick={triggerFileSelect}
            disabled={isUploading}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-850 rounded-xl border border-slate-800 text-xs font-bold text-slate-300 flex items-center space-x-1.5 transition-all shadow"
          >
            <Upload className="w-3.5 h-3.5 text-blue-400" />
            <span>Select/Upload From Gallery</span>
          </button>
          <span className="text-[9px] text-slate-500 mt-2 text-center">
            Drag image directly onto this card or click to browse files
          </span>

          {uploadError && (
            <p className="mt-2 text-[10px] text-red-400 font-bold bg-red-950/50 px-2 py-1 border border-red-900/30 rounded">
              {uploadError}
            </p>
          )}

          {hasPermission === false && (
            <p className="mt-4 text-[9px] text-amber-500 text-center leading-normal bg-amber-950/25 p-2 rounded border border-amber-900/20 max-w-xs">
              ⚠️ Camera unavailable/rejected. Device gallery uploads are fully supported and will align perfectly!
            </p>
          )}
        </div>

        {/* Captured Micro Previews in lower rail */}
        <div className="grid grid-cols-3 gap-3 w-full px-2 max-w-xs mt-4 shrink-0">
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
                <img src={captured.normal} alt="Normal" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
                <img src={captured.attack} alt="Attack" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
                <img src={captured.hit} alt="Hit" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <Skull className="w-5 h-5 text-slate-600" />
              )}
            </div>
            <span className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">😵 Hit</span>
          </div>
        </div>

      </div>

      {/* Bottom Actions Row Controls */}
      <div className="flex flex-col w-full max-w-sm gap-2 pb-2 shrink-0">
        {/* Real-time camera shutter snap (visible only if camera feeds are active) */}
        {hasPermission === true && (
          <button
            onClick={triggerCapture}
            id="btn-take-snapshot"
            disabled={countdown !== null || isUploading}
            className={`w-full py-3 rounded-xl font-bold tracking-widest text-xs uppercase flex items-center justify-center space-x-2 transition-all ${
              (countdown !== null || isUploading)
                ? 'bg-slate-850 text-slate-600 border border-slate-800 shadow-none cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white shadow-lg shadow-red-950/50 hover:shadow-red-600/20'
            }`}
          >
            <Camera className="w-4 h-4 shrink-0" />
            <span>{countdown !== null ? `Snapping in ${countdown}...` : `Snap Shutter`}</span>
          </button>
        )}

        {/* Confirmation buttons */}
        <div className="grid grid-cols-2 gap-2 mt-1">
          <button
            onClick={onCancel}
            id="btn-cancel-capture"
            className="py-2.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-900 text-[10px] font-bold tracking-wider uppercase text-slate-400 transition-all font-mono"
          >
            Use Default Avatar
          </button>
          <button
            onClick={handleDone}
            id="btn-confirm-capture"
            disabled={isUploading || (!captured.normal && !captured.attack && !captured.hit)}
            className={`py-2.5 rounded-xl flex items-center justify-center space-x-1 text-[10px] font-bold tracking-wider uppercase transition-all ${
              (!isUploading && (captured.normal || captured.attack || captured.hit))
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                : 'bg-slate-900 border border-slate-850 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>Continue</span>
          </button>
        </div>
      </div>
    </div>
  );
}
