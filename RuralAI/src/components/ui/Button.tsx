import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  TouchableOpacityProps
} from 'react-native';
import { colors } from '../../theme/colors';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  labelStyle?: TextStyle;
}

export const Button = ({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  style,
  labelStyle,
  disabled,
  ...props
}: ButtonProps) => {
  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'primary':
        return styles.primary;
      case 'secondary':
        return styles.secondary;
      case 'outline':
        return styles.outline;
      case 'ghost':
        return styles.ghost;
      case 'destructive':
        return styles.destructive;
      default:
        return styles.primary;
    }
  };

  const getLabelStyle = (): TextStyle => {
    switch (variant) {
      case 'primary':
      case 'secondary':
      case 'destructive':
        return styles.labelLight;
      case 'outline':
      case 'ghost':
        return styles.labelDark;
      default:
        return styles.labelLight;
    }
  };

  const getSizeStyle = (): ViewStyle => {
    switch (size) {
      case 'sm':
        return styles.sm;
      case 'md':
        return styles.md;
      case 'lg':
        return styles.lg;
      default:
        return styles.md;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      disabled={disabled || loading}
      style={[
        styles.base,
        getVariantStyle(),
        getSizeStyle(),
        disabled && styles.disabled,
        style
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? colors.primary : '#fff'} />
      ) : (
        <>
          {icon}
          <Text style={[styles.labelBase, getLabelStyle(), labelStyle]}>
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    gap: 8,
  },
  sm: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  md: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  lg: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: '#374151', // Dark grey
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  destructive: {
    backgroundColor: '#EF4444',
  },
  labelBase: {
    fontSize: 14,
    fontWeight: '600',
  },
  labelLight: {
    color: '#FFFFFF',
  },
  labelDark: {
    color: colors.ink,
  },
  disabled: {
    opacity: 0.5,
  },
});
