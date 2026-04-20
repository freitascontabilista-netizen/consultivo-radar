// src/lib/admin.ts
// Funções exclusivas do painel de Administração
// Importa o client já configurado do supabase.ts existente

import { supabase } from './supabase'

// ─────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────

export type Role = 'admin' | 'colaborador'

export interface Usuario {
  id: string
  nome: string
  email: string
  role: Role
  ativo: boolean
  created_at: string
  auth_id?: string
}

export interface ActivityLog {
  id: string
  usuario_id: string | null
  usuario_nome: string
  acao: string
  entidade?: string
  entidade_id?: string
  created_at: string
}

export interface Meta {
  id: string
  usuario_id: string
  mes: number
  ano: number
  meta: number
  realizado?: number
}

// ─────────────────────────────────────────
// USUÁRIOS
// ─────────────────────────────────────────

export async function getUsuarios(): Promise<Usuario[]> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .order('nome')
  if (error) throw error
  return data ?? []
}

export async function criarUsuario(payload: {
  nome: string
  email: string
  role: Role
}): Promise<void> {
  const { error } = await supabase
    .from('usuarios')
    .insert({
      nome:  payload.nome,
      email: payload.email,
      role:  payload.role,
      ativo: true,
    })
  if (error) throw error
  await registrarLog(`Novo usuário criado: ${payload.nome}`, 'usuario')
}

export async function atualizarUsuario(
  id: string,
  payload: Partial<Pick<Usuario, 'nome' | 'email' | 'role' | 'ativo'>>
): Promise<void> {
  const { error } = await supabase
    .from('usuarios')
    .update(payload)
    .eq('id', id)
  if (error) throw error
  await registrarLog(`Usuário atualizado: ${payload.nome ?? id}`, 'usuario', id)
}

export async function toggleUsuario(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase
    .from('usuarios')
    .update({ ativo })
    .eq('id', id)
  if (error) throw error
  await registrarLog(`Usuário ${ativo ? 'ativado' : 'desativado'}`, 'usuario', id)
}

// ─────────────────────────────────────────
// LOG DE ATIVIDADES
// ─────────────────────────────────────────

export async function registrarLog(
  acao: string,
  entidade?: string,
  entidade_id?: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()

  let usuario_nome = 'Sistema'
  let usuario_id: string | null = null

  if (user) {
    const { data } = await supabase
      .from('usuarios')
      .select('id, nome')
      .eq('auth_id', user.id)
      .single()
    if (data) {
      usuario_nome = data.nome
      usuario_id   = data.id
    }
  }

  await supabase.from('activity_logs').insert({
    usuario_id,
    usuario_nome,
    acao,
    entidade,
    entidade_id,
  })
}

export async function getLogs(filtros?: {
  usuario_id?: string
  dias?: number
}): Promise<ActivityLog[]> {
  let query = supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (filtros?.usuario_id) {
    query = query.eq('usuario_id', filtros.usuario_id)
  }
  if (filtros?.dias) {
    const desde = new Date()
    desde.setDate(desde.getDate() - filtros.dias)
    query = query.gte('created_at', desde.toISOString())
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

// ─────────────────────────────────────────
// METAS
// ─────────────────────────────────────────

export async function getMetas(mes: number, ano: number): Promise<Meta[]> {
  const { data, error } = await supabase
    .from('metas')
    .select('*')
    .eq('mes', mes)
    .eq('ano', ano)
  if (error) throw error

  const metas = await Promise.all(
    (data ?? []).map(async (m) => {
      const { data: realizado } = await supabase.rpc('get_orientacoes_mes', {
        p_usuario_id: m.usuario_id,
        p_mes: mes,
        p_ano: ano,
      })
      return { ...m, realizado: realizado ?? 0 }
    })
  )
  return metas
}

export async function salvarMeta(payload: {
  usuario_id: string
  mes: number
  ano: number
  meta: number
}): Promise<void> {
  const { error } = await supabase
    .from('metas')
    .upsert(payload, { onConflict: 'usuario_id,mes,ano' })
  if (error) throw error
}

// ─────────────────────────────────────────
// RELATÓRIOS — exportação CSV
// ─────────────────────────────────────────

export async function exportarClientesCSV(): Promise<string> {
  const { data, error } = await supabase
    .from('clientes')
    .select('razao_social, nome_fantasia, cnpj, segmento, regime_tributario')
    .order('razao_social')
  if (error) throw error

  const header = 'Razão Social,Nome Fantasia,CNPJ,Segmento,Regime Tributário'
  const rows = (data ?? []).map((c: any) =>
    `"${c.razao_social}","${c.nome_fantasia}","${c.cnpj}","${c.segmento}","${c.regime_tributario}"`
  )
  return [header, ...rows].join('\n')
}

export async function exportarOrientacoesCSV(mes: number, ano: number): Promise<string> {
  const { data, error } = await supabase
    .from('acoes_consultivas')
    .select(`
      criado_em,
      tema,
      problema_identificado,
      acao_recomendada,
      impacto_esperado,
      urgencia,
      status,
      clientes(razao_social),
      usuarios!responsavel_id(nome)
    `)
    .gte('criado_em', new Date(ano, mes - 1, 1).toISOString())
    .lt('criado_em',  new Date(ano, mes, 1).toISOString())
    .order('criado_em', { ascending: false })
  if (error) throw error

  const header = 'Data,Cliente,Responsável,Tema,Problema,Ação Recomendada,Urgência,Status'
  const rows = (data ?? []).map((o: any) =>
    [
      new Date(o.criado_em).toLocaleDateString('pt-BR'),
      o.clientes?.razao_social ?? '',
      o.usuarios?.nome ?? '',
      o.tema ?? '',
      o.problema_identificado ?? '',
      o.acao_recomendada ?? '',
      o.urgencia ?? '',
      o.status ?? '',
    ].map(v => `"${v}"`).join(',')
  )
  return [header, ...rows].join('\n')
}

export function downloadCSV(conteudo: string, nomeArquivo: string): void {
  const blob = new Blob(['\uFEFF' + conteudo], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href     = url
  link.download = nomeArquivo
  link.click()
  URL.revokeObjectURL(url)
}
