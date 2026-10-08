import { printJson } from '../format.js';
import type { HttpClient } from '../http.js';

export const BILLING_USAGE = `rheo billing: billing status only (checkout/portal/downgrade stay in the dashboard)

  rheo billing status
`;

export const runBillingStatus = async (opts: { http: HttpClient }): Promise<number> => {
  printJson(await opts.http.get('/v1/dashboard/billing/status'));
  return 0;
};
