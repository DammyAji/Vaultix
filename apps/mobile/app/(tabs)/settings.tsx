/**
 * Settings tab (#552).
 * Registered in `app/(tabs)/_layout.tsx` — before that it was unreachable and
 * the biometric lock shipped in #333 could never be turned on.
 */
import React from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useBiometricLock } from '../../hooks/useBiometricLock';
import { useSession } from '../../hooks/useSession';
import { CopyButton } from '../../components/CopyButton';

function truncateAddress(address: string): string {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}…${address.slice(-6)}`;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { isSupported, isEnrolled, isEnabled, enableBiometric, disableBiometric } = useBiometricLock();
  const { walletAddress, isAuthenticated, isGuest, signOut, exitGuestMode } = useSession();

  const handleToggle = async (value: boolean) => {
    if (value) {
      await enableBiometric();
    } else {
      await disableBiometric();
    }
  };

  const handleConnect = () => {
    exitGuestMode();
    router.replace('/');
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign out',
      'Your wallet key stays on this device, but you will need to sign in again to act on escrows.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/');
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Settings</Text>

      {/* --- Wallet / session (#550) --- */}
      <Text style={styles.sectionTitle}>Wallet</Text>
      <View style={styles.card}>
        {isAuthenticated && walletAddress ? (
          <>
            <View style={styles.settingRow}>
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>Connected</Text>
                <Text style={styles.settingDescription}>{truncateAddress(walletAddress)}</Text>
              </View>
              <CopyButton value={walletAddress} label="Copy" toastMessage="Address copied" />
            </View>
            <TouchableOpacity
              style={styles.dangerBtn}
              onPress={handleSignOut}
              accessibilityRole="button"
              accessibilityLabel="Sign out of Vaultix"
            >
              <Text style={styles.dangerBtnText}>Sign out</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.settingRow}>
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>
                  {isGuest ? 'Read-only mode' : 'Not connected'}
                </Text>
                <Text style={styles.settingDescription}>
                  Connect a wallet to create, fund or release escrows.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleConnect}
              accessibilityRole="button"
              accessibilityLabel="Connect a wallet"
            >
              <Text style={styles.primaryBtnText}>Connect wallet</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* --- Security (#333 / #552) --- */}
      <Text style={styles.sectionTitle}>Security</Text>
      <View style={styles.card}>
        <View style={styles.settingRow}>
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>Biometric App Lock</Text>
            <Text style={styles.settingDescription}>
              {!isSupported || !isEnrolled
                ? 'Biometrics not supported or not set up on this device.'
                : 'Require FaceID/TouchID when opening Vaultix'}
            </Text>
          </View>
          <Switch
            value={isEnabled}
            onValueChange={handleToggle}
            disabled={!isSupported || !isEnrolled}
            accessibilityLabel="Toggle biometric app lock"
            trackColor={{ false: '#334155', true: '#3B82F6' }}
            thumbColor={isEnabled ? '#ffffff' : '#94A3B8'}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  // Extra bottom room so the last card never sits under the tab bar / home indicator.
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingText: {
    flex: 1,
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    color: '#94A3B8',
  },
  primaryBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  dangerBtn: {
    borderWidth: 1,
    borderColor: '#ef476f',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  dangerBtnText: { color: '#ef476f', fontWeight: '700', fontSize: 15 },
});
