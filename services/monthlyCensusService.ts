import { supabase } from './supabase';
import { ResidentMonthlyCensus, ResidentMonthlyCensusInput } from '../types';

const normalizeReportMonth = (reportMonth: string) => {
  if (/^\d{4}-\d{2}$/.test(reportMonth)) {
    return `${reportMonth}-01`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(reportMonth)) {
    return reportMonth.slice(0, 10);
  }
  throw new Error('Invalid report month. Expected YYYY-MM or YYYY-MM-DD.');
};

export const getMonthlyCensusByMonth = async (residentId: string, reportMonth: string) => {
  const normalized = normalizeReportMonth(reportMonth);
  const { data, error } = await supabase
    .from('resident_monthly_census')
    .select('*')
    .eq('resident_id', residentId)
    .eq('report_month', normalized)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as ResidentMonthlyCensus | null;
};

export const upsertMonthlyCensus = async (payload: ResidentMonthlyCensusInput) => {
  const normalizedPayload = {
    ...payload,
    report_month: normalizeReportMonth(payload.report_month),
    absence_days: payload.has_absence ? payload.absence_days : 0,
  };

  const { data, error } = await supabase
    .from('resident_monthly_census')
    .upsert(normalizedPayload, { onConflict: 'resident_id,report_month' })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data as ResidentMonthlyCensus;
};
