"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [otpCode, setOtpCode] = useState<string | null>(null);

  async function requestOtp() {
    setLoading(true);
    setError(null);
    try {
      const result = await api.requestOtp(email);
      if (result.ok) {
        setOtpCode(result.debugCode ?? null);
        setStep("otp");
      }
    } catch (err: any) {
      setError(err.message || "Không thể gửi mã OTP");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setLoading(true);
    setError(null);
    try {
      const result = await api.verifyOtp(email, otp);
      if (result.ok && result.sessionToken && result.userId) {
        localStorage.setItem("ticketbox_session", result.sessionToken);
        localStorage.setItem("ticketbox_userId", result.userId);
        router.push("/");
      } else {
        setError(result.message || "OTP không đúng");
      }
    } catch (err: any) {
      setError(err.message || "OTP không đúng");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="ticket-stub rounded-2xl p-8 max-w-md w-full">
        <p className="font-mono text-xs tracking-[0.3em] text-amber/70">
          NOVA NIGHT · ĐĂNG NHẬP
        </p>
        <h1 className="font-display text-4xl text-mist mt-2">
          Xác thực bằng OTP
        </h1>
        <p className="text-mist/60 mt-3 text-sm">
          Đăng nhập bằng email để bảo vệ tài khoản và giữ vé của bạn.
        </p>

        {error && (
          <p className="mt-4 text-sm text-coral bg-coral/10 border border-coral/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {step === "email" ? (
          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="block text-xs font-mono tracking-widest text-mist/50 mb-1.5">
                EMAIL
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg bg-ink border border-mist/15 focus:border-amber outline-none px-3 py-2.5 text-mist"
              />
            </label>
            <button
              onClick={requestOtp}
              disabled={loading}
              className="w-full rounded-xl bg-amber text-ink font-display text-xl tracking-wide py-3"
            >
              {loading ? "ĐANG GỬI..." : "NHẬN MÃ OTP"}
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="block text-xs font-mono tracking-widest text-mist/50 mb-1.5">
                MÃ OTP
              </span>
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full rounded-lg bg-ink border border-mist/15 focus:border-amber outline-none px-3 py-2.5 text-mist"
              />
            </label>
            {otpCode && (
              <div className="rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-sm text-amber">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber/70">
                  Mã OTP demo
                </p>
                <p className="mt-1 font-mono text-lg">{otpCode}</p>
                <p className="mt-1 text-xs text-mist/70">
                  Nếu SMTP chưa cấu hình, mã này sẽ hiện trực tiếp để bạn có thể
                  test luồng.
                </p>
              </div>
            )}
            <button
              onClick={verifyOtp}
              disabled={loading}
              className="w-full rounded-xl bg-amber text-ink font-display text-xl tracking-wide py-3"
            >
              {loading ? "ĐANG XÁC THỰC..." : "XÁC NHẬN"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
