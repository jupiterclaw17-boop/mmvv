/**
 * SongAutocompleteGlobal — Autocomplete para músicas usado no módulo Escalas.
 * Busca em todas as `songs` (sem filtro por artista), exibe "Música - Artista".
 * Ao cadastrar nova, abre mini-formulário inline para selecionar artista.
 */
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { logAudit } from '@/services/logService';
import { useToast } from '@/hooks/use-toast';
import { AutocompleteInput, AutocompleteItem } from './AutocompleteInput';
import { ArtistAutocomplete } from './ArtistAutocomplete';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const client = supabase as any;

interface SongWithArtist {
  id: string;
  name: string;
  artist_id: string;
  artist_name: string;
  has_multitrack: boolean;
}

interface SongAutocompleteGlobalProps {
  value: string | null;
  displayValue: string;
  onSelect: (song: SongWithArtist) => void;
  disabled?: boolean;
}

export function SongAutocompleteGlobal({ value, displayValue, onSelect, disabled }: SongAutocompleteGlobalProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSongName, setNewSongName] = useState('');
  const [newArtistId, setNewArtistId] = useState<string | null>(null);
  const [newArtistName, setNewArtistName] = useState('');
  const [creatingInline, setCreatingInline] = useState(false);

  const handleSearch = useCallback(async (query: string): Promise<AutocompleteItem[]> => {
    let q = client
      .from('songs')
      .select('id, name, artist_id, artists:artist_id(name)')
      .order('name')
      .limit(20);

    if (query) {
      q = q.ilike('name', `%${query}%`);
    }

    const { data } = await q;
    return (data || []).map((s: any) => ({
      id: s.id,
      name: `${s.name} — ${s.artists?.name || ''}`,
    }));
  }, []);

  const handleCreate = useCallback(async (name: string): Promise<AutocompleteItem | null> => {
    // Instead of creating directly, show the inline form
    setNewSongName(name);
    setShowCreateForm(true);
    return null; // Don't auto-select yet
  }, []);

  const handleInlineCreate = async () => {
    if (!newArtistId || !newSongName.trim()) return;
    setCreatingInline(true);

    const songName = newSongName.trim().toUpperCase();

    const { data, error } = await client
      .from('songs')
      .insert({ name: songName, artist_id: newArtistId, created_by: profile?.id })
      .select('id, name, artist_id')
      .single();

    if (error) {
      toast({ title: error.message?.includes('duplicate')
        ? 'Esta música já está cadastrada para este artista.'
        : 'Ocorreu um erro inesperado. Tente novamente.', variant: 'destructive' });
      setCreatingInline(false);
      return;
    }

    // Check if has multitrack
    const { data: mt } = await client
      .from('multitracks')
      .select('id')
      .eq('song_id', data.id)
      .limit(1);

    if (profile) {
      await logAudit({
        userId: profile.id,
        userName: profile.full_name,
        action: 'CREATE',
        entity: 'song',
        entityId: data.id,
        description: `Música '${songName}' cadastrada.`,
      });
    }

    toast({ title: 'Música cadastrada com sucesso.' });

    onSelect({
      id: data.id,
      name: songName,
      artist_id: newArtistId,
      artist_name: newArtistName,
      has_multitrack: (mt && mt.length > 0) || false,
    });

    setShowCreateForm(false);
    setNewSongName('');
    setNewArtistId(null);
    setNewArtistName('');
    setCreatingInline(false);
  };

  const handleSelect = useCallback(async (id: string, displayName: string) => {
    // Fetch full song data
    const { data } = await client
      .from('songs')
      .select('id, name, artist_id, artists:artist_id(name)')
      .eq('id', id)
      .single();

    if (!data) return;

    const { data: mt } = await client
      .from('multitracks')
      .select('id')
      .eq('song_id', id)
      .limit(1);

    onSelect({
      id: data.id,
      name: data.name,
      artist_id: data.artist_id,
      artist_name: data.artists?.name || '',
      has_multitrack: (mt && mt.length > 0) || false,
    });
  }, [onSelect]);

  if (showCreateForm) {
    return (
      <div className="space-y-3 rounded-md border border-border bg-muted/50 p-3">
        <p className="text-sm font-medium">Cadastrar nova música</p>
        <div className="space-y-2">
          <Label className="text-xs">Nome da Música</Label>
          <Input
            value={newSongName}
            onChange={(e) => setNewSongName(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Artista *</Label>
          <ArtistAutocomplete
            value={newArtistId}
            displayValue={newArtistName}
            onSelect={(id, name) => { setNewArtistId(id); setNewArtistName(name); }}
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleInlineCreate}
            disabled={!newArtistId || !newSongName.trim() || creatingInline}
          >
            {creatingInline ? 'Salvando...' : 'Confirmar'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => { setShowCreateForm(false); setNewSongName(''); setNewArtistId(null); setNewArtistName(''); }}
          >
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AutocompleteInput
      value={value}
      displayValue={displayValue}
      onSelect={handleSelect}
      onSearch={handleSearch}
      onCreate={handleCreate}
      placeholder="Digite o nome da música..."
      disabled={disabled}
    />
  );
}
