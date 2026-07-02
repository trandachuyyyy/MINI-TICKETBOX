import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export const useReservation = ({ reservationId,clientId }: { reservationId: string; clientId: string }) => {
    return useQuery({
    queryKey: [api.keygetReservation, reservationId, clientId],
    queryFn: () => api.getReservation(reservationId, clientId),
    enabled: !!reservationId,
  });
}