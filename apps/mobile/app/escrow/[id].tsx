/**
 * #315 – Mobile Escrow Detail: milestones, parties, timeline, role-gated actions
 */
import React, { useCallback, useEffect, useState } from 'react';
import {\n  ActivityIndicator,\n  ScrollView,\n  StyleSheet,\n  Text,\n  TouchableOpacity,\n  View,\n} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { escrowApi } from '../../services/api';
import { requireAuth } from '../../services/auth';
import { Escrow, Milestone, Party, EscrowEvent } from '../../types/escrow';
import { OfflineBanner } from '../../components/OfflineBanner';
import { CopyButton } from '../../components/CopyButton';
import { ShareButton, buildEscrowShareUrl } from '../../components/ShareButton';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { toFriendlyError, isOfflineError } from '../../utils/errors';
import { useDisputes } from '../../hooks/useDisputes';
import { RaiseDisputeModal } from '../../components/RaiseDisputeModal';
import { DisputeDetailsCard } from '../../components/DisputeDetailsCard';
import { ResolutionSummary } from '../../components/ResolutionSummary';

// Simulated current user role – in production this comes from auth context
const CURRENT_USER_ROLE: 'depositor' | 'recipient' | 'arbitrator' = 'depositor';

const STATUS_COLOR: Record<string, string> = {
  created: '#6c63ff', funded: '#00b4d8', confirmed: '#06d6a0',
  released: '#06d6a0', completed: '#06d6a0', cancelled: '#aaa',
  disputed: '#ef476f', expired: '#f77f00',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function MilestoneRow({ milestone, canRelease, onRelease }: {
  milestone: Milestone;
  canRelease: boolean;
  onRelease: (id: string) => void;
}) {
  const released = milestone.status === 'released';
  return (
    <View style={styles.milestoneRow}>
      <View style={styles.milestoneInfo}>
        <Text style={styles.milestoneTitle}>{milestone.title}</Text>
        <Text style={styles.milestoneAmount}>{milestone.amount} XLM</Text>
      </View>
      {released ? (
        <View style={styles.releasedBadge}><Text style={styles.releasedText}>✐ Released</Text></View>
      ) : canRelease ? (
        <TouchableOpacity
          style={styles.releaseBtn}
          onPress={() => onRelease(milestone.id)}
          accessibilityRole=\"button\"
          accessibilityLabel={release milestone ${milestone.title}}
        >
          <Text style={styles.releaseBtnText}>Release</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.pendingBadge}><Text style={styles.pendingText}>Pending</Text></View>
      )}
    </View>
  );
}

function PartyRow({ party }: { party: Party }) {
  return (
    <View style={styles.partyRow}>
      <View style={styles.partyInfo}>
        <Text style={styles.partyRole}>{party.role.toUpperCase()}</Text>
        <Text style={styles.partyAddress} numberOfLines={1}>{party.walletAddress}</Text>
        <Text style={[styles.partyStatus, party.status === 'accepted' && { color: '#06d6a0' }]}>
          {party.status}
        </Text>
      </View>
      <CopyButton value={party.walletAddress} label=\"Copy\" compact />
    </View>
  );
}

function TimelineItem({ event }: { event: EscrowEvent }) {
  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineDot} />
      <View style={styles.timelineContent}>
        <Text style={styles.timelineEvent}>{event.eventType.replace(/_/g, ' ')}</Text>
        <Text style={styles.timelineDate}>{new Date(event.createdAt).toLocaleString()}</Text>
      </View>
    </View>
  );
}

function DetailSkeleton() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.skeletonHeader} />
        <View style={styles.skeletonLine} />
        <View style={[styles.skeletonLine, { width: '60%' }]} />
        <View style={styles.skeletonRow}>
          <View style={styles.skeletonBox} />
          <View style={styles.skeletonBox} />
        </View>
        <View style={styles.skeletonSection} />
        <View style={styles.skeletonCard} />
        <View style={styles.skeletonCard} />
      </View>
    </View>
  );
}

export default function EscrowDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [escrow, setEscrow] = useState<Escrow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const { isOffline, markOffline, markOnline } = useNetworkStatus();
  const [isDisputeModalVisible, setDisputeModalVisible] = useState(false);
  const { dispute, raiseDispute, hasActiveDispute, isSubmitting } = useDisputes();

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const data = await escrowApi.getById(id);
      setEscrow(data);
      markOnline();
    } catch (err) {
      const friendly = toFriendlyError(err);
      setError({ title: friendly.title, message: friendly.message });
      if (isOfflineError(err)) markOffline();
    } finally {
      setLoading(false);
    }
  }, [id, markOnline, markOffline]);

  useEffect(() => {
    if (!id) return;
    if (!requireAuth(router, { pathname: '/escrow/[id]', params: { id } })) return;
    load();
  }, [id, load, router]);

  const handleRelease = useCallback((milestoneId: string) => {
    router.push({ pathname: '/escrow/release', params: { escrowId: id, milestoneId } });
  }, [id, router]);

  if (loading) {
    return <DetailSkeleton />;
  }
  if (error || !escrow) {
    return (
      <View style={styles.root}>
        <OfflineBanner visible={isOffline} />
        <View style={styles.center}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorTitle}>{error?.title ?? 'Not found'}</Text>
          <Text style={styles.errorMessage}>{error?.message ?? 'Escrow not found.'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const statusColor = STATUS_COLOR[escrow.status] || '#aaa';
  // Role-gated: only depositor can release milestones when escrow is funded/confirmed
  const canReleaseMilestones =
    CURRENT_USER_ROLE === 'depositor' &&
    ['funded', 'confirmed'].includes(escrow.status) &&
    %hasActiveDispute;

  return (
    <View style={styles.root}>
      <OfflineBanner visible={isOffline} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{escrow.title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{escrow.status.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={styles.description}>{escrow.description}</Text>

      {/* Share & Copy row */}
      <View style={styles.shareRow}>
        <CopyButton value={escrow.id} label=\"Copy Escrow ID\" toastMessage=\"Escrow ID copied!\" variant=\"ghost\" />
        <ShareButton url={buildEscrowShareUrl(escrow.id)} label=\"Share Escrow\" variant=\"primary\" />
      </View>

      {/* Amount & Deadline */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Amount</Text>
          <Text style={styles.metaValue}>{escrow.amount} {escrow.asset}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Deadline</Text>
          <Text style={styles.metaValue}>{new Date(escrow.deadline).toLocaleDateString()}</Text>
        </View>
      </View>

      {dispute && (
        <Section title=\"Dispute Information\">
          <DisputeDetailsCard status={dispute.status} reason={dispute.reason} />
          <ResolutionSummary dispute={dispute} />
        </Section>
      )}

      {/* Milestones */}
      {escrow.milestones && escrow.milestones.length > 0 && (
        <Section title=\"Milestones\">
          {escrow.milestones.map((m) => (
            <MilestonRow
              key={m.id}
              milestone={m}
              canRelease={canReleaseMilestones}
              onRelease={handleRelease}
            />
          ))}
        </Section>
      )}

      {/* Parties */}
      {escrow.parties && escrow.parties.length > 0 && (
        <Section title=\"Parties\">
          {escrow.parties.map((p) => <PartyRow key={p.id} party={p} />)}
        </Section>
      )}

      {/* Timeline */}
      {escrow.events && escrow.events.length > 0 && (\n        <Section title=\"Activity Timeline\">\n          {escrow.events.map((e) => <TimelineItem key={e.id} event={e} />)}\n        </Section>\n      )}\n\n      {/* Role-gated actions */}\n      <Section title=\"Actions\">\n        {escrow.status === 'disputed' && CURRENT_USER_ROLE === 'arbitrator' && (\n          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#ef476f' }]}>\n            <Text style={styles.actionBtnText}>Resolve Dispute</Text>\n          </TouchableOpacity>\n        )}\n        {escrow.status === 'created' && CURRENT_USER_ROLE === 'depositor' && (\n          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#00b4d8' }]}>\n            <Text style={styles.actionBtnText}>Fund Escrow</Text>\n          </TouchableOpacity>\n        )}\n        {['funded', 'confirmed'].includes(escrow.status) && CURRENT_USER_ROLE === 'depositor' && !hasActiveDispute && (\n          <TouchableOpacity \n            style={[styles.actionBtn, { backgroundColor: '#ef476f22', borderWidth: 1, borderColor: '#ef476f' }]}\n            onPress={() => setDisputeModalVisible(true)}\n          >\n            <Text style={[styles.actionBtnText, { color: '#ef476f' }]}>Raise Dispute</Text>\n          </TouchableOpacity>\n        )}\n        {!['disputed', 'created', 'funded', 'confirmed'].includes(escrow.status) && (\n          <Text style={styles.noActions}>No actions available for this status.</Text>\n        )}\n      </Section>\n\n      <RaiseDisputeModal\n        visible={isDisputeModalVisible}\n        onClose={() => setDisputeModalVisible(false)}\n        onSubmit={async (reason, description) => {\n          const res = await raiseDispute(escrow.id, reason, description);\n          if (res.success) {\n            setDisputeModalVisible(false);\n          }\n        }}\n        isSubmitting={isSubmitting}\n      />\n      </ScrollView>\n    </View>\n  );\n}\n\nconst styles = StyleSheet.create({\n  root: { flex: 1, backgroundColor: '#12121f' },\n  container: { flex: 1, backgroundColor: '#12121f' },\n  content: { padding: 16, paddingBottom: 40 },\n  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#12121f' },\n  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },\n  title: { color: '#fff', fontSize: 20, fontWeight: '700', flex: 1, marginRight: 8 },\n  statusBadge: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },\n  statusText: { fontSize: 11, fontWeight: '700' },\n  description: { color: '#aaa', fontSize: 14, marginBottom: 16, lineHeight: 20 },\n  metaRow: { flexDirection: 'row', gap: 16, marginBottom: 8 },\n  metaItem: { flex: 1, backgroundColor: '#1e1e30', borderRadius: 10, padding: 12 },\n  metaLabel: { color: '#888', fontSize: 11, marginBottom: 4 },\n  metaValue: { color: '#fff', fontWeight: '600', fontSize: 15 },\n  section: { marginTop: 20 },\n  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 10 },\n  milestoneRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1e1e30', borderRadius: 10, padding: 12, marginBottom: 8 },\n  milestoneInfo: { flex: 1, marginRight: 8 },\n  milestoneTitle: { color: '#fff', fontWeight: '600', fontSize: 14 },\n  milestoneAmount: { color: '#888', fontSize: 12, marginTop: 2 },\n  releasedBadge: { backgroundColor: '#06d6a022', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },\n  releasedText: { color: '#06d6a0', fontSize: 12, fontWeight: '600' },\n  releaseBtn: { backgroundColor: '#6c63ff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },\n  releaseBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },\n  pendingBadge: { backgroundColor: '#2d2d44', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },\n  pendingText: { color: '#aaa', fontSize: 12 },\n  partyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e1e30', borderRadius: 10, padding: 12, marginBottom: 8 },\n  partyInfo: { flex: 1, marginRight: 8 },\n  partyRole: { color: '#6c63ff', fontWeight: '700', fontSize: 12 },\n  partyAddress: { color: '#fff', fontSize: 14, marginTop: 2 },\n  partyStatus: { color: '#888', fontSize: 12, marginTop: 2 },\n  timelineItem: { flexDirection: 'row', marginBottom: 10 },\n  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#6c63ff', marginTop: 5, marginRight: 10 },\n  timelineContent: { flex: 1 },\n  timelineEvent: { color: '#fff', fontSize: 14, fontWeight: '500' },\n  timelineDate: { color: '#777', fontSize: 12, marginTop: 2 },\n  skeletonHeader: { height: 22, backgroundColor: '#2d2d44', borderRadius: 4, marginBottom: 12, width: '60%' },\n  skeletonLine: { height: 12, backgroundColor: '#2d2d44', borderRadius: 4, marginBottom: 8, width: '90%' },\n  skeletonRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },\n  skeletonBox: { flex: 1, height: 70, backgroundColor: '#1e1e30', borderRadius: 10 },\n  skeletonSection: { height: 16, backgroundColor: '#2d2d44', borderRadius: 4, marginVertical: 16, width: '40%' },\n  skeletonCard: { height: 90, backgroundColor: '#1e1e30', borderRadius: 10, marginBottom: 12 },\n  errorEmoji: { fontSize: 36, marginBottom: 8 },\n  errorTitle: { color: '#ef476f', fontSize: 16, fontWeight: '700', marginBottom: 6, textAlign: 'center' },\n  errorMessage: { color: '#aaa', fontSize: 13, textAlign: 'center', lineHeight: 18, marginBottom: 16 },\n  retryBtn: { backgroundColor: '#6c63ff', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },\n  retryText: { color: '#fff', fontWeight: '600' },\n  shareRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },\n  actionBtn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },\n  actionBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },\n  noActions: { color: '#777', fontSize: 14, textAlign: 'center', marginTop: 8 },\n});\n