/**
 * Open Data API — Feature 3
 * User data export (JSON/CSV), audit logs.
 */
import { feature3 } from './client';
import { MOCK_USER } from './config';

export const opendataApi = {
  exportUserData: (format: 'json' | 'csv' = 'json', services?: string[]) => {
    const qs = new URLSearchParams();
    qs.set('format', format);
    if (services?.length) qs.set('services', services.join(','));
    return feature3.get(`/api/v1/export/${MOCK_USER.id}?${qs.toString()}`);
  },

  listAuditLogs: (limit = 20) =>
    feature3.get(`/api/v1/export/audit?limit=${limit}`),
};
