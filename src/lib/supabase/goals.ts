import { supabase } from './supabaseClient';
import { useAuth } from './auth-context';
import { useEffect, useState } from 'react';

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

  useEffect(() => {
    if (!user) {
      setGoals([]);
      setLoading(false);
      return;
    }

    const fetchGoals = async () => {
      const { data, error } = await supabase
        .from('metas')
        .select('*')
        .eq('user_id', user.id)
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (error) {
        console.error('Error fetching goals:', error);
      } else {
        setGoals(data || []);
      }
      setLoading(false);
    };

    fetchGoals();

    const channel = supabase
      .channel('metas-changes')
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
            setGoals((prev) => [...prev, payload.new as Goal]);
          } else if (payload.eventType === 'UPDATE') {
            setGoals((prev) =>
              prev.map((g) => (g.id === payload.new.id ? (payload.new as Goal) : g))
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

  return { goals, loading };
}

export async function addGoal(goal: Omit<Goal, 'id' | 'user_id'>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('metas')
    .insert({ ...goal, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateGoal(id: string, patch: Partial<Omit<Goal, 'id' | 'user_id'>>) {
  const { data, error } = await supabase
    .from('metas')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteGoal(id: string) {
  const { error } = await supabase.from('metas').delete().eq('id', id);
  if (error) throw error;
}
