import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface ClienteOpt { id: string | number; label: string; }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteIdPreSelected?: string | number | null;
  onSaved?: () => void;
}

export const TIPOS_ORIENTACAO = [
  { key: "fiscal",        label: "Fiscal / Tributário",           color: "#1d4ed8", bg: "#eff6ff"  },
  { key: "trabalhista",   label: "Trabalhista / Dep. Pessoal",    color: "#7c3aed", bg: "#f5f3ff"  },
  { key: "contabil",      label: "Contábil / Financeiro",         color: "#0891b2", bg: "#ecfeff"  },
  { key: "societario",    label: "Societário / Legalização",      color: "#b45309", bg: "#fffbeb"  },
  { key: "planejamento",  label: "Planejamento Tributário",       color: "#16a34a", bg: "#f0fdf4"  },
  { key: "consultiva",    label: "Consultiva",                    color: "#16a34a", bg: "#dcfce7"  },
  { key: "suporte",       label: "Suporte",                       color: "#475569", bg: "#f1f5f9"  },
  { key: "relacionamento",label: "Relacionamento",                color: "#1d4ed8", bg: "#dbeafe"  },
  { key: "comercial",     label: "Comercial",                     color: "#7e22ce", bg: "#f3e8ff"  },
];

const CANAIS = ["WhatsApp", "E-mail", "Telefone", "Reunião presencial", "Videochamada", "Outro"];

export function NovaOrientacaoModal({ open, onOpenChange, clienteIdPreSelected, onSaved }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [clienteId, setClienteId] = useState<string>("");
  const [tipo, setTipo] = useState("fiscal");
  const [canal, setCanal] = useState("WhatsApp");
  const [assunto, setAssunto] = useState("");
  const [resumo, setResumo] = useState("");
  const [proximoPasso, setProximoPasso] = useState("");

  useEffect(() => {
    if (!open) return;
    supabase
      .from("radar_consultivo")
      .select("id,cliente_id,razao_social,nome_fantasia")
      .order("razao_social")
      .then(({ data }) => {
        const opts = (data ?? []).map((r: any) => ({
          id: r.cliente_id ?? r.id,
          label: r.razao_social ?? r.nome_fantasia ?? String(r.cliente_id ?? r.id),
        }));
        setClientes(opts);
        if (clienteIdPreSelected != null) {
          setClienteId(String(clienteIdPreSelected));
        } else if (opts.length > 0 && !clienteId) {
          setClienteId(String(opts[0].id));
        }
      });
  }, [open]);

  const reset = () => {
    setTipo("fiscal");
    setCanal("WhatsApp");
    setAssunto("");
    setResumo("");
    setProximoPasso("");
    if (!clienteIdPreSelected) setClienteId("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assunto.trim()) {
      toast({ title: "Assunto obrigatório", variant: "destructive" });
      return;
    }
    if (!clienteId) {
      toast({ title: "Selecione um cliente", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("interacoes").insert({
      cliente_id: clienteId,
      tipo,
      canal,
      assunto,
      resumo: resumo || null,
      proximo_passo: proximoPasso || null,
      data_interacao: new Date().toISOString(),
    });
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }
    if (proximoPasso.trim()) {
      await supabase.from("acoes_consultivas").insert({
        cliente_id: clienteId,
        tema: assunto,
        problema_identificado: resumo || assunto,
        acao_recomendada: proximoPasso,
        status: "aberta",
        urgencia: "media",
      });
    }
    toast({ title: "Orientação registrada com sucesso!" });
    reset();
    onOpenChange(false);
    onSaved?.();
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova orientação</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Select value={clienteId} onValueChange={setClienteId} disabled={!!clienteIdPreSelected}>
              <SelectTrigger><SelectValue placeholder="Selecione o cliente…" /></SelectTrigger>
              <SelectContent>
                {clientes.map(c => (
                  <SelectItem key={String(c.id)} value={String(c.id)}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo de orientação</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_ORIENTACAO.slice(0, 5).map(t => (
                    <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                  ))}
                  <SelectItem value="consultiva">Consultiva (geral)</SelectItem>
                  <SelectItem value="suporte">Suporte</SelectItem>
                  <SelectItem value="relacionamento">Relacionamento</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Canal</Label>
              <Select value={canal} onValueChange={setCanal}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CANAIS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Assunto <span className="text-red-500">*</span></Label>
            <Input value={assunto} onChange={e => setAssunto(e.target.value)} placeholder="Ex.: Orientação sobre pró-labore e INSS" required />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição / resumo</Label>
            <Textarea rows={3} value={resumo} onChange={e => setResumo(e.target.value)} placeholder="Descreva o que foi orientado…" />
          </div>
          <div className="space-y-1.5">
            <Label>Próximo passo (gera ação consultiva)</Label>
            <Textarea rows={2} value={proximoPasso} onChange={e => setProximoPasso(e.target.value)} placeholder="Ex.: Enviar planilha de simulação até sexta-feira" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Registrar orientação"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
