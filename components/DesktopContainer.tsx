import React from 'react';
import { View, StyleSheet, Platform, useWindowDimensions, ViewStyle, StyleProp } from 'react-native';

interface DesktopContainerProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  maxWidth?: number;
}

export function DesktopContainer({ children, style, maxWidth = 1400 }: DesktopContainerProps) {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  return (
    <View
      style={[
        styles.container,
        isDesktop && {
          maxWidth,
          width: '100%',
          alignSelf: 'center',
          paddingHorizontal: width > 1200 ? 32 : 20,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
});
