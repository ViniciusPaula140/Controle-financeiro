-- ============================================
-- DATABASE SCHEMA FOR FINANCE APP
-- Copie este script no SQL Editor do Supabase
-- ============================================

-- Tabela de perfis de usuário (extensão do auth.users)
CREATE TABLE IF NOT EXISTS public.perfis_usuario (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  celular TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de transações
CREATE TABLE IF NOT EXISTS public.transacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa')),
  categoria TEXT NOT NULL,
  conta_bancaria TEXT NOT NULL,
  valor NUMERIC NOT NULL CHECK (valor > 0),
  data TIMESTAMP WITH TIME ZONE NOT NULL,
  observacao TEXT,
  recorrente BOOLEAN DEFAULT FALSE,
  conta_fixa_id UUID REFERENCES public.contas_fixas(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de orçamentos
CREATE TABLE IF NOT EXISTS public.orcamentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nomenclatura TEXT,
  categoria TEXT NOT NULL,
  limite_mensal NUMERIC NOT NULL CHECK (limite_mensal > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de contas fixas
CREATE TABLE IF NOT EXISTS public.contas_fixas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item TEXT NOT NULL,
  valor NUMERIC NOT NULL CHECK (valor >= 0),
  vencimento INTEGER NOT NULL CHECK (vencimento >= 1 AND vencimento <= 31),
  status_pago BOOLEAN DEFAULT FALSE NOT NULL,
  mes INTEGER NOT NULL CHECK (mes >= 0 AND mes <= 11),
  ano INTEGER NOT NULL,
  separado TEXT DEFAULT 'pendente' CHECK (separado IN ('ok', 'pendente')),
  conta_bancaria TEXT,
  pago_em TIMESTAMP WITH TIME ZONE,
  transacao_id UUID REFERENCES public.transacoes(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de dinheiro a receber
CREATE TABLE IF NOT EXISTS public.dinheiro_receber (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  valor NUMERIC NOT NULL CHECK (valor > 0),
  recebido BOOLEAN DEFAULT FALSE NOT NULL,
  mes INTEGER NOT NULL CHECK (mes >= 0 AND mes <= 11),
  ano INTEGER NOT NULL,
  data_recebimento TIMESTAMP WITH TIME ZONE,
  transacao_id UUID REFERENCES public.transacoes(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de metas
CREATE TABLE IF NOT EXISTS public.metas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  descricao TEXT,
  valor_alvo NUMERIC NOT NULL CHECK (valor_alvo > 0),
  mes INTEGER NOT NULL CHECK (mes >= 0 AND mes <= 11),
  ano INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de contas bancárias/saldos
CREATE TABLE IF NOT EXISTS public.contas_bancarias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  conta TEXT NOT NULL,
  saldo NUMERIC NOT NULL,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.perfis_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_fixas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dinheiro_receber ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_bancarias ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para perfis_usuario
CREATE POLICY "Usuários podem ver seu próprio perfil"
  ON public.perfis_usuario FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seu próprio perfil"
  ON public.perfis_usuario FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seu próprio perfil"
  ON public.perfis_usuario FOR UPDATE
  USING (auth.uid() = user_id);

-- Políticas RLS para transacoes
CREATE POLICY "Usuários podem ver suas próprias transações"
  ON public.transacoes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir suas próprias transações"
  ON public.transacoes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias transações"
  ON public.transacoes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem excluir suas próprias transações"
  ON public.transacoes FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas RLS para orcamentos
CREATE POLICY "Usuários podem ver seus próprios orçamentos"
  ON public.orcamentos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seus próprios orçamentos"
  ON public.orcamentos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios orçamentos"
  ON public.orcamentos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem excluir seus próprios orçamentos"
  ON public.orcamentos FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas RLS para contas_fixas
CREATE POLICY "Usuários podem ver suas próprias contas fixas"
  ON public.contas_fixas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir suas próprias contas fixas"
  ON public.contas_fixas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias contas fixas"
  ON public.contas_fixas FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem excluir suas próprias contas fixas"
  ON public.contas_fixas FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas RLS para dinheiro_receber
CREATE POLICY "Usuários podem ver seu próprio dinheiro a receber"
  ON public.dinheiro_receber FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seu próprio dinheiro a receber"
  ON public.dinheiro_receber FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seu próprio dinheiro a receber"
  ON public.dinheiro_receber FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem excluir seu próprio dinheiro a receber"
  ON public.dinheiro_receber FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas RLS para metas
CREATE POLICY "Usuários podem ver suas próprias metas"
  ON public.metas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir suas próprias metas"
  ON public.metas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias metas"
  ON public.metas FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem excluir suas próprias metas"
  ON public.metas FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas RLS para contas_bancarias
CREATE POLICY "Usuários podem ver suas próprias contas bancárias"
  ON public.contas_bancarias FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir suas próprias contas bancárias"
  ON public.contas_bancarias FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias contas bancárias"
  ON public.contas_bancarias FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem excluir suas próprias contas bancárias"
  ON public.contas_bancarias FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- ÍNDICES PARA MELHORAR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_transacoes_user_id ON public.transacoes(user_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_data ON public.transacoes(data DESC);
CREATE INDEX IF NOT EXISTS idx_transacoes_user_data ON public.transacoes(user_id, data DESC);

CREATE INDEX IF NOT EXISTS idx_orcamentos_user_id ON public.orcamentos(user_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_categoria ON public.orcamentos(user_id, categoria);

CREATE INDEX IF NOT EXISTS idx_contas_fixas_user_id ON public.contas_fixas(user_id);
CREATE INDEX IF NOT EXISTS idx_contas_fixas_mes_ano ON public.contas_fixas(user_id, mes, ano);
CREATE INDEX IF NOT EXISTS idx_contas_fixas_transacao_id ON public.contas_fixas(transacao_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_conta_fixa_id ON public.transacoes(conta_fixa_id);

CREATE INDEX IF NOT EXISTS idx_dinheiro_receber_user_id ON public.dinheiro_receber(user_id);
CREATE INDEX IF NOT EXISTS idx_dinheiro_receber_mes_ano ON public.dinheiro_receber(user_id, mes, ano);

CREATE INDEX IF NOT EXISTS idx_metas_user_id ON public.metas(user_id);
CREATE INDEX IF NOT EXISTS idx_metas_mes_ano ON public.metas(user_id, mes, ano);

CREATE INDEX IF NOT EXISTS idx_contas_bancarias_user_id ON public.contas_bancarias(user_id);

-- ============================================
-- TRIGGER PARA ATUALIZAR updated_at AUTOMATICAMENTE
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_updated_at_perfis_usuario
  BEFORE UPDATE ON public.perfis_usuario
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_transacoes
  BEFORE UPDATE ON public.transacoes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_orcamentos
  BEFORE UPDATE ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_contas_fixas
  BEFORE UPDATE ON public.contas_fixas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_dinheiro_receber
  BEFORE UPDATE ON public.dinheiro_receber
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_metas
  BEFORE UPDATE ON public.metas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_contas_bancarias
  BEFORE UPDATE ON public.contas_bancarias
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- TRIGGER PARA CRIAR PERFIL AUTOMATICAMENTE
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfis_usuario (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
