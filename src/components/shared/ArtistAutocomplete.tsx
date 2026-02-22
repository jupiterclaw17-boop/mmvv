/**
 * ArtistAutocomplete — Autocomplete para artistas.
 * Busca em `artists` por ILIKE, permite cadastro e edição inline.
 */
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { logAudit } from '@/services/logService';
import { useToast } from '@/hooks/use-toast';
import { AutocompleteInput, AutocompleteItem } from './AutocompleteInput';

const client = supabase as any;

interface ArtistAutocompleteProps {
  value: string | null;
  displayValue: string;
  onSelect: (id: string, name: string) => void;
  disabled?: boolean;
}

export function ArtistAutocomplete({ value, displayValue, onSelect, disabled }: ArtistAutocompleteProps) {
  const { profile } = useAuth();
  const { toast } = useToast();

  const handleSearch = useCallback(async (query: string): Promise<AutocompleteItem[]> => {
    let q = client.from('artists').select('id, name').order('name').limit(20);
    if (query) {
      q = q.ilike('name', `%${query}%`);
    }
    const { data } = await q;
    return (data || []) as AutocompleteItem[];
  }, []);

  const handleCreate = useCallback(async (name: string): Promise<AutocompleteItem | null> => {
    const { data, error } = await client
      .from('artists')
      .insert({ name, created_by: profile?.id })
      .select('id, name')
      .single();

    if (error) {
      toast({ title: error.message?.includes('duplicate') 
        ? 'Este artista já está cadastrado.' 
        : 'Ocorreu um erro inesperado. Tente novamente.', variant: 'destructive' });
      return null;
    }

    if (profile) {
      await logAudit({
        userId: profile.id,
        userName: profile.full_name,
        action: 'CREATE',
        entity: 'artist',
        entityId: data.id,
        description: `Artista '${data.name}' cadastrado.`,
      });
    }

    toast({ title: 'Artista cadastrado com sucesso.' });
    return data as AutocompleteItem;
  }, [profile, toast]);

  const handleEdit = useCallback(async (id: string, newName: string): Promise<boolean> => {
    const { error } = await client
      .from('artists')
      .update({ name: newName })
      .eq('id', id);

    if (error) {
      toast({ title: error.message?.includes('duplicate')
        ? 'Já existe um artista com este nome.'
        : 'Ocorreu um erro inesperado. Tente novamente.', variant: 'destructive' });
      return false;
    }

    if (profile) {
      await logAudit({
        userId: profile.id,
        userName: profile.full_name,
        action: 'UPDATE',
        entity: 'artist',
        entityId: id,
        description: `Artista '${newName}' atualizado.`,
      });
    }

    toast({ title: 'Artista atualizado com sucesso.' });
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
      placeholder="Digite o nome do artista..."
      disabled={disabled}
    />
  );
}
