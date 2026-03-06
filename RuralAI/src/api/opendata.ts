/**
 * Open Data API — Feature 3
 * User data export (JSON/CSV), audit logs.
 */
import { openDataClient } from './client';
import { getMockUser } from './config';
export const opendataApi = {
  exportUserData: (format: 'json' | 'csv' = 'json', services?: string[]) => {
    const qs = new URLSearchParams();
    qs.set('format', format);
    if (services?.length) qs.set('services', services.join(','));
    return openDataClient.get(`/api/v1/export/${getMockUser().id}?${qs.toString()}`);
  },

  listAuditLogs: (limit = 20) =>
    openDataClient.get(`/api/v1/export/audit?limit=${limit}`),
};
