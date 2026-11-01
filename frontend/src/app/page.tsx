import Link from "next/link";
import {
  Shield,
  Layers,
  Activity,
  UserCheck,
  Lock,
  Camera,
  CheckCircle2,
  Cpu,
  Eye,
  Smile,
  ArrowRight
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-slate-50 to-slate-100/70 border-b border-slate-200 py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#f0f7f6] text-[#176B68] border border-[#9ec5c3]">
                <Shield className="w-3.5 h-3.5" />
                Next-Generation Biometric Security Platform
              </div>

              <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
                Face Liveness & <br />
                <span className="text-[#176B68]">Presentation Attack</span> Detection
              </h1>

              <p className="text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
                A dual-engine platform combining deep learning anti-spoofing neural networks
                with multi-frame temporal heuristics and interactive biometric action challenges.
                Defends against physical 2D print attacks, digital screen replays, and identity spoofing.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  href="/resident"
                  className="px-6 py-3 bg-[#176B68] hover:bg-[#0f4b49] text-white font-bold text-sm rounded-xl transition-all shadow-sm hover:shadow flex items-center gap-2"
                >
                  <Camera className="w-4 h-4" /> Start Face Verification
                </Link>
                <Link
                  href="/login"
                  className="px-6 py-3 bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm rounded-xl border border-slate-300 transition-all shadow-sm flex items-center gap-2"
                >
                  <Lock className="w-4 h-4 text-[#D6B77A]" /> Staff Sign In
                </Link>
              </div>

              {/* Verified Features Pills */}
              <div className="pt-6 border-t border-slate-200/80 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  MiniFASNetV2 ONNX
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  Farneback Optical Flow
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  InsightFace ArcFace 512d
                </div>
              </div>
            </div>

            {/* Right Card / Interactive Teaser */}
            <div className="lg:col-span-5">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 relative">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-3 h-3 rounded-full bg-rose-500" />
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-xs font-mono text-slate-400 ml-2">Verification Telemetry</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    Live Engine
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  {/* Step 1 */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#f0f7f6] text-[#176B68] flex items-center justify-center flex-shrink-0 font-bold text-xs">
                      01
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Presentation Attack Detection</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        MiniFASNetV2 classifies 2D print & screen replay spoof artifacts.
                      </div>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#f0f7f6] text-[#176B68] flex items-center justify-center flex-shrink-0 font-bold text-xs">
                      02
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Passive Temporal Buffer</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Calculates 30-frame motion difference, optical flow, and Laplacian texture.
                      </div>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#f0f7f6] text-[#176B68] flex items-center justify-center flex-shrink-0 font-bold text-xs">
                      03
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Interactive Active Challenge</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Validates voluntary micro-actions (Blinking, Smiling, Yaw Turn).
                      </div>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#f0f7f6] text-[#176B68] flex items-center justify-center flex-shrink-0 font-bold text-xs">
                      04
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Biometric Identity Verification</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Matches ArcFace 512-dim embedding with cosine threshold ≥ 0.60.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">Ready to test your face?</span>
                  <Link
                    href="/resident"
                    className="text-xs font-bold text-[#176B68] hover:text-[#0f4b49] flex items-center gap-1"
                  >
                    Open Live Camera <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Technical Capabilities Grid */}
      <section className="py-16 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#176B68] mb-2">
              Architecture & Detection Pipeline
            </h2>
            <h3 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Multi-Layer Defense Against Presentation Attacks
            </h3>
            <p className="text-sm text-slate-600 mt-3">
              Traditional facial recognition is vulnerable to static printouts and phone screen playback.
              FaceLivenessPAD combines deep neural feature maps with computer vision heuristics.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 1 */}
            <div className="p-6 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-[#176B68] transition-all shadow-xs group">
              <div className="w-12 h-12 rounded-xl bg-[#f0f7f6] text-[#176B68] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Cpu className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-2">MiniFASNetV2 PAD</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Lightweight convolutional network optimized for real-time 80×80 face crops,
                classifying live skin reflectance versus electronic screens and printed paper.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-[#176B68] transition-all shadow-xs group">
              <div className="w-12 h-12 rounded-xl bg-[#f0f7f6] text-[#176B68] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Layers className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-2">Passive Liveness</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Maintains rolling buffers across 30 consecutive video frames, extracting dense
                Farneback optical flow fields, Laplacian texture variance, and motion vectors.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-[#176B68] transition-all shadow-xs group">
              <div className="w-12 h-12 rounded-xl bg-[#fdfaf3] text-[#D6B77A] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Eye className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-2">Active Challenge</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Interactive real-time challenge-response testing: natural eye blink cycle (EAR),
                mouth expansion ratio (Smile), and horizontal yaw head turns.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-[#176B68] transition-all shadow-xs group">
              <div className="w-12 h-12 rounded-xl bg-[#f0f7f6] text-[#176B68] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <UserCheck className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-2">InsightFace ArcFace</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Deep facial recognition extraction using the ResNet-50 ArcFace backbone (`buffalo_l`),
                generating 512-dimensional unit embeddings evaluated via cosine dot product.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Role-Based Workspaces Overview */}
      <section className="py-16 bg-slate-50/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#176B68] mb-2">
              Role-Based Access Control
            </h2>
            <h3 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Dedicated Operational Workspaces
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Operator Card */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Tier 1</span>
                <h4 className="text-lg font-bold text-slate-900 mt-1 mb-2">Operator Workspace</h4>
                <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                  Frontline staff portal for assisted resident enrollment, identity verification,
                  and checking registered user biometric profiles.
                </p>
              </div>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#176B68] hover:underline"
              >
                Access Operator Portal <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Supervisor Card */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Tier 2</span>
                <h4 className="text-lg font-bold text-slate-900 mt-1 mb-2">Supervisor Workspace</h4>
                <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                  Supervisory overview portal featuring verification statistics, audit event explorer,
                  and live session monitoring.
                </p>
              </div>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#176B68] hover:underline"
              >
                Access Supervisor Portal <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Admin Card */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Tier 3</span>
                <h4 className="text-lg font-bold text-slate-900 mt-1 mb-2">Admin Console</h4>
                <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                  Full administrative authority: staff account creation, role assignments,
                  user account activation/deactivation, and system-wide audit logs.
                </p>
              </div>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#176B68] hover:underline"
              >
                Access Admin Console <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
