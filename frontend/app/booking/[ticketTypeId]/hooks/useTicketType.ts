import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export const useTicketType = ({ ticketTypeId }: { ticketTypeId: string }) => {
    return useQuery({
    queryKey: [api.keygetTicketType, ticketTypeId],
    queryFn: () => api.getTicketType(ticketTypeId),
    enabled: !!ticketTypeId,
  });
}