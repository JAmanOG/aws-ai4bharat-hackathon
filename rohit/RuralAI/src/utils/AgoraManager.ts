import createAgoraRtcEngine, {
  ChannelProfileType,
  ClientRoleType,
  IRtcEngine,
  RtcConnection,
  RtcStats,
  UserOfflineReasonType,
} from 'react-native-agora';
import { PermissionsAndroid, Platform } from 'react-native';
import API_CONFIG from '../api/config';

const APP_ID = API_CONFIG.AGORA_APP_ID;

export class AgoraManager {
  private engine: IRtcEngine | null = null;
  private appId: string;

  constructor(appId: string = APP_ID) {
    this.appId = appId;
  }

  async initialize() {
    if (this.engine) return;

    try {
      if (Platform.OS === 'android') {
        await this.requestAudioPermission();
      }

      // Safe creation- if not in a native environment this might fail or be undefined
      if (typeof createAgoraRtcEngine === 'function') {
        this.engine = createAgoraRtcEngine();
        this.engine.initialize({
          appId: this.appId,
          channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
        });

        this.engine.enableAudio();
        this.engine.enableAudioVolumeIndication(200, 3, true);
        this.engine.setDefaultAudioRouteToSpeakerphone(true);
        console.log('[AGORA] Engine initialized successfully, routed to speakerphone');
      } else {
        console.warn('[AGORA] createAgoraRtcEngine is not available in this environment');
      }
    } catch (err) {
      console.warn('[AGORA] Failed to initialize engine. You might be in Expo Go.', err);
      this.engine = null;
    }
  }

  private async requestAudioPermission() {
    try {
      if (Platform.OS === 'android') {
        await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);
      }
    } catch (err) {
      console.warn('[AGORA] Permission error', err);
    }
  }

  async joinChannel(token: string, channelName: string, uid: number, isHost: boolean) {
    if (!this.engine) await this.initialize();

    console.log(`[AGORA] Joining channel: ${channelName}, UserID: ${uid}, Host: ${isHost}`);

    this.engine?.setClientRole(
      isHost ? ClientRoleType.ClientRoleBroadcaster : ClientRoleType.ClientRoleAudience
    );

    this.engine?.joinChannel(token, channelName, uid, {
      publishMicrophoneTrack: isHost,
      autoSubscribeAudio: true,
    });
  }

  async leaveChannel() {
    this.engine?.leaveChannel();
  }

  async setRole(isHost: boolean) {
    console.log(`[AGORA] Changing role. Host: ${isHost}`);
    this.engine?.setClientRole(
      isHost ? ClientRoleType.ClientRoleBroadcaster : ClientRoleType.ClientRoleAudience
    );
    // Explicitly update media options to start/stop publishing
    this.engine?.updateChannelMediaOptions({
      publishMicrophoneTrack: isHost,
      autoSubscribeAudio: true,
    });
  }

  async muteLocalAudio(muted: boolean) {
    this.engine?.muteLocalAudioStream(muted);
  }

  async setEnableSpeakerphone(speakerOn: boolean) {
    this.engine?.setEnableSpeakerphone(speakerOn);
  }

  on(eventName: string, callback: (...args: any[]) => void) {
    this.engine?.addListener(eventName as any, callback);
  }

  isAvailable() {
    return this.engine !== null;
  }

  destroy() {
    try {
      this.engine?.removeAllListeners();
      this.engine?.release();
    } catch (err) {
      console.warn('[AGORA] Destroy failed', err);
    }
    this.engine = null;
  }
}

export const agoraManager = new AgoraManager();
