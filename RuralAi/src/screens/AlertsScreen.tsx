import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { usePriceAlerts } from '../hooks/useData';
import { alertsApi } from '../services/api';
import { LoadingView, ErrorView, EmptyView, SyncPill } from '../components/ui';

export default function AlertsScreen() {
  const nav = useNavigation<any>();
  const { data, loading, error, refresh } = usePriceAlerts();
  const [newCrop, setNewCrop] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newCrop.trim()) return;
    setCreating(true);
    try {
      await alertsApi.createAlert({ crop_type: newCrop.trim() });
      setNewCrop('');
      refresh();
    } catch {
      /* swallow — in demo mode */
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await alertsApi.deleteAlert(id);
      refresh();
    } catch {
      /* swallow */
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => nav.goBack()}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <Text style={styles.title}>Price Alerts</Text>
          <SyncPill synced={!error} />
        </View>

        {loading ? (
          <LoadingView message="Loading alerts…" />
        ) : error ? (
          <ErrorView message={error.message} onRetry={refresh} />
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Create alert */}
            <View style={styles.createCard}>
              <Text style={styles.createLabel}>New alert</Text>
              <View style={styles.createRow}>
                <TextInput
                  value={newCrop}
                  onChangeText={setNewCrop}
                  placeholder="Crop name (e.g., Wheat)"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                />
                <Pressable
                  style={[styles.addBtn, creating && { opacity: 0.6 }]}
                  onPress={handleCreate}
                  disabled={creating}
                >
                  <Ionicons name="add" size={18} color={colors.ink} />
                </Pressable>
              </View>
            </View>

            {/* Alert list */}
            {data?.alerts && data.alerts.length > 0 ? (
              <View style={{ gap: 10 }}>
                {data.alerts.map((a) => (
                  <View key={a.alert_id} style={styles.alertRow}>
                    <View style={styles.alertLeft}>
                      <View style={styles.alertIcon}>
                        <Ionicons name="notifications-outline" size={18} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.alertCrop}>{a.crop_type}</Text>
                        <Text style={styles.alertMeta}>
                          {a.target_price ? `₹${a.target_price}` : 'Any change'} • {a.active ? 'Active' : 'Paused'}
                        </Text>
                      </View>
                    </View>
                    <Pressable style={styles.deleteBtn} onPress={() => handleDelete(a.alert_id)}>
                      <Ionicons name="trash-outline" size={16} color="#B91C1C" />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : (
              <EmptyView
                icon="notifications-off-outline"
                title="No alerts yet"
                subtitle="Create an alert to get notified when prices change."
              />
            )}
            <View style={{ height: 24 }} />
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, paddingHorizontal: 14, paddingTop: 6 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '900', color: colors.ink },
  content: { paddingTop: 12, paddingBottom: 18, gap: 12 },
  createCard: {
    backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 8,
  },
  createLabel: { fontSize: 13, fontWeight: '900', color: colors.ink },
  createRow: { flexDirection: 'row', gap: 10 },
  input: {
    flex: 1, backgroundColor: colors.bg, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 12, fontWeight: '800', color: colors.ink,
  },
  addBtn: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  alertRow: {
    backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border,
    padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
  },
  alertLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  alertIcon: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(19,236,91,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  alertCrop: { fontSize: 13, fontWeight: '900', color: colors.ink },
  alertMeta: { marginTop: 3, fontSize: 11, fontWeight: '700', color: colors.muted },
  deleteBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(185,28,28,0.08)', borderWidth: 1, borderColor: 'rgba(185,28,28,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
});