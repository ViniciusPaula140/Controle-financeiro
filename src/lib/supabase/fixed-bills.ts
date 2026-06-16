import { supabase } from './supabaseClient';
import { useAuth } from './auth-context';
import { useEffect, useState } from 'react';
import { mapFixedBillFromDb, mapFixedBillToDb } from './mappers';
import { realtimeChannelName, requireRow } from './realtime-utils';
import {
  buildFixedBillTransaction,
  fixedBillPaymentMethod,
} from './fixed-bill-sync';
import {
  addTransaction,
  deleteTransactionRaw,
  updateTransactionRaw,
} from './transactions';

type FixedBillPatch = Partial<Omit<FixedBill, 'id' | 'user_id'>> & {
  txId?: string | null;
  paidAt?: string | null;
};

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
  txId?: string;
  user_id: string;
}

export const FIXED_BILL_ZERO_AMOUNT_MSG =
  'Informe um valor maior que zero antes de marcar como pago.';

async function fetchFixedBill(id: string): Promise<FixedBill | null> {
  if (!supabase) throw new Error('Supabase client is not configured');

  const { data, error } = await supabase.from('contas_fixas').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapFixedBillFromDb(data) : null;
}

async function syncLinkedTransaction(bill: FixedBill) {
  if (!bill.txId) return;

  await updateTransactionRaw(bill.txId, {
    amount: bill.amount,
    account: fixedBillPaymentMethod(bill),
    description: bill.item,
    category: 'Conta fixa',
  });
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

    const channelName = realtimeChannelName('contas_fixas', user.id);
    const channel = supabase
      .channel(channelName)
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
            const mapped = mapFixedBillFromDb(payload.new);
            setBills((prev) =>
              prev.some((b) => b.id === mapped.id) ? prev : [...prev, mapped],
            );
          } else if (payload.eventType === 'UPDATE') {
            setBills((prev) =>
              prev.map((b) => (b.id === payload.new.id ? mapFixedBillFromDb(payload.new) : b)),
            );
          } else if (payload.eventType === 'DELETE') {
            setBills((prev) => prev.filter((b) => b.id !== payload.old.id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return { bills, loading, error };
}

export async function addFixedBill(bill: Omit<FixedBill, 'id' | 'user_id' | 'txId'>) {
  if (!supabase) throw new Error('Supabase client is not configured');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const dbRow = {
    ...mapFixedBillToDb(bill),
    user_id: user.id,
    valor: bill.amount ?? 0,
    ano: bill.year,
    mes: bill.month,
    item: bill.item,
    vencimento: bill.dueDay ?? 5,
    separado: bill.separated ?? 'pendente',
    status_pago: bill.paid ?? false,
    conta_bancaria: bill.account ?? null,
  };

  const { data, error } = await supabase.from('contas_fixas').insert(dbRow).select().maybeSingle();

  if (error) throw error;
  return mapFixedBillFromDb(requireRow(data, 'inserção de conta fixa'));
}

export async function updateFixedBill(id: string, patch: FixedBillPatch) {
  if (!supabase) throw new Error('Supabase client is not configured');

  const { data, error } = await supabase
    .from('contas_fixas')
    .update(mapFixedBillToDb(patch))
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) throw error;
  const updated = mapFixedBillFromDb(requireRow(data, 'atualização de conta fixa'));

  if (updated.paid && updated.txId) {
    await syncLinkedTransaction(updated);
  }

  return updated;
}

export async function deleteFixedBill(id: string) {
  if (!supabase) throw new Error('Supabase client is not configured');

  const bill = await fetchFixedBill(id);
  if (bill?.txId) {
    await deleteTransactionRaw(bill.txId);
  }

  const { error } = await supabase.from('contas_fixas').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteFixedBills(ids: string[]) {
  for (const id of ids) {
    await deleteFixedBill(id);
  }
}

export async function markFixedBillPaid(bill: FixedBill, paid: boolean) {
  if (!paid) {
    if (bill.txId) {
      await deleteTransactionRaw(bill.txId);
    }
    return updateFixedBill(bill.id, {
      paid: false,
      paidAt: null,
      txId: null,
    });
  }

  if (bill.amount <= 0) {
    throw new Error(FIXED_BILL_ZERO_AMOUNT_MSG);
  }

  if (bill.paid && bill.txId) {
    await syncLinkedTransaction(bill);
    return bill;
  }

  const paidAt = new Date().toISOString();
  const tx = await addTransaction({
    ...buildFixedBillTransaction(bill, paidAt),
    fixedBillId: bill.id,
  });

  return updateFixedBill(bill.id, {
    paid: true,
    paidAt,
    txId: tx.id,
  });
}
