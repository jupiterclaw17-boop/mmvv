import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify the caller is authenticated and is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Não autorizado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = claimsData.claims.sub;

    // Check admin role via user_roles table
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Acesso negado." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...payload } = await req.json();

    // CREATE USER
    if (action === "create") {
      const { email, password, full_name, role, team_id, status } = payload;

      if (!email || !password || !full_name || !role) {
        return new Response(JSON.stringify({ error: "Preencha todos os campos obrigatórios." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (password.length < 8) {
        return new Response(JSON.stringify({ error: "A senha deve ter pelo menos 8 caracteres." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, role },
      });

      if (createError) {
        console.error("Error creating user:", createError);
        const safeMsg = createError.message?.includes('already') 
          ? 'Este e-mail já está cadastrado.' 
          : 'Erro ao criar usuário. Tente novamente.';
        return new Response(JSON.stringify({ error: safeMsg }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update team_id and status if provided (trigger already created profile + role)
      if (team_id || status !== "ativo") {
        const updates: Record<string, unknown> = {};
        if (team_id) updates.team_id = team_id;
        if (status) updates.status = status;

        await supabaseAdmin
          .from("users_profiles")
          .update(updates)
          .eq("id", newUser.user.id);
      }

      return new Response(JSON.stringify({ user: newUser.user }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UPDATE USER
    if (action === "update") {
      const { user_id, full_name, role, team_id, status, password } = payload;

      if (!user_id) {
        return new Response(JSON.stringify({ error: "ID do usuário é obrigatório." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update profile
      const profileUpdate: Record<string, unknown> = {};
      if (full_name !== undefined) profileUpdate.full_name = full_name;
      if (role !== undefined) profileUpdate.role = role;
      if (team_id !== undefined) profileUpdate.team_id = team_id || null;
      if (status !== undefined) profileUpdate.status = status;

      if (Object.keys(profileUpdate).length > 0) {
        const { error: profileError } = await supabaseAdmin
          .from("users_profiles")
          .update(profileUpdate)
          .eq("id", user_id);

        if (profileError) {
          console.error("Profile update error:", profileError);
          return new Response(JSON.stringify({ error: "Erro ao atualizar perfil. Tente novamente." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Update role in user_roles if changed
      if (role !== undefined) {
        await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
        const { error: roleError } = await supabaseAdmin.from("user_roles").insert({ user_id, role });
        if (roleError) {
          console.error("Role update error:", roleError);
        }
      }

      // Update password if provided
      if (password && password.length >= 8) {
        await supabaseAdmin.auth.admin.updateUserById(user_id, { password });
      }

      // Update user metadata
      if (full_name || role) {
        const { data: currentUser } = await supabaseAdmin.auth.admin.getUserById(user_id);
        const existingMeta = currentUser?.user?.user_metadata || {};
        const metadata = { ...existingMeta };
        if (full_name) metadata.full_name = full_name;
        if (role) metadata.role = role;
        const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(user_id, { user_metadata: metadata });
        if (metaError) console.error("Metadata update error:", metaError);
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE USER
    if (action === "delete") {
      const { user_id } = payload;

      if (!user_id) {
        return new Response(JSON.stringify({ error: "ID do usuário é obrigatório." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete from auth (cascade will handle users_profiles and user_roles)
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);

      if (deleteError) {
        console.error("Error deleting user:", deleteError);
        return new Response(JSON.stringify({ error: "Erro ao deletar usuário. Tente novamente." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Unhandled error:", error);
    return new Response(JSON.stringify({ error: "Ocorreu um erro inesperado. Tente novamente." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
