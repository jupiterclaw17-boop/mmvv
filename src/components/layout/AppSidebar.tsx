import { Music, Calendar, Users2, UserCog, FileText, LogOut, PanelLeftClose, PanelLeft } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth, UserRole } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  { title: 'Multitracks', url: '/multitracks', icon: Music, roles: ['ministro_guia', 'dm', 'admin'] },
  { title: 'Escalas', url: '/escalas', icon: Calendar, roles: ['ministro_guia', 'dm', 'admin'] },
  { title: 'Equipes', url: '/equipes', icon: Users2, roles: ['ministro_guia', 'dm', 'admin'] },
  { title: 'Usuários', url: '/usuarios', icon: UserCog, roles: ['admin'] },
  { title: 'Logs', url: '/logs', icon: FileText, roles: ['admin'] },
];

export function AppSidebar() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const sidebar = useSidebar();
  const collapsed = sidebar.state === 'collapsed';

  const visibleItems = navItems.filter(
    (item) => profile && item.roles.includes(profile.role)
  );

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const roleLabels: Record<UserRole, string> = {
    ministro_guia: 'Ministro Guia',
    dm: 'DM',
    admin: 'Admin',
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <Music className="h-5 w-5 shrink-0 text-primary" />
        {!collapsed && <span className="text-sm font-semibold truncate">Multitracks & Escalas</span>}
        <button
          onClick={sidebar.toggleSidebar}
          className="ml-auto hidden lg:flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent"
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      activeClassName="bg-accent text-foreground"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-3">
        {profile && (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {profile.full_name.charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{profile.full_name}</p>
                <p className="text-xs text-muted-foreground">{roleLabels[profile.role]}</p>
              </div>
            )}
            <button
              onClick={handleSignOut}
              className="ml-auto shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
