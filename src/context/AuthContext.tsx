/**
 * AuthContext — Gerencia sessão, perfil do usuário e permissões.
 * O perfil é buscado de `users_profiles` após login.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'ministro_guia' | 'dm' | 'admin';

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  team_id: string | null;
  status: 'ativo' | 'inativo';
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  canWrite: (entity: 'multitrack' | 'service' | 'team' | 'user' | 'artist' | 'song' | 'log') => boolean;
  canDelete: (entity: 'multitrack' | 'service' | 'team' | 'user') => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    // Cast needed until users_profiles table is created and types regenerated
    const client = supabase as any;
    const { data, error } = await client
      .from('users_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error || !data) return null;
    return data as UserProfile;
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Use setTimeout to avoid potential deadlocks with Supabase client
          setTimeout(async () => {
            const p = await fetchProfile(newSession.user.id);
            setProfile(p);
            setLoading(false);
          }, 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id).then(p => {
          setProfile(p);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: 'E-mail ou senha inválidos.' };

    const p = await fetchProfile(data.user.id);
    if (!p || p.status === 'inativo') {
      await supabase.auth.signOut();
      return { error: 'Usuário inativo. Entre em contato com o administrador.' };
    }

    setProfile(p);
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const canWrite = (entity: string): boolean => {
    if (!profile) return false;
    const role = profile.role;
    if (role === 'admin') return true;
    if (role === 'dm') return ['multitrack', 'service', 'artist', 'song'].includes(entity);
    return false;
  };

  const canDelete = (entity: string): boolean => {
    if (!profile) return false;
    const role = profile.role;
    if (role === 'admin') return true;
    if (role === 'dm') return ['multitrack'].includes(entity);
    return false;
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signIn, signOut, canWrite, canDelete }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
