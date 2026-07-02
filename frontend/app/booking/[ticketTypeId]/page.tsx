"use client";

import { api, ApiError, TicketTypeDto } from "@/lib/api";
import { getClientId } from "@/lib/clientId";
import { formatVnd } from "@/lib/format";
import { getSocket } from "@/lib/socket";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTicketType } from "./hooks/useTicketType";
import { AnimatePresence, motion } from "framer-motion";

export default function BookingPage() {
  const params = useParams<{ ticketTypeId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  const {
    data: ticketType,
    isLoading: loadingType,
    error: loadError,
  } = useTicketType({ ticketTypeId: params.ticketTypeId });

  useEffect(() => {
    const socket = getSocket();
    const onUpdate = (payload: TicketTypeDto[]) => {
      queryClient.setQueriesData(
        { queryKey: [api.keygetTicketType] },
        (current: TicketTypeDto | undefined) => {
          if (!current) return current;
          const updated = payload.find((item) => item._id === current._id);
          return updated ?? current;
        },
      );
      queryClient.setQueriesData(
        { queryKey: [api.keylistTicketTypes] },
        payload,
      );
    };

    socket.on("inventory:update", onUpdate);
    return () => {
      socket.off("inventory:update", onUpdate);
    };
  }, [params.ticketTypeId, queryClient]);

  useEffect(() => {
    if (!ticketType) return;
    setQuantity((prev) =>
      Math.min(prev, Math.max(1, Math.min(8, ticketType.availableQuantity))),
    );
  }, [ticketType?.availableQuantity, ticketType?._id]);

  const holdMutation = useMutation({
    mutationFn: () =>
      api.hold(params.ticketTypeId as string, quantity, getClientId()),
    onSuccess: (reservation) => {
      router.push(`/checkout/${reservation._id}`);
      setError(null);
    },
    onError: (e) => {
      const err = e as ApiError;
      if (err.code === "OUT_OF_STOCK") {
        setError(
          "Rất tiếc, vé vừa hết ngay khi bạn bấm chọn. Hãy thử loại vé khác.",
        );
        void api.getTicketType(params.ticketTypeId).catch(() => {});
      } else if (err.status === 0) {
        setError(
          "Mất kết nối mạng. Vui lòng kiểm tra đường truyền và thử lại.",
        );
      } else {
        setError(err.message);
      }
    },
  });

  function beginSubmitLock() {
    if (holdMutation.isPending || submitLockRef.current) return false;
    submitLockRef.current = true;
    setIsSubmitting(true);
    return true;
  }

  async function handleHold() {
    if (!beginSubmitLock()) return;
    setError(null);
    void holdMutation.mutateAsync().finally(() => {
      submitLockRef.current = false;
      setIsSubmitting(false);
    });
  }

  if (loadingType) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="font-mono text-mist/50 text-sm tracking-widest">
          ĐANG TẢI...
        </div>
      </main>
    );
  }

  if (!ticketType) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 text-center">
        <p className="text-coral">
          {error || loadError?.message || "Không tìm thấy loại vé"}
        </p>
      </main>
    );
  }

  const max = Math.min(8, Math.max(0, ticketType.availableQuantity));
  const soldOut = ticketType.availableQuantity === 0;

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
          NOVA NIGHT · ĐẶT VÉ
        </p>
        <h1 className="font-display text-5xl text-mist mt-2">
          {ticketType.name}
        </h1>
        <p className="text-mist/60 mt-2 text-sm">{ticketType.description}</p>
        <p className="font-mono text-3xl text-amber mt-6">
          {formatVnd(ticketType.price)}
        </p>

        {soldOut ? (
          <div className="mt-8 text-center text-coral font-display text-2xl tracking-wide">
            VÉ ĐÃ HẾT
          </div>
        ) : (
          <>
            <div className="mt-8">
              <label className="block text-xs font-mono tracking-widest text-mist/50 mb-3">
                SỐ LƯỢNG (CÒN {ticketType.availableQuantity} VÉ)
              </label>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={holdMutation.isPending || isSubmitting}
                  className="w-10 h-10 rounded-lg bg-velvet text-mist text-xl disabled:opacity-40"
                >
                  −
                </button>
                <span className="font-mono text-2xl w-8 text-center">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(max, q + 1))}
                  disabled={
                    holdMutation.isPending || isSubmitting || quantity >= max
                  }
                  className="w-10 h-10 rounded-lg bg-velvet text-mist text-xl disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>

            <p className="mt-4 text-xs text-mist/50">
              Khi bạn bấm "Giữ vé", hệ thống sẽ khoá {quantity} vé cho bạn trong{" "}
              <span className="text-amber">5 phút</span> để hoàn tất thanh toán.
            </p>

            <AnimatePresence mode="wait">
              {error && (
                <motion.p
                  key={error}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="mt-4 text-sm text-coral bg-coral/10 border border-coral/30 rounded-lg px-3 py-2"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleHold}
              disabled={holdMutation.isPending || isSubmitting}
              aria-busy={holdMutation.isPending}
              className="mt-6 w-full rounded-xl bg-amber hover:bg-coral disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-ink font-display text-2xl tracking-wide py-4 flex items-center justify-center gap-3"
            >
              {holdMutation.isPending ? (
                <>
                  <span className="w-4 h-4 border-2 border-ink/40 border-t-ink rounded-full animate-spin" />
                  ĐANG GIỮ VÉ...
                </>
              ) : (
                "GIỮ VÉ NGAY"
              )}
            </motion.button>
          </>
        )}
      </motion.div>
    </main>
  );
}
