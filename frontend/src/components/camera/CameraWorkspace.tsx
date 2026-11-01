"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Camera,
  CameraOff,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Eye,
  Smile,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Activity,
  Layers,
  Save,
  HelpCircle
} from "lucide-react";
import { BiometricTelemetry, WS_BASE, api } from "@/lib/api";

interface CameraWorkspaceProps {
  sessionId: string;
  mode: "verify" | "register";
  role: string;
  name: string;
  initialChallenge?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function CameraWorkspace({
  sessionId,
  mode,
  role,
  name,
  initialChallenge,
  onSuccess,
  onCancel,
}: CameraWorkspaceProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const inFlightRef = useRef<boolean>(false);

  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<BiometricTelemetry | null>(null);
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [registerSuccess, setRegisterSuccess] = useState<boolean>(false);
  const [rotatingChallenge, setRotatingChallenge] = useState<boolean>(false);

  const streamRef = useRef<MediaStream | null>(null);
  const cameraActiveRef = useRef<boolean>(false);

  // Initialize Camera
  const startCamera = useCallback(async () => {
    if (cameraActiveRef.current && videoRef.current?.srcObject) {
      return;
    }
    setCameraError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(() => {
            // Ignore play interrupted by unmount or re-render
          });
          cameraActiveRef.current = true;
          setCameraActive(true);
        };
      }
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        setCameraError("Camera permission denied. Please enable camera access in your browser settings.");
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        setCameraError("No webcam detected. Please connect an external camera.");
      } else if (error.name === "AbortError" || error.message?.includes("interrupted") || error.message?.includes("override")) {
        // Safe ignore browser camera transition
      } else {
        setCameraError(`Unable to start camera: ${error.message || "Device occupied or unavailable"}`);
      }
      cameraActiveRef.current = false;
      setCameraActive(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // noop
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    cameraActiveRef.current = false;
    setCameraActive(false);
  }, []);

  // WebSocket Connection
  useEffect(() => {
    startCamera();

    const wsUrl = `${WS_BASE}/ws/biometrics/${sessionId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      inFlightRef.current = false;
    };

    ws.onmessage = (event) => {
      inFlightRef.current = false;
      try {
        const data = JSON.parse(event.data);
        if (!data.error) {
          setTelemetry(data);
        }
      } catch {
        // noop
      }
    };

    ws.onerror = () => {
      inFlightRef.current = false;
    };

    ws.onclose = () => {
      inFlightRef.current = false;
    };

    // Frame streaming loop: adaptive ping-pong ensures 0 frame buffer queue lag
    const interval = setInterval(() => {
      if (
        !inFlightRef.current &&
        ws.readyState === WebSocket.OPEN &&
        videoRef.current &&
        canvasRef.current &&
        videoRef.current.readyState >= 2
      ) {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const base64 = canvas.toDataURL("image/jpeg", 0.65);
          inFlightRef.current = true;
          ws.send(JSON.stringify({ image_base64: base64 }));
        }
      }
    }, 40);

    return () => {
      clearInterval(interval);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      stopCamera();
    };
  }, [sessionId, startCamera, stopCamera]);

  // Rotate Challenge
  const handleNextChallenge = async () => {
    setRotatingChallenge(true);
    try {
      await api.nextChallenge(sessionId);
    } catch (err) {
      console.error("Failed to rotate challenge:", err);
    } finally {
      setRotatingChallenge(false);
    }
  };

  // Complete Registration
  const handleCompleteRegistration = async () => {
    setIsRegistering(true);
    try {
      await api.completeRegistration(sessionId);
      setRegisterSuccess(true);
      if (onSuccess) {
        setTimeout(onSuccess, 1500);
      }
    } catch (err: unknown) {
      const error = err as Error;
      alert(`Registration error: ${error.message}`);
    } finally {
      setIsRegistering(false);
    }
  };

  // Challenge Icon Helper
  const getChallengeIcon = (challenge: string) => {
    switch (challenge) {
      case "BLINK":
        return <Eye className="w-5 h-5 text-[#176B68]" />;
      case "SMILE":
        return <Smile className="w-5 h-5 text-[#176B68]" />;
      case "TURN LEFT":
        return <ArrowLeft className="w-5 h-5 text-[#176B68]" />;
      case "TURN RIGHT":
        return <ArrowRight className="w-5 h-5 text-[#176B68]" />;
      default:
        return <Activity className="w-5 h-5 text-[#176B68]" />;
    }
  };

  const decision = telemetry?.final_decision || "CHECK_IN_PROGRESS";
  const passiveReady = telemetry?.passive?.ready ?? false;
  const padLabel = telemetry?.pad?.label || "WAITING";
  const challengePassed = telemetry?.active_challenge?.passed ?? false;
  const identityMatched = telemetry?.identity?.status === "MATCHED";

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header bar */}
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#176B68] block">
            {mode === "register" ? "Biometric Enrollment" : "Biometric Verification"}
          </span>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            Subject: <span className="text-[#176B68]">{name}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold uppercase">
              {role}
            </span>
          </h2>
        </div>

        {/* State Pill */}
        <div className="flex items-center gap-2">
          {decision === "LIVE_VERIFIED" ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              LIVE VERIFIED & ACCESS GRANTED
            </div>
          ) : decision === "READY_TO_REGISTER" ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
              <CheckCircle className="w-4 h-4 text-[#D6B77A]" />
              LIVENESS VERIFIED — READY TO ENROLL
            </div>
          ) : decision === "SPOOF_DETECTED" ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
              <XCircle className="w-4 h-4 text-rose-600" />
              PRESENTATION ATTACK DETECTED
            </div>
          ) : decision === "IDENTITY_MISMATCH" ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              IDENTITY MISMATCH
            </div>
          ) : decision === "USER_NOT_REGISTERED" ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              USER PROFILE NOT REGISTERED
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
              <Activity className="w-4 h-4 text-[#176B68] animate-pulse" />
              EVALUATION IN PROGRESS
            </div>
          )}
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
        {/* Left Column: Camera Preview + Active Challenge Prompt (7 cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <div className="relative aspect-[4/3] bg-slate-950 rounded-xl overflow-hidden border border-slate-300 shadow-inner flex items-center justify-center">
            {/* Hidden canvas for JPEG downsampling */}
            <canvas ref={canvasRef} width={640} height={480} className="hidden" />

            {/* Video preview */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />

            {/* Camera error placeholder */}
            {cameraError && (
              <div className="absolute inset-0 bg-slate-900/90 text-white p-6 flex flex-col items-center justify-center text-center">
                <CameraOff className="w-12 h-12 text-rose-400 mb-3" />
                <h3 className="font-bold text-base mb-1">Camera Feed Interrupted</h3>
                <p className="text-xs text-slate-300 max-w-sm mb-4">{cameraError}</p>
                <button
                  onClick={startCamera}
                  className="px-4 py-2 bg-[#176B68] hover:bg-[#0f4b49] text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 shadow"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry Camera Permission
                </button>
              </div>
            )}

            {/* Face Bounding Box HUD Overlay */}
            {telemetry?.face_detected && telemetry.bbox && (
              <div
                className="absolute border-2 pointer-events-none rounded-lg transition-all duration-75"
                style={{
                  left: `${((640 - telemetry.bbox[2]) / 640) * 100}%`,
                  top: `${(telemetry.bbox[1] / 480) * 100}%`,
                  width: `${((telemetry.bbox[2] - telemetry.bbox[0]) / 640) * 100}%`,
                  height: `${((telemetry.bbox[3] - telemetry.bbox[1]) / 480) * 100}%`,
                  borderColor:
                    decision === "LIVE_VERIFIED" || decision === "READY_TO_REGISTER"
                      ? "#10b981"
                      : padLabel === "SPOOF"
                      ? "#ef4444"
                      : "#176B68",
                  boxShadow: "0 0 0 1px rgba(255,255,255,0.4)",
                }}
              >
                <span className="absolute -top-6 left-0 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#176B68] text-white uppercase">
                  {telemetry.pad.label} ({telemetry.pad.score.toFixed(2)})
                </span>
              </div>
            )}

            {/* No Face Warning Overlay */}
            {!telemetry?.face_detected && cameraActive && !cameraError && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/85 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 shadow-lg border border-slate-700">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Position your face within the frame
              </div>
            )}

            {/* Frame rate / Feed metadata overlay */}
            <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-[11px] font-mono text-slate-300">
              640×480 • 15 FPS • Live
            </div>
          </div>

          {/* Active Challenge Card */}
          <div className="bg-[#fdfaf3] border border-[#e8d7b3] rounded-xl p-4 flex items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-white border border-[#D6B77A] flex items-center justify-center shadow-xs">
                {getChallengeIcon(telemetry?.active_challenge?.challenge || initialChallenge || "BLINK")}
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-[#D6B77A] tracking-wider">
                  Interactive Active Challenge
                </div>
                <div className="text-base font-bold text-slate-900 flex items-center gap-2">
                  {telemetry?.active_challenge?.challenge || initialChallenge || "BLINK"}
                  {challengePassed ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Passed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-800 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      In Progress
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                  {telemetry?.active_challenge?.progress || "Align face to evaluate"}
                </div>
              </div>
            </div>

            <button
              onClick={handleNextChallenge}
              disabled={rotatingChallenge}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${rotatingChallenge ? "animate-spin text-[#176B68]" : ""}`} />
              Next Challenge
            </button>
          </div>
        </div>

        {/* Right Column: Multi-Stage Telemetry Gauges (5 cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          {/* Gate 1: Presentation Attack Detection (PAD) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#176B68]" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Presentation Attack Detection (PAD)
                </h4>
              </div>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded ${
                  padLabel === "REAL"
                    ? "bg-emerald-100 text-emerald-800"
                    : padLabel === "SPOOF"
                    ? "bg-rose-100 text-rose-800"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {padLabel}
              </span>
            </div>

            <div className="text-[11px] text-slate-600 mb-2 flex justify-between">
              <span>MiniFASNetV2 Score:</span>
              <span className="font-mono font-semibold text-slate-900">
                {(telemetry?.pad?.score ?? 0).toFixed(3)} / 1.000
              </span>
            </div>

            {/* Score Bar */}
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden relative">
              <div
                className={`h-full transition-all duration-150 ${
                  padLabel === "REAL" ? "bg-[#176B68]" : padLabel === "SPOOF" ? "bg-rose-500" : "bg-slate-400"
                }`}
                style={{ width: `${Math.min(100, (telemetry?.pad?.score ?? 0) * 100)}%` }}
              />
              {/* Threshold mark at 50% */}
              <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-900/60" title="Threshold: 0.50" />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>0.0 (Spoof)</span>
              <span>Cutoff (0.50)</span>
              <span>1.0 (Live)</span>
            </div>
          </div>

          {/* Gate 2: Passive Liveness Tracker (30 Frames) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#176B68]" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Passive Liveness (Temporal Buffer)
                </h4>
              </div>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded ${
                  passiveReady ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                }`}
              >
                {passiveReady ? "READY" : `${telemetry?.passive?.frames ?? 0}/30 FRAMES`}
              </span>
            </div>

            {/* Buffer Progress Bar */}
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-[#176B68] transition-all duration-100"
                style={{
                  width: `${Math.min(100, ((telemetry?.passive?.frames ?? 0) / 30) * 100)}%`,
                }}
              />
            </div>

            {/* Heuristic Sub-Metrics Grid */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <div className="text-[10px] text-slate-500 font-semibold">MOTION</div>
                <div className="text-xs font-mono font-bold text-slate-900">
                  {(telemetry?.passive?.motion ?? 0).toFixed(2)}
                </div>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <div className="text-[10px] text-slate-500 font-semibold">OPTICAL FLOW</div>
                <div className="text-xs font-mono font-bold text-slate-900">
                  {(telemetry?.passive?.flow ?? 0).toFixed(2)}
                </div>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <div className="text-[10px] text-slate-500 font-semibold">TEXTURE</div>
                <div className="text-xs font-mono font-bold text-slate-900">
                  {(telemetry?.passive?.texture ?? 0).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Gate 3: Biometric Identity Match (InsightFace) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#176B68]" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Identity Verification
                </h4>
              </div>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded ${
                  identityMatched
                    ? "bg-emerald-100 text-emerald-800"
                    : telemetry?.identity?.status === "MISMATCH"
                    ? "bg-rose-100 text-rose-800"
                    : mode === "register"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {mode === "register" ? "ENROLLMENT" : telemetry?.identity?.status || "WAITING"}
              </span>
            </div>

            {mode === "verify" ? (
              <>
                <div className="text-[11px] text-slate-600 mb-2 flex justify-between">
                  <span>Cosine Similarity:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {(telemetry?.identity?.similarity ?? 0).toFixed(3)} (Threshold: 0.450)
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden relative">
                  <div
                    className={`h-full transition-all duration-150 ${
                      identityMatched ? "bg-emerald-600" : "bg-amber-500"
                    }`}
                    style={{
                      width: `${Math.min(100, Math.max(0, (telemetry?.identity?.similarity ?? 0) * 100))}%`,
                    }}
                  />
                  {/* Threshold marker at 45% */}
                  <div className="absolute top-0 bottom-0 left-[45%] w-0.5 bg-slate-900/60" title="Threshold: 0.45" />
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-600">
                ArcFace ResNet-50 512-dimensional embedding will be generated and saved upon liveness verification.
              </p>
            )}
          </div>

          {/* Action Decision Container */}
          <div className="pt-2">
            {mode === "register" ? (
              <button
                onClick={handleCompleteRegistration}
                disabled={decision !== "READY_TO_REGISTER" || isRegistering || registerSuccess}
                className={`w-full py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all ${
                  registerSuccess
                    ? "bg-emerald-600 text-white"
                    : decision === "READY_TO_REGISTER"
                    ? "bg-[#176B68] hover:bg-[#0f4b49] text-white cursor-pointer"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                {registerSuccess ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-white" /> Enrolled Successfully!
                  </>
                ) : isRegistering ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" /> Saving Biometric Profile...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" /> Save Resident Biometric Profile
                  </>
                )}
              </button>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-medium">
                  <HelpCircle className="w-4 h-4 text-[#176B68]" /> Final Access State:
                </span>
                <span
                  className={`font-bold ${
                    decision === "LIVE_VERIFIED"
                      ? "text-emerald-700"
                      : decision === "SPOOF_DETECTED" || decision === "IDENTITY_MISMATCH"
                      ? "text-rose-700"
                      : "text-amber-700"
                  }`}
                >
                  {decision}
                </span>
              </div>
            )}

            {onCancel && (
              <button
                onClick={onCancel}
                className="w-full mt-2 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel Session
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
