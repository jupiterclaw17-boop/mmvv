import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logAudit, logError } from '@/services/logService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { TEAM_STATUS_OPTIONS } from '@/utils/constants';
import { ArrowLeft } from 'lucide-react';

const client = supabase as any;

interface MinistroOption {
  id: string;
  full_name: string;
}

const EquipeForm = () => {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [worshipLeaderId, setWorshipLeaderId] = useState('');
  const [status, setStatus] = useState('ativa');
  const [notes, setNotes] = useState('');
  const [ministros, setMinistros] = useState<MinistroOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(isEdit);

  useEffect(() => {
    const fetchMinistros = async () => {
      const { data } = await client
        .from('users_profiles')
        .select('id, full_name')
        .eq('role', 'ministro_guia')
        .eq('status', 'ativo')
        .order('full_name');
      if (data) setMinistros(data);
    };
    fetchMinistros();

    if (isEdit) {
      const fetchTeam = async () => {
        const { data } = await client
          .from('teams')
          .select('*')
          .eq('id', id)
          .single();
        if (data) {
          setName(data.name);
          setWorshipLeaderId(data.worship_leader_id);
          setStatus(data.status);
          setNotes(data.notes || '');
        }
        setLoadingData(false);
      };
      fetchTeam();
    }
  }, [id, isEdit]);

  const validate = (): string | null => {
    if (!name.trim()) return 'Preencha todos os campos obrigatórios.';
    if (!worshipLeaderId) return 'Preencha todos os campos obrigatórios.';
    if (!status) return 'Preencha todos os campos obrigatórios.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validate();
    if (error) {
      toast({ title: error, variant: 'destructive' });
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: name.trim(),
        worship_leader_id: worshipLeaderId,
        status,
        notes: notes.trim() || null,
      };

      if (isEdit) {
        const { error: updateError } = await client
          .from('teams')
          .update(payload)
          .eq('id', id);

        if (updateError) throw updateError;

        await logAudit({
          userId: profile!.id,
          userName: profile!.full_name,
          action: 'UPDATE',
          entity: 'team',
          entityId: id,
          description: `Equipe '${name.trim()}' editada.`,
        });

        toast({ title: 'Equipe atualizada com sucesso.' });
      } else {
        const { data: inserted, error: insertError } = await client
          .from('teams')
          .insert(payload)
          .select('id')
          .single();

        if (insertError) throw insertError;

        await logAudit({
          userId: profile!.id,
          userName: profile!.full_name,
          action: 'CREATE',
          entity: 'team',
          entityId: inserted?.id,
          description: `Equipe '${name.trim()}' cadastrada.`,
        });

        toast({ title: 'Equipe cadastrada com sucesso.' });
      }

      navigate('/equipes');
    } catch (e: any) {
      const msg = e.message || 'Ocorreu um erro inesperado. Tente novamente.';
      toast({ title: msg, variant: 'destructive' });

      await logError({
        userId: profile?.id,
        userName: profile?.full_name,
        description: `Erro ao salvar registro em teams: ${msg}`,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/equipes')} className="rounded p-1.5 hover:bg-accent transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? 'Editar Equipe' : 'Nova Equipe'}</h1>
          <p className="text-sm text-muted-foreground">
            {isEdit ? 'Atualize os dados da equipe.' : 'Preencha os dados para cadastrar uma nova equipe.'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-card p-6">
        <div className="space-y-2">
          <Label htmlFor="name">Nome *</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
        </div>

        <div className="space-y-2">
          <Label>Ministro Guia *</Label>
          <Select value={worshipLeaderId} onValueChange={setWorshipLeaderId}>
            <SelectTrigger><SelectValue placeholder="Selecione um ministro guia" /></SelectTrigger>
            <SelectContent>
              {ministros.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Status *</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TEAM_STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Observações</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={3} />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={() => navigate('/equipes')}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Cadastrar Equipe'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default EquipeForm;
