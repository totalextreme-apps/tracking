import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Pressable, Text, View } from 'react-native';

const ERROR_MESSAGES: Record<string, string> = {
    otp_expired: 'That sign-in link has expired. Please request a new one.',
    access_denied: 'Access was denied. Please try signing in again.',
    invalid_token: 'The sign-in link is invalid. Please request a new one.',
};

interface Props {
    errorCode: string;
    errorDescription: string;
    onDismiss: () => void;
}

export function AuthErrorBanner({ errorCode, errorDescription, onDismiss }: Props) {
    const message = ERROR_MESSAGES[errorCode] ?? errorDescription ?? 'An authentication error occurred.';

    return (
        <View
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 1000,
                backgroundColor: '#7f1d1d',
                borderBottomWidth: 1,
                borderBottomColor: '#991b1b',
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 12,
            }}
        >
            <FontAwesome name="exclamation-triangle" size={14} color="#fca5a5" style={{ marginRight: 10 }} />
            <Text
                style={{
                    flex: 1,
                    color: '#fecaca',
                    fontFamily: 'SpaceMono',
                    fontSize: 12,
                }}
            >
                {message}
            </Text>
            <Pressable onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <FontAwesome name="times" size={14} color="#fca5a5" />
            </Pressable>
        </View>
    );
}
