import { supabase } from './supabaseClient';
import { useAuth } from './auth-context';
import { useEffect, useState } from 'react';
import { mapFixedBillFromDb, mapFixedBillToDb } from './mappers';

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
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setBills([]);
      setLoading(false);
      setError(null);
      return;
    }

    if (!supabase) {
      console.error('Supabase client is not configured');
      setBills([]);
      setLoading(false);
      setError(new Error('Supabase client is not configured'));
      return;
    }

    const fetchBills = async () => {
      try {
        const { data, error } = await supabase
          .from('contas_fixas')
          .select('*')
          .eq('user_id', user.id)
          .order('ano', { ascending: false })
          .order('mes', { ascending: false });

        if (error) {
          console.error('Error fetching fixed bills:', error);
          setError(error);
        } else {
          setBills((data ?? []).map(mapFixedBillFromDb));
          setError(null);
        }
      } catch (err) {
        console.error('Unexpected error fetching fixed bills:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
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
            setBills((prev) => [...prev, mapFixedBillFromDb(payload.new)]);
          } else if (payload.eventType === 'UPDATE') {
            setBills((prev) =>
              prev.map((b) => (b.id === payload.new.id ? mapFixedBillFromDb(payload.new) : b))
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

  return { bills, loading, error };
}

export async function addFixedBill(bill: Omit<FixedBill, 'id' | 'user_id'>) {
  if (!supabase) throw new Error('Supabase client is not configured');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('contas_fixas')
    .insert({ ...mapFixedBillToDb(bill), user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return mapFixedBillFromDb(data);
}

export async function updateFixedBill(id: string, patch: Partial<Omit<FixedBill, 'id' | 'user_id'>>) {
  if (!supabase) throw new Error('Supabase client is not configured');

  const { data, error } = await supabase
    .from('contas_fixas')
    .update(mapFixedBillToDb(patch))
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return mapFixedBillFromDb(data);
}

export async function deleteFixedBill(id: string) {
  if (!supabase) throw new Error('Supabase client is not configured');

  const { error } = await supabase.from('contas_fixas').delete().eq('id', id);
  if (error) throw error;
}

export async function markFixedBillPaid(id: string, paid: boolean) {
  if (!supabase) throw new Error('Supabase client is not configured');

  const { error } = await supabase
    .from('contas_fixas')
    .update({
      status_pago: paid,
      pago_em: paid ? new Date().toISOString() : null,
    })
    .eq('id', id);

  if (error) throw error;
}
