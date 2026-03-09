import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { badgeLabel } from "../healthDashboardUtils";
import { PALETTE, styles } from "../healthDashboardTheme";

export function DashboardSheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheetWrap}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable style={styles.sheetClose} onPress={onClose}>
              <Ionicons name="close" size={22} color={PALETTE.ink} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function IconTile({ icon }: { icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.iconTile}>
      <Ionicons name={icon} size={42} color={PALETTE.ink} />
    </View>
  );
}

export function ProviderBadge({ label, mono = false }: { label: string; mono?: boolean }) {
  return (
    <View style={[styles.providerBadge, mono && styles.providerBadgeMono]}>
      <Text style={[styles.providerBadgeText, mono && styles.providerBadgeTextMono]}>
        {badgeLabel(label)}
      </Text>
    </View>
  );
}
