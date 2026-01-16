import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';

interface CapacityWarningModalProps {
  visible: boolean;
  onRetry: () => Promise<boolean>;
  onDismiss?: () => void;
}

export function CapacityWarningModal({
  visible,
  onRetry,
  onDismiss,
}: CapacityWarningModalProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!visible) return;

    // Auto-retry every 5 seconds
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          handleRetry();
          return 5;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [visible]);

  const handleRetry = async () => {
    setIsRetrying(true);
    const hasCapacity = await onRetry();
    setIsRetrying(false);
    
    if (hasCapacity) {
      setCountdown(5);
    }
  };

  const handleDismiss = () => {
    setCountdown(5);
    onDismiss?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.icon}>🚫</Text>
          <Text style={styles.title}>Servers Full</Text>
          <Text style={styles.message}>
            We're at capacity right now. Please wait a moment.
          </Text>

          {isRetrying ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Checking...</Text>
            </View>
          ) : (
            <Text style={styles.countdown}>
              Retrying in {countdown} seconds...
            </Text>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.retryButton]}
              onPress={handleRetry}
              disabled={isRetrying}
            >
              <Text style={styles.retryButtonText}>
                {isRetrying ? 'Checking...' : 'Retry Now'}
              </Text>
            </TouchableOpacity>

            {onDismiss && (
              <TouchableOpacity
                style={[styles.button, styles.dismissButton]}
                onPress={handleDismiss}
                disabled={isRetrying}
              >
                <Text style={styles.dismissButtonText}>Go Back</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  icon: {
    fontSize: 72,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  loadingText: {
    color: '#007AFF',
    fontSize: 16,
    marginTop: 12,
    fontWeight: '600',
  },
  countdown: {
    color: '#666',
    fontSize: 14,
    marginBottom: 24,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  retryButton: {
    backgroundColor: '#007AFF',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  dismissButton: {
    backgroundColor: '#2C2C2E',
  },
  dismissButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
