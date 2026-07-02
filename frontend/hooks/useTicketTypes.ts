import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export const useTicketTypes = () => {
    return  useQuery({
    queryKey: [api.keylistTicketTypes],
    queryFn: () => api.listTicketTypes(),
  });
}