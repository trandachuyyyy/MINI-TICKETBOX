"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, TicketTypeDto } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { formatVnd } from "@/lib/format";
import { useTicketTypes } from "@/hooks/useTicketTypes";

export default function HomePage() {
  const queryClient = useQueryClient();
  const [live, setLive] = useState(false);
  const { data: types = [], isLoading, error } = useTicketTypes();

  useEffect(() => {
    const socket = getSocket();
    const syncConnectionState = () => {
      if (socket.disconnected) {
        socket.connect();
      }
      setLive(socket.connected);
    };
    const onConnect = () => setLive(true);
    const onDisconnect = () => setLive(false);
    const onUpdate = (payload: TicketTypeDto[]) => {
      queryClient.setQueriesData(
        { queryKey: [api.keylistTicketTypes] },
        payload,
      );
    };

    syncConnectionState();
    const intervalId = window.setInterval(syncConnectionState, 250);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onDisconnect);
    socket.on("reconnect", onConnect);
    socket.on("reconnect_error", onDisconnect);
    socket.on("inventory:update", onUpdate);

    return () => {
      window.clearInterval(intervalId);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onDisconnect);
      socket.off("reconnect", onConnect);
      socket.off("reconnect_error", onDisconnect);
      socket.off("inventory:update", onUpdate);
    };
  }, [queryClient]);

  const totalAvailable = types.reduce((s, t) => s + t.availableQuantity, 0);
  const totalCap = types.reduce((s, t) => s + t.totalQuantity, 0);

  return (
    <main className="min-h-screen bg-spotlight">
      <header className="max-w-5xl mx-auto px-6 pt-16 pb-10 text-center">
        <p className="font-mono text-xs tracking-[0.4em] text-amber/80 mb-3">
          26.09.2026 · SVĐ MỸ ĐÌNH
        </p>
        <h1 className="font-display text-7xl md:text-8xl tracking-wide text-mist leading-none">
          NOVA NIGHT
        </h1>
        <p className="mt-4 text-mist/70 max-w-md mx-auto">
          Concert giới hạn 500 vé. Cổng mở đúng giờ — vé hết là hết, không phát
          hành thêm.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 text-xs font-mono text-mist/60">
          <span
            className={`live-dot inline-block w-2 h-2 rounded-full ${live ? "bg-coral" : "bg-mist/30"}`}
          />
          {live ? "ĐANG CẬP NHẬT TRỰC TIẾP" : "ĐANG KẾT NỐI..."}
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 pb-6">
        {!isLoading && totalCap > 0 && (
          <div className="mb-10">
            <div className="flex justify-between text-xs font-mono text-mist/60 mb-2">
              <span>VÉ CÒN LẠI</span>
              <span>
                {totalAvailable}/{totalCap}
              </span>
            </div>
            <div className="h-2 rounded-full bg-velvet overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber to-coral transition-all duration-700"
                style={{ width: `${(totalAvailable / totalCap) * 100}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <p className="text-coral text-center bg-coral/10 border border-coral/30 rounded-lg py-3 px-4">
            {(error as Error).message}
          </p>
        )}

        {isLoading && (
          <div className="grid gap-5 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-48 rounded-2xl bg-panel/60 animate-pulse"
              />
            ))}
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-3">
          {types.map((t) => {
            const soldOut = t.availableQuantity === 0;
            const pct = t.totalQuantity
              ? (t.availableQuantity / t.totalQuantity) * 100
              : 0;
            return (
              <div
                key={t._id}
                className="ticket-stub rounded-2xl p-6 flex flex-col gap-4 mx-2"
              >
                <div>
                  <h2 className="font-display text-3xl tracking-wide text-amber">
                    {t.name}
                  </h2>
                  <p className="text-sm text-mist/60 mt-1">{t.description}</p>
                </div>
                <div className="font-mono text-2xl text-mist">
                  {formatVnd(t.price)}
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-mono text-mist/50 mb-1">
                    <span>CÒN LẠI</span>
                    <span>{t.availableQuantity}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-ink overflow-hidden">
                    <div
                      className="h-full bg-amber transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {soldOut ? (
                  <button
                    disabled
                    className="mt-auto rounded-xl bg-velvet/60 text-mist/40 font-display text-xl tracking-wide py-3 cursor-not-allowed"
                  >
                    ĐÃ HẾT VÉ
                  </button>
                ) : (
                  <Link
                    href={`/booking/${t._id}`}
                    className="mt-auto text-center rounded-xl bg-amber hover:bg-coral transition-colors text-ink font-display text-xl tracking-wide py-3"
                  >
                    CHỌN VÉ
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* <footer className="max-w-5xl mx-auto px-6 py-14 text-center">
        <Link
          href="/admin"
          target="_blank"
          className="text-xs font-mono text-mist/40 hover:text-mist/70 underline"
        >
          admin dashboard
        </Link>
      </footer> */}
    </main>
  );
}
