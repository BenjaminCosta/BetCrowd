import React from 'react';
import { View } from 'react-native';
import { Colors } from '../../theme/colors';
import { TopBar } from '../../components/TopBar';
import { useTheme } from '../../context/ThemeContext';
import CreateTournamentForm from '../../components/forms/CreateTournamentForm';

const CreateTournamentScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar showBackButton />
      <CreateTournamentForm onSuccess={() => navigation.goBack()} />
    </View>
  );
};

export default CreateTournamentScreen;
