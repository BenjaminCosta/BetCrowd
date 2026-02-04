import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients } from '../theme/colors';
import { TopBar } from '../components/TopBar';
import { useTheme } from '../context/ThemeContext';

const JoinCodeScreen = ({ navigation }: any) => {
  const [code, setCode] = useState('');
  const { theme } = useTheme();
  const colors = Colors[theme];

  const handleJoin = () => {
    // Lógica para unirse al torneo
    navigation.navigate('TournamentDetails');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopBar showBackButton />
      
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Unirse con Código
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Ingresa el código del torneo privado
        </Text>

        <View style={styles.form}>
          <TextInput
            style={[styles.input, {
              backgroundColor: colors.secondary,
              color: colors.foreground,
              borderColor: colors.border,
            }]}
            placeholder="Código del torneo"
            placeholderTextColor={colors.mutedForeground}
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            maxLength={8}
          />

          <TouchableOpacity onPress={handleJoin} disabled={code.length < 6}>
            <LinearGradient
              colors={Gradients.primary as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.joinButton,
                code.length < 6 && { opacity: 0.5 },
              ]}
            >
              <Text style={styles.joinButtonText}>Unirse al Torneo</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  form: {
    gap: 16,
  },
  input: {
    height: 56,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    borderWidth: 1,
    textAlign: 'center',
    letterSpacing: 4,
    fontWeight: '700',
  },
  joinButton: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default JoinCodeScreen;
