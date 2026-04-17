import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://menfidltdpxbyovuqayr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_iFSJUzgU-dWj7FQjDiEf1w_yjHJSrCI";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export type SemaforoStatus = "verde" | "atencao" | "critico";

export interface RadarConsultivoRow {
  cliente_id: string | number;
  razao_social: string | null;
  nome_fantasia: string | null;
  segmento: string | null;
  semaforo: SemaforoStatus;
  dias_sem_orientacao: number;
  [key: string]: unknown;
}
