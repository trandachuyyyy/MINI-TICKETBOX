"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { api, ApiError } from "@/lib/api";
import { getClientId } from "@/lib/clientId";
import { formatVnd } from "@/lib/format";
import { Countdown } from "@/components/Countdown";
import { useReservation } from "./hooks/useReservation";

export default function CheckoutPage() {
  const params = useParams<{ reservationId: string }>();
  const router = useRouter();

  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [expired, setExpired] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  const clientId = getClientId();
  const {
    data: reservation,
    isLoading: loading,
    error,
  } = useReservation({ reservationId: params.reservationId, clientId });

  useEffect(() => {
    if (!reservation) return;

    if (reservation.status === "CONFIRMED") {
      setSuccess(true);
      setExpired(false);
      setSubmitError(null);
      return;
    }

    if (reservation.status !== "HELD") {
      setExpired(true);
      setSuccess(false);
    }
  }, [reservation]);

  useEffect(() => {
    if (!reservation || success || reservation.status !== "HELD") return;

    return () => {
      void api.cancel(reservation._id, clientId).catch(() => undefined);
    };
  }, [reservation?._id, reservation?.status, success, clientId]);

  const confirmMutation = useMutation({
    mutationFn: (payload: {
      customerName: string;
      customerEmail: string;
      customerPhone: string;
    }) =>
      api.confirm(params.reservationId as string, {
        clientId: getClientId(),
        ...payload,
      }),
    onSuccess: () => {
      setSuccess(true);
      setSubmitError(null);
    },
    onError: (e) => {
      const err = e as ApiError;
      if (err.code === "ALREADY_PAID") {
        setSuccess(true);
        setExpired(false);
        setSubmitError(null);
      } else if (err.code === "HOLD_EXPIRED") {
        setExpired(true);
        setSubmitError(
          "Đã hết thời gian giữ vé. Vé được trả lại kho, vui lòng chọn lại từ đầu.",
        );
      } else if (err.status === 0) {
        setSubmitError(
          "Mất kết nối mạng khi thanh toán. Vui lòng kiểm tra mạng rồi bấm thử lại — vé của bạn vẫn đang được giữ.",
        );
      } else {
        setSubmitError(err.message);
      }
    },
  });

  function beginSubmitLock() {
    if (confirmMutation.isPending || submitLockRef.current) return false;
    submitLockRef.current = true;
    setIsSubmitting(true);
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!beginSubmitLock() || expired || success) return;
    setSubmitError(null);
    void confirmMutation.mutateAsync(form).finally(() => {
      submitLockRef.current = false;
      setIsSubmitting(false);
    });
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="font-mono text-mist/50 text-sm tracking-widest">
          ĐANG TẢI...
        </div>
      </main>
    );
  }

  if (error || !reservation) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-4">
        <p className="text-coral">
          {error instanceof Error ? error.message : "Không tìm thấy đơn giữ vé"}
        </p>
        <button
          onClick={() => router.push("/")}
          className="text-amber underline text-sm"
        >
          Quay lại trang chủ
        </button>
      </main>
    );
  }

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="ticket-stub rounded-2xl p-8 max-w-md w-full text-center">
          <p className="font-display text-4xl text-amber">
            THANH TOÁN THÀNH CÔNG
          </p>
          <p className="text-mist/70 mt-3 text-sm">
            Cảm ơn {form.customerName}! Vé của bạn đã được xác nhận. Mã đơn:
          </p>
          <p className="font-mono text-lg text-mist mt-2">{reservation._id}</p>
          <button
            onClick={() => router.push("/")}
            className="mt-6 w-full rounded-xl bg-amber text-ink font-display text-xl tracking-wide py-3"
          >
            VỀ TRANG CHỦ
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="ticket-stub rounded-2xl p-8 max-w-md w-full mx-2"
      >
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-5 text-sm text-amber/80 hover:text-amber "
        >
          ← Quay lại
        </button>
        <p className="font-mono text-xs tracking-[0.3em] text-amber/70">
          XÁC NHẬN THANH TOÁN
        </p>
        <p className="text-mist mt-2">
          {reservation.quantity} vé ·{" "}
          <span className="font-mono">
            {formatVnd(reservation.totalAmount)}
          </span>
        </p>

        <div className="mt-5 mb-6 border-t border-amber/15 pt-5">
          {expired ? (
            <p className="text-coral font-display text-2xl tracking-wide">
              ⏱ ĐÃ HẾT GIỜ GIỮ VÉ
            </p>
          ) : (
            <Countdown
              expiresAt={reservation.expiresAt}
              onExpire={() => setExpired(true)}
            />
          )}
          <p className="mt-3 text-xs text-mist/50 leading-5">
            Nếu bạn F5, bấm lại hoặc mở tab mới, hệ thống sẽ giữ nguyên đơn đang
            hoạt động và không tạo thêm đơn trùng.
          </p>
        </div>

        {expired ? (
          <div className="text-center">
            <p className="text-sm text-mist/60 mb-4">
              Vé đã được trả lại kho cho người khác. Vui lòng quay lại trang chủ
              để chọn vé khác.
            </p>
            <button
              onClick={() => router.push("/")}
              className="w-full rounded-xl bg-amber text-ink font-display text-xl tracking-wide py-3"
            >
              CHỌN VÉ KHÁC
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field
              label="Họ và tên"
              value={form.customerName}
              onChange={(v) => setForm((f) => ({ ...f, customerName: v }))}
              required
            />
            <Field
              label="Email"
              type="email"
              value={form.customerEmail}
              onChange={(v) => setForm((f) => ({ ...f, customerEmail: v }))}
              required
            />
            <Field
              label="Số điện thoại"
              value={form.customerPhone}
              onChange={(v) => setForm((f) => ({ ...f, customerPhone: v }))}
              required
            />

            <AnimatePresence mode="wait">
              {submitError && (
                <motion.p
                  key={submitError}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="text-sm text-coral bg-coral/10 border border-coral/30 rounded-lg px-3 py-2"
                >
                  {submitError}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={
                confirmMutation.isPending || expired || success || isSubmitting
              }
              aria-busy={confirmMutation.isPending}
              className="w-full rounded-xl bg-amber hover:bg-coral disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-ink font-display text-2xl tracking-wide py-4 flex items-center justify-center gap-3"
            >
              {confirmMutation.isPending ? (
                <>
                  <span className="w-4 h-4 border-2 border-ink/40 border-t-ink rounded-full animate-spin" />
                  ĐANG XỬ LÝ THANH TOÁN...
                </>
              ) : (
                `THANH TOÁN ${formatVnd(reservation.totalAmount)}`
              )}
            </motion.button>
          </form>
        )}
      </motion.div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-mono tracking-widest text-mist/50 mb-1.5">
        {label.toUpperCase()}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg bg-ink border border-mist/15 focus:border-amber outline-none px-3 py-2.5 text-mist placeholder:text-mist/30"
      />
    </label>
  );
}
