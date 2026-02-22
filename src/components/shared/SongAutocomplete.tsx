/**
 * SongAutocomplete — Autocomplete para músicas.
 * Busca em `songs` filtrado por artist_id, permite cadastro e edição inline.
 * Só é habilitado quando um artista está selecionado.
 */
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { logAudit } from '@/services/logService';
import { useToast } from '@/hooks/use-toast';
import { AutocompleteInput, AutocompleteItem } from './AutocompleteInput';

const client = supabase as any;

interface SongAutocompleteProps {
  value: string | null;
  displayValue: string;
  onSelect: (id: string, name: string) => void;
  artistId: string | null;
  disabled?: boolean;
}

export function SongAutocomplete({ value, displayValue, onSelect, artistId, disabled }: SongAutocompleteProps) {
  const { profile } = useAuth();
  const { toast } = useToast();

  const isDisabled = disabled || !artistId;

  const handleSearch = useCallback(async (query: string): Promise<AutocompleteItem[]> => {
    if (!artistId) return [];

    let q = client
      .from('songs')
      .select('id, name')
      .eq('artist_id', artistId)
      .order('name')
      .limit(20);

    if (query) {
      q = q.ilike('name', `%${query}%`);
    }

    const { data } = await q;
    return (data || []) as AutocompleteItem[];
  }, [artistId]);

  const handleCreate = useCallback(async (name: string): Promise<AutocompleteItem | null> => {
    if (!artistId) return null;

    const { data, error } = await client
      .from('songs')
      .insert({ name, artist_id: artistId, created_by: profile?.id })
      .select('id, name')
      .single();

    if (error) {
      toast({ title: error.message?.includes('duplicate')
        ? 'Esta música já está cadastrada para este artista.'
        : 'Ocorreu um erro inesperado. Tente novamente.', variant: 'destructive' });
      return null;
    }

    if (profile) {
      await logAudit({
        userId: profile.id,
        userName: profile.full_name,
        action: 'CREATE',
        entity: 'song',
        entityId: data.id,
        description: `Música '${data.name}' cadastrada.`,
      });
    }

    toast({ title: 'Música cadastrada com sucesso.' });
    return data as AutocompleteItem;
  }, [artistId, profile, toast]);

  const handleEdit = useCallback(async (id: string, newName: string): Promise<boolean> => {
    const { error } = await client
      .from('songs')
      .update({ name: newName })
      .eq('id', id);

    if (error) {
      toast({ title: error.message?.includes('duplicate')
        ? 'Já existe uma música com este nome para este artista.'
        : 'Ocorreu um erro inesperado. Tente novamente.', variant: 'destructive' });
      return false;
    }

    if (profile) {
      await logAudit({
        userId: profile.id,
        userName: profile.full_name,
        action: 'UPDATE',
        entity: 'song',
        entityId: id,
        description: `Música '${newName}' atualizada.`,
      });
    }

    toast({ title: 'Música atualizada com sucesso.' });
    return true;
  }, [profile, toast]);

  return (
    <AutocompleteInput
      value={value}
      displayValue={displayValue}
      onSelect={onSelect}
      onSearch={handleSearch}
      onCreate={handleCreate}
      onEdit={handleEdit}
      placeholder={artistId ? 'Digite o nome da música...' : 'Selecione um artista primeiro'}
      disabled={isDisabled}
    />
  );
}
