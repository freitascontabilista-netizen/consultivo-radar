import { useMemo, useRef, useState } from "react";
import { Loader2, FileDown, FileText } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { AcaoConsultivaRow, InteracaoRow, RadarConsultivoRow } from "@/lib/supabase";
import { TIPOS_ORIENTACAO } from "@/lib/constants";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  AlignmentType, BorderStyle, Document, HeadingLevel, Packer,
  Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from "docx";

// ── helpers ──────────────────────────────────────────────────────────────────

const CANAIS_ALL = ["WhatsApp", "E-mail", "Telefone", "Reunião presencial", "Videochamada", "Outro"];

const TIPO_MAP: Record<string, { label: string; bg: string; color: string }> = Object.fromEntries(
  TIPOS_ORIENTACAO.map(t => [t.key, { label: t.label, bg: t.bg, color: t.color }])
);

function toDateStr(date: Date) {
  return date.toISOString().slice(0, 10);
}

function fmt(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtLong(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function interacaoDate(i: InteracaoRow) {
  return i.data_interacao ?? i.criado_em ?? i.created_at ?? null;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function slugify(s: string) {
  return s.replace(/[^a-z0-9]/gi, "_").toLowerCase().slice(0, 40);
}

// ── props ─────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cliente: RadarConsultivoRow | null;
  interacoes: InteracaoRow[];
  acoes: AcaoConsultivaRow[];
}

// ── component ─────────────────────────────────────────────────────────────────

export function RelatorioModal({ open, onOpenChange, cliente, interacoes, acoes }: Props) {
  const today = toDateStr(new Date());
  const thirtyAgo = toDateStr(new Date(Date.now() - 30 * 864e5));

  const [dateStart, setDateStart] = useState(thirtyAgo);
  const [dateEnd, setDateEnd] = useState(today);
  const [selTipos, setSelTipos] = useState<Set<string>>(new Set());
  const [selCanais, setSelCanais] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState<"pdf" | "word" | null>(null);

  const reportRef = useRef<HTMLDivElement>(null);

  const toggleTipo = (k: string) =>
    setSelTipos(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleCanal = (c: string) =>
    setSelCanais(p => { const n = new Set(p); n.has(c) ? n.delete(c) : n.add(c); return n; });

  const filtered = useMemo(() => {
    const start = new Date(dateStart + "T00:00:00");
    const end   = new Date(dateEnd   + "T23:59:59");
    return interacoes.filter(i => {
      const d = new Date(interacaoDate(i) ?? "");
      if (isNaN(d.getTime())) return false;
      if (d < start || d > end) return false;
      if (selTipos.size > 0 && !selTipos.has(i.tipo)) return false;
      if (selCanais.size > 0 && !selCanais.has(i.canal ?? "")) return false;
      return true;
    });
  }, [interacoes, dateStart, dateEnd, selTipos, selCanais]);

  const nomeCliente = cliente?.razao_social ?? "Cliente";
  const emissao = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const periodo  = `${fmt(dateStart + "T12:00:00")} a ${fmt(dateEnd + "T12:00:00")}`;
  const canaisUsados = [...new Set(filtered.map(i => i.canal).filter(Boolean))].join(", ") || "—";

  // Dados para textos dinâmicos
  const tipoContagem = filtered.reduce<Record<string, number>>((acc, i) => {
    const t = i.tipo ?? "outros"; acc[t] = (acc[t] ?? 0) + 1; return acc;
  }, {});
  const tipoTop = Object.entries(tipoContagem).sort((a, b) => b[1] - a[1])[0];

  const canalContagem = filtered.reduce<Record<string, number>>((acc, i) => {
    const c = i.canal ?? ""; if (c) { acc[c] = (acc[c] ?? 0) + 1; } return acc;
  }, {});
  const canalTop = Object.entries(canalContagem).sort((a, b) => b[1] - a[1])[0];

  const temasAcoes = acoes.slice(0, 3).map(a => a.tema).filter(Boolean).join(", ");

  const textoObjetivo = `Este documento apresenta o histórico consultivo de ${nomeCliente} referente ao período de ${periodo}. Elaborado pela Freitas Consultoria Contábil e Financeira, reúne as orientações prestadas, os canais de comunicação utilizados, os temas abordados e as ações em andamento, com o objetivo de demonstrar o trabalho realizado e subsidiar as decisões estratégicas do empresário.`;

  const textoNarrativo = (() => {
    const p: string[] = [];
    p.push(`No período de ${periodo}, foram realizadas ${filtered.length} orientação${filtered.length !== 1 ? "ões" : ""} consultiva${filtered.length !== 1 ? "s" : ""} para ${nomeCliente}.`);
    if (filtered.length > 0 && tipoTop) {
      const label = TIPO_MAP[tipoTop[0]]?.label ?? tipoTop[0];
      let frase = `O tipo de orientação mais frequente foi ${label} (${tipoTop[1]} ocorrência${tipoTop[1] !== 1 ? "s" : ""})`;
      frase += canalTop ? `, com utilização predominante do canal ${canalTop[0]} (${canalTop[1]} contato${canalTop[1] !== 1 ? "s" : ""}).` : ".";
      p.push(frase);
    }
    if (acoes.length > 0) {
      p.push(`Há ${acoes.length} ação${acoes.length !== 1 ? "ões" : ""} consultiva${acoes.length !== 1 ? "s" : ""} em aberto${temasAcoes ? `, com destaque para os temas: ${temasAcoes}` : ""}.`);
    } else {
      p.push("Não há ações consultivas abertas no momento.");
    }
    p.push("Este relatório consolida o comprometimento da Freitas Consultoria Contábil e Financeira com a entrega de valor, a transparência no relacionamento e a excelência no serviço prestado.");
    return p.join(" ");
  })();

  // ── PDF ──────────────────────────────────────────────────────────────────────

  const generatePDF = async () => {
    const el = reportRef.current;
    if (!el) return;
    setGenerating("pdf");
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        allowTaint: true,
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pgW = pdf.internal.pageSize.getWidth();
      const pgH = pdf.internal.pageSize.getHeight();
      const ratio = pgW / canvas.width;
      const scaledH = canvas.height * ratio;
      let y = 0;
      pdf.addImage(imgData, "JPEG", 0, 0, pgW, scaledH);
      y += pgH;
      while (y < scaledH) {
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, -(y / ratio) * ratio, pgW, scaledH);
        y += pgH;
      }
      pdf.save(`relatorio_${slugify(nomeCliente)}_${today}.pdf`);
    } finally {
      setGenerating(null);
    }
  };

  // ── Word ─────────────────────────────────────────────────────────────────────

  const generateWord = async () => {
    setGenerating("word");
    try {
      const sep = new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "D4AF37", space: 4 } },
        spacing: { after: 200 },
      });

      const heading = (text: string) => new Paragraph({
        text,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 320, after: 120 },
        shading: { type: ShadingType.SOLID, color: "EFF6FF", fill: "EFF6FF" },
      });

      const cell = (text: string, bold = false, color = "111827") =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text, bold, color, size: 20 })] })],
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 2, color: "E5E7EB" }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
          margins: { top: 80, bottom: 80, left: 80, right: 80 },
        });

      const clienteRows = [
        ["Razão Social", nomeCliente],
        ["Segmento", cliente?.segmento ?? "—"],
        ["Regime Tributário", (cliente as any)?.regime_tributario ?? "—"],
        ["UF", (cliente as any)?.uf ?? "—"],
        ["Porte", (cliente as any)?.porte ?? "—"],
        ["Canal Preferido", (cliente as any)?.canal_preferido ?? "—"],
      ];

      const clienteTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: clienteRows.map(([k, v]) => new TableRow({
          children: [cell(k, true, "6B7280"), cell(v, false, "111827")],
        })),
      });

      const resumo = [
        new Paragraph({
          children: [
            new TextRun({ text: `Total de orientações no período: `, bold: true, size: 22 }),
            new TextRun({ text: String(filtered.length), bold: true, size: 28, color: "1D4ED8" }),
          ],
          spacing: { after: 80 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Canais utilizados: `, bold: true, size: 22 }),
            new TextRun({ text: canaisUsados, size: 22, color: "374151" }),
          ],
          spacing: { after: 80 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Período: `, bold: true, size: 22 }),
            new TextRun({ text: periodo, size: 22, color: "374151" }),
          ],
          spacing: { after: 200 },
        }),
      ];

      const orientacaoParags = filtered.flatMap(i => {
        const tipo = TIPO_MAP[i.tipo]?.label ?? i.tipo;
        const data = fmtLong(interacaoDate(i));
        return [
          new Paragraph({
            children: [
              new TextRun({ text: `[${tipo}]  `, bold: true, color: "1D4ED8", size: 20 }),
              new TextRun({ text: data, size: 18, color: "6B7280" }),
              i.canal ? new TextRun({ text: `  •  ${i.canal}`, size: 18, color: "6B7280" }) : new TextRun(""),
            ],
            spacing: { before: 200, after: 40 },
          }),
          new Paragraph({
            children: [new TextRun({ text: i.assunto ?? "Sem assunto", bold: true, size: 22, color: "111827" })],
            spacing: { after: 40 },
          }),
          i.resumo ? new Paragraph({
            children: [new TextRun({ text: i.resumo, size: 20, color: "374151" })],
            spacing: { after: 40 },
          }) : null,
          i.proximo_passo ? new Paragraph({
            children: [
              new TextRun({ text: "→ Próximo passo: ", bold: true, size: 20, color: "B45309" }),
              new TextRun({ text: i.proximo_passo, size: 20, color: "78350F" }),
            ],
            spacing: { after: 40 },
          }) : null,
          new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "F3F4F6" } },
            spacing: { after: 40 },
          }),
        ].filter(Boolean) as Paragraph[];
      });

      const acoesParags = acoes.flatMap(a => [
        new Paragraph({
          children: [
            new TextRun({ text: `● `, color: "1D4ED8" }),
            new TextRun({ text: a.tema ?? "Sem tema", bold: true, size: 22, color: "111827" }),
            new TextRun({ text: `  [${a.urgencia ?? "média"}]`, size: 18, color: "D97706" }),
          ],
          spacing: { before: 120, after: 40 },
        }),
        a.acao_recomendada ? new Paragraph({
          children: [new TextRun({ text: a.acao_recomendada, size: 20, color: "374151" })],
          spacing: { after: 40 },
        }) : null,
      ].filter(Boolean) as Paragraph[]);

      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              children: [new TextRun({ text: "FREITAS CONSULTORIA CONTÁBIL E FINANCEIRA", bold: true, size: 32, color: "0F172A", allCaps: true })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 80 },
            }),
            new Paragraph({
              children: [new TextRun({ text: "CRC/DF – Relatório Consultivo", size: 22, color: "6B7280" })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 80 },
            }),
            new Paragraph({
              children: [new TextRun({ text: `Emissão: ${emissao}`, size: 20, color: "9CA3AF" })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 320 },
            }),
            sep,
            new Paragraph({
              children: [new TextRun({ text: nomeCliente, bold: true, size: 40, color: "0F172A" })],
              spacing: { after: 80 },
            }),
            new Paragraph({
              children: [new TextRun({ text: `Período: ${periodo}`, size: 22, color: "D97706" })],
              spacing: { after: 320 },
            }),
            sep,
            heading("Objetivo do Relatório"),
            new Paragraph({
              children: [new TextRun({ text: textoObjetivo, size: 22, color: "374151" })],
              spacing: { after: 200 },
            }),
            sep,
            heading("Dados do Cliente"),
            clienteTable,
            sep,
            heading("Resumo Executivo"),
            ...resumo,
            sep,
            heading(`Orientações no Período (${filtered.length})`),
            ...(filtered.length > 0 ? orientacaoParags : [
              new Paragraph({ children: [new TextRun({ text: "Nenhuma orientação encontrada no período.", color: "9CA3AF", size: 20 })] })
            ]),
            sep,
            heading(`Ações Consultivas Abertas (${acoes.length})`),
            ...(acoes.length > 0 ? acoesParags : [
              new Paragraph({ children: [new TextRun({ text: "Nenhuma ação consultiva aberta.", color: "9CA3AF", size: 20 })] })
            ]),
            sep,
            heading("Análise Consolidada do Período"),
            new Paragraph({
              children: [new TextRun({ text: textoNarrativo, size: 22, color: "1E3A5F", italics: true })],
              spacing: { after: 200 },
              shading: { type: ShadingType.SOLID, color: "EFF6FF", fill: "EFF6FF" },
            }),
            sep,
            new Paragraph({
              children: [new TextRun({ text: "Freitas Consultoria Contábil e Financeira  •  freitas.contabilista@gmail.com", size: 18, color: "9CA3AF" })],
              alignment: AlignmentType.CENTER,
              spacing: { before: 400 },
            }),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      downloadBlob(blob, `relatorio_${slugify(nomeCliente)}_${today}.docx`);
    } finally {
      setGenerating(null);
    }
  };

  // ── report HTML (hidden, captured by html2canvas) ─────────────────────────

  const ReportHTML = () => (
    <div ref={reportRef} style={{ width: "794px", background: "#ffffff", fontFamily: "'Segoe UI', Arial, sans-serif" }}>

      {/* CAPA */}
      <div style={{ background: "linear-gradient(135deg, #0B1628 0%, #1D4ED8 100%)", padding: "64px 56px 48px", minHeight: "320px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#93C5FD", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "4px" }}>RELATÓRIO CONSULTIVO</div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "#ffffff" }}>Freitas Consultoria Contábil e Financeira</div>
            <div style={{ fontSize: "12px", color: "#93C5FD", marginTop: "2px" }}>CRC/DF · Excelência em Gestão Contábil</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "11px", color: "#93C5FD" }}>Emissão</div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#FCD34D" }}>{emissao}</div>
          </div>
        </div>
        <div style={{ marginTop: "40px" }}>
          <div style={{ height: "2px", background: "linear-gradient(90deg, #D4AF37, transparent)", marginBottom: "24px" }} />
          <div style={{ fontSize: "32px", fontWeight: 900, color: "#ffffff", lineHeight: 1.2, marginBottom: "12px" }}>
            {nomeCliente}
          </div>
          {cliente?.nome_fantasia && cliente.nome_fantasia !== nomeCliente && (
            <div style={{ fontSize: "15px", color: "#93C5FD", marginBottom: "8px" }}>{cliente.nome_fantasia}</div>
          )}
          <div style={{ display: "flex", gap: "24px", marginTop: "12px" }}>
            <div>
              <div style={{ fontSize: "10px", color: "#93C5FD", textTransform: "uppercase", letterSpacing: "0.1em" }}>Período</div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "#FCD34D" }}>{periodo}</div>
            </div>
            <div>
              <div style={{ fontSize: "10px", color: "#93C5FD", textTransform: "uppercase", letterSpacing: "0.1em" }}>Orientações</div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "#FCD34D" }}>{filtered.length}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "40px 56px 0" }}>

        {/* LINHA DOURADA */}
        <div style={{ height: "3px", background: "linear-gradient(90deg, #D4AF37, #F59E0B, transparent)", borderRadius: "2px", marginBottom: "36px" }} />

        {/* OBJETIVO DO RELATÓRIO */}
        <div style={{ marginBottom: "36px" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "12px" }}>Objetivo do Relatório</div>
          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderLeft: "4px solid #1D4ED8", borderRadius: "0 10px 10px 0", padding: "18px 22px" }}>
            <p style={{ fontSize: "13px", color: "#374151", lineHeight: 1.8, margin: 0 }}>{textoObjetivo}</p>
          </div>
        </div>

        {/* DADOS DO CLIENTE */}
        <div style={{ marginBottom: "36px" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "14px" }}>Dados do Cliente</div>
          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "20px 24px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
              {[
                ["Razão Social",       nomeCliente],
                ["Segmento",           cliente?.segmento ?? "—"],
                ["Regime Tributário",  (cliente as any)?.regime_tributario ?? "—"],
                ["UF",                 (cliente as any)?.uf ?? "—"],
                ["Porte",              (cliente as any)?.porte ?? "—"],
                ["Canal Preferido",    (cliente as any)?.canal_preferido ?? "—"],
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: "10px", fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "3px" }}>{label}</div>
                  <div style={{ fontSize: "13px", fontWeight: 500, color: "#111827" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RESUMO EXECUTIVO */}
        <div style={{ marginBottom: "36px" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "14px" }}>Resumo Executivo</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
            {[
              { label: "Orientações no período", value: String(filtered.length), color: "#1D4ED8", bg: "#EFF6FF", border: "#BFDBFE" },
              { label: "Canais utilizados",       value: String(new Set(filtered.map(i => i.canal).filter(Boolean)).size || "—"), color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE" },
              { label: "Ações consultivas",       value: String(acoes.length), color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
            ].map(c => (
              <div key={c.label} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: "10px", padding: "18px 20px" }}>
                <div style={{ fontSize: "36px", fontWeight: 900, color: c.color, lineHeight: 1 }}>{c.value}</div>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "#6B7280", marginTop: "6px", lineHeight: 1.3 }}>{c.label}</div>
              </div>
            ))}
          </div>
          {canaisUsados !== "—" && (
            <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "8px", padding: "10px 16px", marginTop: "12px", fontSize: "12px", color: "#166534" }}>
              <span style={{ fontWeight: 700 }}>Canais:</span> {canaisUsados}
            </div>
          )}
        </div>

        {/* LINHA DOURADA */}
        <div style={{ height: "2px", background: "linear-gradient(90deg, #D4AF37, transparent)", marginBottom: "32px" }} />

        {/* ORIENTAÇÕES */}
        <div style={{ marginBottom: "36px" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px" }}>
            Orientações no Período ({filtered.length})
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "#9CA3AF", fontSize: "13px", background: "#F9FAFB", borderRadius: "8px" }}>
              Nenhuma orientação encontrada para os filtros selecionados.
            </div>
          ) : filtered.map((i, idx) => {
            const tc = TIPO_MAP[i.tipo] ?? { label: i.tipo, bg: "#F1F5F9", color: "#475569" };
            return (
              <div key={String(i.id)} style={{ background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: "10px", padding: "18px 22px", marginBottom: "12px", borderLeft: `4px solid ${tc.color}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ background: tc.bg, color: tc.color, borderRadius: "20px", padding: "3px 10px", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {tc.label}
                    </span>
                    {i.canal && (
                      <span style={{ background: "#F8FAFC", color: "#64748B", borderRadius: "20px", padding: "3px 10px", fontSize: "10px", fontWeight: 600, border: "1px solid #E2E8F0" }}>
                        {i.canal}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "11px", color: "#9CA3AF", flexShrink: 0, marginLeft: "12px" }}>
                    {fmtLong(interacaoDate(i))}
                  </div>
                </div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", marginBottom: "6px" }}>{i.assunto ?? "Sem assunto"}</div>
                {i.resumo && (
                  <div style={{ fontSize: "13px", color: "#374151", lineHeight: 1.6, marginBottom: "8px" }}>{i.resumo}</div>
                )}
                {i.proximo_passo && (
                  <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderLeft: "3px solid #F59E0B", borderRadius: "6px", padding: "8px 14px", fontSize: "12px", color: "#78350F" }}>
                    <span style={{ fontWeight: 700 }}>→ Próximo passo: </span>{i.proximo_passo}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* AÇÕES CONSULTIVAS */}
        {acoes.length > 0 && (
          <div style={{ marginBottom: "36px" }}>
            <div style={{ height: "2px", background: "linear-gradient(90deg, #D4AF37, transparent)", marginBottom: "32px" }} />
            <div style={{ fontSize: "10px", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px" }}>
              Ações Consultivas Abertas ({acoes.length})
            </div>
            {acoes.map(a => {
              const urgCfg: Record<string, { bg: string; color: string }> = {
                baixa:   { bg: "#F1F5F9", color: "#475569" },
                media:   { bg: "#FFFBEB", color: "#B45309" },
                alta:    { bg: "#FEF3C7", color: "#D97706" },
                critica: { bg: "#FEE2E2", color: "#DC2626" },
              };
              const uc = urgCfg[a.urgencia ?? "media"] ?? urgCfg.media;
              return (
                <div key={String(a.id)} style={{ background: "#FAFAFA", border: "1px solid #E5E7EB", borderRadius: "10px", padding: "16px 20px", marginBottom: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>{a.tema ?? "Sem tema"}</div>
                    <span style={{ background: uc.bg, color: uc.color, borderRadius: "20px", padding: "2px 10px", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", flexShrink: 0, marginLeft: "12px" }}>
                      {a.urgencia ?? "Média"}
                    </span>
                  </div>
                  {a.problema_identificado && (
                    <div style={{ fontSize: "12px", color: "#6B7280", marginBottom: "6px" }}>{a.problema_identificado}</div>
                  )}
                  {a.acao_recomendada && (
                    <div style={{ fontSize: "12px", color: "#1D4ED8", fontWeight: 600 }}>→ {a.acao_recomendada}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ANÁLISE CONSOLIDADA DO PERÍODO */}
        <div style={{ marginBottom: "36px" }}>
          <div style={{ height: "2px", background: "linear-gradient(90deg, #D4AF37, transparent)", marginBottom: "32px" }} />
          <div style={{ fontSize: "10px", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "14px" }}>Análise Consolidada do Período</div>
          <div style={{ background: "linear-gradient(135deg, #EFF6FF 0%, #F0FDF4 100%)", border: "1px solid #BFDBFE", borderRadius: "10px", padding: "22px 26px" }}>
            <p style={{ fontSize: "13px", color: "#1E3A5F", lineHeight: 1.9, margin: 0, fontStyle: "italic" }}>{textoNarrativo}</p>
          </div>
        </div>

        {/* RODAPÉ */}
        <div style={{ borderTop: "2px solid #E5E7EB", paddingTop: "24px", paddingBottom: "40px", marginTop: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A" }}>Freitas Consultoria Contábil e Financeira</div>
              <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "4px" }}>freitas.contabilista@gmail.com</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "11px", color: "#9CA3AF" }}>Documento gerado em {emissao}</div>
              <div style={{ fontSize: "11px", color: "#9CA3AF", marginTop: "2px" }}>Consultivo Radar · Sistema de Gestão</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ── render ────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Relatório oculto para captura */}
      <div style={{ position: "fixed", left: "-9999px", top: 0, zIndex: -1, pointerEvents: "none" }}>
        <ReportHTML />
      </div>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerar Relatório</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-1">

            {/* Período */}
            <div>
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Período</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Data início</label>
                  <input type="date" value={dateStart} max={dateEnd}
                    onChange={e => setDateStart(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Data fim</label>
                  <input type="date" value={dateEnd} min={dateStart}
                    onChange={e => setDateEnd(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>

            {/* Tipos */}
            <div>
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Tipo de orientação <span className="normal-case font-normal text-gray-400">(vazio = todos)</span>
              </Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {TIPOS_ORIENTACAO.map(t => {
                  const on = selTipos.has(t.key);
                  return (
                    <button key={t.key} onClick={() => toggleTipo(t.key)}
                      style={{ background: on ? t.bg : "#F9FAFB", color: on ? t.color : "#6B7280", border: `1.5px solid ${on ? t.color + "60" : "#E5E7EB"}` }}
                      className="px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer">
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Canais */}
            <div>
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Canal <span className="normal-case font-normal text-gray-400">(vazio = todos)</span>
              </Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {CANAIS_ALL.map(c => {
                  const on = selCanais.has(c);
                  return (
                    <button key={c} onClick={() => toggleCanal(c)}
                      style={{ background: on ? "#EFF6FF" : "#F9FAFB", color: on ? "#1D4ED8" : "#6B7280", border: `1.5px solid ${on ? "#BFDBFE" : "#E5E7EB"}` }}
                      className="px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer">
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Preview */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-800">
              <span className="font-bold">{filtered.length}</span> orientação{filtered.length !== 1 ? "ões" : ""} encontrada{filtered.length !== 1 ? "s" : ""} · período: {periodo}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={!!generating}>
              Cancelar
            </Button>
            <Button variant="outline" onClick={generateWord} disabled={!!generating}
              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">
              {generating === "word" ? <><Loader2 size={14} className="animate-spin mr-1" /> Gerando...</> : <><FileText size={14} className="mr-1" /> Gerar Word</>}
            </Button>
            <Button onClick={generatePDF} disabled={!!generating}
              style={{ background: "#1D4ED8" }} className="hover:bg-blue-800">
              {generating === "pdf" ? <><Loader2 size={14} className="animate-spin mr-1" /> Gerando...</> : <><FileDown size={14} className="mr-1" /> Gerar PDF</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
