/**
 * AutocompleteInput — Componente reutilizável de autocomplete.
 *
 * Funcionalidades:
 * - Busca por texto com debounce
 * - Ícone de lápis para edição inline do nome de cada opção
 * - Opção "+ Cadastrar" quando nenhum resultado é encontrado
 * - Normalização para MAIÚSCULAS ao criar/editar
 *
 * Props:
 * @param value - ID do item selecionado
 * @param displayValue - Texto exibido no input quando um item está selecionado
 * @param onSelect - Callback ao selecionar um item (id, name)
 * @param onSearch - Função de busca que retorna itens [{id, name}]
 * @param onCreate - Função para criar novo item, retorna {id, name}
 * @param onEdit - Função para editar item existente (id, newName)
 * @param placeholder - Placeholder do input
 * @param disabled - Desabilitar o componente
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Pencil, Check, X, Plus, Loader2 } from 'lucide-react';

export interface AutocompleteItem {
  id: string;
  name: string;
}

interface AutocompleteInputProps {
  value: string | null;
  displayValue: string;
  onSelect: (id: string, name: string) => void;
  onSearch: (query: string) => Promise<AutocompleteItem[]>;
  onCreate: (name: string) => Promise<AutocompleteItem | null>;
  onEdit?: (id: string, newName: string) => Promise<boolean>;
  placeholder?: string;
  disabled?: boolean;
}

export function AutocompleteInput({
  value,
  displayValue,
  onSelect,
  onSearch,
  onCreate,
  onEdit,
  placeholder = 'Digite para buscar...',
  disabled = false,
}: AutocompleteInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<AutocompleteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setEditingId(null);
        // Reset input to display value if nothing new selected
        if (value) {
          setInputValue('');
        }
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [value]);

  const doSearch = useCallback(
    async (query: string) => {
      if (query.trim().length === 0) {
        // Show all when empty
        setLoading(true);
        const items = await onSearch('');
        setResults(items);
        setLoading(false);
        return;
      }
      setLoading(true);
      const items = await onSearch(query.trim());
      setResults(items);
      setLoading(false);
    },
    [onSearch]
  );

  const handleInputChange = (val: string) => {
    setInputValue(val);
    setIsOpen(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(val);
    }, 250);
  };

  const handleFocus = () => {
    setIsOpen(true);
    doSearch(inputValue);
  };

  const handleSelect = (item: AutocompleteItem) => {
    onSelect(item.id, item.name);
    setInputValue('');
    setIsOpen(false);
    setEditingId(null);
  };

  const handleCreate = async () => {
    const name = inputValue.trim().toUpperCase();
    if (!name) return;
    setCreating(true);
    const created = await onCreate(name);
    setCreating(false);
    if (created) {
      handleSelect(created);
    }
  };

  const handleEditStart = (e: React.MouseEvent, item: AutocompleteItem) => {
    e.stopPropagation();
    setEditingId(item.id);
    setEditName(item.name);
  };

  const handleEditSave = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!onEdit) return;
    const newName = editName.trim().toUpperCase();
    if (!newName) return;

    const success = await onEdit(id, newName);
    if (success) {
      setEditingId(null);
      // Refresh results
      doSearch(inputValue);
      // If this is the currently selected item, update display
      if (value === id) {
        onSelect(id, newName);
      }
    }
  };

  const handleEditCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const showCreateOption =
    inputValue.trim().length > 0 &&
    !loading &&
    !results.some((r) => r.name === inputValue.trim().toUpperCase());

  const display = value ? displayValue : '';

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        value={isOpen ? inputValue : display}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={handleFocus}
        placeholder={disabled ? '' : placeholder}
        disabled={disabled}
        className={disabled ? 'opacity-50' : ''}
      />

      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-60 overflow-auto">
          {loading && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Buscando...
            </div>
          )}

          {!loading && results.length === 0 && !showCreateOption && (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Nenhum resultado encontrado.
            </div>
          )}

          {results.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent cursor-pointer group"
              onClick={() => {
                if (editingId !== item.id) handleSelect(item);
              }}
            >
              {editingId === item.id ? (
                <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-7 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleEditSave(e as any, item.id);
                      }
                      if (e.key === 'Escape') {
                        setEditingId(null);
                      }
                    }}
                  />
                  <button
                    onClick={(e) => handleEditSave(e, item.id)}
                    className="rounded p-1 text-success hover:bg-success/10"
                    title="Salvar"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={handleEditCancel}
                    className="rounded p-1 text-destructive hover:bg-destructive/10"
                    title="Cancelar"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="flex-1 truncate">{item.name}</span>
                  {onEdit && (
                    <button
                      onClick={(e) => handleEditStart(e, item)}
                      className="rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity"
                      title="Editar nome"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </>
              )}
            </div>
          ))}

          {showCreateOption && (
            <div
              className="flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-accent cursor-pointer border-t border-border"
              onClick={handleCreate}
            >
              {creating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              <span>
                Cadastrar "<strong>{inputValue.trim().toUpperCase()}</strong>"
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
