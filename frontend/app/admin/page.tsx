"use client";

import { Countdown } from "@/components/Countdown";
import { formatVnd } from "@/lib/format";
import { getSocket } from "@/lib/socket";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAdminHolds } from "./hooks/useAdminHolds";
import { useAdminStats } from "./hooks/useAdminStats";
import { api } from "@/lib/api";

export default function AdminPage() {
  const queryClient = useQueryClient();

  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const { data: stats, error } = useAdminStats();

  const { data: holds = [] } = useAdminHolds();

  useEffect(() => {
    const socket = getSocket();
    const onConnect = () => setRealtimeConnected(true);
    const onDisconnect = () => setRealtimeConnected(false);
    const onInventoryUpdate = () => {
      void queryClient.invalidateQueries({ queryKey: [api.keyadminStats] });
      void queryClient.invalidateQueries({ queryKey: [api.keyadminHolds] });
    };
    const onAdminUpdate = (payload: { stats?: unknown; holds?: unknown }) => {
      if (payload.stats) {
        queryClient.setQueryData([api.keyadminStats], payload.stats);
      }
      if (payload.holds) {
        queryClient.setQueryData([api.keyadminHolds], payload.holds);
      }
    };

    setRealtimeConnected(socket.connected);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onDisconnect);
    socket.on("inventory:update", onInventoryUpdate);
    socket.on("admin:update", onAdminUpdate);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onDisconnect);
      socket.off("inventory:update", onInventoryUpdate);
      socket.off("admin:update", onAdminUpdate);
    };
  }, [queryClient]);

  return (
    <main className="min-h-screen px-6 py-12 max-w-5xl mx-auto">
      <h1 className="font-display text-5xl text-mist mb-1">ADMIN DASHBOARD</h1>
      <p className="text-mist/50 text-sm mb-8">
        NOVA NIGHT — realtime là chính, polling chỉ dùng khi socket không ổn
      </p>

      {error && <p className="text-coral mb-6">{(error as Error).message}</p>}

      {stats && (
        <>
          <div className="grid gap-4 sm:grid-cols-4 mb-10">
            <StatCard
              label="Đã bán"
              value={String(stats.totalSold)}
              accent="amber"
            />
            <StatCard
              label="Đang giữ"
              value={String(stats.totalHeld)}
              accent="coral"
            />
            <StatCard
              label="Còn trống"
              value={String(stats.totalAvailable)}
              accent="mist"
            />
            <StatCard
              label="Doanh thu"
              value={formatVnd(stats.revenue)}
              accent="amber"
            />
          </div>

          <h2 className="font-display text-2xl text-mist mb-3 tracking-wide">
            THEO LOẠI VÉ
          </h2>
          <div className="overflow-x-auto mb-10">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-mist/50 font-mono text-xs uppercase tracking-wider border-b border-mist/10">
                  <th className="py-2 pr-4">Loại vé</th>
                  <th className="py-2 pr-4">Giá</th>
                  <th className="py-2 pr-4">Tổng</th>
                  <th className="py-2 pr-4">Đã bán</th>
                  <th className="py-2 pr-4">Đang giữ</th>
                  <th className="py-2 pr-4">Còn trống</th>
                </tr>
              </thead>
              <tbody>
                {stats.byType.map((t) => (
                  <tr key={t.id} className="border-b border-mist/5">
                    <td className="py-2.5 pr-4 text-mist">{t.name}</td>
                    <td className="py-2.5 pr-4 font-mono text-mist/70">
                      {formatVnd(t.price)}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-mist/70">
                      {t.totalQuantity}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-amber">
                      {t.soldQuantity}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-coral">
                      {t.heldQuantity}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-mist">
                      {t.availableQuantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2 className="font-display text-2xl text-mist mb-3 tracking-wide">
        VÉ ĐANG BỊ KHOÁ TẠM THỜI ({holds.length})
      </h2>
      {holds.length === 0 ? (
        <p className="text-mist/40 text-sm">Không có vé nào đang được giữ.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {holds.map((h) => (
            <div
              key={h._id}
              className="rounded-xl bg-panel/70 border border-mist/10 p-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-mist">{h.ticketTypeId?.name}</p>
                  <p className="text-xs text-mist/40 font-mono mt-0.5">
                    {h.quantity} vé ·{" "}
                    {formatVnd((h.ticketTypeId?.price || 0) * h.quantity)}
                  </p>
                </div>
              </div>
              <div className="mt-3 scale-90 origin-left">
                <Countdown expiresAt={h.expiresAt} />
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "amber" | "coral" | "mist";
}) {
  const colorClass = {
    amber: "text-amber",
    coral: "text-coral",
    mist: "text-mist",
  }[accent];
  return (
    <div className="rounded-xl bg-panel/70 border border-mist/10 p-5">
      <p className="text-xs font-mono uppercase tracking-wider text-mist/50">
        {label}
      </p>
      <p className={`font-display text-3xl mt-1 ${colorClass}`}>{value}</p>
    </div>
  );
}
