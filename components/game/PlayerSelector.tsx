import { PlayerNames } from '@/config/firestore-schema';
import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface PlayerSelectorProps {
  players: string[];
  playerNames: PlayerNames;
  currentPlayerId: string;
  selectedPlayerId: string | null;
  onSelect: (playerId: string) => void;
  disabled?: boolean;
  submissionPlayerId: string; // The actual owner (to exclude from options)
}

/**
 * Component for selecting which player submitted an answer
 * Shows players by their actual names
 */
export function PlayerSelector({
  players,
  playerNames,
  currentPlayerId,
  selectedPlayerId,
  onSelect,
  disabled = false,
  submissionPlayerId,
}: PlayerSelectorProps) {
  const [modalVisible, setModalVisible] = useState(false);

  // Get player display name from playerNames map
  const getPlayerLabel = (playerId: string): string => {
    if (playerId === currentPlayerId) {
      return 'You';
    }
    return playerNames[playerId] || `Player ${players.indexOf(playerId) + 1}`;
  };

  // Get the display label for the selected player
  const getSelectedLabel = (): string => {
    if (!selectedPlayerId) {
      return 'Select player...';
    }
    return getPlayerLabel(selectedPlayerId);
  };

  const handleSelect = (playerId: string) => {
    onSelect(playerId);
    setModalVisible(false);
  };

  // Check if this is the current player's own submission (shouldn't be selectable)
  const isOwnSubmission = submissionPlayerId === currentPlayerId;

  if (isOwnSubmission) {
    return (
      <View style={styles.ownSubmission}>
        <Text style={styles.ownSubmissionText}>This is your answer</Text>
      </View>
    );
  }

  return (
    <>
      <Pressable
        style={[
          styles.selector,
          selectedPlayerId && styles.selectorSelected,
          disabled && styles.selectorDisabled,
        ]}
        onPress={() => !disabled && setModalVisible(true)}
        disabled={disabled}
      >
        <Text style={styles.selectorLabel}>Who said this?</Text>
        <View style={styles.selectorValue}>
          <Text
            style={[
              styles.selectorText,
              !selectedPlayerId && styles.selectorPlaceholder,
            ]}
          >
            {getSelectedLabel()}
          </Text>
          <Text style={styles.selectorArrow}>▼</Text>
        </View>
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Who said this?</Text>
            <ScrollView style={styles.playerList}>
              {players.map((playerId) => {
                // Skip the current player as an option
                if (playerId === currentPlayerId) {
                  return null;
                }

                const isSelected = selectedPlayerId === playerId;
                const label = getPlayerLabel(playerId);

                return (
                  <TouchableOpacity
                    key={playerId}
                    style={[
                      styles.playerOption,
                      isSelected && styles.playerOptionSelected,
                    ]}
                    onPress={() => handleSelect(playerId)}
                  >
                    <Text
                      style={[
                        styles.playerOptionText,
                        isSelected && styles.playerOptionTextSelected,
                      ]}
                    >
                      {label}
                    </Text>
                    {isSelected && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  selector: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 8,
  },
  selectorSelected: {
    borderColor: 'rgba(168, 85, 247, 0.5)',
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
  },
  selectorDisabled: {
    opacity: 0.5,
  },
  selectorLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectorValue: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  selectorPlaceholder: {
    color: '#666',
    fontWeight: '400',
  },
  selectorArrow: {
    fontSize: 12,
    color: '#666',
  },
  ownSubmission: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 2,
    borderColor: 'rgba(52, 199, 89, 0.3)',
  },
  ownSubmissionText: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '500',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  playerList: {
    maxHeight: 300,
  },
  playerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 8,
  },
  playerOptionSelected: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    borderWidth: 2,
    borderColor: '#a855f7',
  },
  playerOptionText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  playerOptionTextSelected: {
    color: '#c4b5fd',
  },
  checkmark: {
    fontSize: 18,
    color: '#a855f7',
    fontWeight: '700',
  },
  cancelButton: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#9ca3af',
    fontWeight: '600',
  },
});
