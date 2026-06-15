// Modal para registrar nova orientação consultiva
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
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

import { TIPOS_ORIENTACAO } from "@/lib/constants";
export { TIPOS_ORIENTACAO };

const CANAIS = ["WhatsApp", "E-mail", "Telefone", "Reunião presencial", "Videochamada", "Outro"];

export function NovaOrientacaoModal({ open, onOpenChange, clienteIdPreSelected, onSaved }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [loadingIA, setLoadingIA] = useState(false);
  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [clienteId, setClienteId] = useState<string>("");
  const [tipo, setTipo] = useState("fiscal");
  const [canal, setCanal] = useState("WhatsApp");
  const [assunto, setAssunto] = useState("");
  const [resumo, setResumo] = useState("");
  const [proximoPasso, setProximoPasso] = useState("");

  const fetchClientes = async () => {
    setLoadingClientes(true);
    const { data, error } = await supabase
      .from("clientes")
      .select("id, razao_social, nome_fantasia")
      .order("razao_social", { ascending: true });
    setLoadingClientes(false);
    if (error) {
      console.error("[NovaOrientacaoModal] Erro ao buscar clientes:", error);
      return;
    }
    if (!data || data.length === 0) {
      console.warn("[NovaOrientacaoModal] Nenhum cliente retornado da tabela 'clientes'");
      return;
    }
    const opts: ClienteOpt[] = data.map((r: any) => ({
      id: r.id,
      label: r.razao_social ?? r.nome_fantasia ?? String(r.id),
    }));
    setClientes(opts);
  };

  // Carrega na montagem do componente (eager load)
  useEffect(() => { fetchClientes(); }, []);

  // Retry se o modal abrir e a lista ainda estiver vazia
  useEffect(() => {
    if (open && clientes.length === 0) fetchClientes();
    if (open && clienteIdPreSelected != null) setClienteId(String(clienteIdPreSelected));
  }, [open]);

  const handleGerarIA = async () => {
    setLoadingIA(true);
    const { data, error } = await supabase.functions.invoke("sugerir-proximo-passo", {
      body: { descricao: resumo, assunto },
    });
    setLoadingIA(false);
    if (error || !data?.sugestao) {
      toast({
        title: "Erro ao gerar sugestão",
        description: error?.message ?? "Tente novamente.",
        variant: "destructive",
      });
      return;
    }
    setProximoPasso(data.sugestao);
  };

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
    await supabase.from("activity_logs").insert({
      usuario_nome: "Tiago",
      acao: `Nova orientação: ${assunto}`,
      entidade: "interacao",
    });
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
            <Select value={clienteId} onValueChange={setClienteId} disabled={!!clienteIdPreSelected || loadingClientes}>
              <SelectTrigger>
                <SelectValue placeholder={loadingClientes ? "Carregando clientes…" : clientes.length === 0 ? "Nenhum cliente encontrado" : "Selecione o cliente…"} />
              </SelectTrigger>
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
            <div className="flex items-center justify-between">
              <Label>Próximo passo (gera ação consultiva)</Label>
              {tipo === "consultiva" && (
                <button
                  type="button"
                  onClick={handleGerarIA}
                  disabled={resumo.length < 20 || loadingIA}
                  className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Sparkles size={13} />
                  {loadingIA ? "Gerando…" : "Gerar com IA"}
                </button>
              )}
            </div>
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
