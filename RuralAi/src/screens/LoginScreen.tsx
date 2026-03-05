/**
 * LoginScreen – Registration & Login with phone + PIN.
 *
 * Features:
 *   - Phone number input (10+ digits)
 *   - 4-6 digit numeric PIN
 *   - Toggle between Login / Register
 *   - Optional name + language for registration
 *   - "Continue as Guest" demo mode
 *   - DigiLocker verification (post-registration)
 *
 * Navigated to from RootNavigator when not authenticated.
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme/colors';

type Mode = 'login' | 'register';

const LANGUAGES = [
  { code: 'hi', label: 'हिन्दी' },
  { code: 'en', label: 'English' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'mr', label: 'मराठी' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'gu', label: 'ગુજરાતી' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ' },
];

export default function LoginScreen() {
  const { login, register, skipAuth } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('hi');
  const [loading, setLoading] = useState(false);
  const pinRef = useRef<TextInput>(null);

  const isValid = phone.length >= 10 && pin.length >= 4;

  async function handleSubmit() {
    if (!isValid) return;
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(phone, pin);
      } else {
        await register({ phone, pin, name, language });
      }
    } catch (err: any) {
      Alert.alert(
        mode === 'login' ? 'Login Failed' : 'Registration Failed',
        err.message || 'Please try again',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Logo / Header */}
          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <Ionicons name="leaf" size={40} color={colors.primary} />
            </View>
            <Text style={styles.title}>Rural AI</Text>
            <Text style={styles.subtitle}>
              {mode === 'login' ? 'Welcome back!' : 'Create your account'}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Name (register only) */}
            {mode === 'register' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Name (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Your name / आपका नाम"
                  placeholderTextColor={colors.muted}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>
            )}

            {/* Phone */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="10-digit mobile number"
                placeholderTextColor={colors.muted}
                value={phone}
                onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, ''))}
                keyboardType="phone-pad"
                maxLength={15}
                returnKeyType="next"
                onSubmitEditing={() => pinRef.current?.focus()}
              />
            </View>

            {/* PIN */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>PIN (4-6 digits)</Text>
              <TextInput
                ref={pinRef}
                style={styles.input}
                placeholder="••••"
                placeholderTextColor={colors.muted}
                value={pin}
                onChangeText={(t) => setPin(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
            </View>

            {/* Language (register only) */}
            {mode === 'register' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Preferred Language</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.langRow}>
                  {LANGUAGES.map((l) => (
                    <TouchableOpacity
                      key={l.code}
                      style={[styles.langChip, language === l.code && styles.langChipActive]}
                      onPress={() => setLanguage(l.code)}
                    >
                      <Text style={[styles.langText, language === l.code && styles.langTextActive]}>
                        {l.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={[styles.button, !isValid && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={!isValid || loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  {mode === 'login' ? 'Login' : 'Register'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Toggle mode */}
            <TouchableOpacity
              style={styles.toggleBtn}
              onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
            >
              <Text style={styles.toggleText}>
                {mode === 'login'
                  ? "Don't have an account? Register"
                  : 'Already have an account? Login'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Demo mode */}
          <TouchableOpacity style={styles.demoBtn} onPress={skipAuth}>
            <Ionicons name="play-circle-outline" size={18} color={colors.muted} />
            <Text style={styles.demoText}>Continue as Guest</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },

  header: { alignItems: 'center', marginBottom: 32 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primaryTint,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 28, fontWeight: '700', color: colors.ink },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 4 },

  form: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink, marginBottom: 6 },
  input: {
    height: 48, borderRadius: 10,
    backgroundColor: colors.bg,
    paddingHorizontal: 14,
    fontSize: 16, color: colors.ink,
    borderWidth: 1, borderColor: colors.border,
  },

  langRow: { flexDirection: 'row', marginTop: 4 },
  langChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.bg,
    marginRight: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  langChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  langText: { fontSize: 13, color: colors.ink },
  langTextActive: { color: '#fff', fontWeight: '600' },

  button: {
    height: 50, borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  toggleBtn: { alignItems: 'center', marginTop: 16 },
  toggleText: { color: colors.primary, fontSize: 14 },

  demoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 24, paddingVertical: 12,
  },
  demoText: { color: colors.muted, fontSize: 14, marginLeft: 6 },
});
