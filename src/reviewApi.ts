import { featuredRecipes } from './recipes';
import { requireSupabase } from './supabase';

type ReviewTarget = { column: 'community_id' | 'featured_id'; id: string };
export type Review = { id: string; rating: number; body: string; created_at: string };
const fields = 'id,rating,body,created_at';

export function reviewTarget(recipeId: string): ReviewTarget | undefined {
  const community = recipeId.match(/^community:([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/i);
  if (community) return { column: 'community_id', id: community[1] };
  if (featuredRecipes.some(recipe => recipe.id === recipeId)) return { column: 'featured_id', id: recipeId };
}

export async function readReviews(target: ReviewTarget, userId: string) {
  const client = requireSupabase();
  const reviews = () => client.from('recipe_reviews').select(fields).eq(target.column, target.id);
  const [summary, latest, own] = await Promise.all([
    client.rpc('recipe_review_summary', target.column === 'community_id' ? { community: target.id } : { featured: target.id }).single(),
    reviews().order('created_at', { ascending: false }).order('id', { ascending: false }).limit(20),
    reviews().eq('user_id', userId).maybeSingle(),
  ]);
  if (summary.error) throw summary.error;
  if (latest.error) throw latest.error;
  if (own.error) throw own.error;
  const stats = summary.data as { average: number | null; total: number };
  return { ...stats, latest: latest.data, own: own.data };
}

export async function saveReview(target: ReviewTarget, previousId: string | undefined, rating: number, body: string) {
  const table = requireSupabase().from('recipe_reviews');
  const values = { rating, body: body.trim() };
  const result = previousId
    ? await table.update(values).eq('id', previousId).eq(target.column, target.id).select(fields).single()
    : await table.insert({ [target.column]: target.id, ...values }).select(fields).single();
  if (result.error) throw result.error;
  return result.data;
}
