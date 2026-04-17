import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string | number;
  onSaved?: () => void;
}

export function RegistrarOrientacaoModal({ open, onOpenChange, clienteId, onSaved }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [tipo, setTipo] = useState("consultiva");
  const [canal, setCanal] = useState("WhatsApp");
  const [assunto, setAssunto] = useState("");
  const [resumo, setResumo] = useState("");
  const [proximoPasso, setProximoPasso] = useState("");

  const reset = () => {
    setTipo("consultiva");
    setCanal("WhatsApp");
    setAssunto("");
    setResumo("");
    setProximoPasso("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assunto.trim()) {
      toast({ title: "Assunto obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);

    const { error } = await supabase.from("interacoes").insert({
      cliente_id: clienteId,
      tipo,
      canal,
      assunto,
      resumo,
      proximo_passo: proximoPasso || null,
      data_interacao: new Date().toISOString(),
    });

    if (error) {
      setSaving(false);
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }

    if (tipo === "consultiva" && proximoPasso.trim()) {
      const { error: acaoError } = await supabase.from("acoes_consultivas").insert({
        cliente_id: clienteId,
        tema: assunto,
        problema_identificado: resumo || assunto,
        acao_recomendada: proximoPasso,
        status: "aberta",
        urgencia: "media",
      });

      if (acaoError) {
        setSaving(false);
        toast({ title: "Erro ao criar ação consultiva", description: acaoError.message, variant: "destructive" });
        return;
      }
    }

    setSaving(false);
    toast({ title: "Orientação registrada com sucesso" });
    reset();
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar orientação</DialogTitle>
          <DialogDescription>Cadastre uma nova interação consultiva com o cliente.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tipo">Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger id="tipo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultiva">Consultiva</SelectItem>
                  <SelectItem value="suporte">Suporte</SelectItem>
                  <SelectItem value="relacionamento">Relacionamento</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="canal">Canal</Label>
              <Select value={canal} onValueChange={setCanal}>
                <SelectTrigger id="canal"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                  <SelectItem value="E-mail">E-mail</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="assunto">Assunto</Label>
            <Input id="assunto" value={assunto} onChange={(e) => setAssunto(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="resumo">Resumo</Label>
            <Textarea id="resumo" rows={3} value={resumo} onChange={(e) => setResumo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proximo">Próximo passo</Label>
            <Textarea id="proximo" rows={2} value={proximoPasso} onChange={(e) => setProximoPasso(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
