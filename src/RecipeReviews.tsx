import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useSubmission } from './FlowSheets';
import { Glyph } from './Glyph';
import { MotionPressable } from './motion';
import { readReviews, saveReview, type Review, reviewTarget } from './reviewApi';
import { Action, color, Copy, font } from './ui';

const stars = [1, 2, 3, 4, 5];

export function RecipeReviews({ recipeId, userId, onReport, startEditing = false }: {
  recipeId: string; userId: string; onReport?: (id: string) => void; startEditing?: boolean;
}) {
  const [data, setData] = useState<Awaited<ReturnType<typeof readReviews>>>();
  const [own, setOwn] = useState<Review>();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState(startEditing);
  const { busy, error, run } = useSubmission();

  useEffect(() => {
    const target = reviewTarget(recipeId);
    if (!target) return;
    let active = true;
    void readReviews(target, userId).then(result => {
      if (!active) return;
      setData(result);
      setOwn(result.own ?? undefined);
      if (startEditing) {
        setRating(result.own?.rating ?? 0);
        setBody(result.own?.body ?? '');
      }
      setLoadError(false);
    }).catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [recipeId, userId, attempt, startEditing]);

  const target = reviewTarget(recipeId);
  if (!target) return null;

  return <View style={styles.section}>
    <View style={styles.heading}>
      <Copy accessibilityRole="header" style={styles.title}>Reviews</Copy>
      {!!data?.total && <View style={styles.summary}>
        <Glyph name="star-filled" color={color.ink} size={16} />
        <Copy style={styles.score}>{Number(data.average).toFixed(1)}</Copy>
        <Copy style={styles.helper}>({data.total})</Copy>
      </View>}
    </View>
    {loadError && <View style={styles.form}>
      <Copy accessibilityRole="alert" style={styles.helper}>Couldn’t load reviews.</Copy>
      <Action secondary label="Try again" onPress={() => { setLoadError(false); setAttempt(value => value + 1); }} />
    </View>}
    {!data && !loadError && <Copy accessibilityLiveRegion="polite" style={styles.helper}>Loading reviews…</Copy>}
    {data && !loadError && <>
      {!data.total && <Copy style={styles.helper}>Be the first to rate this recipe.</Copy>}
      {editing ? <View style={styles.form}>
        <View accessibilityRole="radiogroup" accessibilityLabel="Your rating" style={styles.stars}>
          {stars.map(value => <MotionPressable key={value} disabled={busy} style={styles.star}
            accessibilityRole="radio" accessibilityLabel={`${value} ${value === 1 ? 'star' : 'stars'}`}
            aria-checked={rating === value} onPress={() => setRating(value)}>
            <Glyph name={value <= rating ? 'star-filled' : 'star'} color={color.ink} size={26} />
          </MotionPressable>)}
        </View>
        <TextInput accessibilityLabel="Review text" placeholder="What did you think? (optional)" value={body}
          onChangeText={setBody} editable={!busy} maxLength={1000} multiline style={styles.input} />
        {error && <Copy accessibilityRole="alert" style={styles.error}>{error}</Copy>}
        <Action label={busy ? 'Saving…' : 'Save review'} disabled={busy || !rating} onPress={() => void run(async () => {
          try { setOwn(await saveReview(target, own?.id, rating, body)); }
          catch (cause) {
            if (typeof cause === 'object' && cause && 'code' in cause && cause.code === '23505') {
              const current = await readReviews(target, userId);
              setOwn(current.own ?? undefined);
              throw new Error('You already reviewed this recipe. Tap Save review to update it.');
            }
            throw new Error('Couldn’t save your review. Try again.');
          }
          setEditing(false);
          setAttempt(value => value + 1);
        })} />
        <Action secondary label="Cancel" disabled={busy} onPress={() => setEditing(false)} />
      </View> : <Action secondary label={own ? 'Edit your review' : 'Write a review'} onPress={() => {
        setRating(own?.rating ?? 0);
        setBody(own?.body ?? '');
        setEditing(true);
      }} />}
      {data.latest.map(review => <View key={review.id} style={styles.review}>
        <View style={styles.heading}>
          <View accessible accessibilityLabel={`${review.rating} out of 5 stars`} style={styles.summary}>
            {stars.map(value => <Glyph key={value} name={value <= review.rating ? 'star-filled' : 'star'} color={color.ink} size={15} />)}
          </View>
          <Copy style={styles.helper}>{review.id === own?.id ? 'Your review' : new Date(review.created_at).toLocaleDateString()}</Copy>
        </View>
        {!!review.body && <Copy style={styles.reviewText}>{review.body}</Copy>}
        {onReport && review.id !== own?.id && <Action secondary label="Report review" onPress={() => onReport(review.id)} />}
      </View>)}
      {data.total > data.latest.length && <Copy style={styles.helper}>Showing the {data.latest.length} most recent reviews.</Copy>}
    </>}
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: 12, borderTopWidth: 1, borderColor: color.rule, paddingTop: 22 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  title: { fontFamily: font.display, fontSize: 24, letterSpacing: -0.5 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  score: { fontFamily: font.bold },
  helper: { color: color.secondaryInk, fontSize: 13, lineHeight: 19 },
  form: { gap: 10 },
  stars: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  star: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 88, padding: 12, fontSize: 16, fontFamily: font.body, color: color.ink, borderWidth: 1, borderColor: color.rule, borderRadius: 12, textAlignVertical: 'top' },
  error: { color: color.error },
  review: { borderTopWidth: 1, borderColor: color.rule, paddingVertical: 12, gap: 8 },
  reviewText: { lineHeight: 22 },
});
