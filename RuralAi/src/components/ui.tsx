/**
 * Shared lightweight UI atoms used across screens.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

/* ─── Loading Spinner ─── */

export function LoadingView({ message = 'Loading…' }: { message?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingText}>{message}</Text>
    </View>
  );
}

/* ─── Error + Retry ─── */

export function ErrorView({
  message = 'Something went wrong',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.center}>
      <Ionicons name="cloud-offline-outline" size={36} color={colors.muted} />
      <Text style={styles.errorText}>{message}</Text>
      {onRetry && (
        <Pressable style={styles.retryBtn} onPress={onRetry}>
          <Ionicons name="refresh-outline" size={16} color={colors.ink} />
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      )}
    </View>
  );
}

/* ─── Empty State ─── */

export function EmptyView({
  icon = 'search-outline',
  title = 'Nothing found',
  subtitle,
}: {
  icon?: string;
  title?: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.emptyWrap}>
      <Ionicons name={icon as any} size={28} color={colors.muted} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
    </View>
  );
}

/* ─── Sync Pill ─── */

export function SyncPill({ synced = true }: { synced?: boolean }) {
  return (
    <View style={styles.syncPill}>
      <View style={[styles.syncDot, !synced && { backgroundColor: colors.muted }]} />
      <Text style={styles.syncText}>{synced ? 'LIVE' : 'OFFLINE'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 13, fontWeight: '700', color: colors.muted },
  errorText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  retryText: { fontSize: 12, fontWeight: '900', color: colors.ink },
  emptyWrap: {
    marginTop: 24,
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: { fontSize: 13, fontWeight: '900', color: colors.ink },
  emptySub: { fontSize: 11, fontWeight: '700', color: colors.muted, textAlign: 'center' },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(19,236,91,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(19,236,91,0.35)',
  },
  syncDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  syncText: { fontSize: 11, fontWeight: '900', color: colors.ink, letterSpacing: 0.6 },
});
