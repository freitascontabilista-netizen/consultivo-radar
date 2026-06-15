import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity, AlertTriangle, Download, ExternalLink,
  FileText, Loader2, PieChart, ShieldAlert, Star, TrendingUp,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import {
  AlignmentType, BorderStyle, Document, Packer, Paragraph,
  ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from "docx";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// ── constants ─────────────────────────────────────────────────────────────────

const MES  = new Date().getMonth() + 1;
const ANO  = new Date().getFullYear();
const EMIT = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
const EMIT_SHORT = new Date().toLocaleDateString("pt-BR");
const MES_NOME = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"][MES - 1];

// ── helpers ───────────────────────────────────────────────────────────────────

const fmt = (v?: string | null) => v ? new Date(v).toLocaleDateString("pt-BR") : "—";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function groupBy<T>(arr: T[], key: keyof T) {
  return arr.reduce((acc, item) => {
    const k = String(item[key] ?? "Não informado");
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

// ── card UI helpers ───────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px",
  padding: "22px 24px", display: "flex", flexDirection: "column", gap: "12px",
  boxShadow: "0 1px 4px rgba(0,0,0,.04)",
};
const SECTION_TITLE: React.CSSProperties = {
  fontSize: "11px", fontWeight: 700, color: "#6b7280",
  textTransform: "uppercase", letterSpacing: ".08em", marginBottom: "12px",
};
const ibox = (bg: string, color: string): React.CSSProperties => ({
  width: "40px", height: "40px", borderRadius: "10px", background: bg,
  display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0,
});

function FTag({ label, bg, color }: { label: string; bg: string; color: string }) {
  return <span style={{ fontSize: "10px", fontWeight: 700, background: bg, color, borderRadius: "20px", padding: "2px 8px" }}>{label}</span>;
}

function XBtn({ label, icon, onClick, disabled, loading: spin, bg }: {
  label: string; icon?: React.ReactNode; onClick: () => void;
  disabled: boolean; loading: boolean; bg: string;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "5px", background: disabled ? "#f3f4f6" : bg, color: disabled ? "#9ca3af" : "#fff", border: "none", borderRadius: "8px", padding: "8px 10px", fontSize: "12px", fontWeight: 600, cursor: disabled ? "default" : "pointer", transition: "filter .15s" }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.filter = "brightness(0.88)"; }}
      onMouseLeave={e => { e.currentTarget.style.filter = ""; }}>
      {spin ? <Loader2 size={12} className="animate-spin" /> : (icon ?? <Download size={12} />)}
      {label}
    </button>
  );
}

// ── types ─────────────────────────────────────────────────────────────────────

interface AbandonoRow { razao_social: string; regime_tributario?: string; segmento?: string; dias_sem_orientacao: number; ultima_orientacao_consultiva?: string; semaforo: string; }
interface RiscoRow    { razao_social: string; dias_sem_orientacao: number; semaforo: string; }
interface DistData    { regime: Record<string, number>; segmento: Record<string, number>; total: number; }
interface ProdRow     { nome: string; meta: number; realizado: number; pct: number; }
interface HistRow     { canal: string; total: number; pct: number; clientes: number; }
interface ClienteOpt  { id: string; razao_social: string; }
interface PdfTask     { type: string; data: unknown; filename: string; loadKey: string; }

// ════════════════════════════════════════════════════════════════════════════
// OFF-SCREEN HTML COMPONENTS
// ════════════════════════════════════════════════════════════════════════════

function Cover({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ background: "linear-gradient(160deg,#0B1628 0%,#0E2460 55%,#1D4ED8 100%)", padding: "54px 52px 40px", display: "flex", flexDirection: "column", justifyContent: "flex-end", minHeight: "260px" }}>
      <div style={{ fontSize: "9px", fontWeight: 700, color: "#93C5FD", letterSpacing: ".18em", textTransform: "uppercase", marginBottom: "22px" }}>
        FREITAS CONSULTORIA CONTÁBIL E FINANCEIRA
      </div>
      <div style={{ fontSize: "30px", fontWeight: 800, color: "#fff", lineHeight: 1.15, marginBottom: "10px" }}>{title}</div>
      <div style={{ fontSize: "12px", color: "#FCD34D", fontWeight: 600, marginBottom: "6px" }}>{sub}</div>
      <div style={{ fontSize: "10px", color: "rgba(255,255,255,.45)" }}>Emissão: {EMIT}</div>
      <div style={{ marginTop: "26px", height: "2px", background: "linear-gradient(to right,#FCD34D,rgba(252,211,77,.1))" }} />
    </div>
  );
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "22px 52px", borderBottom: "1px solid #F1F5F9" }}>
      <div style={{ display: "inline-block", fontSize: "12px", fontWeight: 700, color: "#0F172A", marginBottom: "14px", paddingBottom: "5px", borderBottom: "2px solid #FCD34D" }}>{title}</div>
      {children}
    </div>
  );
}

function KPIs({ items }: { items: [string, string, string][] }) {
  return (
    <div style={{ display: "flex", gap: "14px" }}>
      {items.map(([label, value, color]) => (
        <div key={label} style={{ flex: 1, background: "#F8FAFC", borderRadius: "8px", padding: "14px 16px", borderLeft: `3px solid ${color}` }}>
          <div style={{ fontSize: "24px", fontWeight: 800, color }}>{value}</div>
          <div style={{ fontSize: "10px", color: "#6B7280", marginTop: "3px" }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

function PTbl({ headers, rows }: { headers: string[]; rows: React.ReactNode[][]; }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
      <thead>
        <tr style={{ background: "#0F172A" }}>
          {headers.map((h, i) => <th key={i} style={{ padding: "8px 10px", color: "#fff", textAlign: "left", fontWeight: 600, letterSpacing: ".04em", whiteSpace: "nowrap" }}>{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri} style={{ background: ri % 2 === 0 ? "#F8FAFC" : "#fff" }}>
            {row.map((cell, ci) => <td key={ci} style={{ padding: "7px 10px", borderBottom: "1px solid #E5E7EB", color: "#374151", verticalAlign: "middle" }}>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SBadge({ s }: { s: string }) {
  const map: Record<string, [string, string, string]> = { critico: ["#FEE2E2","#DC2626","Crítico"], atencao: ["#FEF3C7","#D97706","Atenção"], verde: ["#DCFCE7","#16A34A","OK"] };
  const [bg, color, label] = map[s] ?? ["#F3F4F6","#6B7280", s];
  return <span style={{ background: bg, color, padding: "2px 8px", borderRadius: "20px", fontWeight: 700, fontSize: "9px", whiteSpace: "nowrap" }}>{label}</span>;
}

function PBar({ pct }: { pct: number }) {
  const color = pct >= 100 ? "#16A34A" : pct >= 50 ? "#D97706" : "#DC2626";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div style={{ width: "72px", height: "6px", background: "#E5E7EB", borderRadius: "3px", overflow: "hidden", flexShrink: 0 }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: "6px", background: color, borderRadius: "3px" }} />
      </div>
      <span style={{ fontSize: "10px", fontWeight: 700, color }}>{pct}%</span>
    </div>
  );
}

function Foot() {
  return (
    <div style={{ padding: "14px 52px", background: "#F8FAFC", borderTop: "1px solid #E5E7EB" }}>
      <div style={{ fontSize: "9px", color: "#9CA3AF", textAlign: "center" }}>
        Freitas Consultoria Contábil e Financeira &nbsp;•&nbsp; Emissão: {EMIT_SHORT} &nbsp;•&nbsp; Gerado pelo CRM Consultivo
      </div>
    </div>
  );
}

// ── per-report HTML ───────────────────────────────────────────────────────────

function AbandonoHTML({ data, dias }: { data: AbandonoRow[]; dias: number }) {
  const criticos = data.filter(r => r.dias_sem_orientacao > 60).length;
  const atencao  = data.filter(r => r.dias_sem_orientacao > 30 && r.dias_sem_orientacao <= 60).length;
  return (
    <div style={{ fontFamily: "Arial,Helvetica,sans-serif", background: "#fff" }}>
      <Cover title="Radar de Abandono" sub={`Clientes sem orientação há ${dias}+ dias — ${MES_NOME}/${ANO}`} />
      <Sec title="Resumo Executivo">
        <KPIs items={[["Total identificados", String(data.length), "#1D4ED8"], ["Críticos (60+ dias)", String(criticos), "#DC2626"], ["Em atenção (31–60 dias)", String(atencao), "#D97706"]]} />
      </Sec>
      {criticos > 0 && (
        <div style={{ margin: "0 52px", padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "8px", fontSize: "10px", color: "#DC2626", fontWeight: 600 }}>
          ⚠ {criticos} cliente{criticos !== 1 ? "s" : ""} sem orientação há mais de 60 dias. Ação imediata recomendada.
        </div>
      )}
      <Sec title="Clientes por Maior Abandono">
        <PTbl
          headers={["Cliente", "Regime Tributário", "Segmento", "Dias s/ Orient.", "Última Orientação", "Status"]}
          rows={data.map(r => [
            r.razao_social,
            r.regime_tributario ?? "—",
            r.segmento ?? "—",
            <span style={{ fontWeight: 700, color: r.dias_sem_orientacao > 60 ? "#DC2626" : r.dias_sem_orientacao > 30 ? "#D97706" : "#374151" }}>{r.dias_sem_orientacao} dias</span>,
            fmt(r.ultima_orientacao_consultiva),
            <SBadge s={r.semaforo} />,
          ])}
        />
      </Sec>
      <Foot />
    </div>
  );
}

function RiscoHTML({ data, acoesMap }: { data: RiscoRow[]; acoesMap: Record<string, { count: number; urgencia: string }> }) {
  const totalAcoes = Object.values(acoesMap).reduce((s, v) => s + v.count, 0);
  const urgColor: Record<string, string> = { alta: "#DC2626", media: "#D97706", baixa: "#16A34A" };
  return (
    <div style={{ fontFamily: "Arial,Helvetica,sans-serif", background: "#fff" }}>
      <Cover title="Carteira em Risco" sub={`Clientes com semáforo crítico — ${EMIT_SHORT}`} />
      <Sec title="Resumo Executivo">
        <KPIs items={[["Clientes em risco crítico", String(data.length), "#DC2626"], ["Ações consultivas acumuladas", String(totalAcoes), "#D97706"]]} />
      </Sec>
      <Sec title="Clientes em Risco — Prioridade de Ação">
        <PTbl
          headers={["Cliente", "Dias s/ Orient.", "Ações Abertas", "Urgência Máx.", "Status"]}
          rows={[...data].sort((a, b) => b.dias_sem_orientacao - a.dias_sem_orientacao).map(r => {
            const ac = acoesMap[r.razao_social] ?? { count: 0, urgencia: "—" };
            return [
              r.razao_social,
              <span style={{ fontWeight: 700, color: "#DC2626" }}>{r.dias_sem_orientacao} dias</span>,
              ac.count > 0 ? <span style={{ fontWeight: 700, color: "#D97706" }}>{ac.count}</span> : "—",
              ac.urgencia !== "—" ? <span style={{ fontWeight: 700, color: urgColor[ac.urgencia] ?? "#6B7280", textTransform: "capitalize" }}>{ac.urgencia}</span> : "—",
              <SBadge s="critico" />,
            ];
          })}
        />
      </Sec>
      <Foot />
    </div>
  );
}

function DistHTML({ data }: { data: DistData }) {
  const sorted = (obj: Record<string, number>) => Object.entries(obj).sort((a, b) => b[1] - a[1]);
  const topR = sorted(data.regime)[0];
  const topS = sorted(data.segmento)[0];
  return (
    <div style={{ fontFamily: "Arial,Helvetica,sans-serif", background: "#fff" }}>
      <Cover title="Distribuição da Carteira" sub={`Análise por regime e segmento — ${ANO}`} />
      <Sec title="Insights Automáticos">
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {topR && <div style={{ background: "#EFF6FF", borderLeft: "3px solid #1D4ED8", padding: "10px 14px", borderRadius: "6px", fontSize: "11px", color: "#1D4ED8", fontWeight: 600 }}>{Math.round((topR[1] / data.total) * 100)}% da carteira é {topR[0]} ({topR[1]} clientes)</div>}
          {topS && <div style={{ background: "#F0FDF4", borderLeft: "3px solid #16A34A", padding: "10px 14px", borderRadius: "6px", fontSize: "11px", color: "#16A34A", fontWeight: 600 }}>Segmento predominante: {topS[0]} — {topS[1]} cliente{topS[1] !== 1 ? "s" : ""} ({Math.round((topS[1] / data.total) * 100)}%)</div>}
        </div>
      </Sec>
      <Sec title="Por Regime Tributário">
        <PTbl
          headers={["Regime Tributário", "Clientes", "% da Carteira"]}
          rows={sorted(data.regime).map(([k, v]) => [k, String(v), `${((v / data.total) * 100).toFixed(1)}%`])}
        />
      </Sec>
      <Sec title="Por Segmento">
        <PTbl
          headers={["Segmento", "Clientes", "% da Carteira"]}
          rows={sorted(data.segmento).map(([k, v]) => [k, String(v), `${((v / data.total) * 100).toFixed(1)}%`])}
        />
      </Sec>
      <Foot />
    </div>
  );
}

function ProdHTML({ data }: { data: ProdRow[] }) {
  const sorted   = [...data].sort((a, b) => b.pct - a.pct);
  const mediaPct = data.length ? Math.round(data.reduce((s, r) => s + r.pct, 0) / data.length) : 0;
  const top      = sorted[0];
  return (
    <div style={{ fontFamily: "Arial,Helvetica,sans-serif", background: "#fff" }}>
      <Cover title="Produtividade por Consultor" sub={`Mês de referência: ${MES_NOME} / ${ANO}`} />
      <Sec title="Destaques do Mês">
        <KPIs items={[
          ["Média da equipe", `${mediaPct}%`, "#1D4ED8"],
          ...(top ? [["Melhor desempenho", `${top.nome.split(" ")[0]} — ${top.pct}%`, "#16A34A"] as [string, string, string]] : []),
        ]} />
      </Sec>
      <Sec title="Ranking de Consultores">
        <PTbl
          headers={["#", "Consultor", "Meta", "Realizado", "% Atingido", "Progresso"]}
          rows={sorted.map((r, i) => [
            <span style={{ fontWeight: 700, color: i === 0 ? "#D97706" : "#6B7280" }}>#{i + 1}</span>,
            r.nome, String(r.meta), String(r.realizado),
            <span style={{ fontWeight: 700, color: r.pct >= 100 ? "#16A34A" : r.pct >= 50 ? "#D97706" : "#DC2626" }}>{r.pct}%</span>,
            <PBar pct={r.pct} />,
          ])}
        />
      </Sec>
      <Foot />
    </div>
  );
}

function HistHTML({ data }: { data: HistRow[] }) {
  const totalContatos = data.reduce((s, r) => s + r.total, 0);
  const top = data[0];
  return (
    <div style={{ fontFamily: "Arial,Helvetica,sans-serif", background: "#fff" }}>
      <Cover title="Histórico de Contatos" sub="Análise por canal de atendimento — Histórico completo" />
      <Sec title="Análise de Canal">
        <KPIs items={[
          ["Total de contatos registrados", String(totalContatos), "#1D4ED8"],
          ...(top ? [["Canal mais utilizado", `${top.canal} (${top.pct}%)`, "#7C3AED"] as [string, string, string]] : []),
        ]} />
        {top && <div style={{ background: "#EDE9FE", borderLeft: "3px solid #7C3AED", padding: "10px 14px", borderRadius: "6px", fontSize: "11px", color: "#7C3AED", fontWeight: 600, marginTop: "12px" }}>{top.canal} é o canal predominante, responsável por {top.pct}% de todos os contatos registrados na base.</div>}
      </Sec>
      <Sec title="Distribuição por Canal">
        <PTbl
          headers={["Canal", "Total de Contatos", "% do Total", "Clientes Distintos", "Média por Cliente"]}
          rows={data.map(r => [
            r.canal, String(r.total), `${r.pct}%`, String(r.clientes),
            r.clientes > 0 ? (r.total / r.clientes).toFixed(1) : "—",
          ])}
        />
      </Sec>
      <Foot />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// WORD UTILITIES
// ════════════════════════════════════════════════════════════════════════════

const TR = (text: string, opts: Partial<{ bold: boolean; size: number; color: string }> = {}) =>
  new TextRun({ text, bold: opts.bold ?? false, size: opts.size ?? 20, color: opts.color ?? "374151" });

const DARK = { type: ShadingType.SOLID, fill: "0F172A", color: "0F172A" } as const;
const COVER_BG = { type: ShadingType.SOLID, fill: "0B1628", color: "0B1628" } as const;

function wCover(title: string, sub: string) {
  return [
    new Paragraph({ shading: COVER_BG, spacing: { after: 0 }, children: [TR(" ")] }),
    new Paragraph({ shading: COVER_BG, spacing: { after: 0 }, children: [TR("FREITAS CONSULTORIA CONTÁBIL E FINANCEIRA", { bold: true, size: 18, color: "93C5FD" })] }),
    new Paragraph({ shading: COVER_BG, spacing: { after: 0 }, children: [TR(" ")] }),
    new Paragraph({ shading: COVER_BG, spacing: { after: 0 }, children: [TR(title, { bold: true, size: 40, color: "FFFFFF" })] }),
    new Paragraph({ shading: COVER_BG, spacing: { after: 0 }, children: [TR(sub, { size: 22, color: "FCD34D" })] }),
    new Paragraph({ shading: COVER_BG, spacing: { after: 0 }, children: [TR(`Emissão: ${EMIT}`, { size: 16, color: "9CA3AF" })] }),
    new Paragraph({ shading: COVER_BG, spacing: { after: 240 }, children: [TR(" ")] }),
    new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: "FCD34D" } }, spacing: { after: 280 }, children: [] }),
  ];
}

function wSecTitle(text: string) {
  return new Paragraph({
    children: [TR(text, { bold: true, size: 24, color: "0F172A" })],
    spacing: { before: 300, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: "FCD34D", space: 4 } },
  });
}

function wTable(headers: string[], rows: string[][]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: headers.map(h => new TableCell({
          children: [new Paragraph({ children: [TR(h, { bold: true, size: 18, color: "FFFFFF" })] })],
          shading: DARK,
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
        })),
      }),
      ...rows.map((row, ri) => new TableRow({
        children: row.map(cell => new TableCell({
          children: [new Paragraph({ children: [TR(cell, { size: 18 })] })],
          shading: ri % 2 === 0 ? { type: ShadingType.SOLID, fill: "F8FAFC", color: "F8FAFC" } : undefined,
          margins: { top: 50, bottom: 50, left: 80, right: 80 },
        })),
      })),
    ],
  });
}

function wFooter() {
  return new Paragraph({
    children: [TR(`Freitas Consultoria Contábil e Financeira  •  Emissão: ${EMIT_SHORT}  •  CRM Consultivo`, { size: 16, color: "9CA3AF" })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 400 },
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB", space: 8 } },
  });
}

async function buildWord(title: string, sub: string, filename: string, body: (Paragraph | Table)[]) {
  const doc = new Document({ sections: [{ children: [...wCover(title, sub), ...body, wFooter()] }] });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, filename);
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════════

export default function Relatorios() {
  const { toast } = useToast();
  const navigate  = useNavigate();

  const [clientes,       setClientes]       = useState<ClienteOpt[]>([]);
  const [diasFiltro,     setDiasFiltro]     = useState(30);
  const [cartaClienteId, setCartaClienteId] = useState("");
  const [cartaAno,       setCartaAno]       = useState(ANO);
  const [relClienteId,   setRelClienteId]   = useState("");
  const [loading,        setLoading]        = useState<Record<string, boolean>>({});
  const [pdfTask,        setPdfTask]        = useState<PdfTask | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const L = (k: string, v: boolean) => setLoading(p => ({ ...p, [k]: v }));

  useEffect(() => {
    supabase.from("clientes").select("id, razao_social").order("razao_social")
      .then(({ data }) => setClientes((data ?? []) as ClienteOpt[]));
  }, []);

  // ── PDF capture: fires after off-screen component re-renders ──────────────
  useEffect(() => {
    if (!pdfTask || !reportRef.current) return;
    const { filename, loadKey } = pdfTask;
    const el = reportRef.current;
    const id = setTimeout(async () => {
      try {
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
        const img    = canvas.toDataURL("image/png");
        const pdf    = new jsPDF({ orientation: "portrait", unit: "px", format: "a4" });
        const pW     = pdf.internal.pageSize.getWidth();
        const pH     = pdf.internal.pageSize.getHeight();
        const sc     = pW / canvas.width;
        const imgH   = canvas.height * sc;
        let y = 0;
        while (y < imgH) {
          if (y > 0) pdf.addPage();
          pdf.addImage(img, "PNG", 0, -y, pW, imgH);
          y += pH;
        }
        pdf.save(filename);
        toast({ title: "PDF gerado com sucesso!" });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        toast({ title: "Erro ao gerar PDF", description: msg, variant: "destructive" });
      } finally {
        L(loadKey, false);
        setPdfTask(null);
      }
    }, 180);
    return () => clearTimeout(id);
  }, [pdfTask, toast]);

  // ── data fetchers ─────────────────────────────────────────────────────────

  async function fetchAbandono(): Promise<AbandonoRow[] | null> {
    const { data, error } = await supabase.from("radar_consultivo")
      .select("razao_social, regime_tributario, segmento, dias_sem_orientacao, ultima_orientacao_consultiva, semaforo")
      .gte("dias_sem_orientacao", diasFiltro)
      .order("dias_sem_orientacao", { ascending: false });
    if (error) throw error;
    if (!data?.length) { toast({ title: "Nenhum cliente encontrado para o filtro selecionado." }); return null; }
    return data as AbandonoRow[];
  }

  async function fetchRisco() {
    const [{ data: radar, error }, { data: acoes }] = await Promise.all([
      supabase.from("radar_consultivo").select("razao_social, dias_sem_orientacao, semaforo").eq("semaforo", "critico").order("dias_sem_orientacao", { ascending: false }),
      supabase.from("acoes_consultivas").select("cliente_id, urgencia, status").in("status", ["aberta", "em_andamento"]),
    ]);
    if (error) throw error;
    if (!radar?.length) { toast({ title: "Nenhum cliente crítico no momento." }); return null; }
    const { data: cli } = await supabase.from("clientes").select("id, razao_social");
    const nameMap: Record<string, string> = {};
    for (const c of (cli ?? [])) nameMap[c.id] = c.razao_social;
    const acoesMap: Record<string, { count: number; urgencia: string }> = {};
    for (const a of (acoes ?? [])) {
      const nome = nameMap[(a as any).cliente_id] ?? (a as any).cliente_id;
      if (!acoesMap[nome]) acoesMap[nome] = { count: 0, urgencia: "—" };
      acoesMap[nome].count++;
      if ((a as any).urgencia === "alta" || acoesMap[nome].urgencia === "—") acoesMap[nome].urgencia = (a as any).urgencia;
    }
    return { radar: radar as RiscoRow[], acoesMap };
  }

  async function fetchDist(): Promise<DistData | null> {
    const { data, error } = await supabase.from("clientes").select("regime_tributario, segmento");
    if (error) throw error;
    if (!data?.length) { toast({ title: "Nenhum cliente cadastrado." }); return null; }
    return { regime: groupBy(data, "regime_tributario"), segmento: groupBy(data, "segmento"), total: data.length };
  }

  async function fetchProd(): Promise<ProdRow[] | null> {
    const { data: metas, error } = await supabase.from("metas").select("*, usuarios(nome)").eq("mes", MES).eq("ano", ANO);
    if (error) throw error;
    if (!metas?.length) { toast({ title: "Nenhuma meta configurada para o mês atual." }); return null; }
    return Promise.all((metas as any[]).map(async m => {
      const { data: real } = await supabase.rpc("get_orientacoes_mes", { p_usuario_id: m.usuario_id, p_mes: MES, p_ano: ANO });
      const r = real ?? 0;
      return { nome: m.usuarios?.nome ?? "—", meta: m.meta, realizado: r, pct: m.meta > 0 ? Math.round((r / m.meta) * 100) : 0 };
    }));
  }

  async function fetchHist(): Promise<HistRow[] | null> {
    const { data, error } = await supabase.from("interacoes").select("canal, cliente_id");
    if (error) throw error;
    if (!data?.length) { toast({ title: "Nenhum contato registrado." }); return null; }
    const total = data.length;
    const m: Record<string, { n: number; c: Set<string> }> = {};
    for (const i of data) {
      const k = (i as any).canal ?? "Não informado";
      if (!m[k]) m[k] = { n: 0, c: new Set() };
      m[k].n++; m[k].c.add(String((i as any).cliente_id));
    }
    return Object.entries(m).sort((a, b) => b[1].n - a[1].n).map(([canal, v]) => ({
      canal, total: v.n, pct: Math.round((v.n / total) * 100), clientes: v.c.size,
    }));
  }

  // ── PDF triggers ──────────────────────────────────────────────────────────

  async function triggerPDF(key: string, fn: () => Promise<unknown>, filename: string) {
    if (pdfTask) { toast({ title: "Aguarde o relatório atual finalizar." }); return; }
    L(key, true);
    try {
      const data = await fn();
      if (data === null) { L(key, false); return; }
      setPdfTask({ type: key, data, filename, loadKey: key });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Erro ao buscar dados", description: msg, variant: "destructive" });
      L(key, false);
    }
  }

  // ── Word generators ───────────────────────────────────────────────────────

  async function wordAbandono() {
    L("abandono-word", true);
    try {
      const data = await fetchAbandono(); if (!data) return;
      await buildWord("Radar de Abandono", `Clientes sem orientação há ${diasFiltro}+ dias`, `radar_abandono_${diasFiltro}d.docx`, [
        wSecTitle("Resumo Executivo"),
        new Paragraph({ children: [TR(`Total identificados: ${data.length}  |  Críticos (>60 dias): ${data.filter(r => r.dias_sem_orientacao > 60).length}`, { size: 20 })], spacing: { after: 180 } }),
        wSecTitle("Clientes por Maior Abandono"),
        wTable(["Cliente", "Regime", "Segmento", "Dias s/ Orient.", "Última Orient.", "Status"],
          data.map(r => [r.razao_social, r.regime_tributario ?? "—", r.segmento ?? "—", `${r.dias_sem_orientacao} dias`, fmt(r.ultima_orientacao_consultiva), r.semaforo === "critico" ? "Crítico" : r.semaforo === "atencao" ? "Atenção" : "OK"])),
      ]);
      toast({ title: "Word gerado com sucesso!" });
    } catch (e: unknown) { toast({ title: "Erro ao gerar Word", description: String(e), variant: "destructive" }); }
    finally { L("abandono-word", false); }
  }

  async function wordRisco() {
    L("risco-word", true);
    try {
      const result = await fetchRisco(); if (!result) return;
      const { radar, acoesMap } = result;
      await buildWord("Carteira em Risco", `${radar.length} clientes em situação crítica`, "carteira_risco.docx", [
        wSecTitle("Clientes em Situação Crítica"),
        wTable(["Cliente", "Dias s/ Orient.", "Ações Abertas", "Urgência Máx."],
          [...radar].sort((a, b) => b.dias_sem_orientacao - a.dias_sem_orientacao).map(r => {
            const ac = acoesMap[r.razao_social] ?? { count: 0, urgencia: "—" };
            return [r.razao_social, `${r.dias_sem_orientacao} dias`, String(ac.count || "—"), ac.urgencia];
          })),
      ]);
      toast({ title: "Word gerado com sucesso!" });
    } catch (e: unknown) { toast({ title: "Erro ao gerar Word", description: String(e), variant: "destructive" }); }
    finally { L("risco-word", false); }
  }

  async function wordDist() {
    L("dist-word", true);
    try {
      const data = await fetchDist(); if (!data) return;
      const sorted = (obj: Record<string, number>) => Object.entries(obj).sort((a, b) => b[1] - a[1]);
      await buildWord("Distribuição da Carteira", `Análise por regime e segmento — ${ANO}`, "distribuicao_carteira.docx", [
        wSecTitle("Por Regime Tributário"),
        wTable(["Regime Tributário", "Clientes", "% da Carteira"], sorted(data.regime).map(([k, v]) => [k, String(v), `${((v / data.total) * 100).toFixed(1)}%`])),
        wSecTitle("Por Segmento"),
        wTable(["Segmento", "Clientes", "% da Carteira"], sorted(data.segmento).map(([k, v]) => [k, String(v), `${((v / data.total) * 100).toFixed(1)}%`])),
      ]);
      toast({ title: "Word gerado com sucesso!" });
    } catch (e: unknown) { toast({ title: "Erro ao gerar Word", description: String(e), variant: "destructive" }); }
    finally { L("dist-word", false); }
  }

  async function wordProd() {
    L("prod-word", true);
    try {
      const data = await fetchProd(); if (!data) return;
      await buildWord("Produtividade por Consultor", `${MES_NOME} / ${ANO}`, `produtividade_${String(MES).padStart(2,"0")}_${ANO}.docx`, [
        wSecTitle("Ranking de Consultores"),
        wTable(["Consultor", "Meta", "Realizado", "% Atingido"],
          [...data].sort((a, b) => b.pct - a.pct).map(r => [r.nome, String(r.meta), String(r.realizado), `${r.pct}%`])),
      ]);
      toast({ title: "Word gerado com sucesso!" });
    } catch (e: unknown) { toast({ title: "Erro ao gerar Word", description: String(e), variant: "destructive" }); }
    finally { L("prod-word", false); }
  }

  async function wordHist() {
    L("hist-word", true);
    try {
      const data = await fetchHist(); if (!data) return;
      await buildWord("Histórico de Contatos", "Análise por canal de atendimento", "historico_contatos.docx", [
        wSecTitle("Distribuição por Canal"),
        wTable(["Canal", "Total", "% do Total", "Clientes Distintos", "Média/Cliente"],
          data.map(r => [r.canal, String(r.total), `${r.pct}%`, String(r.clientes), r.clientes > 0 ? (r.total / r.clientes).toFixed(1) : "—"])),
      ]);
      toast({ title: "Word gerado com sucesso!" });
    } catch (e: unknown) { toast({ title: "Erro ao gerar Word", description: String(e), variant: "destructive" }); }
    finally { L("hist-word", false); }
  }

  // ── Carta de Valor (PDF direto via jsPDF, Word via docx) ──────────────────

  async function cartaPDF() {
    if (!cartaClienteId) { toast({ title: "Selecione um cliente", variant: "destructive" }); return; }
    L("carta-pdf", true);
    try {
      const cli = clientes.find(c => c.id === cartaClienteId);
      const nomeCliente = cli?.razao_social ?? "Cliente";
      const { data: ints } = await supabase.from("interacoes").select("tipo, data_interacao")
        .eq("cliente_id", cartaClienteId).gte("data_interacao", `${cartaAno}-01-01`).lte("data_interacao", `${cartaAno}-12-31`);
      const { data: acs } = await supabase.from("acoes_consultivas").select("status").eq("cliente_id", cartaClienteId);
      const total    = (ints ?? []).length;
      const concl    = (acs ?? []).filter((a: any) => a.status === "concluida").length;
      const abertas  = (acs ?? []).filter((a: any) => ["aberta","em_andamento"].includes(a.status)).length;

      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      const W = 210; const M = 20;
      pdf.setFillColor(11, 22, 40); pdf.rect(0, 0, W, 80, "F");
      pdf.setFillColor(29, 78, 216); pdf.rect(0, 60, W, 20, "F");
      pdf.setTextColor(147, 197, 253); pdf.setFontSize(8); pdf.setFont("helvetica", "bold");
      pdf.text("FREITAS CONSULTORIA CONTÁBIL E FINANCEIRA", W / 2, 18, { align: "center" });
      pdf.setTextColor(252, 211, 77); pdf.setFontSize(7); pdf.setFont("helvetica", "normal");
      pdf.text(`Carta de Valor — Ano ${cartaAno}`, W / 2, 24, { align: "center" });
      pdf.setTextColor(255, 255, 255); pdf.setFontSize(14); pdf.setFont("helvetica", "bold");
      pdf.text(nomeCliente, M, 48);
      pdf.setFontSize(7); pdf.setFont("helvetica","normal"); pdf.setTextColor(147,197,253);
      pdf.text(`Emissão: ${EMIT_SHORT}`, W - M, 72, { align: "right" });
      let y = 93;
      const ln = () => { pdf.setDrawColor(212,175,55); pdf.setLineWidth(.4); pdf.line(M, y, W - M, y); y += 5; };
      const h2 = (t: string) => { pdf.setFillColor(239,246,255); pdf.rect(M, y-1, W-2*M, 7, "F"); pdf.setTextColor(17,24,39); pdf.setFontSize(8); pdf.setFont("helvetica","bold"); pdf.text(t, M+2, y+4); y += 9; };
      const kv = (k: string, v: string) => { pdf.setFont("helvetica","bold"); pdf.setTextColor(107,114,128); pdf.setFontSize(7.5); pdf.text(k, M, y); pdf.setTextColor(29,78,216); pdf.text(v, W-M, y, { align: "right" }); y += 6; };
      const bd = (t: string) => { pdf.setFont("helvetica","normal"); pdf.setTextColor(55,65,81); pdf.setFontSize(8); const l = pdf.splitTextToSize(t, W-2*M); pdf.text(l, M, y); y += l.length * 4.5 + 4; };
      ln(); h2("Resumo do Ano"); kv("Total de orientações realizadas", String(total)); kv("Ações concluídas", String(concl)); kv("Ações em aberto", String(abertas));
      y += 3; ln(); h2("Mensagem ao Cliente");
      bd(`Prezado(a) cliente,\n\nÉ com satisfação que apresentamos a Carta de Valor referente ao ano de ${cartaAno}. Este documento consolida o trabalho realizado em parceria com ${nomeCliente}, destacando as orientações prestadas e os resultados alcançados ao longo do período.`);
      ln(); h2("Conclusão");
      bd(`Com ${total} orientações registradas em ${cartaAno}, reafirmamos nosso compromisso com a transparência, a proatividade e a geração de valor contínuo para o seu negócio.`);
      pdf.setTextColor(156,163,175); pdf.setFontSize(7); pdf.text("Freitas Consultoria Contábil e Financeira  •  freitas.contabilista@gmail.com", W/2, 285, { align: "center" });
      pdf.save(`carta_valor_${nomeCliente.replace(/[^a-z0-9]/gi,"_").toLowerCase()}_${cartaAno}.pdf`);
      toast({ title: "Carta de Valor exportada em PDF!" });
    } catch (e: unknown) { toast({ title: "Erro ao gerar PDF", description: String(e), variant: "destructive" }); }
    finally { L("carta-pdf", false); }
  }

  async function cartaWord() {
    if (!cartaClienteId) { toast({ title: "Selecione um cliente", variant: "destructive" }); return; }
    L("carta-word", true);
    try {
      const cli = clientes.find(c => c.id === cartaClienteId);
      const nomeCliente = cli?.razao_social ?? "Cliente";
      const [{ data: ints }, { data: acs }] = await Promise.all([
        supabase.from("interacoes").select("tipo, data_interacao").eq("cliente_id", cartaClienteId).gte("data_interacao", `${cartaAno}-01-01`).lte("data_interacao", `${cartaAno}-12-31`),
        supabase.from("acoes_consultivas").select("status").eq("cliente_id", cartaClienteId),
      ]);
      const total  = (ints ?? []).length;
      const concl  = (acs ?? []).filter((a: any) => a.status === "concluida").length;
      const abertas = (acs ?? []).filter((a: any) => ["aberta","em_andamento"].includes(a.status)).length;
      await buildWord(`Carta de Valor — ${nomeCliente}`, `Ano ${cartaAno}`, `carta_valor_${nomeCliente.replace(/[^a-z0-9]/gi,"_").toLowerCase()}_${cartaAno}.docx`, [
        wSecTitle("Resumo do Ano"),
        wTable(["Métrica", "Resultado"], [["Total de orientações realizadas", String(total)], ["Ações concluídas", String(concl)], ["Ações em aberto", String(abertas)]]),
        wSecTitle("Mensagem ao Cliente"),
        new Paragraph({ children: [TR(`Prezado(a) cliente,\n\nÉ com satisfação que apresentamos a Carta de Valor referente ao ano de ${cartaAno}. Este documento consolida o trabalho realizado em parceria com ${nomeCliente}, com ${total} orientações registradas ao longo do período.\n\nNosso compromisso é com a entrega de valor real e a excelência no serviço. Agradecemos a confiança em nossa equipe.`, { size: 20 })], spacing: { after: 200 } }),
      ]);
      toast({ title: "Carta de Valor exportada em Word!" });
    } catch (e: unknown) { toast({ title: "Erro ao gerar Word", description: String(e), variant: "destructive" }); }
    finally { L("carta-word", false); }
  }

  // ── off-screen renderer ───────────────────────────────────────────────────

  function renderTask() {
    if (!pdfTask) return null;
    const { type, data } = pdfTask;
    if (type === "abandono-pdf") return <AbandonoHTML data={data as AbandonoRow[]} dias={diasFiltro} />;
    if (type === "risco-pdf")   { const d = data as { radar: RiscoRow[]; acoesMap: Record<string, { count: number; urgencia: string }> }; return <RiscoHTML data={d.radar} acoesMap={d.acoesMap} />; }
    if (type === "dist-pdf")    return <DistHTML data={data as DistData} />;
    if (type === "prod-pdf")    return <ProdHTML data={data as ProdRow[]} />;
    if (type === "hist-pdf")    return <HistHTML data={data as HistRow[]} />;
    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* off-screen PDF render area */}
      <div ref={reportRef} style={{ position: "fixed", left: "-9999px", top: 0, width: "794px", background: "#fff", zIndex: -1 }}>
        {renderTask()}
      </div>

      <main style={{ maxWidth: "1240px", margin: "0 auto", padding: "28px 28px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{ fontSize: "21px", fontWeight: 700, color: "#111827", margin: 0 }}>Relatórios</h1>
          <p style={{ fontSize: "13px", color: "#6b7280", margin: "4px 0 0" }}>Documentos premium em PDF e Word com design profissional e dados reais.</p>
        </div>

        {/* ── Acompanhamento da Carteira ── */}
        <div style={SECTION_TITLE}>Acompanhamento da Carteira</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: "16px", marginBottom: "32px" }}>

          {/* Radar de Abandono */}
          <div style={CARD}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
              <div style={ibox("#FEF3C7","#D97706")}><AlertTriangle size={18} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>Radar de Abandono</span>
                  <FTag label="PDF" bg="#FEF9C3" color="#A16207" /><FTag label="Word" bg="#EDE9FE" color="#7C3AED" />
                </div>
                <p style={{ fontSize: "12px", color: "#6b7280", margin: 0, lineHeight: 1.5 }}>Clientes sem orientação no período, ordenados por maior abandono, com alerta destacado para situações críticas.</p>
              </div>
            </div>
            <div>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", marginBottom: "6px" }}>Filtrar por ausência de contato:</div>
              <div style={{ display: "flex", gap: "6px" }}>
                {[15, 30, 60].map(d => (
                  <button key={d} onClick={() => setDiasFiltro(d)} style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: 600, cursor: "pointer", border: "1.5px solid", borderColor: diasFiltro === d ? "#D97706" : "#E5E7EB", background: diasFiltro === d ? "#FFFBEB" : "#F9FAFB", color: diasFiltro === d ? "#D97706" : "#6B7280" }}>+{d} dias</button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
              <XBtn label="PDF"  onClick={() => triggerPDF("abandono-pdf", fetchAbandono, `radar_abandono_${diasFiltro}d.pdf`)} disabled={!!loading["abandono-pdf"] || !!pdfTask} loading={!!loading["abandono-pdf"]} bg="#D97706" />
              <XBtn label="Word" onClick={wordAbandono} disabled={!!loading["abandono-word"]} loading={!!loading["abandono-word"]} bg="#7C3AED" />
            </div>
          </div>

          {/* Carteira em Risco */}
          <div style={CARD}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
              <div style={ibox("#FEE2E2","#DC2626")}><ShieldAlert size={18} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>Carteira em Risco</span>
                  <FTag label="PDF" bg="#FEE2E2" color="#DC2626" /><FTag label="Word" bg="#EDE9FE" color="#7C3AED" />
                </div>
                <p style={{ fontSize: "12px", color: "#6b7280", margin: 0, lineHeight: 1.5 }}>Clientes com semáforo crítico, ações acumuladas e urgência máxima. Resumo executivo com total em risco.</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
              <XBtn label="PDF"  onClick={() => triggerPDF("risco-pdf", fetchRisco, "carteira_risco.pdf")} disabled={!!loading["risco-pdf"] || !!pdfTask} loading={!!loading["risco-pdf"]} bg="#DC2626" />
              <XBtn label="Word" onClick={wordRisco} disabled={!!loading["risco-word"]} loading={!!loading["risco-word"]} bg="#7C3AED" />
            </div>
          </div>

          {/* Distribuição da Carteira */}
          <div style={CARD}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
              <div style={ibox("#EFF6FF","#1D4ED8")}><PieChart size={18} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>Distribuição da Carteira</span>
                  <FTag label="PDF" bg="#DBEAFE" color="#1D4ED8" /><FTag label="Word" bg="#EDE9FE" color="#7C3AED" />
                </div>
                <p style={{ fontSize: "12px", color: "#6b7280", margin: 0, lineHeight: 1.5 }}>Distribuição por regime tributário e segmento com percentuais e insights automáticos.</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
              <XBtn label="PDF"  onClick={() => triggerPDF("dist-pdf", fetchDist, "distribuicao_carteira.pdf")} disabled={!!loading["dist-pdf"] || !!pdfTask} loading={!!loading["dist-pdf"]} bg="#1D4ED8" />
              <XBtn label="Word" onClick={wordDist} disabled={!!loading["dist-word"]} loading={!!loading["dist-word"]} bg="#7C3AED" />
            </div>
          </div>
        </div>

        {/* ── Produtividade ── */}
        <div style={SECTION_TITLE}>Produtividade</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: "16px", marginBottom: "32px" }}>

          {/* Produtividade por Consultor */}
          <div style={CARD}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
              <div style={ibox("#F0FDF4","#16A34A")}><TrendingUp size={18} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>Produtividade por Consultor</span>
                  <FTag label="PDF" bg="#DCFCE7" color="#16A34A" /><FTag label="Word" bg="#EDE9FE" color="#7C3AED" />
                </div>
                <p style={{ fontSize: "12px", color: "#6b7280", margin: 0, lineHeight: 1.5 }}>Ranking com meta vs. realizado do mês atual, barra de progresso visual e melhor desempenho.</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
              <XBtn label="PDF"  onClick={() => triggerPDF("prod-pdf", fetchProd, `produtividade_${String(MES).padStart(2,"0")}_${ANO}.pdf`)} disabled={!!loading["prod-pdf"] || !!pdfTask} loading={!!loading["prod-pdf"]} bg="#16A34A" />
              <XBtn label="Word" onClick={wordProd} disabled={!!loading["prod-word"]} loading={!!loading["prod-word"]} bg="#7C3AED" />
            </div>
          </div>

          {/* Histórico de Contatos */}
          <div style={CARD}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
              <div style={ibox("#F5F3FF","#7C3AED")}><Activity size={18} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>Histórico de Contatos</span>
                  <FTag label="PDF" bg="#EDE9FE" color="#7C3AED" /><FTag label="Word" bg="#EDE9FE" color="#7C3AED" />
                </div>
                <p style={{ fontSize: "12px", color: "#6b7280", margin: 0, lineHeight: 1.5 }}>Canais mais utilizados, clientes distintos e análise de canal predominante em todo o histórico.</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
              <XBtn label="PDF"  onClick={() => triggerPDF("hist-pdf", fetchHist, "historico_contatos.pdf")} disabled={!!loading["hist-pdf"] || !!pdfTask} loading={!!loading["hist-pdf"]} bg="#7C3AED" />
              <XBtn label="Word" onClick={wordHist} disabled={!!loading["hist-word"]} loading={!!loading["hist-word"]} bg="#7C3AED" />
            </div>
          </div>
        </div>

        {/* ── Para o Cliente ── */}
        <div style={SECTION_TITLE}>Para o Cliente</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: "16px", marginBottom: "32px" }}>

          {/* Relatório Consultivo Individual */}
          <div style={CARD}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
              <div style={ibox("#EFF6FF","#1D4ED8")}><FileText size={18} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>Relatório Consultivo Individual</span>
                  <FTag label="PDF" bg="#DBEAFE" color="#1D4ED8" /><FTag label="Word" bg="#EDE9FE" color="#7C3AED" />
                </div>
                <p style={{ fontSize: "12px", color: "#6b7280", margin: 0, lineHeight: 1.5 }}>Relatório premium com filtros de período, tipo e canal. Acesse a página do cliente para gerar.</p>
              </div>
            </div>
            <div>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", marginBottom: "6px" }}>Ir para o cliente:</div>
              <select value={relClienteId} onChange={e => setRelClienteId(e.target.value)}
                style={{ width: "100%", fontSize: "12px", color: "#374151", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "7px", padding: "7px 10px", outline: "none" }}>
                <option value="">Selecione o cliente…</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
              </select>
            </div>
            <button onClick={() => relClienteId && navigate(`/radar/${relClienteId}`)} disabled={!relClienteId}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: relClienteId ? "#1d4ed8" : "#f3f4f6", color: relClienteId ? "#fff" : "#9ca3af", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "12px", fontWeight: 600, cursor: relClienteId ? "pointer" : "default", marginTop: "auto", transition: "background .15s" }}>
              <ExternalLink size={13} /> Abrir página do cliente
            </button>
          </div>

          {/* Carta de Valor Anual */}
          <div style={CARD}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
              <div style={ibox("#FFFBEB","#D97706")}><Star size={18} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>Carta de Valor Anual</span>
                  <FTag label="PDF" bg="#FEF9C3" color="#A16207" /><FTag label="Word" bg="#DCFCE7" color="#16A34A" />
                </div>
                <p style={{ fontSize: "12px", color: "#6b7280", margin: 0, lineHeight: 1.5 }}>Documento anual com mensagem personalizada, resumo de orientações e ações do período.</p>
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
              <XBtn label="PDF"  onClick={cartaPDF}  disabled={!cartaClienteId || !!loading["carta-pdf"]}  loading={!!loading["carta-pdf"]}  bg="#D97706" />
              <XBtn label="Word" onClick={cartaWord} disabled={!cartaClienteId || !!loading["carta-word"]} loading={!!loading["carta-word"]} bg="#16A34A" />
            </div>
          </div>

        </div>
      </main>
    </>
  );
}
