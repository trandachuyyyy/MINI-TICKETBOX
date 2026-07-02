import axios, { AxiosError, AxiosRequestConfig } from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

export class ApiError extends Error {
  code?: string;
  status: number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, options: AxiosRequestConfig & { body?: unknown } = {}): Promise<T> {
  try {
    const { body, ...axiosOptions } = options;
    const response = await apiClient.request<T>({ url: path, ...axiosOptions, data: body ?? axiosOptions.data });
    const payload = response.data as { success?: boolean; data?: T; message?: string | string[]; code?: string };

    if (!payload?.success) {
      const message = Array.isArray(payload?.message) ? payload.message.join(', ') : payload?.message;
      throw new ApiError(message || 'Đã có lỗi xảy ra', response.status, payload?.code);
    }

    return payload.data as T;
  } catch (error) {
    if (error instanceof AxiosError) {
      const payload = error.response?.data as { message?: string | string[]; code?: string } | undefined;
      const message = Array.isArray(payload?.message) ? payload.message.join(', ') : payload?.message;
      throw new ApiError(message || 'Đã có lỗi xảy ra', error.response?.status || 0, payload?.code);
    }

    throw new ApiError('Không kết nối được tới máy chủ. Vui lòng kiểm tra mạng và thử lại.', 0, 'NETWORK_ERROR');
  }
}

export interface TicketTypeDto {
  _id: string;
  name: string;
  description: string;
  price: number;
  totalQuantity: number;
  availableQuantity: number;
  heldQuantity: number;
  soldQuantity: number;
}

export interface ReservationDto {
  _id: string;
  ticketTypeId: string;
  quantity: number;
  status: 'HELD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';
  clientId: string;
  expiresAt: string;
  totalAmount: number;
}

export const api = {
  keylistTicketTypes:"listTicketTypes",
  keygetTicketType:"getTicketType",
  keyhold:"hold",
  keygetReservation:"getReservation",
  keyconfirm:"confirm",
  keycancel:"cancel",
  keyadminStats:"adminStats",
  keyadminHolds:"adminHolds",
  keyrequestOtp:"requestOtp",
  keyverifyOtp:"verifyOtp",
  listTicketTypes: () => request<TicketTypeDto[]>('/tickets'),
  getTicketType: (id: string) => request<TicketTypeDto>(`/tickets/${id}`),
  hold: (ticketTypeId: string, quantity: number, clientId: string) =>
    request<ReservationDto>(`/tickets/${ticketTypeId}/hold`, {
      method: 'POST',
      body: JSON.stringify({ quantity, clientId }),
    }),
  getReservation: (id: string, clientId: string) =>
    request<ReservationDto>(`/tickets/reservations/${id}?clientId=${encodeURIComponent(clientId)}`),
  confirm: (
    id: string,
    payload: { clientId: string; customerName: string; customerEmail: string; customerPhone: string },
  ) =>
    request<ReservationDto>(`/tickets/reservations/${id}/confirm`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  cancel: (id: string, clientId: string) =>
    request<ReservationDto>(`/tickets/reservations/${id}?clientId=${encodeURIComponent(clientId)}`, {
      method: 'DELETE',
    }),
  requestOtp: (email: string) =>
    request<{ ok: boolean; message: string; debugCode?: string }>(`/auth/otp/request`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  verifyOtp: (email: string, code: string) =>
    request<{ ok: boolean; message: string; sessionToken?: string; userId?: string }>(`/auth/otp/verify`, {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),
  adminStats: () =>
    request<{
      totalSold: number;
      totalHeld: number;
      totalAvailable: number;
      revenue: number;
      byType: Array<{
        id: string;
        name: string;
        price: number;
        totalQuantity: number;
        soldQuantity: number;
        heldQuantity: number;
        availableQuantity: number;
      }>;
    }>('/admin/stats'),
  adminHolds: () =>
    request<
      Array<{
        _id: string;
        quantity: number;
        expiresAt: string;
        ticketTypeId: { name: string; price: number };
      }>
    >('/admin/holds'),
};

export { API_BASE };
