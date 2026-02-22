import React from 'react';
import { View, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Colors, Spacing, BorderRadius } from '../theme/colors';
import { useTheme } from '../context/ThemeContext';

// ─── Props ────────────────────────────────────────────────────────────────────

interface SheetModalProps {
  visible: boolean;
  onClose: () => void;
  /** Content rendered inside the sheet */
  children: React.ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Generic 90%-height bottom sheet.
 * Same visual pattern as TournamentScreen's renderEventSheet.
 * Provides: backdrop, container, drag handle, X close button.
 * Children are responsible for their own title/content/scrolling.
 */
export const SheetModal: React.FC<SheetModalProps> = ({ visible, onClose, children }) => {
  const { theme } = useTheme();
  const colors = Colors[theme];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.overlay}>
          {/* Backdrop – tap to close */}
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={onClose}
          />

          {/* Sheet container */}
          <View style={[styles.container, { backgroundColor: colors.card }]}>
            {/* Drag handle */}
            <View style={[styles.handle, { backgroundColor: colors.border }]} />

            {/* Close row – X button right-aligned */}
            <View style={styles.closeRow}>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Content – flex: 1 so children can use their own ScrollView */}
            <View style={styles.content}>
              {children}
            </View>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  container: {
    height: '90%',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.md,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  closeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  closeBtn: {
    padding: Spacing.sm,
  },
  content: {
    flex: 1,
  },
});
