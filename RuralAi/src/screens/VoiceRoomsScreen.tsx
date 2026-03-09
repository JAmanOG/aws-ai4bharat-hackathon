import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useVoiceRooms } from '../hooks/useData';
import type { VoiceRoom } from '../services/api';
import { useDemoScreenActions } from '../demo/DemoActions';

type Nav = NativeStackNavigationProp<HomeStackParamList>;

const PALETTE = {
  screen: '#F4EEDB',
  surface: '#FFFDF4',
  border: '#DECFA9',
  shadow: 'rgba(178, 143, 73, 0.24)',
  text: '#2B180A',
  muted: '#5E4B34',
  gold: '#E7C666',
  goldDeep: '#C9A64D',
  goldShadow: 'rgba(193, 150, 59, 0.28)',
  red: '#D83A2F',
  liveText: '#FFF8F1',
  listener: '#715B3D',
};

export default function VoiceRoomsScreen() {
  const nav = useNavigation<Nav>();
  const { data, loading, error, refresh } = useVoiceRooms({ status: 'active', limit: 50 });
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const rooms = useMemo(
    () => [...(data?.rooms ?? [])]
      .filter((room) => room.status === 'active')
      .sort((a, b) => {
        const countDiff = (b.participantCount ?? 0) - (a.participantCount ?? 0);
        if (countDiff !== 0) return countDiff;
        return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
      }),
    [data?.rooms],
  );

  const demoActions = useMemo(
    () => ({
      openFirstRoom: () => {
        if (!rooms[0]?.roomId) return;
        nav.navigate('VoiceRoom', { roomId: rooms[0].roomId });
      },
    }),
    [nav, rooms],
  );

  useDemoScreenActions('VoiceRooms', demoActions);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 450);
  }, [refresh]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.82}
          onPress={() => (nav.canGoBack() ? nav.goBack() : nav.navigate('HomeMain'))}
        >
          <Ionicons name="arrow-back" size={28} color={PALETTE.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Live voice streams</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PALETTE.goldDeep} />}
      >
        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="large" color={PALETTE.goldDeep} />
            <Text style={styles.stateTitle}>Loading live rooms</Text>
            <Text style={styles.stateText}>Fetching active voice streams from the backend.</Text>
          </View>
        ) : null}

        {!loading && error ? (
          <View style={styles.stateCard}>
            <Ionicons name="alert-circle-outline" size={34} color={PALETTE.red} />
            <Text style={styles.stateTitle}>Could not load live streams</Text>
            <Text style={styles.stateText}>Only real room data is shown here. Pull to refresh and try again.</Text>
            <TouchableOpacity style={styles.retryButton} activeOpacity={0.88} onPress={refresh}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!loading && !error && rooms.length === 0 ? (
          <View style={styles.stateCard}>
            <Ionicons name="radio-outline" size={34} color={PALETTE.goldDeep} />
            <Text style={styles.stateTitle}>No live rooms right now</Text>
            <Text style={styles.stateText}>
              This screen does not render placeholder rooms. A room will appear here only when one is actually active.
            </Text>
          </View>
        ) : null}

        {!loading && !error && rooms.map((room) => (
          <RoomCard
            key={room.roomId}
            room={room}
            onPress={() => nav.navigate('VoiceRoom', { roomId: room.roomId })}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function RoomCard({ room, onPress }: { room: VoiceRoom; onPress: () => void }) {
  const moderatorName = safeText(room.creatorName, 'Moderator');
  const roomTitle = safeText(room.title, 'Voice room');
  const listenerCount = formatListeners(room.participantCount);

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={styles.avatarColumn}>
          <View style={styles.avatarFrame}>
            <AvatarBadge name={moderatorName} size={96} />
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          </View>
          <Text style={styles.moderatorLabel}>Moderator</Text>
        </View>

        <View style={styles.cardCopy}>
          <Text style={styles.hostName} numberOfLines={1}>
            {moderatorName}
          </Text>
          <Text style={styles.roomName} numberOfLines={2}>
            {roomTitle}
          </Text>

          <View style={styles.listenersRow}>
            <Ionicons name="people" size={21} color={PALETTE.listener} />
            <Text style={styles.listenersText}>{listenerCount} Listening</Text>
          </View>

          <TouchableOpacity style={styles.joinButton} activeOpacity={0.9} onPress={onPress}>
            <Ionicons name="headset-outline" size={26} color={PALETTE.text} />
            <Text style={styles.joinButtonText}>Join Room</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function AvatarBadge({ name, size }: { name: string; size: number }) {
  const initials = getInitials(name);
  const paletteIndex = Math.abs(hashText(name)) % AVATAR_BACKGROUNDS.length;

  return (
    <View
      style={[
        styles.avatarOuter,
        {
          width: size,
          height: size,
        },
      ]}
    >
      <View
        style={[
          styles.avatarInner,
          {
            width: size - 10,
            height: size - 10,
            backgroundColor: AVATAR_BACKGROUNDS[paletteIndex],
          },
        ]}
      >
        <Text style={[styles.avatarInitials, { fontSize: Math.max(22, size * 0.28) }]}>{initials}</Text>
      </View>
    </View>
  );
}

const AVATAR_BACKGROUNDS = ['#DFC7A7', '#CBB68B', '#D3B79D', '#C1CFAF', '#DDBA96', '#C2C3D9'];

function safeText(value: string | null | undefined, fallback: string) {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function getInitials(name: string) {
  const parts = safeText(name, 'R').split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'R';
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return hash;
}

function formatListeners(value: number | undefined) {
  const count = Math.max(0, Number(value ?? 0));
  if (count >= 1000) {
    return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1).replace(/\.0$/, '')}k`;
  }
  return String(count);
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: PALETTE.screen,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 18,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
    color: PALETTE.text,
    fontSize: 27,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 34,
  },
  card: {
    backgroundColor: PALETTE.surface,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: PALETTE.border,
    shadowColor: PALETTE.shadow,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  cardRow: {
    flexDirection: 'row',
  },
  avatarColumn: {
    width: 122,
    alignItems: 'center',
    paddingTop: 6,
  },
  avatarFrame: {
    position: 'relative',
    width: 106,
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarOuter: {
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9F3E1',
    borderWidth: 3,
    borderColor: '#B74B47',
  },
  avatarInner: {
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    color: PALETTE.text,
    fontWeight: '700',
  },
  liveBadge: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    backgroundColor: PALETTE.red,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#A62218',
  },
  liveBadgeText: {
    color: PALETTE.liveText,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  moderatorLabel: {
    marginTop: 8,
    color: PALETTE.text,
    fontSize: 18,
    fontWeight: '500',
  },
  cardCopy: {
    flex: 1,
    paddingLeft: 12,
    paddingTop: 6,
  },
  hostName: {
    color: PALETTE.text,
    fontSize: 20,
    fontWeight: '500',
    marginBottom: 4,
  },
  roomName: {
    color: PALETTE.text,
    fontSize: 24,
    lineHeight: 31,
    fontWeight: '700',
    marginBottom: 10,
  },
  listenersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  listenersText: {
    marginLeft: 8,
    color: PALETTE.listener,
    fontSize: 17,
    fontWeight: '500',
  },
  joinButton: {
    height: 60,
    borderRadius: 22,
    backgroundColor: PALETTE.gold,
    borderWidth: 1,
    borderColor: '#E1C369',
    shadowColor: PALETTE.goldShadow,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinButtonText: {
    marginLeft: 10,
    color: PALETTE.text,
    fontSize: 22,
    fontWeight: '700',
  },
  stateCard: {
    backgroundColor: PALETTE.surface,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 30,
    marginTop: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: PALETTE.border,
    shadowColor: PALETTE.shadow,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  stateTitle: {
    marginTop: 14,
    color: PALETTE.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  stateText: {
    marginTop: 8,
    color: PALETTE.muted,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 18,
    minWidth: 128,
    height: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PALETTE.gold,
  },
  retryText: {
    color: PALETTE.text,
    fontSize: 18,
    fontWeight: '700',
  },
});
