import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export const useAdminStats = () => {
    return useQuery({
    queryKey: [api.keyadminStats],
    queryFn: () => api.adminStats(),
    refetchInterval: 8000,
    refetchIntervalInBackground: false,
  });
}