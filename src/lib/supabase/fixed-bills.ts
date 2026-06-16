import { supabase } from './supabaseClient';
import { useAuth } from './auth-context';
import { useEffect, useState } from 'react';

export interface FixedBill {
  id: string;
  year: number;
  month: number;
  item: string;
  amount: number;
  dueDay: number;
  separated: 'ok' | 'pendente';
  paid: boolean;
  paidAt?: string;
  account?: string;
  user_id: string;
}

export function useFixedBills() {
  const { user } = useAuth();
  const [bills, setBills] = useState<FixedBill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setBills([]);
      setLoading(false);
      return;
    }

    const fetchBills = async () => {
      const { data, error } = await supabase
        .from('contas_fixas')
        .select('*')
        .eq('user_id', user.id)
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (error) {
        console.error('Error fetching fixed bills:', error);
      } else {
        setBills(data || []);
      }
      setLoading(false);
    };

    fetchBills();

    const channel = supabase
      .channel('contas_fixas-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contas_fixas',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setBills((prev) => [...prev, payload.new as FixedBill]);
          } else if (payload.eventType === 'UPDATE') {
            setBills((prev) =>
              prev.map((b) => (b.id === payload.new.id ? (payload.new as FixedBill) : b))
            );
          } else if (payload.eventType === 'DELETE') {
            setBills((prev) => prev.filter((b) => b.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { bills, loading };
}

export async function addFixedBill(bill: Omit<FixedBill, 'id' | 'user_id'>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('contas_fixas')
    .insert({ ...bill, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateFixedBill(id: string, patch: Partial<Omit<FixedBill, 'id' | 'user_id'>>) {
  const { data, error } = await supabase
    .from('contas_fixas')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteFixedBill(id: string) {
  const { error } = await supabase.from('contas_fixas').delete().eq('id', id);
  if (error) throw error;
}

export async function markFixedBillPaid(id: string, paid: boolean) {
  const { error } = await supabase
    .from('contas_fixas')
    .update({ paid, paidAt: paid ? new Date().toISOString() : null })
    .eq('id', id);

  if (error) throw error;
}
