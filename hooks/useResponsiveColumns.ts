import { useWindowDimensions, Platform } from 'react-native';

export function useResponsiveColumns(mobileCols = 2) {
  const { width } = useWindowDimensions();

  if (Platform.OS !== 'web') {
    return {
      numColumns: mobileCols,
      isDesktop: false,
      isWide: false,
      width,
    };
  }

  if (width >= 1600) {
    return { numColumns: 7, isDesktop: true, isWide: true, width };
  }
  if (width >= 1280) {
    return { numColumns: 6, isDesktop: true, isWide: true, width };
  }
  if (width >= 1024) {
    return { numColumns: 5, isDesktop: true, isWide: true, width };
  }
  if (width >= 768) {
    return { numColumns: 4, isDesktop: true, isWide: false, width };
  }
  if (width >= 600) {
    return { numColumns: 3, isDesktop: false, isWide: false, width };
  }

  return { numColumns: mobileCols, isDesktop: false, isWide: false, width };
}
