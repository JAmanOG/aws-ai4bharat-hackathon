import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useAuth } from '../contexts/AuthContext';
import { voiceRoomApi, type VoiceRoom, type VoiceRoomChatMessage, type VoiceRoomParticipant } from '../services/api';

type Nav = NativeStackNavigationProp<HomeStackParamList>;
type VoiceRoomRoute = RouteProp<HomeStackParamList, 'VoiceRoom'>;

const PALETTE = {
  screen: '#F7F2E3',
  surface: '#FFFDF4',
  text: '#24140A',
  muted: '#6E5A43',
  gold: '#E4C56B',
  goldDeep: '#C9A64D',
  goldShadow: 'rgba(190, 150, 55, 0.24)',
  line: '#D8CAA8',
  red: '#D73C30',
  green: '#5E9B5B',
  white: '#FFFDF8',
  overlay: 'rgba(37, 23, 10, 0.32)',
  sheet: '#FBF4DD',
};

type StagePosition = Pick<ViewStyle, 'top' | 'left'>;

const STAGE_POSITIONS: StagePosition[] = [
  { top: '0%', left: '6%' },
  { top: '4%', left: '74%' },
  { top: '12%', left: '24%' },
  { top: '16%', left: '58%' },
  { top: '21%', left: '8%' },
  { top: '26%', left: '76%' },
  { top: '32%', left: '36%' },
  { top: '38%', left: '61%' },
  { top: '44%', left: '18%' },
  { top: '48%', left: '82%' },
  { top: '54%', left: '3%' },
  { top: '59%', left: '69%' },
  { top: '66%', left: '29%' },
  { top: '70%', left: '53%' },
  { top: '76%', left: '12%' },
  { top: '79%', left: '82%' },
  { top: '86%', left: '42%' },
  { top: '90%', left: '68%' },
];

export default function VoiceRoomScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<VoiceRoomRoute>();
  const { user } = useAuth();
  const { roomId } = route.params;

  const [room, setRoom] = useState<VoiceRoom | null>(null);
  const [messages, setMessages] = useState<VoiceRoomChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<'moderator' | 'speaker' | 'listener'>('listener');
  const [chatText, setChatText] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [chatVisible, setChatVisible] = useState(false);
  const [participantsVisible, setParticipantsVisible] = useState(false);
  const [localMicOn, setLocalMicOn] = useState(false);
  const [requestPending, setRequestPending] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const chatListRef = useRef<FlatList<VoiceRoomChatMessage>>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshRoom = useCallback(async () => {
    const [roomData, chatData] = await Promise.all([
      voiceRoomApi.getRoom(roomId),
      voiceRoomApi.getChatMessages(roomId, { limit: 60 }),
    ]);
    setRoom(roomData);
    setMessages([...chatData.messages].reverse());

    const me = roomData.participants?.find((participant) => participant.userId === user?.userId);
    if (me) {
      setMyRole(me.role);
      setRequestPending(Boolean(me.requestedSpeak));
      if (me.role === 'listener') {
        setLocalMicOn(false);
      }
    }
  }, [roomId, user?.userId]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        try {
          const joinResult = await voiceRoomApi.joinRoom(roomId);
          if (mounted) {
            setMyRole(joinResult.role as 'moderator' | 'speaker' | 'listener');
            setLocalMicOn(joinResult.role !== 'listener');
          }
        } catch (error: any) {
          const message = String(error?.message ?? '');
          const alreadyJoined =
            message.toLowerCase().includes('already')
            || message.toLowerCase().includes('active')
            || message.toLowerCase().includes('joined');
          if (!alreadyJoined) {
            throw error;
          }
        }

        await refreshRoom();
      } catch (error: any) {
        if (!mounted) return;
        setLoadingError(error?.message ?? 'Could not load room');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [refreshRoom, roomId]);

  useEffect(() => {
    pollRef.current = setInterval(() => {
      refreshRoom().catch(() => {});
    }, 5000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [refreshRoom]);

  const participants = room?.participants ?? [];
  const participantCount = participants.length || room?.participantCount || 0;
  const isModerator = myRole === 'moderator';
  const isSpeaker = myRole === 'speaker';
  const isEnded = room?.status === 'ended';

  const sortedParticipants = useMemo(
    () => [...participants].sort((left, right) => {
      const leftRank = participantRank(left);
      const rightRank = participantRank(right);
      if (leftRank !== rightRank) return leftRank - rightRank;
      return (left.joinedAt ?? '').localeCompare(right.joinedAt ?? '');
    }),
    [participants],
  );

  const host = sortedParticipants.find((participant) => participant.role === 'moderator') ?? sortedParticipants[0] ?? null;
  const leadSpeaker = sortedParticipants.find(
    (participant) => participant.userId !== host?.userId && participant.role === 'speaker',
  ) ?? sortedParticipants.find((participant) => participant.userId !== host?.userId) ?? null;

  const stageParticipants = sortedParticipants.filter(
    (participant) => participant.userId !== host?.userId && participant.userId !== leadSpeaker?.userId,
  );

  const speakRequests = sortedParticipants.filter(
    (participant) => participant.role === 'listener' && participant.requestedSpeak,
  );

  const handleLeave = useCallback(async () => {
    if (isLeaving) return;
    setIsLeaving(true);
    try {
      await voiceRoomApi.leaveRoom(roomId);
    } catch {
      // ignore leave failures; still return to the previous screen
    } finally {
      setIsLeaving(false);
      if (nav.canGoBack()) {
        nav.goBack();
      } else {
        nav.navigate('VoiceRooms');
      }
    }
  }, [isLeaving, nav, roomId]);

  const handleEndRoom = useCallback(() => {
    Alert.alert('End room', 'This will close the room for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End room',
        style: 'destructive',
        onPress: async () => {
          try {
            await voiceRoomApi.endRoom(roomId);
            if (nav.canGoBack()) {
              nav.goBack();
            } else {
              nav.navigate('VoiceRooms');
            }
          } catch (error: any) {
            Alert.alert('Could not end room', error?.message ?? 'Please try again.');
          }
        },
      },
    ]);
  }, [nav, roomId]);

  const handleShare = useCallback(async () => {
    if (!room) return;
    try {
      await Share.share({
        message: `Join "${room.title}" on Rugro voice rooms.`,
      });
    } catch {
      // no-op
    }
  }, [room]);

  const handlePrimaryAction = useCallback(async () => {
    if (isEnded) return;

    if (isModerator || isSpeaker) {
      setLocalMicOn((current) => !current);
      return;
    }

    if (requestPending) {
      return;
    }

    try {
      await voiceRoomApi.requestToSpeak(roomId);
      setRequestPending(true);
      Alert.alert('Request sent', 'The moderator can now approve you as a speaker.');
    } catch (error: any) {
      Alert.alert('Could not send request', error?.message ?? 'Please try again.');
    }
  }, [isEnded, isModerator, isSpeaker, requestPending, roomId]);

  const handleApproveSpeaker = useCallback(async (targetUserId: string) => {
    try {
      await voiceRoomApi.approveSpeaker(roomId, targetUserId);
      await refreshRoom();
    } catch (error: any) {
      Alert.alert('Could not approve speaker', error?.message ?? 'Please try again.');
    }
  }, [refreshRoom, roomId]);

  const handleRemoveUser = useCallback(async (target: VoiceRoomParticipant) => {
    Alert.alert('Remove participant', `Remove ${safeText(target.userName, 'this participant')} from the room?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await voiceRoomApi.kickUser(roomId, target.userId);
            await refreshRoom();
          } catch (error: any) {
            Alert.alert('Could not remove participant', error?.message ?? 'Please try again.');
          }
        },
      },
    ]);
  }, [refreshRoom, roomId]);

  const handleSendChat = useCallback(async () => {
    const content = safeText(chatText, '');
    if (!content || sendingChat) return;

    setSendingChat(true);
    try {
      const message = await voiceRoomApi.sendChatMessage(roomId, content);
      setMessages((current) => [...current, message]);
      setChatText('');
      setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 80);
    } catch (error: any) {
      Alert.alert('Could not send message', error?.message ?? 'Please try again.');
    } finally {
      setSendingChat(false);
    }
  }, [chatText, roomId, sendingChat]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.stateWrap}>
          <ActivityIndicator size="large" color={PALETTE.goldDeep} />
          <Text style={styles.stateTitle}>Joining voice room</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!room) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.stateWrap}>
          <Ionicons name="alert-circle-outline" size={44} color={PALETTE.goldDeep} />
          <Text style={styles.stateTitle}>Voice room unavailable</Text>
          <Text style={styles.stateText}>{loadingError ?? 'This room could not be loaded from the backend.'}</Text>
          <TouchableOpacity style={styles.stateButton} activeOpacity={0.9} onPress={() => nav.navigate('VoiceRooms')}>
            <Text style={styles.stateButtonText}>Back to rooms</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.topBar}>
          <View style={styles.topBarSpacer} />
          <TouchableOpacity style={styles.leaveWrap} activeOpacity={0.84} onPress={handleLeave}>
            <Ionicons name="log-out-outline" size={33} color={PALETTE.text} />
            <Text style={styles.leaveText}>Leave</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.roomTitle}>{safeText(room.title, 'Voice room')}</Text>
          {isEnded ? (
            <View style={styles.endedPill}>
              <Text style={styles.endedPillText}>Room ended</Text>
            </View>
          ) : null}

          <View style={styles.heroRow}>
            {host ? (
              <HeroParticipant
                participant={host}
                label="Host"
                live
                speaking={isSpeaking(host, user?.userId, localMicOn)}
              />
            ) : null}
            {leadSpeaker ? (
              <HeroParticipant
                participant={leadSpeaker}
                label={leadSpeaker.role === 'moderator' ? 'Host' : 'Speaker'}
                speaking={isSpeaking(leadSpeaker, user?.userId, localMicOn)}
              />
            ) : null}
          </View>

          <View style={styles.stageArea}>
            {stageParticipants.map((participant, index) => (
              <View
                key={`${participant.userId}-${index}`}
                style={[
                  styles.stageBubble,
                  getStagePosition(index),
                ]}
              >
                <CrowdParticipant
                  participant={participant}
                  live={participant.role === 'moderator'}
                  speaking={isSpeaking(participant, user?.userId, localMicOn)}
                />
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.controlTray}>
          <RoomAction
            icon={isModerator || isSpeaker ? (localMicOn ? 'mic-outline' : 'mic-off-outline') : 'hand-left-outline'}
            label={getPrimaryActionLabel(isModerator, isSpeaker, requestPending, localMicOn)}
            onPress={handlePrimaryAction}
            disabled={isEnded}
          />
          <RoomAction
            icon="chatbubble-ellipses-outline"
            label="Chat"
            onPress={() => setChatVisible(true)}
            badge={messages.length > 0 ? String(Math.min(messages.length, 99)) : undefined}
          />
          <RoomAction
            icon="people-outline"
            label="Participants"
            onPress={() => setParticipantsVisible(true)}
            badge={String(participantCount)}
          />
          <RoomAction
            icon="share-social-outline"
            label="Share"
            onPress={handleShare}
          />
        </View>

        {isModerator && !isEnded ? (
          <TouchableOpacity style={styles.endRoomButton} activeOpacity={0.9} onPress={handleEndRoom}>
            <Text style={styles.endRoomText}>End Room</Text>
          </TouchableOpacity>
        ) : null}
      </KeyboardAvoidingView>

      <Modal visible={chatVisible} transparent animationType="slide" onRequestClose={() => setChatVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Chat</Text>
              <TouchableOpacity onPress={() => setChatVisible(false)}>
                <Ionicons name="close" size={24} color={PALETTE.text} />
              </TouchableOpacity>
            </View>

            <FlatList
              ref={chatListRef}
              data={messages}
              keyExtractor={(item) => item.messageId}
              contentContainerStyle={styles.chatList}
              renderItem={({ item }) => (
                <View style={styles.chatBubble}>
                  <Text style={styles.chatAuthor}>{safeText(item.userName, 'User')}</Text>
                  <Text style={styles.chatMessage}>{safeText(item.content, '')}</Text>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptySheetState}>
                  <Text style={styles.emptySheetTitle}>No chat messages yet</Text>
                  <Text style={styles.emptySheetText}>Messages appear here only when participants send them.</Text>
                </View>
              }
            />

            {!isEnded ? (
              <View style={styles.chatComposer}>
                <TextInput
                  style={styles.chatInput}
                  placeholder="Type a message"
                  placeholderTextColor="#8D7A61"
                  value={chatText}
                  onChangeText={setChatText}
                  returnKeyType="send"
                  onSubmitEditing={handleSendChat}
                />
                <TouchableOpacity
                  style={[styles.sendButton, (!safeText(chatText, '') || sendingChat) && styles.sendButtonDisabled]}
                  activeOpacity={0.9}
                  onPress={handleSendChat}
                  disabled={!safeText(chatText, '') || sendingChat}
                >
                  {sendingChat ? (
                    <ActivityIndicator size="small" color={PALETTE.text} />
                  ) : (
                    <Ionicons name="send" size={18} color={PALETTE.text} />
                  )}
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={participantsVisible} transparent animationType="slide" onRequestClose={() => setParticipantsVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Participants</Text>
              <TouchableOpacity onPress={() => setParticipantsVisible(false)}>
                <Ionicons name="close" size={24} color={PALETTE.text} />
              </TouchableOpacity>
            </View>

            {isModerator && speakRequests.length > 0 ? (
              <View style={styles.requestBlock}>
                <Text style={styles.requestBlockTitle}>Speak requests</Text>
                {speakRequests.map((participant) => (
                  <View key={participant.userId} style={styles.requestRow}>
                    <View style={styles.requestProfile}>
                      <MiniAvatar name={safeText(participant.userName, 'P')} />
                      <Text style={styles.requestName}>{safeText(participant.userName, 'Participant')}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.approveButton}
                      activeOpacity={0.9}
                      onPress={() => handleApproveSpeaker(participant.userId)}
                    >
                      <Text style={styles.approveButtonText}>Approve</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.participantList}>
              {sortedParticipants.map((participant) => (
                <View key={participant.userId} style={styles.participantRow}>
                  <View style={styles.participantProfile}>
                    <MiniAvatar name={safeText(participant.userName, 'P')} />
                    <View>
                      <Text style={styles.participantName}>{safeText(participant.userName, 'Participant')}</Text>
                      <Text style={styles.participantMeta}>
                        {participant.role === 'moderator' ? 'Moderator' : participant.role === 'speaker' ? 'Speaker' : 'Listener'}
                        {participant.userId === user?.userId ? ' • You' : ''}
                      </Text>
                    </View>
                  </View>

                  {isModerator && participant.userId !== user?.userId ? (
                    <TouchableOpacity
                      style={styles.removeButton}
                      activeOpacity={0.86}
                      onPress={() => handleRemoveUser(participant)}
                    >
                      <Ionicons name="remove-circle-outline" size={20} color="#8E3B2D" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function HeroParticipant({
  participant,
  label,
  speaking,
  live = false,
}: {
  participant: VoiceRoomParticipant;
  label: string;
  speaking: boolean;
  live?: boolean;
}) {
  return (
    <View style={styles.heroCard}>
      <AvatarCircle name={safeText(participant.userName, 'P')} size={146} live={live} speaking={speaking} />
      <Text style={styles.heroName} numberOfLines={1}>{safeText(participant.userName, 'Participant')}</Text>
      <Text style={styles.heroRole}>{label}</Text>
    </View>
  );
}

function CrowdParticipant({
  participant,
  speaking,
  live = false,
}: {
  participant: VoiceRoomParticipant;
  speaking: boolean;
  live?: boolean;
}) {
  return (
    <AvatarCircle
      name={safeText(participant.userName, 'P')}
      size={participant.role === 'speaker' ? 76 : 62}
      live={live}
      speaking={speaking}
      compact
    />
  );
}

function AvatarCircle({
  name,
  size,
  live = false,
  speaking = false,
  compact = false,
}: {
  name: string;
  size: number;
  live?: boolean;
  speaking?: boolean;
  compact?: boolean;
}) {
  const initials = getInitials(name);
  const tone = AVATAR_BACKGROUNDS[Math.abs(hashText(name)) % AVATAR_BACKGROUNDS.length];

  return (
    <View
      style={[
        styles.avatarShell,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <View
        style={[
          styles.avatarCore,
          {
            width: size - 10,
            height: size - 10,
            borderRadius: (size - 10) / 2,
            backgroundColor: tone,
          },
        ]}
      >
        <Text style={[styles.avatarLetters, { fontSize: Math.max(18, size * (compact ? 0.24 : 0.26)) }]}>
          {initials}
        </Text>
      </View>

      {live ? (
        <View style={[styles.liveBadgeRoom, compact && styles.liveBadgeCompact]}>
          <Text style={[styles.liveBadgeRoomText, compact && styles.liveBadgeRoomTextCompact]}>LIVE</Text>
        </View>
      ) : null}

      <View style={[styles.audioBadge, compact && styles.audioBadgeCompact]}>
        <Ionicons
          name={speaking ? 'volume-high' : 'volume-medium'}
          size={compact ? 12 : 22}
          color={PALETTE.green}
        />
      </View>
    </View>
  );
}

function RoomAction({
  icon,
  label,
  onPress,
  badge,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  badge?: string;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionWrap, disabled && styles.actionWrapDisabled]}
      activeOpacity={0.88}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={styles.actionIconCircle}>
        <Ionicons name={icon} size={34} color={PALETTE.text} />
        {badge ? (
          <View style={styles.actionBadge}>
            <Text style={styles.actionBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function MiniAvatar({ name }: { name: string }) {
  const tone = AVATAR_BACKGROUNDS[Math.abs(hashText(name)) % AVATAR_BACKGROUNDS.length];
  return (
    <View style={[styles.miniAvatar, { backgroundColor: tone }]}>
      <Text style={styles.miniAvatarText}>{getInitials(name)}</Text>
    </View>
  );
}

const AVATAR_BACKGROUNDS = ['#E0C5A0', '#D6C2A0', '#CEC4A7', '#C0D0B1', '#D9B9A0', '#CBD0E0'];

function participantRank(participant: VoiceRoomParticipant) {
  if (participant.role === 'moderator') return 0;
  if (participant.role === 'speaker') return 1;
  return 2;
}

function safeText(value: string | null | undefined, fallback: string) {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function getInitials(name: string) {
  const parts = safeText(name, 'P').split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'P';
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return hash;
}

function isSpeaking(participant: VoiceRoomParticipant, currentUserId?: string, localMicOn?: boolean) {
  if (participant.userId === currentUserId) {
    return Boolean(localMicOn) && participant.role !== 'listener';
  }
  return !participant.isMuted && participant.role !== 'listener';
}

function getStagePosition(index: number): StagePosition {
  if (index < STAGE_POSITIONS.length) {
    return STAGE_POSITIONS[index];
  }

  const overflowIndex = index - STAGE_POSITIONS.length;
  const row = Math.floor(overflowIndex / 4);
  const col = overflowIndex % 4;
  return {
    top: `${94 + row * 16}%` as const,
    left: `${6 + col * 22}%` as const,
  };
}

function getPrimaryActionLabel(
  isModerator: boolean,
  isSpeaker: boolean,
  requestPending: boolean,
  localMicOn: boolean,
) {
  if (isModerator || isSpeaker) {
    return localMicOn ? 'Mute' : 'Unmute';
  }
  if (requestPending) {
    return 'Requested';
  }
  return 'Request';
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: PALETTE.screen,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 8,
  },
  topBarSpacer: {
    width: 60,
  },
  leaveWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leaveText: {
    marginLeft: 8,
    color: PALETTE.text,
    fontSize: 18,
    fontWeight: '600',
  },
  roomTitle: {
    color: PALETTE.text,
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '400',
    marginTop: 18,
    marginBottom: 12,
  },
  endedPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F3D7CF',
    marginBottom: 18,
  },
  endedPillText: {
    color: '#8E3B2D',
    fontSize: 14,
    fontWeight: '700',
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 8,
    marginBottom: 12,
  },
  heroCard: {
    width: '48%',
    alignItems: 'center',
  },
  heroName: {
    marginTop: 14,
    color: PALETTE.text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    textAlign: 'center',
  },
  heroRole: {
    marginTop: 2,
    color: PALETTE.text,
    fontSize: 18,
    fontWeight: '400',
    textAlign: 'center',
  },
  stageArea: {
    position: 'relative',
    minHeight: 620,
    marginTop: 8,
    marginBottom: 12,
  },
  stageBubble: {
    position: 'absolute',
  },
  avatarShell: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F4E9C9',
  },
  avatarCore: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetters: {
    color: PALETTE.text,
    fontWeight: '700',
  },
  liveBadgeRoom: {
    position: 'absolute',
    left: 18,
    bottom: 10,
    backgroundColor: PALETTE.red,
    borderWidth: 1,
    borderColor: '#A7281F',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  liveBadgeCompact: {
    left: 6,
    bottom: 3,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  liveBadgeRoomText: {
    color: PALETTE.white,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  liveBadgeRoomTextCompact: {
    fontSize: 10,
  },
  audioBadge: {
    position: 'absolute',
    right: -2,
    bottom: 18,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: PALETTE.surface,
    borderWidth: 2,
    borderColor: '#D3C49D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioBadgeCompact: {
    width: 24,
    height: 24,
    borderRadius: 12,
    right: -2,
    bottom: 0,
    borderWidth: 1,
  },
  controlTray: {
    marginHorizontal: 22,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderRadius: 30,
    backgroundColor: PALETTE.gold,
    flexDirection: 'row',
    justifyContent: 'space-between',
    shadowColor: PALETTE.goldShadow,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  actionWrap: {
    width: '24%',
    alignItems: 'center',
  },
  actionWrapDisabled: {
    opacity: 0.45,
  },
  actionIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 249, 235, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  actionBadge: {
    position: 'absolute',
    top: 0,
    right: -2,
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 6,
    backgroundColor: '#C94139',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBadgeText: {
    color: PALETTE.white,
    fontSize: 14,
    fontWeight: '700',
  },
  actionLabel: {
    marginTop: 10,
    color: PALETTE.text,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  endRoomButton: {
    alignSelf: 'center',
    marginBottom: 18,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  endRoomText: {
    color: '#8E3B2D',
    fontSize: 15,
    fontWeight: '700',
  },
  stateWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  stateTitle: {
    marginTop: 16,
    color: PALETTE.text,
    fontSize: 24,
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
  stateButton: {
    marginTop: 20,
    height: 52,
    minWidth: 150,
    paddingHorizontal: 22,
    borderRadius: 18,
    backgroundColor: PALETTE.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stateButtonText: {
    color: PALETTE.text,
    fontSize: 18,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: PALETTE.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '78%',
    backgroundColor: PALETTE.sheet,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sheetTitle: {
    color: PALETTE.text,
    fontSize: 24,
    fontWeight: '700',
  },
  chatList: {
    paddingBottom: 10,
  },
  chatBubble: {
    borderRadius: 20,
    backgroundColor: PALETTE.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: PALETTE.line,
  },
  chatAuthor: {
    color: PALETTE.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  chatMessage: {
    color: PALETTE.text,
    fontSize: 15,
    lineHeight: 22,
  },
  chatComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  chatInput: {
    flex: 1,
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: PALETTE.surface,
    borderWidth: 1,
    borderColor: PALETTE.line,
    paddingHorizontal: 16,
    color: PALETTE.text,
    fontSize: 16,
  },
  sendButton: {
    width: 54,
    height: 54,
    borderRadius: 18,
    marginLeft: 10,
    backgroundColor: PALETTE.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  emptySheetState: {
    paddingVertical: 36,
    alignItems: 'center',
  },
  emptySheetTitle: {
    color: PALETTE.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySheetText: {
    marginTop: 8,
    color: PALETTE.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  requestBlock: {
    marginBottom: 16,
    borderRadius: 22,
    backgroundColor: PALETTE.surface,
    borderWidth: 1,
    borderColor: PALETTE.line,
    padding: 14,
  },
  requestBlockTitle: {
    color: PALETTE.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  requestProfile: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requestName: {
    marginLeft: 10,
    color: PALETTE.text,
    fontSize: 16,
    fontWeight: '600',
  },
  approveButton: {
    height: 40,
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: PALETTE.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  approveButtonText: {
    color: PALETTE.text,
    fontSize: 15,
    fontWeight: '700',
  },
  participantList: {
    paddingBottom: 12,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 18,
    backgroundColor: PALETTE.surface,
    borderWidth: 1,
    borderColor: PALETTE.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  participantProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  participantName: {
    color: PALETTE.text,
    fontSize: 16,
    fontWeight: '700',
  },
  participantMeta: {
    marginTop: 2,
    color: PALETTE.muted,
    fontSize: 14,
  },
  removeButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  miniAvatarText: {
    color: PALETTE.text,
    fontSize: 15,
    fontWeight: '700',
  },
});
