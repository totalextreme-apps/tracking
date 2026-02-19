import { useSound } from '@/context/SoundContext';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { BlurView } from 'expo-blur';
import React from 'react';
import { Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface DeveloperAboutProps {
    isVisible: boolean;
    onClose: () => void;
}

export const DeveloperAbout: React.FC<DeveloperAboutProps> = ({ isVisible, onClose }) => {
    const { playSound } = useSound();

    const handleKofiPress = () => {
        playSound('click');
        Linking.openURL('https://ko-fi.com/N4N31UKK6D');
    };

    const handleEmailPress = () => {
        playSound('click');
        Linking.openURL('mailto:totalextremeapps@gmail.com');
    };

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={isVisible}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />

                <View style={styles.modalContent}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerText}>ABOUT THE DEVELOPER</Text>
                        <Pressable
                            onPress={() => {
                                playSound('click');
                                onClose();
                            }}
                            style={styles.closeButton}
                        >
                            <FontAwesome name="times" size={20} color="#666" />
                        </Pressable>
                    </View>

                    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                        {/* Bio Header */}
                        <View style={styles.bioHeader}>
                            <View style={styles.imageContainer}>
                                <Image
                                    source={require('../assets/images/josh_bio.png')}
                                    style={styles.devImage}
                                    resizeMode="cover"
                                />
                            </View>
                            <View style={styles.nameContainer}>
                                <Text style={styles.devName}>JOSH</Text>
                                <Text style={styles.devHandle}>totalextreme-apps</Text>
                            </View>
                        </View>

                        {/* Bio Text */}
                        <View style={styles.bioSection}>
                            <Text style={styles.bioText}>
                                Designing digital grails and building editors for 20 year old wrestling sims is my jam.
                                I have a Graphic Design background and a dangerous obsession with 90s/00s nerd culture,
                                pro wrestling, and the grainy warmth of horror VHS.
                            </Text>

                            <Text style={styles.bioText}>
                                When I’m not on the hunt to build my collection or perfecting a CRT glow,
                                I’m using AI to help build the tools I wish existed. Whether it’s giving your library a worn
                                slipcover with the Tracking app or fine-tuning .dat files in the EWR Editing Suite,
                                I’m always up to something to stay busy.
                            </Text>

                            <Text style={styles.bioText}>
                                If my projects helped you organize your stacks, waste away hours in TEW or finally fix that EWR mod,
                                consider tossing a coffee my way. Every bit goes straight into the "Rare Horror Tape & Energy Drink" fund.
                            </Text>
                        </View>

                        {/* Contact */}
                        <View style={styles.contactSection}>
                            <Text style={styles.contactLabel}>CONTACT</Text>
                            <Pressable onPress={handleEmailPress}>
                                <Text style={styles.contactEmail}>totalextremeapps@gmail.com</Text>
                            </Pressable>
                        </View>

                        {/* Ko-fi Button */}
                        <Pressable
                            onPress={handleKofiPress}
                            style={styles.kofiButton}
                        >
                            <Image
                                source={{ uri: 'https://storage.ko-fi.com/cdn/cup-border.png' }}
                                style={styles.kofiIcon}
                            />
                            <Text style={styles.kofiButtonText}>Support me on Ko-fi</Text>
                        </Pressable>

                        <View style={styles.spacer} />
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        maxWidth: 500,
        backgroundColor: '#0a0a0a',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#333',
        overflow: 'hidden',
        maxHeight: '80%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
    },
    headerText: {
        color: '#f59e0b',
        fontFamily: 'SpaceMono',
        fontSize: 16,
        fontWeight: 'bold',
    },
    closeButton: {
        padding: 5,
    },
    scrollView: {
        padding: 20,
    },
    bioHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 25,
    },
    imageContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#222',
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#f59e0b',
    },
    devImage: {
        width: '100%',
        height: '100%',
    },
    nameContainer: {
        marginLeft: 15,
    },
    devName: {
        color: '#fff',
        fontFamily: 'SpaceMono',
        fontSize: 24,
        fontWeight: 'bold',
    },
    devHandle: {
        color: '#666',
        fontFamily: 'SpaceMono',
        fontSize: 14,
    },
    bioSection: {
        marginBottom: 25,
    },
    bioText: {
        color: '#ccc',
        fontFamily: 'SpaceMono',
        fontSize: 14,
        lineHeight: 22,
        marginBottom: 15,
    },
    contactSection: {
        marginBottom: 30,
        padding: 15,
        backgroundColor: '#111',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#222',
    },
    contactLabel: {
        color: '#666',
        fontFamily: 'SpaceMono',
        fontSize: 12,
        marginBottom: 5,
    },
    contactEmail: {
        color: '#f59e0b',
        fontFamily: 'SpaceMono',
        fontSize: 14,
        textDecorationLine: 'underline',
    },
    kofiButton: {
        backgroundColor: '#ff6200',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 15,
        borderRadius: 12,
        marginBottom: 10,
    },
    kofiIcon: {
        width: 24,
        height: 16,
        marginRight: 10,
    },
    kofiButtonText: {
        color: '#fff',
        fontFamily: 'SpaceMono',
        fontSize: 16,
        fontWeight: 'bold',
    },
    spacer: {
        height: 20,
    }
});
