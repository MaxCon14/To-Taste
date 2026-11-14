import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { importRecipe, isSocialRecipeLink, normalizeRecipeUrl, recipeFromCaption } from './importRecipe';
import { emptyDraft, lines, type RecipeDraft } from './recipes';
import { supabase } from './supabase';
import { MotionPressable as Pressable, useSceneMotion, useReducedMotion } from './motion';
import { Glyph } from './Glyph';
import { Action, color, Copy, Cover, font, IconButton, IngredientCard, Segment, segmentTrack } from './ui';

type Mode = 'manual' | 'import';
export type FormState = { mode: Mode; draft?: RecipeDraft; id?: string; url?: string };

export function RecipeForm({ state, close, save, remove, onDraft }: {
  state: FormState; close: () => void; save: (draft: RecipeDraft, id?: string) => Promise<void>; remove: (id: string) => Promise<void>;
  onDraft?: (draft: FormState) => void;
}) {
  const insets = useSafeAreaInsets();
  const motion = useSceneMotion(true, 24);
  const reduced = useReducedMotion();
  const dismiss = () => motion.exit(close);
  const [mode, setMode] = useState<Mode>(state.mode);
  const [draft, setDraft] = useState(state.draft ?? emptyDraft);
  const [url, setUrl] = useState(state.url ?? '');
  const [caption, setCaption] = useState('');
  const [reviewNotes, setReviewNotes] = useState<string[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pending = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  const preview = lines(draft.ingredients);
  const socialLink = isSocialRecipeLink(url);
  const socialDraft = !!draft.source && isSocialRecipeLink(draft.source);
  const localVideoImport = Platform.OS === 'web' && typeof window !== 'undefined'
    && ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const title = confirmDelete ? 'Delete this recipe?' : mode === 'import' ? 'Import a recipe' : state.id ? 'Edit recipe' : draft.source ? 'Review recipe' : 'Add a recipe';

  function update(key: keyof RecipeDraft, value: string) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    onDraft?.({ mode, url, draft: next });
  }

  async function run(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setError('');
    setBusy(true);
    try {
      await action();
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error ? cause.message : 'Something went wrong. Try again.');
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }

  function submit() {
    void run(async () => {
      if (!draft.title.trim() || !preview.length) throw new Error('Add a recipe name and at least one ingredient.');
      if (draft.minutes.trim() && !/^[1-9]\d*$/.test(draft.minutes.trim())) throw new Error('Enter the time as a whole number of minutes.');
      await save({
        ...draft,
        title: draft.title.trim(), minutes: draft.minutes.trim(), servings: draft.servings.trim(),
        ingredients: preview.join('\n'), instructions: lines(draft.instructions).join('\n'),
      }, state.id);
    });
  }

  function fetchRecipe() {
    void run(async () => {
      setCanWrite(false);
      const source = normalizeRecipeUrl(url);
      let imported: RecipeDraft;
      try {
        if (socialLink && caption.trim()) {
          const fromCaption = recipeFromCaption(caption, source);
          if (!fromCaption) throw new Error('Add an Ingredients or Directions heading on its own line, or write the recipe and keep the link.');
          imported = fromCaption;
        } else {
          imported = await importRecipe(source, Platform.OS === 'web');
        }
      }
      catch (error) {
        if (alive.current) setCanWrite(true);
        throw error;
      }
      if (!alive.current) return;
      setReviewNotes([]);
      setDraft(imported);
      setMode('manual');
      onDraft?.({ mode: 'manual', draft: imported });
    });
  }

  function chooseVideo() {
    const picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = 'video/mp4,video/quicktime,video/webm';
    picker.onchange = () => {
      const video = picker.files?.[0];
      if (!video || !alive.current) return;
      void run(async () => {
        const source = normalizeRecipeUrl(url);
        if (video.size > 20 * 1024 * 1024 || !video.size) throw new Error('Choose a video under 20 MB.');
        const headers: Record<string, string> = { 'Content-Type': video.type };
        let endpoint = '/api/import-video';
        if (!localVideoImport) {
          const session = (await supabase?.auth.getSession())?.data.session;
          if (!session) throw new Error('Sign in to analyze a video, or paste the recipe text.');
          endpoint = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/import-recipe-video`;
          headers.Authorization = `Bearer ${session.access_token}`;
          headers.apikey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
        }
        const response = await fetch(endpoint, {
          method: 'POST', body: video, headers,
          signal: AbortSignal.timeout(100_000),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Video analysis couldn’t finish.');
        if (!alive.current) return;
        const next = { ...emptyDraft, title: result.title, source,
          ingredients: result.ingredients.join('\n'), instructions: result.instructions.join('\n') };
        setReviewNotes(result.reviewNotes);
        setDraft(next);
        setMode('manual');
        onDraft?.({ mode: 'manual', draft: next });
      });
    };
    picker.click();
  }

  function switchMode(next: Mode) {
    if (busy) return;
    setError('');
    setMode(next);
    if (url || Object.values(draft).some(Boolean)) onDraft?.({ mode: next, url, draft });
  }

  function writeFromLink() {
    const next = { ...draft, source: normalizeRecipeUrl(url) };
    setDraft(next);
    setMode('manual');
    setError('');
    setCanWrite(false);
    onDraft?.({ mode: 'manual', draft: next });
  }

  return <Modal visible transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={() => { if (!busy) dismiss(); }}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modal}>
      <Pressable accessibilityElementsHidden importantForAccessibility="no-hide-descendants" onPress={() => { if (!busy) dismiss(); }} style={StyleSheet.absoluteFill} />
      <Animated.View accessibilityViewIsModal style={[motion.style, styles.sheet, Platform.OS === 'web' ? styles.webSheet : { paddingBottom: Math.max(insets.bottom, 12), marginTop: insets.top + 20 }]}>
        <View style={styles.top}>
          <Copy accessibilityRole="header" style={styles.heading}>{title}</Copy>
          <IconButton label="Close" disabled={busy} onPress={dismiss}><Glyph name="close" size={18} color={color.ink} /></IconButton>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
          {confirmDelete ? <Copy style={styles.helper}>“{draft.title}” will be removed from your recipe book.</Copy> : <>
            {!state.id && !draft.source && <View style={segmentTrack}>
              <Segment active={mode === 'manual'} label="Write it" onPress={() => switchMode('manual')} />
              <Segment active={mode === 'import'} label="Import link" onPress={() => switchMode('import')} />
            </View>}
            {mode === 'import' ? <>
              <Copy style={styles.helper}>Paste a recipe website or a link to a cooking video.</Copy>
              <Field label="Recipe link" value={url} onChangeText={(value) => {
                setUrl(value);
                setCaption('');
                setError('');
                setCanWrite(false);
                onDraft?.({ mode: 'import', url: value, draft });
              }} placeholder="https://…" autoCapitalize="none" autoCorrect={false}
                keyboardType="url" inputMode="url" onSubmitEditing={fetchRecipe} editable={!busy} />
              {socialLink && canWrite && Platform.OS === 'web' && <>
                <Copy style={styles.helper}>Upload a clip you have permission to share. It will be sent to Gemini for analysis.{!localVideoImport && ' Video analysis requires signing in.'}</Copy>
                <Action secondary label="Upload video" onPress={chooseVideo} disabled={busy} />
              </>}
              {socialLink && (canWrite || caption) && <Field label="Caption or transcript" hint="Paste the recipe text with Ingredients and Directions headings."
                value={caption} onChangeText={setCaption} placeholder="Paste the creator’s recipe text (optional)" multiline editable={!busy} />}
              {canWrite && <Action secondary label="Write it and keep the link" onPress={writeFromLink} />}
            </> : <>
              {!!draft.source && <Copy style={styles.helper}>Original link attached</Copy>}
              {socialDraft && <Copy style={styles.helper}>Compare this draft with the original video. Fill in any missing amounts, times, or steps before saving.</Copy>}
              {reviewNotes.length > 0 && <View style={styles.preview}>
                <Copy accessibilityRole="header" style={styles.label}>Check against the video</Copy>
                {reviewNotes.map((note, index) => <Copy key={index} style={styles.helper}>{note}</Copy>)}
              </View>}
              {!!draft.photo && <View style={styles.photo}><Cover recipe={draft} /></View>}
              <Field label="Recipe name" value={draft.title} onChangeText={(value) => update('title', value)} placeholder="e.g. Sunday onion soup" />
              <View style={styles.row}>
                <View style={{ flex: 1 }}><Field label="Time in minutes" value={draft.minutes} onChangeText={(value) => update('minutes', value)} placeholder="Optional" keyboardType="number-pad" /></View>
                <View style={{ flex: 1 }}><Field label="Servings" value={draft.servings} onChangeText={(value) => update('servings', value)} placeholder="Optional" /></View>
              </View>
              <Field label="Ingredients" hint="One ingredient per line" value={draft.ingredients} onChangeText={(value) => update('ingredients', value)}
                placeholder={'2 onions\n½ cup cream\n1 tbsp olive oil'} multiline />
              {!!preview.length && <View style={styles.preview}>
                <Copy style={styles.label}>Ingredient preview</Copy>
                {preview.map((line, index) => <IngredientCard key={index} line={line} />)}
              </View>}
              <Field label="Directions" hint="One step per line" value={draft.instructions} onChangeText={(value) => update('instructions', value)}
                placeholder="Add your cooking steps (optional)" multiline />
            </>}
          </>}
        </ScrollView>
        {!!error && <Copy accessibilityRole="alert" style={styles.error}>{error}</Copy>}
        <View style={styles.footer}>
          {confirmDelete && <Action secondary label="Go back" disabled={busy} onPress={() => { setConfirmDelete(false); setError(''); }}><Glyph name="back" size={16} color={color.ink} /></Action>}
          {!!state.id && !confirmDelete && <IconButton label="Delete recipe" disabled={busy} onPress={() => { setConfirmDelete(true); setError(''); }}><Glyph name="trash" size={18} color={color.error} /></IconButton>}
          <Action style={[styles.submit, confirmDelete && { backgroundColor: color.error }]} disabled={busy} label={busy ? mode === 'import' ? 'Importing…' : 'Working…' : confirmDelete ? 'Delete recipe' : mode === 'import' ? 'Import recipe' : 'Save recipe'}
            onPress={confirmDelete ? () => void run(() => remove(state.id!)) : mode === 'import' ? fetchRecipe : submit}>
            {busy ? <ActivityIndicator color={color.white} /> : <Glyph name={confirmDelete ? 'trash' : mode === 'import' ? 'forward' : 'check'} size={17} color={color.white} />}
          </Action>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  </Modal>;
}

function Field({ label, hint, multiline, ...props }: TextInputProps & { label: string; hint?: string }) {
  return <View style={{ gap: 5 }}>
    <Copy style={styles.label}>{label}</Copy>
    {!!hint && <Copy style={styles.helper}>{hint}</Copy>}
    <TextInput {...props} accessibilityLabel={label} accessibilityHint={hint} multiline={multiline} placeholderTextColor={color.soft}
      style={[styles.field, multiline && styles.multiline]} />
  </View>;
}

const styles = StyleSheet.create({
  modal: { flex: 1, alignItems: 'center', justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end', backgroundColor: '#11131866', paddingHorizontal: Platform.OS === 'web' ? 14 : 0 },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '94%', backgroundColor: color.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden' },
  webSheet: { borderRadius: 30, maxHeight: '90%' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderColor: color.rule },
  heading: { fontFamily: font.display, fontSize: 27, lineHeight: 34, letterSpacing: -0.8, flexShrink: 1 },
  body: { padding: 24, gap: 20 },
  row: { flexDirection: 'row', gap: 10 },
  label: { fontFamily: font.bold, fontSize: 14 },
  helper: { color: color.soft, fontSize: 14, lineHeight: 20 },
  field: { minHeight: 46, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: color.muted, borderRadius: 14, borderWidth: 1, borderColor: color.rule, color: color.ink, fontFamily: font.body, fontSize: 16 },
  multiline: { minHeight: 93, textAlignVertical: 'top' },
  preview: { gap: 5, backgroundColor: color.paper, padding: 12, borderRadius: 16 },
  photo: { height: 146, borderRadius: 16, overflow: 'hidden' },
  error: { color: color.error, fontFamily: font.bold, fontSize: 14, paddingHorizontal: 20, paddingBottom: 10 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, alignItems: 'center', borderTopWidth: 1, borderColor: color.rule, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: color.surface },
  submit: { flex: 1 },
});
