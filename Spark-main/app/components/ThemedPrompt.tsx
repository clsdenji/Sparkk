import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

type Button = {
  text: string;
  style?: 'default' | 'destructive' | 'cancel';
  onPress?: () => void;
};

export default function ThemedPrompt({
  visible,
  title,
  message,
  buttons = [{ text: 'OK' }],
  onRequestClose,
}: {
  visible: boolean;
  title?: string;
  message?: string;
  buttons?: Button[];
  onRequestClose?: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.row}>
            {buttons.map((b, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => {
                  try {
                    b.onPress?.();
                  } catch {}
                  onRequestClose?.();
                }}
                style={[
                  styles.btn,
                  b.style === 'destructive' ? styles.destructive : undefined,
                  b.style === 'cancel' ? styles.cancel : undefined,
                ]}
              >
                <Text style={[styles.btnText, b.style === 'destructive' ? styles.destructiveText : undefined]}>{b.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#0b0b0b',
    borderRadius: 14,
    padding: 18,
    borderWidth: 2,
    borderColor: '#FFD166',
  },
  title: {
    color: '#FFD166',
    fontWeight: '700',
    fontSize: 18,
    marginBottom: 6,
  },
  message: {
    color: '#ddd',
    fontSize: 14,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#111',
  },
  btnText: {
    color: '#FFD166',
    fontWeight: '700',
  },
  destructive: {
    backgroundColor: '#2a0b0b',
  },
  destructiveText: {
    color: '#FF7B7B',
  },
  cancel: {
    backgroundColor: '#222',
  },
});
