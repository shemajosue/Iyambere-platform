import { useEffect } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth, type Role } from '../auth';
import { colors, radius, spacing, tint, WIDE_BREAKPOINT } from '../theme';

type NavItem = { href: string; icon: string; label: string };

/** What each role can reach. The rail, the top links and the bottom tabs all read from this. */
const NAV: Record<Role, NavItem[]> = {
  citizen: [
    { href: '/citizen', icon: 'home-outline', label: 'My reports' },
    { href: '/citizen/report', icon: 'add-circle-outline', label: 'Report a leak' },
  ],
  technician: [
    { href: '/technician', icon: 'construct-outline', label: 'My jobs' },
    { href: '/technician/registry', icon: 'git-network-outline', label: 'Pipe registry' },
  ],
  supervisor: [
    { href: '/ops', icon: 'grid-outline', label: 'Overview' },
    { href: '/ops/map', icon: 'map-outline', label: 'Leak map' },
    { href: '/ops/pipes', icon: 'git-network-outline', label: 'Registry' },
    { href: '/ops/pressure', icon: 'pulse-outline', label: 'Pressure' },
    { href: '/admin', icon: 'people-outline', label: 'Admin panel' },
  ],
};

export function useIsWide() {
  const { width } = useWindowDimensions();
  return width >= WIDE_BREAKPOINT;
}

export default function AppShell({
  title, subtitle, actions, back = false, children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  back?: boolean;
  children: React.ReactNode;
}) {
  const isWide = useIsWide();
  const { user, loading } = useAuth();
  const pathname = usePathname();

  // Signing out — or a session expiring — must clear the screen, not just the
  // navigation. Every screen renders through AppShell, so guarding here means
  // no page can be left showing the previous user's data.
  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user]);

  if (!user) return <View style={styles.root} />;

  const items = NAV[user.role];

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.frame}>
        {isWide && <IconRail items={items} pathname={pathname} />}

        <View style={styles.main}>
          <TopBar items={items} pathname={pathname} isWide={isWide} back={back} />

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingHorizontal: isWide ? spacing.xl : spacing.md },
            ]}
          >
            <View style={styles.content}>
              <View style={[styles.pageHead, !isWide && { flexDirection: 'column' }]}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.pageTitle}>{title}</Text>
                  {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
                </View>
                {actions ? <View style={styles.pageActions}>{actions}</View> : null}
              </View>

              {children}
            </View>
          </ScrollView>

          {!isWide && items.length > 1 && <BottomTabs items={items} pathname={pathname} />}
        </View>
      </View>
    </SafeAreaView>
  );
}

/** The narrow icon column. Identity at the top, navigation below, sign-out at the foot. */
function IconRail({ items, pathname }: { items: NavItem[]; pathname: string }) {
  const { signOut } = useAuth();

  return (
    <View style={styles.rail}>
      <View style={styles.mark}>
        <Ionicons name="water" size={18} color={colors.bg} />
      </View>

      <View style={styles.railItems}>
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Pressable
              key={item.href}
              onPress={() => router.push(item.href as any)}
              style={({ pressed }) => [
                styles.railButton,
                active && styles.railButtonActive,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons
                name={item.icon as any}
                size={19}
                color={active ? colors.accent : colors.textMuted}
              />
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={signOut}
        style={({ pressed }) => [styles.railButton, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name="log-out-outline" size={19} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

function TopBar({
  items, pathname, isWide, back,
}: { items: NavItem[]; pathname: string; isWide: boolean; back: boolean }) {
  const { user, signOut } = useAuth();

  return (
    <View style={styles.topBar}>
      <View style={styles.topLeft}>
        {back && (
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="chevron-back" size={18} color={colors.textDim} />
          </Pressable>
        )}
        {!isWide && !back && (
          <View style={styles.markSmall}>
            <Ionicons name="water" size={14} color={colors.bg} />
          </View>
        )}
        <Text style={styles.wordmark}>Iyambere</Text>
      </View>

      {isWide && (
        <View style={styles.topNav}>
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <Pressable key={item.href} onPress={() => router.push(item.href as any)}>
                <Text style={[styles.topNavLink, active && { color: colors.text }]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Pressable
        onPress={isWide ? undefined : signOut}
        style={styles.identity}
      >
        {isWide && (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.identityName}>{user?.full_name}</Text>
            <Text style={styles.identityRole}>
              {user?.district ? `${user.district} · ` : ''}
              {roleLabel(user?.role)}
            </Text>
          </View>
        )}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(user?.full_name)}</Text>
        </View>
      </Pressable>
    </View>
  );
}

function BottomTabs({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <View style={styles.bottomBar}>
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Pressable
            key={item.href}
            onPress={() => router.push(item.href as any)}
            style={styles.bottomTab}
          >
            <Ionicons
              name={item.icon as any}
              size={20}
              color={active ? colors.accent : colors.textMuted}
            />
            <Text style={[styles.bottomLabel, active && { color: colors.accent }]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function initials(name?: string | null) {
  if (!name) return '··';
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function roleLabel(role?: Role) {
  if (role === 'supervisor') return 'WASAC operations';
  if (role === 'technician') return 'Field technician';
  return 'Citizen';
}

const RAIL_WIDTH = 60;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  frame: { flex: 1, flexDirection: 'row' },

  // --- rail ---
  rail: {
    width: RAIL_WIDTH,
    borderRightWidth: 1,
    borderRightColor: colors.borderSoft,
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.lg,
  },
  mark: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markSmall: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railItems: { flex: 1, gap: spacing.xs, alignItems: 'center' },
  railButton: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railButtonActive: { backgroundColor: tint(colors.accent, 0.12) },

  // --- top bar ---
  main: { flex: 1 },
  topBar: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  wordmark: { color: colors.text, fontSize: 14, fontWeight: '600', letterSpacing: -0.2 },

  topNav: { flexDirection: 'row', gap: spacing.lg },
  topNavLink: { color: colors.textMuted, fontSize: 13.5, fontWeight: '500' },

  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  identityName: { color: colors.text, fontSize: 13, fontWeight: '600' },
  identityRole: { color: colors.textMuted, fontSize: 11 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.textDim, fontSize: 11, fontWeight: '700' },

  // --- page ---
  scroll: { flex: 1 },
  scrollContent: { paddingVertical: spacing.lg, alignItems: 'center', paddingBottom: spacing.xxl },
  content: { width: '100%', maxWidth: 1180, gap: spacing.md },
  pageHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  pageTitle: { fontSize: 32, fontWeight: '700', color: colors.text, letterSpacing: -0.8 },
  pageSubtitle: { fontSize: 13.5, color: colors.textMuted, lineHeight: 20, maxWidth: 620 },
  pageActions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },

  // --- bottom tabs ---
  bottomBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
  },
  bottomTab: { flex: 1, alignItems: 'center', gap: 3 },
  bottomLabel: { fontSize: 10.5, fontWeight: '600', color: colors.textMuted },
});
