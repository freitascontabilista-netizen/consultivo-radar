import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://menfidltdpxbyovuqayr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_iFSJUzgU-dWj7FQjDiEf1w_yjHJSrCI";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export type SemaforoStatus = "verde" | "atencao" | "critico";

export interface RadarConsultivoRow {
  id?: string | number;
  cliente_id?: string | number;
  razao_social: string | null;
  nome_fantasia: string | null;
  segmento: string | null;
  regime_tributario?: string | null;
  semaforo: SemaforoStatus;
  dias_sem_orientacao: number;
  ultima_orientacao?: string | null;
  total_orientacoes?: number | null;
  followups_pendentes?: number | null;
  [key: string]: unknown;
}

export type InteracaoTipo = "consultiva" | "suporte" | "relacionamento" | "comercial";

export interface InteracaoRow {
  id: string | number;
  cliente_id: string | number;
  tipo: InteracaoTipo | string;
  canal?: string | null;
  assunto: string | null;
  resumo: string | null;
  proximo_passo?: string | null;
  data?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

export type AcaoStatus = "aberta" | "em_andamento" | "concluida" | "cancelada";
export type AcaoUrgencia = "baixa" | "media" | "alta" | "critica";

export interface AcaoConsultivaRow {
  id: string | number;
  cliente_id: string | number;
  tema: string | null;
  problema_identificado: string | null;
  acao_recomendada: string | null;
  urgencia: AcaoUrgencia | string | null;
  status: AcaoStatus | string;
  data_retorno_prevista?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}
