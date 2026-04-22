import { useCallback, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { X, Upload, Download, CheckCircle2, AlertTriangle, ChevronRight } from "lucide-react";

// ── Colunas da planilha modelo ──────────────────────────────────────────────
const COLUNAS = [
  "razao_social",
  "nome_fantasia",
  "segmento",
  "uf",
  "regime_tributario",
  "porte",
  "canal_preferido",
  "frequencia_contato_dias",
  "dores_mapeadas",
  "objetivos_empresario",
  "observacoes",
] as const;

type ColName = (typeof COLUNAS)[number];
type RowData = Partial<Record<ColName, string>>;

const LINHA_EXEMPLO: Record<ColName, string> = {
  razao_social: "EXEMPLO LTDA",
  nome_fantasia: "Exemplo",
  segmento: "Comércio",
  uf: "SP",
  regime_tributario: "Simples Nacional",
  porte: "Pequena",
  canal_preferido: "WhatsApp",
  frequencia_contato_dias: "30",
  dores_mapeadas: "Custo alto de impostos",
  objetivos_empresario: "Reduzir carga tributária",
  observacoes: "Cliente preferencial",
};

const LABELS: Record<ColName, string> = {
  razao_social: "Razão Social",
  nome_fantasia: "Nome Fantasia",
  segmento: "Segmento",
  uf: "UF",
  regime_tributario: "Regime Tributário",
  porte: "Porte",
  canal_preferido: "Canal Preferido",
  frequencia_contato_dias: "Freq. Contato (dias)",
  dores_mapeadas: "Dores Mapeadas",
  objetivos_empresario: "Objetivos",
  observacoes: "Observações",
};

// ── Estilos compartilhados ──────────────────────────────────────────────────
const btn = (bg: string, color: string, border?: string): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: "7px",
  background: bg, color, border: border ?? "none",
  borderRadius: "8px", padding: "9px 16px",
  fontSize: "13px", fontWeight: 600, cursor: "pointer",
});

// ── Componente ──────────────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}

export function ImportarClientesModal({ open, onOpenChange, onSaved }: Props) {
  const [passo, setPasso] = useState<1 | 2 | 3>(1);
  const [rows, setRows] = useState<RowData[]>([]);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [resultado, setResultado] = useState<{ ok: number; erro: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPasso(1);
    setRows([]);
    setFileName("");
    setDragging(false);
    setImporting(false);
    setResultado(null);
  };

  const close = () => { reset(); onOpenChange(false); };

  // ── Download modelo CSV ──────────────────────────────────────────────────
  const baixarModelo = () => {
    const header = COLUNAS.join(",");
    const exemplo = COLUNAS.map(c => `"${LINHA_EXEMPLO[c]}"`).join(",");
    const blob = new Blob([header + "\n" + exemplo + "\n"], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "modelo_importacao_clientes.csv";
    a.click(); URL.revokeObjectURL(url);
  };

  // ── Leitura do arquivo ───────────────────────────────────────────────────
  const processarArquivo = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      const wb = XLSX.read(data, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

      // Normaliza cabeçalhos: remove espaços/BOM e converte para minúsculas com underscore
      const normalizado: RowData[] = raw.map(r => {
        const row: RowData = {};
        for (const [k, v] of Object.entries(r)) {
          const chave = k.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z_]/g, "") as ColName;
          if (COLUNAS.includes(chave)) row[chave] = String(v ?? "").trim();
        }
        return row;
      }).filter(r => r.razao_social && r.razao_social !== "EXEMPLO LTDA");

      setRows(normalizado);
      if (normalizado.length > 0) setPasso(2);
    };
    reader.readAsBinaryString(file);
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) processarArquivo(f);
    e.target.value = "";
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files?.[0]; if (f) processarArquivo(f);
  }, []);

  // ── Importação para o Supabase ───────────────────────────────────────────
  const importar = async () => {
    setImporting(true);
    let ok = 0, erro = 0;

    for (const row of rows) {
      if (!row.razao_social) { erro++; continue; }
      const payload = {
        razao_social: row.razao_social,
        nome_fantasia: row.nome_fantasia || null,
        segmento: row.segmento || null,
        uf: row.uf || null,
        regime_tributario: row.regime_tributario || null,
        porte: row.porte || null,
        canal_preferido: row.canal_preferido || null,
        frequencia_contato_dias: row.frequencia_contato_dias
          ? parseInt(row.frequencia_contato_dias, 10) || 30
          : 30,
        dores_mapeadas: row.dores_mapeadas || null,
        objetivos_empresario: row.objetivos_empresario || null,
        observacoes: row.observacoes || null,
      };
      const { error } = await supabase.from("clientes").insert(payload);
      error ? erro++ : ok++;
    }

    setResultado({ ok, erro });
    setPasso(3);
    setImporting(false);
    if (ok > 0) onSaved();
  };

  if (!open) return null;

  const previewCols: ColName[] = ["razao_social", "nome_fantasia", "segmento", "uf", "regime_tributario"];
  const preview = rows.slice(0, 5);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.45)", padding: "16px" }}>
      <div style={{ width: "100%", maxWidth: "620px", borderRadius: "14px", background: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,.2)", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e8eaed", padding: "16px 24px", flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>Importar clientes</h2>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#9ca3af" }}>
              {passo === 1 ? "Passo 1 de 3 — Baixe e preencha a planilha modelo"
               : passo === 2 ? `Passo 2 de 3 — Prévia: ${rows.length} registro${rows.length !== 1 ? "s" : ""} encontrado${rows.length !== 1 ? "s" : ""}`
               : "Passo 3 de 3 — Resultado da importação"}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {/* Steps indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              {([1, 2, 3] as const).map((s, i) => (
                <span key={s} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ width: "22px", height: "22px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, background: passo >= s ? "#1d4ed8" : "#f1f5f9", color: passo >= s ? "#fff" : "#9ca3af" }}>{s}</span>
                  {i < 2 && <ChevronRight size={12} color="#d1d5db" />}
                </span>
              ))}
            </div>
            <button onClick={close} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex" }}><X size={18} /></button>
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", padding: "24px", flex: 1 }}>

          {/* ── PASSO 1 ─────────────────────────────────────────────────── */}
          {passo === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "10px", padding: "16px 18px" }}>
                <p style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: 600, color: "#1e40af" }}>Como importar</p>
                <ol style={{ margin: 0, padding: "0 0 0 18px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  {[
                    "Baixe a planilha modelo clicando no botão abaixo.",
                    "Preencha cada linha com os dados de um cliente.",
                    "Salve como .xlsx ou .csv e faça o upload no próximo passo.",
                    "Confirme a importação na prévia.",
                  ].map((t, i) => (
                    <li key={i} style={{ fontSize: "13px", color: "#374151", lineHeight: 1.6 }}>{t}</li>
                  ))}
                </ol>
              </div>

              <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "14px 18px" }}>
                <p style={{ margin: "0 0 10px", fontSize: "12px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".05em" }}>Colunas da planilha</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {COLUNAS.map(c => (
                    <span key={c} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "3px 9px", fontSize: "11px", fontWeight: 500, color: "#374151", fontFamily: "monospace" }}>
                      {c}
                    </span>
                  ))}
                </div>
                <p style={{ margin: "10px 0 0", fontSize: "11px", color: "#9ca3af" }}>
                  Apenas <strong>razao_social</strong> é obrigatório. Linhas com razao_social = "EXEMPLO LTDA" são ignoradas.
                </p>
              </div>

              <button onClick={baixarModelo} style={{ ...btn("#f0fdf4", "#16a34a", "1px solid #bbf7d0"), alignSelf: "flex-start" }}
                onMouseEnter={e => e.currentTarget.style.background = "#dcfce7"}
                onMouseLeave={e => e.currentTarget.style.background = "#f0fdf4"}>
                <Download size={14} /> Baixar planilha modelo
              </button>

              {/* Zona de upload ainda no passo 1 */}
              <div>
                <p style={{ margin: "0 0 10px", fontSize: "13px", fontWeight: 600, color: "#374151" }}>Já tem a planilha preenchida? Faça o upload:</p>
                <DropZone dragging={dragging} setDragging={setDragging} onDrop={onDrop} fileRef={fileRef} onFileInput={onFileInput} fileName={fileName} />
              </div>
            </div>
          )}

          {/* ── PASSO 2 ─────────────────────────────────────────────────── */}
          {passo === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <p style={{ margin: 0, fontSize: "13px", color: "#374151" }}>
                  Arquivo: <strong>{fileName}</strong> — <strong>{rows.length}</strong> registro{rows.length !== 1 ? "s" : ""} válido{rows.length !== 1 ? "s" : ""}
                </p>
                <button onClick={() => { setRows([]); setFileName(""); setPasso(1); }}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "#6b7280", textDecoration: "underline" }}>
                  Trocar arquivo
                </button>
              </div>

              {/* Preview table */}
              <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: "#6b7280", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>#</th>
                      {previewCols.map(c => (
                        <th key={c} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: "#6b7280", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>{LABELS[c]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => (
                      <tr key={i} style={{ borderBottom: i < preview.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                        <td style={{ padding: "8px 10px", color: "#9ca3af" }}>{i + 1}</td>
                        {previewCols.map(c => (
                          <td key={c} style={{ padding: "8px 10px", color: "#374151", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r[c] || "—"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 5 && (
                <p style={{ margin: 0, fontSize: "11px", color: "#9ca3af", textAlign: "center" }}>
                  Mostrando 5 de {rows.length} registros. Todos serão importados.
                </p>
              )}
            </div>
          )}

          {/* ── PASSO 3 ─────────────────────────────────────────────────── */}
          {passo === 3 && resultado && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", padding: "16px 0" }}>
              {resultado.ok > 0 && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CheckCircle2 size={28} color="#16a34a" />
                  </div>
                  <p style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#16a34a" }}>{resultado.ok} importado{resultado.ok !== 1 ? "s" : ""} com sucesso</p>
                </div>
              )}
              {resultado.erro > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 16px" }}>
                  <AlertTriangle size={16} color="#dc2626" />
                  <p style={{ margin: 0, fontSize: "13px", color: "#dc2626", fontWeight: 600 }}>{resultado.erro} registro{resultado.erro !== 1 ? "s" : ""} com erro</p>
                </div>
              )}
              {resultado.ok === 0 && resultado.erro === 0 && (
                <p style={{ fontSize: "13px", color: "#6b7280" }}>Nenhum registro válido encontrado na planilha.</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", borderTop: "1px solid #e8eaed", padding: "14px 24px", flexShrink: 0 }}>
          {passo === 1 && (
            <button onClick={close} style={btn("#f1f5f9", "#374151", "1px solid #e2e8f0")}
              onMouseEnter={e => e.currentTarget.style.background = "#e2e8f0"}
              onMouseLeave={e => e.currentTarget.style.background = "#f1f5f9"}>
              Cancelar
            </button>
          )}
          {passo === 2 && (
            <>
              <button onClick={() => { setRows([]); setFileName(""); setPasso(1); }} style={btn("#f1f5f9", "#374151", "1px solid #e2e8f0")}
                onMouseEnter={e => e.currentTarget.style.background = "#e2e8f0"}
                onMouseLeave={e => e.currentTarget.style.background = "#f1f5f9"}>
                Voltar
              </button>
              <button onClick={importar} disabled={importing || rows.length === 0} style={{ ...btn("#1d4ed8", "#fff"), opacity: importing || rows.length === 0 ? 0.6 : 1 }}
                onMouseEnter={e => { if (!importing) e.currentTarget.style.background = "#1e40af"; }}
                onMouseLeave={e => { if (!importing) e.currentTarget.style.background = "#1d4ed8"; }}>
                <Upload size={14} />
                {importing ? "Importando..." : `Importar ${rows.length} cliente${rows.length !== 1 ? "s" : ""}`}
              </button>
            </>
          )}
          {passo === 3 && (
            <button onClick={close} style={btn("#1d4ed8", "#fff")}
              onMouseEnter={e => e.currentTarget.style.background = "#1e40af"}
              onMouseLeave={e => e.currentTarget.style.background = "#1d4ed8"}>
              Concluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── DropZone helper ─────────────────────────────────────────────────────────
function DropZone({ dragging, setDragging, onDrop, fileRef, onFileInput, fileName }: {
  dragging: boolean;
  setDragging: (v: boolean) => void;
  onDrop: (e: React.DragEvent) => void;
  fileRef: React.RefObject<HTMLInputElement>;
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileName: string;
}) {
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => fileRef.current?.click()}
      style={{
        border: `2px dashed ${dragging ? "#1d4ed8" : "#d1d5db"}`,
        borderRadius: "10px",
        padding: "32px 24px",
        textAlign: "center",
        cursor: "pointer",
        background: dragging ? "#eff6ff" : "#fafafa",
        transition: "all .15s",
      }}>
      <input ref={fileRef} type="file" accept=".xlsx,.csv" style={{ display: "none" }} onChange={onFileInput} />
      <Upload size={28} color={dragging ? "#1d4ed8" : "#9ca3af"} style={{ margin: "0 auto 10px" }} />
      <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: 600, color: dragging ? "#1d4ed8" : "#374151" }}>
        {fileName || "Arraste o arquivo aqui ou clique para selecionar"}
      </p>
      <p style={{ margin: 0, fontSize: "11px", color: "#9ca3af" }}>Aceita .xlsx e .csv</p>
    </div>
  );
}
