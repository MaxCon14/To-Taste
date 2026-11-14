import { Platform } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import ArrowUpRight from 'lucide-react-native/icons/arrow-up-right';
import BookOpen from 'lucide-react-native/icons/book-open';
import Check from 'lucide-react-native/icons/check';
import Compass from 'lucide-react-native/icons/compass';
import UserRound from 'lucide-react-native/icons/user-round';
import Share from 'lucide-react-native/icons/share';
import Timer from 'lucide-react-native/icons/timer';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import CircleHelp from 'lucide-react-native/icons/circle-help';
import Leaf from 'lucide-react-native/icons/leaf';
import MessageSquare from 'lucide-react-native/icons/message-square';
import Shield from 'lucide-react-native/icons/shield';
import Heart from 'lucide-react-native/icons/heart';
import Star from 'lucide-react-native/icons/star';
import Link2 from 'lucide-react-native/icons/link-2';
import Pencil from 'lucide-react-native/icons/pencil';
import Plus from 'lucide-react-native/icons/plus';
import Search from 'lucide-react-native/icons/search';
import ShoppingBasket from 'lucide-react-native/icons/shopping-basket';
import Trash2 from 'lucide-react-native/icons/trash-2';
import Utensils from 'lucide-react-native/icons/utensils';
import X from 'lucide-react-native/icons/x';
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal';
import Settings from 'lucide-react-native/icons/settings';

const symbols = {
  back: ['chevron.left', ChevronLeft],
  next: ['chevron.right', ChevronRight],
  help: ['questionmark.circle', CircleHelp],
  diet: ['leaf', Leaf],
  feedback: ['bubble.left', MessageSquare],
  allergens: ['shield', Shield],
  book: ['book', BookOpen],
  check: ['checkmark', Check],
  explore: ['safari', Compass],
  profile: ['person.crop.circle', UserRound],
  share: ['square.and.arrow.up', Share],
  timer: ['timer', Timer],
  close: ['xmark', X],
  edit: ['pencil', Pencil],
  external: ['arrow.up.right', ArrowUpRight],
  forward: ['arrow.right', ArrowRight],
  heart: ['heart', Heart],
  'heart-filled': ['heart.fill', Heart],
  star: ['star', Star],
  'star-filled': ['star.fill', Star],
  ingredients: ['fork.knife', Utensils],
  link: ['link', Link2],
  plus: ['plus', Plus],
  search: ['magnifyingglass', Search],
  shopping: ['basket', ShoppingBasket],
  trash: ['trash', Trash2],
  preferences: ['slider.horizontal.3', SlidersHorizontal],
  settings: ['gearshape', Settings],
} as const satisfies Record<string, readonly [SymbolViewProps['name'], unknown]>;

export function Glyph({ name, color, size = 18 }: { name: keyof typeof symbols; color: string; size?: number }) {
  const [symbol, Icon] = symbols[name];
  return Platform.OS === 'ios'
    ? <SymbolView accessible={false} name={symbol} tintColor={color} weight="medium" size={size} />
    : <Icon accessible={false} color={color} size={size} strokeWidth={1.65} fill={name === 'heart-filled' || name === 'star-filled' ? color : 'none'} />;
}
