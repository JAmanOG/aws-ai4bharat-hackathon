import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput,
  ActivityIndicator, Dimensions, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { voiceRoomApi } from "../api/community";
import { agoraManager } from "../utils/AgoraManager";
import { RtcConnection } from "react-native-agora";
import API_CONFIG, { getMockUser } from "../api/config";
import { Modal } from "../components/ui/Modal";
import { useAlert } from "../components/ui/AlertProvider";
import { Button } from "../components/ui/Button";
import Avatar from "../components/Avatar";

const { width } = Dimensions.get('window');

type ChatMsg = {
  messageId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
};
type Participant = {
  userId: string;
  userName: string;
  role: 'moderator' | 'speaker' | 'listener';
  isMuted?: boolean;
  requestedSpeak?: boolean;
};

function getNumericUid(userId: string) {
  if (!userId) return 0;
  const hex = userId.replace(/-/g, '').substring(0, 8);
  const uid = parseInt(hex, 16);
  return isNaN(uid) ? 0 : uid % 0xFFFFFFFF;
}

export default function VoiceRoomScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const roomId = route?.params?.roomId ?? "";

  const [room, setRoom] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatText, setChatText] = useState("");
  const [sending, setSending] = useState(false);
  const [ended, setEnded] = useState(false);

  const [showChat, setShowChat] = useState(false);
  const [newChatDot, setNewChatDot] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioRoute, setAudioRoute] = useState<'speaker' | 'earpiece'>('speaker');
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [myRole, setMyRole] = useState<'moderator' | 'speaker' | 'listener'>('listener');
  const [isAgoraAvailable, setIsAgoraAvailable] = useState(true);
  const { showAlert } = useAlert();
  const chatScrollRef = useRef<ScrollView>(null);

  const fetchRoom = useCallback(async () => {
    try {
      const res = await voiceRoomApi.getRoom(roomId);
      if (res.data) {
        setRoom(res.data);
        const newParticipants = res.data.participants || [];
        console.log(`[ROOM] Fetched ${newParticipants.length} participants:`, JSON.stringify(newParticipants.map((p: any) => ({ n: p.userName, r: p.role }))));
        setParticipants(newParticipants);
        setEnded(res.data.status === "ended");

        const me = newParticipants.find((p: any) => p.userId === getMockUser().id);
        if (me && me.role !== myRole) {
          console.log(`[AGORA] Role changed from ${myRole} to ${me.role}`);
          setMyRole(me.role);
          await agoraManager.setRole(me.role === 'moderator' || me.role === 'speaker');
          const shouldBeMuted = me.role === 'listener';
          setIsMuted(shouldBeMuted);
          agoraManager.muteLocalAudio(shouldBeMuted);
        } else if (me) {
          setMyRole(me.role);
        }
      }
    } catch { }

    try {
      const chatRes = await voiceRoomApi.getChatMessages(roomId);
      if (chatRes.data?.messages) {
        if (chatRes.data.messages.length > messages.length && !showChat) {
          setNewChatDot(true);
        }
        setMessages(chatRes.data.messages);
      }
    } catch (err) { }

    setLoading(false);
  }, [roomId, messages.length, showChat, myRole]);

  // Agora initialization
  useEffect(() => {
    const setupAgora = async () => {
      try {
        const tokenRes = await voiceRoomApi.getRoomToken(roomId);
        if (tokenRes.data?.token) {
          await agoraManager.initialize();
          if (!agoraManager.isAvailable()) {
            setIsAgoraAvailable(false);
            return;
          }
          const isHost = tokenRes.data.role === 'moderator' || tokenRes.data.role === 'speaker';
          const myUid = getNumericUid(getMockUser().id);

          agoraManager.on('onJoinChannelSuccess', (connection: RtcConnection, elapsed: number) => {
            console.log(`[AGORA-EVENT] onJoinChannelSuccess: Channel ${connection.channelId}, UserID ${connection.localUid}`);
          });

          agoraManager.on('onUserJoined', (connection: RtcConnection, remoteUid: number, elapsed: number) => {
            console.log(`[AGORA-EVENT] onUserJoined: Remote UserID ${remoteUid} joined`);
          });

          agoraManager.on('onLocalAudioStateChanged', (connection: RtcConnection, state: number, error: number) => {
            console.log(`[AGORA-EVENT] onLocalAudioStateChanged: State: ${state}, Error: ${error}`);
          });

          agoraManager.on('onError', (err: number, msg: string) => {
            console.error(`[AGORA-EVENT] onError: Code ${err}, Message: ${msg}`);
          });

          await agoraManager.joinChannel(tokenRes.data.token, roomId, myUid, isHost);
          setIsMuted(!isHost);
          setMyRole(tokenRes.data.role);
        }
      } catch (err) {
        console.error('[AGORA] Setup failed', err);
      }
    };

    if (!ended && roomId) setupAgora();

    return () => {
      agoraManager.leaveChannel();
    };
  }, [roomId, ended]);

  useEffect(() => {
    fetchRoom();
    const timer = setInterval(fetchRoom, 5000);
    return () => clearInterval(timer);
  }, [fetchRoom]);

  const handleSendChat = async () => {
    if (!chatText.trim()) return;
    setSending(true);
    try {
      await voiceRoomApi.sendChatMessage(roomId, chatText.trim());
      setChatText("");
      await fetchRoom();
    } catch (err: any) {
      showAlert({
        title: "Error",
        message: err.message || "Failed to send message"
      });
    }
    setSending(false);
  };

  const handleRequestSpeak = async () => {
    try {
      await voiceRoomApi.requestSpeak(roomId);
      showAlert({
        title: "Requested",
        message: "You have requested to speak. Wait for moderator approval."
      });
      await fetchRoom();
    } catch (err: any) {
      showAlert({
        title: "Error",
        message: "Failed to request speaking rights."
      });
    }
  };

  const handleApproveSpeaker = async (userId: string) => {
    try {
      await voiceRoomApi.approveSpeaker(roomId, userId);
      await fetchRoom();
    } catch (err) {
      showAlert({ title: "Error", message: "Failed to approve speaker." });
    }
  };

  const handleRevokeSpeaker = async (userId: string) => {
    try {
      await voiceRoomApi.revokeSpeaker(roomId, userId);
      await fetchRoom();
    } catch (err) {
      showAlert({ title: "Error", message: "Failed to revoke speaker." });
    }
  };

  const handleToggleMute = async () => {
    const newMute = !isMuted;
    setIsMuted(newMute);
    agoraManager.muteLocalAudio(newMute);
  };

  const handleToggleAudioRoute = async () => {
    const nextRoute = audioRoute === 'speaker' ? 'earpiece' : 'speaker';
    setAudioRoute(nextRoute);
    agoraManager.setEnableSpeakerphone(nextRoute === 'speaker');
    setShowAudioMenu(false);
  };

  const handleLeaveRoom = async () => {
    if (myRole === 'moderator') {
      showAlert({
        title: "Moderator",
        message: "You are the moderator. Do you want to end the room or just leave?",
        actions: [
          { text: "Cancel", style: "cancel" },
          { text: "Just Leave", onPress: async () => { await voiceRoomApi.leaveRoom(roomId); nav.goBack(); } },
          { text: "End Room", style: "destructive", onPress: handleEndRoom }
        ]
      });
    } else {
      await voiceRoomApi.leaveRoom(roomId);
      agoraManager.leaveChannel();
      nav.goBack();
    }
  };

  const handleEndRoom = async () => {
    try {
      const res = await voiceRoomApi.endRoom(roomId);
      if (!res.error) {
        setEnded(true);
        agoraManager.leaveChannel();
        showAlert({
          title: "Room Ended",
          message: "The voice room has been closed."
        });
        nav.goBack();
      } else {
        showAlert({ title: "Error", message: res.error });
      }
    } catch (err: any) {
      showAlert({ title: "Error", message: err.message || "Failed to end room" });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Connecting to Audio...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const moderators = participants.filter(p => p.role === 'moderator');
  const speakers = participants.filter(p => p.role === 'speaker');
  const listeners = participants.filter(p => p.role === 'listener');

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={handleLeaveRoom}>
            <Text style={styles.leaveText}>Leave</Text>
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.hTitle} numberOfLines={1}>{room?.title || "Voice Room"}</Text>
            <Text style={{ fontSize: 9, color: '#666' }}>ID: {roomId.slice(0, 8)}... | Parts: {participants.length}</Text>
          </View>
          <View style={[styles.statusPill, ended ? styles.statusEnded : styles.statusLive]}>
            <View style={[styles.liveDot, ended && { backgroundColor: colors.muted }]} />
            <Text style={[styles.statusText, ended ? { color: colors.muted } : { color: colors.ink }]}>
              {ended ? "ENDED" : "LIVE"}
            </Text>
          </View>
        </View>

        {!isAgoraAvailable && !ended && (
          <View style={styles.agoraWarn}>
            <Ionicons name="warning" size={16} color="#F59E0B" />
            <Text style={styles.agoraWarnText}>Audio requires a Development Build. Using Chat-only mode.</Text>
          </View>
        )}

        <ScrollView style={styles.gridArea} contentContainerStyle={styles.gridContent}>
          {/* Moderators */}
          <Text style={styles.gridSectionTitle}>Moderators</Text>
          <View style={styles.avatarGrid}>
            {moderators.map(p => (
              <ProfileUnit key={p.userId} user={p} />
            ))}
          </View>

          {/* Speakers */}
          {speakers.length > 0 && <Text style={styles.gridSectionTitle}>Speakers</Text>}
          <View style={styles.avatarGrid}>
            {speakers.map(p => (
              <ProfileUnit
                key={p.userId}
                user={p}
                isMeMod={myRole === 'moderator'}
                onRevoke={() => handleRevokeSpeaker(p.userId)}
              />
            ))}
          </View>

          {/* Listeners */}
          <Text style={styles.gridSectionTitle}>Audience ({listeners.length})</Text>
          <View style={styles.avatarGrid}>
            {listeners.map(p => (
              <ProfileUnit
                key={p.userId}
                user={p}
                size={50}
                isMeMod={myRole === 'moderator'}
                onApprove={() => handleApproveSpeaker(p.userId)}
                onRevoke={() => handleRevokeSpeaker(p.userId)}
              />
            ))}
          </View>
        </ScrollView>

        {/* Floating Corner Chat Bubble */}
        {!ended && (
          <Pressable
            style={styles.cornerChatBubble}
            onPress={() => { setShowChat(true); setNewChatDot(false); }}
          >
            <Ionicons name="chatbubble-ellipses" size={24} color={colors.ink} />
            {newChatDot && <View style={styles.newChatIndicator} />}
          </Pressable>
        )}

        {/* Bottom Controls */}
        {!ended && (
          <View style={styles.controls}>
            {myRole === 'listener' ? (
              <Pressable style={styles.controlBtn} onPress={handleRequestSpeak}>
                <Ionicons name="hand-right-outline" size={24} color={colors.ink} />
                <Text style={styles.controlLabel}>Speak</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.controlBtn, isMuted && styles.controlBtnMuted]}
                onPress={handleToggleMute}
              >
                <Ionicons
                  name={isMuted ? "mic-off" : "mic"}
                  size={24}
                  color={isMuted ? "#fff" : colors.ink}
                />
                <Text style={[styles.controlLabel, isMuted && { color: "#fff" }]}>
                  {isMuted ? "Unmute" : "Mute"}
                </Text>
              </Pressable>
            )}

            <View style={{ flex: 1 }} />

            <Pressable style={styles.controlBtn} onPress={() => setShowAudioMenu(true)}>
              <Ionicons name={audioRoute === 'speaker' ? "volume-high" : "ear"} size={24} color={colors.ink} />
              <Text style={styles.controlLabel}>{audioRoute === 'speaker' ? "Speaker" : "Earpiece"}</Text>
            </Pressable>

            <View style={{ flex: 1 }} />

            <Pressable style={styles.controlBtn} onPress={() => setShowChat(true)}>
              <Ionicons name="chatbubbles-outline" size={24} color={colors.ink} />
              <Text style={styles.controlLabel}>Chat</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* ── Audio Output Modal ── */}
      <Modal
        visible={showAudioMenu}
        onClose={() => setShowAudioMenu(false)}
        title="Audio Output"
      >
        <Text style={{ marginBottom: 16 }}>Select where you want to hear the audio.</Text>

        <Pressable
          style={[styles.audioOptionItem, audioRoute === 'speaker' && styles.audioOptionSelected]}
          onPress={() => { setAudioRoute('speaker'); agoraManager.setEnableSpeakerphone(true); setShowAudioMenu(false); }}
        >
          <Ionicons name="volume-high" size={24} color={audioRoute === 'speaker' ? colors.primary : colors.ink} />
          <Text style={[styles.audioOptionText, audioRoute === 'speaker' && styles.audioOptionTextSelected]}>Speakerphone</Text>
        </Pressable>

        <Pressable
          style={[styles.audioOptionItem, audioRoute === 'earpiece' && styles.audioOptionSelected]}
          onPress={() => { setAudioRoute('earpiece'); agoraManager.setEnableSpeakerphone(false); setShowAudioMenu(false); }}
        >
          <Ionicons name="ear" size={24} color={audioRoute === 'earpiece' ? colors.primary : colors.ink} />
          <Text style={[styles.audioOptionText, audioRoute === 'earpiece' && styles.audioOptionTextSelected]}>Phone Earpiece</Text>
        </Pressable>
        <Text style={{ marginTop: 16, fontSize: 12, color: colors.muted }}>
          Note: Bluetooth headsets will automatically switch when connected.
        </Text>
      </Modal>

      {/* ── Chat Modal ── */}
      <Modal
        visible={showChat}
        onClose={() => setShowChat(false)}
        title="Room Chat"
        containerStyle={{ flex: 1, padding: 0, backgroundColor: colors.bg }}
      >
        <View style={styles.chatModalContent}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatTitle}>Room Chat</Text>
            <Pressable onPress={() => setShowChat(false)} style={styles.closeBtn}>
              <Ionicons name="chevron-down" size={24} color={colors.ink} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.chatList}
            contentContainerStyle={styles.chatListContent}
            ref={chatScrollRef}
            onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.map(m => {
              const isMe = m.userId === getMockUser().id;
              return (
                <View key={m.messageId} style={[styles.msgRow, isMe && styles.msgRowMe]}>
                  <View style={[styles.msgBubble, isMe && styles.msgBubbleMe]}>
                    <View style={styles.msgMeta}>
                      <Text style={[styles.msgUser, isMe && styles.msgUserMe]}>{isMe ? "You" : m.userName}</Text>
                      <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>{timeAgo(m.createdAt)}</Text>
                    </View>
                    <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{m.content}</Text>
                  </View>
                  <Avatar name={m.userName} size={36} style={styles.chatAvatar} />
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.chatInputArea}>
            <View style={styles.chatInputWrapper}>
              <TextInput
                style={styles.chatInput}
                placeholder="Talk to the speakers..."
                placeholderTextColor={colors.muted}
                value={chatText}
                onChangeText={setChatText}
              />
              <Pressable style={styles.sendIconBtn} onPress={handleSendChat}>
                <Ionicons name="send" size={20} color={colors.ink} />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Metrics logic would go here if ended */}
    </SafeAreaView>
  );
}

function ProfileUnit({
  user,
  size = 64,
  isMeMod,
  onApprove,
  onRevoke
}: {
  user: Participant,
  size?: number,
  isMeMod?: boolean,
  onApprove?: () => void,
  onRevoke?: () => void
}) {
  return (
    <View style={styles.profileUnit}>
      <View>
        <Avatar name={user.userName} size={size} />
        {user.requestedSpeak && (
          <View style={styles.handBadge}>
            <Ionicons name="hand-right" size={14} color="#fff" />
          </View>
        )}
      </View>
      <Text style={styles.profileName} numberOfLines={1}>{user.userName}</Text>

      {user.role === 'moderator' && <Ionicons name="star" size={12} color={colors.primary} style={styles.modIcon} />}

      {isMeMod && user.role !== 'moderator' && (
        <View style={styles.modActionRow}>
          {user.role === 'listener' ? (
            <Pressable style={styles.approveBtn} onPress={onApprove}>
              <Ionicons name="mic-outline" size={12} color={colors.primary} />
              <Text style={styles.approveBtnText}>{user.requestedSpeak ? "APPROVE" : "MAKE SPEAKER"}</Text>
            </Pressable>
          ) : (
            <Pressable style={[styles.approveBtn, { borderColor: '#EF4444' }]} onPress={onRevoke}>
              <Ionicons name="mic-off-outline" size={12} color="#EF4444" />
              <Text style={[styles.approveBtnText, { color: '#EF4444' }]}>REVOKE</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function timeAgo(iso: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1A1A1A' }, // Dark background like Spaces
  container: { flex: 1, paddingHorizontal: 16 },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 13, fontWeight: "700", color: '#999' },

  approveBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 8 },
  approveBtnText: { fontSize: 9, fontWeight: '800', color: colors.primary },

  header: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  leaveText: { color: colors.primary, fontSize: 15, fontWeight: "800" },
  backBtn: { paddingRight: 12 },
  hTitle: { fontSize: 17, fontWeight: "900", color: '#fff' },

  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  statusLive: { borderWidth: 0 },
  statusEnded: {},
  statusText: { fontSize: 11, fontWeight: "900", color: '#fff' },

  handBadge: { position: 'absolute', bottom: -2, right: -2, backgroundColor: '#EF4444', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#1A1A1A' },
  modActionRow: { marginTop: 4 },

  agoraWarn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(245,158,11,0.1)', padding: 10, borderRadius: 12, marginTop: 8, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' },
  agoraWarnText: { color: '#F59E0B', fontSize: 11, fontWeight: '700', flex: 1 },

  gridArea: { flex: 1 },
  gridContent: { paddingBottom: 100 },
  gridSectionTitle: { color: '#666', fontSize: 12, fontWeight: '800', marginTop: 24, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },

  profileUnit: { width: (width - 72) / 3, alignItems: 'center', gap: 8 },
  profileName: { color: '#fff', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  modIcon: { position: 'absolute', top: 0, right: 10 },

  cornerChatBubble: { position: 'absolute', bottom: 100, right: 10, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8 },
  newChatIndicator: { position: 'absolute', top: 12, right: 12, width: 12, height: 12, borderRadius: 6, backgroundColor: '#EF4444', borderWidth: 2, borderColor: colors.primary },

  controls: { position: 'absolute', bottom: 20, left: 16, right: 16, flexDirection: 'row', gap: 16, padding: 16, backgroundColor: '#262626', borderRadius: 24, borderWidth: 1, borderColor: '#333' },
  controlBtn: { alignItems: 'center', gap: 4, width: 60 },
  controlBtnMuted: { backgroundColor: '#EF4444', borderRadius: 12, paddingVertical: 4 },
  controlLabel: { fontSize: 10, fontWeight: '800', color: '#999' },

  chatModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  chatModalContent: { flex: 1, backgroundColor: '#F6FFF9' }, // Light mint background
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 10 },
  chatTitle: { fontSize: 22, fontWeight: '900', color: colors.ink },
  closeBtn: { padding: 4 },
  chatList: { flex: 1 },
  chatListContent: { padding: 16, paddingBottom: 24 },

  audioOptionItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: '#f5f5f5', borderRadius: 12, marginBottom: 8 },
  audioOptionSelected: { backgroundColor: 'rgba(5, 150, 105, 0.1)', borderColor: colors.primary, borderWidth: 1 },
  audioOptionText: { fontSize: 16, fontWeight: '700', color: colors.ink },
  audioOptionTextSelected: { color: colors.primary },

  msgRow: { flexDirection: 'row', gap: 12, marginBottom: 20, alignItems: 'flex-start' },
  msgRowMe: { flexDirection: 'row-reverse' },
  chatAvatar: { backgroundColor: '#A78BFA' }, // Light purple like in image

  msgBubble: {
    maxWidth: '85%',
    backgroundColor: '#fff',
    borderRadius: 20,
    borderTopLeftRadius: 4,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  msgBubbleMe: {
    backgroundColor: colors.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 4,
  },
  msgMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, gap: 12 },
  msgUser: { fontSize: 13, fontWeight: '900', color: colors.primary },
  msgUserMe: { color: 'rgba(255,255,255,0.7)' },
  msgTime: { fontSize: 11, color: colors.muted },
  msgTimeMe: { color: 'rgba(255,255,255,0.5)' },
  msgText: { fontSize: 15, color: colors.ink, fontWeight: '600', lineHeight: 22 },
  msgTextMe: { color: '#fff' },

  chatInputArea: { padding: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16, backgroundColor: colors.bg },
  chatInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 28,
    paddingRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  chatInput: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.ink,
    fontWeight: '600'
  },
  sendIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
});
