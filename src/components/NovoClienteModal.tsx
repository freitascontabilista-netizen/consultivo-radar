import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

const REGIMES   = ["MEI", "Simples Nacional", "Lucro Presumido", "Lucro Real", "Outro"];
const PORTES    = ["Micro", "Pequena", "Média", "Grande"];
const CANAIS    = ["WhatsApp", "E-mail", "Ligação", "Reunião presencial", "Videochamada"];
export const SEGMENTOS = [
  "Serviço",
  "Comércio",
  "Indústria",
  "Comércio e Serviço",
  "Comércio, Serviços e Indústria",
];

export const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA",
  "MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN",
  "RS","RO","RR","SC","SP","SE","TO",
];

export function NovoClienteModal({ open, onOpenChange, onSaved }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [segmentosList, setSegmentosList] = useState<string[]>(SEGMENTOS);
  const [regimesList, setRegimesList] = useState<string[]>(REGIMES);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("listas_config")
        .select("tipo, valor")
        .in("tipo", ["segmento", "regime_tributario"])
        .eq("ativo", true)
        .order("ordem");
      if (data && data.length > 0) {
        const segs = data.filter((d: any) => d.tipo === "segmento").map((d: any) => d.valor);
        const regs = data.filter((d: any) => d.tipo === "regime_tributario").map((d: any) => d.valor);
        if (segs.length > 0) setSegmentosList(segs);
        if (regs.length > 0) setRegimesList(regs);
      }
    })();
  }, []);
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [segmento, setSegmento] = useState("");
  const [uf, setUf] = useState("");
  const [regime, setRegime] = useState("Simples Nacional");
  const [porte, setPorte] = useState("Pequena");
  const [canal, setCanal] = useState("WhatsApp");
  const [frequencia, setFrequencia] = useState<number>(30);
  const [dores, setDores] = useState("");
  const [objetivos, setObjetivos] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const reset = () => {
    setRazaoSocial("");
    setNomeFantasia("");
    setCnpj("");
    setSegmento("");
    setUf("");
    setRegime("Simples Nacional");
    setPorte("Pequena");
    setCanal("WhatsApp");
    setFrequencia(30);
    setDores("");
    setObjetivos("");
    setObservacoes("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!razaoSocial.trim()) {
      toast({ title: "Razão Social é obrigatória", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      razao_social: razaoSocial.trim(),
      nome_fantasia: nomeFantasia.trim() || null,
      cnpj: cnpj.trim() || null,
      segmento: segmento || null,
      uf: uf || null,
      regime_tributario: regime,
      porte,
      canal_preferido: canal,
      frequencia_contato_dias: frequencia,
      dores_mapeadas: dores.trim() || null,
      objetivos_empresario: objetivos.trim() || null,
      observacoes: observacoes.trim() || null,
    };
    const { error } = await supabase.from("clientes").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar cliente", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Cliente cadastrado com sucesso" });
    reset();
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Cliente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="razao">Razão Social *</Label>
              <Input id="razao" value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} required maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fantasia">Nome Fantasia</Label>
              <Input id="fantasia" value={nomeFantasia} onChange={(e) => setNomeFantasia(e.target.value)} maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input id="cnpj" value={cnpj} onChange={(e) => setCnpj(e.target.value)} maxLength={20} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="segmento">Segmento</Label>
              <Select value={segmento} onValueChange={setSegmento}>
                <SelectTrigger id="segmento"><SelectValue placeholder="Selecione o segmento..." /></SelectTrigger>
                <SelectContent>
                  {segmentosList.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="uf">UF</Label>
              <Select value={uf} onValueChange={setUf}>
                <SelectTrigger id="uf"><SelectValue placeholder="Selecione o estado..." /></SelectTrigger>
                <SelectContent>
                  {UFS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Regime Tributário</Label>
              <Select value={regime} onValueChange={setRegime}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {regimesList.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Porte</Label>
              <Select value={porte} onValueChange={setPorte}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PORTES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Canal Preferido</Label>
              <Select value={canal} onValueChange={setCanal}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CANAIS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="freq">Frequência de Contato (dias)</Label>
              <Input
                id="freq"
                type="number"
                min={1}
                value={frequencia}
                onChange={(e) => setFrequencia(Number(e.target.value) || 0)}
              />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="dores">Dores Mapeadas</Label>
              <Textarea id="dores" value={dores} onChange={(e) => setDores(e.target.value)} rows={3} maxLength={2000} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="objetivos">Objetivos do Empresário</Label>
              <Textarea id="objetivos" value={objetivos} onChange={(e) => setObjetivos(e.target.value)} rows={3} maxLength={2000} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="observacoes">Observações / Particularidades</Label>
              <Textarea id="observacoes" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} maxLength={2000} placeholder="Ex.: Cliente antigo, prefere contato por WhatsApp..." />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar Cliente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
