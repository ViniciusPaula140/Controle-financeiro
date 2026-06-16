import { supabase } from './supabaseClient';
import { useAuth } from './auth-context';
import { useEffect, useState } from 'react';
import { mapGoalFromDb, mapGoalToDb } from './mappers';
import { realtimeChannelName, requireRow } from './realtime-utils';

export interface Goal {
  id: string;
  year: number;
  month: number;
  amount: number;
  note?: string;
  user_id: string;
}

export function useGoals() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setGoals([]);
      setLoading(false);
      setError(null);
      return;
    }

    if (!supabase) {
      console.error('Supabase client is not configured');
      setGoals([]);
      setLoading(false);
      setError(new Error('Supabase client is not configured'));
      return;
    }

    const fetchGoals = async () => {
      try {
        const { data, error } = await supabase
          .from('metas')
          .select('*')
          .eq('user_id', user.id)
          .order('ano', { ascending: false })
          .order('mes', { ascending: false });

        if (error) {
          console.error('Error fetching goals:', error);
          setError(error);
        } else {
          setGoals((data ?? []).map(mapGoalFromDb));
          setError(null);
        }
      } catch (err) {
        console.error('Unexpected error fetching goals:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchGoals();

    const channelName = realtimeChannelName('metas', user.id);
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'metas',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setGoals((prev) => [...prev, mapGoalFromDb(payload.new)]);
          } else if (payload.eventType === 'UPDATE') {
            setGoals((prev) =>
              prev.map((g) => (g.id === payload.new.id ? mapGoalFromDb(payload.new) : g))
            );
          } else if (payload.eventType === 'DELETE') {
            setGoals((prev) => prev.filter((g) => g.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { goals, loading, error };
}

export async function addGoal(goal: Omit<Goal, 'id' | 'user_id'>) {
  if (!supabase) throw new Error('Supabase client is not configured');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('metas')
    .insert({ ...mapGoalToDb(goal), user_id: user.id })
    .select()
    .maybeSingle();

  if (error) throw error;
  return mapGoalFromDb(requireRow(data, 'inserção de meta'));
}

export async function updateGoal(id: string, patch: Partial<Omit<Goal, 'id' | 'user_id'>>) {
  if (!supabase) throw new Error('Supabase client is not configured');

  const { data, error } = await supabase
    .from('metas')
    .update(mapGoalToDb(patch))
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) throw error;
  return mapGoalFromDb(requireRow(data, 'atualização de meta'));
}

export async function deleteGoal(id: string) {
  if (!supabase) throw new Error('Supabase client is not configured');

  const { error } = await supabase.from('metas').delete().eq('id', id);
  if (error) throw error;
}
