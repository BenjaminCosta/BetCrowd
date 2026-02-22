import React from 'react';
import { View } from 'react-native';
import { Colors } from '../../theme/colors';
import { TopBar } from '../../components/TopBar';
import { useTheme } from '../../context/ThemeContext';
import CreateEventForm from '../../components/forms/CreateEventForm';

const CreateEventScreen = ({ navigation, route }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { tournamentId, eventId, editMode } = route.params || {};

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar showBackButton />
      <CreateEventForm
        tournamentId={tournamentId}
        eventId={eventId}
        editMode={editMode}
        onSuccess={() => navigation.goBack()}
      />
    </View>
  );
};

export default CreateEventScreen;
