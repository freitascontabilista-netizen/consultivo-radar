import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

export function UserMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignOut = async () => {
    await signOut();
    toast({ title: "Sessão encerrada" });
    navigate("/auth", { replace: true });
  };

  if (!user) return null;

  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-xs text-muted-foreground sm:inline">{user.email}</span>
      <Button size="sm" variant="outline" onClick={handleSignOut} className="gap-1.5">
        <LogOut className="h-3.5 w-3.5" />
        Sair
      </Button>
    </div>
  );
}
