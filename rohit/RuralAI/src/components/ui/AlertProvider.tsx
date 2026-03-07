import React, { createContext, useContext, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Modal } from './Modal';
import { Button } from './Button';
import { colors } from '../../theme/colors';

interface AlertAction {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertOptions {
  title: string;
  message: string;
  actions?: AlertAction[];
}

interface AlertContextType {
  showAlert: (options: AlertOptions) => void;
  hideAlert: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<AlertOptions | null>(null);

  const showAlert = useCallback((opts: AlertOptions) => {
    setOptions(opts);
    setVisible(true);
  }, []);

  const hideAlert = useCallback(() => {
    setVisible(false);
  }, []);

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      <Modal
        visible={visible}
        onClose={hideAlert}
        type="center"
        containerStyle={styles.modalContainer}
      >
        <View style={styles.content}>
          <Text style={styles.title}>{options?.title}</Text>
          <Text style={styles.message}>{options?.message}</Text>

          <View style={styles.footer}>
            {options?.actions ? (
              options.actions.map((action, index) => (
                <Button
                  key={index}
                  label={action.text}
                  variant={
                    action.style === 'destructive'
                      ? 'destructive'
                      : action.style === 'cancel'
                        ? 'outline'
                        : 'primary'
                  }
                  size="sm"
                  style={styles.button}
                  onPress={() => {
                    hideAlert();
                    if (action.onPress) action.onPress();
                  }}
                />
              ))
            ) : (
              <Button
                label="OK"
                onPress={hideAlert}
                style={styles.button}
              />
            )}
          </View>
        </View>
      </Modal>
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  modalContainer: {
    padding: 20,
    backgroundColor: '#fff',
  },
  content: {
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    justifyContent: 'center',
  },
  button: {
    flex: 1,
    minWidth: 100,
  },
});
