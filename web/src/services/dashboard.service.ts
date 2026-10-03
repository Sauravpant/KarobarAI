import api from '@/lib/api';
import type { ApiResponse, DailyBrief, DashboardData } from '@/types';

export async function getDashboardData(shopId: string): Promise<DashboardData> {
  const res = await api.get<ApiResponse<DashboardData>>(`/shops/${shopId}/dashboard`);
  return res.data.data;
}

export async function getDailyBrief(shopId: string, briefDate?: string): Promise<DailyBrief> {
  const res = await api.get<ApiResponse<DailyBrief>>(`/shops/${shopId}/dashboard/brief`, {
    params: briefDate ? { brief_date: briefDate } : undefined,
  });
  return res.data.data;
}

/**
 * The brief's MP3. Needs the auth header, so it can't be a plain <audio src>.
 * Every call runs TTS on the backend; fetch once and reuse the blob.
 */
export async function getDailyBriefAudio(shopId: string, briefDate?: string): Promise<Blob> {
  const res = await api.get<Blob>(`/shops/${shopId}/dashboard/brief/audio`, {
    params: briefDate ? { brief_date: briefDate } : undefined,
    responseType: 'blob',
  });
  return res.data;
}
