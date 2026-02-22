import React from 'react';
import { View } from 'react-native';
import { Colors } from '../theme/colors';
import { TopBar } from '../components/TopBar';
import { useTheme } from '../context/ThemeContext';
import SearchPanel from '../components/forms/SearchPanel';

const SearchScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar showBackButton />
      <SearchPanel onClose={() => navigation.goBack()} />
    </View>
  );
};

export default SearchScreen;
