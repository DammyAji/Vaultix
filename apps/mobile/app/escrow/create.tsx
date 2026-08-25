/**
 * #316 – Mobile Create Escrow: multi-step form with contract constraint validation
 * Steps: 1) Parties  2) Milestones  3) Deadline  4) Review & Submit
 * Validates: milestone totals == total amount, 1-–10 milestones, deadline in future
 */
import React, { useEffect, useState } from 'react';
import {\n  ActivityIndicator,\n  Alert,\n  KeyboardAvoidingView,\n  Platform,\n  ScrollView,\n  StyleSheet,\n  Text,\n  TextInput,\n  TouchableOpacity,\n  View,\n} from 'react-native';
import { useRouter } from 'expo-router';
import { escrowApi } from '../../services/api';
import { toFriendlyError } from '../../utils/errors';
import { requireAuth } from '../../services/auth';

const MAX_MILESTONES = 10;
const MIN_MILESTONES = 1;

interface MilestoneInput {
  title: string;
  amount: string;
  description: string;
}

interface FormState {
  counterpartyAddress: string;
  title: string;
  description: string;
  totalAmount: string;
  asset: string;
  deadline: string; // ISO date string YYYY-MM-DD
  milestones: MilestoneInput[];
}

const INITIAL_FORM: FormState = {
  counterpartyAddress: '',
  title: '',
  description: '',
  totalAmount: '',
  asset: 'XLM',
  deadline: '',
  milestones: [{ title: '', amount: '', description: '' }],
};

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <View style={styles.stepRow}>
      {Array.from({ length: total }).map((_, i) => (\n        <View key={i} style={[styles.stepDot, i < current && styles.stepDotDone, i === current - 1 && styles.stepDotActive]} />\n      ))}
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType, multiline, error }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  multiline?: boolean; error?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti, !!error && styles.inputError]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor=\"#555\"
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
        autoCapitalize=\"none\"
      />
      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

export default function CreateEscrowScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    requireAuth(router, { pathname: '/escrow/create' });
  }, [router]);

  const update = (key: keyof FormState, value: FormState[keyof FormState]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const updateMilestone = (index: number, key: keyof MilestoneInput, value: string) => {
    const updated = form.milestones.map((m, i) => (i === index ? { ...m, [key]: value } : m));
    update('milestones', updated);
  };

  const addMilestone = () => {
    if (form.milestones.length >= MAX_MILESTONES) return;
    update('milestones', [...form.milestones, { title: '', amount: '', description: '' }]);
  };

  const removeMilestone = (index: number) => {
    if (form.milestones.length <= MIN_MILESTONES) return;
    update('milestones', form.milestones.filter((_, i) => i !== index));
  };

  // --- Validation per step ---
  const validateStep1 = (): boolean => {
    const e: Partial<Record<string, string>> = {};
    if (!form.title.trim()) e.title = 'Title is required';
    if (!form.counterpartyAddress.trim()) e.counterpartyAddress = 'Recipient address is required';
    if (!form.totalAmount || isNaN(Number(form.totalAmount)) || Number(form.totalAmount) <= 0)
      e.totalAmount = 'Enter a valid amount greater than 0';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = (): boolean => {
    const e: Partial<Record<string, string>> = {};
    const total = Number(form.totalAmount);
    const milestoneSum = form.milestones.reduce((s, m) => s + Number(m.amount || 0), 0);

    if (form.milestones.length < MIN_MILESTONES || form.milestones.length > MAX_MILESTONES-
      e.milestones = `Must have ${MIN_MILESTONES}–${MAX_MILESTONES} milestones`;

    form.milestones.forEach((m, i) => {
      if (!m.title.trim()) e[`_title_${i}] = 'Title required';
      if (!m.amount || isNaN(Number(m.amount)) || Number(m.amount) <= 0)
        e[`_amount_${i}`] = 'Valid amount required';
    });

    // Contract constraint: milestone totals must equal total amount
    if (Math.abs(milestoneSum - total) > 0.0001)
      e.milestoneTotal = `Milestone amounts (${milestoneSum}) must equal total (${total})`;

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep3 = (): boolean => {
    const e: Partial<Record<string, string>> = {};
    if (!form.deadline) { e.deadline = 'Deadline is required'; }
    else {
      const d = new Date(form.deadline);
      if (isNaN(d.getTime())) e.deadline = 'Invalid date';
      else if (d <= new Date()) e.deadline = 'Deadline must be in the future';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    const valid = step === 1 ? validateStep1() : step === 2 ? validateStep2() : validateStep3();
    if (valid) setStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const created = await escrowApi.create({
        title: form.title,
        description: form.description,
        counterpartyAddress: form.counterpartyAddress,
        amount: form.totalAmount,
        asset: form.asset,
        deadline: new Date(form.deadline).toISOString(),
        milestones: form.milestones.map((m) => ({
          title: m.title,
          amount: m.amount,
          description: m.description,
        })),
      });
      Alert.alert('Success', 'Escrow created!', [
        { text: 'View', onPress: () => router.replace({ pathname: '/escrow/[id]', params: { id: created.id } }) },
        { text: 'Dashboard', onPress: () => router.replace('/dashboard') },
      ]);
    } catch (err) {
      const friendly = toFriendlyError(err);
      Alert.alert(friendly.title, friendly.message, [{ text: 'OK' }]);
    } finally {
      setSubmitting(false);
    }
  };

  const milestoneSum = form.milestones.reduce((s, m) => s + Number(m.amount || 0), 0);

  return (
    <KeyboardAvoidingView style={ flex: 1 } behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps=\"handled\">
        <StepIndicator current={step} total={4} />
        <Text style={styles.stepLabel}>Step {step} of 4</Text>

        {/* Step 1: Parties & Amount */}
        {step === 1 && (
          <View>
            <Text style={styles.stepTitle}>Parties & Amount</Text>
            <Field label=\"Escrow Title\" value={form.title} onChangeText={(v) => update('title', v)} placeholder=\"e.g. Website Development\" error={errors.title} />
            <Field label=\"Description\" value={form.description} onChangeText={(v) => update('description', v)} placeholder=\"Describe the agreement\" multiline />
            <Field label=\"Recipient Wallet Address\" value={form.counterpartyAddress} onChangeText={(v) => update('counterpartyAddress', v)} placeholder=\"G...\" error={errors.counterpartyAddress} />
            <Field label=\"Total Amount (XLM)\" value={form.totalAmount} onChangeText={(v) => update('totalAmount', v)} keyboardType=\"decimal-pad\" placeholder=\"0.00\" error={errors.totalAmount} />
          </View>
        )}

        {/* Step 2: Milestones */}
        {step === 2 && (
          <View>
            <Text style={styles.stepTitle}>Milestones</Text>
            <Text style={styles.hint}>Total must equal {form.totalAmount || '0'} XLM. Current: {milestoneSum} XLM</Text>
            {errors.milestoneTotal && <Text style={styles.errorText}>{errors.milestoneTotal}</Text>}
            {errors.milestones && <Text style={styles.errorText}>{errors.milestones}</Text>}

            {form.milestones.map((m, i) => (\n              <View key={i} style={styles.milestoneBlock}>\n                <View style={styles.milestoneHeader}>\n                  <Text style={styles.milestoneNum}>Milestone {i + 1}</Text>\n                  {form.milestones.length > MIN_MILESTONES && (\n                    <TouchableOpacity onPress={() => removeMilestone(i)}>\n                      <Text style={styles.removeText}>Remove</Text>\n                    </TouchableOpacity>\n                  )}\n                </View>\n                <Field label=\"Title\" value={m.title} onChangeText={(v) => updateMilestone(i, 'title', v)} placeholder=\"Milestone title\" error={errors[`_title_${i}]} />\n                <Field label=\"Amount (XLM)\" value={m.amount} onChangeText={(v) => updateMilestone(i, 'amount', v)} keyboardType=\"decimal-pad\" placeholder=\"0.00\" error={errors[`_amount_${i}]} />\n              </View>\n            )}\n\n            {form.milestones.length < MAX_MILESTONEEs && (\n              <TouchableOpacity style={styles.addBtn} onPress={addMilestone}>\n                <Text style={styles.addBtnText}>+ Add Milestone</Text>\n              </TouchableOpacity>\n            )}\n          </View>\n        )}\n\n        {/* Step 3: Deadline */}\n        {step === 3 && (\n          <View>\n            <Text style={styles.stepTitle}>Deadline</Text>\n            <Field\n              label=\"Deadline (YYYY-MM-DD)\"\n              value={form.deadline}\n              onChangeText={(v) => update('deadline', v)}\n              placeholder=\"2026-12-31\"\n              error={errors.deadline}\n            />\n            <Text style={styles.hint}>The escrow will expire if not completed by this date.</Text>\n          </View>\n        )}\n\n        {/* Step 4: Review */}\n        {step === 4 && (\n          <View>\n            <Text style={styles.stepTitle}>Review & Submit</Text>\n            <View style={styles.reviewCard}>\n              <ReviewRow label=\"Title\" value={form.title} />\n              <ReviewRow label=\"Recipient\" value={form.counterpartyAddress} />\n              <ReviewRow label=\"Amount\" value={`${form.totalAmount} {form.asset}`} />\n              <ReviewRow label=\"Deadline\" value={form.deadline} />\n              <ReviewRow label=\"Milestones\" value={`${form.milestones.length} milestone(s)`} />\n            </View>\n            <Text style={styles.hint}>By submitting, you agree to lock funds until milestones are released.</Text>\n          </View>\n        )}\n\n        {/* Navigation */}\n        <View style={styles.navRow}>\n          {step > 1 && (\n            <TouchableOpacity style={styles.backBtn} onPress={() => setStep((s) => s - 1)}>\n              <Text style={styles.backBtnText}>← Back</Text>\n            </TouchableOpacity>\n          )}\n          {step < 4 ? (\n            <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>\n              <Text style={styles.nextBtnText}>Next →</Text>\n            </TouchableOpacity>\n          ) : (\n            <TouchableOpacity style={[styles.nextBtn, submitting && styles.btnDisabled]} onPress={handleSubmit} disabled={submitting}>\n              {submitting ? <ActivityIndicator color=\"#fff\" /> : <Text style={styles.nextBtnText}>Create Escrow</Text>}\n            </TouchableOpacity>\n          )}\n        </View>\n      </ScrollView>\n    </KeyboardAvoidingView>\n  );\n}\n\nfunction ReviewRow({ label, value }: { label: string; value: string }) {\n  return (\n    <View style={styles.reviewRow}>\n      <Text style={styles.reviewLabel}>{label}</Text>\n      <Text style={styles.reviewValue} numberOfLines={1}>{value}</Text>\n    </View>\n  );\n}\n\nconst styles = StyleSheet.create({\n  container: { flex: 1, backgroundColor: '#12121f' },\n  content: { padding: 16, paddingBottom: 40 },\n  stepRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 12 },\n  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2d2d44' },\n  stepDotDone: { backgroundColor: '#6c63ff' },\n  stepDotActive: { backgroundColor: '#6c63ff', transform: [{ scale: 1.3 }] },\n  stepLabel: { color: '#888', fontSize: 12, marginBottom: 8 },\n  stepTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 16 },\n  hint: { color: '#888', fontSize: 12, marginBottom: 8 },\n  field: { marginBottom: 16 },\n  label: { color: '#aaa', fontSize: 13, marginBottom: 6 },\n  input: {\n    backgroundColor: '#1e1e30',\n    borderRadius: 10,\n    paddingHorizontal: 14,\n    paddingVertical: 12,\n    color: '#fff',\n    fontSize: 15,\n  },\n  inputMulti: { minHeight: 80, textAlignVertical: 'top' },\n  inputError: { borderWidth: 1, borderColor: '#ef476f' },\n  errorText: { color: '#ef476f', fontSize: 12, marginTop: 4 },\n  milestoneBlock: { backgroundColor: '#1a1a1e', borderRadius: 12, padding: 16, marginBottom: 12 },\n  milestoneHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },\n  milestoneNum: { color: '#fff', fontWeight: '600' },\n  removeText: { color: '#ef476f', fontSize: 13 },\n  addBtn: { borderWidth: 1, borderColor: '#6c63ff', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8 },\n  addBtnText: { color: '#6c63ff', fontWeight: '600' },\n  navRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },\n  backBtn: { backgroundColor: '#2d2d44', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },\n  backBtnText: { color: '#fff', fontWeight: '600' },\n  nextBtn: { backgroundColor: '#6c63ff', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },\n  nextBtnText: { color: '#fff', fontWeight: '600' },\n  btnDisabled: { opacity: 0.6 },\n  reviewCard: { backgroundColor: '#1e1e30', borderRadius: 12, padding: 12, marginBottom: 16 },\n  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#2d2d44' },\n  reviewLabel: { color: '#888', fontSize: 13 },\n  reviewValue: { color: '#fff', fontSize: 13, fontWeight: '500', maxWidth: '60%' },\n});\n