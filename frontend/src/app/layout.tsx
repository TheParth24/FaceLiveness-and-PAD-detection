import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "FaceLivenessPAD — Enterprise Biometric Authentication & PAD Platform",
  description:
    "Production-grade face liveness detection, presentation attack detection (PAD), and biometric identity verification platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-slate-50 text-slate-900" suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 antialiased" suppressHydrationWarning>
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">FaceLivenessPAD</span>
              <span>•</span>
              <span>MiniFASNetV2 ONNX & InsightFace buffalo_l Pipeline</span>
            </div>
            <div>
              Light-Mode Enterprise Security Architecture • Biometric Verification Platform
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
