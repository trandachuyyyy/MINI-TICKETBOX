import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export const useAdminHolds = () => {
    return  useQuery({
    queryKey: [api.keyadminHolds],
    queryFn: () => api.adminHolds(),
    refetchInterval: 8000,
    refetchIntervalInBackground: false,
  });
}