import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';

export const shareImageWebFallback = async (dataUri: string, fallbackText: string) => {
  if (Platform.OS !== 'web') return false;

  try {
    // Check if Web Share API with files is supported
    if (navigator.share && navigator.canShare) {
      const blob = await (await fetch(dataUri)).blob();
      const file = new File([blob], 'post.jpg', { type: 'image/jpeg' });
      
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Tracking App',
          text: fallbackText
        });
        return true;
      }
    }

    // Fallback: download the image if sharing isn't supported
    const link = document.createElement('a');
    link.href = dataUri;
    link.download = 'tracking-post.jpg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;

  } catch (e) {
    console.error('Web share/download failed:', e);
    return false;
  }
};
