import React from 'react';
import { Image as RNImage, ImageStyle, StyleProp } from 'react-native';

export interface ExpoImageWebShimProps {
  source?: any;
  style?: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain' | 'fill' | 'none';
  priority?: 'low' | 'normal' | 'high';
  transition?: any;
  onLoad?: (event: any) => void;
  onError?: (event: any) => void;
  onLoadEnd?: () => void;
  [key: string]: any;
}

export const Image = React.forwardRef<any, ExpoImageWebShimProps>(
  ({ source, style, contentFit, priority, transition, ...props }, ref) => {
    // Map contentFit to resizeMode
    let resizeMode: 'cover' | 'contain' | 'stretch' | 'center' = 'cover';
    if (contentFit === 'contain') {
      resizeMode = 'contain';
    } else if (contentFit === 'fill') {
      resizeMode = 'stretch';
    } else if (contentFit === 'none') {
      resizeMode = 'center';
    }

    // Format source correctly
    let finalSource = source;
    if (typeof source === 'string') {
      finalSource = { uri: source };
    }

    return (
      <RNImage
        ref={ref}
        source={finalSource}
        style={style}
        resizeMode={resizeMode}
        {...props}
      />
    );
  }
);

export default Image;
