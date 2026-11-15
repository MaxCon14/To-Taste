import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Field, Sheet, useSubmission } from './FlowSheets';
import { Glyph } from './Glyph';
import { MotionPressable } from './motion';
import { requireSupabase } from './supabase';
import { Action, color, Copy, font } from './ui';

export type ReportTarget = { type: 'recipe' | 'review'; id: string };
type Block = { blocked_id: string; label: string };

const reasons = {
  unsafe: 'Unsafe or inaccurate', copied: 'Copied content', spam: 'Spam',
  abuse: 'Harassment or abuse', other: 'Something else',
};

export async function blockCook(id: string, label: string) {
  const { error } = await requireSupabase().from('user_blocks').upsert({ blocked_id: id, label }, {
    onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true,
  });
  if (error) throw new Error('Couldn’t block this user. Try again.');
}

export function ReportSheet({ target, close }: { target: ReportTarget; close: () => void }) {
  const [reason, setReason] = useState<keyof typeof reasons>();
  const [details, setDetails] = useState('');
  const [sent, setSent] = useState(false);
  const { busy, error, run } = useSubmission();
  return <Sheet title={`Report ${target.type}`} close={close} busy={busy}>
    {sent ? <>
      <Copy accessibilityLiveRegion="polite">Report received. Thanks for letting us know.</Copy>
      <Action label="Done" onPress={close} />
    </> : <>
      <Copy style={styles.helper}>What should we look into? Your report is private.</Copy>
      <View accessibilityRole="radiogroup" style={styles.group}>
        {(Object.keys(reasons) as (keyof typeof reasons)[]).map(value =>
          <MotionPressable key={value} accessibilityRole="radio" accessibilityState={{ checked: reason === value }}
            onPress={() => setReason(value)} disabled={busy} style={styles.row}>
            <Copy style={styles.label}>{reasons[value]}</Copy>
            {reason === value && <Glyph name="check" color={color.ink} />}
          </MotionPressable>)}
      </View>
      <Field label="Details · optional" value={details} onChangeText={setDetails} multiline maxLength={1000}
        placeholder="Add context for the moderation team" editable={!busy} style={styles.details} />
      {error && <Copy accessibilityRole="alert" style={styles.error}>{error}</Copy>}
      <Action label={busy ? 'Sending…' : 'Send report'} disabled={busy || !reason} onPress={() => void run(async () => {
        const { error } = await requireSupabase().from('content_reports').insert({
          target_type: target.type, target_id: target.id, reason, details: details.trim(),
        });
        if (error && error.code !== '23505') throw new Error('Couldn’t send your report. Try again.');
        setSent(true);
      })} />
    </>}
  </Sheet>;
}

export function BlockedAccounts({ back, changed }: { back: () => void; changed: () => void }) {
  const [blocks, setBlocks] = useState<Block[]>();
  const [attempt, setAttempt] = useState(0);
  const { busy, error, run } = useSubmission();
  useEffect(() => {
    let active = true;
    void requireSupabase().from('user_blocks').select('blocked_id,label').order('created_at', { ascending: false })
      .then(({ data, error }) => { if (active) setBlocks(error ? undefined : data); });
    return () => { active = false; };
  }, [attempt]);
  return <Sheet title="Blocked accounts" back={back} busy={busy}>
    <Copy style={styles.helper}>Blocked accounts are hidden from your feed and search.</Copy>
    {blocks?.length === 0 && <Copy>You haven’t blocked anyone.</Copy>}
    {blocks === undefined && <Action secondary label="Refresh list" onPress={() => setAttempt(value => value + 1)} />}
    {blocks?.map(block => <View key={block.blocked_id} style={styles.row}>
      <Copy style={styles.label}>{block.label}</Copy>
      <Action secondary label="Unblock" accessibilityLabel={`Unblock ${block.label}`} disabled={busy} onPress={() => void run(async () => {
        const { error } = await requireSupabase().from('user_blocks').delete().eq('blocked_id', block.blocked_id);
        if (error) throw new Error('Couldn’t unblock this user. Try again.');
        setBlocks(values => values?.filter(item => item.blocked_id !== block.blocked_id));
        changed();
      })} />
    </View>)}
    {error && <Copy accessibilityRole="alert" style={styles.error}>{error}</Copy>}
  </Sheet>;
}

const styles = StyleSheet.create({
  helper: { color: color.secondaryInk, lineHeight: 22 },
  group: { borderRadius: 18, backgroundColor: color.muted, overflow: 'hidden' },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: color.rule },
  label: { flex: 1, fontFamily: font.medium },
  details: { minHeight: 96, textAlignVertical: 'top' },
  error: { color: color.error },
});
