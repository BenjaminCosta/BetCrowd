import React from 'react';
import { View } from 'react-native';
import { Colors } from '../../theme/colors';
import { TopBar } from '../../components/TopBar';
import { useTheme } from '../../context/ThemeContext';
import CreateBetForm from '../../components/forms/CreateBetForm';

const CreateBetScreen = ({ navigation, route }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { tournamentId, eventId } = route.params || {};

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar showBackButton />
      <CreateBetForm
        tournamentId={tournamentId}
        eventId={eventId}
        onSuccess={() => navigation.goBack()}
      />
    </View>
  );
};

export default CreateBetScreen;
