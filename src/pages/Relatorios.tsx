import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, Activity, BarChart3, Download, ExternalLink,
  FileText, Loader2, PieChart, ShieldAlert, Star, TrendingUp,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import {
  AlignmentType, BorderStyle, Document, HeadingLevel, Packer,
  Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from "docx";
import jsPDF from "jspdf";

// ── helpers ───────────────────────────────────────────────────────────────────

function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map(r => headers.map(h => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const fmt = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("pt-BR") : "—";

const now = new Date();
const MES = now.getMonth() + 1;
const ANO = now.getFullYear();

// ── card visual helpers ───────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px",
  padding: "22px 24px", display: "flex", flexDirection: "column", gap: "12px",
  boxShadow: "0 1px 4px rgba(0,0,0,.04)",
};

const iconBox = (bg: string, color: string): React.CSSProperties => ({
  width: "40px", height: "40px", borderRadius: "10px", background: bg,
  display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0,
});

const tag = (label: string, bg: string, color: string) => (
  <span style={{ fontSize: "10px", fontWeight: 700, background: bg, color, borderRadius: "20px", padding: "2px 8px", letterSpacing: ".04em" }}>{label}</span>
);

const sectionTitle: React.CSSProperties = {
  fontSize: "11px", fontWeight: 700, color: "#6b7280",
  textTransform: "uppercase", letterSpacing: ".08em", marginBottom: "12px",
};

const exportBtn = (disabled: boolean, onClick: () => void, label: string, loading: boolean): React.ReactNode => (
  <button onClick={onClick} disabled={disabled}
    style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: disabled ? "#f3f4f6" : "#1d4ed8", color: disabled ? "#9ca3af" : "#fff", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "12px", fontWeight: 600, cursor: disabled ? "default" : "pointer", marginTop: "auto", transition: "background .15s" }}
    onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = "#1e40af"; }}
    onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = "#1d4ed8"; }}>
    {loading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
    {label}
  </button>
);

// ── component ─────────────────────────────────────────────────────────────────

interface ClienteOpt { id: string; razao_social: string; }

export default function Relatorios() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [diasFiltro, setDiasFiltro] = useState(30);
  const [cartaClienteId, setCartaClienteId] = useState("");
  const [cartaAno, setCartaAno] = useState(ANO);
  const [relClienteId, setRelClienteId] = useState("");
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const setLoad = (k: string, v: boolean) => setLoading(p => ({ ...p, [k]: v }));

  const loadClientes = useCallback(async () => {
    const { data } = await supabase.from("clientes").select("id, razao_social").order("razao_social");
    setClientes((data ?? []) as ClienteOpt[]);
  }, []);

  useEffect(() => { loadClientes(); }, [loadClientes]);

  // ── Exports ──────────────────────────────────────────────────────────────────

  const exportRadarAbandono = async () => {
    setLoad("abandono", true);
    try {
      const { data, error } = await supabase
        .from("radar_consultivo").select("razao_social, nome_fantasia, dias_sem_orientacao, semaforo, ultima_orientacao_consultiva, total_orientacoes")
        .gte("dias_sem_orientacao", diasFiltro)
        .order("dias_sem_orientacao", { ascending: false });
      if (error) throw error;
      if (!data?.length) { toast({ title: "Nenhum cliente encontrado para o filtro selecionado." }); return; }
      downloadCSV(data.map(r => ({
        "Razão Social": r.razao_social ?? "",
        "Nome Fantasia": r.nome_fantasia ?? "",
        "Dias sem Orientação": r.dias_sem_orientacao,
        "Status": r.semaforo,
        "Última Orientação": fmt(r.ultima_orientacao_consultiva),
        "Total Orientações": r.total_orientacoes ?? 0,
      })), `radar_abandono_${diasFiltro}d_${ANO}-${String(MES).padStart(2,"0")}.csv`);
      toast({ title: `Radar de Abandono exportado (${data.length} clientes)` });
    } catch (e: any) {
      toast({ title: "Erro ao exportar", description: e.message, variant: "destructive" });
    } finally { setLoad("abandono", false); }
  };

  const exportCarteiraRisco = async () => {
    setLoad("risco", true);
    try {
      const { data, error } = await supabase
        .from("radar_consultivo").select("razao_social, nome_fantasia, dias_sem_orientacao, semaforo, total_orientacoes, followups_pendentes")
        .eq("semaforo", "critico")
        .order("dias_sem_orientacao", { ascending: false });
      if (error) throw error;
      if (!data?.length) { toast({ title: "Nenhum cliente crítico no momento." }); return; }
      downloadCSV(data.map(r => ({
        "Razão Social": r.razao_social ?? "",
        "Nome Fantasia": r.nome_fantasia ?? "",
        "Dias sem Orientação": r.dias_sem_orientacao,
        "Status": r.semaforo,
        "Total Orientações": r.total_orientacoes ?? 0,
        "Ações Abertas": r.followups_pendentes ?? 0,
      })), `carteira_risco_${ANO}-${String(MES).padStart(2,"0")}.csv`);
      toast({ title: `Carteira em Risco exportada (${data.length} clientes)` });
    } catch (e: any) {
      toast({ title: "Erro ao exportar", description: e.message, variant: "destructive" });
    } finally { setLoad("risco", false); }
  };

  const exportDistribuicao = async () => {
    setLoad("dist", true);
    try {
      const { data, error } = await supabase.from("clientes").select("regime_tributario, segmento, porte");
      if (error) throw error;
      const total = (data ?? []).length;

      const byRegime: Record<string, number> = {};
      const bySegmento: Record<string, number> = {};
      const byPorte: Record<string, number> = {};
      for (const c of (data ?? [])) {
        const r = c.regime_tributario ?? "Não informado";
        const s = c.segmento ?? "Não informado";
        const p = (c as any).porte ?? "Não informado";
        byRegime[r] = (byRegime[r] ?? 0) + 1;
        bySegmento[s] = (bySegmento[s] ?? 0) + 1;
        byPorte[p] = (byPorte[p] ?? 0) + 1;
      }

      const rows = [
        { Dimensão: "--- REGIME TRIBUTÁRIO ---", Valor: "", Quantidade: "", "% do Total": "" },
        ...Object.entries(byRegime).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({
          Dimensão: "Regime Tributário", Valor: k, Quantidade: v, "% do Total": `${((v / total) * 100).toFixed(1)}%`,
        })),
        { Dimensão: "--- SEGMENTO ---", Valor: "", Quantidade: "", "% do Total": "" },
        ...Object.entries(bySegmento).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({
          Dimensão: "Segmento", Valor: k, Quantidade: v, "% do Total": `${((v / total) * 100).toFixed(1)}%`,
        })),
        { Dimensão: "--- PORTE ---", Valor: "", Quantidade: "", "% do Total": "" },
        ...Object.entries(byPorte).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({
          Dimensão: "Porte", Valor: k, Quantidade: v, "% do Total": `${((v / total) * 100).toFixed(1)}%`,
        })),
      ];
      downloadCSV(rows, `distribuicao_carteira_${ANO}.csv`);
      toast({ title: `Distribuição exportada (${total} clientes)` });
    } catch (e: any) {
      toast({ title: "Erro ao exportar", description: e.message, variant: "destructive" });
    } finally { setLoad("dist", false); }
  };

  const exportProdutividade = async () => {
    setLoad("prod", true);
    try {
      const { data: metasData, error } = await supabase
        .from("metas").select("*, usuarios(nome)").eq("mes", MES).eq("ano", ANO);
      if (error) throw error;
      const rows = await Promise.all((metasData ?? []).map(async (m: any) => {
        const { data: realizado } = await supabase.rpc("get_orientacoes_mes", {
          p_usuario_id: m.usuario_id, p_mes: MES, p_ano: ANO,
        });
        const pct = m.meta > 0 ? Math.round(((realizado ?? 0) / m.meta) * 100) : 0;
        return {
          "Consultor": m.usuarios?.nome ?? "—",
          "Mês/Ano": `${String(MES).padStart(2,"0")}/${ANO}`,
          "Meta": m.meta,
          "Realizado": realizado ?? 0,
          "% Atingido": `${pct}%`,
          "Status": pct >= 100 ? "Meta atingida" : pct >= 50 ? "Em andamento" : "Abaixo da meta",
        };
      }));
      if (!rows.length) { toast({ title: "Nenhuma meta configurada para o mês atual." }); return; }
      downloadCSV(rows, `produtividade_${ANO}-${String(MES).padStart(2,"0")}.csv`);
      toast({ title: `Produtividade exportada (${rows.length} consultores)` });
    } catch (e: any) {
      toast({ title: "Erro ao exportar", description: e.message, variant: "destructive" });
    } finally { setLoad("prod", false); }
  };

  const exportHistoricoContatos = async () => {
    setLoad("hist", true);
    try {
      const { data, error } = await supabase.from("interacoes").select("canal, cliente_id");
      if (error) throw error;
      const total = (data ?? []).length;
      const byCanal: Record<string, { total: number; clientes: Set<string> }> = {};
      for (const i of (data ?? [])) {
        const c = i.canal ?? "Não informado";
        if (!byCanal[c]) byCanal[c] = { total: 0, clientes: new Set() };
        byCanal[c].total++;
        byCanal[c].clientes.add(String(i.cliente_id));
      }
      const rows = Object.entries(byCanal)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([canal, v]) => ({
          Canal: canal,
          "Total de Contatos": v.total,
          "% do Total": total > 0 ? `${((v.total / total) * 100).toFixed(1)}%` : "0%",
          "Clientes Distintos": v.clientes.size,
          "Média por Cliente": v.clientes.size > 0 ? (v.total / v.clientes.size).toFixed(1) : "0",
        }));
      if (!rows.length) { toast({ title: "Nenhum contato registrado." }); return; }
      downloadCSV(rows, `historico_contatos_${ANO}.csv`);
      toast({ title: `Histórico de contatos exportado (${rows.length} canais)` });
    } catch (e: any) {
      toast({ title: "Erro ao exportar", description: e.message, variant: "destructive" });
    } finally { setLoad("hist", false); }
  };

  const exportCartaValorWord = async () => {
    if (!cartaClienteId) { toast({ title: "Selecione um cliente", variant: "destructive" }); return; }
    setLoad("carta-word", true);
    try {
      const cli = clientes.find(c => c.id === cartaClienteId);
      const nomeCliente = cli?.razao_social ?? "Cliente";

      const [{ data: interacoes }, { data: acoes }] = await Promise.all([
        supabase.from("interacoes").select("*")
          .eq("cliente_id", cartaClienteId)
          .gte("data_interacao", `${cartaAno}-01-01`)
          .lte("data_interacao", `${cartaAno}-12-31`)
          .order("data_interacao"),
        supabase.from("acoes_consultivas").select("*").eq("cliente_id", cartaClienteId),
      ]);

      const total = (interacoes ?? []).length;
      const concluidas = (acoes ?? []).filter(a => a.status === "concluida").length;
      const abertas = (acoes ?? []).filter(a => a.status === "aberta" || a.status === "em_andamento").length;

      const byTipo: Record<string, number> = {};
      const byMes: Record<number, number> = {};
      for (const i of (interacoes ?? [])) {
        const t = (i as any).tipo ?? "outros";
        byTipo[t] = (byTipo[t] ?? 0) + 1;
        const m = new Date((i as any).data_interacao ?? "").getMonth() + 1;
        if (!isNaN(m)) byMes[m] = (byMes[m] ?? 0) + 1;
      }
      const tipoTop = Object.entries(byTipo).sort((a, b) => b[1] - a[1])[0];

      const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

      const sep = new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "D4AF37", space: 4 } },
        spacing: { after: 200 },
      });

      const h2 = (text: string) => new Paragraph({
        text, heading: HeadingLevel.HEADING_2,
        spacing: { before: 320, after: 120 },
        shading: { type: ShadingType.SOLID, color: "EFF6FF", fill: "EFF6FF" },
      });

      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({
              children: [new TextRun({ text: "FREITAS CONSULTORIA CONTÁBIL E FINANCEIRA", bold: true, size: 32, color: "0F172A", allCaps: true })],
              alignment: AlignmentType.CENTER, spacing: { after: 80 },
            }),
            new Paragraph({
              children: [new TextRun({ text: `Carta de Valor — Ano ${cartaAno}`, size: 26, color: "1D4ED8", bold: true })],
              alignment: AlignmentType.CENTER, spacing: { after: 80 },
            }),
            new Paragraph({
              children: [new TextRun({ text: `Emissão: ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}`, size: 20, color: "9CA3AF" })],
              alignment: AlignmentType.CENTER, spacing: { after: 320 },
            }),
            sep,
            new Paragraph({
              children: [new TextRun({ text: nomeCliente, bold: true, size: 40, color: "0F172A" })],
              spacing: { after: 80 },
            }),
            new Paragraph({
              children: [new TextRun({ text: `Período: 01/01/${cartaAno} a 31/12/${cartaAno}`, size: 22, color: "D97706" })],
              spacing: { after: 320 },
            }),
            sep,
            h2("Mensagem ao Cliente"),
            new Paragraph({
              children: [new TextRun({
                text: `Prezado(a) cliente,\n\nÉ com satisfação que apresentamos a Carta de Valor referente ao ano de ${cartaAno}. Este documento consolida o trabalho realizado pela Freitas Consultoria Contábil e Financeira em parceria com ${nomeCliente}, destacando as orientações prestadas, os resultados alcançados e as ações desenvolvidas ao longo do período.\n\nNosso compromisso é com a entrega de valor real, a transparência no relacionamento e a excelência no serviço. Agradecemos a confiança depositada em nossa equipe.`,
                size: 22, color: "374151",
              })],
              spacing: { after: 200 },
            }),
            sep,
            h2(`Resumo do Ano ${cartaAno}`),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                ["Total de orientações realizadas", String(total)],
                ["Tipo mais frequente", tipoTop ? `${tipoTop[0]} (${tipoTop[1]}x)` : "—"],
                ["Ações consultivas concluídas", String(concluidas)],
                ["Ações em aberto", String(abertas)],
              ].map(([k, v]) => new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: k, bold: true, size: 20, color: "6B7280" })] })],
                    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 2, color: "E5E7EB" }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                    margins: { top: 80, bottom: 80, left: 80, right: 80 },
                    width: { size: 60, type: WidthType.PERCENTAGE },
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: v, bold: true, size: 24, color: "1D4ED8" })] })],
                    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 2, color: "E5E7EB" }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                    margins: { top: 80, bottom: 80, left: 80, right: 80 },
                  }),
                ],
              })),
            }),
            sep,
            h2("Distribuição Mensal de Orientações"),
            ...meses.map((mes, idx) => {
              const qt = byMes[idx + 1] ?? 0;
              return new Paragraph({
                children: [
                  new TextRun({ text: `${mes}: `, bold: true, size: 20, color: "374151" }),
                  new TextRun({ text: `${qt} orientação${qt !== 1 ? "ões" : ""}`, size: 20, color: qt > 0 ? "1D4ED8" : "9CA3AF" }),
                ],
                spacing: { after: 60 },
              });
            }),
            sep,
            h2("Conclusão"),
            new Paragraph({
              children: [new TextRun({
                text: `Ao longo de ${cartaAno}, trabalhamos com dedicação para apoiar ${nomeCliente} em suas decisões contábeis, fiscais e empresariais. Com ${total} orientações registradas, reafirmamos nosso compromisso com a transparência, a proatividade e a geração de valor para o seu negócio.\n\nEstamos à disposição para o próximo ciclo, com ainda mais qualidade e inovação no atendimento.`,
                size: 22, color: "374151",
              })],
              spacing: { after: 200 },
            }),
            sep,
            new Paragraph({
              children: [new TextRun({ text: "Freitas Consultoria Contábil e Financeira  •  freitas.contabilista@gmail.com", size: 18, color: "9CA3AF" })],
              alignment: AlignmentType.CENTER, spacing: { before: 400 },
            }),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      downloadBlob(blob, `carta_valor_${nomeCliente.replace(/[^a-z0-9]/gi,"_").toLowerCase()}_${cartaAno}.docx`);
      toast({ title: "Carta de Valor exportada em Word!" });
    } catch (e: any) {
      toast({ title: "Erro ao gerar carta", description: e.message, variant: "destructive" });
    } finally { setLoad("carta-word", false); }
  };

  const exportCartaValorPDF = async () => {
    if (!cartaClienteId) { toast({ title: "Selecione um cliente", variant: "destructive" }); return; }
    setLoad("carta-pdf", true);
    try {
      const cli = clientes.find(c => c.id === cartaClienteId);
      const nomeCliente = cli?.razao_social ?? "Cliente";
      const { data: interacoes } = await supabase.from("interacoes").select("tipo, data_interacao")
        .eq("cliente_id", cartaClienteId)
        .gte("data_interacao", `${cartaAno}-01-01`)
        .lte("data_interacao", `${cartaAno}-12-31`);
      const { data: acoes } = await supabase.from("acoes_consultivas").select("status").eq("cliente_id", cartaClienteId);

      const total = (interacoes ?? []).length;
      const concluidas = (acoes ?? []).filter((a: any) => a.status === "concluida").length;
      const abertas = (acoes ?? []).filter((a: any) => a.status === "aberta" || a.status === "em_andamento").length;

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = 210; const M = 20;

      // Capa gradiente (simulada com retângulo)
      pdf.setFillColor(11, 22, 40);
      pdf.rect(0, 0, W, 80, "F");
      pdf.setFillColor(29, 78, 216);
      pdf.rect(0, 60, W, 20, "F");

      pdf.setTextColor(147, 197, 253);
      pdf.setFontSize(8); pdf.setFont("helvetica", "bold");
      pdf.text("FREITAS CONSULTORIA CONTÁBIL E FINANCEIRA", W / 2, 20, { align: "center" });
      pdf.setTextColor(252, 211, 77);
      pdf.setFontSize(7); pdf.setFont("helvetica", "normal");
      pdf.text(`Carta de Valor — Ano ${cartaAno}`, W / 2, 26, { align: "center" });
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(16); pdf.setFont("helvetica", "bold");
      pdf.text(nomeCliente, M, 50);
      pdf.setFontSize(8); pdf.setFont("helvetica", "normal");
      pdf.setTextColor(147, 197, 253);
      pdf.text(`Emissão: ${new Date().toLocaleDateString("pt-BR")}`, W - M, 74, { align: "right" });

      let y = 95;
      const line = () => { pdf.setDrawColor(212, 175, 55); pdf.setLineWidth(0.5); pdf.line(M, y, W - M, y); y += 6; };
      const title2 = (t: string) => {
        pdf.setFillColor(239, 246, 255); pdf.rect(M, y - 1, W - 2 * M, 7, "F");
        pdf.setTextColor(17, 24, 39); pdf.setFontSize(9); pdf.setFont("helvetica", "bold");
        pdf.text(t, M + 2, y + 4); y += 10;
      };
      const body = (t: string) => {
        pdf.setTextColor(55, 65, 81); pdf.setFontSize(8); pdf.setFont("helvetica", "normal");
        const lines = pdf.splitTextToSize(t, W - 2 * M);
        pdf.text(lines, M, y); y += lines.length * 5 + 4;
      };
      const kv = (k: string, v: string) => {
        pdf.setFont("helvetica", "bold"); pdf.setTextColor(107, 114, 128); pdf.setFontSize(8);
        pdf.text(k, M, y);
        pdf.setFont("helvetica", "bold"); pdf.setTextColor(29, 78, 216);
        pdf.text(v, W - M, y, { align: "right" }); y += 7;
      };

      line();
      title2("Resumo do Ano");
      kv("Total de orientações realizadas", String(total));
      kv("Ações consultivas concluídas", String(concluidas));
      kv("Ações em aberto", String(abertas));
      y += 4; line();

      title2("Mensagem ao Cliente");
      body(`Prezado(a) cliente,\n\nÉ com satisfação que apresentamos a Carta de Valor referente ao ano de ${cartaAno}. Este documento consolida o trabalho realizado pela Freitas Consultoria Contábil e Financeira em parceria com ${nomeCliente}, destacando as orientações prestadas e os resultados alcançados ao longo do período.\n\nNosso compromisso é com a entrega de valor real e a excelência no serviço. Agradecemos a confiança em nossa equipe.`);
      y += 4; line();

      title2("Conclusão");
      body(`Ao longo de ${cartaAno}, trabalhamos com dedicação para apoiar ${nomeCliente} com ${total} orientações registradas. Reafirmamos nosso compromisso com transparência, proatividade e geração de valor para o seu negócio.`);

      pdf.setTextColor(156, 163, 175); pdf.setFontSize(7); pdf.setFont("helvetica", "normal");
      pdf.text("Freitas Consultoria Contábil e Financeira  •  freitas.contabilista@gmail.com", W / 2, 285, { align: "center" });

      pdf.save(`carta_valor_${nomeCliente.replace(/[^a-z0-9]/gi,"_").toLowerCase()}_${cartaAno}.pdf`);
      toast({ title: "Carta de Valor exportada em PDF!" });
    } catch (e: any) {
      toast({ title: "Erro ao gerar PDF", description: e.message, variant: "destructive" });
    } finally { setLoad("carta-pdf", false); }
  };

  // ── render ────────────────────────────────────────────────────────────────────

  return (
    <main style={{ maxWidth: "1240px", margin: "0 auto", padding: "28px 28px 80px" }}>

      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "21px", fontWeight: 700, color: "#111827", margin: 0 }}>Relatórios</h1>
        <p style={{ fontSize: "13px", color: "#6b7280", margin: "4px 0 0" }}>Exportação de dados, análises de carteira e relatórios para clientes.</p>
      </div>

      {/* ── CATEGORIA: Acompanhamento da Carteira ── */}
      <div style={sectionTitle}>Acompanhamento da Carteira</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px", marginBottom: "32px" }}>

        {/* Radar de Abandono */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
            <div style={iconBox("#FEF3C7","#D97706")}><AlertTriangle size={18} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>Radar de Abandono</span>
                {tag("CSV","#FEF9C3","#A16207")}
              </div>
              <p style={{ fontSize: "12px", color: "#6b7280", margin: 0, lineHeight: 1.5 }}>
                Clientes sem nenhuma orientação registrada no período selecionado, ordenados por maior abandono.
              </p>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", marginBottom: "6px" }}>Filtrar por ausência de contato:</div>
            <div style={{ display: "flex", gap: "6px" }}>
              {[15, 30, 60].map(d => (
                <button key={d} onClick={() => setDiasFiltro(d)}
                  style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: 600, cursor: "pointer", border: "1.5px solid", borderColor: diasFiltro === d ? "#D97706" : "#E5E7EB", background: diasFiltro === d ? "#FFFBEB" : "#F9FAFB", color: diasFiltro === d ? "#D97706" : "#6B7280", transition: "all .15s" }}>
                  +{d} dias
                </button>
              ))}
            </div>
          </div>
          {exportBtn(loading.abandono, exportRadarAbandono, "Exportar CSV", !!loading.abandono)}
        </div>

        {/* Carteira em Risco */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
            <div style={iconBox("#FEE2E2","#DC2626")}><ShieldAlert size={18} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>Carteira em Risco</span>
                {tag("CSV","#FEE2E2","#DC2626")}
              </div>
              <p style={{ fontSize: "12px", color: "#6b7280", margin: 0, lineHeight: 1.5 }}>
                Clientes com semáforo crítico e ações consultivas acumuladas em aberto. Prioridade de ação imediata.
              </p>
            </div>
          </div>
          {exportBtn(loading.risco, exportCarteiraRisco, "Exportar CSV", !!loading.risco)}
        </div>

        {/* Distribuição da Carteira */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
            <div style={iconBox("#EFF6FF","#1D4ED8")}><PieChart size={18} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>Distribuição da Carteira</span>
                {tag("CSV","#DBEAFE","#1D4ED8")}
              </div>
              <p style={{ fontSize: "12px", color: "#6b7280", margin: 0, lineHeight: 1.5 }}>
                Quantidade de clientes por regime tributário, segmento e porte, com percentual do total.
              </p>
            </div>
          </div>
          {exportBtn(loading.dist, exportDistribuicao, "Exportar CSV", !!loading.dist)}
        </div>
      </div>

      {/* ── CATEGORIA: Produtividade ── */}
      <div style={sectionTitle}>Produtividade</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px", marginBottom: "32px" }}>

        {/* Produtividade por Consultor */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
            <div style={iconBox("#F0FDF4","#16A34A")}><TrendingUp size={18} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>Produtividade por Consultor</span>
                {tag("CSV","#DCFCE7","#16A34A")}
              </div>
              <p style={{ fontSize: "12px", color: "#6b7280", margin: 0, lineHeight: 1.5 }}>
                Orientações realizadas vs. meta definida no mês atual ({String(MES).padStart(2,"0")}/{ANO}), com percentual de atingimento.
              </p>
            </div>
          </div>
          {exportBtn(loading.prod, exportProdutividade, "Exportar CSV", !!loading.prod)}
        </div>

        {/* Histórico de Contatos */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
            <div style={iconBox("#F5F3FF","#7C3AED")}><Activity size={18} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>Histórico de Contatos</span>
                {tag("CSV","#EDE9FE","#7C3AED")}
              </div>
              <p style={{ fontSize: "12px", color: "#6b7280", margin: 0, lineHeight: 1.5 }}>
                Canais mais utilizados, total de contatos, clientes distintos atendidos e média de contatos por cliente.
              </p>
            </div>
          </div>
          {exportBtn(loading.hist, exportHistoricoContatos, "Exportar CSV", !!loading.hist)}
        </div>
      </div>

      {/* ── CATEGORIA: Para o Cliente ── */}
      <div style={sectionTitle}>Para o Cliente</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px", marginBottom: "32px" }}>

        {/* Relatório Consultivo Individual */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
            <div style={iconBox("#EFF6FF","#1D4ED8")}><FileText size={18} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>Relatório Consultivo Individual</span>
                {tag("PDF","#DBEAFE","#1D4ED8")}
                {tag("Word","#EDE9FE","#7C3AED")}
              </div>
              <p style={{ fontSize: "12px", color: "#6b7280", margin: 0, lineHeight: 1.5 }}>
                Relatório premium com filtros de período, tipo e canal. Acesse a página do cliente e clique em "Gerar Relatório".
              </p>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", marginBottom: "6px" }}>Ir para o cliente:</div>
            <div style={{ display: "flex", gap: "8px" }}>
              <select value={relClienteId} onChange={e => setRelClienteId(e.target.value)}
                style={{ flex: 1, fontSize: "12px", color: "#374151", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "7px", padding: "7px 10px", outline: "none" }}>
                <option value="">Selecione o cliente…</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
              </select>
            </div>
          </div>
          <button onClick={() => relClienteId && navigate(`/radar/${relClienteId}`)}
            disabled={!relClienteId}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: relClienteId ? "#1d4ed8" : "#f3f4f6", color: relClienteId ? "#fff" : "#9ca3af", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "12px", fontWeight: 600, cursor: relClienteId ? "pointer" : "default", marginTop: "auto", transition: "background .15s" }}
            onMouseEnter={e => { if (relClienteId) e.currentTarget.style.background = "#1e40af"; }}
            onMouseLeave={e => { if (relClienteId) e.currentTarget.style.background = "#1d4ed8"; }}>
            <ExternalLink size={13} /> Abrir página do cliente
          </button>
        </div>

        {/* Carta de Valor Anual */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
            <div style={iconBox("#FFFBEB","#D97706")}><Star size={18} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>Carta de Valor Anual</span>
                {tag("PDF","#FEF9C3","#A16207")}
                {tag("Word","#DCFCE7","#16A34A")}
              </div>
              <p style={{ fontSize: "12px", color: "#6b7280", margin: 0, lineHeight: 1.5 }}>
                Documento anual consolidando o histórico do cliente com mensagem personalizada, resumo de orientações e distribuição mensal.
              </p>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", marginBottom: "4px" }}>Cliente:</div>
              <select value={cartaClienteId} onChange={e => setCartaClienteId(e.target.value)}
                style={{ width: "100%", fontSize: "12px", color: "#374151", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "7px", padding: "7px 10px", outline: "none" }}>
                <option value="">Selecione o cliente…</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", marginBottom: "4px" }}>Ano:</div>
              <select value={cartaAno} onChange={e => setCartaAno(Number(e.target.value))}
                style={{ width: "100%", fontSize: "12px", color: "#374151", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "7px", padding: "7px 10px", outline: "none" }}>
                {[ANO, ANO - 1, ANO - 2].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
            <button onClick={exportCartaValorPDF} disabled={!cartaClienteId || !!loading["carta-pdf"]}
              style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", background: cartaClienteId && !loading["carta-pdf"] ? "#D97706" : "#f3f4f6", color: cartaClienteId && !loading["carta-pdf"] ? "#fff" : "#9ca3af", border: "none", borderRadius: "8px", padding: "8px 12px", fontSize: "12px", fontWeight: 600, cursor: cartaClienteId ? "pointer" : "default", transition: "background .15s" }}
              onMouseEnter={e => { if (cartaClienteId) e.currentTarget.style.background = "#B45309"; }}
              onMouseLeave={e => { if (cartaClienteId) e.currentTarget.style.background = "#D97706"; }}>
              {loading["carta-pdf"] ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} PDF
            </button>
            <button onClick={exportCartaValorWord} disabled={!cartaClienteId || !!loading["carta-word"]}
              style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", background: cartaClienteId && !loading["carta-word"] ? "#16A34A" : "#f3f4f6", color: cartaClienteId && !loading["carta-word"] ? "#fff" : "#9ca3af", border: "none", borderRadius: "8px", padding: "8px 12px", fontSize: "12px", fontWeight: 600, cursor: cartaClienteId ? "pointer" : "default", transition: "background .15s" }}
              onMouseEnter={e => { if (cartaClienteId) e.currentTarget.style.background = "#15803D"; }}
              onMouseLeave={e => { if (cartaClienteId) e.currentTarget.style.background = "#16A34A"; }}>
              {loading["carta-word"] ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />} Word
            </button>
          </div>
        </div>

      </div>
    </main>
  );
}
