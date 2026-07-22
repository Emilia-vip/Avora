import { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing } from '@/constants/theme';

type AuthScreenProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  logoIcon?: ReactNode; 
};

export function AuthScreen({ title, subtitle, children, footer, logoIcon }: AuthScreenProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          
          {/* Header-sektion */}
          <View style={styles.header}>
            <View style={[styles.logo, { backgroundColor: '#1C1B1B' }]}>
              {logoIcon ? (
                logoIcon
              ) : (
              
                <Ionicons name="shirt-outline" size={28} color="#FFFFFF" />
              )}
            </View>
            <Text style={[styles.brand, { color: '#1C1B1B' }]}>Virtual Wardrobe</Text>
            <Text style={[styles.brandSubtitle, { color: '#7E7E7E' }]}>Your personal style, curated.</Text>
          </View>

          {/* Titelsektion */}
          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: '#1C1B1B' }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: '#7E7E7E' }]}>{subtitle}</Text>
          </View>

          {/* Formulär-sektion (Kortet är borttaget, nu en ren container) */}
          <View style={styles.formContainer}>
            {children}
          </View>

          {/* Footer-sektion */}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
          
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl, // Lite mer luft på sidorna som i bilden
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    justifyContent: 'space-between', // Sprider ut elementen elegant över skärmen
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 18, // Mjukt rundade hörn på logotypen
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  logoText: {
    fontSize: 28,
  },
  brand: {
    fontSize: 24,
    fontWeight: '400',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', // Elegant serif-typsnitt som i bilden
    textAlign: 'center',
  },
  brandSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    marginTop: 4,
    color: '#7E7E7E',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: '400',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', // Samma serif-stil här
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#7E7E7E',
    marginTop: 6,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  footer: {
    alignItems: 'center',
    marginTop: 'auto', // Skuffar ner footern till botten
    paddingBottom: 10,
  },
});