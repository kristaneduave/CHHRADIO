import { supabase } from './supabase';
import { ResidentMonthlyCensus, ResidentMonthlyCensusInput } from '../types';
import { isValidMonthlyCensusRotation } from '../utils/monthlyCensusValidation';

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
  const normalizedAbsenceDays = payload.absence_days < 0 ? 0 : payload.absence_days;
  const normalizedRotation = payload.rotation?.trim();
  if (!normalizedRotation || !isValidMonthlyCensusRotation(normalizedRotation)) {
    throw new Error('Invalid rotation selected.');
  }

  const normalizedComments = payload.comments?.trim() ?? null;
  const normalizedPayload = {
    ...payload,
    report_month: normalizeReportMonth(payload.report_month),
    rotation: normalizedRotation,
    comments: normalizedComments,
    msk_pedia_target_met: normalizedRotation === 'Pedia/MSK' ? payload.msk_pedia_target_met ?? false : null,
    absence_days: normalizedAbsenceDays,
    has_absence: normalizedAbsenceDays > 0,
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
