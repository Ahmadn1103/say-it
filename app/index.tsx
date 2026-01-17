import { BannerAd } from '@/components/ads/BannerAd';
import { CapacityWarningModal } from '@/components/modals/CapacityWarningModal';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { GradientButton } from '@/components/ui/GradientButton';
import { checkCapacity, subscribeToCapacity } from '@/services/capacityService';
import { createRoom, joinRoom } from '@/services/roomService';
import { getAnonymousId, getPlayerName, setPlayerName } from '@/utils/anonymousId';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function HomeScreen() {
  const [playerNameInput, setPlayerNameInput] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [activeUsers, setActiveUsers] = useState(0);
  const [showCapacityWarning, setShowCapacityWarning] = useState(false);
  const [isApproachingCapacity, setIsApproachingCapacity] = useState(false);

  // Load saved player name on mount
  useEffect(() => {
    getPlayerName().then((name) => {
      if (name) {
        setPlayerNameInput(name);
      }
    });
  }, []);

  // Animated values for hover effects
  const createButtonScale = useRef(new Animated.Value(1)).current;
  const createButtonGlow = useRef(new Animated.Value(0)).current;
  const joinButtonScale = useRef(new Animated.Value(1)).current;
  const joinButtonOpacity = useRef(new Animated.Value(0.8)).current;

  const animateButtonIn = (scale: Animated.Value, glow?: Animated.Value, opacity?: Animated.Value) => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1.05,
        friction: 3,
        tension: 100,
        useNativeDriver: true,
      }),
      glow ? Animated.timing(glow, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }) : null,
      opacity ? Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }) : null,
    ].filter(Boolean) as Animated.CompositeAnimation[]).start();
  };

  const animateButtonOut = (scale: Animated.Value, glow?: Animated.Value, opacity?: Animated.Value) => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 3,
        tension: 100,
        useNativeDriver: true,
      }),
      glow ? Animated.timing(glow, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }) : null,
      opacity ? Animated.timing(opacity, {
        toValue: 0.8,
        duration: 150,
        useNativeDriver: true,
      }) : null,
    ].filter(Boolean) as Animated.CompositeAnimation[]).start();
  };

  const animateButtonPress = (scale: Animated.Value) => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 3,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  useEffect(() => {
    // Subscribe to capacity changes
    const unsubscribe = subscribeToCapacity((count, isAtCapacity) => {
      setActiveUsers(count);
      setIsApproachingCapacity(count > 4500); // 90% of 5000
      if (isAtCapacity && (isCreating || isJoining)) {
        setShowCapacityWarning(true);
      }
    });

    return () => unsubscribe();
  }, [isCreating, isJoining]);

  const handleCreateRoom = async () => {
    // Validate name
    const trimmedName = playerNameInput.trim();
    if (!trimmedName) {
      Alert.alert('Enter Your Name', 'Please enter your name to continue');
      return;
    }
    if (trimmedName.length < 2) {
      Alert.alert('Name Too Short', 'Please enter at least 2 characters');
      return;
    }
    if (trimmedName.length > 15) {
      Alert.alert('Name Too Long', 'Please keep your name under 15 characters');
      return;
    }

    try {
      setIsCreating(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Check capacity
      const hasCapacity = await checkCapacity();
      if (!hasCapacity) {
        setShowCapacityWarning(true);
        return;
      }

      // Save player name
      await setPlayerName(trimmedName);

      // Get anonymous ID
      const playerId = await getAnonymousId();
      
      // Create room with player name
      const room = await createRoom(playerId, trimmedName);

      // Navigate to lobby
      router.push({
        pathname: '/lobby',
        params: { roomCode: room.code, isHost: 'true' },
      });
    } catch (error) {
      console.error('Error creating room:', error);
      Alert.alert('Error', 'Failed to create room. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    // Validate name
    const trimmedName = playerNameInput.trim();
    if (!trimmedName) {
      Alert.alert('Enter Your Name', 'Please enter your name to continue');
      return;
    }
    if (trimmedName.length < 2) {
      Alert.alert('Name Too Short', 'Please enter at least 2 characters');
      return;
    }
    if (trimmedName.length > 15) {
      Alert.alert('Name Too Long', 'Please keep your name under 15 characters');
      return;
    }

    if (joinCode.trim().length !== 6) {
      Alert.alert('Invalid Code', 'Please enter a 6-character room code');
      return;
    }

    try {
      setIsJoining(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Check capacity
      const hasCapacity = await checkCapacity();
      if (!hasCapacity) {
        setShowCapacityWarning(true);
        return;
      }

      // Save player name
      await setPlayerName(trimmedName);

      // Get anonymous ID
      const playerId = await getAnonymousId();
      
      // Join room with player name
      await joinRoom(joinCode.toUpperCase(), playerId, trimmedName);

      // Navigate to lobby
      router.push({
        pathname: '/lobby',
        params: { roomCode: joinCode.toUpperCase(), isHost: 'false' },
      });
    } catch (error: any) {
      console.error('Error joining room:', error);
      Alert.alert('Error', error.message || 'Failed to join room. Please check the code and try again.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleCapacityRetry = async (): Promise<boolean> => {
    const hasCapacity = await checkCapacity();
    if (hasCapacity) {
      setShowCapacityWarning(false);
    }
    return hasCapacity;
  };

  return (
    <GradientBackground>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          {/* Logo/Title */}
          <View style={styles.header}>
            <Text style={styles.logo}>
              Say <Text style={styles.logoAccent}>It</Text>
            </Text>
            <Text style={styles.tagline}>The party guessing game</Text>
          </View>

          {/* Name Input */}
          <View style={styles.nameInputContainer}>
            <Text style={styles.nameLabel}>Your Name</Text>
            <BlurView intensity={30} tint="dark" style={styles.nameInputWrapper}>
              <TextInput
                style={styles.nameInput}
                placeholder="Enter your name..."
                placeholderTextColor="#666"
                value={playerNameInput}
                onChangeText={setPlayerNameInput}
                maxLength={15}
                autoCorrect={false}
                editable={!isCreating && !isJoining}
              />
            </BlurView>
          </View>

          {/* Capacity Warning */}
          {isApproachingCapacity && (
            <BlurView intensity={20} style={styles.capacityWarning}>
              <Text style={styles.capacityWarningText}>
                ⚠️ Server capacity: {activeUsers} / 5000 users
              </Text>
            </BlurView>
          )}

          {/* Buttons Container */}
          <View style={styles.buttonsContainer}>
            {/* Create Room Button - Fancy Animated */}
            <Pressable
              onPress={() => {
                animateButtonPress(createButtonScale);
                handleCreateRoom();
              }}
              onHoverIn={() => animateButtonIn(createButtonScale, createButtonGlow)}
              onHoverOut={() => animateButtonOut(createButtonScale, createButtonGlow)}
              onPressIn={() => Animated.timing(createButtonScale, { toValue: 0.97, duration: 100, useNativeDriver: true }).start()}
              onPressOut={() => Animated.spring(createButtonScale, { toValue: 1, friction: 3, useNativeDriver: true }).start()}
              disabled={isCreating || isJoining}
            >
              <Animated.View
                style={[
                  styles.primaryButton,
                  isCreating && styles.buttonDisabled,
                  {
                    transform: [{ scale: createButtonScale }],
                    shadowOpacity: createButtonGlow.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 0.8],
                    }),
                    shadowRadius: createButtonGlow.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 25],
                    }),
                  },
                ]}
              >
                <GradientButton>
                  {isCreating ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Create Room</Text>
                  )}
                </GradientButton>
              </Animated.View>
            </Pressable>

            {/* Join Room Button or Input - Fancy Animated */}
            {!showJoinInput ? (
              <Pressable
                onPress={() => {
                  animateButtonPress(joinButtonScale);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowJoinInput(true);
                }}
                onHoverIn={() => animateButtonIn(joinButtonScale, undefined, joinButtonOpacity)}
                onHoverOut={() => animateButtonOut(joinButtonScale, undefined, joinButtonOpacity)}
                onPressIn={() => Animated.timing(joinButtonScale, { toValue: 0.97, duration: 100, useNativeDriver: true }).start()}
                onPressOut={() => Animated.spring(joinButtonScale, { toValue: 1, friction: 3, useNativeDriver: true }).start()}
                disabled={isCreating}
              >
                <Animated.View
                  style={[
                    styles.secondaryButton,
                    {
                      transform: [{ scale: joinButtonScale }],
                      opacity: joinButtonOpacity,
                    },
                  ]}
                >
                  <BlurView intensity={30} tint="dark" style={styles.glassButton}>
                    <Text style={styles.secondaryButtonText}>Join Room</Text>
                  </BlurView>
                </Animated.View>
              </Pressable>
            ) : (
              <BlurView intensity={30} tint="dark" style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="XXXXXX"
                  placeholderTextColor="#666"
                  value={joinCode}
                  onChangeText={(text) => setJoinCode(text.toUpperCase())}
                  maxLength={6}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!isJoining && !isCreating}
                  autoFocus
                  onBlur={() => {
                    if (joinCode.trim().length === 0) {
                      setShowJoinInput(false);
                    }
                  }}
                  onSubmitEditing={handleJoinRoom}
                />
                {joinCode.trim().length === 6 && (
                  <TouchableOpacity
                    style={styles.submitButton}
                    onPress={handleJoinRoom}
                    disabled={isJoining}
                  >
                    {isJoining ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.submitButtonText}>→</Text>
                    )}
                  </TouchableOpacity>
                )}
              </BlurView>
            )}
          </View>

          {/* Disclaimer */}
          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>
              Guess who said it • 16+
            </Text>
          </View>
        </View>

        {/* Banner Ad */}
        <BannerAd position="bottom" />

        {/* Capacity Warning Modal */}
        <CapacityWarningModal
          visible={showCapacityWarning}
          onRetry={handleCapacityRetry}
          onDismiss={() => {
            setShowCapacityWarning(false);
            setIsCreating(false);
            setIsJoining(false);
          }}
        />
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  buttonsContainer: {
    gap: 16,
  },
  nameInputContainer: {
    marginBottom: 24,
  },
  nameLabel: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  nameInputWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(125, 211, 252, 0.3)',
  },
  nameInput: {
    fontSize: 20,
    color: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontWeight: '600',
  },
  logo: {
    fontSize: 64,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  logoAccent: {
    color: '#7dd3fc', // Light blue/cyan accent
  },
  tagline: {
    fontSize: 16,
    color: '#7dd3fc',
    fontWeight: '500',
  },
  capacityWarning: {
    borderRadius: 16,
    overflow: 'hidden',
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.3)',
  },
  capacityWarningText: {
    color: '#FF9500',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#7dd3fc',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 8,
    elevation: 4,
  },
  glassButton: {
    paddingVertical: 20,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  inputContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: 'rgba(167, 139, 250, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 32,
    color: '#FFFFFF',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 12,
    fontWeight: '700',
  },
  submitButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(167, 139, 250, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  disclaimer: {
    marginTop: 48,
    alignItems: 'center',
  },
  disclaimerText: {
    fontSize: 14,
    color: '#b6bdcc',
    fontWeight: '500',
  },
});
