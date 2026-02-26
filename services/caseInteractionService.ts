import { supabase } from './supabase';
import { CaseComment, CaseRating } from '../types';

export const fetchCaseComments = async (caseId: string): Promise<CaseComment[]> => {
    const { data, error } = await supabase
        .from('case_comments')
        .select(`
            *,
            user:profiles(full_name, avatar_url, nickname)
        `)
        .eq('case_id', caseId)
        .order('created_at', { ascending: true }); // Chronological order

    if (error) {
        console.error('Error fetching comments:', error);
        return [];
    }

    return data || [];
};

export const submitCaseComment = async (caseId: string, content: string): Promise<CaseComment | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('case_comments')
        .insert({
            case_id: caseId,
            user_id: user.id,
            content
        })
        .select(`
            *,
            user:profiles(full_name, avatar_url, nickname)
        `)
        .single();

    if (error) {
        console.error('Error submitting comment:', error);
        return null;
    }

    return data;
};

export const fetchCaseRatings = async (caseId: string): Promise<{ average: number; userRating: number | null }> => {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
        .from('case_ratings')
        .select('user_id, rating')
        .eq('case_id', caseId);

    if (error || !data) {
        console.error('Error fetching ratings:', error);
        return { average: 0, userRating: null };
    }

    if (data.length === 0) {
        return { average: 0, userRating: null };
    }

    const total = data.reduce((sum, current) => sum + current.rating, 0);
    const average = total / data.length;

    const userRating = user ? data.find(r => r.user_id === user.id)?.rating || null : null;

    return { average, userRating };
};

export const submitCaseRating = async (caseId: string, rating: number): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
        .from('case_ratings')
        .upsert({
            case_id: caseId,
            user_id: user.id,
            rating
        }, {
            onConflict: 'case_id,user_id'
        });

    if (error) {
        console.error('Error submitting rating:', error);
        return false;
    }

    return true;
};
